'use strict';
const { invoke } = require('./fca');

// Both common Messenger reaction emojis and custom trash emoji are supported.
const UNSEND_EMOJIS = new Set(['🗑', '😆']);
const KICK_EMOJIS = new Set(['😠', '😡']);
function normalizeReaction(value) {
  return typeof value === 'string' ? value.replace(/\uFE0F/g, '') : '';
}

async function handleReaction(bot, event) {
  const { api, store } = bot;
  const threadID = String(event.threadID || '');
  const actor = String(event.userID || ''); // Person adding the reaction.
  const author = String(event.senderID || ''); // Author of reacted-to message.
  const messageID = String(event.messageID || '');
  const emoji = normalizeReaction(event.reaction);
  if (!threadID || !actor || !author || !messageID || !emoji) return;
  if (actor === String(api.getCurrentUserID())) return;
  const group = store.group(threadID);
  if (!group.enabled || (group.banned || []).includes(actor)) return;
  const unsend = group.reactUnsend && UNSEND_EMOJIS.has(emoji);
  const kick = group.reactKick && KICK_EMOJIS.has(emoji);
  if (!unsend && !kick) return;

  // Reactions must be made by actual group administrators or the configured bot owner.
  if (!await bot.isGroupAdmin(threadID, actor)) return;
  const botID = String(api.getCurrentUserID());
  if (unsend) {
    // Never unsend other people's content. Reactions carry the original message author's UID.
    if (author !== botID) return;
  } else {
    if (author === botID || author === actor || bot.isOwner(author)) return;
  }

  const key = `${threadID}:${messageID}:${unsend ? 'unsend' : 'kick'}`;
  const now = Date.now();
  for (const [k, at] of bot.reactionSeen) if (now - at > 60_000) bot.reactionSeen.delete(k);
  if (bot.reactionSeen.has(key)) return;
  bot.reactionSeen.set(key, now);

  try {
    if (unsend) {
      await invoke(api.unsendMessage.bind(api), messageID);
      return;
    }
    const details = await bot.info(threadID);
    const groupAdmins = new Set((details?.adminIDs || []).map(x => String(typeof x === 'object' ? x.id : x)));
    if (!groupAdmins.has(botID)) {
      await bot.send(threadID, '⚠️ React kick needs this bot account to be a Messenger group admin.');
      return;
    }
    if (groupAdmins.has(author)) return; // Never kick other group administrators.
    if (Array.isArray(details?.participantIDs) && !details.participantIDs.some(x => String(x) === author)) return;
    await invoke(api.removeUserFromGroup.bind(api), author, threadID);
    await bot.send(threadID, `✅ React kick: removed member ${author}.`);
  } catch (error) {
    // Allow a genuine retry when the provider operation fails.
    bot.reactionSeen.delete(key);
    console.error('[reaction action]', error?.message || String(error));
    try { await bot.send(threadID, '⚠️ Reaction action failed. Check bot permissions and Railway logs.'); } catch (_) {}
  }
}

module.exports = { handleReaction, normalizeReaction, UNSEND_EMOJIS, KICK_EMOJIS };
