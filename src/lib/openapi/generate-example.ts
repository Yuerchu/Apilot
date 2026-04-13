import type { SchemaObject } from './types'

export function generateExample(schema: SchemaObject | undefined, depth: number = 0): any {
  if (!schema) return null;
  if (depth > 15) return '...';
  if (schema._circular) return `[circular: ${schema._circular}]`;
  if (schema._unresolved) return `[unresolved: ${schema._unresolved}]`;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;

  if (schema.allOf) {
    let merged: Record<string, any> = {};
    for (const s of schema.allOf) Object.assign(merged, generateExample(s, depth + 1));
    return merged;
  }
  if (schema.anyOf) {
    const nonNull = schema.anyOf.find(s => s.type !== 'null');
    return generateExample(nonNull || schema.anyOf[0], depth + 1);
  }
  if (schema.oneOf) return generateExample(schema.oneOf[0], depth + 1);

  // OAS 3.1: type can be array — normalize to first non-null type
  let type = schema.type;
  if (Array.isArray(type)) {
    type = type.find((t: string) => t !== 'null') || type[0];
  }

  if (type === 'object' || schema.properties) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema.properties || {})) {
      obj[k] = generateExample(v, depth + 1);
    }
    return obj;
  }
  if (type === 'array') {
    const item = generateExample(schema.items, depth + 1);
    return item !== null ? [item] : [];
  }
  if (schema.enum) return schema.enum[0];
  if (type === 'string') {
    if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return new Date().toISOString().split('T')[0];
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
    if (schema.format === 'binary') return null;
    return 'string';
  }
  if (type === 'integer') return schema.minimum !== undefined ? schema.minimum : 0;
  if (type === 'number') return schema.minimum !== undefined ? schema.minimum : 0.0;
  if (type === 'boolean') return false;
  return null;
}
