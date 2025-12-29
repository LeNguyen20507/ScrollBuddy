# ScrollBuddy Architecture

## System Overview

ScrollBuddy is a browser-based AI assistant that enables users to fact-check claims and create calendar events directly from any webpage. The system uses a three-tier architecture with a Chrome extension frontend, Node.js backend, and external AI/automation services.

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

### **Data Storage**
- **Local Storage**: Chrome Extension Storage API (user preferences, history)
- **File System**: `.scrollbuddy/` directory for fact-check history and configuration

---

## Architecture Components

### **1. Chrome Extension (Client)**
**Components:**
- **popup.html/popup.js/popup.css**: Main user interface
  - Chat interface for AI interactions
  - Tab navigation (Chat, Calendar, History)
  - Focus mode for page analysis
  - Event creation interface

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
- `POST /api/create-event` - Extract event details from text
- `POST /api/add-to-calendar` - Send event to n8n webhook
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
- Webhook endpoint for calendar events
- Google Calendar integration
- Event scheduling automation

**Google Calendar API**
- Calendar event creation
- Event management (via n8n)

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
3. Backend: Claude AI extracts event details
   ↓
4. User confirms/edits event details
   ↓
5. POST /api/add-to-calendar
   ↓
6. Backend: Send to n8n webhook
   ↓
7. n8n: Create Google Calendar event
   ↓
8. Confirmation returned to user
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
- `N8N_WEBHOOK_URL` - n8n calendar webhook endpoint
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

5. **Data Storage**:
   - Chrome Local Storage (user data, history)
   - .scrollbuddy/ directory (fact-check logs, config)

Show the following flows with arrows:
- Fact-check flow: User → Extension → Backend → Brave Search → Claude AI → Storage → Response
- Calendar flow: User → Extension → Backend → Claude AI → n8n → Google Calendar → Confirmation
- Chat flow: User → Extension → Backend → Claude AI → Response

Use colors to distinguish:
- Frontend components (blue)
- Backend components (green)
- External services (orange)
- Data storage (purple)

Include icons/symbols for:
- Browser extension icon
- Server/API icon
- AI/brain icon for Claude
- Search icon for Brave
- Calendar icon for Google Calendar
- Automation icon for n8n
```

---

## Key Design Decisions

1. **Manifest V3**: Modern Chrome extension architecture with service workers
2. **ES Modules**: Modern JavaScript syntax throughout backend
3. **Direct API Integration**: Custom MCP handler instead of MCP SDK stdio for better control
4. **Stateless Backend**: Each request is independent, no session management
5. **Client-Side History**: Fact-check history stored in extension storage for privacy
6. **Webhook Integration**: n8n webhook for flexible calendar automation
7. **CORS-Enabled**: Backend accessible from extension context

---

