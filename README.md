# pbip-visual-mcp

Servidor MCP para trabajar con proyectos Power BI (`.pbip`) a nivel de `report.json` y `SemanticModel` (TMDL).

## Capacidades principales

- Listar páginas y visuales del reporte.
- Listar tablas, columnas, medidas y relaciones del modelo semántico.
- Agregar y mover visuales básicos.
- Crear automáticamente un lienzo base profesional:
  - herramienta: `pbip_create_professional_canvas`
  - layout: 2 gráficos + 1 tabla detalle.
  - opcional estilo plantilla corporativa (tema, logo, sidebar y cabecera).

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
npm run build
```

## Ejecución

```bash
npm start
```

## Uso en cliente MCP (stdio)

Comando del servidor:

```bash
node /ruta/al/proyecto/dist/index.js
```

Ejemplo de llamada recomendada para crear lienzo:

```json
{
  "pbipPath": "C:\\ruta\\proyecto.pbip",
  "sectionDisplayName": "01_Base_Profesional",
  "replaceExistingVisuals": true,
  "applyTemplateStyle": true,
  "canvasPreset": "operativo",
  "templatePbipPath": "C:\\ruta\\canvas-plantilla\\plantilla_canvas.pbip"
}
```

Tool:

- `pbip_create_professional_canvas`

Parámetros nuevos de `pbip_create_professional_canvas`:

- `applyTemplateStyle` (boolean, opcional, default `true`): aplica estilo visual tipo plantilla.
- `templatePbipPath` (string, opcional): ruta al `.pbip` plantilla.  
  Si no se envía, se intenta resolver automáticamente: `<carpeta-del-pbip>/canvas-plantilla/plantilla_canvas.pbip`.
- `canvasPreset` (string, opcional): `operativo` o `ejecutivo`.
  - `operativo` (default): `1600x1000`
  - `ejecutivo`: `1400x900`

## Flujo recomendado (primera vez)

1. Respaldar `report.json` antes de mutar visuales.
2. Ejecutar `pbip_create_professional_canvas` con `replaceExistingVisuals=true`.
3. Validar con `pbip_list_sections` y `pbip_list_visuals`.
4. Abrir el `.pbip` en Power BI Desktop y confirmar render.
5. Registrar en bitácora de incidentes si aparece error (causa, fix, evidencia).

## Flujo recomendado (operacion real, paso a paso)

Cuando el reporte ya existe y se va a iterar sobre lienzos reales:

1. Guardar el proyecto desde Power BI Desktop.
2. Inspeccionar con MCP sin editar.
3. Hacer un solo cambio pequeño.
4. Crear backup del archivo afectado.
5. Validar:
   - `ConvertFrom-Json` del archivo,
   - parse de todos los `visualContainers`.
6. Abrir/revisar en Desktop.
7. Si el usuario ajusta el layout manualmente y queda bien:
   - mapear posiciones y tamaños,
   - documentar ese layout como patrón.

## Regla dura

No mezclar en el mismo paso:

- nuevo lienzo,
- lógica DAX nueva,
- tablas/columnas calculadas nuevas,
- filtros complejos Top N.

Primero se estabiliza el lienzo. Después se agregan filtros y lógica.

## Desarrollo

```bash
npm run build
```

Documentación operativa extendida:

- `CONFIGURACION_CLAUDE.md`
- `OPERACION_Y_MEJORES_PRACTICAS.md`
- `ACADEMIA_MICROSOFT_PBI_MEJORES_PRACTICAS.md`


## TableEx Playbook

Validated playbook for adding semantic-model measures to PBIP `tableEx` visuals:

- `PBIP_TABLEEX_PLAYBOOK.md`

This captures the safe production workflow:

1. Create or update the measure.
2. Verify it in the live Desktop session.
3. Verify it in TMDL on disk.
4. Run a small DAX test.
5. Add one field to the `tableEx` visual.
6. Validate `report.json`.
7. Reopen Desktop.
8. Document the result.
