// ScrollBuddy Server - Main Express routes
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';
import { mcpHandler } from './mcp-handler.js';

// Load environment variables
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    name: 'ScrollBuddy API',
    status: 'running',
    endpoints: [
      'POST /api/fact-check',
      'POST /api/create-event', 
      'POST /api/add-to-calendar',
      'POST /api/chat',
      'GET /api/history'
    ]
  });
});

// =====================
// FACT-CHECK ENDPOINT
// =====================
app.post('/api/fact-check', async (req, res) => {
  try {
    const { claim, context, userMessage } = req.body;

    if (!claim) {
      return res.status(400).json({ error: 'No claim provided to fact-check' });
    }

    console.log('📋 Fact-checking claim:', claim.substring(0, 100) + '...');

    // Step 1: Search for relevant sources using MCP Brave Search
    let searchResults = [];
    try {
      const searchQuery = claim.length > 100 ? claim.substring(0, 100) : claim;
      searchResults = await mcpHandler.webSearch(searchQuery, 5);
      console.log('🔍 Found sources:', searchResults?.web?.results?.length || 0);
    } catch (error) {
      console.error('Search failed, continuing without sources:', error.message);
    }

    // Format search results for GPT
    let sourcesContext = '';
    let sources = [];
    
    if (searchResults?.web?.results) {
      sources = searchResults.web.results.map(r => ({
        title: r.title,
        url: r.url,
        description: r.description,
        siteName: new URL(r.url).hostname.replace('www.', '')
      }));
      
      sourcesContext = sources.map((s, i) => 
        `Source ${i + 1} (${s.siteName}): "${s.title}"\nURL: ${s.url}\nSnippet: ${s.description}`
      ).join('\n\n');
    }

    // Step 2: Ask GPT to analyze the claim
    const systemPrompt = `You are a professional fact-checker assistant. Analyze claims thoroughly and determine their accuracy.

Your response MUST be valid JSON with this exact structure:
{
  "verdict": "TRUE" | "FALSE" | "PARTIALLY TRUE" | "UNVERIFIABLE",
  "explanation": "A clear 2-3 sentence explanation of your verdict that references specific sources",
  "confidence": 0-100 (your confidence percentage based on source quality and agreement),
  "reasoning": "Detailed reasoning including which sources support or contradict the claim",
  "sourceAnalysis": [
    {
      "sourceName": "Name of the source/publication",
      "supports": true/false,
      "relevance": "How this source relates to the claim"
    }
  ]
}

Guidelines:
- TRUE: Multiple reliable sources confirm the claim
- FALSE: Reliable sources contradict the claim
- PARTIALLY TRUE: Some aspects are correct but context is missing or misleading
- UNVERIFIABLE: Insufficient reliable sources to determine accuracy

IMPORTANT: In your explanation, specifically mention which sources (by name) confirmed or contradicted the claim. For example: "According to Reuters and BBC News, this claim is accurate..."`;

    const userPrompt = `CLAIM TO VERIFY:
"${claim}"

${context ? `PAGE CONTEXT:\n${context}\n` : ''}
${sourcesContext ? `SEARCH RESULTS FROM RELIABLE SOURCES:\n${sourcesContext}` : 'No external sources available - base verdict on general knowledge.'}

${userMessage ? `USER QUESTION: ${userMessage}` : ''}

Analyze this claim carefully, cross-reference the sources, and respond with JSON only.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    // Parse GPT's response
    const responseText = completion.choices[0].message.content;
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      result = {
        verdict: 'UNVERIFIABLE',
        explanation: responseText.substring(0, 200),
        confidence: 50,
        reasoning: responseText
      };
    }

    // Add sources to result
    result.sources = sources.slice(0, 3);
    result.claim = claim;

    // Step 3: Save to history using MCP Filesystem
    try {
      await mcpHandler.saveFactCheck(result);
    } catch (error) {
      console.error('Failed to save to history:', error.message);
    }

    console.log('✅ Fact-check complete:', result.verdict);
    res.json(result);

  } catch (error) {
    console.error('❌ Fact-check error:', error);
    res.status(500).json({ 
      error: 'Failed to fact-check claim',
      details: error.message 
    });
  }
});

// =====================
// CREATE EVENT ENDPOINT
// =====================
app.post('/api/create-event', async (req, res) => {
  try {
    const { message, context } = req.body;

    console.log('📅 Extracting event from:', message?.substring(0, 50) + '...');

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const systemPrompt = `You are an assistant that extracts calendar event details from text. Be LENIENT and HELPFUL - extract what you can and use smart defaults for missing info.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Event title (required - infer from context)",
  "date": "YYYY-MM-DD format (required - use tomorrow if not specified)",
  "time": "HH:MM format 24-hour (use 09:00 if not specified)",
  "location": "Location or empty string",
  "description": "Brief description"
}

CRITICAL RULES:
- TODAY IS ${today.toISOString().split('T')[0]} (YEAR IS 2025)
- ALWAYS use year 2025 or later for dates
- If no specific date: use tomorrow (${tomorrow.toISOString().split('T')[0]})
- If no specific time: use 09:00
- If no location: use empty string
- NEVER ask for more information - just make reasonable assumptions
- "tomorrow" = ${tomorrow.toISOString().split('T')[0]}
- "next week" = add 7 days from today
- "Monday" = next Monday from ${today.toISOString().split('T')[0]}

Only return error if there's absolutely no event-like content at all.`;

    const userPrompt = `Extract calendar event details from this:

USER REQUEST: ${message}

${context ? `PAGE CONTEXT:\n${context}` : ''}

Respond with JSON only.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 512,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content;
    let event;
    
    try {
      event = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(400).json({ error: 'Could not extract event details' });
    }

    if (event.error) {
      return res.status(400).json({ error: event.error });
    }

    console.log('✅ Event extracted:', event.title);
    res.json({ event });

  } catch (error) {
    console.error('❌ Create event error:', error);
    res.status(500).json({ 
      error: 'Failed to extract event',
      details: error.message 
    });
  }
});

// =====================
// ADD TO CALENDAR (n8n webhook)
// =====================
app.post('/api/add-to-calendar', async (req, res) => {
  try {
    const { event } = req.body;
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(500).json({ 
        error: 'Calendar integration not configured',
        details: 'N8N_WEBHOOK_URL not set' 
      });
    }

    console.log('📆 Sending to Google Calendar:', event.title);
    console.log('📆 Event data received:', JSON.stringify(event));

    // Parse date and time properly
    let startDateTime;
    const timeStr = event.time || '09:00';
    
    // Handle various date formats
    if (event.date) {
      // Ensure proper ISO format: YYYY-MM-DDTHH:MM:SS
      const dateStr = event.date.includes('T') ? event.date.split('T')[0] : event.date;
      startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    } else {
      // Default to tomorrow at specified time
      startDateTime = new Date();
      startDateTime.setDate(startDateTime.getDate() + 1);
      const [hours, minutes] = timeStr.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    
    // Validate the date
    if (isNaN(startDateTime.getTime())) {
      console.error('❌ Invalid date:', event.date, event.time);
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    console.log('📆 Parsed start:', startDateTime.toISOString());
    console.log('📆 Parsed end:', endDateTime.toISOString());

    // Send to n8n webhook in exact Google Calendar API format
    const payload = {
      summary: event.title,
      description: `${event.description || ''}${event.location ? '\n\nLocation: ' + event.location : ''}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Los_Angeles'
      },
      location: event.location || ''
    };
    
    console.log('📆 Sending payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(webhookUrl, payload);

    console.log('✅ Calendar event created');
    res.json({ 
      success: true, 
      eventId: response.data?.eventId,
      calendarLink: response.data?.calendarLink 
    });

  } catch (error) {
    console.error('❌ Add to calendar error:', error);
    res.status(500).json({ 
      error: 'Failed to add to calendar',
      details: error.message 
    });
  }
});

