'use strict';
const { invoke, react } = require('../src/fca');

function cmd(name, category, description, usage, run, extra = {}) {
  return { name, category, description, usage, aliases: [], role: 'everyone', ...extra, run };
}
function duration(ms) {
  let seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400); seconds %= 86400;
  const h = Math.floor(seconds / 3600); seconds %= 3600;
  const m = Math.floor(seconds / 60); seconds %= 60;
  return `${d}d ${h}h ${m}m ${seconds}s`;
}
function id(raw) { return /^\d+$/.test(String(raw || '')) ? String(raw) : null; }
const onOff = value => value === 'on' ? true : value === 'off' ? false : undefined;

const commands = [
  cmd('help', 'Core', 'List all commands or get usage for one command', '[command]', async ctx => {
    const name = ctx.args[0]?.toLowerCase();
    if (name) {
      const found = commands.find(x => x.name === name || x.aliases.includes(name));
      return ctx.reply(found ? `📘 ${found.name}\n${found.description}\nUsage: ${ctx.prefix}${found.name} ${found.usage}\nRole: ${found.role}` : 'Command not found.');
    }
    const categories = [...new Set(commands.map(c => c.category))];
    const sections = categories.map(cat => `【${cat}】\n${commands.filter(c => c.category === cat).map(c => ctx.prefix + c.name).join('  ')}`);
    return ctx.reply(`🤖 ${ctx.config.botName}\n${sections.join('\n\n')}\n\n${commands.length} commands • ${ctx.prefix}help <command>`);
  }, { aliases: ['menu', 'commands'] }),
  cmd('ping', 'Core', 'Test bot response', '', async ctx => ctx.reply(`🏓 Pong! ${Date.now() - (ctx.event.timestamp || Date.now()) < 30000 ? Math.max(0, Date.now() - Number(ctx.event.timestamp || Date.now())) + 'ms' : 'online'}`)),
  cmd('uptime', 'Core', 'Show process uptime', '', async ctx => ctx.reply(`⏱ Uptime: ${duration(Date.now() - ctx.bot.startedAt)}`)),
  cmd('about', 'Core', 'Show bot information', '', async ctx => ctx.reply(`${ctx.config.botName}\nPowered by Node.js + @eryxenx/fca\nGoatBot-style modular Messenger commands\nPrefix: ${ctx.prefix}`)),
  cmd('status', 'Core', 'Show current group bot settings', '', async ctx => ctx.reply(`🤖 ${ctx.config.botName}\nEnabled: ${ctx.group.enabled}\nPrefix: ${ctx.prefix}\nWelcome: ${ctx.group.welcome}\nLeave: ${ctx.group.leave}\nAuto-replies: ${Object.keys(ctx.group.autoreplies).length}\nReact unsend: ${ctx.group.reactUnsend}\nReact kick: ${ctx.group.reactKick}\nUptime: ${duration(Date.now() - ctx.bot.startedAt)}`)),
  cmd('uid', 'Information', 'Show your Messenger ID or reply target ID', '', async ctx => ctx.reply(`🪪 User ID: ${ctx.event.messageReply?.senderID || ctx.senderID}\nThread ID: ${ctx.threadID}`), { aliases: ['id'] }),
  cmd('threadinfo', 'Information', 'Show current group details', '', async ctx => {
    if (!await ctx.requireGroup()) return;
    const info = await ctx.info();
    const admins = Array.isArray(info.adminIDs) ? info.adminIDs.length : 0;
    return ctx.reply(`📌 ${info.threadName || 'Unnamed group'}\nThread ID: ${ctx.threadID}\nMembers: ${info.participantIDs?.length ?? 'unknown'}\nAdmins: ${admins}\nEmoji: ${info.emoji || 'default'}`);
  }, { aliases: ['groupinfo'] }),
  cmd('userinfo', 'Information', 'Show user information', '[userID] (or reply)', async ctx => {
    const uid = id(ctx.event.messageReply?.senderID || ctx.args[0] || ctx.senderID);
    if (!uid) return ctx.reply('Provide a numeric user ID or reply to a message.');
    const users = await ctx.userInfo(uid);
    const user = users?.[uid] || users?.[String(uid)];
    return ctx.reply(`👤 ${user?.name || 'User'}\nID: ${uid}\nProfile: https://www.facebook.com/profile.php?id=${uid}`);
  }, { aliases: ['profile'] }),
  cmd('bot', 'Settings', 'Turn bot on or off in this group', '<on|off>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const val = onOff(ctx.args[0]?.toLowerCase());
    if (val === undefined) return ctx.reply(`Bot is ${ctx.group.enabled ? 'on' : 'off'}. Usage: ${ctx.prefix}bot on|off`);
    ctx.group.enabled = val; ctx.save();
    return ctx.reply(`✅ Bot turned ${val ? 'on' : 'off'} for this group.`);
  }, { role: 'groupAdmin' }),
  cmd('prefix', 'Settings', 'Show or change prefix for this group', '[set <prefix>]', async ctx => {
    if (ctx.args[0]?.toLowerCase() !== 'set') return ctx.reply(`Current prefix: ${ctx.prefix}\nTo change: ${ctx.prefix}prefix set !`);
    if (!await ctx.requireGroup()) return;
    if (!await ctx.bot.isGroupAdmin(ctx.threadID, ctx.senderID)) return ctx.reply('⛔ Group administrator access required.');
    const value = ctx.args[1];
    if (!value || value.length > 5 || /\s/.test(value)) return ctx.reply('Prefix must be 1–5 non-space characters.');
    ctx.group.prefix = value;
    ctx.save();
    return ctx.reply(`✅ New prefix: ${value}`);
  }, { aliases: ['setprefix'] }),
  cmd('welcome', 'Settings', 'Welcome newly joined group members', '<on|off>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const value = onOff(ctx.args[0]?.toLowerCase());
    if (value === undefined) return ctx.reply(`Welcome is ${ctx.group.welcome ? 'on' : 'off'}.`);
    ctx.group.welcome = value; ctx.save(); return ctx.reply(`✅ Welcome ${value ? 'enabled' : 'disabled'}.`);
  }, { role: 'groupAdmin' }),
  cmd('leave', 'Settings', 'Announce when a member leaves', '<on|off>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const value = onOff(ctx.args[0]?.toLowerCase());
    if (value === undefined) return ctx.reply(`Leave notices are ${ctx.group.leave ? 'on' : 'off'}.`);
    ctx.group.leave = value; ctx.save(); return ctx.reply(`✅ Leave notices ${value ? 'enabled' : 'disabled'}.`);
  }, { role: 'groupAdmin' }),
  cmd('rules', 'Settings', 'Show rules or set group rules as an admin', '[set <text>|clear]', async ctx => {
    if (ctx.args[0] === 'set' || ctx.args[0] === 'clear') {
      if (!await ctx.requireGroup()) return;
      if (!await ctx.bot.isGroupAdmin(ctx.threadID, ctx.senderID)) return ctx.reply('⛔ Group administrator access required.');
      const value = ctx.args[0] === 'clear' ? '' : ctx.input.slice(4).trim();
      if (value.length > 1200) return ctx.reply('Rules must be under 1200 characters.');
      ctx.group.rules = value; ctx.save(); return ctx.reply('✅ Group rules updated.');
    }
    return ctx.reply(ctx.group.rules ? `📜 Group Rules\n${ctx.group.rules}` : 'No group rules configured.');
  }),
  cmd('autoreply', 'Settings', 'Exact-keyword automatic replies', '<add keyword | response> / <del keyword> / list', async ctx => {
    const sub = ctx.args[0]?.toLowerCase();
    if (sub === 'list' || !sub) {
      const keys = Object.keys(ctx.group.autoreplies);
      return ctx.reply(keys.length ? `🗨 Keywords:\n${keys.map(k => '• ' + k).join('\n')}` : 'No auto-replies.');
    }
    if (!await ctx.requireGroup()) return;
    if (!await ctx.bot.isGroupAdmin(ctx.threadID, ctx.senderID)) return ctx.reply('⛔ Group administrator access required.');
    if (sub === 'add') {
      const pairs = ctx.input.slice(4).split('|');
      if (pairs.length !== 2) return ctx.reply(`Usage: ${ctx.prefix}autoreply add hi | Hello!`);
      const keyword = pairs[0].trim().toLowerCase();
      const response = pairs[1].trim();
      if (!keyword || ['__proto__', 'prototype', 'constructor'].includes(keyword) || !response || keyword.length > 80 || response.length > 500) return ctx.reply('Keyword max 80 chars; response max 500.');
      if (Object.keys(ctx.group.autoreplies).length >= 25 && !ctx.group.autoreplies[keyword]) return ctx.reply('Maximum 25 auto-replies.');
      ctx.group.autoreplies[keyword] = response; ctx.save(); return ctx.reply(`✅ Added keyword: ${keyword}`);
    }
    if (sub === 'del') {
      const key = ctx.input.slice(4).trim().toLowerCase();
      if (!Object.hasOwn(ctx.group.autoreplies, key)) return ctx.reply('Keyword not found.');
      delete ctx.group.autoreplies[key]; ctx.save(); return ctx.reply(`✅ Deleted keyword: ${key}`);
    }
    return ctx.reply(`Usage: ${ctx.prefix}autoreply add hi | Hello!\n${ctx.prefix}autoreply del hi\n${ctx.prefix}autoreply list`);
  }, { aliases: ['ar'] }),
  cmd('ban', 'Moderation', 'Block a user from using this bot in this thread', '<userID> (or reply)', async ctx => {
    const uid = id(ctx.target()); if (!uid) return ctx.reply('Reply to the user or provide a numeric ID.');
    if (ctx.bot.isOwner(uid)) return ctx.reply('You cannot ban the bot owner.');
    if (!ctx.group.banned.includes(uid)) ctx.group.banned.push(uid);
    ctx.save(); return ctx.reply(`🚫 ${uid} banned from bot commands in this thread.`);
  }, { role: 'groupAdmin' }),
  cmd('unban', 'Moderation', 'Unban a user', '<userID>', async ctx => {
    const uid = id(ctx.target()); if (!uid) return ctx.reply('Provide numeric ID or reply to user.');
    ctx.group.banned = ctx.group.banned.filter(x => x !== uid);
    ctx.save(); return ctx.reply(`✅ Unbanned ${uid}.`);
  }, { role: 'groupAdmin' }),
  cmd('bans', 'Moderation', 'List users blocked from bot commands', '', async ctx => ctx.reply(ctx.group.banned.length ? `Blocked IDs:\n${ctx.group.banned.join('\n')}` : 'No blocked IDs.'), { role: 'groupAdmin' }),
  cmd('kick', 'Moderation', 'Remove a member from the Messenger group', '<userID> (or reply)', async ctx => {
    if (!await ctx.requireGroup()) return;
    const uid = id(ctx.target()); if (!uid) return ctx.reply('Provide a numeric ID or reply to a group member.');
    if (uid === String(ctx.api.getCurrentUserID())) return ctx.reply('I cannot remove myself.');
    if (ctx.bot.isOwner(uid)) return ctx.reply('Cannot remove a bot owner.');
    await invoke(ctx.api.removeUserFromGroup.bind(ctx.api), uid, ctx.threadID);
    return ctx.reply(`✅ Removed ${uid}.`);
  }, { aliases: ['remove'], role: 'groupAdmin' }),
  cmd('add', 'Moderation', 'Add a member to the Messenger group', '<userID>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const uid = id(ctx.args[0]); if (!uid) return ctx.reply('Provide a numeric Facebook ID.');
    await invoke(ctx.api.addUserToGroup.bind(ctx.api), uid, ctx.threadID);
    return ctx.reply(`✅ Add requested for ${uid}.`);
  }, { role: 'groupAdmin' }),
  cmd('nick', 'Moderation', 'Set member nickname', '<userID> <nickname> (or reply with nickname)', async ctx => {
    if (!await ctx.requireGroup()) return;
    const replying = !!ctx.event.messageReply?.senderID;
    const uid = id(replying ? ctx.event.messageReply.senderID : ctx.args[0]);
    const nickname = replying ? ctx.input : ctx.args.slice(1).join(' ');
    if (!uid || !nickname || nickname.length > 80) return ctx.reply('Usage: reply with .nick Cool Name OR .nick 12345 Cool Name');
    await invoke(ctx.api.changeNickname.bind(ctx.api), nickname, ctx.threadID, uid);
    return ctx.reply('✅ Nickname changed.');
  }, { role: 'groupAdmin' }),
  cmd('emoji', 'Moderation', 'Change the group emoji', '<emoji>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const emoji = ctx.args[0]; if (!emoji || emoji.length > 16) return ctx.reply('Choose an emoji.');
    await invoke(ctx.api.changeThreadEmoji.bind(ctx.api), emoji, ctx.threadID);
    return ctx.reply(`✅ Group emoji set to ${emoji}`);
  }, { role: 'groupAdmin' }),
  cmd('reactunsend', 'Reaction Actions', 'Enable admin reaction to unsend bot messages', '<on|off>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const value = onOff(ctx.args[0]?.toLowerCase());
    if (value === undefined) return ctx.reply(`🗑️ React unsend: ${ctx.group.reactUnsend ? 'ON' : 'OFF'}\nUse ${ctx.prefix}reactunsend on / off\nAdmin reacts 🗑️ or 😆 to a BOT message.`);
    ctx.group.reactUnsend = value; ctx.save();
    return ctx.reply(`✅ React unsend ${value ? 'enabled' : 'disabled'}. Admin react 🗑️/😆 on a bot message.`);
  }, { role: 'groupAdmin' }),
  cmd('reactkick', 'Reaction Actions', 'Enable admin angry-reaction to kick a group member', '<on|off>', async ctx => {
    if (!await ctx.requireGroup()) return;
    const value = onOff(ctx.args[0]?.toLowerCase());
    if (value === undefined) return ctx.reply(`😡 React kick: ${ctx.group.reactKick ? 'ON' : 'OFF'}\nUse ${ctx.prefix}reactkick on / off\nAdmin reacts 😡 or 😠 to a member message.`);
    ctx.group.reactKick = value; ctx.save();
    return ctx.reply(`✅ React kick ${value ? 'enabled' : 'disabled'}. Admin react 😡/😠 on member message. Bot account must be group admin.`);
  }, { role: 'groupAdmin' }),
  cmd('unsend', 'Messages', 'Unsend a message sent by this bot (reply to it)', '', async ctx => {
    const reply = ctx.event.messageReply;
    if (!reply?.messageID) return ctx.reply('Reply to a bot message using .unsend');
    if (String(reply.senderID) !== String(ctx.api.getCurrentUserID())) return ctx.reply('Only bot messages can be unsent by this command.');
    await invoke(ctx.api.unsendMessage.bind(ctx.api), reply.messageID);
  }, { role: 'groupAdmin' }),
  cmd('react', 'Messages', 'React to a replied message', '<emoji> (reply to a message)', async ctx => {
    const reply = ctx.event.messageReply;
    if (!reply?.messageID) return ctx.reply('Reply to a message and type .react ❤️');
    const emoji = ctx.args[0] || '❤️';
    if (emoji.length > 16) return ctx.reply('Provide one emoji.');
    await react(ctx.api, emoji, reply.messageID);
  }),
  cmd('say', 'Messages', 'Repeat a message', '<text>', async ctx => {
    if (!ctx.input || ctx.input.length > 1500) return ctx.reply('Enter 1–1500 characters.');
    return ctx.reply(ctx.input);
  }, { aliases: ['echo'] }),
  cmd('reverse', 'Fun', 'Reverse text', '<text>', async ctx => ctx.reply(ctx.input ? [...ctx.input].reverse().join('') : 'Enter some text.')),
  cmd('choose', 'Fun', 'Choose randomly among options', 'option1 | option2', async ctx => {
    const parts = ctx.input.split('|').map(x => x.trim()).filter(Boolean).slice(0, 20);
    return ctx.reply(parts.length >= 2 ? `🎯 I choose: ${parts[Math.floor(Math.random() * parts.length)]}` : 'Usage: .choose tea | coffee | water');
  }),
  cmd('flip', 'Fun', 'Flip a coin', '', async ctx => ctx.reply(Math.random() < .5 ? '🪙 Heads' : '🪙 Tails')),
  cmd('roll', 'Fun', 'Roll a die with up to 1000 sides', '[sides]', async ctx => {
    const sides = ctx.args[0] === undefined ? 6 : Number(ctx.args[0]);
    return ctx.reply(Number.isInteger(sides) && sides >= 2 && sides <= 1000 ? `🎲 ${Math.floor(Math.random() * sides) + 1} / ${sides}` : 'Sides must be 2–1000.');
  }),
  cmd('8ball', 'Fun', 'Get a playful answer to a question', '<question>', async ctx => {
    if (!ctx.input) return ctx.reply('Ask a question first.');
    const answers = ['Yes!', 'Maybe.', 'Not likely.', 'Absolutely!', 'Try again later.', 'I doubt it.', 'Looks promising.'];
    return ctx.reply(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
  }, { aliases: ['magicball'] }),
  cmd('time', 'Utilities', 'Show server time (UTC)', '', async ctx => ctx.reply(`🕒 UTC: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`)),
  cmd('math', 'Utilities', 'Calculate basic arithmetic safely', '<expression>', async ctx => {
    const { calculate } = require('../src/math');
    try { return ctx.reply(`🧮 ${calculate(ctx.input)}`); }
    catch (e) { return ctx.reply(`Invalid expression: ${e.message}`); }
  }),
  cmd('admin', 'Owner', 'Manage bot administrators', '<list|add ID|remove ID>', async ctx => {
    const sub = ctx.args[0]?.toLowerCase();
    if (!sub || sub === 'list') {
      const all = [...new Set([...ctx.config.ownerIDs, ...ctx.store.state.extraAdmins])];
      return ctx.reply(`🔐 Bot admins:\n${all.join('\n') || 'None'}`);
    }
    const uid = id(ctx.args[1]);
    if (!uid) return ctx.reply('Usage: .admin add 12345 / .admin remove 12345');
    if (sub === 'add') {
      if (!ctx.store.state.extraAdmins.includes(uid) && !ctx.config.ownerIDs.has(uid)) ctx.store.state.extraAdmins.push(uid);
    } else if (sub === 'remove') {
      ctx.store.state.extraAdmins = ctx.store.state.extraAdmins.filter(x => x !== uid);
    } else return ctx.reply('Use add, remove, or list.');
    ctx.save(); return ctx.reply(`✅ Admin list updated (${sub}).`);
  }, { role: 'owner' })
];

module.exports = { commands, duration, id, onOff };
