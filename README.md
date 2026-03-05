# pbip-visual-mcp

Servidor MCP para trabajar con proyectos Power BI (`.pbip`) a nivel de `report.json` y `SemanticModel` (TMDL).

## Capacidades principales

- Listar páginas y visuales del reporte.
- Listar tablas, columnas, medidas y relaciones del modelo semántico.
- Agregar y mover visuales básicos.
- Crear automáticamente un lienzo base profesional:
  - herramienta: `pbip_create_professional_canvas`
  - layout: 2 gráficos + 1 tabla detalle.

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
  "replaceExistingVisuals": true
}
```

Tool:

- `pbip_create_professional_canvas`

## Desarrollo

```bash
npm run build
```

Documentación operativa extendida:

- `CONFIGURACION_CLAUDE.md`
