// ---- Curl command generation ----
function buildCurl(method, url, headers, body, contentType) {
  let parts = ['curl'];
  if (method !== 'GET') parts.push(`-X ${method}`);
  parts.push(`'${url}'`);
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === 'content-type' && contentType === 'multipart/form-data') continue;
    parts.push(`-H '${k}: ${v.replace(/'/g, "'\\''")}'`);
  }
  if (body && contentType === 'multipart/form-data' && body instanceof FormData) {
    for (const [k, v] of body.entries()) {
      if (v instanceof File) {
        parts.push(`-F '${k}=@${v.name.replace(/'/g, "'\\''")}'`);
      } else {
        parts.push(`-F '${k}=${String(v).replace(/'/g, "'\\''")}'`);
      }
    }
  } else if (body && typeof body === 'string') {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n  ');
}

// ---- Pre-execution validation ----
function validateRequest(idx) {
  const r = routes[idx];
  const errors = [];
  const invalidEls = [];

  // Validate required parameters
  for (const p of r.parameters || []) {
    if (!p.required) continue;
    const el = document.getElementById(`param-${idx}-${p.name}`);
    if (el && !el.value.trim()) {
      errors.push(`参数 "${p.name}" 为必填项`);
      invalidEls.push(el);
    }
  }

  // Validate required request body fields (JSON content type)
  const ct = document.getElementById(`ct-${idx}`)?.value || 'application/json';
  if (r.requestBody && ct === 'application/json') {
    const bodyEl = document.getElementById(`body-${idx}`);
    if (bodyEl?.value.trim()) {
      try {
        const bodyObj = JSON.parse(bodyEl.value);
        const content = r.requestBody.content || {};
        const schema = content[ct]?.schema || Object.values(content)[0]?.schema;
        if (schema?.required) {
          for (const key of schema.required) {
            if (bodyObj[key] === undefined || bodyObj[key] === null || bodyObj[key] === '') {
              errors.push(`请求体字段 "${key}" 为必填项`);
              // Try to find form field
              const fieldEl = document.getElementById(`bf-${idx}-${key}`);
              if (fieldEl) invalidEls.push(fieldEl);
            }
          }
        }
      } catch {}
    }
  }

  // Validate formdata required fields
  if (r.requestBody && (ct === 'multipart/form-data' || ct === 'application/x-www-form-urlencoded')) {
    const content = r.requestBody.content || {};
    const schema = content[ct]?.schema;
    if (schema?.required) {
      for (const key of schema.required) {
        const el = document.getElementById(`fd-${idx}-${key}`);
        if (el) {
          if (el.type === 'file') {
            if (!el.files?.length) {
              errors.push(`表单字段 "${key}" 为必填项`);
              invalidEls.push(el);
            }
          } else if (!el.value.trim()) {
            errors.push(`表单字段 "${key}" 为必填项`);
            invalidEls.push(el);
          }
        }
      }
    }
  }

  // Mark invalid + add listeners
  for (const el of invalidEls) {
    el.classList.add('invalid');
    const handler = () => { el.classList.remove('invalid'); el.removeEventListener('input', handler); };
    el.addEventListener('input', handler);
  }

  if (errors.length) {
    showToast(errors[0]);
    return false;
  }
  return true;
}

