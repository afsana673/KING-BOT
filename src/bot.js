'use strict';
const { loadCommands } = require('../commands/loader');
const fca = require('./fca');
const { handleReaction } = require('./reactions');

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function adminIDs(info) {
  return new Set((info?.adminIDs || []).map(x => String(typeof x === 'object' ? x.id : x)));
}
function isGroupEvent(event) {
  return event?.isGroup === true || (event?.threadID && event?.senderID && String(event.threadID) !== String(event.senderID));
}

function createBot({ api, config, store }) {
  const commands = loadCommands();
  const indexed = new Map();
  const canonical = new Map();
  for (const cmd of commands) {
    if (canonical.has(cmd.name)) throw new Error(`Duplicate command: ${cmd.name}`);
    canonical.set(cmd.name, cmd);
    for (const name of [cmd.name, ...(cmd.aliases || [])]) {
      if (indexed.has(name)) throw new Error(`Duplicate command alias: ${name}`);
      indexed.set(name, cmd);
    }
  }

  const bot = {
    api, config, store, connected: false, commands: canonical, startedAt: Date.now(),
    seen: new Map(), reactionSeen: new Map(), cooldowns: new Map(), threadCache: new Map(),
    async send(tid, message, replyID) { return fca.send(api, tid, message, replyID); },
    async info(tid) {
      const cached = bot.threadCache.get(String(tid));
      if (cached && Date.now() - cached.at < 30000) return cached.value;
      const value = await fca.getThread(api, tid);
      bot.threadCache.set(String(tid), { at: Date.now(), value });
      return value;
    },
    isOwner(uid) { return config.ownerIDs.has(String(uid)); },
    isBotAdmin(uid) {
      return bot.isOwner(uid) || store.state.extraAdmins.includes(String(uid));
    },
    async isGroupAdmin(tid, uid) {
      if (bot.isOwner(uid)) return true;
      try { return adminIDs(await bot.info(tid)).has(String(uid)); }
      catch (err) { console.warn('[groupadmin] Could not verify:', err?.message); return false; }
    },
    async handle(event) {
      if (!event || !event.type) return;
      if (event.type === 'event') { await bot.handleGroupEvent(event); return; }
      if (event.type === 'message_reaction') { await handleReaction(bot, event); return; }
      if (!['message', 'message_reply'].includes(event.type)) return;
      if (String(event.senderID) === String(api.getCurrentUserID())) return;
      if (!event.body || typeof event.body !== 'string') return;
      const id = event.messageID && `${event.threadID}:${event.messageID}`;
      if (id) {
        if (bot.seen.has(id)) return;
        bot.seen.set(id, Date.now());
      }
      if (bot.seen.size > 5000) {
        const cutoff = Date.now() - 120000;
        for (const [key, ts] of bot.seen) if (ts < cutoff) bot.seen.delete(key);
      }

      const threadID = String(event.threadID);
      const senderID = String(event.senderID);
      const group = store.group(threadID);
      const prefix = group.prefix || config.prefix;
      const body = event.body.trim();
      if (!body) return;
      if (group.banned.includes(senderID) && !bot.isOwner(senderID)) return;

      if (!body.startsWith(prefix)) {
        if (group.enabled) {
          const response = Object.hasOwn(group.autoreplies, body.toLocaleLowerCase()) ? group.autoreplies[body.toLocaleLowerCase()] : null;
          if (response) await bot.send(threadID, response, event.messageID);
        }
        return;
      }
      const after = body.slice(prefix.length).trim();
      const [trigger, ...args] = after.split(/\s+/);
      const cmd = indexed.get((trigger || '').toLowerCase());
      if (!cmd) return;
      if (!group.enabled && !(cmd.name === 'bot' && args[0]?.toLowerCase() === 'on') && !bot.isOwner(senderID)) return;
      const key = `${threadID}:${senderID}`;
      const now = Date.now();
      if (!bot.isBotAdmin(senderID) && now - (bot.cooldowns.get(key) || 0) < config.cooldownMs) return;
      bot.cooldowns.set(key, now);
      if (bot.cooldowns.size > 5000) {
        for (const [k, ts] of bot.cooldowns) if (now - ts > 60000) bot.cooldowns.delete(k);
      }
      if (cmd.role === 'owner' && !bot.isOwner(senderID)) {
        return bot.send(threadID, '⛔ Only the main bot owner can use this command.', event.messageID);
      }
      if (cmd.role === 'botAdmin' && !bot.isBotAdmin(senderID)) {
        return bot.send(threadID, '⛔ Bot administrator access required.', event.messageID);
      }
      if (cmd.role === 'groupAdmin' && !await bot.isGroupAdmin(threadID, senderID)) {
        return bot.send(threadID, '⛔ Group administrator access required.', event.messageID);
      }
      const ctx = {
        api, bot, config, store, group, event, args, prefix, threadID, senderID,
        input: after.slice((trigger || '').length).trim(),
        isOwner: bot.isOwner(senderID), isBotAdmin: bot.isBotAdmin(senderID),
        isGroup: isGroupEvent(event),
        reply: text => bot.send(threadID, text, event.messageID),
        send: text => bot.send(threadID, text),
        info: () => bot.info(threadID),
        userInfo: id => fca.getUser(api, id),
        target: () => String(event.messageReply?.senderID || args[0] || ''),
        save: () => store.save(),
        async requireGroup() {
          if (this.isGroup) return true;
          await this.reply('This command is for group chats only.');
          return false;
        }
      };
      try {
        await cmd.run(ctx);
      } catch (err) {
        console.error(`[command:${cmd.name}]`, err?.message || err);
        try { await ctx.reply('⚠️ Command failed. Check bot permissions or Railway logs.'); } catch (_) {}
      }
    },
    async handleGroupEvent(event) {
      const id = String(event.threadID || '');
      if (!id) return;
      bot.threadCache.delete(id);
      const g = store.group(id);
      if (!g.enabled) return;
      const action = event.logMessageType || '';
      const data = event.logMessageData || {};
      try {
        if (action === 'log:subscribe' && g.welcome) {
          const people = Array.isArray(data.addedParticipants) ? data.addedParticipants : [];
          const names = people.map(p => p.fullName || p.userFbId).filter(Boolean);
          if (names.length) await bot.send(id, `👋 Welcome ${names.join(', ')}!\nType ${(g.prefix || config.prefix)}help to see commands.`);
        }
        if (action === 'log:unsubscribe' && g.leave && data.leftParticipantFbId) {
          await bot.send(id, `👋 Member ${data.leftParticipantFbId} has left the group.`);
        }
      } catch (err) { console.error('[events]', err?.message); }
    },
    start() {
      const listener = typeof api.listenE2EE === 'function' ? api.listenE2EE.bind(api) : api.listenMqtt.bind(api);
      console.log('[bot] Listening for Messenger events (combined E2EE when available)');
      bot.connected = true;
      try {
        listener((err, event) => {
          if (err) { console.error('[listener]', err?.message || String(err)); return; }
          Promise.resolve(bot.handle(event)).catch(e => console.error('[event]', e?.message || e));
        });
      } catch (err) {
        bot.connected = false;
        console.error('[listener:start]', err?.message);
        throw err;
      }
    }
  };
  return bot;
}
module.exports = { createBot, adminIDs, isGroupEvent, wait };
