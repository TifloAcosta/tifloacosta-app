# frozen_string_literal: true
# After `npx cap add ios`, add a real iOS Share Extension target.
# Regenerated projects cannot be modified by hand: this script is idempotent.
require 'fileutils'
require 'xcodeproj'

root = File.expand_path(__dir__)
ios_root = File.join(root, 'ios', 'App')
project_path = File.join(ios_root, 'App.xcodeproj')
abort 'Missing generated Capacitor project' unless File.exist?(project_path)
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'App' }
abort 'Missing host application target' unless app

source = File.join(root, 'share-extension')
target_dir = File.join(ios_root, 'TifloShareExtension')
FileUtils.mkdir_p(target_dir)
%w[Info.plist ShareViewController.swift ShareExtension.entitlements].each do |name|
  FileUtils.cp(File.join(source, name), File.join(target_dir, name))
end
FileUtils.cp(File.join(source, 'App.entitlements'),
             File.join(ios_root, 'App', 'App.entitlements'))

ext = project.targets.find { |target| target.name == 'TifloShareExtension' }
unless ext
  ext = project.new_target(:app_extension, 'TifloShareExtension', :ios, '15.0')
  group = project.main_group.find_subpath('TifloShareExtension', true)
  group.set_source_tree('<group>')
  swift = group.new_file('TifloShareExtension/ShareViewController.swift')
  ext.source_build_phase.add_file_reference(swift)
  embed = app.copy_files_build_phases.find { |phase| phase.name == 'Embed App Extensions' }
  embed ||= app.new_copy_files_build_phase('Embed App Extensions')
  embed.dst_subfolder_spec = '13'
  embed.dst_path = ''
  embed.add_file_reference(ext.product_reference, true)
  app.add_dependency(ext)
end

team = '3A8G8A62YZ'
app.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end
ext.build_configurations.each do |config|
  settings = config.build_settings
  settings['PRODUCT_NAME'] = 'TifloShareExtension'
  settings['PRODUCT_MODULE_NAME'] = 'TifloShareExtension'
  settings['EXECUTABLE_NAME'] = 'TifloShareExtension'
  settings['MACH_O_TYPE'] = 'mh_execute'
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.tifloacosta.app.ShareExtension'
  settings['INFOPLIST_FILE'] = 'TifloShareExtension/Info.plist'
  settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  settings['CODE_SIGN_ENTITLEMENTS'] = 'TifloShareExtension/ShareExtension.entitlements'
  settings['DEVELOPMENT_TEAM'] = team
  settings['SWIFT_VERSION'] = '5.0'
  settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  settings['SKIP_INSTALL'] = 'YES'
  settings['CODE_SIGN_STYLE'] = 'Manual' if config.name == 'Release'
end
attrs = project.root_object.attributes
attrs['TargetAttributes'] ||= {}
[app, ext].each do |target|
  attrs['TargetAttributes'][target.uuid] ||= {}
  attrs['TargetAttributes'][target.uuid]['DevelopmentTeam'] = team
end
project.save
puts 'TifloAcosta: Share Extension and App Group entitlements installed'
