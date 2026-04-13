// ---- Load spec ----
async function loadSpec() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  document.getElementById('loadBtn').innerHTML = '<span class="spinner"></span>';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    spec = await res.json();
    parseSpec();
  } catch (e) { showToast('加载失败: ' + e.message); }
  finally { document.getElementById('loadBtn').textContent = '加载'; }
}

function loadFile(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { try { spec = JSON.parse(e.target.result); parseSpec(); } catch(err) { showToast('解析失败: ' + err.message); } };
  reader.readAsText(file);
}
// ---- Swagger 2.0 → OpenAPI 3.0 conversion ----
function convertV2toV3(s) {
  // Build servers from host + basePath + schemes
  const scheme = (s.schemes && s.schemes[0]) || 'https';
  const host = s.host || '';
  const basePath = (s.basePath || '').replace(/\/$/, '');
  if (host) {
    s.servers = [{ url: `${scheme}://${host}${basePath}`, description: 'Converted from Swagger 2.0' }];
  }

  // Convert definitions → components.schemas
  if (s.definitions && !s.components) {
    s.components = { schemas: s.definitions };
    // Rewrite $refs: #/definitions/X → #/components/schemas/X
    const rewriteRefs = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(rewriteRefs); return; }
      if (obj.$ref && typeof obj.$ref === 'string' && obj.$ref.startsWith('#/definitions/')) {
        obj.$ref = obj.$ref.replace('#/definitions/', '#/components/schemas/');
      }
      for (const v of Object.values(obj)) rewriteRefs(v);
    };
    rewriteRefs(s.paths);
    rewriteRefs(s.components);
  }

  // Convert securityDefinitions → components.securitySchemes
  if (s.securityDefinitions) {
    if (!s.components) s.components = {};
    s.components.securitySchemes = s.securityDefinitions;
  }

  // Convert each operation: body/formData params → requestBody
  const globalConsumes = s.consumes || ['application/json'];
  for (const pathItem of Object.values(s.paths || {})) {
    for (const method of ['get','post','put','patch','delete','head','options']) {
      const op = pathItem[method]; if (!op) continue;
      const params = op.parameters || [];
      const bodyParam = params.find(p => p.in === 'body');
      const formParams = params.filter(p => p.in === 'formData');
      const consumes = op.consumes || globalConsumes;

      // Remove body/formData from parameters
      op.parameters = params.filter(p => p.in !== 'body' && p.in !== 'formData');

      if (bodyParam && !op.requestBody) {
        const ct = consumes[0] || 'application/json';
        op.requestBody = {
          required: !!bodyParam.required,
          content: { [ct]: { schema: bodyParam.schema || {} } }
        };
      } else if (formParams.length && !op.requestBody) {
        const isFileUpload = formParams.some(p => p.type === 'file');
        const ct = isFileUpload ? 'multipart/form-data' : (consumes.includes('multipart/form-data') ? 'multipart/form-data' : 'application/x-www-form-urlencoded');
        const props = {};
        const required = [];
        for (const fp of formParams) {
          if (fp.type === 'file') {
            props[fp.name] = { type: 'string', format: 'binary', description: fp.description || '' };
          } else {
            props[fp.name] = { type: fp.type || 'string', format: fp.format, enum: fp.enum, default: fp.default, description: fp.description || '' };
          }
          if (fp.required) required.push(fp.name);
        }
        op.requestBody = {
          content: { [ct]: { schema: { type: 'object', properties: props, required: required.length ? required : undefined } } }
        };
      }

      // Convert response schemas: responses.200.schema → responses.200.content
      const produces = op.produces || s.produces || ['application/json'];
      for (const [code, resp] of Object.entries(op.responses || {})) {
        if (resp.schema && !resp.content) {
          const mt = produces[0] || 'application/json';
          resp.content = { [mt]: { schema: resp.schema } };
          delete resp.schema;
        }
      }
    }
  }
  return s;
}

