# TOS Analyzer - AI-Powered Chrome Extension

A privacy-first Chrome extension that automatically detects and analyzes Terms of Service and Privacy Policies using local AI processing.

## Features

- 🔍 **Automatic TOS Detection** - Finds TOS/Privacy Policy content in popups, modals, links, and embedded text
- 🤖 **Local AI Analysis** - Analyzes terms using Phi-3 Mini model running entirely on your device
- 🛡️ **Privacy-First** - No data ever leaves your device; all processing is local
- 📊 **Risk Assessment** - Provides clear risk ratings and actionable recommendations
- ♿ **Accessible Design** - Full keyboard navigation and screen reader support
- 💰 **Completely Free** - Open source with optional donations to support development

## Privacy & Security

- ✅ All analysis performed locally on your device
- ✅ No external API calls or data transmission
- ✅ Minimal Chrome permissions required
- ✅ Open source code available for audit
- ✅ GDPR and CCPA compliant

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "TOS Analyzer"
3. Click "Add to Chrome"

### From Source (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/your-org/tos-analyzer-extension.git
   cd tos-analyzer-extension
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
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

## Usage

### Automatic Analysis
- The extension automatically scans for Terms of Service when you visit websites
- Risk notifications appear for high-risk terms (configurable in settings)
- Click the extension icon to view detailed analysis

### Manual Analysis
- Click the extension icon on any page
- Click "Scan Again" to manually trigger analysis
- View risk assessment, key concerns, and recommendations

### Settings
- Right-click the extension icon and select "Options"
- Configure automatic analysis, notifications, and accessibility features
- Export/import analysis data for backup

## How It Works

1. **Detection**: Scans web pages for TOS/Privacy Policy content using multiple detection strategies
2. **Extraction**: Extracts full text content from modals, links, and embedded sections
3. **Analysis**: Processes content locally using rule-based analysis (Phi-3 Mini integration planned)
4. **Assessment**: Generates risk ratings across six categories:
   - Data Collection
   - Data Sharing
   - User Rights
   - Account Termination
   - Liability & Warranties
   - Changes to Terms

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- Chrome/Chromium browser

### Setup
```bash
# Clone repository
git clone https://github.com/your-org/tos-analyzer-extension.git
cd tos-analyzer-extension

# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm test

# Lint code
pnpm run lint
```

### Project Structure
```
src/
├── background/      # Service worker and background scripts
├── content/         # Content scripts for web page interaction
├── popup/          # Extension popup UI
├── options/        # Options/settings page
├── ai/             # AI worker for local analysis
├── utils/          # Shared utilities and helpers
├── types/          # TypeScript type definitions
├── styles/         # CSS stylesheets
└── icons/          # Extension icons
```

### Key Files
- `manifest.json` - Chrome extension manifest
- `webpack.config.js` - Build configuration
- `src/types/index.ts` - Core type definitions
- `src/utils/tos-detector.ts` - TOS detection logic
- `src/ai/ai-worker.ts` - Local AI analysis worker

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Areas for Contribution
- [ ] Additional TOS detection patterns
- [ ] Improved risk assessment rules
- [ ] UI/UX enhancements
- [ ] Accessibility improvements
- [ ] Documentation and translations
- [ ] Test coverage expansion

## Roadmap

### v1.1
- [ ] Phi-3 Mini model integration
- [ ] Enhanced detection for SPAs
- [ ] Browser extension for Firefox
- [ ] Advanced filtering options

### v1.2
- [ ] Multiple language support
- [ ] Custom risk categories
- [ ] Analysis history dashboard
- [ ] Export to PDF reports

### v2.0
- [ ] Real-time TOS change monitoring
- [ ] Company database integration
- [ ] Advanced ML models
- [ ] Enterprise features

## Support

- 📧 Email: support@tosanalyzer.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/tos-analyzer-extension/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-org/tos-analyzer-extension/discussions)
- ☕ Donate: [Buy Me a Coffee](https://buymeacoffee.com/tosanalyzer)

## Legal

### Disclaimer
This extension provides analysis for informational purposes only and does not constitute legal advice. Always consult with qualified legal professionals for legal matters.

### License
MIT License - see [LICENSE](LICENSE) file for details.

### Privacy Policy
See [PRIVACY.md](PRIVACY.md) for our complete privacy policy.

## Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- AI processing via [ONNX Runtime](https://onnxruntime.ai/)
- Icons from [Heroicons](https://heroicons.com/)
- Inspired by privacy advocacy organizations worldwide

---

Made with ❤️ for privacy and transparency. 