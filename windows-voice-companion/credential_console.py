"""Developer-only local Windows console for credential-vault operations.

Not a release installer. Not an HTTP endpoint. Never prints or returns secrets
to the browser. Requires Windows and a local interactive terminal.
"""
import getpass
import os
from credential_vault import CredentialVault, PROVIDER_IDS

def choose_provider():
    print("Proveedores: google, elevenlabs, azure, polly")
    name = input("Nombre del proveedor: ").strip().lower()
    if name not in PROVIDER_IDS:
        raise ValueError("Proveedor desconocido")
    return name

def run():
    if os.name != "nt":
        print("El almacén DPAPI solo funciona en Windows.")
        return
    vault = CredentialVault()
    while True:
        print("\nTifloAcosta. Gestión local de claves, prototipo para desarrolladores.")
        print("1. Guardar clave. 2. Comprobar configuración. 3. Borrar clave. 4. Salir.")
        action = input("Selecciona una opción: ").strip()
        if action == "4":
            break
        if action not in ("1", "2", "3"):
            print("Opción no reconocida.")
            continue
        try:
            provider = choose_provider()
            if action == "2":
                print("Clave configurada." if vault.configured(provider) else "No hay clave configurada.")
            elif action == "1":
                print("La clave no aparecerá en pantalla. No la pegues en la web.")
                key = getpass.getpass("Clave API: ")
                if not key.strip():
                    print("No se ha guardado ninguna clave.")
                    continue
                answer = input("¿Guardar la clave cifrada para este usuario de Windows? Escribe SI: ")
                if answer.strip().upper() == "SI":
                    vault.save(provider, key)
                    print("Clave cifrada y guardada.")
                else:
                    print("Operación cancelada.")
            else:
                answer = input("¿Eliminar la clave guardada de este proveedor? Escribe ELIMINAR: ")
                if answer.strip().upper() == "ELIMINAR":
                    vault.remove(provider)
                    print("Clave local eliminada.")
                else:
                    print("Operación cancelada.")
        except (ValueError, OSError) as error:
            print("No se completó la operación. Comprueba los permisos y la configuración local.")

if __name__ == "__main__":
    run()
