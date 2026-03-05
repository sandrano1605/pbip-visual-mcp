#!/usr/bin/env node

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const PbipPathSchema = z.object({
  pbipPath: z.string().min(1, 'pbipPath es requerido')
});

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const ListVisualsSchema = z.object({
  pbipPath: z.string().min(1),
  sectionName: z.string().optional()
});

const AddBarChartSchema = z.object({
  pbipPath: z.string().min(1),
  sectionName: z.string().optional(),
  templateVisualName: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

const SetPositionSchema = z.object({
  pbipPath: z.string().min(1),
  visualName: z.string().min(1),
  sectionName: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  z: z.number().optional()
});

const CreateProfessionalCanvasSchema = z.object({
  pbipPath: z.string().min(1),
  sectionName: z.string().optional(),
  sectionDisplayName: z.string().optional(),
  preferTable: z.string().optional(),
  replaceExistingVisuals: z.boolean().optional(),
  applyTemplateStyle: z.boolean().optional(),
  templatePbipPath: z.string().optional()
});

type ReportDocument = {
  config?: string;
  resourcePackages?: any[];
  sections: any[];
};

const ListTablesSchema = z.object({
  pbipPath: z.string().min(1)
});

const ListMeasuresSchema = z.object({
  pbipPath: z.string().min(1),
  tableName: z.string().optional()
});

const ListColumnsSchema = z.object({
  pbipPath: z.string().min(1),
  tableName: z.string().optional()
});

const ListRelationshipsSchema = z.object({
  pbipPath: z.string().min(1)
});

const GetTableDetailsSchema = z.object({
  pbipPath: z.string().min(1),
  tableName: z.string().min(1)
});

const GetModelOverviewSchema = z.object({
  pbipPath: z.string().min(1)
});

const ListLocalInstancesSchema = z.object({
  rootPath: z.string().optional()
});

const ExecuteQueryInputSchema = z.object({
  port: z.number().optional(),
  connectionString: z.string().optional(),
  query: z.string().min(1),
  maxRows: z.number().int().positive().optional()
});

const ExecuteQuerySchema = ExecuteQueryInputSchema
  .refine((val) => !!val.port || !!val.connectionString, {
    message: 'Debe indicar port o connectionString'
  });

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function loadPbip(pbipPath: string) {
  const pbipFullPath = path.resolve(pbipPath);
  if (!fs.existsSync(pbipFullPath)) {
    throw new Error(`No existe el archivo PBIP: ${pbipFullPath}`);
  }

  const pbipDir = path.dirname(pbipFullPath);
  const pbipJson = JSON.parse(stripBom(fs.readFileSync(pbipFullPath, 'utf8')));
  const reportPath = pbipJson?.artifacts?.[0]?.report?.path;
  if (!reportPath) {
    throw new Error('No se encontró artifacts[0].report.path en el .pbip');
  }

  const reportDir = path.resolve(pbipDir, reportPath);
  const reportJsonPath = path.join(reportDir, 'report.json');
  if (!fs.existsSync(reportJsonPath)) {
    throw new Error(`No existe report.json en: ${reportJsonPath}`);
  }

  const reportText = stripBom(fs.readFileSync(reportJsonPath, 'utf8'));
  const report = JSON.parse(reportText) as ReportDocument;
  return { pbipFullPath, reportDir, reportJsonPath, report };
}

function loadSemanticModel(pbipPath: string) {
  const pbipFullPath = path.resolve(pbipPath);
  if (!fs.existsSync(pbipFullPath)) {
    throw new Error(`No existe el archivo PBIP: ${pbipFullPath}`);
  }

  const pbipDir = path.dirname(pbipFullPath);
  const pbipJson = JSON.parse(stripBom(fs.readFileSync(pbipFullPath, 'utf8')));
  const semanticPath = pbipJson?.artifacts?.find((a: any) => a.semanticModel)?.semanticModel?.path;
  const pbipBase = path.basename(pbipFullPath, path.extname(pbipFullPath));
  const fallbackSemanticDir = path.resolve(pbipDir, `${pbipBase}.SemanticModel`);

  const semanticDir = semanticPath
    ? path.resolve(pbipDir, semanticPath)
    : fallbackSemanticDir;

  if (!fs.existsSync(semanticDir)) {
    throw new Error('No se encontró carpeta SemanticModel asociada al PBIP');
  }
  const definitionDir = path.join(semanticDir, 'definition');
  const tablesDir = path.join(definitionDir, 'tables');
  if (!fs.existsSync(tablesDir)) {
    throw new Error(`No existe la carpeta de tablas TMDL: ${tablesDir}`);
  }

  return { semanticDir, definitionDir, tablesDir };
}

function parseMeasuresFromTmdl(content: string) {
  const parsed = parseTableTmdl(content);
  return parsed.measures;
}

function parseColumnsFromTmdl(content: string) {
  const parsed = parseTableTmdl(content);
  return parsed.columns;
}

function saveReport(reportJsonPath: string, report: ReportDocument) {
  const jsonOut = JSON.stringify(report, null, 2);
  fs.writeFileSync(reportJsonPath, jsonOut, { encoding: 'utf8' });
}

function findSection(report: ReportDocument, sectionName?: string) {
  if (!report.sections || report.sections.length === 0) {
    throw new Error('El reporte no tiene secciones');
  }

  if (!sectionName) {
    return report.sections[0];
  }

  const match = report.sections.find(
    (s: any) => s.name === sectionName || s.displayName === sectionName
  );

  if (!match) {
    throw new Error(`No se encontró la sección: ${sectionName}`);
  }

  return match;
}

function parseVisualConfig(configStr: string) {
  return JSON.parse(configStr);
}

function getVisualNameFromConfig(configStr: string): string | null {
  try {
    const cfg = parseVisualConfig(configStr);
    return cfg?.name ?? null;
  } catch {
    return null;
  }
}

function getVisualTypeFromConfig(configStr: string): string | null {
  try {
    const cfg = parseVisualConfig(configStr);
    return cfg?.singleVisual?.visualType ?? null;
  } catch {
    return null;
  }
}

function generateVisualName(): string {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return hex.substring(0, 20);
}

function cloneVisualContainer(vc: any) {
  return JSON.parse(JSON.stringify(vc));
}

function resolveDefaults(section: any, input: { x?: number; y?: number; width?: number; height?: number }) {
  const pageWidth = typeof section.width === 'number' ? section.width : 1280;
  const pageHeight = typeof section.height === 'number' ? section.height : 720;

  const width = input.width ?? Math.min(620, Math.max(300, Math.floor(pageWidth / 2)));
  const height = input.height ?? Math.min(350, Math.max(200, Math.floor(pageHeight / 2)));
  const x = input.x ?? Math.max(0, Math.floor(pageWidth - width - 20));
  const y = input.y ?? 20;

  return { x, y, width, height };
}

type ParsedColumn = {
  name: string;
  dataType?: string;
  formatString?: string;
  summarizeBy?: string;
  sourceColumn?: string;
  isHidden?: boolean;
  dataCategory?: string;
  sortByColumn?: string;
  description?: string;
};

type ParsedMeasure = {
  name: string;
  expression: string;
  description?: string;
  formatString?: string;
  dataType?: string;
  isHidden?: boolean;
  displayFolder?: string;
};

type ParsedTable = {
  columns: ParsedColumn[];
  measures: ParsedMeasure[];
};

function parseKeyValue(line: string) {
  const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (!match) {
    return null;
  }
  const key = match[1];
  let value = match[2].trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  if (value.toLowerCase() === 'true') {
    return { key, value: true };
  }
  if (value.toLowerCase() === 'false') {
    return { key, value: false };
  }
  return { key, value };
}

function parseMeasureLine(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(/^measure\s+'([^']+)'\s*=\s*(.*)$/);
  if (match) {
    return { name: match[1], expression: match[2] };
  }
  const match2 = trimmed.match(/^measure\s+([^=]+?)\s*=\s*(.*)$/);
  if (match2) {
    return { name: match2[1].trim(), expression: match2[2] };
  }
  return null;
}

function parseColumnLine(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(/^column\s+'([^']+)'/);
  if (match) {
    return { name: match[1] };
  }
  const match2 = trimmed.match(/^column\s+([^\s]+)\s*$/);
  if (match2) {
    return { name: match2[1].trim() };
  }
  return null;
}

