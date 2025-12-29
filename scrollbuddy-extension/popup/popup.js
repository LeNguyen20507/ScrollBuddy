// ScrollBuddy Popup - API calls and UI updates

const API_URL = 'http://localhost:3000';

// DOM Elements
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const getSelectionBtn = document.getElementById('get-selection');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const historyList = document.getElementById('history-list');
const focusBtn = document.getElementById('focus-btn');
const focusBanner = document.getElementById('focus-banner');
const focusTitle = document.getElementById('focus-title');
const focusClose = document.getElementById('focus-close');
const clearHistoryBtn = document.getElementById('clear-history');
const mcpToolsBtn = document.getElementById('mcp-tools-btn');
const mcpToolsDropdown = document.getElementById('mcp-tools-dropdown');
const addCalendarBtn = document.getElementById('add-calendar-btn');
const addTaskBtn = document.getElementById('add-task-btn');

// State
let selectedText = '';
let pageContext = '';
let focusMode = false;
let focusedPageContent = '';
let focusedPageTitle = '';
let focusedPageUrl = '';
let currentTabId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab ID for per-tab storage
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;
  
  loadHistory();
  setupEventListeners();
  autoResizeTextarea();
  restoreFocusMode();
  restoreTabChat();
});

// Restore per-tab chat history from session storage
async function restoreTabChat() {
  if (!currentTabId) return;
  
  const key = `chat_${currentTabId}`;
  const result = await chrome.storage.session.get([key]);
  
  if (result[key] && result[key].messages) {
    // Clear default welcome message
    messagesContainer.innerHTML = '';
    
    // Restore saved messages
    result[key].messages.forEach(msg => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.type}`;
      messageDiv.innerHTML = msg.html;
      messagesContainer.appendChild(messageDiv);
    });
    
    scrollToBottom();
  }
}

// Save current chat to session storage (per-tab)
async function saveTabChat() {
  if (!currentTabId) return;
  
  const key = `chat_${currentTabId}`;
  const messages = Array.from(messagesContainer.querySelectorAll('.message')).map(msg => ({
    type: msg.classList.contains('user') ? 'user' : 'assistant',
    html: msg.innerHTML
  }));
  
  await chrome.storage.session.set({ [key]: { messages } });
}

// Restore focus mode state from per-tab session storage
async function restoreFocusMode() {
  if (!currentTabId) return;
  
  const key = `focus_${currentTabId}`;
  const result = await chrome.storage.session.get([key]);
  
  if (result[key] && result[key].focusMode) {
    focusMode = true;
    focusedPageContent = result[key].focusedPageContent || '';
    focusedPageTitle = result[key].focusedPageTitle || '';
    focusedPageUrl = result[key].focusedPageUrl || '';
    
    // Restore UI state
    focusBtn.classList.add('active');
    focusBanner.style.display = 'flex';
    focusTitle.textContent = focusedPageTitle.length > 40 ? focusedPageTitle.substring(0, 40) + '...' : focusedPageTitle;
  }
}

// Event Listeners
function setupEventListeners() {
  // Send message
  sendBtn.addEventListener('click', handleSend);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Get selection from page (fact-check)
  getSelectionBtn.addEventListener('click', getSelectedText);

  // Focus mode
  focusBtn.addEventListener('click', toggleFocusMode);
  focusClose.addEventListener('click', exitFocusMode);

  // MCP Tools dropdown
  mcpToolsBtn.addEventListener('click', toggleMcpDropdown);
  addCalendarBtn.addEventListener('click', () => extractEventFromPage('calendar'));
  addTaskBtn.addEventListener('click', () => extractEventFromPage('task'));
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!mcpToolsBtn.contains(e.target) && !mcpToolsDropdown.contains(e.target)) {
      mcpToolsDropdown.classList.remove('show');
    }
  });

  // Clear history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Auto-resize textarea
  userInput.addEventListener('input', autoResizeTextarea);
}

// Toggle MCP Tools dropdown
function toggleMcpDropdown(e) {
  e.stopPropagation();
  mcpToolsDropdown.classList.toggle('show');
}

// Auto-resize textarea
function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
}

// Tab switching
function switchTab(tabName) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Get selected text from page and auto fact-check
async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const selection = window.getSelection().toString().trim();
        const pageContent = document.body.innerText.substring(0, 2000);
        return { selection, pageContent, url: window.location.href, title: document.title };
      }
    });

    if (results && results[0] && results[0].result) {
      const { selection, pageContent, url, title } = results[0].result;
      
      if (selection) {
        selectedText = selection;
        pageContext = `Page: ${title}\nURL: ${url}\nContent: ${pageContent}`;
        
        // Auto-trigger fact-check with typing indicator
        const typingId = showTyping();
        
        try {
          const response = await factCheck(selectedText, pageContext, 'Verify this claim');
          removeTyping(typingId);
          
          if (response.verdict) {
            addFactCheckResult(response);
            saveToHistory(response);
          } else if (response.error) {
            addMessage(response.error, 'assistant');
          }
        } catch (error) {
          removeTyping(typingId);
          addMessage('Failed to fact-check. Please try again.', 'assistant');
        }
        
        // Clear selection after checking
        selectedText = '';
        pageContext = '';
        
      } else {
        showToast('No text selected on page', 'error');
      }
    }
  } catch (error) {
    console.error('Error getting selection:', error);
    showToast('Could not get selection', 'error');
  }
}

// =====================
// FOCUS MODE
// =====================
async function toggleFocusMode() {
  if (focusMode) {
    exitFocusMode();
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we can access this page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      showToast('Cannot access this page', 'error');
      addMessage('⚠️ I cannot read browser system pages. Please navigate to a regular website.', 'assistant');
      return;
    }

    showToast('Reading page...', 'success');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Try to get main article content
        const article = document.querySelector('article');
        const main = document.querySelector('main');
        const body = document.body;
        
        let content = '';
        
        // Try to get article text first
        if (article) {
          content = article.innerText;
        } else if (main) {
          content = main.innerText;
        } else {
          content = body.innerText;
        }
        
        // Limit content length
        const maxLength = 8000;
        if (content.length > maxLength) {
          content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
        }
        
        return {
          content: content,
          title: document.title,
          url: window.location.href,
          success: content.length > 100
        };
      }
    });

    if (results && results[0] && results[0].result) {
      const { content, title, url, success } = results[0].result;
      
      if (success) {
        focusMode = true;
        focusedPageContent = content;
        focusedPageTitle = title;
        focusedPageUrl = url;
        
        // Save to per-tab session storage for persistence
        const key = `focus_${currentTabId}`;
        await chrome.storage.session.set({
          [key]: {
            focusMode: true,
            focusedPageContent: content,
            focusedPageTitle: title,
            focusedPageUrl: url
          }
        });
        
        // Update UI
        focusBtn.classList.add('active');
        focusBanner.style.display = 'flex';
        focusTitle.textContent = title.length > 40 ? title.substring(0, 40) + '...' : title;
        
        addMessage(`📖 **Focus Mode Active**\n\nI'm now reading: "${title}"\n\nAsk me anything about this article! I can summarize it, answer questions, or help you understand specific parts.`, 'assistant');
        
        showToast('Focus mode active!', 'success');
      } else {
        addMessage('⚠️ I was blocked from reading this page\'s content. This might be due to site restrictions or paywall. Try selecting specific text instead using the 📋 button.', 'assistant');
      }
    }
  } catch (error) {
    console.error('Focus mode error:', error);
    addMessage('⚠️ I couldn\'t access this page. Some websites block content reading. Try using the 📋 button to select specific text instead.', 'assistant');
  }
}

