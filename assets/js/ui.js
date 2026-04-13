function applyFilter() { renderRoutes(); }
function renderRoutes() {
  const filter = document.getElementById('filterInput').value.toLowerCase();
  const c = document.getElementById('content'); c.innerHTML = '';
  const grouped = {};
  for (const r of routes) {
    if (activeTags.size > 0 && !r.tags.some(t => activeTags.has(t))) continue;
    if (filter) {
      const h = `${r.method} ${r.path} ${r.summary} ${r.description} ${r.tags.join(' ')} ${r.operationId}`.toLowerCase();
      if (!h.includes(filter)) continue;
    }
    const tag = r.tags[0] || '未分组';
    if (!grouped[tag]) grouped[tag] = [];
    grouped[tag].push(r);
  }

  for (const [tag, items] of Object.entries(grouped)) {
    const group = document.createElement('div'); group.className = 'route-group';
    const idxList = items.map(r => routes.indexOf(r));
    const groupId = `grp-${idxList[0]}`;
    group.innerHTML = `<h2><input type="checkbox" class="group-check" id="${groupId}" onclick="toggleGroup('${groupId}', [${idxList}])"><span>${esc(tag)}</span></h2>`;
    // Set initial tri-state
    const selCount = items.filter(r => r.selected).length;
    const cb = group.querySelector('.group-check');
    if (selCount === items.length) { cb.checked = true; cb.indeterminate = false; }
    else if (selCount > 0) { cb.checked = false; cb.indeterminate = true; }
    for (const r of items) {
      const idx = routes.indexOf(r);
      const card = document.createElement('div');
      card.className = 'route-card' + (r.selected ? ' selected' : '');
      card.id = 'card-' + idx;
      card.innerHTML = buildCardHeaderHTML(r, idx);

      // Header click -> lazy build detail then expand
      card.querySelector('.route-header').addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        ensureCardDetail(card, r, idx);
        card.classList.toggle('expanded');
      });

      group.appendChild(card);
    }
    c.appendChild(group);
  }
  updateCount();
}