function parseTableTmdl(content: string): ParsedTable {
  const columns: ParsedColumn[] = [];
  const measures: ParsedMeasure[] = [];
  const lines = content.split(/\r?\n/);
  let pendingDescription: string | undefined;
  let current: { type: 'column'; obj: ParsedColumn } | { type: 'measure'; obj: ParsedMeasure } | null = null;

  const flush = () => {
    if (!current) return;
    if (current.type === 'column') {
      columns.push(current.obj);
    } else {
      measures.push(current.obj);
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('///')) {
      pendingDescription = trimmed.replace(/^\/\/\/\s?/, '');
      continue;
    }
    if (trimmed.startsWith('measure ')) {
      flush();
      const parsed = parseMeasureLine(line);
      if (parsed) {
        current = {
          type: 'measure',
          obj: { ...parsed, description: pendingDescription }
        };
      }
      pendingDescription = undefined;
      continue;
    }
    if (trimmed.startsWith('column ')) {
      flush();
      const parsed = parseColumnLine(line);
      if (parsed) {
        current = {
          type: 'column',
          obj: { ...parsed, description: pendingDescription }
        };
      }
      pendingDescription = undefined;
      continue;
    }
    if (trimmed.startsWith('table ')) {
      pendingDescription = undefined;
      continue;
    }

    if (!current) {
      continue;
    }

    const kv = parseKeyValue(line);
    if (!kv) {
      continue;
    }
    const { key, value } = kv;

    if (current.type === 'column') {
      if (key === 'dataType') current.obj.dataType = String(value);
      if (key === 'formatString') current.obj.formatString = String(value);
      if (key === 'summarizeBy') current.obj.summarizeBy = String(value);
      if (key === 'sourceColumn') current.obj.sourceColumn = String(value);
      if (key === 'isHidden') current.obj.isHidden = Boolean(value);
      if (key === 'dataCategory') current.obj.dataCategory = String(value);
      if (key === 'sortByColumn') current.obj.sortByColumn = String(value);
    } else {
      if (key === 'formatString') current.obj.formatString = String(value);
      if (key === 'dataType') current.obj.dataType = String(value);
      if (key === 'isHidden') current.obj.isHidden = Boolean(value);
      if (key === 'displayFolder') current.obj.displayFolder = String(value);
    }
  }
  flush();
  return { columns, measures };
}

function parseRelationshipsTmdl(content: string) {
  const relationships: Record<string, any>[] = [];
  const lines = content.split(/\r?\n/);
  let current: Record<string, any> | null = null;

  const flush = () => {
    if (current) relationships.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('relationship ')) {
      flush();
      const id = trimmed.replace(/^relationship\s+/, '').trim();
      current = { id };
      continue;
    }
    if (!current) continue;
    const kv = parseKeyValue(line);
    if (!kv) continue;
    current[kv.key] = kv.value;
  }
  flush();
  return relationships;
}

function getWorkspaceRoot(customRoot?: string) {
  if (customRoot) {
    return path.resolve(customRoot);
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }
  return path.join(localAppData, 'Microsoft', 'Power BI Desktop', 'AnalysisServicesWorkspaces');
}

function getPythonQueryScriptPath() {
  return path.resolve(CURRENT_DIR, '..', 'scripts', 'pbi_query.py');
}

function runPythonQuery(conn: string, query: string, maxRows?: number) {
  const scriptPath = getPythonQueryScriptPath();
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`No existe el script Python: ${scriptPath}`);
  }
  const args = [scriptPath, '--conn', conn, '--query', query];
  if (typeof maxRows === 'number') {
    args.push('--max-rows', String(maxRows));
  }
  const proc = spawnSync('python', args, { encoding: 'utf8' });
  if (proc.error) {
    throw proc.error;
  }
  if (proc.status !== 0) {
    const stderr = proc.stderr?.trim() || 'Error desconocido ejecutando Python';
    throw new Error(stderr);
  }
  const stdout = proc.stdout?.trim();
  if (!stdout) {
    return { columns: [], rows: [] };
  }
  return JSON.parse(stdout);
}