// ---- Parse spec ----
function parseSpec() {
  // Version detection and conversion
  if (spec.swagger === '2.0') convertV2toV3(spec);

  // Reset models view for new spec
  _modelsRendered = false;
  _selectedModels.clear();
  document.getElementById('modelsList').innerHTML = '';

  routes = [];
  const allTags = new Set();
  const methods = ['get','post','put','patch','delete','head','options'];

  // servers
  const servers = spec.servers || [];
  const serverBar = document.getElementById('serverBar');
  const serverSelect = document.getElementById('serverSelect');
  serverSelect.innerHTML = '';
  // Resolve server URL template variables: {var} → default value
  const resolveServerUrl = (srv) => {
    let url = srv.url;
    if (srv.variables) {
      for (const [k, v] of Object.entries(srv.variables)) {
        url = url.replace(`{${k}}`, v.default || '');
      }
    }
    return url;
  };

  if (servers.length) {
    serverBar.style.display = '';
    servers.forEach((s, i) => {
      const resolved = resolveServerUrl(s);
      const opt = document.createElement('option');
      opt.value = resolved; opt.textContent = `${resolved}${s.description ? ' - ' + s.description : ''}`;
      serverSelect.appendChild(opt);
    });
    document.getElementById('baseUrlInput').value = resolveServerUrl(servers[0]);
  } else {
    // guess from spec URL or restore from localStorage
    const specUrl = document.getElementById('urlInput').value.trim();
    try { const u = new URL(specUrl); document.getElementById('baseUrlInput').value = u.origin; } catch(e) {
      // Local file: try to restore last used baseUrl
      const saved = localStorage.getItem('oa_baseUrl');
      document.getElementById('baseUrlInput').value = saved || '';
    }
    serverBar.style.display = '';
  }

  document.getElementById('authBar').style.display = '';

  // Auto-detect OAuth2 password flow from spec
  const schemes = spec.components?.securitySchemes || {};
  for (const [name, scheme] of Object.entries(schemes)) {
    if (scheme.type === 'oauth2' && scheme.flows?.password) {
      const tokenUrl = scheme.flows.password.tokenUrl || '';
      document.getElementById('oauth2TokenUrl').value = tokenUrl;
      // Auto-select OAuth2 if no auth type was restored from localStorage
      if (document.getElementById('authType').value === 'none' && !window._oauth2Token) {
        document.getElementById('authType').value = 'oauth2';
        onAuthTypeChange();
      }
      break;
    }
  }

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of methods) {
      const op = pathItem[method]; if (!op) continue;
      const tags = op.tags || ['未分组'];
      tags.forEach(t => allTags.add(t));
      const resolved = resolveRef(op, spec, new Set());
      const pathParams = resolveRef(pathItem.parameters || [], spec, new Set());
      routes.push({
        method, path, tags,
        summary: resolved.summary || '', description: resolved.description || '',
        operationId: resolved.operationId || '',
        parameters: [...pathParams, ...(resolved.parameters || [])],
        requestBody: resolved.requestBody || null,
        responses: resolved.responses || {},
        security: resolved.security || spec.security || [],
        selected: false, _raw: resolved,
      });
    }
  }

  renderTags(allTags);
  renderRoutes();

  const info = spec.info || {};
  const infoBar = document.getElementById('infoBar');
  infoBar.style.display = '';
  const specVersion = spec.openapi || spec.swagger || '?';
  let infoHtml = `<strong>${esc(info.title || 'API')}</strong> ${esc(info.version || '')} <span style="color:var(--text2);font-size:12px;">(OpenAPI ${esc(specVersion)})</span> &mdash; ${routes.length} 个路由`;
  if (info.description) {
    infoHtml += `<div class="md-content" style="margin-top:8px;font-size:13px;color:var(--text2);">${renderMd(info.description)}</div>`;
  }
  infoBar.innerHTML = infoHtml;
  document.getElementById('toolbar').style.display = '';

  // Show main tabs if there are schemas to display
  const schemas = spec.components?.schemas || spec.definitions || {};
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount > 0) {
    document.getElementById('mainTabs').style.display = '';
  } else {
    document.getElementById('mainTabs').style.display = 'none';
  }

  // If user is currently on models tab, re-render with new spec
  const modelsVisible = document.getElementById('modelsView').style.display !== 'none';
  if (modelsVisible) {
    renderDataModels();
    _modelsRendered = true;
  }
}

function onServerSelect() {
  document.getElementById('baseUrlInput').value = document.getElementById('serverSelect').value;
}

function onAuthTypeChange() {
  const type = document.getElementById('authType').value;
  document.getElementById('authToken').style.display = (type === 'bearer' || type === 'basic' || type === 'apikey') ? '' : 'none';
  document.getElementById('authUser').style.display = (type === 'basic') ? '' : 'none';
  document.getElementById('authKeyName').style.display = (type === 'apikey') ? '' : 'none';
  document.getElementById('oauth2Fields').style.display = (type === 'oauth2') ? 'inline-flex' : 'none';
  document.getElementById('authToken').placeholder = type === 'bearer' ? 'Bearer Token' : type === 'basic' ? 'Password' : type === 'apikey' ? 'API Key Value' : '';
}

