# Operacion y Mejores Practicas MCP PBIP Visual

Fecha: 2026-03-05

## Objetivo

Evitar errores de render en Power BI Desktop cuando se automatiza `report.json` desde MCP.

## Regla operativa obligatoria

Antes de cada cambio de lienzo:

1. Respaldar `report.json`.
2. Aplicar cambios por herramientas MCP (no editar JSON manualmente salvo contingencia).
3. Validar integridad JSON local.
4. Abrir PBIP en Power BI Desktop.
5. Registrar incidente/fix si falla.

Regla adicional obligatoria:

- Validar tamaño de lienzo antes de cerrar el cambio.  
  El servidor ahora ejecuta auto-ajuste de `section.width/section.height` para que todos los visuales queden dentro del canvas.
- Estándar de preset:
  - `operativo` = `1600x1000` (default)
  - `ejecutivo` = `1400x900`

## Checklist primera vez (end-to-end)

1. Compilar MCP:
   - `npm run build`
2. Verificar que la tool existe:
   - `pbip_create_professional_canvas`
3. Ejecutar creación:
   - con `replaceExistingVisuals=true`
   - con `applyTemplateStyle=true`
4. Confirmar estructura:
   - `pbip_list_sections`
   - `pbip_list_visuals`
5. Abrir reporte en Desktop y validar:
   - carga sin error,
   - tema y logo aplicados,
   - visuales con layout esperado.
6. Validar checklist de academia Microsoft:
   - `ACADEMIA_MICROSOFT_PBI_MEJORES_PRACTICAS.md`

## Causas comunes de falla y prevencion

- JSON `config` de visual mal formado:
  - Prevencion: serializar siempre con `JSON.stringify` en el servidor.
- Recursos no copiados (tema/logo):
  - Prevencion: validar existencia de archivos en `StaticResources`.
- Mutaciones sin validacion:
  - Prevencion: ejecutar verificacion estructural posterior a cambios.

## Estandar de documentacion por cambio

Cada cambio de MCP debe actualizar:

1. `README.md` (capacidad y ejemplo de uso).
2. `CONFIGURACION_CLAUDE.md` (ejemplos operativos reales).
3. `MCP_INCIDENTES_Y_FIXES.md` (si hubo falla y correccion).
4. `ACADEMIA_MICROSOFT_PBI_MEJORES_PRACTICAS.md` cuando se cambie estandar visual.
