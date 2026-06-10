import type { SchemaObject } from './types'

export function resolveEffectiveSchema(schema: SchemaObject | undefined | null): SchemaObject & { _nullable: boolean } {
  if (!schema || typeof schema !== 'object') return { ...(schema || {}), _nullable: false } as SchemaObject & { _nullable: boolean };
  let s: SchemaObject = schema;
  // Merge allOf into a flat object (deep-merge properties and concatenate required)
  if (s.allOf) {
    const merged: SchemaObject = {};
    for (const part of s.allOf) {
      if (!part || typeof part !== 'object') continue;
      const { properties, required, ...rest } = part as SchemaObject & { required?: string[] };
      Object.assign(merged, rest);
      if (properties) {
        const existing = merged.properties || {};
        const combined: Record<string, SchemaObject> = { ...existing };
        for (const [pk, pv] of Object.entries(properties)) {
          if (existing[pk] && typeof existing[pk] === 'object' && typeof pv === 'object') {
            combined[pk] = { ...existing[pk], ...pv };
          } else {
            combined[pk] = pv;
          }
        }
        merged.properties = combined;
      }
      if (required) {
        merged.required = [...((merged as { required?: string[] }).required || []), ...required];
      }
    }
    for (const [k, v] of Object.entries(s)) {
      if (k === 'allOf') continue;
      if (k === 'properties') {
        const existing = merged.properties || {};
        const combined: Record<string, SchemaObject> = { ...existing };
        for (const [pk, pv] of Object.entries(v as Record<string, SchemaObject>)) {
          if (existing[pk] && typeof existing[pk] === 'object' && typeof pv === 'object') {
            combined[pk] = { ...existing[pk], ...pv };
          } else {
            combined[pk] = pv;
          }
        }
        merged.properties = combined;
      } else if (k === 'required') {
        merged.required = [...((merged as { required?: string[] }).required || []), ...(v as string[])];
      } else {
        merged[k] = v;
      }
    }
    if ((merged as { required?: string[] }).required) {
      (merged as { required: string[] }).required = [...new Set((merged as { required: string[] }).required)];
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
    const variants = (s[key] as SchemaObject[] | undefined)?.filter(x => x && typeof x === 'object');
    if (!variants || variants.length === 0) continue;
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