// Lazily build route detail (tabs + panes) on first expand
function ensureCardDetail(card, r, idx) {
  if (card._detailBuilt) return;
  card._detailBuilt = true;
  const detail = card.querySelector('.route-detail');
  detail.innerHTML = buildCardHTML(r, idx);

  // Tab switching
  detail.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      detail.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
      detail.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      detail.querySelector(`.detail-pane[data-pane="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Init JSON editor + form sync if requestBody exists
  if (r.requestBody) {
    initJsonEditor(`body-${idx}`);
    initBodyFormSync(idx);
  }
}

function buildCardHTML(r, idx) {
  // Description tab content
  let descHtml = '';
  if (r.summary) descHtml += `<h3>${esc(r.summary)}</h3>`;
  if (r.description) descHtml += `<div class="md-content">${renderMd(r.description)}</div>`;
  if (r.operationId) descHtml += `<p style="margin-top:8px;font-size:12px;color:var(--text2)">Operation ID: <code>${esc(r.operationId)}</code></p>`;

  // Parameters display for description tab
  if (r.parameters?.length) {
    descHtml += `<h4 style="margin-top:12px;color:var(--accent);font-size:13px;">Parameters</h4>`;
    descHtml += `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;">`;
    descHtml += `<tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:4px 8px;color:var(--text2);">Name</th><th style="text-align:left;padding:4px 8px;color:var(--text2);">In</th><th style="text-align:left;padding:4px 8px;color:var(--text2);">Type</th><th style="text-align:left;padding:4px 8px;color:var(--text2);">Description</th></tr>`;
    for (const p of r.parameters) {
      const ptype = p.schema ? getTypeStr(p.schema) : 'string';
      descHtml += `<tr style="border-bottom:1px solid var(--border);">`;
      descHtml += `<td style="padding:4px 8px;font-weight:600;">${esc(p.name)}${p.required ? ' <span style="color:#f85149;">*</span>' : ''}</td>`;
      descHtml += `<td style="padding:4px 8px;color:var(--text2);">${esc(p.in)}</td>`;
      descHtml += `<td style="padding:4px 8px;"><code>${esc(ptype)}</code></td>`;
      descHtml += `<td style="padding:4px 8px;" class="md-content">${p.description ? renderMd(p.description) : ''}</td>`;
      descHtml += `</tr>`;
    }
    descHtml += `</table>`;
  }

  // Request body schema display
  if (r.requestBody) {
    descHtml += `<h4 style="margin-top:12px;color:var(--accent);font-size:13px;">Request Body${r.requestBody.required ? ' <span style="color:#f85149;">(required)</span>' : ''}</h4>`;
    if (r.requestBody.description) descHtml += `<div class="md-content" style="font-size:13px;">${renderMd(r.requestBody.description)}</div>`;
    const content = r.requestBody.content || {};
    for (const [mt, mo] of Object.entries(content)) {
      descHtml += `<p style="font-size:12px;color:var(--text2);margin:4px 0;">Content-Type: ${esc(mt)}</p>`;
      if (mo.schema) descHtml += renderSchemaTree(mo.schema);
    }
  }

  // Responses display
  descHtml += `<h4 style="margin-top:12px;color:var(--accent);font-size:13px;">Responses</h4>`;
  for (const [code, resp] of Object.entries(r.responses)) {
    const codeColor = code.startsWith('2') ? 'var(--get)' : code.startsWith('4') ? 'var(--patch)' : code.startsWith('5') ? 'var(--delete)' : 'var(--text2)';
    descHtml += `<div style="margin-top:10px;">`;
    descHtml += `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;"><span style="font-weight:700;font-size:14px;color:${codeColor};">${esc(code)}</span>`;
    if (resp.description) descHtml += `<span class="md-content" style="font-size:13px;">${renderMd(resp.description)}</span>`;
    descHtml += `</div>`;
    const content = resp.content || {};
    for (const [mt, mo] of Object.entries(content)) {
      descHtml += `<p style="font-size:12px;color:var(--text2);margin:4px 0;">Content-Type: ${esc(mt)}</p>`;
      if (mo.schema) descHtml += renderSchemaTree(mo.schema);
    }
    descHtml += `</div>`;
  }

  // Try-it tab content
  let tryHtml = buildTryItHTML(r, idx);

  // Schema (copy preview) tab
  let schemaHtml = `<div class="schema-block">${esc(formatRoute(r))}</div>`;
  schemaHtml += `<div style="margin-top:8px;display:flex;gap:8px;">`;
  schemaHtml += `<button class="btn btn-sm btn-accent" onclick="copySingle(${idx})">复制此路由</button>`;
  schemaHtml += `</div>`;

  return `
    <div class="detail-tabs">
      <button class="detail-tab active" data-tab="desc">文档</button>
      <button class="detail-tab" data-tab="try">测试</button>
      <button class="detail-tab" data-tab="schema">Schema (复制预览)</button>
    </div>
    <div class="detail-pane active" data-pane="desc">${descHtml}</div>
    <div class="detail-pane" data-pane="try">${tryHtml}</div>
    <div class="detail-pane" data-pane="schema">${schemaHtml}</div>`;
}

// Cheap header - always rendered
function buildCardHeaderHTML(r, idx) {
  return `
    <div class="route-header">
      <input type="checkbox" class="route-check" ${r.selected ? 'checked' : ''} onchange="toggleRoute(${idx}, this.checked)" onclick="event.stopPropagation()">
      <span class="method-badge method-${r.method}">${r.method}</span>
      <span class="route-path">${esc(r.path)}</span>
      <span class="route-summary">${esc(r.summary || r.description).substring(0, 80)}</span>
      <button class="route-copy-btn" onclick="event.stopPropagation(); copySingle(${idx})">复制</button>
    </div>
    <div class="route-detail"></div>`;
}