// Prompt user to add calendar event or task
async function extractEventFromPage(forceType = null) {
  // Close dropdown
  mcpToolsDropdown.classList.remove('show');
  
  const isTask = forceType === 'task';
  const promptText = isTask 
    ? '✅ What task would you like to add?\n\nExample: "Read chapter 5" or "Call John about the project"'
    : '📅 What event would you like to add?\n\nExample: "Meeting tomorrow at 2pm" or "Flight to LA on Jan 5"';
  
  const eventText = prompt(promptText);
  
  if (!eventText || !eventText.trim()) {
    return; // User cancelled
  }
  
  const icon = isTask ? '✅' : '📅';
  addMessage(`${icon} Adding: "${eventText}"`, 'user');
  
  const typingId = showTyping();
  
  try {
    const response = await createEvent(eventText, '', forceType);
    removeTyping(typingId);
    
    if (response.type === 'task' && response.task) {
      addTaskPreview(response.task);
    } else if (response.event) {
      addEventPreview(response.event);
    } else if (response.error) {
      addMessage(`⚠️ ${response.error}`, 'assistant');
    } else {
      addMessage('⚠️ Could not understand the request. Try being more specific.', 'assistant');
    }
  } catch (error) {
    removeTyping(typingId);
    addMessage('❌ Failed to process. Please try again.', 'assistant');
  }
}

async function exitFocusMode() {
  focusMode = false;
  focusedPageContent = '';
  focusedPageTitle = '';
  focusedPageUrl = '';
  
  // Clear from per-tab session storage
  if (currentTabId) {
    const key = `focus_${currentTabId}`;
    await chrome.storage.session.remove([key]);
  }
  
  focusBtn.classList.remove('active');
  focusBanner.style.display = 'none';
  
  showToast('Focus mode off', 'success');
}

