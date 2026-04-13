import type { SchemaObject, ParsedRoute } from './openapi/types'
import { getTypeStr } from './openapi/type-str'
import { formatSchema } from './openapi/format-schema'
import { generateExample } from './openapi/generate-example'

export function formatMarkdown(r: ParsedRoute, includeExamples?: boolean): string {
  let out = `## ${r.method.toUpperCase()} ${r.path}\n`;
  if (r.summary) out += `${r.summary}\n`;
  if (r.description && r.description !== r.summary) out += `${r.description}\n`;
  if (r.operationId) out += `Operation ID: ${r.operationId}\n`;
  if (r.parameters?.length) {
    out += `\n### Parameters\n`;
    for (const p of r.parameters) {
      const req = p.required ? ' (required)' : '';
      const ptype = p.schema ? getTypeStr(p.schema) : (p.type || 'string');
      const desc = p.description ? ` — ${p.description}` : '';
      out += `- ${p.name}${req}: ${ptype}, in: ${p.in}${desc}\n`;
      if (p.schema?.enum) out += `  enum: [${p.schema.enum.join(', ')}]\n`;
      if (p.schema?.default !== undefined) out += `  default: ${JSON.stringify(p.schema.default)}\n`;
    }
  }
  if (r.requestBody) {
    out += `\n### Request Body${r.requestBody.required ? ' (required)' : ''}\n`;
    if (r.requestBody.description) out += `${r.requestBody.description}\n`;
    for (const [mt, mo] of Object.entries(r.requestBody.content || {})) {
      out += `\nContent-Type: ${mt}\n`;
      if (mo.schema) out += `Schema:\n${formatSchema(mo.schema, 1, 15)}\n`;
      if (includeExamples) {
        const ex = mo.example || generateExample(mo.schema as SchemaObject);
        if (ex) out += `Example:\n${JSON.stringify(ex, null, 2)}\n`;
      }
    }
  }
  out += `\n### Responses\n`;
  for (const [code, resp] of Object.entries(r.responses)) {
    out += `\n#### ${code}: ${resp.description || ''}\n`;
    for (const [mt, mo] of Object.entries(resp.content || {})) {
      out += `Content-Type: ${mt}\n`;
      if (mo.schema) out += `Schema:\n${formatSchema(mo.schema, 1, 15)}\n`;
      if (includeExamples) {
        const ex = mo.example || generateExample(mo.schema as SchemaObject);
        if (ex) out += `Example:\n${JSON.stringify(ex, null, 2)}\n`;
      }
    }
  }
  return out;
}

export function formatYaml(r: ParsedRoute, _includeExamples?: boolean): string {
  let out = `${r.method.toUpperCase()} ${r.path}:\n`;
  if (r.summary) out += `  summary: ${r.summary}\n`;
  if (r.description && r.description !== r.summary) out += `  description: ${r.description}\n`;
  if (r.operationId) out += `  operationId: ${r.operationId}\n`;
  if (r.parameters?.length) {
    out += `  parameters:\n`;
    for (const p of r.parameters) {
      out += `    - name: ${p.name}\n      in: ${p.in}\n`;
      if (p.required) out += `      required: true\n`;
      if (p.schema) out += `      type: ${getTypeStr(p.schema)}\n`;
      if (p.description) out += `      description: ${p.description}\n`;
    }
  }
  if (r.requestBody) {
    out += `  requestBody:\n`;
    if (r.requestBody.required) out += `    required: true\n`;
    for (const [mt, mo] of Object.entries(r.requestBody.content || {})) {
      out += `    ${mt}:\n`;
      if (mo.schema) out += `      schema:\n${formatSchema(mo.schema, 4, 15)}\n`;
    }
  }
  out += `  responses:\n`;
  for (const [code, resp] of Object.entries(r.responses)) {
    out += `    ${code}:\n`;
    if (resp.description) out += `      description: ${resp.description}\n`;
    for (const [mt, mo] of Object.entries(resp.content || {})) {
      out += `      ${mt}:\n`;
      if (mo.schema) out += `        schema:\n${formatSchema(mo.schema, 5, 15)}\n`;
    }
  }
  return out;
}