// ---- Try-it panel ----
function buildTryItHTML(r, idx) {
  let html = '';

  // Parameters form
  if (r.parameters?.length) {
    html += `<div class="try-section"><h4>Parameters</h4><div class="param-grid">`;
    for (const p of r.parameters) {
      const id = `param-${idx}-${p.name}`;
      html += `<div class="param-name">${esc(p.name)}${p.required ? ' <span class="param-required">*</span>' : ''}</div>`;
      html += `<div class="param-in">${esc(p.in)}</div>`;

      // Resolve effective schema (handle anyOf/allOf nullable, merge allOf)
      let ps = resolveEffectiveSchema(p.schema || {});
      let psNullable = ps._nullable || false;

      const defVal = ps.default !== undefined ? String(ps.default) : '';
      const ph = getTypeStr(p.schema || {}) || 'string';
      // Constraint hints for display
      const constraints = getConstraints(ps);

      if (ps.enum) {
        html += `<div class="schema-field-select-wrap">`;
        html += `<select id="${id}">`;
        if (psNullable) html += `<option value="">null</option>`;
        else if (!p.required) html += `<option value="">(空)</option>`;
        for (const v of ps.enum) html += `<option value="${esc(String(v))}" ${ps.default === v ? 'selected' : ''}>${esc(String(v))}</option>`;
        html += `</select>`;
        if (psNullable) html += `<button type="button" class="field-clear-btn" onclick="this.previousElementSibling.value=''" title="清除为 null">✕</button>`;
        html += `</div>`;
      } else if (ps.type === 'boolean') {
        html += `<select id="${id}">`;
        if (!p.required || psNullable) html += `<option value="">${psNullable ? 'null' : '(空)'}</option>`;
        html += `<option value="true"${defVal === 'true' ? ' selected' : ''}>true</option>`;
        html += `<option value="false"${defVal === 'false' ? ' selected' : ''}>false</option>`;
        html += `</select>`;
      } else if (ps.type === 'integer') {
        let attrs = `step="1"`;
        if (ps.minimum !== undefined) attrs += ` min="${ps.minimum}"`;
        if (ps.maximum !== undefined) attrs += ` max="${ps.maximum}"`;
        html += `<input type="number" id="${id}" value="${esc(defVal)}" placeholder="${esc(ph)}" ${attrs}>`;
      } else if (ps.type === 'number') {
        let attrs = `step="any"`;
        if (ps.minimum !== undefined) attrs += ` min="${ps.minimum}"`;
        if (ps.maximum !== undefined) attrs += ` max="${ps.maximum}"`;
        html += `<input type="number" id="${id}" value="${esc(defVal)}" placeholder="${esc(ph)}" ${attrs}>`;
      } else if (ps.format === 'date-time') {
        html += `<div class="schema-field-input-group">`;
        html += `<input type="datetime-local" id="${id}" value="${esc(defVal)}" placeholder="${esc(ph)}">`;
        html += `<button type="button" class="field-action-btn" onclick="document.getElementById('${id}').value=''" title="清除">✕</button>`;
        html += `</div>`;
      } else if (ps.format === 'date') {
        html += `<div class="schema-field-input-group">`;
        html += `<input type="date" id="${id}" value="${esc(defVal)}" placeholder="${esc(ph)}">`;
        html += `<button type="button" class="field-action-btn" onclick="document.getElementById('${id}').value=''" title="清除">✕</button>`;
        html += `</div>`;
      } else if (ps.format === 'email') {
        html += `<input type="email" id="${id}" value="${esc(defVal)}" placeholder="user@example.com">`;
      } else if (ps.format === 'uri' || ps.format === 'url') {
        html += `<input type="url" id="${id}" value="${esc(defVal)}" placeholder="https://example.com">`;
      } else if (ps.format === 'uuid') {
        html += `<div class="schema-field-input-group">`;
        html += `<input type="text" id="${id}" value="${esc(defVal)}" placeholder="UUID">`;
        html += `<button type="button" class="field-action-btn" onclick="document.getElementById('${id}').value=crypto.randomUUID()">随机</button>`;
        html += `</div>`;
      } else {
        let strAttrs = '';
        if (ps.minLength !== undefined) strAttrs += ` minlength="${ps.minLength}"`;
        if (ps.maxLength !== undefined) strAttrs += ` maxlength="${ps.maxLength}"`;
        if (ps.pattern) strAttrs += ` pattern="${esc(ps.pattern)}"`;
        html += `<input type="text" id="${id}" value="${esc(defVal)}" placeholder="${esc(ph)}"${strAttrs}>`;
      }
      html += `<div class="param-constraints">${constraints ? esc(constraints) : ''}</div>`;
    }
    html += `</div></div>`;
  }

  // Request body editor - schema form + JSON preview
  if (r.requestBody) {
    const content = r.requestBody.content || {};
    const contentTypes = Object.keys(content);
    const selectedCt = contentTypes[0] || 'application/json';

    html += `<div class="try-section">`;
    html += `<h4>Request Body`;
    // Example/Schema toggle
    html += `<span class="body-view-toggle">`;
    html += `<button class="active" onclick="toggleBodyView(${idx},'example',this)">示例</button>`;
    html += `<button onclick="toggleBodyView(${idx},'schema',this)">Schema</button>`;
    html += `</span>`;
    html += `</h4>`;

    // Content-Type selector
    if (contentTypes.length > 1) {
      html += `<select id="ct-${idx}" class="ct-select" onchange="switchContentType(${idx})">`;
      for (const ct of contentTypes) {
        html += `<option value="${esc(ct)}">${esc(ct)}</option>`;
      }
      html += `</select>`;
    } else if (contentTypes.length === 1) {
      html += `<input type="hidden" id="ct-${idx}" value="${esc(selectedCt)}">`;
    }

    // Body editor container (swappable by switchContentType)
    html += `<div id="body-editor-${idx}" data-body-view="example">`;
    html += buildBodyEditorHTML(idx, selectedCt, content);
    html += `</div>`;

    // Schema view (hidden by default)
    const schemaForView = content[selectedCt]?.schema;
    html += `<div id="body-schema-${idx}" style="display:none;">`;
    html += `<div class="schema-block">${schemaForView ? esc(formatSchema(schemaForView, 0, 8)) : '(no schema)'}</div>`;
    html += `</div>`;

    html += `</div>`;
  }

  // Send button + response area
  html += `<div class="try-actions">`;
  html += `<button class="btn btn-primary" onclick="sendRequest(${idx})">发送请求</button>`;
  html += `<span id="req-status-${idx}" style="font-size:12px;color:var(--text2);"></span>`;
  html += `</div>`;
  html += `<div id="response-${idx}"></div>`;
  return html;
}

