# সহজ সেটআপ — SK Goat Bot

## GitHub থেকে Railway

1. `messenger-goat-bot-github.zip` ফাইলটা Extract করো। GitHub-এ নতুন Repository বানিয়ে ZIP-এর ভেতরের source ফাইলগুলো upload করো।
2. Railway → New Project → Deploy from GitHub Repo → তোমার Repository সিলেক্ট করো।
3. Railway → Variables-এ নিচেরগুলো দাও:

   **KEY:** `ADMIN_IDS`  
   **VALUE:** তোমার Facebook numeric account ID

   **KEY:** `APPSTATE_JSON`  
   **VALUE:** নিজের Facebook/Messenger-এর সম্পূর্ণ appstate JSON array

   **KEY:** `PREFIX`  
   **VALUE:** `.`

   **KEY:** `BOT_NAME`  
   **VALUE:** `SK Goat Bot`

4. পূর্ণ appstate JSON না থাকলে `APPSTATE_JSON`-এর বদলে **`FB_COOKIE`** variable ব্যবহার করা যায়। এর VALUE হবে নিজের account-এর cookie header, যেমন `c_user=YOUR_ID; xs=YOUR_SESSION`. তবে সম্পূর্ণ appstate সাধারণত বেশি নির্ভরযোগ্য। শুধু ID দিয়ে login হবে না।
5. Railway Service → Volume → Add Volume → Mount path: `/app/data`।
6. Deploy করে Logs দেখো, তারপর Messenger group-এ `.help`, `.ping` পাঠিয়ে পরীক্ষা করো।

**কুকি, appstate, `.env` অথবা `apostate.json` কখনো GitHub-এ upload করবে না। এগুলো দিয়ে তোমার account-এ login করা সম্ভব। ChatGPT-তেও নিজের আসল cookie পাঠানোর দরকার নেই।**

## apostate.json কীভাবে কাজ করে?

সঠিক নাম `apostate.json` (না যে `apostate.jison`)। Local-এ নিজের ফাইলের মধ্যে JSON array বসালে বট সেটা পড়বে। Railway-এর জন্য `APPSTATE_JSON` secret variable ব্যবহার করাই নিরাপদ। `appstate.example.json` অথবা `apostate.example.json` ফাইলে ফরম্যাট দেখানো আছে।


## Reaction দিয়ে Unsend / Kick

আগে Railway deploy করার পর Messenger group-এ Group Admin account থেকে লিখো:

```
.reactunsend on
.reactkick on
```

তারপর Admin bot-এর নিজের পাঠানো মেসেজে 🗑️ বা 😆 react করলে bot মেসেজ unsend করবে।
অন্য সদস্যের মেসেজে 😡 বা 😠 react করলে ওই সদস্য group থেকে kick হবে।
Bot-এর account-কে Messenger group-এর Admin করতে হবে, এবং react করা user-ও group admin হতে হবে।
Group admin বা bot owner-কে kick করবে না।
Off করতে `.reactunsend off` / `.reactkick off` দাও।
দুটিই default OFF — নিজের group-এ ইচ্ছা করে on করতে হবে।
