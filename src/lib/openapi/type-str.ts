import type { SchemaObject } from './types'

export function getTypeStr(schema: SchemaObject | undefined): string {
  if (!schema) return 'any';
  // OAS 3.1: type can be array like ["string", "null"]
  let t: string;
  if (Array.isArray(schema.type)) {
    t = schema.type.filter((x: string) => x !== 'null').join(' | ') || 'any';
    if (schema.type.includes('null')) t += ' | null';
  } else {
    t = schema.type || 'any';
  }
  if (schema.format) t += `(${schema.format})`;
  if (schema.const !== undefined) t += ` const: ${JSON.stringify(schema.const)}`;
  if (schema.enum) t += ` enum: [${schema.enum.join(', ')}]`;
  if (schema.default !== undefined) t += ` default: ${JSON.stringify(schema.default)}`;
  // OAS 3.0 nullable / Swagger 2.0 x-nullable
  if (schema.nullable || schema['x-nullable']) t += ' | null';
  if (schema.anyOf) {
    const types = schema.anyOf.map(s => s.type).filter(Boolean);
    if (types.includes('null')) {
      const other = schema.anyOf.find(s => s.type !== 'null');
      if (other) return getTypeStr(other) + ' | null';
    }
  }
  return t;
}

export function getConstraints(prop: SchemaObject): string {
  const p: string[] = [];
  if (prop.maxLength !== undefined) p.push(`maxLen: ${prop.maxLength}`);
  if (prop.minLength !== undefined) p.push(`minLen: ${prop.minLength}`);
  if (prop.maximum !== undefined) p.push(`max: ${prop.maximum}`);
  if (prop.minimum !== undefined) p.push(`min: ${prop.minimum}`);
  if (prop.exclusiveMaximum !== undefined) p.push(`exclusiveMax: ${prop.exclusiveMaximum}`);
  if (prop.exclusiveMinimum !== undefined) p.push(`exclusiveMin: ${prop.exclusiveMinimum}`);
  if (prop.pattern) p.push(`pattern: ${prop.pattern}`);
  if (prop.maxItems !== undefined) p.push(`maxItems: ${prop.maxItems}`);
  if (prop.minItems !== undefined) p.push(`minItems: ${prop.minItems}`);
  if (prop.uniqueItems) p.push('uniqueItems');
  return p.length ? ` [${p.join(', ')}]` : '';
}