// Build body editor HTML for a given content type
function buildBodyEditorHTML(idx, ct, content) {
  const schema = content[ct]?.schema;
  if (ct === 'multipart/form-data' || ct === 'application/x-www-form-urlencoded') {
    return buildFormdataFields(idx, schema);
  }
  // Default: JSON editor
  const example = schema ? generateExample(schema) : {};
  const jsonStr = JSON.stringify(example, null, 2);
  let html = '';
  if (schema && (schema.type === 'object' || schema.properties)) {
    html += `<div class="body-split">`;
    html += `<div class="body-form">${buildSchemaFormFields(schema, `bf-${idx}`, [], null)}</div>`;
    html += `<div class="body-preview">`;
    html += `<div class="body-preview-label"><span>JSON 预览</span><span class="body-preview-sync-hint">可直接编辑</span></div>`;
    html += buildJsonEditorHTML(`body-${idx}`, jsonStr);
    html += `</div></div>`;
  } else {
    html += buildJsonEditorHTML(`body-${idx}`, jsonStr);
  }
  return html;
}

// Build formdata/urlencoded form fields
function buildFormdataFields(idx, schema) {
  if (!schema?.properties) return '<p style="color:var(--text2);font-size:13px;">无 Schema 定义</p>';
  const required = new Set(schema.required || []);
  let html = `<div class="formdata-grid" id="formdata-${idx}">`;
  for (const [key, prop] of Object.entries(schema.properties)) {
    const ep = resolveEffectiveSchema(prop);
    const isReq = required.has(key);
    const typeStr = getTypeStr(prop);
    html += `<div class="param-name">${esc(key)}${isReq ? ' <span class="param-required">*</span>' : ''}</div>`;
    html += `<div class="param-in">${esc(typeStr)}</div>`;

    const fieldId = `fd-${idx}-${key}`;
    // File input for binary/base64 format or type file
    if (ep.format === 'binary' || ep.format === 'base64' || ep.type === 'file') {
      html += `<input type="file" id="${fieldId}" data-fd-field="${esc(key)}">`;
    } else if (ep.type === 'boolean') {
      html += `<select id="${fieldId}" data-fd-field="${esc(key)}">`;
      if (!isReq) html += `<option value="">(空)</option>`;
      html += `<option value="true">true</option><option value="false">false</option></select>`;
    } else if (ep.enum) {
      html += `<select id="${fieldId}" data-fd-field="${esc(key)}">`;
      if (!isReq) html += `<option value="">(空)</option>`;
      for (const v of ep.enum) html += `<option value="${esc(String(v))}">${esc(String(v))}</option>`;
      html += `</select>`;
    } else if (ep.type === 'integer' || ep.type === 'number') {
      const def = ep.default !== undefined ? ep.default : '';
      html += `<input type="number" id="${fieldId}" data-fd-field="${esc(key)}" value="${esc(String(def))}" placeholder="${esc(typeStr)}" step="${ep.type === 'integer' ? '1' : 'any'}">`;
    } else {
      const def = ep.default !== undefined ? String(ep.default) : '';
      html += `<input type="text" id="${fieldId}" data-fd-field="${esc(key)}" value="${esc(def)}" placeholder="${esc(typeStr)}">`;
    }
  }
  html += `</div>`;
  return html;
}

