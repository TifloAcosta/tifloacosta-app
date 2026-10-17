#!/usr/bin/env ruby
# The iOS project is recreated for every CI build by "npx cap add ios".
# Apply App Store compliance metadata and deployment target consistently
# after generation, before building/signing/exporting the .ipa.
require 'xcodeproj'
require 'open3'

root = File.expand_path(__dir__)
native_root = ENV.fetch('TIFLO_IOS_NATIVE_ROOT', File.join(root, 'ios'))
project_path = File.join(native_root, 'App/App.xcodeproj')
plist_path = File.join(native_root, 'App/App/Info.plist')
podfile_path = File.join(native_root, 'App/Podfile')
min_ios = '15.0'
plist_buddy = '/usr/libexec/PlistBuddy'

raise 'Missing generated Info.plist' unless File.file?(plist_path)
has_podfile = File.file?(podfile_path) # Capacitor 8 can use Swift Package Manager only

# Set the correct declaration: no *non-exempt* encryption. Standard HTTPS
# through Apple/OS networking remains allowed. Reassess if crypto changes.
key = ':ITSAppUsesNonExemptEncryption'
out, status = Open3.capture2e(plist_buddy, '-c', "Print #{key}", plist_path)
action = status.success? ? "Set #{key} false" : "Add #{key} bool false"
result, result_status = Open3.capture2e(plist_buddy, '-c', action, plist_path)
raise "Unable to configure encryption declaration: #{result.strip}" unless result_status.success?
value, value_status = Open3.capture2e(plist_buddy, '-c', "Print #{key}", plist_path)
raise 'Encryption export declaration is not Boolean false' unless value_status.success? && value.strip.downcase == 'false'

# Apple ITMS-90683: SDKs enlazados pueden hacer referencia a APIs de ubicación
# incluso si el lector no solicita ubicación en sus funciones habituales.
location_key = ':NSLocationWhenInUseUsageDescription'
location_purpose = 'TifloAcosta solo solicitará tu ubicación si utilizas una función que la necesite para ofrecer servicios cercanos y siempre con tu permiso.'
_, existing_location_status = Open3.capture2e(plist_buddy, '-c', "Print #{location_key}", plist_path)
location_action = existing_location_status.success? ? "Set #{location_key} #{location_purpose}" : "Add #{location_key} string #{location_purpose}"
location_output, location_status = Open3.capture2e(plist_buddy, '-c', location_action, plist_path)
raise "Unable to declare location usage: #{location_output.strip}" unless location_status.success?

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == 'App' }
raise 'Generated iOS application target not found' unless app_target
app_target.build_configurations.each do |configuration|
  configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
end
project.save

if has_podfile
  podfile = File.read(podfile_path)
  updated_podfile = podfile.sub(/^\s*platform\s+:ios,\s*['"][^'"]+['"]/, "platform :ios, '#{min_ios}'")
  raise 'Podfile iOS platform not found' if updated_podfile == podfile && !podfile.include?("platform :ios, '#{min_ios}'")
  File.write(podfile_path, updated_podfile) unless updated_podfile == podfile
end

verified = Xcodeproj::Project.open(project_path).targets.find { |target| target.name == 'App' }
raise 'iOS 15.0 target check failed' unless verified.build_configurations.all? { |config| config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] == min_ios }
raise 'Podfile iOS 15.0 check failed' unless File.read(podfile_path).match?(/^\s*platform\s+:ios,\s*'15\.0'/)

puts "App Store encryption compliance declared: ITSAppUsesNonExemptEncryption = false"
puts "Minimum iOS target for App#{has_podfile ? ' and CocoaPods' : ' (Swift Package Manager)'}: #{min_ios}"
