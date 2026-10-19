from pathlib import Path
import os,glob,zipfile,plistlib
files=glob.glob(os.environ['RUNNER_TEMP']+'/native-export/*.ipa')
if len(files)!=1: raise SystemExit('No se generó una sola IPA')
with zipfile.ZipFile(files[0]) as z:
    app=next((p for p in z.namelist() if p.startswith('Payload/') and p.endswith('.app/Info.plist')),None)
    extension=next((p for p in z.namelist() if '.appex/Info.plist' in p),None)
    if not app or not extension: raise SystemExit('Falta la app o su Share Extension')
    app_info=plistlib.loads(z.read(app))
    ext_info=plistlib.loads(z.read(extension))
    for info,identifier in [(app_info,'com.tifloacosta.app'),
                            (ext_info,'com.tifloacosta.app.ShareExtension')]:
        if info.get('CFBundleIdentifier')!=identifier:
            raise SystemExit('Identificador incorrecto: '+str(info.get('CFBundleIdentifier')))
        if str(info.get('CFBundleVersion'))!=os.environ['IOS_BUILD_VERSION']:
            raise SystemExit('Número de compilación distinto entre aplicación y extensión')
        if info.get('CFBundleShortVersionString')!='1.0':
            raise SystemExit('Versión pública incorrecta')
    if ext_info.get('NSExtension',{}).get('NSExtensionPointIdentifier')!='com.apple.share-services':
        raise SystemExit('Extensión compartir sin punto de entrada')
print('IPA correcta, incluye aplicación y extensión con el mismo número de compilación')
