// ---- Markdown renderer ----
function renderMd(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    try { return marked.parse(text, { breaks: true, gfm: true }); } catch(e) { /* fallback */ }
  }
  // minimal fallback if marked.js not loaded
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
}

// ---- State ----
let spec = null;
let routes = [];
let activeTags = new Set();

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ---- $ref resolution ----
function resolveRef(obj, root, seen) {
  if (!obj || typeof obj !== 'object') return obj;
  if (!seen) seen = new Set();
  if (obj.$ref) {
    const refPath = obj.$ref.replace(/^#\//, '').split('/');
    let resolved = root;
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
  const result = {};
  for (const [k, v] of Object.entries(obj)) result[k] = resolveRef(v, root, new Set(seen));
  return result;
}

// Resolve effective schema: merge allOf, unwrap anyOf/type-array nullable
function resolveEffectiveSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema || {};
  let s = schema;
  // Merge allOf into a flat object
  if (s.allOf) {
    let merged = {};
    for (const part of s.allOf) Object.assign(merged, part);
    for (const [k, v] of Object.entries(s)) { if (k !== 'allOf') merged[k] = v; }
    s = merged;
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
  s._nullable = nullable;
  return s;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function highlightJson(str) {
  return str.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b|\b(?:true|false)\b|\bnull\b|[{}[\],:]|[^"{}[\],:\s]+/g,
    (m, strMatch, colon) => {
      const e = m.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (strMatch) {
        const eStr = strMatch.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if (colon) return `<span class="jt-key">${eStr}</span>${colon}`;
        return `<span class="jt-str">${eStr}</span>`;
      }
      if (/^-?\d/.test(m)) return `<span class="jt-num">${e}</span>`;
      if (m === 'true' || m === 'false') return `<span class="jt-bool">${e}</span>`;
      if (m === 'null') return `<span class="jt-null">${e}</span>`;
      return e;
    }
  );
}

// Build a highlighted JSON editor (overlay textarea + pre)
function generateExample(schema, depth) {
  if (!schema) return null;
  if (!depth) depth = 0;
  if (depth > 15) return '...';
  if (schema._circular) return `[circular: ${schema._circular}]`;
  if (schema._unresolved) return `[unresolved: ${schema._unresolved}]`;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;

  if (schema.allOf) {
    let merged = {};
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
    type = type.find(t => t !== 'null') || type[0];
  }

  if (type === 'object' || schema.properties) {
    const obj = {};
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
// ---- Schema formatting (for copy) ----
// ---- Schema tree HTML renderer (used in Responses/Request Body display) ----
function renderSchemaTree(schema, maxDepth) {
  if (maxDepth === undefined) maxDepth = 12;
  if (!schema) return `<div class="schema-tree-empty">(no schema)</div>`;
  let html = `<div class="schema-tree">`;
  // Top header
  const topType = getTypeStr(schema);
  const topTitle = schema.title ? ` <code>(${esc(schema.title)})</code>` : '';
  const topDesc = schema.description ? ` — ${esc(schema.description)}` : '';
  html += `<div class="schema-tree-title">${esc(topType)}${topTitle}${topDesc}</div>`;
  // If the top-level schema has properties, render rows. Else show single row.
  const eff = resolveEffectiveSchema(schema);
  if (eff.properties || eff.type === 'object') {
    html += `<div class="schema-tree-header"><div>Field</div><div>Type</div><div>Description</div></div>`;
    html += renderSchemaRows(eff, maxDepth);
  } else if (eff.type === 'array' && eff.items) {
    html += `<div class="schema-tree-variant">array of ${esc(getTypeStr(eff.items))}</div>`;
    if (eff.items.properties || eff.items.type === 'object') {
      html += `<div class="schema-tree-header"><div>Field</div><div>Type</div><div>Description</div></div>`;
      html += renderSchemaRows(resolveEffectiveSchema(eff.items), maxDepth - 1);
    }
  } else if (eff.anyOf || eff.oneOf) {
    const variants = eff.anyOf || eff.oneOf;
    const label = eff.anyOf ? 'anyOf' : 'oneOf';
    for (let i = 0; i < variants.length; i++) {
      html += `<div class="schema-tree-variant">${label} #${i}: ${esc(getTypeStr(variants[i]))}</div>`;
      const ve = resolveEffectiveSchema(variants[i]);
      if (ve.properties) html += renderSchemaRows(ve, maxDepth - 1);
    }
  }
  html += `</div>`;
  return html;
}

// Render property rows for an object schema
function renderSchemaRows(schema, maxDepth) {
  if (maxDepth <= 0) return `<div class="schema-tree-row"><div class="schema-tree-name">...</div><div></div><div></div></div>`;
  if (!schema.properties) return '';
  const required = new Set(schema.required || []);
  let html = '';
  for (const [name, prop] of Object.entries(schema.properties)) {
    const ep = resolveEffectiveSchema(prop);
    const isReq = required.has(name);

    // Build type display
    let typeDisplay = esc(getTypeStr(prop));
    const constraints = getConstraints(ep);
    if (constraints) typeDisplay += `<span class="tree-constraint">${esc(constraints.trim())}</span>`;

    // Build description
    let descHtml = '';
    const d = prop.description || ep.description;
    if (d) descHtml = `<div class="md-content">${renderMd(d)}</div>`;

    html += `<div class="schema-tree-row">`;
    html += `<div class="schema-tree-name">${esc(name)}${isReq ? '<span class="required-mark">*</span>' : ''}</div>`;
    html += `<div class="schema-tree-type">${typeDisplay}</div>`;
    html += `<div class="schema-tree-desc">${descHtml}</div>`;
    html += `</div>`;

    // Recurse into nested structures
    const nested = renderNested(ep, maxDepth - 1);
    if (nested) {
      html += `<div class="schema-tree-row"><div class="schema-tree-nested">${nested}</div></div>`;
    }
  }
  return html;
}

// Render nested structure (object properties, array items, anyOf/oneOf variants)
function renderNested(schema, maxDepth) {
  if (maxDepth <= 0) return '';
  if (schema._circular) return `<div class="schema-tree-empty">[circular: ${esc(schema._circular)}]</div>`;

  // Object with properties → render child rows
  if (schema.properties) {
    return renderSchemaRows(schema, maxDepth);
  }
  // Array → recurse into items
  if (schema.type === 'array' && schema.items) {
    const items = resolveEffectiveSchema(schema.items);
    if (items.properties) {
      let h = `<div class="schema-tree-variant">items: ${esc(getTypeStr(schema.items))}</div>`;
      h += renderSchemaRows(items, maxDepth - 1);
      return h;
    }
    return '';
  }
  // anyOf/oneOf with non-trivial variants
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    const label = schema.anyOf ? 'anyOf' : 'oneOf';
    // Skip if already handled by resolveEffectiveSchema (nullable pattern)
    const nonNull = variants.filter(v => v.type !== 'null');
    if (nonNull.length <= 1) return '';
    let h = '';
    for (let i = 0; i < variants.length; i++) {
      h += `<div class="schema-tree-variant">${label} #${i}: ${esc(getTypeStr(variants[i]))}</div>`;
      const ve = resolveEffectiveSchema(variants[i]);
      if (ve.properties) h += renderSchemaRows(ve, maxDepth - 1);
    }
    return h;
  }
  return '';
}

function formatSchema(schema, indent, maxDepth) {
  if (!schema) return 'any';
  if (maxDepth <= 0) return '  '.repeat(indent) + '...';
  if (schema._circular) return '  '.repeat(indent) + `(circular: ${schema._circular})`;
  if (schema._unresolved) return '  '.repeat(indent) + `(unresolved: ${schema._unresolved})`;
  const pad = '  '.repeat(indent), pad1 = '  '.repeat(indent + 1);
  let lines = [];

  if (schema.allOf) {
    lines.push(`${pad}allOf:`);
    for (const sub of schema.allOf) lines.push(formatSchema(sub, indent + 1, maxDepth - 1));
    return lines.join('\n');
  }
  if (schema.anyOf) {
    lines.push(`${pad}anyOf:`);
    for (let i = 0; i < schema.anyOf.length; i++) { lines.push(`${pad1}#${i}:`); lines.push(formatSchema(schema.anyOf[i], indent + 2, maxDepth - 1)); }
    return lines.join('\n');
  }
  if (schema.oneOf) {
    lines.push(`${pad}oneOf:`);
    for (let i = 0; i < schema.oneOf.length; i++) { lines.push(`${pad1}#${i}:`); lines.push(formatSchema(schema.oneOf[i], indent + 2, maxDepth - 1)); }
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

function getTypeStr(schema) {
  if (!schema) return 'any';
  // OAS 3.1: type can be array like ["string", "null"]
  let t;
  if (Array.isArray(schema.type)) {
    t = schema.type.filter(x => x !== 'null').join(' | ') || 'any';
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

function getConstraints(prop) {
  const p = [];
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
