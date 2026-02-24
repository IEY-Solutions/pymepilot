#!/usr/bin/env python3
"""Genera un JWT de service_role firmado con el JWT_SECRET de Supabase."""
import jwt

with open("/opt/orion-stack/.env") as f:
    lines = f.read().splitlines()

secret = None
for line in lines:
    if line.startswith("JWT_SECRET="):
        secret = line.split("=", 1)[1].strip()
        break

if not secret:
    print("ERROR: JWT_SECRET no encontrado en /opt/orion-stack/.env")
    exit(1)

token = jwt.encode(
    {"role": "service_role", "iss": "supabase", "iat": 1704067200, "exp": 2019427200},
    secret,
    algorithm="HS256",
)
print(token)