// =====================
// CLEAR HISTORY
// =====================
function clearHistory() {
  if (confirm('Clear all fact-check history?')) {
    chrome.storage.local.set({ factCheckHistory: [] }, () => {
      renderHistory([]);
      showToast('History cleared', 'success');
    });
  }
}

// Handle send message
async function handleSend() {
  const message = userInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage(message, 'user');
  userInput.value = '';
  autoResizeTextarea();

  // Show typing indicator
  const typingId = showTyping();

  try {
    // Build context based on focus mode
    let contextToSend = pageContext;
    if (focusMode && focusedPageContent) {
      contextToSend = `Page: ${focusedPageTitle}\nURL: ${focusedPageUrl}\n\nFull Page Content:\n${focusedPageContent}`;
    }

    // Determine intent (fact-check only if explicitly asking with selected text)
    const isFactCheck = (message.toLowerCase().includes('fact') || 
                        message.toLowerCase().includes('check') ||
                        message.toLowerCase().includes('verify')) &&
                        selectedText;

    let response;
    
    if (isFactCheck && selectedText) {
      response = await factCheck(selectedText, contextToSend, message);
    } else {
      // Use chat for everything else - it handles calendar events internally
      response = await chat(message, selectedText, contextToSend, focusMode);
    }

    removeTyping(typingId);
    handleResponse(response, isFactCheck);
    
  } catch (error) {
    removeTyping(typingId);
    addMessage('Sorry, something went wrong. Please try again.', 'assistant');
    console.error('Error:', error);
  }
}

// API Calls
async function factCheck(claim, context, userMessage) {
  const response = await fetch(`${API_URL}/api/fact-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claim, context, userMessage })
  });
  return response.json();
}

async function createEvent(message, context, forceType = null) {
  const response = await fetch(`${API_URL}/api/create-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, forceType })
  });
  return response.json();
}

async function chat(message, selectedText, context, isFocusMode) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, selectedText, context, focusMode: isFocusMode })
  });
  return response.json();
}

// Handle API response
function handleResponse(response, isFactCheck) {
  if (response.error) {
    addMessage(response.error, 'assistant');
    return;
  }

  if (response.verdict) {
    // Fact-check response
    addFactCheckResult(response);
    saveToHistory(response);
    clearSelection();
  } else if (response.task) {
    // Task response - show message first if present
    if (response.reply) {
      addMessage(response.reply, 'assistant');
    }
    addTaskPreview(response.task);
  } else if (response.event) {
    // Calendar event response - show message first if present
    if (response.reply) {
      addMessage(response.reply, 'assistant');
    }
    addEventPreview(response.event);
  } else {
    // Regular chat response
    addMessage(response.message || response.reply, 'assistant');
  }
}

// Add message to chat
function addMessage(content, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `<div class="message-content"><p>${escapeHtml(content)}</p></div>`;
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
  saveTabChat(); // Save per-tab chat
}

