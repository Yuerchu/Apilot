export function resolveRef(obj: any, root: any, seen?: Set<string>): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (!seen) seen = new Set();
  if (obj.$ref) {
    const refPath = (obj.$ref as string).replace(/^#\//, '').split('/');
    let resolved: any = root;
    for (const p of refPath) resolved = resolved?.[decodeURIComponent(p)];
    if (!resolved) return { _unresolved: obj.$ref };
    if (seen.has(obj.$ref)) return { _circular: obj.$ref };
    seen.add(obj.$ref);
    const resolvedObj = resolveRef(resolved, root, seen);
    // OAS 3.1: preserve sibling keywords alongside $ref (description, summary, etc.)
    const siblings = Object.keys(obj).filter(k => k !== '$ref');
    if (siblings.length && typeof resolvedObj === 'object' && !Array.isArray(resolvedObj)) {
      const merged = { ...resolvedObj };
      for (const k of siblings) merged[k] = obj[k];
      return merged;
    }
    return resolvedObj;
  }
  if (Array.isArray(obj)) return obj.map(item => resolveRef(item, root, new Set(seen)));
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) result[k] = resolveRef(v, root, new Set(seen));
  return result;
}
