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

## Flujo seguro validado en produccion

Quedo validado este flujo para cambios visuales sobre `report.json`:

1. Crear backup del archivo puntual.
2. Hacer un solo cambio.
3. Validar:
   - JSON global,
   - parse de cada `visualContainers[].config`.
4. Abrir en Power BI Desktop.
5. Si el usuario mueve visuales manualmente y el resultado es correcto:
   - mapear coordenadas finales,
   - usar ese layout como patrón documentado.

## Regla para nuevos lienzos

No crear en un mismo paso:

- nuevo lienzo,
- filtros complejos,
- DAX nuevo,
- tablas/columnas calculadas.

Secuencia correcta:

1. estructura del lienzo,
2. apertura correcta,
3. filtro Top N,
4. refinamiento visual.

## Diagnostico obligatorio de errores de lienzo

Si Desktop muestra:

- `deserializeCanvasItems`
- `Cannot read properties of undefined (reading 'name')`

hacer inmediatamente:

1. parse de todos los `visualContainers`,
2. ubicar el índice roto,
3. corregir solo ese `config`,
4. revalidar todos los visuales.

## Patrón validado: lienzo tipo grafico + tabla

Canvas:

- `1600x1000`

Distribucion:

- sidebar: `0,0,280,1000`
- contenido desde `x=300`
- bloque grafico: `620.59` ancho
- bloque tabla: `629.41` ancho
- separación entre bloques: `29.41`

Aplicar cuando el objetivo sea responder una pregunta comercial con:

- 1 grafico principal,
- 1 tabla operativa alta,
- branding lateral.


## Playbook operativo validado: `tableEx`

Referencia principal:

- `PBIP_TABLEEX_PLAYBOOK.md`

Regla operativa para trabajo real:

1. backup del archivo afectado,
2. medida creada o actualizada,
3. verificacion en sesion viva,
4. verificacion en TMDL,
5. prueba DAX pequena,
6. agregar una sola columna a `tableEx`,
7. validar `report.json`,
8. reabrir Desktop,
9. documentar.

No saltarse la verificacion en TMDL. Esa fue la causa real de varias fallas de reapertura.
