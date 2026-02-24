# Guia: Setup Google Drive (Canal 3)

**Prerequisito para:** `sync_google_drive.py` (Paso 5 del plan Ingesta Fase 2)
**Tiempo estimado:** 15-20 minutos
**Donde:** Google Cloud Console (https://console.cloud.google.com)

---

## Paso 1: Crear proyecto en Google Cloud

1. Ir a https://console.cloud.google.com
2. Click en el selector de proyecto (arriba a la izquierda)
3. Click en "Nuevo Proyecto"
4. Nombre: `pymepilot-drive` (o lo que quieras)
5. Click "Crear"
6. Esperar que se cree y asegurarse de que quede seleccionado

## Paso 2: Habilitar Google Drive API

1. Ir al menu lateral: "APIs y servicios" > "Biblioteca"
2. Buscar "Google Drive API"
3. Click en el resultado
4. Click "Habilitar"
5. Esperar unos segundos

## Paso 3: Crear Service Account

1. Ir al menu lateral: "IAM y administracion" > "Cuentas de servicio"
2. Click "Crear cuenta de servicio"
3. Nombre: `pymepilot-drive-sync`
4. ID: se autocompleta (ej: `pymepilot-drive-sync@pymepilot-drive.iam.gserviceaccount.com`)
5. Descripcion: "Sync automatico de archivos Drive para PymePilot"
6. Click "Crear y continuar"
7. **Roles:** Saltar (no necesita roles en el proyecto, solo acceso a carpetas compartidas)
8. Click "Listo"

**IMPORTANTE:** Copiar el email de la cuenta de servicio. Se ve asi:
```
pymepilot-drive-sync@pymepilot-drive.iam.gserviceaccount.com
```

## Paso 4: Descargar credenciales JSON

1. En la lista de cuentas de servicio, click en la que acabas de crear
2. Ir a la pestana "Claves"
3. Click "Agregar clave" > "Crear clave nueva"
4. Formato: **JSON**
5. Click "Crear"
6. Se descarga un archivo .json a tu PC (ej: `pymepilot-drive-xxxxx.json`)

**SEGURIDAD:** Este archivo es un secreto. No lo compartas ni lo subas a Git.

## Paso 5: Copiar credenciales al servidor

Desde PowerShell en tu PC:

```powershell
scp "C:\Users\TU_USUARIO\Downloads\pymepilot-drive-xxxxx.json" pato@173.249.9.56:/home/pato/projects/pymepilot/credentials/google-drive-sa.json
```

Si no existe el directorio `credentials/`:
```powershell
ssh pato@173.249.9.56 "mkdir -p /home/pato/projects/pymepilot/credentials && chmod 700 /home/pato/projects/pymepilot/credentials"
```

Despues de copiar, asegurar permisos en el servidor:
```bash
chmod 600 /home/pato/projects/pymepilot/credentials/google-drive-sa.json
```

## Paso 6: Configurar .env

Agregar al `.env` del proyecto:
```
GOOGLE_SERVICE_ACCOUNT_PATH=/home/pato/projects/pymepilot/credentials/google-drive-sa.json
```

## Paso 7: Configurar email del Service Account en el frontend

Agregar al `frontend/.env.local`:
```
NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL=pymepilot-drive-sync@pymepilot-drive.iam.gserviceaccount.com
```
(Reemplazar con el email real del paso 3)

## Paso 8: Instalar dependencias Python

```bash
cd /home/pato/projects/pymepilot
backend/venv/bin/pip install google-api-python-client google-auth
```

## Paso 9: Configurar cron

```bash
# Agregar al crontab (si no se agrego en la sesion anterior):
# 30 4 * * * cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/scripts/sync_google_drive.py >> /home/pato/logs/drive-sync.log 2>&1
```

## Paso 10: Test manual

```bash
cd /home/pato/projects/pymepilot
backend/venv/bin/python backend/scripts/sync_google_drive.py
```

Si no hay conexiones Drive activas, va a decir "No hay conexiones Drive activas" (correcto).

## Despues del setup: Como conectar una carpeta

1. Crear una carpeta en Google Drive (o usar una existente)
2. Compartirla con el email del Service Account (con permiso de "Lector")
3. Copiar el link de la carpeta
4. Ir a app.pymepilot.cloud > Datos
5. Pegar el link en "Google Drive"
6. Click "Conectar"
7. A las 4:30 AM del dia siguiente, el sync automatico detecta archivos .xlsx

---

## Troubleshooting

**"GOOGLE_SERVICE_ACCOUNT_PATH no configurado"**
→ Falta el paso 6. Agregar la variable al .env.

**"Archivo de credenciales no encontrado"**
→ Falta el paso 5. El archivo JSON no esta en la ruta configurada.

**"HttpError 404: File not found"**
→ La carpeta no fue compartida con el Service Account. Verificar paso 3 + compartir.

**"HttpError 403: The caller does not have permission"**
→ La carpeta no esta compartida, o el permiso es incorrecto. Debe ser "Lector" minimo.
