# ScrollBuddy Architecture

## System Overview

ScrollBuddy is a browser-based AI assistant that enables users to fact-check claims, create calendar events, and manage tasks directly from any webpage. The system uses a three-tier architecture with a Chrome extension frontend, Node.js backend, and external AI/automation services.

---

## Tech Stack

### **Frontend (Chrome Extension)**
- **Platform**: Chrome Extension (Manifest V3)
- **Languages**: JavaScript (ES6+), HTML5, CSS3
- **Components**:
  - Content Script: Page interaction and text selection
  - Service Worker: Background event handling
  - Popup UI: User interface for chat and controls
- **APIs**: Chrome Extensions API (activeTab, storage, scripting)

### **Backend (Node.js Server)**
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Language**: JavaScript (ES Modules)
- **Key Libraries**:
  - `@anthropic-ai/sdk` (^0.71.2) - Claude AI integration
  - `@modelcontextprotocol/sdk` (^1.25.1) - MCP protocol
  - `axios` (^1.13.2) - HTTP client
  - `cors` (^2.8.5) - CORS middleware
  - `dotenv` (^17.2.3) - Environment configuration
  - `openai` (^6.15.0) - OpenAI API integration

### **AI & Data Services**
- **AI Provider**: Anthropic Claude API
- **Search Provider**: Brave Search API
- **Web Search**: Model Context Protocol (MCP) integration
- **Automation**: n8n workflow automation
- **Calendar**: Google Calendar API (via n8n webhook)
- **Tasks**: Google Tasks API (via n8n webhook)

### **Data Storage**
- **Local Storage**: Chrome Extension Storage API (user preferences, history)
- **File System**: `.scrollbuddy/` directory for fact-check history and configuration

---

## Architecture Components

### **1. Chrome Extension (Client)**
**Components:**
- **popup.html/popup.js/popup.css**: Main user interface
  - Chat interface for AI interactions
  - Tab navigation (Chat, Calendar/Tasks, History)
  - Focus mode for page analysis
  - Event and task creation interface
  - **UI Elements**:
    - Logo: `assets/Gemini_Generated_Image_6czz1h6czz1h6czz.PNG`
    - Verify icon: `<i class="fa-solid fa-check"></i>` (FontAwesome)
    - MCP Tools button (`...`): Opens dropdown with Google Calendar and Google Tasks options
    - Calendar icon: `Google_Calendar_icon_(2020).svg.png`
    - Tasks icon: `googletasks.png`

- **content.js**: Content script injected into web pages
  - Text selection capture
  - Page context extraction
  - Message passing to extension

- **service-worker.js**: Background service worker
  - Context menu management
  - Message routing between components
  - Extension lifecycle management

**Data Flow:**
1. User selects text on webpage
2. Content script captures selection and page context
3. Service worker routes messages
4. Popup sends requests to backend API
5. Response displayed in popup interface

### **2. Node.js Backend Server**
**Main Components:**

**server.js** - Express API Server
- RESTful API endpoints
- Request handling and routing
- Response formatting

**mcp-handler.js** - Model Context Protocol Integration
- Brave Search API integration for web searches
- Local filesystem operations
- Fact-check data storage and retrieval

**API Endpoints:**
- `GET /api/health` - Health check
- `POST /api/fact-check` - Claim verification with web search
- `POST /api/create-event` - Extract event details from text (calendar or task)
- `POST /api/add-to-calendar` - Send event to n8n Google Calendar webhook
- `POST /api/add-to-tasks` - Send task to n8n Google Tasks webhook
- `POST /api/chat` - General AI chat with page context
- `GET /api/history` - Retrieve fact-check history

### **3. External Services**

**Anthropic Claude API**
- Natural language understanding
- Claim analysis and verification
- Event information extraction
- Conversational responses

**Brave Search API**
- Real-time web search results
- Source verification for fact-checking
- Context gathering for claims

**n8n Automation**
- Webhook endpoints for calendar events and tasks
- Google Calendar integration
- Google Tasks integration
- Event and task scheduling automation

**Google Calendar API**
- Calendar event creation
- Event management (via n8n)
- Used for time-bound events with specific start/end times

**Google Tasks API**
- Task creation and management (via n8n)
- Used for to-do items and action items without specific times

---

## Data Flow Architecture

### **Fact-Check Flow**
```
1. User selects text on webpage
   ↓
2. Extension captures selection + page context
   ↓
3. POST /api/fact-check
   ↓
4. Backend: Brave Search API query (via MCP)
   ↓
5. Backend: Claude AI analysis with search results
   ↓
6. Backend: Save to .scrollbuddy/fact-checks.json
   ↓
7. Response returned to extension
   ↓
8. Display in popup UI + store in local history
```

