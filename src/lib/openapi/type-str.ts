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
  if (schema.enum) {
    const rendered = schema.enum.map((v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)));
    t += ` enum: [${rendered.join(', ')}]`;
  }
  if (schema.default !== undefined) t += ` default: ${JSON.stringify(schema.default)}`;
  // OAS 3.0 nullable / Swagger 2.0 x-nullable
  if (schema.nullable || schema['x-nullable']) t += ' | null';
  // anyOf/oneOf nullable union: [SomeType, {type:"null"}] (also OAS 3.1 {type:["null"]})
  for (const key of ['anyOf', 'oneOf'] as const) {
    const variants = schema[key];
    if (!variants) continue;
    const isNull = (s: SchemaObject) => s.type === 'null' || (Array.isArray(s.type) && s.type.length === 1 && s.type[0] === 'null');
    const nonNull = variants.filter(s => !isNull(s));
    if (variants.some(isNull) && nonNull.length === 1) {
      return getTypeStr(nonNull[0]) + ' | null';
    }
  }
  return t;
}

export function getConstraints(prop: SchemaObject): string {
  const p: string[] = [];
  if (prop.maxLength !== undefined) p.push(`maxLen: ${prop.maxLength}`);
  if (prop.minLength !== undefined) p.push(`minLen: ${prop.minLength}`);
  // exclusiveMax/Min is a number in OAS 3.1 but a boolean flag on minimum/maximum
  // in OAS 3.0; render the boolean form as a strict bound rather than "true".
  if (prop.maximum !== undefined) p.push(prop.exclusiveMaximum === true ? `max: <${prop.maximum}` : `max: ${prop.maximum}`);
  if (prop.minimum !== undefined) p.push(prop.exclusiveMinimum === true ? `min: >${prop.minimum}` : `min: ${prop.minimum}`);
  if (typeof prop.exclusiveMaximum === "number") p.push(`exclusiveMax: ${prop.exclusiveMaximum}`);
  if (typeof prop.exclusiveMinimum === "number") p.push(`exclusiveMin: ${prop.exclusiveMinimum}`);
  if (prop.pattern) p.push(`pattern: ${prop.pattern}`);
  if (prop.maxItems !== undefined) p.push(`maxItems: ${prop.maxItems}`);
  if (prop.minItems !== undefined) p.push(`minItems: ${prop.minItems}`);
  if (prop.uniqueItems) p.push('uniqueItems');
  return p.length ? ` [${p.join(', ')}]` : '';
}