// Switch content type for request body
function switchContentType(idx) {
  const r = routes[idx];
  const ct = document.getElementById(`ct-${idx}`)?.value || 'application/json';
  const content = r.requestBody?.content || {};
  const container = document.getElementById(`body-editor-${idx}`);
  if (!container) return;
  container.innerHTML = buildBodyEditorHTML(idx, ct, content);

  // Re-init JSON editor and form sync if JSON mode
  if (ct !== 'multipart/form-data' && ct !== 'application/x-www-form-urlencoded') {
    initJsonEditor(`body-${idx}`);
    initBodyFormSync(idx);
  }

  // Update schema view
  const schemaView = document.getElementById(`body-schema-${idx}`);
  if (schemaView) {
    const schema = content[ct]?.schema;
    schemaView.innerHTML = `<div class="schema-block">${schema ? esc(formatSchema(schema, 0, 15)) : '(no schema)'}</div>`;
  }
}

// Toggle between example and schema view for request body
function toggleBodyView(idx, view, btn) {
  const editorEl = document.getElementById(`body-editor-${idx}`);
  const schemaEl = document.getElementById(`body-schema-${idx}`);
  if (!editorEl || !schemaEl) return;

  // Update button states
  const toggle = btn.parentElement;
  toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (view === 'schema') {
    editorEl.style.display = 'none';
    schemaEl.style.display = '';
  } else {
    editorEl.style.display = '';
    schemaEl.style.display = 'none';
  }
}

// Build schema-based form fields
// JSON syntax highlighting (single-pass tokenizer)
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
function buildJsonEditorHTML(id, json) {
  return `<div class="json-editor-wrap">` +
    `<pre class="json-highlight" id="${id}-hl">${highlightJson(json)}</pre>` +
    `<textarea class="json-editor-input" id="${id}">${esc(json)}</textarea>` +
    `</div>`;
}

// Sync textarea → highlight pre
function initJsonEditor(id) {
  const ta = document.getElementById(id);
  const pre = document.getElementById(id + '-hl');
  if (!ta || !pre) return;
  const sync = () => {
    pre.innerHTML = highlightJson(ta.value);
  };
  ta.addEventListener('input', sync);
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
}

