import type { SchemaObject } from './types'

export function resolveEffectiveSchema(schema: SchemaObject | undefined | null): SchemaObject & { _nullable: boolean } {
  if (!schema || typeof schema !== 'object') return { ...(schema || {}), _nullable: false } as SchemaObject & { _nullable: boolean };
  let s: SchemaObject = schema;
  // Merge allOf into a flat object
  if (s.allOf) {
    const merged: SchemaObject = {};
    for (const part of s.allOf) Object.assign(merged, part);
    for (const [k, v] of Object.entries(s)) {
      if (k !== 'allOf') merged[k] = v;
    }
    s = merged;
  }
  let nullable = false;
  // OAS 3.1: type: ["string", "null"] → unwrap to type: "string", nullable
  if (Array.isArray(s.type)) {
    const hasNull = s.type.includes('null');
    const nonNull = s.type.filter(t => t !== 'null');
    if (hasNull) nullable = true;
    s = { ...s, type: nonNull.length === 1 ? nonNull[0]! : nonNull };
  }
  // OAS 3.0: nullable: true
  if (s.nullable) nullable = true;
  // Unwrap anyOf/oneOf nullable pattern: [SomeType, {type:"null"}] → SomeType + nullable
  for (const key of ['anyOf', 'oneOf'] as const) {
    const variants = s[key] as SchemaObject[] | undefined;
    if (!variants) continue;
    const nullVariants = variants.filter(x => x.type === 'null' || (Array.isArray(x.type) && x.type.length === 1 && x.type[0] === 'null'));
    const nonNullVariants = variants.filter(x => !nullVariants.includes(x));
    if (nullVariants.length > 0 && nonNullVariants.length === 1) {
      const topDefault = s.default;
      const topDesc = s.description;
      const topTitle = s.title;
      s = { ...nonNullVariants[0]! };
      if (topDefault !== undefined && s.default === undefined) s.default = topDefault;
      if (topDesc && !s.description) s.description = topDesc;
      if (topTitle && !s.title) s.title = topTitle;
      nullable = true;
    }
  }
  return { ...s, _nullable: nullable };
}
