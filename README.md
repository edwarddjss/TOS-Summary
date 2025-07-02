# TOS Analyzer

A Chrome extension that automatically detects and analyzes Terms of Service and Privacy Policies using local AI processing.

## Overview

TOS Analyzer helps users understand the privacy implications and risks associated with terms of service agreements they encounter online. All analysis is performed locally on the user's device to ensure privacy.

## Features

- Automatic detection of TOS and Privacy Policy content
- Local AI-powered risk assessment using Transformers.js
- Real-time analysis of terms in popups, modals, and embedded content
- Risk categorization across multiple dimensions
- Privacy-focused design with no external data transmission
- Accessible interface with keyboard navigation support

## Installation

### Development Build

1. Clone the repository:
   ```bash
   git clone https://github.com/edwarddjss/TOS-Summary.git
   cd TOS-Summary
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm run build
   ```

4. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

## Usage

The extension automatically scans web pages for terms of service content. Click the extension icon to view analysis results, or access settings through the options page.

### Manual Scanning

Use the "Scan Again" button in the popup to manually trigger analysis on the current page.

### Configuration

Access extension settings by right-clicking the icon and selecting "Options" to configure:
- Automatic analysis preferences
- Notification thresholds
- Accessibility options

## Architecture

The extension uses a modular architecture with separate components for:

- **Content Scripts**: Detect and extract TOS content from web pages
- **Background Service Worker**: Coordinate analysis and manage extension state  
- **AI Worker**: Perform local analysis using machine learning models
- **Popup Interface**: Display results and user controls
- **Options Page**: Extension configuration

### Risk Assessment Categories

Analysis covers six key areas:
- Data Collection
- Data Sharing  
- User Rights
- Account Termination
- Liability & Warranties
- Changes to Terms

## Development

### Prerequisites

- Node.js 18+
- pnpm package manager
- Chrome or Chromium browser

### Build Commands

```bash
# Development build with watch mode
pnpm run dev

# Production build
pnpm run build

# Run linter
pnpm run lint

# Format code
pnpm run format
```

### Project Structure

```
src/
├── ai/              # AI worker and analysis logic
├── background/      # Service worker implementation
├── content/         # Content script for page interaction
├── popup/           # Extension popup interface
├── options/         # Settings and configuration page
├── utils/           # Shared utilities and helpers
├── types/           # TypeScript type definitions
├── styles/          # CSS stylesheets
└── icons/           # Extension icons and assets
```

## Technical Details

- Built with TypeScript and Webpack
- Uses Transformers.js for local machine learning inference
- Implements Chrome Extension Manifest V3
- All processing performed client-side for privacy
- Optimized bundle sizes for performance

## Privacy

This extension is designed with privacy as a core principle:

- No data transmission to external servers
- All analysis performed locally
- Minimal required permissions
- Open source for transparency and audit

See [PRIVACY.md](PRIVACY.md) for detailed privacy information.

## Contributing

Contributions are welcome. Please check the issue tracker for areas where help is needed.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Disclaimer

This tool provides analysis for informational purposes only and does not constitute legal advice. Users should consult qualified legal professionals for legal matters. 