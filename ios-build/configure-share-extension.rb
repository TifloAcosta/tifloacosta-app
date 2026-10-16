require 'xcodeproj'
require 'fileutils'
root = File.expand_path('ios/App', __dir__)
project_path = File.join(root, 'App.xcodeproj')
abort 'Xcode project missing' unless File.exist?(project_path)
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'App' }
abort 'App target missing' unless app
abort 'Duplicate Share Extension target' if project.targets.any? { |target| target.name == 'TifloAcostaShare' }

extension_dir = File.join(root, 'ShareExtension')
FileUtils.mkdir_p(extension_dir)
%w[Info.plist Share.entitlements ShareViewController.swift].each do |name|
  FileUtils.cp(File.expand_path("share-extension/#{name}", __dir__), File.join(extension_dir, name))
end
FileUtils.cp(File.expand_path('share-extension/App.entitlements', __dir__),
             File.join(root, 'App', 'App.entitlements'))

extension_target = project.new_target(:app_extension, 'TifloAcostaShare', :ios, '15.0')
folder = project.main_group.new_group('ShareExtension', 'ShareExtension')
source = folder.new_file('ShareViewController.swift')
extension_target.source_build_phase.add_file_reference(source)
folder.new_file('Info.plist')
folder.new_file('Share.entitlements')

extension_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.tifloacosta.app.ShareExtension'
  config.build_settings['PRODUCT_NAME'] = 'TifloAcostaShare'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = 'ShareExtension/Info.plist'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'ShareExtension/Share.entitlements'
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['SKIP_INSTALL'] = 'YES'
end
app.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

app.add_dependency(extension_target)
embed = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
embed.name = 'Embed App Extensions'
embed.dst_subfolder_spec = '13'
build_file = embed.add_file_reference(extension_target.product_reference, true)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
app.build_phases << embed
project.save

puts 'App Group and Share Extension installed in generated Xcode project.'