function getMaxZ(section: any) {
  if (!section.visualContainers || section.visualContainers.length === 0) {
    return 0;
  }
  const zs = section.visualContainers.map((v: any) => (typeof v.z === 'number' ? v.z : 0));
  return Math.max(...zs);
}

function isNumericDataType(dt?: string) {
  if (!dt) return false;
  const x = dt.toLowerCase();
  return x.includes('int') || x.includes('double') || x.includes('decimal') || x.includes('number') || x.includes('currency');
}

function isDateDataType(dt?: string) {
  if (!dt) return false;
  const x = dt.toLowerCase();
  return x.includes('date') || x.includes('time');
}

function scoreTableForCanvas(tableName: string, columns: ParsedColumn[]) {
  const lower = tableName.toLowerCase();
  let score = 0;
  if (lower.includes('fact') || lower.includes('master') || lower.includes('trans') || lower.includes('venta') || lower.includes('mov')) {
    score += 50;
  }
  score += columns.length;
  score += columns.filter((c) => isNumericDataType(c.dataType)).length * 3;
  score += columns.filter((c) => (c.dataType || '').toLowerCase() === 'string').length * 2;
  return score;
}

function findColumnCaseInsensitive(columns: ParsedColumn[], preferredNames: string[]) {
  const byLower = new Map(columns.map((c) => [c.name.toLowerCase(), c]));
  for (const p of preferredNames) {
    const found = byLower.get(p.toLowerCase());
    if (found) return found;
  }
  return null;
}

function buildColumnSelect(sourceAlias: string, tableName: string, columnName: string) {
  return {
    Column: {
      Expression: { SourceRef: { Source: sourceAlias } },
      Property: columnName
    },
    Name: `${tableName}.${columnName}`,
    NativeReferenceName: columnName
  };
}

function buildSumSelect(sourceAlias: string, tableName: string, columnName: string) {
  return {
    Aggregation: {
      Expression: {
        Column: {
          Expression: { SourceRef: { Source: sourceAlias } },
          Property: columnName
        }
      },
      Function: 0
    },
    Name: `Sum(${tableName}.${columnName})`,
    NativeReferenceName: `Suma de ${columnName}`
  };
}

function buildVisualContainer(args: {
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  singleVisual: any;
}) {
  const cfg = {
    name: args.name,
    layouts: [
      {
        id: 0,
        position: {
          x: args.x,
          y: args.y,
          z: args.z,
          width: args.width,
          height: args.height,
          tabOrder: args.z
        }
      }
    ],
    singleVisual: args.singleVisual
  };

  return {
    config: JSON.stringify(cfg),
    filters: '[]',
    height: args.height,
    width: args.width,
    x: args.x,
    y: args.y,
    z: args.z
  };
}