// =====================
// CHAT ENDPOINT (general)
// =====================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, selectedText, context, focusMode } = req.body;

    let systemPrompt;
    
    if (focusMode && context) {
      // Focus mode - answer based on article content
      systemPrompt = `You are ScrollBuddy, a helpful browser assistant. You are currently in FOCUS MODE, reading a specific webpage/article.

IMPORTANT RULES:
1. The user is asking about the article content provided in the context
2. ALWAYS look through the article content to find answers to the user's questions
3. If the answer IS in the article, provide it directly with relevant quotes or details
4. If the answer is NOT in the article, say "I couldn't find that information in this article" and then briefly answer from your general knowledge if possible
5. Be concise and helpful
6. If the user wants to add a calendar event, extract the details and respond with a JSON object like: {"createEvent": true, "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM"}

ARTICLE CONTENT:
${context}`;
    } else {
      // Regular mode
      systemPrompt = `You are ScrollBuddy, a helpful browser assistant. You help users:
1. Answer general questions
2. Add events to their calendar - if user mentions an event/date, respond with JSON: {"createEvent": true, "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM" (default 09:00)}
3. Fact-check claims (ask them to use the 📋 button)

Today is ${new Date().toISOString().split('T')[0]}. Be concise and helpful. Don't ask for more details about events - use smart defaults (9AM if no time specified, tomorrow if no date).`;
    }

    const userPrompt = `${message}${selectedText ? `\n\nSelected text: "${selectedText}"` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1024
    });

    const reply = completion.choices[0].message.content;
    
    // Check if response contains event creation request
    try {
      if (reply.includes('"createEvent"')) {
        const jsonMatch = reply.match(/\{[^{}]*"createEvent"[^{}]*\}/s);
        if (jsonMatch) {
          const eventData = JSON.parse(jsonMatch[0]);
          if (eventData.createEvent) {
            return res.json({ 
              reply: `I'll add that to your calendar!`,
              event: {
                title: eventData.title,
                date: eventData.date,
                time: eventData.time || '09:00',
                description: eventData.description || ''
              }
            });
          }
        }
      }
    } catch (e) {
      // Not a JSON response, continue normally
    }

    res.json({ reply });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get response',
      details: error.message 
    });
  }
});

// =====================
// HISTORY ENDPOINT
// =====================
app.get('/api/history', async (req, res) => {
  try {
    const history = await mcpHandler.getHistory();
    res.json({ history });
  } catch (error) {
    console.error('❌ History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await mcpHandler.disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║    ScrollBuddy Server Running          ║
║   http://localhost:${PORT}             ║
╠════════════════════════════════════════╣
║   Endpoints:                           ║
║   • POST /api/fact-check               ║
║   • POST /api/create-event             ║
║   • POST /api/add-to-calendar          ║
║   • POST /api/chat                     ║
║   • GET  /api/history                  ║
╚════════════════════════════════════════╝
  `);
});
