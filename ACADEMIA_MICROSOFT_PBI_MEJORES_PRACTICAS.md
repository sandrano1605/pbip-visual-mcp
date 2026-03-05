# Academia Microsoft Power BI - Mejores Practicas para MCP

Fecha: 2026-03-05

## Fuentes oficiales

- Documentacion general Power BI:
  - https://learn.microsoft.com/es-es/power-bi/
- Sugerencias de diseno de paneles:
  - https://learn.microsoft.com/es-es/power-bi/create-reports/service-dashboards-design-tips
- Diseno de informes para mostrar detalles (Microsoft Learn Training):
  - https://learn.microsoft.com/es-es/training/modules/power-bi-effective-user-experience/1a-design-reports-show-details

## Principios que se adoptan en este MCP

1. Diseno para audiencia:
   - definir metricas clave y decisiones por pagina.
   - reducir ruido visual y evitar sobrecarga.
2. Storytelling en una pantalla:
   - priorizar contenido sin scroll.
   - asegurar que todo el lienzo principal quepa.
3. Jerarquia visual:
   - informacion clave en zona superior izquierda.
   - detalle en franja inferior o drillthrough.
4. Seleccion correcta de visual:
   - preferir barras/columnas para comparacion.
   - evitar 3D y evitar pie/donut cuando hay muchas categorias.
5. Coherencia visual:
   - escalas comparables.
   - colores consistentes por categoria.
   - formato numerico legible (miles/millones, CLP cuando aplique).
6. Analisis guiado por niveles:
   - metricas globales -> visuales de apoyo -> detalle bajo demanda.
   - usar drilldown, tooltips y drillthrough para no saturar la pagina base.

## Traduccion a reglas operativas MCP

1. Antes de crear/modificar un lienzo:
   - definir preguntas de negocio (1 por visual principal).
   - definir tabla de detalle alineada a esas preguntas.
2. Durante creacion con `pbip_create_professional_canvas`:
   - usar `canvasPreset`:
     - `operativo` (1600x1000) para analisis diario.
     - `ejecutivo` (1400x900) para lectura de resumen.
   - mantener `applyTemplateStyle=true` para consistencia.
3. Validacion minima posterior:
   - revisar que no existan objetos fuera de pagina.
   - revisar que el titulo de cada visual responda una pregunta.
   - revisar que medidas monetarias esten en CLP si aplica negocio Chile.
4. Escalamiento de detalle:
   - pagina base: resumen y comparacion.
   - detalle adicional: tooltips / drillthrough / pagina secundaria.

## Checklist rapido (DoD visual)

- [ ] Cada visual responde una pregunta de negocio concreta.
- [ ] Layout cabe en una pantalla (sin recortes).
- [ ] No hay visuales decorativos que oculten informacion.
- [ ] Titulo y contexto claros por visual.
- [ ] Tabla de detalle soporta investigacion.
- [ ] Formato de moneda y fechas estandarizado.
- [ ] Se registra incidente/fix si hubo error de render.
