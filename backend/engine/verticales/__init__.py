"""
Registry central de verticales de PymePilot.

QUE HACE ESTE ARCHIVO:
Define en UN solo lugar el mapeo nombre → clase de cada vertical.
Tanto el orquestador (main.py) como el CLI (run_vertical.py) importan
este registry. Asi, cuando se agregue una nueva vertical, solo hay
que actualizar este archivo.

CONCEPTO CLAVE - Single Source of Truth:
Es como tener UNA sola lista de precios en vez de dos cuadernos.
Si actualizas un solo lugar, todo el sistema queda sincronizado.
"""

# Mapeo: nombre de la vertical → ruta completa a la clase.
# Para agregar una nueva vertical:
#   1. Crear la clase en backend/engine/verticales/
#   2. Registrarla aca
#   3. Agregarla al active_verticals del tenant en la DB
VERTICAL_REGISTRY: dict[str, str] = {
    'reposicion': 'backend.engine.verticales.reposicion.VerticalReposicion',
    'activacion': 'backend.engine.verticales.activacion.VerticalActivacion',
    'recuperacion': 'backend.engine.verticales.recuperacion.VerticalRecuperacion',
}