// Add fact-check result
function addFactCheckResult(result) {
  const verdictClass = result.verdict.toLowerCase().replace(' ', '-');
  const verdictIcon = {
    'true': '✅',
    'false': '❌',
    'partially true': '⚠️',
    'unverifiable': '❓'
  }[result.verdict.toLowerCase()] || '❓';

  // Build sources HTML with site names
  let sourcesHtml = '';
  if (result.sources && result.sources.length > 0) {
    const sourceItems = result.sources.map(s => {
      const siteName = s.siteName || (s.url ? new URL(s.url).hostname.replace('www.', '') : 'Unknown');
      return `
        <div class="source-item">
          <span class="source-site">${escapeHtml(siteName)}</span>
          <a href="${s.url}" target="_blank" class="source-link">${escapeHtml(s.title || 'View source')}</a>
        </div>
      `;
    }).join('');
    
    sourcesHtml = `
      <div class="sources">
        <div class="sources-title">📰 Verified against ${result.sources.length} source${result.sources.length > 1 ? 's' : ''}:</div>
        ${sourceItems}
      </div>
    `;
  } else {
    sourcesHtml = `
      <div class="sources no-sources">
        <div class="sources-title">⚠️ No external sources found</div>
        <p class="sources-note">Verdict based on AI knowledge only</p>
      </div>
    `;
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.innerHTML = `
    <div class="message-content fact-check-result">
      <div class="verdict ${verdictClass}">
        ${verdictIcon} ${result.verdict}
      </div>
      <p class="explanation">${escapeHtml(result.explanation)}</p>
      <div class="confidence-bar">
        <div class="confidence-label">Confidence: ${result.confidence}%</div>
        <div class="confidence-track">
          <div class="confidence-fill" style="width: ${result.confidence}%"></div>
        </div>
      </div>
      ${sourcesHtml}
    </div>
  `;
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
  saveTabChat(); // Save per-tab chat
}

// Add event preview and auto-confirm
async function addEventPreview(event) {
  // Show the event details
  const eventDetails = `📅 ${event.title}\n🕐 ${event.date}${event.time ? ' at ' + event.time : ''}${event.location ? '\n📍 ' + event.location : ''}`;
  
  // Ask for confirmation
  const confirmed = confirm(`Add this event to Google Calendar?\n\n${eventDetails}`);
  
  if (confirmed) {
    addMessage(`📅 Adding "${event.title}" to calendar...`, 'user');
    await addToCalendar(event);
  } else {
    addMessage(`📅 Event not added: ${event.title}`, 'assistant');
  }
}

// Add to calendar
async function addToCalendar(event) {
  showToast('Adding to calendar...', 'success');
  
  try {
    console.log('Sending to calendar:', event);
    const response = await fetch(`${API_URL}/api/add-to-calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event })
    });
    
    const result = await response.json();
    console.log('Calendar response:', result);
    
    if (result.success) {
      addMessage('✅ Event added to your Google Calendar!', 'assistant');
      showToast('Event created!', 'success');
    } else {
      addMessage('❌ Failed to add event: ' + (result.error || 'Unknown error'), 'assistant');
      showToast('Failed to add event', 'error');
    }
  } catch (error) {
    console.error('Error adding to calendar:', error);
    addMessage('❌ Failed to connect to calendar service', 'assistant');
    showToast('Failed to add event', 'error');
  }
}

// Add task preview and auto-confirm
async function addTaskPreview(task) {
  // Show the task details
  const taskDetails = `✅ ${task.title}${task.dueDate ? '\n📅 Due: ' + task.dueDate : ''}${task.notes ? '\n📝 ' + task.notes : ''}`;
  
  // Ask for confirmation
  const confirmed = confirm(`Add this task to Google Tasks?\n\n${taskDetails}`);
  
  if (confirmed) {
    addMessage(`✅ Adding "${task.title}" to tasks...`, 'user');
    await addToTasks(task);
  } else {
    addMessage(`✅ Task not added: ${task.title}`, 'assistant');
  }
}

// Add to Google Tasks
async function addToTasks(task) {
  showToast('Adding to tasks...', 'success');
  
  try {
    console.log('Sending to tasks:', task);
    const response = await fetch(`${API_URL}/api/add-to-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    });
    
    const result = await response.json();
    console.log('Tasks response:', result);
    
    if (result.success) {
      addMessage('✅ Task added to your Google Tasks!', 'assistant');
      showToast('Task created!', 'success');
    } else {
      addMessage('❌ Failed to add task: ' + (result.error || 'Unknown error'), 'assistant');
      showToast('Failed to add task', 'error');
    }
  } catch (error) {
    console.error('Error adding to tasks:', error);
    addMessage('❌ Failed to connect to tasks service', 'assistant');
    showToast('Failed to add task', 'error');
  }
}

// Make addToCalendar and addToTasks available globally
window.addToCalendar = addToCalendar;
window.addToTasks = addToTasks;

// Typing indicator
function showTyping() {
  const id = 'typing-' + Date.now();
  const typingDiv = document.createElement('div');
  typingDiv.id = id;
  typingDiv.className = 'message assistant';
  typingDiv.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  scrollToBottom();
  return id;
}

function removeTyping(id) {
  const typingDiv = document.getElementById(id);
  if (typingDiv) typingDiv.remove();
}

// History
function saveToHistory(result) {
  chrome.storage.local.get(['factCheckHistory'], (data) => {
    const history = data.factCheckHistory || [];
    history.unshift({
      ...result,
      timestamp: new Date().toISOString()
    });
    // Keep only last 50 items
    chrome.storage.local.set({ factCheckHistory: history.slice(0, 50) });
  });
}

function loadHistory() {
  chrome.storage.local.get(['factCheckHistory'], (data) => {
    const history = data.factCheckHistory || [];
    renderHistory(history);
  });
}

function renderHistory(history) {
  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📚</span>
        <p>No fact-checks yet</p>
        <p class="empty-hint">Your verified claims will appear here</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = history.map(item => {
    const verdictIcon = {
      'true': '✅',
      'false': '❌',
      'partially true': '⚠️',
      'unverifiable': '❓'
    }[item.verdict.toLowerCase()] || '❓';

    return `
      <div class="history-item">
        <div class="history-claim">${escapeHtml(item.claim?.substring(0, 100) || 'Unknown claim')}${item.claim?.length > 100 ? '...' : ''}</div>
        <div class="history-meta">
          <span class="verdict ${item.verdict.toLowerCase()}">${verdictIcon} ${item.verdict}</span>
          <span>${formatDate(item.timestamp)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Utility functions
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'success') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show toast
  setTimeout(() => toast.classList.add('show'), 10);

  // Hide toast after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
