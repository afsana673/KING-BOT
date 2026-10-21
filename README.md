# SK Goat Bot — Messenger Bot for Railway

GoatBot-inspired Messenger bot built with **Node.js 20+** and **`@eryxenx/fca` `^1.1.7`**. It supports Messenger commands, per-group configuration, group moderation, event greetings, exact-match auto-replies, custom commands, session backups, and a Railway-compatible health endpoint.

**IMPORTANT:** This is not the original GoatBot source code. It uses an **unofficial** Messenger library. Meta may change login behavior, restrict accounts, or invalidate cookies without notice. Do not use an account you cannot afford to lose. Use your own account only.

## 🚀 Deploy from GitHub to Railway (বাংলা)

1. Download/extract this project ZIP. GitHub-এ নতুন একটি repository তৈরি করো, যেমন `sk-goat-messenger-bot`। সব **source files and folders** upload করো (root-এ `package.json`, `index.js`, `src/`, `commands/` থাকবে)।
2. **কখনোই নিজের আসল login cookie, `appstate.json`, `apostate.json`, `.env`, or `data/` GitHub-এ upload করবে না!** এই project-এর `.gitignore` এগুলো exclude করে, কিন্তু GitHub web upload-এ এগুলো আলাদা করে select না করার দায়িত্ব তোমার।
3. Go to [Railway](https://railway.com), create **New Project → Deploy from GitHub Repo**, then select your repository.
4. Railway service → **Variables**:

   | KEY | VALUE |
   | --- | --- |
   | `ADMIN_IDS` | Your own Facebook/Messenger numeric user ID, e.g. `123456789012345` |
   | `APPSTATE_JSON` | Full JSON **array** of your own appstate cookies, as a single Railway variable value |
   | `PREFIX` | `.` (optional) |
   | `BOT_NAME` | `SK Goat Bot` (optional) |
   | `COOLDOWN_MS` | `1500` (optional) |

   Alternative to `APPSTATE_JSON`: set `FB_COOKIE` to your **own** cookie header, such as `c_user=YOUR_ID; xs=YOUR_VALUE; datr=OPTIONAL`. A complete, valid appState is more reliable than only two cookies.
5. Add a **Railway Volume** to the service with mount path **`/app/data`** (recommended) so refreshed cookies and group settings survive redeploys. The code automatically detects `RAILWAY_VOLUME_MOUNT_PATH`. Use **one replica** when using a volume.
6. Deploy / Redeploy. Open **Logs**, look for `[login] Authenticated as ...` followed by `[bot] Listening ...`.
7. Railway can generate a public domain; visit `https://YOUR-DOMAIN/health` to check the process. This does **not** guarantee Messenger itself is connected. Test by messaging the account/group with `.help` and `.ping`.

Start command: `npm start` (already configured in `railway.json`). Railway supplies the web-server `PORT`.

### What is `apostate.jison`?

Correct file extensions are **`.json`**, not `.jison`. This project supports `appstate.json` and `apostate.json` for local use; sample structures are in `appstate.example.json` and `apostate.example.json`. These are examples **only**, not actual sessions.

**If you want to paste your ID and cookie into a file locally**, create **`apostate.json`** (copy `apostate.example.json`) and replace its placeholder values with the cookie values from your own account. A single numeric user ID alone is **not** enough to authenticate. Never upload this private file to GitHub. For Railway, use a **secret variable** instead of uploading a cookie file.

### How to replace expired session credentials

If a Railway Volume contains an expired `/app/data/appstate.json`, changing `APPSTATE_JSON` alone won't override that cached file. After updating `APPSTATE_JSON`, temporarily set `FORCE_SESSION_FROM_ENV=1`, redeploy once, then remove that variable. Alternatively delete the expired appstate file using Railway Volume file management. Restart after updating credentials.

## Reaction Actions (Admin-only)

Enable these features **per group** after deploying:

```
.reactunsend on
.reactkick on
```

- **React to unsend:** A Messenger **group admin** reacts 🗑️ or 😆 on a **message sent by this bot** → bot unsends its own message. Requires `.reactunsend on`.
- **React to kick:** A Messenger **group admin** reacts 😡 or 😠 on a **member's message** → bot removes that member. Requires `.reactkick on`, and the bot's Messenger account must be a group admin. Cannot kick the bot, owner, reactors themselves or other group admins.
- Anyone without group admin rights cannot trigger these destructive actions. Both features are **OFF by default**. The existing `.kick USER_ID` and `.unsend` commands still work.
- Run `.reactkick off` and `.reactunsend off` to disable; `.status` shows their current values. Some Messenger variants do not offer 🗑️, so 😆 is an alternative for unsend.
- Reactions in some E2EE threads may not be reliably delivered depending on the third-party FCA implementation. Inspect Railway logs if they do not work.

## Example commands

| Command | Description | Access |
| --- | --- | --- |
| `.help` | List all commands | Everyone |
| `.ping`, `.uptime`, `.status` | Basic diagnostics | Everyone |
| `.uid`, `.userinfo`, `.threadinfo` | IDs and information | Everyone |
| `.prefix set !` | Change prefix for group | Group admin |
| `.bot on/off` | Enable or disable bot for group | Group admin |
| `.welcome on/off`, `.leave on/off` | Join and leave notices | Group admin |
| `.rules set Be kind!` | Set group rules | Group admin |
| `.autoreply add hi | Hello!` | Create auto-response | Group admin |
| `.autoreply list`, `.autoreply del hi` | List/delete auto-responses | Group admin for delete |
| `.ban <id>`, `.unban <id>`, `.bans` | Bot-command bans for this chat | Group admin |
| `.kick <id>`, `.add <id>` | Manage group members | Group admin + Messenger permissions |
| `.nick <id> <name>`, `.emoji 🔥` | Edit group settings | Group admin + Messenger permissions |
| `.react ❤️` (reply) | React to a message | Everyone |
| `.reactunsend on/off` | Admin reaction 🗑️/😆 unsends a bot message | Group admin |
| `.reactkick on/off` | Admin reaction 😡/😠 kicks message author | Group admin |
| `.unsend` (reply to a bot message) | Unsend bot message | Group admin |
| `.say`, `.reverse`, `.choose` | Text tools | Everyone |
| `.flip`, `.roll`, `.8ball` | Fun tools | Everyone |
| `.math (3+4)*2`, `.time` | Arithmetic / UTC clock | Everyone |
| `.admin add <id>` | Add bot administrator | Main owner set via ADMIN_IDS |
| `.hello` | Example custom command | Everyone |

**Permissions:** Configure `ADMIN_IDS` to your actual Facebook user ID (comma-separated for multiple owners). Group moderation commands need Messenger group admin permissions and permission for the bot account too. Admin-ID settings do not magically grant Facebook group admin privileges. New bot admins added via `.admin add` get a bot-admin role for custom commands; they don't gain control of Messenger groups.

## Run locally

```bash
npm install
cp .env.example .env
# Edit .env privately; add ADMIN_IDS and either APPSTATE_JSON or FB_COOKIE.
npm start
```

Or create `apostate.json` locally with your own session array; `appstate.json` also works. Both filenames are ignored by git. Node.js v20+ is required. Use `npm test` to run offline tests without connecting to Facebook.

## Add your own command

Copy `commands/custom/hello.js` to `commands/custom/mycommand.js` and edit its `name`, `description`, `usage`, `role`, and `async run(ctx)`. Custom command `role` may be `everyone`, `groupAdmin`, `botAdmin`, or `owner`. The loader validates duplicate names and aliases. Example:

```js
module.exports = {
  name: 'greet',
  aliases: [],
  category: 'Custom',
  description: 'My custom message',
  usage: '',
  role: 'everyone',
  async run(ctx) { await ctx.reply('Hello!'); }
};
```

`ctx` includes `api`, `event`, `threadID`, `senderID`, `group`, `prefix`, `args`, `input`, `reply`, `send`, `info`, `userInfo`, `store`, and `save`.

## Troubleshooting

- **Missing login session:** Set Railway variable `APPSTATE_JSON` or `FB_COOKIE` (not the literal placeholder), or privately create `appstate.json` / `apostate.json` for local execution.
- **Bad JSON:** `APPSTATE_JSON` must be a valid JSON array of cookie objects, not an email, password, Messenger ID, or quoted JS string. The `c_user` and `xs` fields are required.
- **Login/checkpoint/2FA failure:** Re-export a valid session from your own account; do not attempt to bypass security checks. Facebook can invalidate sessions.
- **Bot stays offline:** Confirm successful login in Railway Logs, valid cookies, and the account can access that conversation.
- **Settings reset after deploy:** Attach Railway volume to `/app/data`, then redeploy. Check the logged volume mount path.
- **Group command fails:** Add the Facebook account running the bot as a group administrator where the operation requires it.
- **No replies to E2EE chats:** The library's E2EE bridge or Facebook integration may need updates; check Logs and the package README for current limitations. `listenE2EE` combines events when available.
- **Rapid commands unanswered:** Try a short pause between commands or increase/decrease `COOLDOWN_MS` deliberately.
- **Account locked/restricted:** Stop the bot and resolve account recovery through official Facebook processes. Continuous automation can risk account restrictions.

## Security notes

- **Cookies are equivalent to account access**. Do not share them in chats, screenshots, repositories, logs, issues, or PRs.
- `APPSTATE_JSON` and `FB_COOKIE` are treated as secrets and are never printed by this project.
- Refreshed cookies are stored in `data/appstate.json` with restrictive permissions where possible, and `api.sessionGuard()` provides backups.
- Only run extensions from people you trust. Custom JS commands can access everything the bot process can access.
- Do not run multiple bot replicas with the same session/volume.
- Project stores group settings in local JSON, suitable for small and medium bots; move to a database for serious high-traffic or multi-region use.

## Sources

- [@eryxenx/fca — npm](https://www.npmjs.com/package/@eryxenx/fca)
- [Railway quick start](https://docs.railway.com/quick-start)
- [Railway volumes](https://docs.railway.com/volumes)
