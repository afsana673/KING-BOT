'use strict';
const http = require('node:http');
require('dotenv').config();
const { loadConfig } = require('./src/config');
const { loadSession } = require('./src/session');
const { Storage } = require('./src/storage');
const { createBot } = require('./src/bot');

const config = loadConfig();
let bot = null;
const startedAt = new Date();

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' || !['/', '/health', '/ready'].includes(req.url)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ready = !!bot?.connected;
  const status = { name: config.botName, process: 'running', listener: ready ? 'started' : 'not_started', uptimeSeconds: Math.floor(process.uptime()), startedAt: startedAt.toISOString() };
  res.writeHead(req.url === '/ready' && !ready ? 503 : 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(status));
});
server.listen(config.port, '0.0.0.0', () => console.log(`[http] Health server listening on port ${config.port}`));

async function main() {
  const { state, sessionPath, source } = loadSession(config);
  const store = new Storage(config.dataDir);
  console.log(`[session] Loaded from ${source}; contents hidden`);
  // Load FCA lazily to allow offline unit tests of the bot.
  const login = require('@eryxenx/fca');
  login({ appState: state }, {
    listenEvents: true, selfListen: false, autoReconnect: true,
    humanize: { enabled: false }
  }, (error, api) => {
    if (error || !api) {
      console.error('[login] Failed:', error?.message || 'No API returned');
      server.close(() => process.exit(1));
      return;
    }
    bot = createBot({ api, config, store });
    console.log(`[login] Authenticated as ${api.getCurrentUserID()}`);
    // The library refreshes and backs up cookies. With a Railway volume,
    // refreshed cookies remain available after deploys and restarts.
    if (typeof api.sessionGuard === 'function') {
      try { api.sessionGuard(sessionPath, { interval: 180000, debounce: 30000 }); }
      catch (err) { console.error('[sessionGuard] Failed:', err.message); }
    }
    bot.start();
  });
}

function shutdown(signal) {
  console.log(`[system] ${signal}`);
  if (bot) bot.connected = false;
  try { bot?.api?.saveSession?.(); } catch (_) {}
  try { bot?.api?.stopSessionGuard?.(); } catch (_) {}
  server.close();
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err?.message || String(err)));
main().catch(err => {
  console.error('[startup] Failed:', err.message);
  server.close(() => process.exit(1));
});
