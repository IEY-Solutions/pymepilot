---
name: codex-md-compliance
description: Verifica compliance del archivo AGENTS.md y reglas de seguridad del proyecto
---

\# Skill: AGENTS.md Compliance

\#\# 🎯 Qué es  
Sistema de validación para garantizar que el archivo \`AGENTS.md\` (reglas de seguridad para Codex) está completo, actualizado y siendo respetado en TODAS las sesiones de desarrollo.

\*\*Analogía Simple:\*\*  
AGENTS.md es como el "reglamento interno" de una empresa:  
\- Define qué puede hacer Codex y qué NO  
\- Lista archivos que NUNCA debe tocar (.env, backups, etc.)  
\- Especifica procedimientos obligatorios (tests antes de deploy)

Si Codex no respeta AGENTS.md:  
\- ❌ Puede modificar archivos sensibles  
\- ❌ Puede exponer credenciales  
\- ❌ Puede romper configuraciones críticas

\*\*Por qué es CRÍTICO:\*\*  
Tu AGENTS.md es la ÚNICA defensa entre "Codex ayudando" y "Codex destruyendo producción por accidente".

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Antes de CADA sesión con Codex (parte de codex-safe.sh)  
\- ✅ Después de cada sesión (parte de codex-audit.sh)  
\- ✅ Al agregar archivos/directorios nuevos al proyecto  
\- ✅ Al modificar configuraciones de seguridad

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Integrás servicios third-party (nuevos secrets)  
\- ⚠️ Modificás estructura de directorios  
\- ⚠️ Agregás dependencias con configs sensibles  
\- ⚠️ Creás nuevos entornos (staging, production)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Estructura de AGENTS.md para PymePilot

\*\*Archivo: \`/home/pato/pymepilot-core/AGENTS.md\`\*\*  
\`\`\`markdown  
\# AGENTS.md \- Reglas de Seguridad para PymePilot

\*\*Última actualización:\*\* 2025-02-16  
\*\*Proyecto:\*\* PymePilot (Sistema BI para distribuidores B2B)  
\*\*Servidor:\*\* Contabo (compartido con IEY)

\---

\#\# 🚫 ARCHIVOS Y DIRECTORIOS PROHIBIDOS

\#\#\# NUNCA Leer, Modificar o Eliminar:

\#\#\#\# Secrets y Configuración Sensible  
\`\`\`  
❌ .env  
❌ .env.local  
❌ .env.production  
❌ .env.\*.local  
❌ serviceAccountKey.json  
❌ \*.pem  
❌ \*.key  
❌ config/secrets.json  
\`\`\`

\#\#\#\# Base de Datos y Backups  
\`\`\`  
❌ /backups/\*  
❌ /var/lib/postgresql/\*  
❌ \*.sql (archivos de backup)  
❌ \*.dump  
\`\`\`

\#\#\#\# Configuración de Sistema  
\`\`\`  
❌ /etc/postgresql/\*  
❌ /etc/nginx/\*  
❌ /etc/traefik/\*  
❌ docker-compose.prod.yml (solo lectura permitida, NO modificar)  
\`\`\`

\#\#\#\# Otros Proyectos en el Servidor  
\`\`\`  
❌ /home/pato/iey-\*  (cualquier directorio de IEY)  
❌ /home/pato/\_templates/\*  
❌ /home/pato/scripts/claude-\*.sh (solo lectura)  
\`\`\`

\---

\#\# ✅ ARCHIVOS QUE PUEDES MODIFICAR

\#\#\# Código de Aplicación  
\`\`\`  
✅ /src/\*\*/\*.py  
✅ /app/\*\*/\*.ts  
✅ /app/\*\*/\*.tsx  
✅ /components/\*\*/\*.tsx  
✅ /lib/\*\*/\*.ts  
\`\`\`

\#\#\# Tests  
\`\`\`  
✅ /tests/\*\*/\*.py  
✅ /\_\_tests\_\_/\*\*/\*.ts  
✅ \*.test.ts  
✅ \*.spec.ts  
\`\`\`

\#\#\# Documentación  
\`\`\`  
✅ README.md  
✅ /docs/\*\*/\*.md  
✅ CHANGELOG.md  
\`\`\`

\#\#\# Configuración de Desarrollo  
\`\`\`  
✅ package.json  
✅ requirements.txt  
✅ tsconfig.json  
✅ .eslintrc.js  
✅ .prettierrc  
✅ docker-compose.dev.yml  


