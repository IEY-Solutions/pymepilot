# Stitch MCP en Codex

## Objetivo

Conectar Stitch a Codex como servidor MCP remoto estandar para apoyar tareas de UX/UI sin acoplar la integracion a un tenant especifico.

## Decision tecnica

Se usa autenticacion por API key mediante header HTTP.

Motivo:

- Codex soporta servidores MCP remotos con `url`, `http_headers` y `env_http_headers`.
- El repositorio oficial de `gemini-cli-extensions/stitch` publica `https://stitch.googleapis.com/mcp` y usa `X-Goog-Api-Key` para el modo simple de autenticacion.
- El flujo ADC descrito para Gemini CLI depende de pasos y supuestos de Google Cloud que no quedaron verificados como el camino portable para Codex en este entorno.

## Configuracion aplicada

Archivo de proyecto: `.codex/config.toml`

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
env_http_headers = { "X-Goog-Api-Key" = "STITCH_API_KEY" }
tool_timeout_sec = 300
startup_timeout_sec = 20
```

## Credenciales requeridas

Definir la variable de entorno `STITCH_API_KEY` en la maquina donde corre Codex.

La API key se obtiene desde Stitch:

1. Abrir Stitch.
2. Ir al menu de perfil.
3. Abrir `Stitch Settings`.
4. Entrar a `API Keys`.
5. Crear una key y copiarla.

No guardar la key dentro del repo ni en archivos versionados.

## Verificacion minima recomendada

1. Reiniciar Codex o abrir una nueva sesion para que relea `.codex/config.toml`.
2. Confirmar que el servidor aparezca en el listado MCP del cliente.
3. Probar un flujo corto de UX/UI, por ejemplo:
   - listar proyectos disponibles
   - inspeccionar un proyecto puntual
   - recuperar pantallas de un proyecto
   - descargar el HTML o imagen de una pantalla
4. Si la conexion responde, validar que la salida sea util para trabajo de diseño y no solo conectividad.

## Prompts de uso sugeridos

- "Usa Stitch para listar mis proyectos de diseño."
- "Usa Stitch para mostrar las pantallas del proyecto <id>."
- "Usa Stitch para descargar el HTML de la pantalla <id>."
- "Usa Stitch para generar una propuesta de pantalla onboarding para un SaaS B2B."

## Limites de verificacion de esta implementacion

- No se verifico end-to-end contra una API key real desde este entorno.
- No se confirmo aqui si Stitch expone un flujo OAuth estandar consumible por Codex.
- No se adopto ADC como camino principal porque la documentacion revisada lo describe para Gemini CLI, no como configuracion confirmada de Codex.
- La disponibilidad final depende de contar con una `STITCH_API_KEY` valida y permisos efectivos en Stitch.

## Fuentes verificadas

- Repositorio oficial `gemini-cli-extensions/stitch`
- README oficial del extension de Stitch para Gemini CLI
- Documentacion oficial de Codex sobre configuracion MCP remota

