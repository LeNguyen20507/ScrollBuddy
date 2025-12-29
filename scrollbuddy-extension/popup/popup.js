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

// State
let selectedText = '';
let pageContext = '';
let focusMode = false;
let focusedPageContent = '';
let focusedPageTitle = '';
let focusedPageUrl = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  setupEventListeners();
  autoResizeTextarea();
  restoreFocusMode();
});

// Restore focus mode state from storage
async function restoreFocusMode() {
  const result = await chrome.storage.local.get(['focusMode', 'focusedPageContent', 'focusedPageTitle', 'focusedPageUrl']);
  
  if (result.focusMode) {
    focusMode = true;
    focusedPageContent = result.focusedPageContent || '';
    focusedPageTitle = result.focusedPageTitle || '';
    focusedPageUrl = result.focusedPageUrl || '';
    
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

  // Clear history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Auto-resize textarea
  userInput.addEventListener('input', autoResizeTextarea);
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
        
        // Show what we're checking
        addMessage(`Fact-checking: "${selection.length > 100 ? selection.substring(0, 100) + '...' : selection}"`, 'user');
        
        // Auto-trigger fact-check
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
        
        // Save to storage for persistence
        await chrome.storage.local.set({
          focusMode: true,
          focusedPageContent: content,
          focusedPageTitle: title,
          focusedPageUrl: url
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

async function exitFocusMode() {
  focusMode = false;
  focusedPageContent = '';
  focusedPageTitle = '';
  focusedPageUrl = '';
  
  // Clear from storage
  await chrome.storage.local.remove(['focusMode', 'focusedPageContent', 'focusedPageTitle', 'focusedPageUrl']);
  
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

    // Determine intent (fact-check or calendar)
    const isFactCheck = (message.toLowerCase().includes('fact') || 
                        message.toLowerCase().includes('check') ||
                        message.toLowerCase().includes('verify') ||
                        message.toLowerCase().includes('true')) &&
                        selectedText;
    
    const isCalendar = message.toLowerCase().includes('calendar') ||
                       message.toLowerCase().includes('event') ||
                       message.toLowerCase().includes('schedule');

    let response;
    
    if (isFactCheck && selectedText) {
      response = await factCheck(selectedText, contextToSend, message);
    } else if (isCalendar) {
      response = await createEvent(message, contextToSend);
    } else {
      response = await chat(message, selectedText, contextToSend);
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

async function createEvent(message, context) {
  const response = await fetch(`${API_URL}/api/create-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context })
  });
  return response.json();
}

async function chat(message, selectedText, context) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, selectedText, context })
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
  } else if (response.event) {
    // Calendar event response
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
}

// Add event preview
function addEventPreview(event) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.innerHTML = `
    <div class="message-content">
      <p>I found an event! Would you like to add it to your calendar?</p>
      <div class="event-preview">
        <div class="event-field">
          <span class="event-field-icon">📅</span>
          <span class="event-field-value">${escapeHtml(event.title)}</span>
        </div>
        <div class="event-field">
          <span class="event-field-icon">🕐</span>
          <span class="event-field-value">${escapeHtml(event.date)} ${event.time ? 'at ' + event.time : ''}</span>
        </div>
        ${event.location ? `
        <div class="event-field">
          <span class="event-field-icon">📍</span>
          <span class="event-field-value">${escapeHtml(event.location)}</span>
        </div>` : ''}
        <button class="add-calendar-btn" onclick="addToCalendar(${JSON.stringify(event).replace(/"/g, '&quot;')})">
          Add to Google Calendar
        </button>
      </div>
    </div>
  `;
  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
}

// Add to calendar
async function addToCalendar(event) {
  showToast('Adding to calendar...', 'success');
  
  try {
    const response = await fetch(`${API_URL}/api/add-to-calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event })
    });
    
    const result = await response.json();
    
    if (result.success) {
      addMessage('✅ Event added to your Google Calendar!', 'assistant');
      showToast('Event created!', 'success');
    } else {
      addMessage('Failed to add event: ' + result.error, 'assistant');
      showToast('Failed to add event', 'error');
    }
  } catch (error) {
    console.error('Error adding to calendar:', error);
    showToast('Failed to add event', 'error');
  }
}

// Make addToCalendar available globally
window.addToCalendar = addToCalendar;

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
