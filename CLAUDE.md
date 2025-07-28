# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that automatically converts JIRA issue keys (e.g., "ABC-123") on web pages into interactive links with hover overlays. The extension features configurable disabled domains, built-in JIRA instance integration, and a comprehensive settings system for user customization.

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
  - Checks configurable disabled domains and built-in settings

- **`popup.js`**: Extension popup interface
  - Handles user settings (enable/disable, show/hide buttons)
  - JIRA Base URL configuration with settings access
  - Communicates with content script via Chrome messaging API
  - Displays statistics about JIRA keys found on current page

- **`settings.js`** & **`settings.html`**: Comprehensive settings page
  - Built-in disabled domains (JIRA instance, Bitbucket) with toggle switches
  - Custom disabled URLs with full CRUD operations (add, edit, delete)
  - Inline editing with simple vector icons
  - Domain migration and storage management

- **`manifest.json`**: Extension configuration
  - Manifest V3 format with options_page
  - Runs on all URLs (`<all_urls>`)
  - Permissions: `activeTab`, `storage`

### Key Architecture Details

- **Storage**: Uses Chrome's sync storage for cross-device settings persistence
- **Communication**: Message passing between popup, settings, and content script using `chrome.runtime.onMessage`
- **DOM Processing**: Recursively processes text nodes while avoiding script/style tags
- **State Management**: Tracks found JIRA keys in a Set for statistics
- **Domain Matching**: Advanced subdomain matching (google.com matches www.google.com)
- **Settings Management**: Separate built-in and custom disabled URL systems

### Storage Structure

- **`extensionEnabled`**: Boolean - main toggle
- **`showLinkButton`**, **`showCopyButton`**: Boolean - overlay button visibility
- **`jiraBaseUrl`**: String - user's JIRA instance URL
- **`disabledUrls`**: Array - custom disabled domains
- **`builtinDisabled`**: Object - built-in domain states (JIRA, Bitbucket)

### Key Functions

- **`wrapJiraKey(textNode)`**: Core function that replaces JIRA keys with interactive spans
- **`processTextNodes(element)`**: Recursively processes DOM elements to find text nodes
- **`createOverlay(jiraKey)`**: Creates hover overlay with open/copy actions
- **`isHostnameDisabled(hostname)`**: Checks if domain should be skipped
- **`isHostnameMatch(hostname, targetUrl)`**: Advanced domain matching with subdomain support
- **`init()`**: Initializes the extension and sets up MutationObserver

## Extension Behavior

- **Activation**: Runs automatically on all web pages when enabled (unless domain is disabled)
- **Pattern Detection**: Finds JIRA keys in format "PROJECT-123" (2-10 uppercase letters + dash + digits)
- **User Actions**: Hover over detected keys shows overlay with "open in JIRA" and "copy key" buttons
- **Settings**: Comprehensive settings page accessible from popup
- **Domain Management**: Built-in toggles for JIRA instance and Bitbucket (disabled by default)
- **Custom Domains**: Add, edit, delete custom disabled URLs with inline editing
- **Statistics**: Tracks total keys found and unique projects on current page
- **Smart Matching**: Subdomain-aware domain matching (example.com blocks www.example.com)

## File Structure

```
├── manifest.json    # Extension configuration (v0.3.0)
├── content.js       # Main content script logic with domain management
├── popup.html       # Popup interface HTML with settings access
├── popup.js         # Popup functionality and statistics
├── settings.html    # Comprehensive settings page
├── settings.js      # Settings management and URL configuration
└── styles.css       # Overlay and UI styling
```

## Testing

No automated test framework is present. Testing is done manually by:
1. Loading extension in Chrome developer mode
2. Navigating to pages with JIRA keys
3. Verifying hover overlays appear and actions work
4. Testing popup settings, statistics display, and settings page access
5. Testing domain disabling functionality (built-in and custom)
6. Verifying settings persistence and domain matching behavior
7. Testing inline editing of custom disabled URLs