# ScrollBuddy

<p align="center">
  <img src="assets/Gemini_Generated_Image_6czz1h6czz1h6czz.PNG" alt="ScrollBuddy Logo" width="120">
</p>

**ScrollBuddy** is a Chrome extension that helps you fact-check claims, manage tasks, and create calendar events directly from any webpage. Powered by OpenAI GPT-4 and integrated with Google Calendar & Tasks via n8n automation.

## ✨ Key Features

- **Verify Claims** - Select text on any webpage and instantly fact-check it against multiple web sources using Brave Search + AI analysis
- **Google Calendar** - Extract event details from text and add them to your Google Calendar with natural language
- **Google Tasks** - Create to-do items and reminders directly from any webpage
- **Read Page Mode** - Analyze entire webpage content and ask questions about it
- **History Tracking** - Keep a local record of all fact-checks for future reference

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Chrome Extension (Manifest V3) |
| **Backend** | Node.js + Express.js |
| **AI** | OpenAI GPT-4o-mini |
| **Search** | Brave Search API |
| **Automation** | n8n Workflows |
| **Integrations** | Google Calendar API, Google Tasks API |

---

## 📁 Project Structure

```
ScrollBuddy/
├── scrollbuddy-extension/     # Chrome extension
│   ├── manifest.json          # Extension configuration
│   ├── popup/                 # UI (HTML, CSS, JS)
│   ├── content/               # Content scripts
│   ├── background/            # Service worker
│   └── icons/                 # Extension icons
├── scrollbuddy-server/        # Node.js backend
│   ├── server.js              # Express API server
│   ├── mcp-handler.js         # Brave Search + filesystem
│   └── package.json           # Dependencies
├── assets/                    # Project assets
├── .scrollbuddy/              # Data storage (fact-checks)
├── Architecture.md            # System architecture docs
└── .env                       # Environment variables
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Chrome browser
- API Keys:
  - OpenAI API key
  - Brave Search API key
- n8n instance (cloud or self-hosted) with:
  - Google Calendar webhook workflow
  - Google Tasks webhook workflow

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ScrollBuddy.git
   cd ScrollBuddy
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_key
   BRAVE_API_KEY=your_brave_search_key
   N8N_WEBHOOK_URL=https://your-n8n/webhook/calendar-event
   N8N_TASKS_WEBHOOK_URL=https://your-n8n/webhook/google-tasks
   ```

3. **Install dependencies & start server**
   ```bash
   cd scrollbuddy-server
   npm install
   npm run dev
   ```

4. **Load the Chrome extension**
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `scrollbuddy-extension` folder

## 📖 Usage

### Verify Claims
1. Select text on any webpage
2. Click the ✓ (verify) button in the extension
3. View the fact-check result with sources

### Add to Google Calendar
1. Click the `...` button → Google Calendar
2. Enter event details (e.g., "Meeting tomorrow at 3pm")
3. Confirm and add to calendar

### Add to Google Tasks
1. Click the `...` button → Google Tasks
2. Enter task (e.g., "Buy groceries")
3. Confirm and add to tasks

### Read Page Mode
1. Click "Read Page" button
2. Ask questions about the current webpage
3. Get AI-powered answers based on page content

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/fact-check` | Verify a claim with web search |
| POST | `/api/create-event` | Extract event/task from text |
| POST | `/api/add-to-calendar` | Add event to Google Calendar |
| POST | `/api/add-to-tasks` | Add task to Google Tasks |
| POST | `/api/chat` | General AI chat |
| GET | `/api/history` | Get fact-check history |

## 📄 License

ISC License

---