// ---- Send HTTP request ----
async function sendRequest(idx) {
  // Validate first
  if (!validateRequest(idx)) return;

  const r = routes[idx];
  const baseUrl = document.getElementById('baseUrlInput').value.replace(/\/$/, '');
  if (!baseUrl) {
    showToast('请先在 Server 栏填写 Base URL');
    document.getElementById('baseUrlInput').focus();
    return;
  }
  let path = r.path;

  // Collect params
  const queryParams = [];
  const headers = { ...getAuthHeaders() };

  for (const p of r.parameters || []) {
    const el = document.getElementById(`param-${idx}-${p.name}`);
    const val = el?.value ?? '';
    if (!val && !p.required) continue;
    if (p.in === 'path') {
      path = path.replace(`{${p.name}}`, encodeURIComponent(val));
    } else if (p.in === 'query') {
      if (val) queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
    } else if (p.in === 'header') {
      if (val) headers[p.name] = val;
    }
  }

  let url = baseUrl + path;
  if (queryParams.length) url += '?' + queryParams.join('&');

  const fetchOpts = { method: r.method.toUpperCase(), headers };

  // Body - handle different content types
  let curlContentType = null;
  if (r.requestBody) {
    const ct = document.getElementById(`ct-${idx}`)?.value || 'application/json';
    curlContentType = ct;
    if (ct === 'multipart/form-data' || ct === 'application/x-www-form-urlencoded') {
      const form = new FormData();
      const container = document.getElementById(`formdata-${idx}`);
      if (container) {
        container.querySelectorAll('[data-fd-field]').forEach(el => {
          const name = el.dataset.fdField;
          if (el.type === 'file') {
            if (el.files.length) form.append(name, el.files[0]);
          } else {
            if (el.value) form.append(name, el.value);
          }
        });
      }
      if (ct === 'application/x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        fetchOpts.body = new URLSearchParams(form).toString();
      } else {
        // Don't set Content-Type for multipart - browser sets boundary
        fetchOpts.body = form;
      }
    } else {
      const bodyEl = document.getElementById(`body-${idx}`);
      if (bodyEl?.value.trim()) {
        headers['Content-Type'] = 'application/json';
        fetchOpts.body = bodyEl.value;
      }
    }
  }

  fetchOpts.headers = headers;

  // Build curl command before fetch
  const curlCmd = buildCurl(fetchOpts.method, url, headers, fetchOpts.body, curlContentType);

  const statusEl = document.getElementById(`req-status-${idx}`);
  statusEl.innerHTML = '<span class="spinner"></span> 请求中...';

  const start = performance.now();
  try {
    const res = await fetch(url, fetchOpts);
    const elapsed = Math.round(performance.now() - start);
    const respHeaders = {};
    res.headers.forEach((v, k) => { respHeaders[k] = v; });

    let bodyText = '';
    // 204/205/304 have no body
    if (res.status === 204 || res.status === 205 || res.status === 304) {
      bodyText = '';
    } else {
      const rawText = await res.text();
      const respCt = res.headers.get('content-type') || '';
      if (respCt.includes('json') && rawText) {
        try { bodyText = JSON.stringify(JSON.parse(rawText), null, 2); } catch { bodyText = rawText; }
      } else {
        bodyText = rawText;
      }
    }

    statusEl.textContent = '';
    renderResponse(idx, res.status, res.statusText, elapsed, respHeaders, bodyText, curlCmd);
  } catch (e) {
    statusEl.textContent = '';
    renderResponse(idx, 0, 'Network Error', Math.round(performance.now() - start), {}, e.message, curlCmd);
  }
}

function renderResponse(idx, status, statusText, elapsed, headers, body, curlCmd) {
  const container = document.getElementById(`response-${idx}`);
  const sClass = status >= 200 && status < 300 ? 's2xx' : status >= 300 && status < 400 ? 's3xx' : status >= 400 && status < 500 ? 's4xx' : 's5xx';

  let headersHtml = '';
  for (const [k, v] of Object.entries(headers)) {
    headersHtml += `${esc(k)}: ${esc(v)}\n`;
  }

  // Detect JSON body for syntax highlighting
  let isJsonBody = false;
  let jsonObj = null;
  try { jsonObj = JSON.parse(body); isJsonBody = true; } catch {}

  // Detect token-like fields in response for quick auth setup
  // Token field detection: prioritized list (higher priority = shown first)
  const TOKEN_KEYS_PRIO = { access_token: 1, accessToken: 1, token: 2, jwt: 2, bearer: 2, id_token: 3, auth_token: 3, authToken: 3, session_token: 4, api_key: 5, apiKey: 5, refresh_token: 9 };
  let tokenBtns = '';
  if (isJsonBody && jsonObj && typeof jsonObj === 'object' && status >= 200 && status < 300) {
    const findTokens = (obj, path) => {
      const found = [];
      for (const [k, v] of Object.entries(obj)) {
        const p = path ? `${path}.${k}` : k;
        if (typeof v === 'string' && v.length >= 8 && k in TOKEN_KEYS_PRIO) {
          found.push({ key: p, value: v, prio: TOKEN_KEYS_PRIO[k] });
        } else if (typeof v === 'object' && v && !Array.isArray(v)) {
          found.push(...findTokens(v, p));
        }
      }
      return found;
    };
    const tokens = findTokens(jsonObj, '').sort((a, b) => a.prio - b.prio);
    for (const t of tokens) {
      tokenBtns += `<button class="btn btn-sm token-apply-btn" data-token-value="${esc(t.value)}" data-token-key="${esc(t.key)}" title="${esc(t.key)}: ${esc(t.value.substring(0, 40))}...">设为 Token (${esc(t.key)})</button>`;
    }
  }

  const curlHtml = curlCmd ? `<div class="curl-block"><button class="curl-copy-btn" onclick="copyCurl(${idx})">复制</button>${esc(curlCmd)}</div>` : '';

  container.innerHTML = `
    ${curlHtml}
    <div class="response-panel" style="margin-top:${curlCmd ? '8' : '14'}px;">
      <div class="response-status ${sClass}">
        <span>${status} ${esc(statusText)}</span>
        <span class="resp-time">${elapsed}ms</span>
      </div>
      ${headersHtml ? `<details class="response-headers"><summary>Response Headers</summary><pre style="margin:4px 0;font-size:11px;">${headersHtml}</pre></details>` : ''}
      <div class="response-body">${isJsonBody ? highlightJson(body) : esc(body)}</div>
      <div class="response-copy">
        ${tokenBtns}
        <button class="btn btn-sm" onclick="copyResponseBody(${idx})">复制 Body</button>
        <button class="btn btn-sm" onclick="copyResponseFull(${idx})">复制完整响应</button>
      </div>
    </div>`;

  // Store for copy
  container._respData = { status, statusText, headers, body, curlCmd };

  // Bind token apply buttons
  container.querySelectorAll('.token-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => applyToken(btn.dataset.tokenValue, btn.dataset.tokenKey));
  });
}

