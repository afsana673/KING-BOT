'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { calculate } = require('../src/math');
const { validateAppState, parseCookieHeader, loadSession } = require('../src/session');
const { Storage } = require('../src/storage');
const { loadCommands } = require('../commands/loader');
const { createBot } = require('../src/bot');

const ownSession = [{ key: 'c_user', value: '123456789', domain: '.facebook.com', path: '/' }, { key: 'xs', value: 'SESS=VALUE', domain: '.facebook.com', path: '/' }];
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'goat-bot-test-'));

test('session validates own cookies (never prints them)', () => {
  assert.equal(validateAppState(ownSession).length, 2);
  assert.equal(parseCookieHeader('c_user=123456789; xs=SESS=VALUE')[1].value, 'SESS=VALUE');
  assert.throws(() => validateAppState([{ key: 'c_user', value: '11' }]));
  assert.throws(() => parseCookieHeader('notvalid=ab'));
});

test('session resolves persistent JSON first', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'appstate.json'), JSON.stringify(ownSession));
  const s = loadSession({ dataDir: dir });
  assert.equal(s.source, 'persistent session');
  assert.equal(s.state.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('math calculates without JavaScript eval', () => {
  assert.equal(calculate('(3+4)*2'), 14);
  assert.equal(calculate('2^3^2'), 512);
  assert.equal(calculate('-2^2'), -4);
  assert.throws(() => calculate('process.exit()'));
  assert.throws(() => calculate('1/0'));
});

test('custom commands register without name collisions', () => {
  const entries = loadCommands();
  assert.ok(entries.length >= 30);
  assert.ok(entries.some(c => c.name === 'hello'));
});

test('settings persist across runs', () => {
  const dir = tmpdir();
  const a = new Storage(dir);
  a.group('10').welcome = true;
  a.save();
  const b = new Storage(dir);
  assert.equal(b.group('10').welcome, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

function makeMock() {
  const sent = [];
  const api = {
    getCurrentUserID: () => '999',
    sendMessage(message, tid, cb) { sent.push({ message, tid }); cb(null, { messageID: 'r1' }); },
    getThreadInfo(tid, cb) { cb(null, { threadName: 'Demo group', adminIDs: [{ id: '101' }], participantIDs: ['101','202'] }); },
    getUserInfo(uid, cb) { cb(null, { [uid]: { name: 'Test person' } }); }
  };
  const dir = tmpdir();
  const config = { ownerIDs: new Set(['101']), botName: 'TestBot', prefix: '.', cooldownMs: 500, dataDir: dir };
  const store = new Storage(dir);
  const bot = createBot({ api, config, store });
  return { bot, sent, dir, store };
}

async function sendEvent(bot, senderID, body, messageID, threadID = '333') {
  await bot.handle({ type: 'message', senderID, threadID, body, messageID, timestamp: Date.now() });
}

test('help answers to a message; same message cannot be handled twice', async () => {
  const { bot, sent, dir } = makeMock();
  await sendEvent(bot, '202', '.help', 'm1');
  await sendEvent(bot, '202', '.help', 'm1');
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /help/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('non-admin cannot disable bot, admin can', async () => {
  const { bot, sent, store, dir } = makeMock();
  await sendEvent(bot, '202', '.bot off', 'm1');
  assert.equal(store.group('333').enabled, true);
  await sendEvent(bot, '101', '.bot off', 'm2');
  assert.equal(store.group('333').enabled, false);
  await sendEvent(bot, '101', '.bot on', 'm3');
  assert.equal(store.group('333').enabled, true);
  assert.ok(sent.length >= 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reaction controls are off by default; only admins can use them', async () => {
  const { bot, store, dir } = makeMock();
  let unsends = 0, kicks = 0;
  bot.api.getThreadInfo = (_tid, cb) => cb(null, { adminIDs: [{ id: '101' }, { id: '999' }], participantIDs: ['101', '202', '999'] });
  bot.api.unsendMessage = (_id, cb) => { unsends++; cb(null); };
  bot.api.removeUserFromGroup = (_uid, _tid, cb) => { kicks++; cb(null); };
  const react = (reactor, author, emoji, mid) => bot.handle({ type: 'message_reaction', userID: reactor, senderID: author, reaction: emoji, messageID: mid, threadID: '333' });
  await react('101', '999', '😆', 'bot1');
  await react('101', '202', '😡', 'mem1');
  assert.equal(unsends, 0);
  assert.equal(kicks, 0);
  store.group('333').reactUnsend = true;
  store.group('333').reactKick = true;
  await react('202', '999', '😆', 'bot2'); // non-admin is denied
  await react('202', '101', '😡', 'mem2');
  assert.equal(unsends, 0);
  assert.equal(kicks, 0);
  await react('101', '999', '🗑️', 'bot3');
  assert.equal(unsends, 1);
  await react('101', '999', '🗑️', 'bot3'); // duplicate ignored
  assert.equal(unsends, 1);
  await react('101', '202', '😡', 'mem3');
  assert.equal(kicks, 1);
  await react('101', '202', '😡', 'mem3');
  assert.equal(kicks, 1);
  await react('101', '101', '😡', 'mem4'); // do not kick self or admin
  await react('101', '999', '😡', 'mem5'); // do not kick bot
  await react('101', '202', '🗑️', 'mem6'); // do not unsend user's message
  assert.equal(kicks, 1);
  assert.equal(unsends, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reaction features can be enabled and settings persist', async () => {
  const { bot, sent, store, dir } = makeMock();
  await sendEvent(bot, '202', '.reactkick on', 'user1');
  assert.equal(store.group('333').reactKick, false);
  await sendEvent(bot, '101', '.reactkick on', 'admin1');
  await sendEvent(bot, '101', '.reactunsend on', 'admin2');
  assert.equal(store.group('333').reactKick, true);
  assert.equal(store.group('333').reactUnsend, true);
  const restored = new Storage(dir);
  assert.equal(restored.group('333').reactKick, true);
  assert.equal(restored.group('333').reactUnsend, true);
  assert.ok(sent.some(e => /enabled/.test(e.message)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reaction kick requires bot to be a real group admin', async () => {
  const { bot, store, dir } = makeMock();
  store.group('333').reactKick = true;
  let kicked = false;
  bot.api.removeUserFromGroup = (_uid, _tid, cb) => { kicked = true; cb(null); };
  await bot.handle({ type: 'message_reaction', userID: '101', senderID: '202', reaction: '😠', messageID: 'mid1', threadID: '333' });
  assert.equal(kicked, false);
  fs.rmSync(dir, { recursive: true, force: true });
});
