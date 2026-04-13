import type { SchemaObject } from './types'
import { getTypeStr, getConstraints } from './type-str'

export function formatSchema(schema: SchemaObject | undefined, indent: number = 0, maxDepth: number = 15): string {
  if (!schema) return 'any';
  if (maxDepth <= 0) return '  '.repeat(indent) + '...';
  if (schema._circular) return '  '.repeat(indent) + `(circular: ${schema._circular})`;
  if (schema._unresolved) return '  '.repeat(indent) + `(unresolved: ${schema._unresolved})`;
  const pad = '  '.repeat(indent), pad1 = '  '.repeat(indent + 1);
  const lines: string[] = [];

  if (schema.allOf) {
    lines.push(`${pad}allOf:`);
    for (const sub of schema.allOf) lines.push(formatSchema(sub, indent + 1, maxDepth - 1));
    return lines.join('\n');
  }
  if (schema.anyOf) {
    lines.push(`${pad}anyOf:`);
    for (let i = 0; i < schema.anyOf.length; i++) {
      lines.push(`${pad1}#${i}:`);
      lines.push(formatSchema(schema.anyOf[i], indent + 2, maxDepth - 1));
    }
    return lines.join('\n');
  }
  if (schema.oneOf) {
    lines.push(`${pad}oneOf:`);
    for (let i = 0; i < schema.oneOf.length; i++) {
      lines.push(`${pad1}#${i}:`);
      lines.push(formatSchema(schema.oneOf[i], indent + 2, maxDepth - 1));
    }
    return lines.join('\n');
  }

  const type = schema.type;
  const title = schema.title ? ` (${schema.title})` : '';
  const desc = schema.description ? ` — ${schema.description}` : '';
  const required = new Set(schema.required || []);

  if (type === 'object' || schema.properties) {
    const extra = schema.additionalProperties === false ? ', additionalProperties: false' : '';
    lines.push(`${pad}object${title}${desc}${extra}`);
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        const req = required.has(name) ? ' (required)' : '';
        const ptype = getTypeStr(prop);
        const pdesc = prop.description ? ` — ${prop.description}` : '';
        const constraints = getConstraints(prop);
        if ((prop.type === 'object' || prop.properties) && !prop._circular) {
          lines.push(`${pad1}${name}${req}: ${ptype}${pdesc}${constraints}`);
          lines.push(formatSchema(prop, indent + 2, maxDepth - 1));
        } else if (prop.type === 'array' && prop.items && (prop.items.type === 'object' || prop.items.properties)) {
          lines.push(`${pad1}${name}${req}: array${pdesc}${constraints}`);
          lines.push(`${pad1}  items:`);
          lines.push(formatSchema(prop.items, indent + 3, maxDepth - 1));
        } else if (prop.anyOf || prop.oneOf || prop.allOf) {
          lines.push(`${pad1}${name}${req}:${pdesc}`);
          lines.push(formatSchema(prop, indent + 2, maxDepth - 1));
        } else {
          lines.push(`${pad1}${name}${req}: ${ptype}${pdesc}${constraints}`);
        }
      }
    }
    return lines.join('\n');
  }
  if (type === 'array') {
    lines.push(`${pad}array${title}${desc}`);
    if (schema.items) {
      lines.push(`${pad1}items: ${getTypeStr(schema.items)}`);
      if (schema.items.type === 'object' || schema.items.properties) lines.push(formatSchema(schema.items, indent + 2, maxDepth - 1));
    }
    return lines.join('\n');
  }
  return `${pad}${getTypeStr(schema)}${title}${desc}${getConstraints(schema)}`;
}