function copyCurl(idx) {
  const data = document.getElementById(`response-${idx}`)._respData;
  if (data?.curlCmd) navigator.clipboard.writeText(data.curlCmd).then(() => showToast('curl 命令已复制'));
}

function applyToken(token, fieldName) {
  // Set auth type to bearer and fill in the token
  document.getElementById('authType').value = 'bearer';
  onAuthTypeChange();
  document.getElementById('authToken').value = token;
  // Also store as OAuth2 token for compatibility
  window._oauth2Token = token;
  saveSettings();
  showToast(`已从 "${fieldName}" 设为 Bearer Token`);
}

function copyResponseBody(idx) {
  const data = document.getElementById(`response-${idx}`)._respData;
  if (data) navigator.clipboard.writeText(data.body).then(() => showToast('Body 已复制'));
}

function copyResponseFull(idx) {
  const data = document.getElementById(`response-${idx}`)._respData;
  if (!data) return;
  let text = `HTTP ${data.status} ${data.statusText}\n`;
  for (const [k, v] of Object.entries(data.headers)) text += `${k}: ${v}\n`;
  text += `\n${data.body}`;
  navigator.clipboard.writeText(text).then(() => showToast('完整响应已复制'));
}

// ---- Selection ----
function toggleRoute(idx, checked) {
  routes[idx].selected = checked;
  const card = document.getElementById('card-' + idx);
  if (card) card.classList.toggle('selected', checked);
  updateCount();
  updateGroupCheck(idx);
}

function toggleGroup(groupId, idxList) {
  const cb = document.getElementById(groupId);
  const checked = cb.checked;
  cb.indeterminate = false;
  for (const idx of idxList) {
    routes[idx].selected = checked;
    const card = document.getElementById('card-' + idx);
    if (card) {
      card.classList.toggle('selected', checked);
      const rcb = card.querySelector('.route-check');
      if (rcb) rcb.checked = checked;
    }
  }
  updateCount();
}

function updateGroupCheck(idx) {
  // Find the group containing this route
  const card = document.getElementById('card-' + idx);
  if (!card) return;
  const group = card.closest('.route-group');
  if (!group) return;
  const cb = group.querySelector('.group-check');
  if (!cb) return;
  const checks = group.querySelectorAll('.route-check');
  const total = checks.length;
  const selected = [...checks].filter(c => c.checked).length;
  if (selected === 0) { cb.checked = false; cb.indeterminate = false; }
  else if (selected === total) { cb.checked = true; cb.indeterminate = false; }
  else { cb.checked = false; cb.indeterminate = true; }
}

function toggleSelectAll() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.route-check').forEach(cb => {
    cb.checked = checked;
    const idx = parseInt(cb.closest('.route-card').id.replace('card-', ''));
    routes[idx].selected = checked;
    cb.closest('.route-card').classList.toggle('selected', checked);
  });
  updateCount();
}

function updateCount() {
  const count = routes.filter(r => r.selected).length;
  document.getElementById('copyCount').textContent = `已选 ${count} 个`;
  // Update FAB (only show in endpoints view)
  document.getElementById('fabCount').textContent = count;
  const inEndpointsView = document.getElementById('modelsView').style.display === 'none';
  document.getElementById('selectionFab').classList.toggle('show', count > 0 && inEndpointsView);
}

function clearSelection() {
  routes.forEach(r => r.selected = false);
  document.querySelectorAll('.route-check').forEach(cb => {
    cb.checked = false;
    cb.closest('.route-card')?.classList.remove('selected');
  });
  document.querySelectorAll('.group-check').forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  document.getElementById('selectAll').checked = false;
  updateCount();
}

