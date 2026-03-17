\# Skill: CLAUDE.md Compliance

\#\# 🎯 Qué es  
Sistema de validación para garantizar que el archivo \`CLAUDE.md\` (reglas de seguridad para Claude Code) está completo, actualizado y siendo respetado en TODAS las sesiones de desarrollo.

\*\*Analogía Simple:\*\*  
CLAUDE.md es como el "reglamento interno" de una empresa:  
\- Define qué puede hacer Claude Code y qué NO  
\- Lista archivos que NUNCA debe tocar (.env, backups, etc.)  
\- Especifica procedimientos obligatorios (tests antes de deploy)

Si Claude Code no respeta CLAUDE.md:  
\- ❌ Puede modificar archivos sensibles  
\- ❌ Puede exponer credenciales  
\- ❌ Puede romper configuraciones críticas

\*\*Por qué es CRÍTICO:\*\*  
Tu CLAUDE.md es la ÚNICA defensa entre "Claude Code ayudando" y "Claude Code destruyendo producción por accidente".

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Antes de CADA sesión con Claude Code (parte de claude-safe.sh)  
\- ✅ Después de cada sesión (parte de claude-audit.sh)  
\- ✅ Al agregar archivos/directorios nuevos al proyecto  
\- ✅ Al modificar configuraciones de seguridad

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Integrás servicios third-party (nuevos secrets)  
\- ⚠️ Modificás estructura de directorios  
\- ⚠️ Agregás dependencias con configs sensibles  
\- ⚠️ Creás nuevos entornos (staging, production)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Estructura de CLAUDE.md para PymePilot

\*\*Archivo: \`/home/pato/pymepilot-core/CLAUDE.md\`\*\*  
\`\`\`markdown  
\# CLAUDE.md \- Reglas de Seguridad para PymePilot

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
