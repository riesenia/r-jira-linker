document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('statusText');
  const optionsSection = document.getElementById('optionsSection');
  const showLinkToggle = document.getElementById('showLinkToggle');
  const showCopyToggle = document.getElementById('showCopyToggle');
  const jiraBaseUrl = document.getElementById('jiraBaseUrl');
  const statistics = document.getElementById('statistics');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // Load current state
  chrome.storage.sync.get(['extensionEnabled', 'showLinkButton', 'showCopyButton', 'jiraBaseUrl'], function(result) {
    const isEnabled = result.extensionEnabled !== false;
    const showLink = result.showLinkButton !== false;
    const showCopy = result.showCopyButton !== false;
    const baseUrl = result.jiraBaseUrl || '';
    
    updateUI(isEnabled, showLink, showCopy, baseUrl);
    loadStatistics();
  });
  
  // Handle main toggle click
  toggleSwitch.addEventListener('click', function() {
    chrome.storage.sync.get(['extensionEnabled'], function(result) {
      const currentState = result.extensionEnabled !== false;
      const newState = !currentState;
      
      chrome.storage.sync.set({extensionEnabled: newState}, function() {
        updateMainToggle(newState);
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggleExtension',
              enabled: newState
            }, function(response) {
              if (chrome.runtime.lastError) {
                // Content script not available, ignore silently
                return;
              }
            });
          }
        });
      });
    });
  });
  
  // Handle show link toggle
  showLinkToggle.addEventListener('click', function() {
    chrome.storage.sync.get(['showLinkButton'], function(result) {
      const currentState = result.showLinkButton !== false;
      const newState = !currentState;
      
      chrome.storage.sync.set({showLinkButton: newState}, function() {
        updateToggle(showLinkToggle, newState);
        notifyOptionsChange();
      });
    });
  });
  
  // Handle show copy toggle
  showCopyToggle.addEventListener('click', function() {
    chrome.storage.sync.get(['showCopyButton'], function(result) {
      const currentState = result.showCopyButton !== false;
      const newState = !currentState;
      
      chrome.storage.sync.set({showCopyButton: newState}, function() {
        updateToggle(showCopyToggle, newState);
        notifyOptionsChange();
      });
    });
  });
  
  // Handle JIRA base URL input changes
  jiraBaseUrl.addEventListener('input', function() {
    const baseUrl = jiraBaseUrl.value.trim();
    chrome.storage.sync.set({jiraBaseUrl: baseUrl}, function() {
      notifyOptionsChange();
    });
  });
  
  // Handle settings button click
  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  function updateUI(enabled, showLink, showCopy, baseUrl) {
    updateMainToggle(enabled);
    updateToggle(showLinkToggle, showLink);
    updateToggle(showCopyToggle, showCopy);
    jiraBaseUrl.value = baseUrl;
  }
  
  function updateMainToggle(enabled) {
    if (enabled) {
      toggleSwitch.classList.add('enabled');
      statusText.textContent = 'Extension is enabled';
      optionsSection.classList.remove('disabled');
    } else {
      toggleSwitch.classList.remove('enabled');
      statusText.textContent = 'Extension is disabled';
      optionsSection.classList.add('disabled');
    }
  }
  
  function updateToggle(toggle, enabled) {
    if (enabled) {
      toggle.classList.add('enabled');
    } else {
      toggle.classList.remove('enabled');
    }
  }
  
  
  function notifyOptionsChange() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateOptions'
        }, function(response) {
          if (chrome.runtime.lastError) {
            // Content script not available, ignore silently
            return;
          }
        });
      }
    });
  }
  
  function loadStatistics() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'getStatistics'
        }, function(response) {
          if (chrome.runtime.lastError) {
            statistics.textContent = 'Extension not active on this page';
            return;
          }
          if (response) {
            if (response.isSkipped) {
              statistics.textContent = 'Processing skipped on JIRA domain';
            } else {
              updateStatistics(response);
            }
          } else {
            statistics.textContent = 'No JIRA keys found on this page';
          }
        });
      }
    });
  }
  
  function updateStatistics(stats) {
    if (stats.totalKeys === 0) {
      statistics.textContent = 'No JIRA keys found on this page';
      return;
    }
    
    const projectsText = stats.projects.length > 0 ? 
      `Projects: ${stats.projects.join(', ')}` : 
      'No projects found';
    
    statistics.innerHTML = `
      <div>Found ${stats.totalKeys} JIRA key${stats.totalKeys === 1 ? '' : 's'}</div>
      <div>${projectsText}</div>
    `;
  }
});