### **Calendar Event Flow**
```
1. User provides event text/context
   ↓
2. POST /api/create-event
   ↓
3. Backend: Claude AI analyzes and determines type (calendar vs task)
   ↓
4. If calendar event: Extract date, time, duration, location
   ↓
5. User confirms/edits event details
   ↓
6. POST /api/add-to-calendar
   ↓
7. Backend: Send to n8n Google Calendar webhook
   ↓
8. n8n: Create Google Calendar event
   ↓
9. Confirmation returned to user
```

### **Google Tasks Flow**
```
1. User provides task text/context
   ↓
2. POST /api/create-event
   ↓
3. Backend: Claude AI analyzes and determines type (calendar vs task)
   ↓
4. If task: Extract title, notes, due date (optional)
   ↓
5. User confirms/edits task details
   ↓
6. POST /api/add-to-tasks
   ↓
7. Backend: Send to n8n Google Tasks webhook
   ↓
8. n8n: Create Google Task
   ↓
9. Confirmation returned to user
```

### **Chat Flow**
```
1. User types message in popup
   ↓
2. POST /api/chat (includes page context if available)
   ↓
3. Backend: Claude AI processes request
   ↓
4. Response streamed back to extension
   ↓
5. Display in chat interface
```

---

## Security & Configuration

### **Environment Variables**
- `OPENAI_API_KEY` - OpenAI API authentication
- `ANTHROPIC_API_KEY` - Claude AI authentication
- `BRAVE_API_KEY` - Brave Search API authentication
- `N8N_CALENDAR_WEBHOOK_URL` - n8n Google Calendar webhook endpoint
- `N8N_TASKS_WEBHOOK_URL` - n8n Google Tasks webhook endpoint
- `DATA_PATH` - Local data storage path (default: `.scrollbuddy/`)
- `PORT` - Server port (default: 3000)

### **Security Considerations**
- API keys stored in `.env` (not in version control)
- CORS enabled for localhost extension origin
- Chrome extension host permissions for localhost:3000
- Content Security Policy via Manifest V3

---

## Deployment Architecture

### **Development**
- Extension: Load unpacked in Chrome Developer Mode
- Backend: `npm run dev` with hot reload (`--watch` flag)
- Local n8n workflow for calendar integration

### **Production Considerations**
- Extension: Package as `.crx` and publish to Chrome Web Store
- Backend: Deploy to cloud platform (e.g., Vercel, Railway, AWS)
- n8n: Self-hosted or cloud instance
- Environment-specific API endpoints

---

## Architecture Diagram Prompt

**Use this prompt with diagram generation tools (e.g., Mermaid, Draw.io, Excalidraw):**

```
Create a system architecture diagram for ScrollBuddy with the following components:

1. **User Layer**:
   - Browser with webpage
   - User selects text or interacts with content

2. **Chrome Extension Layer** (Frontend):
   - Content Script (injected into webpage)
   - Service Worker (background process)
   - Popup UI (user interface)
   - Show data flow between these components

3. **Backend Layer** (Node.js Server):
   - Express API Server (port 3000)
   - MCP Handler for search and filesystem
   - Show API endpoints: /api/fact-check, /api/chat, /api/create-event, /api/add-to-calendar, /api/history

4. **External Services Layer**:
   - Anthropic Claude API (AI processing)
   - Brave Search API (web search)
   - n8n Automation Platform
   - Google Calendar API
   - Google Tasks API

5. **Data Storage**:
   - Chrome Local Storage (user data, history)
   - .scrollbuddy/ directory (fact-check logs, config)

6. **UI Elements**:
   - Logo: ScrollBuddy logo (assets/Gemini_Generated_Image_6czz1h6czz1h6czz.PNG)
   - Verify button: FontAwesome check icon (<i class="fa-solid fa-check"></i>)
   - MCP Tools dropdown (...): Opens Google Calendar and Google Tasks options
   - Google Calendar icon (Google_Calendar_icon_(2020).svg.png)
   - Google Tasks icon (googletasks.png)

Show the following flows with arrows:
- Fact-check flow: User → Extension → Backend → Brave Search → Claude AI → Storage → Response
- Calendar flow: User → Extension → Backend → Claude AI → n8n → Google Calendar → Confirmation
- Tasks flow: User → Extension → Backend → Claude AI → n8n → Google Tasks → Confirmation
- Chat flow: User → Extension → Backend → Claude AI → Response

Use colors to distinguish:
- Frontend components (blue)
- Backend components (green)
- External services (orange)
- Data storage (purple)

Include icons/symbols for:
- Browser extension icon (ScrollBuddy logo)
- Server/API icon
- AI/brain icon for Claude
- Search icon for Brave
- Calendar icon for Google Calendar
- Tasks/checklist icon for Google Tasks
- Automation icon for n8n
```

