const JIRA_KEY_REGEX = /\b([A-Z]{2,10}-\d+)\b/g;

let extensionEnabled = true;
let showLinkButton = true;
let showCopyButton = true;
let jiraBaseUrl = '';
let jiraKeysOnPage = new Set();
let disabledUrls = [];
let builtinDisabled = {};

let isOnSkippedDomain = false;

chrome.storage.sync.get(['extensionEnabled', 'showLinkButton', 'showCopyButton', 'jiraBaseUrl', 'disabledUrls', 'builtinDisabled'], function(result) {
  extensionEnabled = result.extensionEnabled !== false;
  showLinkButton = result.showLinkButton !== false;
  showCopyButton = result.showCopyButton !== false;
  jiraBaseUrl = result.jiraBaseUrl || '';
  disabledUrls = result.disabledUrls || [];
  builtinDisabled = result.builtinDisabled || {};
  
  // Check if current hostname is in disabled URLs
  if (isHostnameDisabled(window.location.hostname)) {
    isOnSkippedDomain = true;
    return;
  }
  
  initializeExtension();
});

function isHostnameDisabled(hostname) {
  // Check built-in disabled URLs first
  for (const [builtinUrl, isDisabled] of Object.entries(builtinDisabled)) {
    if (isDisabled && isHostnameMatch(hostname, builtinUrl)) {
      return true;
    }
  }
  
  // Check custom disabled URLs
  return disabledUrls.some(disabledUrl => {
    return isHostnameMatch(hostname, disabledUrl);
  });
}

function isHostnameMatch(hostname, targetUrl) {
  // Exact match
  if (hostname === targetUrl) {
    return true;
  }
  
  // Wildcard subdomain match (*.example.com matches sub.example.com)
  if (targetUrl.startsWith('*.')) {
    const domain = targetUrl.substring(2);
    return hostname.endsWith('.' + domain) || hostname === domain;
  }
  
  // Handle subdomain matching: google.com should match www.google.com
  if (hostname.endsWith('.' + targetUrl)) {
    return true;
  }
  
  // Handle reverse case: www.google.com should match google.com if hostname starts with www.
  if (targetUrl.startsWith('www.') && hostname === targetUrl.substring(4)) {
    return true;
  }
  
  return false;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleExtension') {
    extensionEnabled = request.enabled;
    if (extensionEnabled) {
      // Skip processing if we're on a disabled domain
      if (isHostnameDisabled(window.location.hostname)) {
        return;
      }
      init();
    } else {
      removeAllJiraLinks();
    }
  } else if (request.action === 'updateOptions') {
    chrome.storage.sync.get(['showLinkButton', 'showCopyButton', 'jiraBaseUrl', 'disabledUrls', 'builtinDisabled'], function(result) {
      showLinkButton = result.showLinkButton !== false;
      showCopyButton = result.showCopyButton !== false;
      jiraBaseUrl = result.jiraBaseUrl || '';
      disabledUrls = result.disabledUrls || [];
      builtinDisabled = result.builtinDisabled || {};
      
      // Check if current domain should now be disabled
      if (isHostnameDisabled(window.location.hostname)) {
        isOnSkippedDomain = true;
        removeAllJiraLinks();
        return;
      }
      
      updateAllOverlays();
    });
  } else if (request.action === 'getStatistics') {
    if (isOnSkippedDomain) {
      sendResponse({
        isSkipped: true,
        totalKeys: 0,
        projects: []
      });
      return;
    }
    
    const projects = Array.from(jiraKeysOnPage).map(key => key.split('-')[0]);
    const uniqueProjects = [...new Set(projects)];
    
    sendResponse({
      totalKeys: jiraKeysOnPage.size,
      projects: uniqueProjects
    });
  }
});

function createOverlay(jiraKey) {
  const overlay = document.createElement('div');
  overlay.className = 'jira-overlay';
  
  let actions = '';
  
  if (showLinkButton && jiraBaseUrl) {
    actions += `
      <div class="overlay-action" data-action="open" data-key="${jiraKey}" title="Open in JIRA">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7v-2z"/>
        </svg>
      </div>
    `;
  }
  
  if (showCopyButton) {
    actions += `
      <div class="overlay-action" data-action="copy" data-key="${jiraKey}" title="Copy key">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </div>
    `;
  }
  
  overlay.innerHTML = actions;
  return overlay;
}

