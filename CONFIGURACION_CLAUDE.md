# Configuración MCP PBIP Visual

## Claude Desktop

Agrega este bloque a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pbip-visual-mcp": {
      "command": "node",
      "args": [
        "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\pbip-visual-mcp\\dist\\index.js"
      ],
      "type": "stdio"
    }
  }
}
```

## Ejemplos

```
1) Listar secciones
   -> pbip_list_sections { "pbipPath": "...\\productividad_por_complejidad.pbip" }

2) Listar visuales
   -> pbip_list_visuals { "pbipPath": "...\\productividad_por_complejidad.pbip" }

3) Agregar gráfico de barras simple
   -> pbip_add_bar_chart { "pbipPath": "...\\productividad_por_complejidad.pbip" }

4) Mover un visual
   -> pbip_set_visual_position { "pbipPath": "...\\productividad_por_complejidad.pbip", "visualName": "<nombre>", "x": 50, "y": 50, "width": 600, "height": 300 }

5) Crear lienzo profesional base (recomendado)
   -> pbip_create_professional_canvas { "pbipPath": "...\\productividad_por_complejidad.pbip", "sectionDisplayName": "01_Base_Profesional", "replaceExistingVisuals": true }

6) Crear lienzo profesional con plantilla corporativa (recomendado en productivo)
   -> pbip_create_professional_canvas { "pbipPath": "...\\analisis_disponibilidad.pbip", "sectionDisplayName": "01_Base_Disponibilidad", "replaceExistingVisuals": true, "applyTemplateStyle": true, "canvasPreset": "operativo", "templatePbipPath": "...\\canvas-plantilla\\plantilla_canvas.pbip" }
```
## Nuevas herramientas (TMDL)

- `pbip_list_tables`: lista tablas del modelo semántico (TMDL)
- `pbip_list_measures`: lista medidas (TMDL). Puedes filtrar por tabla con `tableName`
- `pbip_list_columns`: lista columnas (TMDL). Puedes filtrar por tabla con `tableName`
- `pbip_list_relationships`: lista relaciones del modelo (relationships.tmdl)
- `pbip_get_table_details`: columnas y medidas con metadatos para una tabla
- `pbip_get_model_overview`: resumen de conteos de tablas/columnas/medidas/relaciones
- `pbip_create_professional_canvas`: crea automaticamente un lienzo base profesional (2 graficos + 1 tabla) con seleccion inteligente de tabla/campos
  - Incluye opciones de plantilla:
    - `applyTemplateStyle` (default `true`): aplica tema/logo/sidebar/header desde plantilla.
    - `templatePbipPath` (opcional): si no se envia, intenta `canvas-plantilla/plantilla_canvas.pbip` relativo al PBIP objetivo.
    - `canvasPreset`:
      - `operativo` (default): 1600x1000
      - `ejecutivo`: 1400x900

## Nuevas herramientas (PBIX abierto)

- `pbi_list_local_instances`: busca instancias locales (puerto) de Power BI Desktop
- `pbi_execute_query`: ejecuta DAX o DMV contra Analysis Services local

### Ejemplos

```json
{ "pbipPath": "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\productividad_por_complejidad.pbip" }
```

```json
{
  "pbipPath": "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\productividad_por_complejidad.pbip",
  "sectionDisplayName": "01_Base_Profesional",
  "replaceExistingVisuals": true
}
```

## Estandar de Lienzo Profesional

La herramienta `pbip_create_professional_canvas` aplica este estandar por defecto:

1. Seleccion automatica de tabla principal (prioriza nombres tipo `fact`, `master`, `trans`, `venta`, `mov`).
2. Seleccion inteligente de columnas:
   - Categorias: prioriza `ESTADO_MOVIMIENTO`, `Centro`, `Categoria`, `Mercado`.
   - Valores: prioriza `STK`, `ATP_CDQ`, `Stock`, `Cantidad`, `Valor`.
3. Layout fijo 1280x720:
   - Grafico 1 (arriba izquierda)
   - Grafico 2 (arriba derecha)
   - Tabla detalle (franja inferior)
4. Si `replaceExistingVisuals=true`, limpia los visuales existentes antes de crear la base.
5. Si `applyTemplateStyle=true`, aplica:
   - pagina segun `canvasPreset` (operativo 1600x1000 / ejecutivo 1400x900),
   - panel lateral corporativo,
   - logo en `RegisteredResources`,
   - tema base copiado desde plantilla.

Parametros recomendados:

- `pbipPath`: obligatorio.
- `sectionDisplayName`: recomendado para estandarizar nombres de pagina.
- `replaceExistingVisuals`: recomendado `true` para reconstruccion limpia.
- `preferTable`: usar solo cuando quieras forzar una tabla especifica.
- `applyTemplateStyle`: mantener `true` salvo pruebas técnicas.
- `templatePbipPath`: enviar ruta explicita cuando la plantilla no esté en la ruta por defecto.
- `canvasPreset`: usar `operativo` como estándar para lienzos de trabajo diario.

## Academia recomendada (fuentes oficiales)

- Documentacion general:
  - https://learn.microsoft.com/es-es/power-bi/
- Diseno de paneles:
  - https://learn.microsoft.com/es-es/power-bi/create-reports/service-dashboards-design-tips
- UX efectiva para mostrar detalle:
  - https://learn.microsoft.com/es-es/training/modules/power-bi-effective-user-experience/1a-design-reports-show-details

Resumen aplicado al MCP:
- 1 pregunta de negocio por visual principal.
- jerarquia visual (arriba resumen, abajo detalle).
- coherencia de formato (CLP/fechas) y no saturar el lienzo base.

```json
{ "pbipPath": "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\productividad_por_complejidad.pbip", "tableName": "FACT_TAREAS_USUARIO_STG" }
```

```json
{ "pbipPath": "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\productividad_por_complejidad.pbip" }
```

```json
{ "pbipPath": "C:\\Users\\alonso.moya\\OneDrive - ARTEL S.A\\Escritorio\\Analisis con python\\monitor_personal\\productividad_por_complejidad.pbip", "tableName": "DIM_USUARIO" }
```

```json
{ "rootPath": "C:\\Users\\alonso.moya\\AppData\\Local\\Microsoft\\Power BI Desktop\\AnalysisServicesWorkspaces" }
```

```json
{ "port": 58254, "query": "EVALUATE ROW(\"Dias Unicos\", DISTINCTCOUNT('fact_DiaUsuarioCanal_14d'[DIA]))" }
```