---

## Key Design Decisions

1. **Manifest V3**: Modern Chrome extension architecture with service workers
2. **ES Modules**: Modern JavaScript syntax throughout backend
3. **Direct API Integration**: Custom MCP handler instead of MCP SDK stdio for better control
4. **Stateless Backend**: Each request is independent, no session management
5. **Client-Side History**: Fact-check history stored in extension storage for privacy
6. **Webhook Integration**: n8n webhooks for flexible calendar and task automation
7. **CORS-Enabled**: Backend accessible from extension context
8. **AI-Powered Classification**: Claude AI determines calendar vs task based on content analysis

---

## AI Prompt for Calendar vs Tasks Classification

**System Prompt for Claude AI to distinguish between Calendar Events and Tasks:**

```
You are an intelligent assistant that helps users organize information from web pages into either Google Calendar events or Google Tasks.

ANALYZE the user's input and DETERMINE whether it should be a:

### GOOGLE CALENDAR EVENT
Use when the content describes:
- Scheduled meetings or appointments with specific date AND time
- Events with a defined start and end time (e.g., "Meeting at 3pm-4pm")
- Conferences, webinars, or live events with scheduled times
- Deadlines with specific times (e.g., "Submit by Friday 5pm")
- Recurring events with time patterns (e.g., "Weekly standup every Monday 9am")
- Social gatherings, parties, or celebrations with set times
- Travel itineraries with departure/arrival times

Calendar Event Response Format:
{
  "type": "calendar",
  "title": "Event title",
  "startDate": "2025-12-29T14:00:00",
  "endDate": "2025-12-29T15:00:00",
  "location": "Location if mentioned",
  "description": "Additional details",
  "allDay": false
}

### GOOGLE TASKS
Use when the content describes:
- To-do items without specific times (e.g., "Read chapter 5")
- Action items or reminders (e.g., "Remember to call John")
- Goals or objectives without scheduled times
- Items with only a due date, no specific time (e.g., "Due by Friday")
- Shopping lists or checklist items
- Follow-up actions from articles or emails
- Tasks that can be completed anytime before a deadline
- Notes or reminders to self

Task Response Format:
{
  "type": "task",
  "title": "Task title",
  "notes": "Additional details or context",
  "dueDate": "2025-12-29" (optional, date only, no time)
}

### CLASSIFICATION RULES:
1. If there's a specific TIME mentioned → Calendar Event
2. If there's only a DATE or no date at all → Task
3. If it's an "event" you attend → Calendar Event
4. If it's something you "do" or "complete" → Task
5. If duration matters (start-end) → Calendar Event
6. If completion matters (done/not done) → Task

### EXAMPLES:

Input: "Team meeting tomorrow at 2pm in Conference Room A"
Output: { "type": "calendar", "title": "Team meeting", "startDate": "...", "location": "Conference Room A" }

Input: "Don't forget to review the quarterly report before Friday"
Output: { "type": "task", "title": "Review quarterly report", "dueDate": "2025-01-03" }

Input: "The webinar starts at 10am EST on January 5th"
Output: { "type": "calendar", "title": "Webinar", "startDate": "2025-01-05T10:00:00-05:00" }

Input: "Need to buy groceries this week"
Output: { "type": "task", "title": "Buy groceries", "notes": "This week" }

Input: "Project deadline is December 31st at midnight"
Output: { "type": "calendar", "title": "Project deadline", "startDate": "2025-12-31T23:59:00", "allDay": false }

Input: "Finish reading the article about AI trends"
Output: { "type": "task", "title": "Finish reading AI trends article" }
```

---

## MCP Tools Integration

### Available MCP Tools
The extension provides a `...` (ellipsis) button that opens a dropdown menu with available MCP tools:

| Tool | Icon | Description |
|------|------|-------------|
| **Verify/Fact-Check** | `<i class="fa-solid fa-check"></i>` | Verify selected text against web sources |
| **Google Calendar** | `Google_Calendar_icon_(2020).svg.png` | Create calendar events from selected text |
| **Google Tasks** | `googletasks.png` | Create tasks from selected text |

### n8n Webhook Configuration

**Google Calendar Webhook:**
```
URL: https://[your-n8n-instance]/webhook/calendar-event
Method: POST
Content-Type: application/json
Body: {
  "title": "Event title",
  "startDate": "ISO 8601 datetime",
  "endDate": "ISO 8601 datetime",
  "location": "Optional location",
  "description": "Optional description"
}
```

**Google Tasks Webhook:**
```
URL: https://[your-n8n-instance]/webhook/google-task
Method: POST
Content-Type: application/json
Body: {
  "title": "Task title",
  "notes": "Optional notes",
  "dueDate": "YYYY-MM-DD (optional)"
}
```

---

