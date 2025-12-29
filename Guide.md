# ScrollBuddy

Chrome Extension + Node Server + Claude API
MCP: Brave Search + Filesystem
n8n → Google Calendar API
Demo-ready polish


Hour-by-Hour Checklist
Hours 0-3: Foundation

 Create scrollbuddy-server/ and scrollbuddy-extension/ folders
 Server: npm init, install express, @anthropic-ai/sdk, @modelcontextprotocol/sdk, cors, axios
 Extension: manifest.json, popup.html/js/css, content.js, service-worker.js
 Get API keys: Anthropic, Brave Search
 Install MCP servers: npx @modelcontextprotocol/server-brave-search, filesystem
 Create ~/.scrollbuddy/ folder structure
 Start n8n: npx n8n
 Setup Google Calendar API credentials in n8n
 Test: Extension loads, server responds, MCP servers start


Hours 3-8: Fact-Check Feature

 Content script: extract selected text + page context (use @mozilla/readability)
 Server route: POST /api/fact-check

 Connect to MCP Brave Search
 Call Claude with system prompt for fact-checking
 Return JSON: {verdict, explanation, confidence, sources[]}


 MCP Filesystem: save to ~/.scrollbuddy/fact-checks/history.json
 Extension UI:

 Input field + "Fact-Check" button
 Loading spinner
 Result card: verdict badge (color-coded), explanation, confidence bar, sources list
 "Save to History" button


 Test on 3 different articles (true/false/partial claims)


Hours 8-14: Calendar Feature

 Server route: POST /api/create-event

 Claude extracts: title, date, time, location from user message + page content
 Return structured event JSON


 n8n workflow: "Create Calendar Event"

 Webhook trigger: POST /webhook/create-event
 Function node: format event data
 Google Calendar node: create event with reminder
 Return: {success, eventId, calendarLink}


 Extension UI:

 Chat input: "add this to my calendar"
 Event preview card (editable: title, date, time, location)
 "Add to Calendar" button
 Success message with calendar link


 Test: create event from article about museum/conference/concert


Hours 14-18: Integration & Polish

 Extension popup: tabs for "Fact-Check" and "Calendar"
 Add "View History" tab showing saved fact-checks
 Error handling: API failures, rate limits, network issues
 Loading states: smooth animations
 Styling: Tailwind, consistent colors, hover effects
 Toast notifications for success/error
 Keyboard shortcuts (Enter to submit)
 Test full flow: fact-check → create event on same article


Hours 18-22: Demo Prep

 Find 2 demo articles:

Tech news with verifiable claim
Event announcement (museum/conference)


 Practice demo script:

Show article, highlight claim
Fact-check in 5 seconds
Type "add to calendar"
Show event created in Google Calendar
Show saved history


 Record demo video (2-3 min)
 Create simple slides (problem → solution → demo)
 Test on fresh Chrome profile
 Fix any bugs found during practice


Hours 22-24: Buffer & Final Touches

 Add extension icon/logo
 README with setup instructions
 Handle edge cases discovered
 Final demo run-through
 Prepare for questions


Key Files Structure
scrollbuddy-server/
├── server.js (main routes)
├── mcp-handler.js (Brave Search + Filesystem)
└── package.json

scrollbuddy-extension/
├── manifest.json
├── popup/
│   ├── popup.html (fact-check + calendar UI)
│   ├── popup.js (API calls, UI updates)
│   └── popup.css (Tailwind)
├── content/content.js (page extraction)
└── background/service-worker.js

~/.scrollbuddy/
├── fact-checks/history.json
└── config/settings.json

Demo Script (60 seconds)
Setup: Article about "New AI Museum Opening Jan 15 in SF"

(10s) "I'm reading this article and see a claim about the opening date"
(5s) Highlight text → Click extension → "Fact-Check"
(5s) Shows: ✅ TRUE - Verified from 3 sources
(10s) "Now I want to visit this museum"
(5s) Type: "add museum visit to my calendar"
(10s) Shows event preview → Click "Add to Calendar"
(10s) Success! → Switch to Google Calendar → Event is there
(5s) Back to extension → Show fact-check history saved

Wow factor: "ScrollBuddy verified the claim in real-time AND created a calendar event - all from one article in 30 seconds"

Must-Have vs Nice-to-Have
Must-Have (Don't Skip)

✅ Fact-check with verdict + sources
✅ Calendar event creation
✅ Basic history saving
✅ Clean UI with Tailwind
✅ Working demo on real articles

Nice-to-Have (Skip if Behind)

⏭️ Edit event details before adding
⏭️ Search fact-check history
⏭️ Multiple calendar accounts
⏭️ Chrome right-click context menu
⏭️ Keyboard shortcuts