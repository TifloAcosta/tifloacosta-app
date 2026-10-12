#!/usr/bin/env ruby
# The iOS project is recreated for every CI build by "npx cap add ios".
# Apply App Store compliance metadata and deployment target consistently
# after generation, before building/signing/exporting the .ipa.
require 'xcodeproj'
require 'open3'

root = File.expand_path(__dir__)
project_path = File.join(root, 'ios/App/App.xcodeproj')
plist_path = File.join(root, 'ios/App/App/Info.plist')
podfile_path = File.join(root, 'ios/App/Podfile')
min_ios = '15.0'
plist_buddy = '/usr/libexec/PlistBuddy'

raise 'Missing generated Info.plist' unless File.file?(plist_path)
raise 'Missing generated Podfile' unless File.file?(podfile_path)

# Declare the purpose string required by Apple's location API validation.
# This entry does not itself request or collect the user's location.
location_key = ':NSLocationWhenInUseUsageDescription'
location_reason = 'TifloAcosta utiliza tu ubicación, si lo autorizas, para funciones que muestran información o recursos relacionados con tu zona.'
location_value, location_status = Open3.capture2e(plist_buddy, '-c', "Print #{location_key}", plist_path)
location_action = location_status.success? ? "Set #{location_key} #{location_reason}" : "Add #{location_key} string #{location_reason}"
location_result, location_result_status = Open3.capture2e(plist_buddy, '-c', location_action, plist_path)
raise 'Could not configure location purpose' unless location_result_status.success?
# The native iOS Files/photo chooser uses bundle localization, not the
# JavaScript language switch. The Capacitor-generated project defaults to
# English unless we explicitly register Spanish before the IPA is archived.
def set_plist_string(plist_buddy, plist_path, key, value)
  _, current = Open3.capture2e(plist_buddy, '-c', "Print :#{key}", plist_path)
  command = current.success? ? "Set :#{key} #{value}" : "Add :#{key} string #{value}"
  output, status = Open3.capture2e(plist_buddy, '-c', command, plist_path)
  raise "Unable to configure #{key}: #{output.strip}" unless status.success?
end

set_plist_string(plist_buddy, plist_path, 'CFBundleDevelopmentRegion', 'es')
_, locales_status = Open3.capture2e(plist_buddy, '-c', 'Print :CFBundleLocalizations', plist_path)
if locales_status.success?
  _, removed = Open3.capture2e(plist_buddy, '-c', 'Delete :CFBundleLocalizations', plist_path)
  raise 'Unable to reset iOS localizations' unless removed.success?
end
['Add :CFBundleLocalizations array', 'Add :CFBundleLocalizations:0 string es',
 'Add :CFBundleLocalizations:1 string en'].each do |command|
  output, status = Open3.capture2e(plist_buddy, '-c', command, plist_path)
  raise "Unable to configure iOS locale: #{output.strip}" unless status.success?
end

# Set the correct declaration: no *non-exempt* encryption. Standard HTTPS
# through Apple/OS networking remains allowed. Reassess if crypto changes.
key = ':ITSAppUsesNonExemptEncryption'
out, status = Open3.capture2e(plist_buddy, '-c', "Print #{key}", plist_path)
action = status.success? ? "Set #{key} false" : "Add #{key} bool false"
result, result_status = Open3.capture2e(plist_buddy, '-c', action, plist_path)
raise "Unable to configure encryption declaration: #{result.strip}" unless result_status.success?
value, value_status = Open3.capture2e(plist_buddy, '-c', "Print #{key}", plist_path)
raise 'Encryption export declaration is not Boolean false' unless value_status.success? && value.strip.downcase == 'false'

project = Xcodeproj::Project.open(project_path)
project.root_object.development_region = 'es'
app_target = project.targets.find { |target| target.name == 'App' }
raise 'Generated iOS application target not found' unless app_target
app_target.build_configurations.each do |configuration|
  configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios
end
project.save

podfile = File.read(podfile_path)
updated_podfile = podfile.sub(/^\s*platform\s+:ios,\s*['"][^'"]+['"]/, "platform :ios, '#{min_ios}'")
raise 'Podfile iOS platform not found' if updated_podfile == podfile && !podfile.include?("platform :ios, '#{min_ios}'")
File.write(podfile_path, updated_podfile) unless updated_podfile == podfile

verified = Xcodeproj::Project.open(project_path).targets.find { |target| target.name == 'App' }
raise 'iOS 15.0 target check failed' unless verified.build_configurations.all? { |config| config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] == min_ios }
raise 'Podfile iOS 15.0 check failed' unless File.read(podfile_path).match?(/^\s*platform\s+:ios,\s*'15\.0'/)

puts "App Store encryption compliance declared: ITSAppUsesNonExemptEncryption = false"
puts "Minimum iOS target for App and CocoaPods: #{min_ios}"
