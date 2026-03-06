#!/usr/bin/env python3
"""
Genera VAPID keys y las agrega a los archivos .env.

Uso:
    python backend/scripts/setup_vapid.py

QUE HACE:
1. Genera un par de claves VAPID (privada + publica)
2. Agrega VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS_EMAIL al .env
3. Agrega NEXT_PUBLIC_VAPID_PUBLIC_KEY al frontend/.env.local
"""

import base64
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py_vapid import Vapid
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, ".env")
    frontend_env_path = os.path.join(project_root, "frontend", ".env.local")

    # Generar claves
    v = Vapid()
    v.generate_keys()

    priv_raw = v.private_key.private_numbers().private_value.to_bytes(32, "big")
    pub_raw = v.private_key.public_key().public_bytes(
        Encoding.X962, PublicFormat.UncompressedPoint
    )

    priv_b64 = base64.urlsafe_b64encode(priv_raw).rstrip(b"=").decode()
    pub_b64 = base64.urlsafe_b64encode(pub_raw).rstrip(b"=").decode()

    print(f"Private key: {priv_b64}")
    print(f"Public key:  {pub_b64}")
    print()

    # Verificar consistencia: derivar publica desde privada
    v2 = Vapid.from_raw(priv_b64.encode())
    derived = base64.urlsafe_b64encode(
        v2.private_key.public_key().public_bytes(
            Encoding.X962, PublicFormat.UncompressedPoint
        )
    ).rstrip(b"=").decode()
    assert derived == pub_b64, "ERROR: las claves no coinciden!"
    print("Verificacion: claves coinciden OK")
    print()

    # Limpiar entradas VAPID viejas del .env
    for path in [env_path, frontend_env_path]:
        if os.path.exists(path):
            with open(path, "r") as f:
                lines = f.readlines()
            with open(path, "w") as f:
                for line in lines:
                    if not any(
                        line.startswith(k)
                        for k in [
                            "VAPID_PRIVATE_KEY",
                            "VAPID_PUBLIC_KEY",
                            "VAPID_CLAIMS_EMAIL",
                            "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
                            "# VAPID Keys",
                        ]
                    ):
                        f.write(line)

    # Agregar al .env principal
    with open(env_path, "a") as f:
        f.write("\n# VAPID Keys para Web Push Notifications\n")
        f.write(f"VAPID_PRIVATE_KEY={priv_b64}\n")
        f.write(f"VAPID_PUBLIC_KEY={pub_b64}\n")
        f.write("VAPID_CLAIMS_EMAIL=pato@pymepilot.cloud\n")
    print(f"Escrito en: {env_path}")

    # Agregar al frontend/.env.local
    with open(frontend_env_path, "a") as f:
        f.write(f"\nNEXT_PUBLIC_VAPID_PUBLIC_KEY={pub_b64}\n")
    print(f"Escrito en: {frontend_env_path}")

    print()
    print("Listo! Ahora:")
    print("1. Re-deploy frontend: cd frontend && bash deploy.sh")
    print("2. Suscribite de nuevo en el navegador")


if __name__ == "__main__":
    main()
