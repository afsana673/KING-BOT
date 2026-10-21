'use strict';
const fs = require('node:fs');
const path = require('node:path');

function defaultGroup() {
  return { enabled: true, prefix: '', welcome: false, leave: false, rules: '', banned: [], autoreplies: {}, reactUnsend: false, reactKick: false };
}

class Storage {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.path = path.join(dir, 'settings.json');
    this.state = { groups: {}, extraAdmins: [] };
    if (fs.existsSync(this.path)) {
      const parsed = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        this.state.groups = parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {};
        this.state.extraAdmins = Array.isArray(parsed.extraAdmins) ? parsed.extraAdmins : [];
      }
    }
  }
  group(id) {
    const key = String(id);
    if (!this.state.groups[key]) this.state.groups[key] = defaultGroup();
    const g = this.state.groups[key];
    for (const [k, v] of Object.entries(defaultGroup())) if (g[k] === undefined) g[k] = v;
    return g;
  }
  save() {
    const tmp = this.path + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.path);
  }
}
module.exports = { Storage, defaultGroup };