function buildSchemaFormFields(schema, prefix, path, route) {
  if (!schema || (!schema.properties && schema.type !== 'object')) return '';
  let html = '';
  const required = schema.required || [];
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const fieldId = `${prefix}-${path.concat(key).join('-')}`;
    const fieldPath = path.concat(key).join('.');
    const isRequired = required.includes(key);
    const typeStr = getTypeStr(prop);
    const desc = prop.description || '';

    html += `<div class="schema-field">`;
    // Resolve effective prop (handle allOf merge + anyOf nullable)
    let effectiveProp = resolveEffectiveSchema(prop);
    let isNullable = effectiveProp._nullable || false;
    const propConstraints = getConstraints(effectiveProp);
    const effDesc = effectiveProp.description || desc;

    html += `<div class="schema-field-label">`;
    html += `<span class="field-name">${esc(key)}</span>`;
    html += `<span class="field-type">${esc(typeStr)}</span>`;
    if (isRequired) html += `<span class="field-required">必填</span>`;
    if (propConstraints) html += `<span class="param-constraints">${esc(propConstraints)}</span>`;
    if (effDesc) html += `<span class="field-desc" title="${esc(effDesc)}">${esc(effDesc)}</span>`;
    html += `</div>`;

    if (effectiveProp.enum) {
      html += `<div class="schema-field-select-wrap">`;
      html += `<select id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="enum">`;
      if (isNullable) html += `<option value="">null</option>`;
      else if (!isRequired) html += `<option value="">(空)</option>`;
      for (const v of effectiveProp.enum) {
        const sel = (effectiveProp.default === v || (!effectiveProp.default && !isNullable && effectiveProp.enum[0] === v)) ? ' selected' : '';
        html += `<option value="${esc(String(v))}"${sel}>${esc(String(v))}</option>`;
      }
      html += `</select>`;
      if (isNullable) html += `<button type="button" class="field-clear-btn" data-clear-target="${fieldId}" title="清除为 null">✕</button>`;
      html += `</div>`;
    } else if (effectiveProp.type === 'boolean') {
      const def = effectiveProp.default === true;
      html += `<div class="schema-field-bool">`;
      html += `<div class="bool-toggle${def ? ' active' : ''}" id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="boolean" data-value="${def}"></div>`;
      html += `<span class="bool-value">${def}</span>`;
      html += `</div>`;
    } else if (effectiveProp.type === 'object' || effectiveProp.properties) {
      html += `<div class="schema-field-nested">`;
      html += buildSchemaFormFields(effectiveProp, prefix, path.concat(key), route);
      html += `</div>`;
    } else if (effectiveProp.type === 'array') {
      const example = generateExample(effectiveProp);
      html += `<textarea id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="json" rows="3">${esc(JSON.stringify(example, null, 2))}</textarea>`;
    } else if (effectiveProp.type === 'integer' || effectiveProp.type === 'number') {
      const def = effectiveProp.default !== undefined ? effectiveProp.default : (effectiveProp.minimum !== undefined ? effectiveProp.minimum : '');
      const step = effectiveProp.type === 'integer' ? '1' : 'any';
      let attrs = `step="${step}"`;
      if (effectiveProp.minimum !== undefined) attrs += ` min="${effectiveProp.minimum}"`;
      if (effectiveProp.maximum !== undefined) attrs += ` max="${effectiveProp.maximum}"`;
      html += `<input type="number" id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="${effectiveProp.type}" value="${esc(String(def))}" placeholder="${esc(typeStr)}" ${attrs}>`;
    } else {
      // string types
      let inputType = 'text';
      let def = effectiveProp.default !== undefined ? String(effectiveProp.default) : '';
      const fmt = effectiveProp.format;
      if (fmt === 'email') inputType = 'email';
      else if (fmt === 'uri' || fmt === 'url') inputType = 'url';
      else if (fmt === 'date') inputType = 'date';
      else if (fmt === 'date-time') inputType = 'datetime-local';

      let placeholder = typeStr;
      if (fmt === 'uuid') placeholder = 'UUID';
      else if (fmt === 'email') placeholder = 'user@example.com';
      else if (fmt === 'uri' || fmt === 'url') placeholder = 'https://example.com';

      // String constraint attrs
      let strAttrs = '';
      if (effectiveProp.minLength !== undefined) strAttrs += ` minlength="${effectiveProp.minLength}"`;
      if (effectiveProp.maxLength !== undefined) strAttrs += ` maxlength="${effectiveProp.maxLength}"`;
      if (effectiveProp.pattern) strAttrs += ` pattern="${esc(effectiveProp.pattern)}"`;

      if (fmt === 'uuid') {
        html += `<div class="schema-field-input-group">`;
        html += `<input type="text" id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="string" value="${esc(def)}" placeholder="${esc(placeholder)}"${strAttrs}>`;
        html += `<button type="button" class="field-action-btn" data-uuid-target="${fieldId}">随机</button>`;
        html += `</div>`;
      } else if (fmt === 'date-time' || fmt === 'date') {
        html += `<div class="schema-field-input-group">`;
        html += `<input type="${inputType}" id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="string" value="${esc(def)}" placeholder="${esc(placeholder)}"${strAttrs}>`;
        html += `<button type="button" class="field-action-btn" data-clear-input="${fieldId}">✕</button>`;
        html += `</div>`;
      } else {
        html += `<input type="${inputType}" id="${fieldId}" data-field-path="${esc(fieldPath)}" data-field-type="string" value="${esc(def)}" placeholder="${esc(placeholder)}"${strAttrs}>`;
      }
    }

    html += `</div>`;
  }
  return html;
}

