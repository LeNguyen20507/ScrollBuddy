# ScrollBuddy

**ScrollBuddy** is a Chrome extension that helps you fact-check claims and create calendar events directly from any webpage you're reading. Powered by Claude AI and Model Context Protocol (MCP), it combines real-time web search with intelligent information extraction.

## Key Features

- **Fact-Check Claims**: Select text on any webpage and instantly verify it against multiple web sources with AI-powered analysis
- **Smart Calendar Integration**: Automatically extract event details from articles and add them to Google Calendar with natural language
- **History Tracking**: Keep a local record of all fact-checks for future reference
- **Seamless UX**: Works directly in your browser with a clean, intuitive popup interface

## Tech Stack

- **Frontend**: Chrome Extension (Manifest V3)
- **Backend**: Node.js + Express
- **AI**: Claude API (Anthropic)
- **Data Retrieval**: MCP (Brave Search + Filesystem)
- **Automation**: n8n + Google Calendar API + Google Tasks API

---

## Project Structure

```
ScrollBuddy/
├── scrollbuddy-server/        # Node.js backend
├── scrollbuddy-extension/     # Chrome extension
└── .scrollbuddy/             # Data storage (fact-checks, config)
```

## Getting Started

**Prerequisites:**
- Node.js 18+
- Chrome browser
- API keys: Anthropic (Claude), Brave Search
- Google Calendar API credentials (for n8n)

**Setup instructions coming soon...**
