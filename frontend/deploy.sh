#!/bin/bash
# Deploy script para PymePilot frontend.
# Ejecutar desde: /home/pato/projects/pymepilot/frontend/
# Uso: bash deploy.sh

set -e

echo "=== PymePilot Frontend Deploy ==="

# 1. Cargar variables de .env.local para pasarlas como build args
source .env.local

# 2. Build sin cache con las variables embebidas
echo ">> Construyendo imagen Docker (sin cache)..."
docker build --no-cache \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t pymepilot-frontend:latest .

# 3. Reemplazar container
echo ">> Reemplazando container..."
docker stop pymepilot-dashboard 2>/dev/null || true
docker rm pymepilot-dashboard 2>/dev/null || true

docker run -d \
  --name pymepilot-dashboard \
  --network orion-stack_traefik-public \
  --env-file .env.local \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.pymepilot.entrypoints=websecure" \
  --label "traefik.http.routers.pymepilot.rule=Host(\`app.pymepilot.cloud\`)" \
  --label "traefik.http.routers.pymepilot.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.pymepilot.loadbalancer.server.port=3000" \
  pymepilot-frontend:latest

# 4. Verificar
sleep 3
echo ">> Estado del container:"
docker ps --filter name=pymepilot-dashboard --format "{{.Names}} {{.Status}} {{.Image}}"
echo ""
echo ">> Ultimos logs:"
docker logs pymepilot-dashboard --tail 5
echo ""
echo "=== Deploy completo. Proba en https://app.pymepilot.cloud ==="
