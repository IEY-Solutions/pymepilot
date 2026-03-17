\# Skill: Secret Detection

\#\# 🎯 Qué es  
Sistema automatizado para detectar secrets (API keys, passwords, tokens) hardcodeados en código ANTES de que lleguen al repo. Previene el leak \#1 más común en startups.

\*\*Analogía Simple:\*\*  
Es como un detector de metales en un aeropuerto, pero para código:  
\- 🔍 Escanea cada archivo  
\- 🚨 Alerta si encuentra algo sospechoso (passwords, keys)  
\- 🛑 Bloquea el commit si hay secrets

\*\*En la realidad:\*\*  
Detecta patterns como:  
\- \`password \= "abc123"\`  
\- \`API\_KEY \= "sk\_live\_..."\`  
\- \`JWT\_SECRET \= "mi-secreto"\`

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Antes de CADA commit  
\- ✅ En pre-commit hook (automatizado)  
\- ✅ En CI/CD pipeline  
\- ✅ Antes de cada PR

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Integrás un servicio third-party (Kommo, WhatsApp, Claude API)  
\- ⚠️ Modificás archivos de configuración  
\- ⚠️ Creás nuevos archivos .env.example  
\- ⚠️ Copiás código de otro proyecto

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Usar \`detect-secrets\`

\*\*Instalación:\*\*  
\`\`\`bash  
\# En tu servidor/local  
pip install detect-secrets \--break-system-packages  
\`\`\`

\*\*Configuración inicial:\*\*  
\`\`\`bash  
cd /home/pato/pymepilot-core

\# Crear baseline (primera vez)  
detect-secrets scan \> .secrets.baseline

\# Esto crea un archivo con TODOS los "secretos" actuales  
\# Después vas a marcar los falsos positivos  
\`\`\`

\*\*Uso diario:\*\*  
\`\`\`bash  
\# Antes de commit, escanear cambios  
detect-secrets scan \--baseline .secrets.baseline

\# Si encuentra algo nuevo → ALERTA  
\# Si todo ok → Silencio (todo bien)  
\`\`\`

\#\#\# Práctica 2: Pre-commit Hook

\*\*Crear archivo \`.git/hooks/pre-commit\`:\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Pre-commit hook para PymePilot

echo "🔍 Escaneando secrets antes de commit..."

\# Escanear staged files  
detect-secrets-hook \--baseline .secrets.baseline $(git diff \--cached \--name-only)

if \[ $? \-ne 0 \]; then  
    echo ""  
    echo "🛑🛑🛑 COMMIT BLOQUEADO 🛑🛑🛑"  
    echo ""  
    echo "❌ Detecté secrets en los archivos."  
    echo ""  
    echo "Opciones:"  
    echo "1. Si es un falso positivo:"  
    echo "   \- Ejecutá: detect-secrets scan \--update .secrets.baseline"  
    echo "   \- Marcá como falso positivo en .secrets.baseline"  
    echo ""  
    echo "2. Si es un secret real:"  
    echo "   \- Movelo a .env"  
    echo "   \- Usá os.getenv('NOMBRE\_SECRET')"  
    echo "   \- Verificá que .env esté en .gitignore"  
    echo ""  
    exit 1  
fi

echo "✅ No se detectaron secrets. Commit permitido."  
exit 0  
\`\`\`

\*\*Hacer ejecutable:\*\*  
\`\`\`bash  
chmod \+x .git/hooks/pre-commit  
\`\`\`

\#\#\# Práctica 3: Patterns Personalizados para PymePilot

\*\*Crear archivo \`.secrets.patterns\`:\*\*  
\`\`\`yaml  
\# Patterns específicos de PymePilot

\# Supabase  
\- name: Supabase Service Role Key  
  pattern: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\.\[A-Za-z0-9\_-\]\*\\.\[A-Za-z0-9\_-\]\*'  
    
\# Claude API  
\- name: Anthropic API Key  
  pattern: 'sk-ant-api03-\[A-Za-z0-9\_-\]{95}'  
    
\# Kommo CRM  
\- name: Kommo Access Token  
  pattern: 'def\[0-9a-f\]{96}'  
    
\# WhatsApp Business API  
\- name: WhatsApp Token  
  pattern: 'EAA\[A-Za-z0-9\]{100,}'  
    
\# PostgreSQL  
\- name: PostgreSQL Connection String  
  pattern: 'postgresql://\[^:\]+:\[^@\]+@\[^/\]+/\\w+'  
    
\# JWT Secrets  
\- name: JWT Secret  
  pattern: 'JWT\_SECRET\\s\*=\\s\*\["\\'\]\[^"\\'\]+\["\\'\]'  
\`\`\`

\*\*Usar patterns personalizados:\*\*  
\`\`\`bash  
detect-secrets scan \--custom-plugins .secrets.patterns  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Detectar Supabase Keys

\*\*❌ Código MALO (detectado):\*\*  
\`\`\`typescript  
// config/supabase.ts  
const supabaseUrl \= 'https://xyzcompany.supabase.co'  
const supabaseKey \= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyfQ.1234567890abcdefghijklmnopqrstuvwxyz'

export const supabase \= createClient(supabaseUrl, supabaseKey)  
\`\`\`

\*\*detect-secrets output:\*\*  
\`\`\`  
🚨 Secret detected in config/supabase.ts:3  
Type: JSON Web Token  
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

🛑 COMMIT BLOQUEADO  
\`\`\`

\*\*✅ Código BUENO (fix):\*\*  
\`\`\`typescript  
// config/supabase.ts  
const supabaseUrl \= process.env.NEXT\_PUBLIC\_SUPABASE\_URL  
const supabaseKey \= process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY

if (\!supabaseUrl || \!supabaseKey) {  
  throw new Error('Missing Supabase environment variables')  
}

export const supabase \= createClient(supabaseUrl, supabaseKey)  
\`\`\`  
\`\`\`bash  
\# .env (NO commiteado)  
NEXT\_PUBLIC\_SUPABASE\_URL=https://xyzcompany.supabase.co  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  
\`\`\`

\#\#\# Ejemplo 2: Detectar Claude API Key

\*\*❌ Código MALO:\*\*  
\`\`\`python  
\# vertical\_activacion.py  
import anthropic

client \= anthropic.Anthropic(  
    api\_key="sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123456789"  
)  
\`\`\`

\*\*detect-secrets output:\*\*  
\`\`\`  
🚨 Secret detected in vertical\_activacion.py:4  
Type: Anthropic API Key  
Pattern: sk-ant-api03-\*

🛑 COMMIT BLOQUEADO  
\`\`\`

\*\*✅ Código BUENO:\*\*  
\`\`\`python  
\# vertical\_activacion.py  
import anthropic  
import os

api\_key \= os.getenv('ANTHROPIC\_API\_KEY')  
if not api\_key:  
    raise ValueError('ANTHROPIC\_API\_KEY not set in environment')

client \= anthropic.Anthropic(api\_key=api\_key)  
\`\`\`  
\`\`\`bash  
\# .env  
ANTHROPIC\_API\_KEY=sk-ant-api03-1234567890...  
\`\`\`

\#\#\# Ejemplo 3: PostgreSQL Connection String

\*\*❌ Código MALO:\*\*  
\`\`\`python  
\# db/connection.py  
import psycopg

conn \= psycopg.connect(  
    "postgresql://pymepilot\_user:MiPassword123\!@localhost:5432/pymepilot\_db"  
)  
\`\`\`

\*\*detect-secrets output:\*\*  
\`\`\`  
🚨 Secret detected in db/connection.py:4  
Type: PostgreSQL Connection String  
Contains: username, password, host, database

🛑 COMMIT BLOQUEADO  
\`\`\`

\*\*✅ Código BUENO:\*\*  
\`\`\`python  
\# db/connection.py  
import psycopg  
import os

DATABASE\_URL \= os.getenv('DATABASE\_URL')  
if not DATABASE\_URL:  
    raise ValueError('DATABASE\_URL not configured')

conn \= psycopg.connect(DATABASE\_URL)  
\`\`\`  
\`\`\`bash  
\# .env  
DATABASE\_URL=postgresql://pymepilot\_user:MiPassword123\!@localhost:5432/pymepilot\_db  
\`\`\`

\---

\#\# 🚨 Errores Comunes a Evitar

\#\#\# Error 1: .env.example con valores reales

\*\*❌ MAL:\*\*  
\`\`\`bash  
\# .env.example (commiteado)  
SUPABASE\_URL=https://xyzcompany.supabase.co  
SUPABASE\_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... ← ❌ KEY REAL  
DATABASE\_PASSWORD=MiPasswordReal123 ← ❌ PASSWORD REAL  
\`\`\`

\*\*✅ BIEN:\*\*  
\`\`\`bash  
\# .env.example (commiteado \- seguro)  
SUPABASE\_URL=https://your-project.supabase.co  
SUPABASE\_KEY=your-supabase-anon-key-here  
DATABASE\_PASSWORD=your-secure-password-here  
ANTHROPIC\_API\_KEY=sk-ant-api03-your-key-here  
\`\`\`

\#\#\# Error 2: Secrets en comentarios

\*\*❌ MAL:\*\*  
\`\`\`python  
\# Para testing usar: ANTHROPIC\_API\_KEY=sk-ant-api03-ABC123...  
\# import anthropic  
\# client \= anthropic.Anthropic(api\_key="sk-ant-api03-ABC123...")  
\`\`\`

\*\*detect-secrets\*\* va a detectar el secret INCLUSO en comentarios.

\*\*✅ BIEN:\*\*  
\`\`\`python  
\# Para testing configurar ANTHROPIC\_API\_KEY en .env  
\# Ejemplo en .env.example  
import anthropic  
client \= anthropic.Anthropic(api\_key=os.getenv('ANTHROPIC\_API\_KEY'))  
\`\`\`

\#\#\# Error 3: Secrets en logs

\*\*❌ MAL:\*\*  
\`\`\`python  
logger.info(f"Connecting to Supabase with key: {supabase\_key}")  
logger.debug(f"API request to Claude with token: {api\_token}")  
\`\`\`

\*\*✅ BIEN:\*\*  
\`\`\`python  
logger.info(f"Connecting to Supabase at {supabase\_url}")  
logger.debug(f"API request to Claude with token ending in ...{api\_token\[-4:\]}")  
\`\`\`

\#\#\# Error 4: Commits anteriores con secrets

\*\*Problema:\*\*  
Borraste el secret del código actual, pero está en el historial de Git.

\*\*Solución:\*\*  
\`\`\`bash  
\# Eliminar secret del historial (PELIGROSO \- solo si no pusheaste)  
git filter-branch \--force \--index-filter \\  
  "git rm \--cached \--ignore-unmatch path/to/file/with/secret.py" \\  
  \--prune-empty \--tag-name-filter cat \-- \--all

\# Si ya pusheaste → ROTAR el secret inmediatamente  
\# (generar nuevo API key, invalidar el viejo)  
\`\`\`

\---

\#\# ✅ Checklist de Validación

Antes de aprobar código:

\#\#\# Escaneo Básico  
\- \[ \] \`detect-secrets scan\` ejecutado → 0 secrets nuevos  
\- \[ \] Pre-commit hook configurado y funcionando  
\- \[ \] \`.secrets.baseline\` actualizado

\#\#\# Archivos Críticos  
\- \[ \] .env NO está en el repo  
\- \[ \] .env.example tiene solo PLACEHOLDERS  
\- \[ \] .gitignore incluye \`.env\*\`  
\- \[ \] Connection strings usan variables de entorno

\#\#\# Código de Integración  
\- \[ \] Supabase client usa \`process.env.SUPABASE\_\*\`  
\- \[ \] Claude API client usa \`os.getenv('ANTHROPIC\_API\_KEY')\`  
\- \[ \] Kommo integration usa \`os.getenv('KOMMO\_TOKEN')\`  
\- \[ \] WhatsApp API usa \`os.getenv('WHATSAPP\_TOKEN')\`

\#\#\# Logs y Debug  
\- \[ \] Logs NO incluyen API keys completas  
\- \[ \] Logs solo muestran últimos 4 caracteres de tokens  
\- \[ \] Debug mode NO imprime secrets

\---

\#\# 📊 Métricas de Éxito

Un proyecto PASA si:  
\- ✅ \`detect-secrets scan\` retorna 0 secrets nuevos  
\- ✅ 100% de API keys vienen de variables de entorno  
\- ✅ 0 archivos .env\* commiteados  
\- ✅ Pre-commit hook bloquea commits con secrets  
\- ✅ CI/CD falla si detecta secrets

\---

\#\# 🔧 Script de Auditoría Automática

\*\*Crear \`scripts/audit-secrets.sh\`:\*\*  
\`\`\`bash  
\#\!/bin/bash  
\# Auditoría completa de secrets

echo "🔍 AUDITORÍA DE SECRETS \- PYMEPILOT"  
echo "===================================="  
echo ""

\# 1\. Verificar que .env NO está en repo  
echo "1️⃣ Verificando archivos .env..."  
if git ls-files | grep \-q "\\.env$"; then  
    echo "❌ CRÍTICO: .env está en el repositorio"  
    echo "   Ejecutá: git rm \--cached .env"  
    exit 1  
else  
    echo "✅ .env no está commiteado"  
fi

\# 2\. Escanear secrets en código  
echo ""  
echo "2️⃣ Escaneando secrets con detect-secrets..."  
detect-secrets scan \--baseline .secrets.baseline \--exclude-files '\\.env.\*'

if \[ $? \-ne 0 \]; then  
    echo "❌ Se detectaron secrets nuevos"  
    echo "   Revisá el output arriba y corregí"  
    exit 1  
else  
    echo "✅ No se detectaron secrets"  
fi

\# 3\. Verificar patterns específicos de PymePilot  
echo ""  
echo "3️⃣ Verificando patterns específicos..."

\# Buscar "sk-ant-api03" (Anthropic keys)  
if grep \-r "sk-ant-api03" \--include="\*.py" \--include="\*.ts" \--include="\*.tsx" \--exclude-dir=node\_modules \--exclude-dir=venv .; then  
    echo "❌ CRÍTICO: Anthropic API key hardcodeada"  
    exit 1  
fi

\# Buscar "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" (JWT tokens)  
if grep \-r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" \--include="\*.py" \--include="\*.ts" \--include="\*.tsx" \--exclude-dir=node\_modules \--exclude-dir=venv .; then  
    echo "❌ CRÍTICO: JWT token hardcodeado"  
    exit 1  
fi

\# Buscar "postgresql://" con passwords  
if grep \-r "postgresql://\[^:\]\*:\[^@\]\*@" \--include="\*.py" \--exclude-dir=venv .; then  
    echo "❌ CRÍTICO: PostgreSQL connection string con password"  
    exit 1  
fi

echo "✅ No se encontraron patterns críticos"

\# 4\. Verificar .gitignore  
echo ""  
echo "4️⃣ Verificando .gitignore..."  
required\_ignores=(".env" ".env.local" ".env.production" "\*.pem" "\*.key")

for pattern in "${required\_ignores\[@\]}"; do  
    if \! grep \-q "^$pattern$" .gitignore; then  
        echo "⚠️ WARNING: '$pattern' no está en .gitignore"  
    fi  
done

echo ""  
echo "🎉 AUDITORÍA COMPLETA"  
echo "✅ El proyecto está limpio de secrets"  
\`\`\`

\*\*Hacer ejecutable:\*\*  
\`\`\`bash  
chmod \+x scripts/audit-secrets.sh  
\`\`\`

\*\*Ejecutar:\*\*  
\`\`\`bash  
./scripts/audit-secrets.sh  
\`\`\`

\---

\#\# 💡 Para Pato (Integración con Workflow)

\#\#\# Setup Inicial (una sola vez)  
\`\`\`bash  
\# 1\. Instalar detect-secrets  
pip install detect-secrets \--break-system-packages

\# 2\. Crear baseline  
cd /home/pato/pymepilot-core  
detect-secrets scan \> .secrets.baseline

\# 3\. Configurar pre-commit hook  
cp scripts/pre-commit-example .git/hooks/pre-commit  
chmod \+x .git/hooks/pre-commit

\# 4\. Crear script de auditoría  
mkdir \-p scripts  
nano scripts/audit-secrets.sh  
\# Pegar contenido de arriba  
chmod \+x scripts/audit-secrets.sh  
\`\`\`

\#\#\# Uso Diario

\*\*Antes de commit:\*\*  
\`\`\`bash  
\# Automático si configuraste pre-commit hook  
git add .  
git commit \-m "feat: nueva funcionalidad"

\# Si detecta secrets → commit bloqueado  
\# Si está limpio → commit OK  
\`\`\`

\*\*Auditoría manual:\*\*  
\`\`\`bash  
./scripts/audit-secrets.sh  
\`\`\`

\*\*Con Claude Code:\*\*  
\`\`\`  
@security-guardian usando /skills/security/secret-detection.md  
escaneá el proyecto completo en busca de secrets  
\`\`\`

\#\#\# Qué hacer si encontrás un secret commiteado

\*\*Paso 1: ROTAR el secret inmediatamente\*\*  
\`\`\`bash  
\# Si es Claude API key → Generar nueva en console.anthropic.com  
\# Si es Supabase key → Regenerar en Supabase dashboard  
\# Si es password de DB → Cambiar password  
\`\`\`

\*\*Paso 2: Limpiar historial de Git (si NO pusheaste)\*\*  
\`\`\`bash  
git filter-branch \--force \--index-filter \\  
  "git rm \--cached \--ignore-unmatch archivo-con-secret.py" \\  
  \--prune-empty \-- \--all  
\`\`\`

\*\*Paso 3: Si YA pusheaste a GitHub → Peor caso\*\*  
\`\`\`bash  
\# 1\. Rotar secret INMEDIATAMENTE  
\# 2\. Considerar el secret comprometido (asumir que alguien lo tiene)  
\# 3\. GitHub tiene feature de "secret scanning" que puede detectarlo  
\# 4\. En casos extremos, rehacer repo desde cero  
\`\`\`

\---  
