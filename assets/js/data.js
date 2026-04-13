// ---- Render routes ----
// ---- Main view switching (Endpoints / Data Models) ----
let _modelsRendered = false;
let _selectedModels = new Set(); // set of model names
function switchMainView(view) {
  document.querySelectorAll('.main-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });
  const showEndpoints = view === 'endpoints';
  document.getElementById('toolbar').style.display = showEndpoints ? '' : 'none';
  document.getElementById('tagBar').style.display = showEndpoints ? '' : 'none';
  document.getElementById('content').style.display = showEndpoints ? '' : 'none';
  document.getElementById('modelsView').style.display = showEndpoints ? 'none' : '';
  if (!showEndpoints && !_modelsRendered) {
    renderDataModels();
    _modelsRendered = true;
  }
  // Toggle both FABs based on current view
  updateCount();
  updateModelSelCount();
}

// ---- Data Models view ----
function renderDataModels() {
  const schemas = spec.components?.schemas || spec.definitions || {};
  const list = document.getElementById('modelsList');
  list.innerHTML = '';
  const names = Object.keys(schemas).sort();
  document.getElementById('modelCount').textContent = `${names.length} 个模型`;

  for (const name of names) {
    const schema = schemas[name];
    const card = document.createElement('div');
    card.className = 'model-card' + (_selectedModels.has(name) ? ' selected' : '');
    card.dataset.name = name.toLowerCase();
    card.dataset.modelName = name;

    const typeStr = getTypeStr(schema);
    const desc = schema.description || schema.title || '';
    const checked = _selectedModels.has(name) ? 'checked' : '';

    const header = document.createElement('div');
    header.className = 'model-header';
    header.innerHTML = `
      <input type="checkbox" class="model-check" ${checked} onclick="event.stopPropagation()">
      <span class="model-arrow">&#9654;</span>
      <span class="model-name">${esc(name)}</span>
      <span class="model-type-badge">${esc(typeStr)}</span>
      ${desc ? `<span class="model-desc">${esc(desc)}</span>` : ''}
      <button class="model-copy-btn" onclick="event.stopPropagation(); copySingleModel('${esc(name).replace(/'/g, "\\'")}')">复制</button>
    `;

    const body = document.createElement('div');
    body.className = 'model-body';

    // Checkbox change → update selection
    const cb = header.querySelector('.model-check');
    cb.addEventListener('change', () => {
      if (cb.checked) _selectedModels.add(name);
      else _selectedModels.delete(name);
      card.classList.toggle('selected', cb.checked);
      updateModelSelCount();
    });

    header.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      if (!body._built) {
        const resolved = resolveRef(schema, spec, new Set());
        body.innerHTML = renderSchemaTree(resolved);
        body._built = true;
      }
      card.classList.toggle('expanded');
    });

    card.appendChild(header);
    card.appendChild(body);
    list.appendChild(card);
  }
  updateModelSelCount();
}

function applyModelFilter() {
  const q = document.getElementById('modelFilterInput').value.toLowerCase().trim();
  document.querySelectorAll('#modelsList .model-card').forEach(card => {
    card.style.display = (!q || card.dataset.name.includes(q)) ? '' : 'none';
  });
}

function updateModelSelCount() {
  const n = _selectedModels.size;
  document.getElementById('modelSelCount').textContent = n > 0 ? `已选 ${n} 个` : '';
  // Update master checkbox state
  const master = document.getElementById('modelSelectAll');
  const schemas = spec?.components?.schemas || spec?.definitions || {};
  const total = Object.keys(schemas).length;
  if (master) {
    if (n === 0) { master.checked = false; master.indeterminate = false; }
    else if (n === total) { master.checked = true; master.indeterminate = false; }
    else { master.checked = false; master.indeterminate = true; }
  }
  // Update models FAB (only show in models view)
  document.getElementById('modelsFabCount').textContent = n;
  const inModelsView = document.getElementById('modelsView').style.display !== 'none';
  document.getElementById('modelsFab').classList.toggle('show', n > 0 && inModelsView);
}

function clearModelSelection() {
  _selectedModels.clear();
  document.querySelectorAll('#modelsList .model-card').forEach(card => {
    const cb = card.querySelector('.model-check');
    if (cb) cb.checked = false;
    card.classList.remove('selected');
  });
  updateModelSelCount();
}

function toggleModelSelectAll() {
  const checked = document.getElementById('modelSelectAll').checked;
  const schemas = spec?.components?.schemas || spec?.definitions || {};
  _selectedModels.clear();
  if (checked) {
    for (const name of Object.keys(schemas)) _selectedModels.add(name);
  }
  document.querySelectorAll('#modelsList .model-card').forEach(card => {
    const name = card.dataset.modelName;
    const cb = card.querySelector('.model-check');
    const isSel = _selectedModels.has(name);
    if (cb) cb.checked = isSel;
    card.classList.toggle('selected', isSel);
  });
  updateModelSelCount();
}

function formatModel(name, schema) {
  const resolved = resolveRef(schema, spec, new Set());
  const typeStr = getTypeStr(resolved);
  const desc = resolved.description || resolved.title || '';
  let out = `## ${name}\n`;
  if (desc) out += `${desc}\n`;
  out += `Type: ${typeStr}\n\n`;
  out += `Schema:\n${formatSchema(resolved, 0, 15)}\n`;
  return out;
}