function getAuthHeaders() {
  const type = document.getElementById('authType').value;
  const token = document.getElementById('authToken').value;
  if (type === 'bearer' && token) return { 'Authorization': `Bearer ${token}` };
  if (type === 'oauth2' && window._oauth2Token) return { 'Authorization': `Bearer ${window._oauth2Token}` };
  if (type === 'basic') {
    const user = document.getElementById('authUser').value;
    return { 'Authorization': `Basic ${btoa(user + ':' + token)}` };
  }
  if (type === 'apikey' && token) {
    const name = document.getElementById('authKeyName').value || 'X-API-Key';
    return { [name]: token };
  }
  return {};
}

// OAuth2 Password flow login
async function oauth2Login() {
  const user = document.getElementById('oauth2User').value.trim();
  const pass = document.getElementById('oauth2Pass').value;
  let tokenUrl = document.getElementById('oauth2TokenUrl').value.trim();
  const statusEl = document.getElementById('oauth2Status');

  if (!user || !pass) { showToast('请输入用户名和密码'); return; }
  if (!tokenUrl) { showToast('Token URL 为空'); return; }

  // Resolve relative tokenUrl against baseUrl
  if (!tokenUrl.startsWith('http')) {
    const baseUrl = document.getElementById('baseUrlInput').value.replace(/\/$/, '');
    tokenUrl = baseUrl + (tokenUrl.startsWith('/') ? '' : '/') + tokenUrl;
  }

  statusEl.innerHTML = '<span class="spinner"></span>';
  document.getElementById('oauth2LoginBtn').disabled = true;

  try {
    const body = new URLSearchParams({ grant_type: 'password', username: user, password: pass });
    const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) {
      const errText = await res.text();
      let detail = '';
      try { detail = JSON.parse(errText).detail || errText; } catch { detail = errText; }
      throw new Error(`${res.status} ${detail}`.substring(0, 80));
    }
    const data = await res.json();
    const token = data.access_token;
    if (!token) throw new Error('响应中无 access_token');
    window._oauth2Token = token;
    statusEl.innerHTML = `<span class="oauth2-authed">已认证</span>`;
    showToast('OAuth2 登录成功');
    saveSettings();
  } catch (e) {
    statusEl.textContent = '';
    showToast('登录失败: ' + e.message);
  } finally {
    document.getElementById('oauth2LoginBtn').disabled = false;
  }
}

// ---- Tags ----
let allTags = []; // [{name, count}]

function renderTags(tags) {
  activeTags.clear();
  // Count routes per tag
  const tagCounts = {};
  for (const r of routes) {
    for (const t of r.tags) { tagCounts[t] = (tagCounts[t] || 0) + 1; }
  }
  allTags = [...tags].map(t => ({ name: t, count: tagCounts[t] || 0 }));

  document.getElementById('tagBar').style.display = '';
  document.getElementById('tagTotalCount').textContent = allTags.length;
  updateTagActiveInfo();
  buildTagButtons('');
}

function buildTagButtons(filter) {
  const c = document.getElementById('tagFilters'); c.innerHTML = '';
  const lf = filter.toLowerCase();
  for (const t of allTags) {
    if (lf && !t.name.toLowerCase().includes(lf)) continue;
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (activeTags.has(t.name) ? ' active' : '');
    btn.innerHTML = `${esc(t.name)} <span class="tag-route-count">${t.count}</span>`;
    btn.dataset.tag = t.name;
    btn.onclick = () => {
      if (activeTags.has(t.name)) { activeTags.delete(t.name); btn.classList.remove('active'); }
      else { activeTags.add(t.name); btn.classList.add('active'); }
      updateTagActiveInfo();
      renderRoutes();
    };
    c.appendChild(btn);
  }
}

function updateTagActiveInfo() {
  const el = document.getElementById('tagActiveInfo');
  el.textContent = activeTags.size > 0 ? `(已选 ${activeTags.size} 个)` : '';
}

function toggleTagPanel() {
  const panel = document.getElementById('tagPanel');
  const arrow = document.getElementById('tagArrow');
  const isOpen = panel.classList.toggle('open');
  arrow.classList.toggle('open', isOpen);
}

function filterTags() {
  buildTagButtons(document.getElementById('tagSearchInput').value);
}

function clearAllTags() {
  activeTags.clear();
  document.querySelectorAll('#tagFilters .tag-btn').forEach(b => b.classList.remove('active'));
  updateTagActiveInfo();
  renderRoutes();
}

function invertTags() {
  const visible = document.querySelectorAll('#tagFilters .tag-btn');
  visible.forEach(btn => {
    const tag = btn.dataset.tag;
    if (activeTags.has(tag)) { activeTags.delete(tag); btn.classList.remove('active'); }
    else { activeTags.add(tag); btn.classList.add('active'); }
  });
  updateTagActiveInfo();
  renderRoutes();
}

