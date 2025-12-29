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
        description: r.description
      }));
      
      sourcesContext = sources.map((s, i) => 
        `Source ${i + 1}: ${s.title}\nURL: ${s.url}\nSnippet: ${s.description}`
      ).join('\n\n');
    }

    // Step 2: Ask GPT to analyze the claim
    const systemPrompt = `You are a fact-checker assistant. Analyze claims and determine their accuracy.

Your response MUST be valid JSON with this exact structure:
{
  "verdict": "TRUE" | "FALSE" | "PARTIALLY TRUE" | "UNVERIFIABLE",
  "explanation": "A clear 1-2 sentence explanation of your verdict",
  "confidence": 0-100 (your confidence percentage),
  "reasoning": "Detailed reasoning for your verdict"
}

Guidelines:
- TRUE: The claim is accurate based on available evidence
- FALSE: The claim is demonstrably incorrect
- PARTIALLY TRUE: The claim contains some truth but is misleading or incomplete
- UNVERIFIABLE: Cannot determine accuracy from available sources

Be objective and base your analysis on the provided sources when available.`;

    const userPrompt = `CLAIM TO VERIFY:
"${claim}"

${context ? `PAGE CONTEXT:\n${context}\n` : ''}
${sourcesContext ? `SEARCH RESULTS:\n${sourcesContext}` : 'No external sources available.'}

${userMessage ? `USER QUESTION: ${userMessage}` : ''}

Analyze this claim and respond with JSON only.`;

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

    const systemPrompt = `You are an assistant that extracts calendar event details from text.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Event title",
  "date": "YYYY-MM-DD format",
  "time": "HH:MM format (24-hour) or null if not specified",
  "location": "Location or null if not specified",
  "description": "Brief description"
}

If you cannot extract a valid event, respond with:
{
  "error": "Reason why event cannot be extracted"
}

Today's date is ${new Date().toISOString().split('T')[0]} for reference.`;

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

    // Send to n8n webhook
    const response = await axios.post(webhookUrl, {
      title: event.title,
      date: event.date,
      time: event.time || '09:00',
      location: event.location || '',
      description: event.description || ''
    });

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
    const { message, selectedText, context } = req.body;

    const systemPrompt = `You are ScrollBuddy, a helpful browser assistant. You help users:
1. Fact-check claims they find online
2. Add events to their calendar
3. Answer questions about web content

Be concise and helpful. If the user wants to fact-check something, ask them to select text on the page first.`;

    const userPrompt = `${message}${selectedText ? `\n\nSelected text: "${selectedText}"` : ''}${context ? `\n\nPage context: ${context}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 512
    });

    res.json({ reply: completion.choices[0].message.content });

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
║   🔍 ScrollBuddy Server Running        ║
║   http://localhost:${PORT}                 ║
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
