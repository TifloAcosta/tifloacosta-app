Pod::Spec.new do |s|
  s.name = 'TifloReadingIos'
  s.version = '1.0.0'
  s.summary = 'TifloLector native iOS voices and on-device translation'
  s.license = { :type => 'MIT' }
  s.author = 'TifloAcosta'
  s.homepage = 'https://tifloacosta.com'
  s.source = { :git => 'https://github.com/TifloAcosta/tifloacosta-app.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/TifloReadingIos/**/*.{swift}'
  s.ios.deployment_target = '15.0'
  s.swift_version = '5.9'
  s.dependency 'Capacitor'
end
