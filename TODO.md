- better settings, and fixing settings ui
- automated spam/nsfw detection using openapi or perspective api

- maybe remove gray checkmarks outline
- tell users more clearly about thinks like same name as username = hide username
- move "delete tweet" and similar dialogs to a modal
- modals to bottom sheets on mobile
- unified modals
- emoji usernames for verified users
- customizing profile tab colors

- "tweets.js:57 DOMPurify sanitize failed: TypeError: Illegal invocation at dompurify.js:3:1067 at D (dompurify.js:3:15725) at ot (dompurify.js:3:17909) at At.o.sanitize (dompurify.js:3:21271) at sanitizeSvg (tweets.js:53:20) at renderCustomBadge (tweets.js:126:23) at createTweetElement (tweets.js:1076:20) at addTweetToTimeline (tweets.js:3254:18) at index.js:283:6 at Array.forEach (<anonymous>) sanitizeSvg @ tweets.js:57 tweets.js:57 DOMPurify sanitize failed: TypeError: Illegal invocation at dompurify.js:3:1067 at D (dompurify.js:3:15725) at ot (dompurify.js:3:17909) at At.o.sanitize (dompurify.js:3:21271) at sanitizeSvg (tweets.js:53:20) at renderCustomBadge (tweets.js:126:23) at createTweetElement (tweets.js:1076:20) at createTweetElement (tweets.js:3195:29) at addTweetToTimeline (tweets.js:3254:18) at index.js:283:6 sanitizeSvg @ tweets.js:57 tweets.js:57 DOMPurify sanitize failed: TypeError: Illegal invocation at dompurify.js:3:1067 at D (dompurify.js:3:15725) at ot (dompurify.js:3:17909) at At.o.sanitize (dompurify.js:3:21271) at sanitizeSvg (tweets.js:53:20) at renderCustomBadge (tweets.js:126:23) at createTweetElement (tweets.js:1076:20) at addTweetToTimeline (tweets.js:3254:18) at index.js:283:6 at Array.forEach (<anonymous>)"

- fix limited amount of replies being shown on tweets with a huge replies count

**other things:**

- personalized algorithm + onboarding
- installation cli guide

- finish proper rate-limiting
- use Bun's SQL driver instead of sqlite since it's async

- tweetapus circles like twiter circle

- look into all XSS and similar vulnerabitilies
- optimize client and server

**Joke:**

- @Bangers account automatically quoting tweets with more than 5 likes with "Certified xeetapus banger👑" (could be made an extension maybe)
- make Tr Cursor no longer stuck
