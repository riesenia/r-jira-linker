document.addEventListener('DOMContentLoaded', function() {
  const builtinUrls = document.getElementById('builtinUrls');
  const urlList = document.getElementById('urlList');
  const emptyState = document.getElementById('emptyState');
  const urlInput = document.getElementById('urlInput');
  const addBtn = document.getElementById('addBtn');
  
  let disabledUrls = [];
  let builtinSettings = {};
  
  // Load settings from storage
  loadSettings();
  
  // Add URL button click handler
  addBtn.addEventListener('click', addUrl);
  
  // Enter key handler for input
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addUrl();
    }
  });
  
  // Input validation
  urlInput.addEventListener('input', function() {
    const value = urlInput.value.trim();
    addBtn.disabled = value === '';
  });
  
  function loadSettings() {
    chrome.storage.sync.get(['disabledUrls', 'builtinDisabled', 'jiraBaseUrl'], function(result) {
      // Load custom disabled URLs (filter out built-in ones)
      const allDisabledUrls = result.disabledUrls || [];
      
      // Load built-in settings
      builtinSettings = result.builtinDisabled || {};
      
      // Get JIRA base URL for built-in list
      const jiraBaseUrl = result.jiraBaseUrl || '';
      let jiraHostname = '';
      if (jiraBaseUrl && jiraBaseUrl.trim() !== '') {
        try {
          if (jiraBaseUrl.startsWith('http://') || jiraBaseUrl.startsWith('https://')) {
            jiraHostname = new URL(jiraBaseUrl).hostname;
          } else {
            jiraHostname = jiraBaseUrl;
          }
        } catch (e) {
          // Invalid URL, use as-is
          jiraHostname = jiraBaseUrl;
        }
      }
      
      // Migration: Move built-in URLs from disabledUrls to builtinDisabled
      const builtinUrls = ['bitbucket.org'];
      if (jiraHostname) {
        builtinUrls.push(jiraHostname);
      }
      
      // Check if built-in URLs are in the disabled list and migrate
      let needsMigration = false;
      builtinUrls.forEach(url => {
        if (allDisabledUrls.includes(url)) {
          builtinSettings[url] = true; // Mark as disabled
          needsMigration = true;
        } else if (!(url in builtinSettings)) {
          builtinSettings[url] = true; // Default to disabled
        }
      });
      
      // Remove built-in URLs from custom disabled URLs
      disabledUrls = allDisabledUrls.filter(url => !builtinUrls.includes(url));
      
      // Save migration if needed
      if (needsMigration) {
        chrome.storage.sync.set({
          disabledUrls: disabledUrls,
          builtinDisabled: builtinSettings
        }, function() {
          renderBuiltinUrls(jiraHostname);
          renderUrlList();
        });
      } else {
        renderBuiltinUrls(jiraHostname);
        renderUrlList();
      }
    });
  }
  
  function renderBuiltinUrls(jiraHostname) {
    builtinUrls.innerHTML = '';
    
    // JIRA Base URL (if configured) - show first
    if (jiraHostname) {
      const jiraItem = createBuiltinItem(
        jiraHostname,
        'Your JIRA instance (from popup settings)',
        builtinSettings[jiraHostname] || false
      );
      builtinUrls.appendChild(jiraItem);
    }
    
    // Bitbucket
    const bitbucketItem = createBuiltinItem(
      'bitbucket.org',
      'Bitbucket (always available)',
      builtinSettings['bitbucket.org'] || false
    );
    builtinUrls.appendChild(bitbucketItem);
  }
  
  function createBuiltinItem(url, description, isDisabled) {
    const item = document.createElement('div');
    item.className = 'builtin-item';
    
    item.innerHTML = `
      <div class="builtin-text">
        <div class="builtin-url">${escapeHtml(url)}</div>
        <div class="builtin-description">${escapeHtml(description)}</div>
      </div>
      <div class="builtin-toggle ${isDisabled ? 'enabled' : ''}" data-url="${escapeHtml(url)}">
        <div class="toggle-slider"></div>
      </div>
    `;
    
    // Add toggle handler
    const toggle = item.querySelector('.builtin-toggle');
    toggle.addEventListener('click', function() {
      const currentState = toggle.classList.contains('enabled');
      const newState = !currentState;
      
      // Update UI
      if (newState) {
        toggle.classList.add('enabled');
      } else {
        toggle.classList.remove('enabled');
      }
      
      // Update settings
      builtinSettings[url] = newState;
      
      // Save to storage
      chrome.storage.sync.set({builtinDisabled: builtinSettings});
    });
    
    return item;
  }
  
  function renderUrlList() {
    if (disabledUrls.length === 0) {
      emptyState.style.display = 'block';
      // Remove any existing URL items
      const urlItems = urlList.querySelectorAll('.url-item');
      urlItems.forEach(item => item.remove());
      return;
    }
    
    emptyState.style.display = 'none';
    
    // Clear existing items
    const urlItems = urlList.querySelectorAll('.url-item');
    urlItems.forEach(item => item.remove());
    
    // Add URL items
    disabledUrls.forEach((url, index) => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';
      urlItem.dataset.index = index;
      
      urlItem.innerHTML = `
        <div class="url-text">${escapeHtml(url)}</div>
        <div class="url-actions">
          <button class="edit-btn" data-index="${index}" title="Edit URL">✎</button>
          <button class="remove-btn" data-index="${index}" title="Remove URL">×</button>
        </div>
      `;
      
      // Add edit button handler
      const editBtn = urlItem.querySelector('.edit-btn');
      editBtn.addEventListener('click', function() {
        startEditUrl(index, urlItem);
      });
      
      // Add remove button handler
      const removeBtn = urlItem.querySelector('.remove-btn');
      removeBtn.addEventListener('click', function() {
        removeUrl(index);
      });
      
      urlList.appendChild(urlItem);
    });
  }
  
  function addUrl() {
    const url = urlInput.value.trim();
    if (url === '') return;
    
    console.log('[JIRA Linker Settings] Adding URL:', url);
    
    // Normalize URL
    const normalizedUrl = normalizeUrl(url);
    console.log('[JIRA Linker Settings] Normalized URL:', normalizedUrl);
    
    // Check if URL already exists
    if (disabledUrls.includes(normalizedUrl)) {
      alert('This URL is already in the list.');
      return;
    }
    
    // Add URL
    disabledUrls.push(normalizedUrl);
    
    // Save to storage
    chrome.storage.sync.set({disabledUrls: disabledUrls}, function() {
      renderUrlList();
      urlInput.value = '';
      addBtn.disabled = true;
    });
  }
  
  function startEditUrl(index, urlItem) {
    const currentUrl = disabledUrls[index];
    
    // Replace the URL item content with edit form
    urlItem.innerHTML = `
      <input type="text" class="edit-input" value="${escapeHtml(currentUrl)}">
      <div class="url-actions">
        <button class="save-btn" data-index="${index}" title="Save changes">✓</button>
        <button class="cancel-btn" data-index="${index}" title="Cancel editing">×</button>
      </div>
    `;
    
    const editInput = urlItem.querySelector('.edit-input');
    const saveBtn = urlItem.querySelector('.save-btn');
    const cancelBtn = urlItem.querySelector('.cancel-btn');
    
    // Focus and select the input
    editInput.focus();
    editInput.select();
    
    // Handle save
    saveBtn.addEventListener('click', function() {
      saveEditUrl(index, editInput.value.trim());
    });
    
    // Handle cancel
    cancelBtn.addEventListener('click', function() {
      renderUrlList(); // Just re-render to cancel edit
    });
    
    // Handle Enter key to save
    editInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveEditUrl(index, editInput.value.trim());
      }
    });
    
    // Handle Escape key to cancel
    editInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        renderUrlList(); // Just re-render to cancel edit
      }
    });
  }
  
  function saveEditUrl(index, newUrl) {
    if (newUrl === '') {
      alert('URL cannot be empty.');
      return;
    }
    
    // Normalize the new URL
    const normalizedUrl = normalizeUrl(newUrl);
    
    // Check if URL already exists (excluding the current one being edited)
    const existingIndex = disabledUrls.findIndex((url, i) => i !== index && url === normalizedUrl);
    if (existingIndex !== -1) {
      alert('This URL is already in the list.');
      return;
    }
    
    // Update the URL
    disabledUrls[index] = normalizedUrl;
    
    // Save to storage
    chrome.storage.sync.set({disabledUrls: disabledUrls}, function() {
      renderUrlList();
    });
  }
  
  function removeUrl(index) {
    disabledUrls.splice(index, 1);
    
    // Save to storage
    chrome.storage.sync.set({disabledUrls: disabledUrls}, function() {
      renderUrlList();
    });
  }
  
  function normalizeUrl(url) {
    // Remove protocol if present to store just hostname
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).hostname;
      }
      // Remove leading wildcards and dots
      return url.replace(/^\*\./, '').replace(/^\./, '');
    } catch (e) {
      // If URL parsing fails, return as-is (might be a simple domain)
      return url.replace(/^\*\./, '').replace(/^\./, '');
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function notifyTabsOfDisabledUrlsUpdate() {
    // Get all tabs and notify them about disabled URLs update
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateDisabledUrls',
          disabledUrls: disabledUrls
        }, function(response) {
          // Ignore errors for tabs that don't have the content script
          if (chrome.runtime.lastError) {
            return;
          }
        });
      });
    });
  }
});