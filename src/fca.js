'use strict';
// Wrap callback FCA functions to work with async command handlers.
function invoke(fn, ...args) {
  if (typeof fn !== 'function') return Promise.reject(new Error('This FCA method is unavailable'));
  return new Promise((resolve, reject) => {
    let finished = false;
    const done = (err, result) => {
      if (finished) return;
      finished = true;
      err ? reject(err) : resolve(result);
    };
    try {
      const returned = fn(...args, done);
      if (returned && typeof returned.then === 'function') returned.then(v => done(null, v), done);
    } catch (err) { done(err); }
  });
}
function getUser(api, id) {
  return invoke(api.getUserInfo.bind(api), id);
}
function getThread(api, id) {
  return invoke(api.getThreadInfo.bind(api), id);
}
function send(api, threadID, message, replyID) {
  return new Promise((resolve, reject) => {
    try {
      const callback = (err, response) => err ? reject(err) : resolve(response);
      api.sendMessage(message, threadID, callback, replyID || undefined);
    } catch (err) { reject(err); }
  });
}
function react(api, emoji, messageID) {
  return invoke(api.setMessageReaction.bind(api), emoji, messageID);
}
module.exports = { invoke, getUser, getThread, send, react };
