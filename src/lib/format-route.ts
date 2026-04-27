import type { SchemaObject, ParsedRoute } from './openapi/types'
import type { ParsedChannel, ParsedOperation, ParsedMessage } from './asyncapi/types'
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

export function formatMarkdownChannel(ch: ParsedChannel): string {
  let out = `## WS ${ch.address}\n`
  if (ch.title && ch.title !== ch.id) out += `**${ch.title}**\n`
  if (ch.description) out += `${ch.description}\n`

  if (ch.parameters.length > 0) {
    out += `\n### Parameters\n`
    for (const p of ch.parameters) {
      out += `- ${p.name}${p.description ? ` — ${p.description}` : ""}\n`
    }
  }

  if (ch.sendOperations.length > 0) {
    out += `\n### Send Operations\n`
    for (const op of ch.sendOperations) {
      out += formatOperation(op)
    }
  }

  if (ch.receiveOperations.length > 0) {
    out += `\n### Receive Operations\n`
    for (const op of ch.receiveOperations) {
      out += formatOperation(op)
    }
  }

  return out
}

function formatOperation(op: ParsedOperation): string {
  let out = `\n#### ${op.action.toUpperCase()} — ${op.title}\n`
  if (op.summary) out += `${op.summary}\n`
  if (op.description) out += `${op.description}\n`
  for (const msg of op.messages) {
    out += formatMessage(msg)
  }
  return out
}

function formatMessage(msg: ParsedMessage): string {
  let out = `\n**${msg.title}**`
  if (msg.discriminatorField && msg.discriminatorValue) {
    out += ` (${msg.discriminatorField}: ${msg.discriminatorValue})`
  }
  out += "\n"
  if (msg.summary) out += `${msg.summary}\n`
  if (msg.payload) out += `Payload:\n${formatSchema(msg.payload, 1, 15)}\n`
  return out
}