function removeAllJiraLinks() {
  const jiraLinks = document.querySelectorAll('.jira-link');
  jiraLinks.forEach(link => {
    const textNode = document.createTextNode(link.textContent);
    link.parentNode.replaceChild(textNode, link);
  });
  jiraKeysOnPage.clear();
}

function updateAllOverlays() {
  const jiraLinks = document.querySelectorAll('.jira-link');
  jiraLinks.forEach(link => {
    const jiraKey = link.textContent;
    const existingOverlay = link.querySelector('.jira-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    const newOverlay = createOverlay(jiraKey);
    link.appendChild(newOverlay);
    
    newOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const action = e.target.closest('.overlay-action');
      if (!action) return;
      
      const actionType = action.dataset.action;
      const key = action.dataset.key;
      
      if (actionType === 'open' && jiraBaseUrl) {
        let baseUrl = jiraBaseUrl;
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `https://${baseUrl}`;
        }
        const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}browse/${key}` : `${baseUrl}/browse/${key}`;
        window.open(fullUrl, '_blank');
      } else if (actionType === 'copy') {
        navigator.clipboard.writeText(key).then(() => {
          const svg = action.querySelector('svg');
          const originalSvg = svg.innerHTML;
          svg.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
          
          setTimeout(() => {
            svg.innerHTML = originalSvg;
          }, 1200);
        });
      }
    });
  });
}

function wrapJiraKey(textNode) {
  const parent = textNode.parentNode;
  if (!parent || parent.classList?.contains('jira-link') || !extensionEnabled) return;
  
  const text = textNode.textContent;
  const matches = [...text.matchAll(JIRA_KEY_REGEX)];
  
  if (matches.length === 0) return;
  
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  
  matches.forEach(match => {
    const jiraKey = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + jiraKey.length;
    
    jiraKeysOnPage.add(jiraKey);
    
    if (startIndex > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
    }
    
    const wrapper = document.createElement('span');
    wrapper.className = 'jira-link';
    wrapper.textContent = jiraKey;
    
    const overlay = createOverlay(jiraKey);
    wrapper.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const action = e.target.closest('.overlay-action');
      if (!action) return;
      
      const actionType = action.dataset.action;
      const key = action.dataset.key;
      
      if (actionType === 'open' && jiraBaseUrl) {
        let baseUrl = jiraBaseUrl;
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `https://${baseUrl}`;
        }
        const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}browse/${key}` : `${baseUrl}/browse/${key}`;
        window.open(fullUrl, '_blank');
      } else if (actionType === 'copy') {
        navigator.clipboard.writeText(key).then(() => {
          const svg = action.querySelector('svg');
          const originalSvg = svg.innerHTML;
          svg.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
          
          setTimeout(() => {
            svg.innerHTML = originalSvg;
          }, 1200);
        });
      }
    });
    
    fragment.appendChild(wrapper);
    lastIndex = endIndex;
  });
  
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  
  parent.replaceChild(fragment, textNode);
}

function processTextNodes(element) {
  if (element.nodeType === Node.TEXT_NODE) {
    wrapJiraKey(element);
  } else if (element.nodeType === Node.ELEMENT_NODE) {
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
    
    const children = Array.from(element.childNodes);
    children.forEach(child => processTextNodes(child));
  }
}

function init() {
  if (!extensionEnabled) return;
  
  // Skip processing if we're on a disabled domain
  if (isHostnameDisabled(window.location.hostname)) {
    return;
  }
  
  processTextNodes(document.body);
  
  const observer = new MutationObserver(mutations => {
    if (!extensionEnabled) return;
    
    // Skip processing if we're on a disabled domain
    if (isHostnameDisabled(window.location.hostname)) {
      return;
    }
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          processTextNodes(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function initializeExtension() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// This is now handled by the early exit logic and initializeExtension function