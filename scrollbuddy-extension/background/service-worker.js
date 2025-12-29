// ScrollBuddy Service Worker - Background tasks

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('ScrollBuddy extension installed');
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('ScrollBuddy service worker started');
});
