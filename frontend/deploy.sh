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
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="$NEXT_PUBLIC_VAPID_PUBLIC_KEY" \
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

# 4. Verificar container
sleep 3
echo ">> Estado del container:"
docker ps --filter name=pymepilot-dashboard --format "{{.Names}} {{.Status}} {{.Image}}"
echo ""

# 5. Health check HTTP (espera hasta 30s)
echo ">> Health check..."
RETRIES=6
for i in $(seq 1 $RETRIES); do
  HTTP_CODE=$(docker exec pymepilot-dashboard wget -q -O /dev/null -S http://localhost:3000 2>&1 | grep "HTTP/" | tail -1 | awk '{print $2}' || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
    echo ">> Health check OK (HTTP $HTTP_CODE)"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo ">> ADVERTENCIA: Health check fallo despues de 30s (HTTP $HTTP_CODE)"
    echo ">> Ultimos logs:"
    docker logs pymepilot-dashboard --tail 10
    echo ""
    echo "=== Deploy con advertencia. Verifica manualmente https://app.pymepilot.cloud ==="
    exit 1
  fi
  sleep 5
done

echo ""
echo "=== Deploy completo. Proba en https://app.pymepilot.cloud ==="