// Initialize body form sync (called after card HTML is inserted)
function initBodyFormSync(idx) {
  const card = document.querySelector(`#body-${idx}`)?.closest('.try-section');
  if (!card) return;
  const formEl = card.querySelector('.body-form');
  const previewEl = document.getElementById(`body-${idx}`);
  if (!formEl || !previewEl) return;

  let syncing = false;

  function formToJson() {
    let obj;
    try { obj = JSON.parse(previewEl.value); } catch { obj = {}; }
    formEl.querySelectorAll('[data-field-path]').forEach(el => {
      const path = el.dataset.fieldPath.split('.');
      const type = el.dataset.fieldType;
      let val;
      if (type === 'boolean') {
        val = el.dataset.value === 'true';
      } else if (type === 'integer') {
        val = el.value === '' ? 0 : parseInt(el.value, 10);
      } else if (type === 'number') {
        val = el.value === '' ? 0 : parseFloat(el.value);
      } else if (type === 'json') {
        try { val = JSON.parse(el.value); } catch { val = el.value; }
      } else if (type === 'enum' && el.value === '') {
        // nullable enum → null
        val = null;
      } else {
        val = el.value;
      }
      // Set nested path
      let cur = obj;
      for (let i = 0; i < path.length - 1; i++) {
        if (cur[path[i]] === undefined || typeof cur[path[i]] !== 'object') cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = val;
    });
    return obj;
  }

  function syncFormToPreview() {
    if (syncing) return;
    syncing = true;
    previewEl.value = JSON.stringify(formToJson(), null, 2);
    // Update highlight
    const hlEl = document.getElementById(`body-${idx}-hl`);
    if (hlEl) hlEl.innerHTML = highlightJson(previewEl.value);
    syncing = false;
  }

  function syncPreviewToForm() {
    if (syncing) return;
    syncing = true;
    try {
      const obj = JSON.parse(previewEl.value);
      formEl.querySelectorAll('[data-field-path]').forEach(el => {
        const path = el.dataset.fieldPath.split('.');
        const type = el.dataset.fieldType;
        let val = obj;
        for (const p of path) { val = val?.[p]; }
        if (val === undefined) return;
        if (type === 'boolean') {
          el.dataset.value = String(!!val);
          el.classList.toggle('active', !!val);
          el.nextElementSibling.textContent = String(!!val);
        } else if (type === 'json') {
          el.value = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
        } else if (type === 'enum' && val === null) {
          el.value = '';
        } else {
          el.value = String(val);
        }
      });
    } catch {}
    syncing = false;
  }

  // Bind form inputs → preview
  formEl.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', syncFormToPreview);
    el.addEventListener('change', syncFormToPreview);
  });

  // Bind boolean toggles
  formEl.querySelectorAll('.bool-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const newVal = el.dataset.value !== 'true';
      el.dataset.value = String(newVal);
      el.classList.toggle('active', newVal);
      el.nextElementSibling.textContent = String(newVal);
      syncFormToPreview();
    });
  });

  // Bind UUID generate buttons
  formEl.querySelectorAll('[data-uuid-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.uuidTarget);
      if (target) {
        target.value = crypto.randomUUID();
        syncFormToPreview();
      }
    });
  });

  // Bind clearable select buttons
  formEl.querySelectorAll('[data-clear-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.clearTarget);
      if (target) {
        target.value = '';
        syncFormToPreview();
      }
    });
  });

  // Bind clear input buttons (date-time, date)
  formEl.querySelectorAll('[data-clear-input]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.clearInput);
      if (target) {
        target.value = '';
        syncFormToPreview();
      }
    });
  });

  // Bind preview → form
  previewEl.addEventListener('input', syncPreviewToForm);

  // Initial sync: form → preview
  syncFormToPreview();
}
