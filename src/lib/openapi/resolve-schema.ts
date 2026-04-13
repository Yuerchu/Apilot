import type { SchemaObject } from './types'

export function resolveEffectiveSchema(schema: SchemaObject | undefined | null): SchemaObject & { _nullable: boolean } {
  if (!schema || typeof schema !== 'object') return { ...(schema || {}), _nullable: false } as SchemaObject & { _nullable: boolean };
  let s: SchemaObject = schema;
  // Merge allOf into a flat object
  if (s.allOf) {
    let merged: Record<string, any> = {};
    for (const part of s.allOf) Object.assign(merged, part);
    for (const [k, v] of Object.entries(s)) {
      if (k !== 'allOf') merged[k] = v;
    }
    s = merged as SchemaObject;
  }
  let nullable = false;
  // OAS 3.1: type: ["string", "null"] → unwrap to type: "string", nullable
  if (Array.isArray(s.type)) {
    const hasNull = s.type.includes('null');
    const nonNull = s.type.filter(t => t !== 'null');
    if (hasNull) nullable = true;
    s = { ...s, type: nonNull.length === 1 ? nonNull[0] : nonNull };
  }
  // OAS 3.0: nullable: true
  if (s.nullable) nullable = true;
  // Unwrap anyOf nullable pattern
  if (s.anyOf) {
    const hasNull = s.anyOf.some(x => x.type === 'null');
    const nonNull = s.anyOf.find(x => x.type !== 'null');
    if (hasNull && nonNull) {
      const topDefault = s.default;
      const topDesc = s.description;
      s = { ...nonNull };
      if (topDefault !== undefined && s.default === undefined) s.default = topDefault;
      if (topDesc && !s.description) s.description = topDesc;
      nullable = true;
    }
  }
  return { ...s, _nullable: nullable };
}