function copySingleModel(name) {
  const schemas = spec.components?.schemas || spec.definitions || {};
  const schema = schemas[name];
  if (!schema) return;
  navigator.clipboard.writeText(formatModel(name, schema)).then(() => showToast('已复制到剪贴板'));
}

function copySelectedModels() {
  if (_selectedModels.size === 0) { showToast('请先选择数据模型'); return; }
  const schemas = spec.components?.schemas || spec.definitions || {};
  const parts = [];
  for (const name of _selectedModels) {
    if (schemas[name]) parts.push(formatModel(name, schemas[name]));
  }
  const text = parts.join('\n---\n\n');
  navigator.clipboard.writeText(text).then(() => showToast(`已复制 ${_selectedModels.size} 个数据模型`));
}

// ---- Copy formatting ----
function formatRoute(r) {
  const fmt = document.querySelector('input[name="format"]:checked')?.value || 'markdown';
  const incEx = document.getElementById('includeExamples')?.checked;
  return fmt === 'markdown' ? formatMarkdown(r, incEx) : formatYaml(r, incEx);
}

function formatMarkdown(r, includeExamples) {
  let out = `## ${r.method.toUpperCase()} ${r.path}\n`;
  if (r.summary) out += `${r.summary}\n`;
  if (r.description && r.description !== r.summary) out += `${r.description}\n`;
  if (r.operationId) out += `Operation ID: ${r.operationId}\n`;
  if (r.parameters?.length) {
    out += `\n### Parameters\n`;
    for (const p of r.parameters) {
      const req = p.required ? ' (required)' : '';
      const ptype = p.schema ? getTypeStr(p.schema) : (p.type || 'string');
      const desc = p.description ? ` — ${p.description}` : '';
      out += `- ${p.name}${req}: ${ptype}, in: ${p.in}${desc}\n`;
      if (p.schema?.enum) out += `  enum: [${p.schema.enum.join(', ')}]\n`;
      if (p.schema?.default !== undefined) out += `  default: ${JSON.stringify(p.schema.default)}\n`;
    }
  }
  if (r.requestBody) {
    out += `\n### Request Body${r.requestBody.required ? ' (required)' : ''}\n`;
    if (r.requestBody.description) out += `${r.requestBody.description}\n`;
    for (const [mt, mo] of Object.entries(r.requestBody.content || {})) {
      out += `\nContent-Type: ${mt}\n`;
      if (mo.schema) out += `Schema:\n${formatSchema(mo.schema, 1, 15)}\n`;
      if (includeExamples) {
        const ex = mo.example || generateExample(mo.schema);
        if (ex) out += `Example:\n${JSON.stringify(ex, null, 2)}\n`;
      }
    }
  }
  out += `\n### Responses\n`;
  for (const [code, resp] of Object.entries(r.responses)) {
    out += `\n#### ${code}: ${resp.description || ''}\n`;
    for (const [mt, mo] of Object.entries(resp.content || {})) {
      out += `Content-Type: ${mt}\n`;
      if (mo.schema) out += `Schema:\n${formatSchema(mo.schema, 1, 15)}\n`;
      if (includeExamples) {
        const ex = mo.example || generateExample(mo.schema);
        if (ex) out += `Example:\n${JSON.stringify(ex, null, 2)}\n`;
      }
    }
  }
  return out;
}

function formatYaml(r, includeExamples) {
  let out = `${r.method.toUpperCase()} ${r.path}:\n`;
  if (r.summary) out += `  summary: ${r.summary}\n`;
  if (r.description && r.description !== r.summary) out += `  description: ${r.description}\n`;
  if (r.operationId) out += `  operationId: ${r.operationId}\n`;
  if (r.parameters?.length) {
    out += `  parameters:\n`;
    for (const p of r.parameters) {
      out += `    - name: ${p.name}\n      in: ${p.in}\n`;
      if (p.required) out += `      required: true\n`;
      if (p.schema) out += `      type: ${getTypeStr(p.schema)}\n`;
      if (p.description) out += `      description: ${p.description}\n`;
    }
  }
  if (r.requestBody) {
    out += `  requestBody:\n`;
    if (r.requestBody.required) out += `    required: true\n`;
    for (const [mt, mo] of Object.entries(r.requestBody.content || {})) {
      out += `    ${mt}:\n`;
      if (mo.schema) out += `      schema:\n${formatSchema(mo.schema, 4, 15)}\n`;
    }
  }
  out += `  responses:\n`;
  for (const [code, resp] of Object.entries(r.responses)) {
    out += `    ${code}:\n`;
    if (resp.description) out += `      description: ${resp.description}\n`;
    for (const [mt, mo] of Object.entries(resp.content || {})) {
      out += `      ${mt}:\n`;
      if (mo.schema) out += `        schema:\n${formatSchema(mo.schema, 5, 15)}\n`;
    }
  }
  return out;
}

// ---- Copy ----
function copySingle(idx) {
  navigator.clipboard.writeText(formatRoute(routes[idx])).then(() => showToast('已复制到剪贴板'));
}

function copySelected() {
  const selected = routes.filter(r => r.selected);
  if (!selected.length) { showToast('请先选择路由'); return; }
  const text = selected.map(r => formatRoute(r)).join('\n---\n\n');
  navigator.clipboard.writeText(text).then(() => showToast(`已复制 ${selected.length} 个路由到剪贴板`));
}

