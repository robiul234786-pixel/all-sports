# Allsport — SportScore live scores (ফ্রি সেটআপ)

এই ফোল্ডারের `functions/api/scores.js` হলো Cloudflare Pages Function। এটি SportScore-এর public JSON endpoint থেকে ফুটবল, বাস্কেটবল, ক্রিকেট ও টেনিসের ম্যাচ নেয় এবং Allsport-এর `app.js`-এর প্রত্যাশিত `groups` format-এ পাঠায়।

## গুরুত্বপূর্ণ সীমাবদ্ধতা
- SportScore-এর ফ্রি ব্যবহারে দৃশ্যমান `Powered by SportScore` লিংক রাখতে হবে: https://sportscore.com/
- তাদের ডকুমেন্টেশন অনুযায়ী ফ্রি সীমা আনুমানিক 10,000 request/24h/IP; upstream response 60 সেকেন্ড cache হয়। এই function-এ 55 সেকেন্ডের in-memory cache আছে, কিন্তু serverless instance একাধিক হলে cache ভাগ হয় না।
- SportScore-এর matches endpoint live/recent ম্যাচ দেয়; নির্দিষ্ট তারিখের পূর্ণ আর্কাইভ দেয় না। তাই Allsport-এর তারিখ বেছে নেওয়ার UI আপাতত তারিখের ভিত্তিতে ফলাফল বদলাবে না।
- API response field-এ পরিবর্তন হলে `normalizeMatch()`-এর mapping আপডেট লাগতে পারে। বাস্তব API response পরীক্ষা না করে সব field নিশ্চিত ধরে নেওয়া যাবে না।
- এই function শুধু score feed। `details.js`, `news.js` ও favourite-team অংশ এখনও `/.netlify/functions/...` route ব্যবহার করে; সেগুলো আলাদাভাবে Cloudflare Pages Functions-এ রূপান্তর করতে হবে।

## Android ফোন থেকে GitHub + Cloudflare Pages
1. ZIP extract করো। এই `functions` ফোল্ডারটি Allsport project-এর root-এ রাখবে—`index.html`, `app.js`, `styles.css`-এর পাশে।
2. GitHub-এ Allsport repository খুলে **Add file → Upload files** চাপো। `functions/api/scores.js` path-সহ আপলোড করো (GitHub-এ ফোল্ডার drag-drop সমস্যা হলে আগে `functions` ও `api` ফোল্ডার তৈরি করে ফাইলটি আপলোড করো)।
3. `app.js`-এ এই পুরোনো লাইনটি খুঁজে বের করো:
   ```js
   const response=await fetch(`/.netlify/functions/scores?date=${target}`,{signal:AbortSignal.timeout(12000)});
   ```
4. ওই লাইনের URL-টি `/api/scores` করে দাও:
   ```js
   const response=await fetch(`/api/scores?date=${target}`,{signal:AbortSignal.timeout(12000)});
   ```

5. `index.html`-এ footer-এ দৃশ্যমান attribution link যোগ করো, উদাহরণ:
```html
<a href="https://sportscore.com/" rel="dofollow" target="_blank">Powered by SportScore</a>
```
6. https://dash.cloudflare.com/ এ লগইন করে **Workers & Pages → Create → Pages → Connect to Git** দিয়ে GitHub repository যুক্ত করো। Static HTML app হলে build command ফাঁকা রাখো; output directory হিসেবে repository root (`/`) ব্যবহার করো, যদি dashboard root directory input নেয়।
7. Deploy শেষে Cloudflare Pages-এর URL খুলে score feed পরীক্ষা করো। `/api/scores?date=2026-10-25` খুললে JSON-এ `groups` array দেখা উচিত।

## API সরাসরি পরীক্ষা
- https://sportscore.com/api/widget/matches/?sport=football&limit=10
- https://sportscore.com/api/widget/matches/?sport=cricket&limit=10
- https://sportscore.com/api/widget/matches/?sport=basketball&limit=10
- https://sportscore.com/api/widget/matches/?sport=tennis&limit=10

GitHub Pages একা server-side function চালায় না; তাই `functions/api/scores.js` চালানোর জন্য Cloudflare Pages (Functions support-সহ) বা অন্য compatible serverless host লাগবে.
