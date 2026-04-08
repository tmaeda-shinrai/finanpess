/**
 * api.js — Autenticação Google + Comunicação com Backend
 */

const API_URL = 'COLE_AQUI_A_URL_DO_DEPLOY_DO_APPS_SCRIPT';
const GOOGLE_CLIENT_ID = '198043502728-ge0gbnol6muoir619bu1bg3vpnu8ns9a.apps.googleusercontent.com';

let _idToken = null;
let _userProfile = null;
let _cachedData = null;

// ══════════════════════════════════════
//  Google Identity Services
// ══════════════════════════════════════

function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    console.error('Google Identity Services não carregou.');
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });
}

function triggerGoogleLogin() {
  const btn = document.getElementById('google-btn-container');
  if (btn) {
    google.accounts.id.renderButton(btn, {
      type: 'standard', shape: 'rectangular', theme: 'filled_blue',
      size: 'large', text: 'signin_with', locale: 'pt-BR', width: 300,
    });
  }
}

// ══════════════════════════════════════
//  Callback pós-login
// ══════════════════════════════════════

function handleCredentialResponse(response) {
  if (!response.credential) {
    showLoginError('Falha ao autenticar. Tente novamente.');
    return;
  }
  _idToken = response.credential;
  const payload = parseJwt(_idToken);
  _userProfile = { email: payload.email, name: payload.name, picture: payload.picture };
  hideLoginScreen();
  showUserInfo();
  initApp();
}

function parseJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(atob(b64).split('').map(
      c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')));
  } catch { return {}; }
}

// ══════════════════════════════════════
//  Logout
// ══════════════════════════════════════

function handleLogout() {
  _idToken = null;
  _userProfile = null;
  _cachedData = null;
  google.accounts.id.disableAutoSelect();
  showLoginScreen();
  hideUserInfo();
}

// ══════════════════════════════════════
//  API Calls
// ══════════════════════════════════════

async function fetchDashboardData(forceRefresh = false) {
  if (_cachedData && !forceRefresh) return _cachedData;
  if (!_idToken) throw new Error('Usuário não autenticado.');
  const url = `${API_URL}?action=getDashboardData&id_token=${encodeURIComponent(_idToken)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    if (data.error.includes('Acesso negado') || data.error.includes('Token')) {
      handleLogout();
      showLoginError(data.error);
    }
    throw new Error(data.error);
  }
  _cachedData = data;
  return data;
}

async function postToAPI(action, payload = {}) {
  if (!_idToken) throw new Error('Usuário não autenticado.');
  const body = JSON.stringify({ ...payload, action, id_token: _idToken });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: body,
  });
  const data = await res.json();
  if (data.error) {
    if (data.error.includes('Acesso negado') || data.error.includes('Token')) {
      handleLogout();
      showLoginError(data.error);
    }
    throw new Error(data.error);
  }
  return data;
}

function invalidateCache() { _cachedData = null; }
function isAuthenticated() { return _idToken !== null; }
function getUserProfile() { return _userProfile; }

// ══════════════════════════════════════
//  UI Helpers (Login Screen)
// ══════════════════════════════════════

function hideLoginScreen() {
  const ls = document.getElementById('login-screen');
  const app = document.querySelector('.app-container');
  if (ls) ls.classList.add('hidden');
  if (app) app.style.display = '';
}

function showLoginScreen() {
  const ls = document.getElementById('login-screen');
  const app = document.querySelector('.app-container');
  if (ls) ls.classList.remove('hidden');
  if (app) app.style.display = 'none';
  triggerGoogleLogin();
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showUserInfo() {
  const el = document.getElementById('user-info');
  if (el && _userProfile) {
    el.querySelector('.user-avatar').src = _userProfile.picture || '';
    el.querySelector('.user-email').textContent = _userProfile.email || '';
    el.style.display = 'flex';
  }
}

function hideUserInfo() {
  const el = document.getElementById('user-info');
  if (el) el.style.display = 'none';
}
