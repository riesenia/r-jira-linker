# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that automatically converts JIRA issue keys (e.g., "ABC-123") on web pages into interactive links with hover overlays. The extension is specifically configured for the `riesenia.atlassian.net` JIRA instance.

## Development Commands

This is a vanilla JavaScript Chrome extension with no build system. Development involves:

1. **Loading the extension**: Load the extension directory in Chrome's developer mode (`chrome://extensions/`)
2. **Testing changes**: Reload the extension after making changes to see updates
3. **Debugging**: Use Chrome DevTools for the popup and content script debugging

## Architecture

### Core Components

- **`content.js`**: Main content script that processes web pages
  - Scans for JIRA keys using regex: `/\b([A-Z]{2,10}-\d+)\b/g`
  - Wraps matches in interactive `<span class="jira-link">` elements
  - Uses MutationObserver to handle dynamically added content
  - Manages overlay creation and event handling

- **`popup.js`**: Extension popup interface
  - Handles user settings (enable/disable, show/hide buttons)
  - Communicates with content script via Chrome messaging API
  - Displays statistics about JIRA keys found on current page

- **`manifest.json`**: Extension configuration
  - Manifest V3 format
  - Runs on all URLs (`<all_urls>`)
  - Permissions: `activeTab`, `storage`

### Key Architecture Details

- **Storage**: Uses Chrome's sync storage for cross-device settings persistence
- **Communication**: Message passing between popup and content script using `chrome.runtime.onMessage`
- **DOM Processing**: Recursively processes text nodes while avoiding script/style tags
- **State Management**: Tracks found JIRA keys in a Set for statistics

### Important Constants

- **JIRA_BASE_URL**: `https://riesenia.atlassian.net/browse/` (hardcoded)
- **JIRA_KEY_REGEX**: `/\b([A-Z]{2,10}-\d+)\b/g` - matches 2-10 uppercase letters followed by dash and digits

### Key Functions

- **`wrapJiraKey(textNode)`**: Core function that replaces JIRA keys with interactive spans
- **`processTextNodes(element)`**: Recursively processes DOM elements to find text nodes
- **`createOverlay(jiraKey)`**: Creates hover overlay with open/copy actions
- **`init()`**: Initializes the extension and sets up MutationObserver

## Extension Behavior

- **Activation**: Runs automatically on all web pages when enabled
- **Pattern Detection**: Finds JIRA keys in format "PROJECT-123" (2-10 uppercase letters + dash + digits)
- **User Actions**: Hover over detected keys shows overlay with "open in JIRA" and "copy key" buttons
- **Settings**: Users can toggle extension on/off and show/hide individual buttons
- **Statistics**: Tracks total keys found and unique projects on current page

## File Structure

```
├── manifest.json    # Extension configuration
├── content.js       # Main content script logic
├── popup.html       # Popup interface HTML
├── popup.js         # Popup functionality
└── styles.css       # Overlay and UI styling
```

## Testing

No automated test framework is present. Testing is done manually by:
1. Loading extension in Chrome developer mode
2. Navigating to pages with JIRA keys
3. Verifying hover overlays appear and actions work
4. Testing popup settings and statistics display