from pathlib import Path
import os
import glob
import zipfile
import plistlib
import subprocess
import tempfile

files = glob.glob(os.environ['RUNNER_TEMP'] + '/native-export/*.ipa')
if len(files) != 1:
    raise SystemExit('No se generó una sola IPA')

group = 'group.com.tifloacosta.app'
with zipfile.ZipFile(files[0]) as z:
    app_info_path = next((p for p in z.namelist()
                          if p.startswith('Payload/') and p.endswith('.app/Info.plist')), None)
    extension_info_path = next((p for p in z.namelist()
                                if '.appex/Info.plist' in p), None)
    if not app_info_path or not extension_info_path:
        raise SystemExit('Falta la app o su Share Extension')
    app_info = plistlib.loads(z.read(app_info_path))
    ext_info = plistlib.loads(z.read(extension_info_path))
    for info, identifier in [(app_info, 'com.tifloacosta.app'),
                             (ext_info, 'com.tifloacosta.app.ShareExtension')]:
        if info.get('CFBundleIdentifier') != identifier:
            raise SystemExit('Identificador incorrecto: ' + str(info.get('CFBundleIdentifier')))
        if str(info.get('CFBundleVersion')) != os.environ['IOS_BUILD_VERSION']:
            raise SystemExit('Número de compilación distinto entre aplicación y extensión')
        if info.get('CFBundleShortVersionString') != '1.0':
            raise SystemExit('Versión pública incorrecta')
    if ext_info.get('NSExtension', {}).get('NSExtensionPointIdentifier') != 'com.apple.share-services':
        raise SystemExit('Extensión Compartir sin punto de entrada')

    with tempfile.TemporaryDirectory(prefix='tiflo-ipa-') as temp:
        z.extractall(temp)
        for info_path, identifier in [
            (app_info_path, 'com.tifloacosta.app'),
            (extension_info_path, 'com.tifloacosta.app.ShareExtension')
        ]:
            bundle = Path(temp) / info_path.rsplit('/Info.plist', 1)[0]
            embedded = bundle / 'embedded.mobileprovision'
            if not embedded.exists():
                raise SystemExit('No está el perfil de firma de ' + identifier)
            decoded = subprocess.check_output(
                ['security', 'cms', '-D', '-i', str(embedded)]
            )
            profile = plistlib.loads(decoded)
            profile_groups = profile.get('Entitlements', {}).get(
                'com.apple.security.application-groups', [])
            if group not in profile_groups:
                raise SystemExit('El perfil de ' + identifier +
                                 ' carece del App Group ' + group)
            try:
                signed = subprocess.check_output(
                    ['codesign', '-d', '--entitlements', '-', '--xml', str(bundle)],
                    stderr=subprocess.DEVNULL
                )
                entitlements = plistlib.loads(signed)
            except Exception as error:
                raise SystemExit('No se pueden inspeccionar los permisos firmados de ' +
                                 identifier + ': ' + str(error))
            signed_groups = entitlements.get('com.apple.security.application-groups', [])
            if group not in signed_groups:
                raise SystemExit('La firma de ' + identifier +
                                 ' no incluye ' + group)
            print('App Group autorizado y firmado para ' + identifier)

print('IPA verificada: app y extensión firmadas con el mismo App Group')
