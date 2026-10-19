# Módulo local do app (Expo Modules API), só iOS: tira pastas do backup do iCloud. Ver ExcluirDoBackupModule.swift.
Pod::Spec.new do |s|
  s.name           = 'ExcluirDoBackup'
  s.version        = '1.0.0'
  s.summary        = 'Tira pastas do app do backup do iCloud'
  s.description    = 'Marca pastas com dado do aluno (SQLite, fotos pendentes) como excluídas do backup do iCloud.'
  s.license        = { :type => 'Proprietary' }
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
