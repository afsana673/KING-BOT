'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { commands: builtins } = require('./index');

function loadCommands() {
  const folder = path.join(__dirname, 'custom');
  const additions = fs.readdirSync(folder)
    .filter(file => file.endsWith('.js') && !file.startsWith('_'))
    .sort()
    .map(file => require(path.join(folder, file)));
  const all = [...builtins, ...additions];
  for (const entry of all) {
    if (!entry || !/^[a-z0-9_-]{2,30}$/.test(entry.name || '') || typeof entry.run !== 'function') {
      throw new Error('Invalid custom command: expected { name, run() }');
    }
    entry.aliases ||= [];
    entry.role ||= 'everyone';
    entry.category ||= 'Custom';
    entry.description ||= 'Custom command';
    entry.usage ||= '';
    if (!['everyone', 'groupAdmin', 'botAdmin', 'owner'].includes(entry.role)) throw new Error(`Invalid role for ${entry.name}`);
  }
  return all;
}
module.exports = { loadCommands };
