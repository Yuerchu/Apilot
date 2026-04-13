// ---- localStorage persistence ----
const LS_KEYS = { url: 'oa_specUrl', base: 'oa_baseUrl', authType: 'oa_authType', authToken: 'oa_authToken', authUser: 'oa_authUser', authKeyName: 'oa_authKeyName', oauth2Token: 'oa_oauth2Token' };

function saveSettings() {
  localStorage.setItem(LS_KEYS.base, document.getElementById('baseUrlInput').value);
  localStorage.setItem(LS_KEYS.authType, document.getElementById('authType').value);
  localStorage.setItem(LS_KEYS.authToken, document.getElementById('authToken').value);
  localStorage.setItem(LS_KEYS.authUser, document.getElementById('authUser').value);
  localStorage.setItem(LS_KEYS.authKeyName, document.getElementById('authKeyName').value);
  if (window._oauth2Token) localStorage.setItem(LS_KEYS.oauth2Token, window._oauth2Token);
}

function restoreSettings() {
  const url = localStorage.getItem(LS_KEYS.url);
  if (url) document.getElementById('urlInput').value = url;
  const authType = localStorage.getItem(LS_KEYS.authType);
  if (authType) { document.getElementById('authType').value = authType; onAuthTypeChange(); }
  const authToken = localStorage.getItem(LS_KEYS.authToken);
  if (authToken) document.getElementById('authToken').value = authToken;
  const authUser = localStorage.getItem(LS_KEYS.authUser);
  if (authUser) document.getElementById('authUser').value = authUser;
  const authKeyName = localStorage.getItem(LS_KEYS.authKeyName);
  if (authKeyName) document.getElementById('authKeyName').value = authKeyName;
  // Restore OAuth2 token
  const oauth2Token = localStorage.getItem(LS_KEYS.oauth2Token);
  if (oauth2Token) {
    window._oauth2Token = oauth2Token;
    document.getElementById('oauth2Status').innerHTML = '<span class="oauth2-authed">已认证</span>';
  }
}

// Auto-save on input changes
['baseUrlInput', 'authToken', 'authUser', 'authKeyName'].forEach(id => {
  document.getElementById(id).addEventListener('input', saveSettings);
});
['authType'].forEach(id => {
  document.getElementById(id).addEventListener('change', saveSettings);
});

// Save spec URL on successful load
const _origLoadSpec = loadSpec;
loadSpec = async function() {
  await _origLoadSpec();
  if (spec) localStorage.setItem(LS_KEYS.url, document.getElementById('urlInput').value.trim());
  saveSettings();
};

// Save base URL when server changes
const _origOnServerSelect = onServerSelect;
onServerSelect = function() { _origOnServerSelect(); saveSettings(); };

// ---- Embedded mode (FastAPI integration) ----
// When window.__OPENAPI_URL__ is set, auto-load and hide the header
if (window.__OPENAPI_URL__) {
  document.querySelector('.header').style.display = 'none';
  document.getElementById('urlInput').value = window.__OPENAPI_URL__;
  if (window.__OPENAPI_TITLE__) document.title = window.__OPENAPI_TITLE__;
  loadSpec();
} else {
  // Standalone mode: restore settings and auto-load
  restoreSettings();
  if (location.hash) {
    document.getElementById('urlInput').value = decodeURIComponent(location.hash.slice(1));
    loadSpec();
  } else if (document.getElementById('urlInput').value) {
    loadSpec();
  }
}
