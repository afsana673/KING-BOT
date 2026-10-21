'use strict';
const path = require('node:path');

const env = process.env;
const ids = (raw = '') => new Set(String(raw).split(/[\s,;]+/).map(x => x.trim()).filter(x => /^\d+$/.test(x)));

function loadConfig() {
  const prefix = (env.PREFIX || '.').trim();
  if (!prefix || prefix.length > 5 || /\s/.test(prefix)) throw new Error('PREFIX must be 1-5 non-space characters');
  const rawCooldown = Number(env.COOLDOWN_MS || 1500);
  return {
    prefix,
    botName: String(env.BOT_NAME || 'SK Goat Bot').slice(0, 40),
    ownerIDs: ids(env.ADMIN_IDS),
    dataDir: path.resolve(env.DATA_DIR || env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data')),
    port: Number(env.PORT || 3000),
    cooldownMs: Number.isFinite(rawCooldown) ? Math.max(500, Math.min(30000, rawCooldown)) : 1500
  };
}
module.exports = { loadConfig, ids };
