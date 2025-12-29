// ScrollBuddy Content Script - Page text extraction

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selection = window.getSelection().toString().trim();
    const pageContent = document.body.innerText.substring(0, 2000);
    
    sendResponse({
      selection: selection,
      pageContent: pageContent,
      url: window.location.href,
      title: document.title
    });
  }
  return true;
});

console.log('ScrollBuddy content script loaded');