function parseReportConfigConfig(report: any) {
  const raw = report?.config;
  if (!raw || typeof raw !== 'string') {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setReportConfig(report: any, cfg: any) {
  report.config = JSON.stringify(cfg);
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfExists(src: string, dest: string) {
  if (!fs.existsSync(src)) {
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function buildTemplateDecorativeVisuals(logoFileName: string) {
  const sidebarCfg = {
    name: 'v_sidebar_template',
    layouts: [
      {
        id: 0,
        position: { x: 0, y: 0, z: 100, width: 256, height: 900, tabOrder: 10 }
      }
    ],
    singleVisual: {
      visualType: 'shape',
      drillFilterOtherVisuals: true,
      objects: {
        shape: [{ properties: { tileShape: { expr: { Literal: { Value: "'rectangle'" } } }, roundEdge: { expr: { Literal: { Value: '16L' } } } } }],
        rotation: [{ properties: { shapeAngle: { expr: { Literal: { Value: '0L' } } } } }],
        fill: [
          {
            properties: {
              fillColor: { solid: { color: { expr: { Literal: { Value: "'#FFB310'" } } } } },
              transparency: { expr: { Literal: { Value: '22D' } } }
            },
            selector: { id: 'default' }
          }
        ],
        shadow: [
          { properties: { show: { expr: { Literal: { Value: 'true' } } } } },
          { properties: { transparency: { expr: { Literal: { Value: '14D' } } } }, selector: { id: 'default' } }
        ]
      }
    },
    howCreated: 'InsertVisualButton'
  };

  const logoCfg = {
    name: 'v_logo_template',
    layouts: [
      {
        id: 0,
        position: { x: 16, y: 24, z: 300, width: 224, height: 96, tabOrder: 20 }
      }
    ],
    singleVisual: {
      visualType: 'image',
      drillFilterOtherVisuals: true,
      objects: {
        general: [
          {
            properties: {
              imageUrl: {
                expr: {
                  ResourcePackageItem: {
                    PackageName: 'RegisteredResources',
                    PackageType: 1,
                    ItemName: logoFileName
                  }
                }
              }
            }
          }
        ]
      }
    },
    howCreated: 'InsertVisualButton'
  };

  const titleCfg = {
    name: 'v_title_template',
    layouts: [
      {
        id: 0,
        position: { x: 24, y: 140, z: 301, width: 220, height: 60, tabOrder: 30 }
      }
    ],
    singleVisual: {
      visualType: 'textbox',
      drillFilterOtherVisuals: true,
      objects: {
        general: [
          {
            properties: {
              paragraphs: [
                {
                  textRuns: [
                    {
                      value: 'DISPONIBILIDAD NL',
                      textStyle: { fontWeight: 'bold', fontSize: '16pt', color: '#094780' }
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    }
  };

  return [sidebarCfg, logoCfg, titleCfg];
}

class PbipVisualMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'pbip-visual-mcp', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'pbip_list_sections':
            return await this.handleListSections(args);
          case 'pbip_list_visuals':
            return await this.handleListVisuals(args);
          case 'pbip_list_tables':
            return await this.handleListTables(args);
          case 'pbip_list_measures':
            return await this.handleListMeasures(args);
          case 'pbip_list_columns':
            return await this.handleListColumns(args);
          case 'pbip_list_relationships':
            return await this.handleListRelationships(args);
          case 'pbip_get_table_details':
            return await this.handleGetTableDetails(args);
          case 'pbip_get_model_overview':
            return await this.handleGetModelOverview(args);
          case 'pbi_list_local_instances':
            return await this.handleListLocalInstances(args);
          case 'pbi_execute_query':
            return await this.handleExecuteQuery(args);
          case 'pbip_add_bar_chart':
            return await this.handleAddBarChart(args);
          case 'pbip_set_visual_position':
            return await this.handleSetVisualPosition(args);
          case 'pbip_create_professional_canvas':
            return await this.handleCreateProfessionalCanvas(args);
          default:
            throw new Error(`Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${msg}` }],
          isError: true
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'pbip_list_sections',
        description: 'Lista las secciones/páginas del reporte PBIP',
        inputSchema: {
          type: 'object',
          properties: PbipPathSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_list_visuals',
        description: 'Lista los visuales de una sección del PBIP',
        inputSchema: {
          type: 'object',
          properties: ListVisualsSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_list_tables',
        description: 'Lista tablas del modelo semántico (TMDL) asociado al PBIP',
        inputSchema: {
          type: 'object',
          properties: ListTablesSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_list_measures',
        description: 'Lista medidas del modelo semántico (TMDL) asociado al PBIP',
        inputSchema: {
          type: 'object',
          properties: ListMeasuresSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_list_columns',
        description: 'Lista columnas del modelo semántico (TMDL) asociado al PBIP',
        inputSchema: {
          type: 'object',
          properties: ListColumnsSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_list_relationships',
        description: 'Lista relaciones del modelo semántico (TMDL) asociado al PBIP',
        inputSchema: {
          type: 'object',
          properties: ListRelationshipsSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_get_table_details',
        description: 'Devuelve columnas/medidas con metadatos para una tabla del modelo',
        inputSchema: {
          type: 'object',
          properties: GetTableDetailsSchema.shape,
          required: ['pbipPath', 'tableName']
        }
      },
      {
        name: 'pbip_get_model_overview',
        description: 'Resumen del modelo: conteos, tablas y relaciones',
        inputSchema: {
          type: 'object',
          properties: GetModelOverviewSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbi_list_local_instances',
        description: 'Lista instancias locales de Power BI Desktop (Analysis Services)',
        inputSchema: {
          type: 'object',
          properties: ListLocalInstancesSchema.shape
        }
      },
      {
        name: 'pbi_execute_query',
        description: 'Ejecuta una consulta DAX o DMV en el modelo local (Analysis Services)',
        inputSchema: {
          type: 'object',
          properties: ExecuteQueryInputSchema.shape,
          required: ['query']
        }
      },
      {
        name: 'pbip_add_bar_chart',
        description: 'Agrega un gráfico de barras simple usando un visual existente como plantilla',
        inputSchema: {
          type: 'object',
          properties: AddBarChartSchema.shape,
          required: ['pbipPath']
        }
      },
      {
        name: 'pbip_set_visual_position',
        description: 'Actualiza posición/tamaño de un visual por nombre',
        inputSchema: {
          type: 'object',
          properties: SetPositionSchema.shape,
          required: ['pbipPath', 'visualName']
        }
      },
      {
        name: 'pbip_create_professional_canvas',
        description: 'Crea un lienzo profesional base (2 graficos + 1 tabla) seleccionando automaticamente tabla/campos del modelo',
        inputSchema: {
          type: 'object',
          properties: CreateProfessionalCanvasSchema.shape,
          required: ['pbipPath']
        }
      }
    ];
  }

  private async handleListSections(args: any) {
    const input = PbipPathSchema.parse(args);
    const { report } = loadPbip(input.pbipPath);

    const sections = report.sections.map((s: any) => ({
      name: s.name,
      displayName: s.displayName,
      width: s.width,
      height: s.height,
      visualCount: s.visualContainers?.length ?? 0
    }));

    return {
      content: [{ type: 'text', text: `Secciones encontradas: ${sections.length}` }],
      structuredContent: { sections }
    };
  }

  private async handleListVisuals(args: any) {
    const input = ListVisualsSchema.parse(args);
    const { report } = loadPbip(input.pbipPath);
    const section = findSection(report, input.sectionName);

    const visuals = (section.visualContainers || []).map((v: any, idx: number) => {
      const visualName = getVisualNameFromConfig(v.config) ?? `visual_${idx + 1}`;
      const visualType = getVisualTypeFromConfig(v.config) ?? 'unknown';
      return {
        name: visualName,
        type: visualType,
        x: v.x,
        y: v.y,
        width: v.width,
        height: v.height,
        z: v.z
      };
    });

    return {
      content: [{ type: 'text', text: `Visuales encontrados: ${visuals.length}` }],
      structuredContent: { visuals }
    };
  }

  private async handleListTables(args: any) {
    const input = ListTablesSchema.parse(args);
    const { tablesDir } = loadSemanticModel(input.pbipPath);
    const files = fs.readdirSync(tablesDir).filter((f) => f.toLowerCase().endsWith('.tmdl'));
    const tables = files.map((f) => {
      const tableName = f.replace(/\\.tmdl$/i, '');
      const content = stripBom(fs.readFileSync(path.join(tablesDir, f), 'utf8'));
      const parsed = parseTableTmdl(content);
      return {
        name: tableName,
        file: path.join(tablesDir, f),
        columnCount: parsed.columns.length,
        measureCount: parsed.measures.length
      };
    });

    return {
      content: [{ type: 'text', text: `Tablas encontradas: ${tables.length}` }],
      structuredContent: { tables }
    };
  }

  private async handleListMeasures(args: any) {
    const input = ListMeasuresSchema.parse(args);
    const { tablesDir } = loadSemanticModel(input.pbipPath);
    const files = fs.readdirSync(tablesDir).filter((f) => f.toLowerCase().endsWith('.tmdl'));
    const measures: Array<{ table: string } & ParsedMeasure> = [];

    for (const file of files) {
      const tableName = file.replace(/\\.tmdl$/i, '');
      if (input.tableName && input.tableName !== tableName) {
        continue;
      }
      const fullPath = path.join(tablesDir, file);
      const content = stripBom(fs.readFileSync(fullPath, 'utf8'));
      const parsed = parseMeasuresFromTmdl(content);
      for (const m of parsed) {
        measures.push({ table: tableName, ...m });
      }
    }

    return {
      content: [{ type: 'text', text: `Medidas encontradas: ${measures.length}` }],
      structuredContent: { measures }
    };
  }

  private async handleListColumns(args: any) {
    const input = ListColumnsSchema.parse(args);
    const { tablesDir } = loadSemanticModel(input.pbipPath);
    const files = fs.readdirSync(tablesDir).filter((f) => f.toLowerCase().endsWith('.tmdl'));
    const columns: Array<{ table: string } & ParsedColumn> = [];

    for (const file of files) {
      const tableName = file.replace(/\.tmdl$/i, '');
      if (input.tableName && input.tableName !== tableName) {
        continue;
      }
      const fullPath = path.join(tablesDir, file);
      const content = stripBom(fs.readFileSync(fullPath, 'utf8'));
      const parsed = parseColumnsFromTmdl(content);
      for (const c of parsed) {
        columns.push({ table: tableName, ...c });
      }
    }

    return {
      content: [{ type: 'text', text: `Columnas encontradas: ${columns.length}` }],
      structuredContent: { columns }
    };
  }

  private async handleListRelationships(args: any) {
    const input = ListRelationshipsSchema.parse(args);
    const { definitionDir } = loadSemanticModel(input.pbipPath);
    const relPath = path.join(definitionDir, 'relationships.tmdl');
    if (!fs.existsSync(relPath)) {
      return {
        content: [{ type: 'text', text: 'No se encontró relationships.tmdl en el modelo.' }],
        structuredContent: { relationships: [] }
      };
    }
    const content = stripBom(fs.readFileSync(relPath, 'utf8'));
    const relationships = parseRelationshipsTmdl(content);
    return {
      content: [{ type: 'text', text: `Relaciones encontradas: ${relationships.length}` }],
      structuredContent: { relationships }
    };
  }

  private async handleGetTableDetails(args: any) {
    const input = GetTableDetailsSchema.parse(args);
    const { tablesDir } = loadSemanticModel(input.pbipPath);
    const filePath = path.join(tablesDir, `${input.tableName}.tmdl`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No existe la tabla: ${input.tableName}`);
    }
    const content = stripBom(fs.readFileSync(filePath, 'utf8'));
    const parsed = parseTableTmdl(content);
    return {
      content: [
        {
          type: 'text',
          text: `Tabla ${input.tableName}: ${parsed.columns.length} columnas, ${parsed.measures.length} medidas`
        }
      ],
      structuredContent: {
        table: input.tableName,
        columns: parsed.columns,
        measures: parsed.measures
      }
    };
  }

  private async handleGetModelOverview(args: any) {
    const input = GetModelOverviewSchema.parse(args);
    const { tablesDir, definitionDir } = loadSemanticModel(input.pbipPath);
    const files = fs.readdirSync(tablesDir).filter((f) => f.toLowerCase().endsWith('.tmdl'));
    let totalColumns = 0;
    let totalMeasures = 0;
    const tables = files.map((f) => {
      const tableName = f.replace(/\\.tmdl$/i, '');
      const content = stripBom(fs.readFileSync(path.join(tablesDir, f), 'utf8'));
      const parsed = parseTableTmdl(content);
      totalColumns += parsed.columns.length;
      totalMeasures += parsed.measures.length;
      return {
        name: tableName,
        columnCount: parsed.columns.length,
        measureCount: parsed.measures.length
      };
    });

    const relPath = path.join(definitionDir, 'relationships.tmdl');
    let relationships: Record<string, any>[] = [];
    if (fs.existsSync(relPath)) {
      relationships = parseRelationshipsTmdl(stripBom(fs.readFileSync(relPath, 'utf8')));
    }

    const dateTables = tables.filter((t) => t.name.startsWith('LocalDateTable_')).map((t) => t.name);

    return {
      content: [
        {
          type: 'text',
          text: `Modelo: ${tables.length} tablas, ${totalColumns} columnas, ${totalMeasures} medidas, ${relationships.length} relaciones`
        }
      ],
      structuredContent: {
        tableCount: tables.length,
        columnCount: totalColumns,
        measureCount: totalMeasures,
        relationshipCount: relationships.length,
        dateTables,
        tables
      }
    };
  }

  private async handleListLocalInstances(args: any) {
    const input = ListLocalInstancesSchema.parse(args);
    const root = getWorkspaceRoot(input.rootPath);
    if (!root || !fs.existsSync(root)) {
      return {
        content: [{ type: 'text', text: 'No se encontró AnalysisServicesWorkspaces. Abra Power BI Desktop.' }],
        structuredContent: { instances: [] }
      };
    }

    const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    const instances = dirs.map((dir) => {
      const workspacePath = path.join(root, dir.name);
      const portFile = path.join(workspacePath, 'msmdsrv.port.txt');
      let port: number | null = null;
      if (fs.existsSync(portFile)) {
        const raw = stripBom(fs.readFileSync(portFile, 'utf8')).trim();
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
          port = parsed;
        }
      }
      const stat = fs.statSync(workspacePath);
      return {
        name: dir.name,
        workspacePath,
        port,
        lastWriteTime: stat.mtime.toISOString()
      };
    });

    instances.sort((a, b) => (a.lastWriteTime < b.lastWriteTime ? 1 : -1));

    return {
      content: [{ type: 'text', text: `Instancias encontradas: ${instances.length}` }],
      structuredContent: { instances }
    };
  }

  private async handleExecuteQuery(args: any) {
    const input = ExecuteQuerySchema.parse(args);
    const conn = input.connectionString ?? `Provider=MSOLAP;Data Source=localhost:${input.port};`;
    const result = runPythonQuery(conn, input.query, input.maxRows);
    const rowCount = Array.isArray(result.rows) ? result.rows.length : 0;
    return {
      content: [{ type: 'text', text: `Consulta ejecutada. Filas: ${rowCount}` }],
      structuredContent: result
    };
  }

  private async handleAddBarChart(args: any) {
    const input = AddBarChartSchema.parse(args);
    const { report, reportJsonPath } = loadPbip(input.pbipPath);
    const section = findSection(report, input.sectionName);

    const visuals = section.visualContainers || [];
    if (visuals.length === 0) {
      throw new Error('No hay visuales existentes para usar como plantilla.');
    }

    let template = visuals[0];
    if (input.templateVisualName) {
      const match = visuals.find((v: any) => getVisualNameFromConfig(v.config) === input.templateVisualName);
      if (!match) {
        throw new Error(`No se encontró visual plantilla: ${input.templateVisualName}`);
      }
      template = match;
    }

    const newVc = cloneVisualContainer(template);
    const cfg = parseVisualConfig(newVc.config);
    cfg.name = generateVisualName();

    const selectItems = cfg?.singleVisual?.prototypeQuery?.Select || [];
    const columnItem = selectItems.find((s: any) => s.Column);
    const aggItem = selectItems.find((s: any) => s.Aggregation);
    if (!columnItem || !aggItem) {
      throw new Error('No se encontraron columnas/medidas en el visual plantilla.');
    }

    const categoryRef = columnItem.Name;
    const valueRef = aggItem.Name;

    cfg.singleVisual.visualType = 'clusteredBarChart';
    cfg.singleVisual.projections = {
      Category: [{ queryRef: categoryRef }],
      Y: [{ queryRef: valueRef }]
    };
    cfg.singleVisual.prototypeQuery.Select = [columnItem, aggItem];

    const pos = resolveDefaults(section, input);
    cfg.layouts[0].position.x = pos.x;
    cfg.layouts[0].position.y = pos.y;
    cfg.layouts[0].position.width = pos.width;
    cfg.layouts[0].position.height = pos.height;

    newVc.config = JSON.stringify(cfg);
    newVc.x = pos.x;
    newVc.y = pos.y;
    newVc.width = pos.width;
    newVc.height = pos.height;
    newVc.z = getMaxZ(section) + 1;

    section.visualContainers = visuals.concat(newVc);
    saveReport(reportJsonPath, report);

    return {
      content: [{ type: 'text', text: `✅ Visual de barras creado: ${cfg.name}` }],
      structuredContent: {
        visual: {
          name: cfg.name,
          type: cfg.singleVisual.visualType,
          x: newVc.x,
          y: newVc.y,
          width: newVc.width,
          height: newVc.height
        }
      }
    };
  }

  private async handleSetVisualPosition(args: any) {
    const input = SetPositionSchema.parse(args);
    const { report, reportJsonPath } = loadPbip(input.pbipPath);
    const section = findSection(report, input.sectionName);

    const visuals = section.visualContainers || [];
    const target = visuals.find((v: any) => getVisualNameFromConfig(v.config) === input.visualName);
    if (!target) {
      throw new Error(`No se encontró visual: ${input.visualName}`);
    }

    const cfg = parseVisualConfig(target.config);
    const pos = {
      x: input.x ?? target.x,
      y: input.y ?? target.y,
      width: input.width ?? target.width,
      height: input.height ?? target.height
    };

    cfg.layouts[0].position.x = pos.x;
    cfg.layouts[0].position.y = pos.y;
    cfg.layouts[0].position.width = pos.width;
    cfg.layouts[0].position.height = pos.height;

    target.config = JSON.stringify(cfg);
    target.x = pos.x;
    target.y = pos.y;
    target.width = pos.width;
    target.height = pos.height;
    if (typeof input.z === 'number') {
      target.z = input.z;
    }

    saveReport(reportJsonPath, report);

    return {
      content: [{ type: 'text', text: `✅ Posición actualizada para ${input.visualName}` }],
      structuredContent: {
        visual: {
          name: input.visualName,
          x: target.x,
          y: target.y,
          width: target.width,
          height: target.height,
          z: target.z
        }
      }
    };
  }

  private async handleCreateProfessionalCanvas(args: any) {
    const input = CreateProfessionalCanvasSchema.parse(args);
    const replaceExistingVisuals = input.replaceExistingVisuals ?? true;
    const applyTemplateStyle = input.applyTemplateStyle ?? true;

    const { report, reportDir, reportJsonPath } = loadPbip(input.pbipPath);
    const { tablesDir } = loadSemanticModel(input.pbipPath);

    const files = fs.readdirSync(tablesDir).filter((f) => f.toLowerCase().endsWith('.tmdl'));
    const tableProfiles = files
      .map((f) => {
        const tableName = f.replace(/\.tmdl$/i, '');
        const content = stripBom(fs.readFileSync(path.join(tablesDir, f), 'utf8'));
        const parsed = parseTableTmdl(content);
        return { tableName, columns: parsed.columns };
      })
      .filter((t) => t.columns.length > 0);

    if (tableProfiles.length === 0) {
      throw new Error('No se encontraron tablas con columnas para construir el lienzo.');
    }

    let selectedTable = tableProfiles[0];
    if (input.preferTable) {
      const preferred = tableProfiles.find((t) => t.tableName.toLowerCase() === input.preferTable!.toLowerCase());
      if (preferred) {
        selectedTable = preferred;
      } else {
        throw new Error(`No existe la tabla preferida: ${input.preferTable}`);
      }
    } else {
      selectedTable = tableProfiles
        .slice()
        .sort((a, b) => scoreTableForCanvas(b.tableName, b.columns) - scoreTableForCanvas(a.tableName, a.columns))[0];
    }

    const visibleCols = selectedTable.columns.filter((c) => !c.isHidden);
    const numericCols = visibleCols.filter((c) => isNumericDataType(c.dataType));
    const categoryCols = visibleCols.filter((c) => (c.dataType || '').toLowerCase() === 'string');

    if (numericCols.length === 0 || categoryCols.length === 0) {
      throw new Error(
        `La tabla ${selectedTable.tableName} no tiene suficientes columnas visibles (se requieren al menos 1 categorica string y 1 numerica).`
      );
    }

    const category1 =
      findColumnCaseInsensitive(categoryCols, ['ESTADO_MOVIMIENTO', 'Estado', 'Categoria', 'CLASE_ABC', 'Tipo']) || categoryCols[0];
    const category2 =
      findColumnCaseInsensitive(categoryCols.filter((c) => c.name !== category1.name), ['Centro', 'Mercado', 'Sucursal', 'Canal']) ||
      categoryCols.find((c) => c.name !== category1.name) ||
      category1;

    const value1 = findColumnCaseInsensitive(numericCols, ['STK', 'Stock', 'Cantidad', 'VENTA_12M']) || numericCols[0];
    const value2 =
      findColumnCaseInsensitive(numericCols.filter((c) => c.name !== value1.name), ['ATP_CDQ', 'ATP', 'Valor', 'Importe']) ||
      numericCols.find((c) => c.name !== value1.name) ||
      value1;

    const preferredDetailCols = ['MATNR', 'MAKTX', 'Centro', 'ESTADO_MOVIMIENTO', 'Categoria', 'Mercado'];
    const detailTextCols: ParsedColumn[] = [];
    for (const p of preferredDetailCols) {
      const col = findColumnCaseInsensitive(visibleCols, [p]);
      if (col && !detailTextCols.some((x) => x.name === col.name) && !isNumericDataType(col.dataType)) {
        detailTextCols.push(col);
      }
    }
    if (detailTextCols.length < 3) {
      for (const col of categoryCols) {
        if (detailTextCols.length >= 4) break;
        if (!detailTextCols.some((x) => x.name === col.name)) {
          detailTextCols.push(col);
        }
      }
    }

    const alias = 't';
    const margin = 20;
    const pageWidth = applyTemplateStyle ? 1400 : 1280;
    const pageHeight = applyTemplateStyle ? 900 : 720;
    const contentX = applyTemplateStyle ? 272 : margin;
    const contentW = pageWidth - contentX - margin;
    const topRowY = applyTemplateStyle ? 80 : margin;
    const topRowHeight = applyTemplateStyle ? 260 : 300;
    const topGap = applyTemplateStyle ? 20 : margin;
    const leftW = Math.floor((contentW - topGap) / 2);
    const rightW = contentW - topGap - leftW;
    const tableY = applyTemplateStyle ? 360 : margin * 2 + topRowHeight;
    const tableHeight = applyTemplateStyle ? 500 : pageHeight - (margin * 3 + topRowHeight);

    let section: any;
    if (!report.sections || report.sections.length === 0) {
      section = {
        config: '{}',
        displayName: input.sectionDisplayName ?? '01_Base_Profesional',
        displayOption: 1,
        filters: '[]',
        height: pageHeight,
        name: generateVisualName(),
        visualContainers: [],
        width: pageWidth
      };
      report.sections = [section];
    } else {
      section = findSection(report, input.sectionName);
    }

    section.width = pageWidth;
    section.height = pageHeight;

    if (input.sectionDisplayName) {
      section.displayName = input.sectionDisplayName;
    } else if (!section.displayName || /^Página\s+\d+$/i.test(section.displayName)) {
      section.displayName = '01_Base_Profesional';
    }

    if (replaceExistingVisuals) {
      section.visualContainers = [];
    }

    const zBase = getMaxZ(section) + 1;

    const chart1Cat = buildColumnSelect(alias, selectedTable.tableName, category1.name);
    const chart1Val = buildSumSelect(alias, selectedTable.tableName, value1.name);
    const chart1 = buildVisualContainer({
      name: generateVisualName(),
      x: contentX,
      y: topRowY,
      z: zBase,
      width: leftW,
      height: topRowHeight,
      singleVisual: {
        visualType: 'clusteredBarChart',
        projections: {
          Category: [{ queryRef: chart1Cat.Name, active: true }],
          Y: [{ queryRef: chart1Val.Name }]
        },
        prototypeQuery: {
          Version: 2,
          From: [{ Name: alias, Entity: selectedTable.tableName, Type: 0 }],
          Select: [chart1Cat, chart1Val]
        },
        drillFilterOtherVisuals: true
      }
    });

    const chart2Cat = buildColumnSelect(alias, selectedTable.tableName, category2.name);
    const chart2Val = buildSumSelect(alias, selectedTable.tableName, value2.name);
    const chart2 = buildVisualContainer({
      name: generateVisualName(),
      x: contentX + leftW + topGap,
      y: topRowY,
      z: zBase + 1,
      width: rightW,
      height: topRowHeight,
      singleVisual: {
        visualType: 'clusteredBarChart',
        projections: {
          Category: [{ queryRef: chart2Cat.Name, active: true }],
          Y: [{ queryRef: chart2Val.Name }]
        },
        prototypeQuery: {
          Version: 2,
          From: [{ Name: alias, Entity: selectedTable.tableName, Type: 0 }],
          Select: [chart2Cat, chart2Val]
        },
        drillFilterOtherVisuals: true
      }
    });

    const tableSelect: any[] = [];
    const tableValueRefs: Array<{ queryRef: string }> = [];
    for (const col of detailTextCols.slice(0, 4)) {
      const item = buildColumnSelect(alias, selectedTable.tableName, col.name);
      tableSelect.push(item);
      tableValueRefs.push({ queryRef: item.Name });
    }
    for (const col of [value1, value2]) {
      const item = buildSumSelect(alias, selectedTable.tableName, col.name);
      tableSelect.push(item);
      tableValueRefs.push({ queryRef: item.Name });
    }
    const dateCol =
      findColumnCaseInsensitive(visibleCols.filter((c) => isDateDataType(c.dataType)), [
        'FECHA_STK',
        'Fecha',
        'FECHA_ATP_CDQ',
        'ULTIMA_BEDAT_PO'
      ]) || null;
    if (dateCol) {
      const item = buildColumnSelect(alias, selectedTable.tableName, dateCol.name);
      tableSelect.push(item);
      tableValueRefs.push({ queryRef: item.Name });
    }

    const tableVisual = buildVisualContainer({
      name: generateVisualName(),
      x: contentX,
      y: tableY,
      z: zBase + 2,
      width: contentW,
      height: tableHeight,
      singleVisual: {
        visualType: 'tableEx',
        projections: { Values: tableValueRefs },
        prototypeQuery: {
          Version: 2,
          From: [{ Name: alias, Entity: selectedTable.tableName, Type: 0 }],
          Select: tableSelect
        },
        drillFilterOtherVisuals: true
      }
    });

    if (applyTemplateStyle) {
      const pbipDir = path.dirname(path.resolve(input.pbipPath));
      const defaultTemplatePbipPath = path.resolve(pbipDir, 'canvas-plantilla', 'plantilla_canvas.pbip');
      const templatePbipPath = input.templatePbipPath || defaultTemplatePbipPath;

      let copiedThemeName: string | null = null;
      let copiedThemeVersion = '5.51';
      let copiedLogoFileName = 'logo-artel9631238808714528.png';

      if (fs.existsSync(templatePbipPath)) {
        const { report: templateReport, reportDir: templateReportDir } = loadPbip(templatePbipPath);
        const tCfg = parseReportConfigConfig(templateReport);
        const tBaseTheme = tCfg?.themeCollection?.baseTheme;
        const themeName = tBaseTheme?.name;
        if (typeof themeName === 'string' && themeName.length > 0) {
          const srcThemePath = path.join(templateReportDir, 'StaticResources', 'SharedResources', 'BaseThemes', `${themeName}.json`);
          const dstThemePath = path.join(reportDir, 'StaticResources', 'SharedResources', 'BaseThemes', `${themeName}.json`);
          if (copyFileIfExists(srcThemePath, dstThemePath)) {
            copiedThemeName = themeName;
            if (typeof tBaseTheme?.version === 'string' && tBaseTheme.version.length > 0) {
              copiedThemeVersion = tBaseTheme.version;
            }
          }
        }

        const registeredPkg = (templateReport.resourcePackages || []).find(
          (p: any) => p?.resourcePackage?.name === 'RegisteredResources'
        );
        const registeredItem = registeredPkg?.resourcePackage?.items?.find((it: any) => it?.type === 100);
        if (registeredItem?.name && registeredItem?.path) {
          const srcLogoPath = path.join(templateReportDir, 'StaticResources', 'RegisteredResources', registeredItem.path);
          const dstLogoPath = path.join(reportDir, 'StaticResources', 'RegisteredResources', registeredItem.name);
          if (copyFileIfExists(srcLogoPath, dstLogoPath)) {
            copiedLogoFileName = registeredItem.name;
          }
        }
      }

      if (copiedThemeName) {
        const rCfg = parseReportConfigConfig(report);
        if (!rCfg.themeCollection) rCfg.themeCollection = {};
        rCfg.themeCollection.baseTheme = { name: copiedThemeName, type: 2, version: copiedThemeVersion };
        setReportConfig(report, rCfg);

        report.resourcePackages = [
          {
            resourcePackage: {
              disabled: false,
              items: [{ name: copiedThemeName, path: `BaseThemes/${copiedThemeName}.json`, type: 202 }],
              name: 'SharedResources',
              type: 2
            }
          },
          {
            resourcePackage: {
              disabled: false,
              items: [{ name: copiedLogoFileName, path: copiedLogoFileName, type: 100 }],
              name: 'RegisteredResources',
              type: 1
            }
          }
        ];
      }

      const decorativeVisuals = buildTemplateDecorativeVisuals(copiedLogoFileName).map((cfg, idx) => ({
        config: JSON.stringify(cfg),
        filters: '[]',
        x: cfg.layouts[0].position.x,
        y: cfg.layouts[0].position.y,
        z: cfg.layouts[0].position.z + idx,
        width: cfg.layouts[0].position.width,
        height: cfg.layouts[0].position.height
      }));

      const subtitleVisual = buildVisualContainer({
        name: 'v_subtitle_template',
        x: 272,
        y: 16,
        z: 302,
        width: pageWidth - 292,
        height: 48,
        singleVisual: {
          visualType: 'textbox',
          drillFilterOtherVisuals: true,
          objects: {
            general: [
              {
                properties: {
                  paragraphs: [
                    {
                      textRuns: [
                        {
                          value: 'Dashboard con plantilla corporativa (canvas)',
                          textStyle: { fontWeight: 'bold', fontSize: '18pt', color: '#094780' }
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        }
      });

      const existingWithoutTemplate = (section.visualContainers || []).filter((v: any) => {
        const n = getVisualNameFromConfig(v.config);
        return !['v_sidebar_template', 'v_logo_template', 'v_title_template', 'v_subtitle_template'].includes(n || '');
      });
      section.visualContainers = decorativeVisuals.concat([subtitleVisual]).concat(existingWithoutTemplate);
    }

    const existing = section.visualContainers || [];
    section.visualContainers = existing.concat([chart1, chart2, tableVisual]);
    saveReport(reportJsonPath, report);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Lienzo profesional creado en sección "${section.displayName}" usando tabla "${selectedTable.tableName}" (${section.visualContainers.length} visuales en total).`
        }
      ],
      structuredContent: {
        section: {
          name: section.name,
          displayName: section.displayName
        },
        selectedTable: selectedTable.tableName,
        chosenColumns: {
          chart1: { category: category1.name, value: value1.name },
          chart2: { category: category2.name, value: value2.name },
          detail: tableValueRefs.map((v) => v.queryRef)
        },
        visualsAdded: 3,
        replaceExistingVisuals,
        applyTemplateStyle
      }
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new PbipVisualMcpServer();
server.run().catch((error) => {
  console.error('Error fatal del servidor:', error);
  process.exit(1);
});


