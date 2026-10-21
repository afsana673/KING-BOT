'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** appState contains session secrets; never print or commit it. */
function validateAppState(input) {
  const items = Array.isArray(input) ? input : input && (input.appState || input.cookies);
  if (!Array.isArray(items) || items.length === 0) throw new Error('Appstate must be a nonempty JSON array of cookie objects');
  const normalized = items.map(item => {
    if (!item || typeof item.key !== 'string' || typeof item.value !== 'string') {
      throw new Error('Each appstate cookie needs string key and value');
    }
    return {
      ...item,
      domain: item.domain || '.facebook.com',
      path: item.path || '/',
      hostOnly: item.hostOnly === undefined ? false : !!item.hostOnly
    };
  });
  const names = new Set(normalized.map(x => x.key));
  if (!names.has('c_user') || !names.has('xs')) {
    throw new Error('Appstate must contain at least c_user and xs cookies');
  }
  if (!/^\d+$/.test(normalized.find(x => x.key === 'c_user').value)) {
    throw new Error('The c_user value must be a numeric Facebook account ID');
  }
  return normalized;
}

function parseCookieHeader(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('FB_COOKIE is empty');
  const seen = new Map();
  // Session cookie header, not an entire HTTP request or Set-Cookie response.
  for (const chunk of raw.trim().replace(/^Cookie:\s*/i, '').split(';')) {
    const index = chunk.indexOf('=');
    if (index === -1) continue;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (!/^[A-Za-z0-9_]+$/.test(key) || !value) continue;
    seen.set(key, value);
  }
  return validateAppState(Array.from(seen, ([key, value]) => ({
    key, value, domain: '.facebook.com', path: '/', hostOnly: false
  })));
}

function safeWriteSession(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'w' });
  try { fs.chmodSync(file, 0o600); } catch (_) { /* Non-POSIX filesystem */ }
}

function loadSession(config) {
  const sessionPath = path.join(config.dataDir, 'appstate.json');
  const candidates = [sessionPath, path.resolve('appstate.json'), path.resolve('apostate.json')];
  // Prefer a previously refreshed persistent session to an old env var.
  if (fs.existsSync(sessionPath) && process.env.FORCE_SESSION_FROM_ENV !== '1') {
    const state = validateAppState(JSON.parse(fs.readFileSync(sessionPath, 'utf8')));
    return { state, sessionPath, source: 'persistent session' };
  }
  let state, source;
  if (process.env.APPSTATE_JSON && process.env.APPSTATE_JSON.trim()) {
    state = validateAppState(JSON.parse(process.env.APPSTATE_JSON));
    source = 'APPSTATE_JSON variable';
  } else if (process.env.FB_COOKIE && process.env.FB_COOKIE.trim()) {
    state = parseCookieHeader(process.env.FB_COOKIE);
    source = 'FB_COOKIE variable';
  } else {
    const existing = candidates.slice(1).find(x => fs.existsSync(x));
    if (!existing) {
      throw new Error('No login session. Set APPSTATE_JSON / FB_COOKIE in Railway Variables, or privately create appstate.json / apostate.json.');
    }
    state = validateAppState(JSON.parse(fs.readFileSync(existing, 'utf8')));
    source = path.basename(existing);
  }
  safeWriteSession(sessionPath, state);
  return { state, sessionPath, source };
}

module.exports = { validateAppState, parseCookieHeader, loadSession, safeWriteSession };
