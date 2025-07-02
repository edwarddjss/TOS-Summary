import { TOSDetector } from '../utils/tos-detector';
import { TOSDocument, ExtensionMessage } from '../types';

class ContentScript {
  private detector: TOSDetector;
  private isAnalyzing = false;
  private analysisQueue: TOSDocument[] = [];
  private observer: MutationObserver | null = null;

  constructor() {
    this.detector = new TOSDetector();
    this.init();
  }

  /**
   * Initialize content script
   */
  private init(): void {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Indicates we will send a response asynchronously
    });

    // Listen for TOS detection events
    window.addEventListener('tosDetected', ((event: CustomEvent) => {
      this.handleTOSDetected(event.detail);
    }) as EventListener);

    // Check if auto-analyze is enabled before performing initial scan
    this.checkAutoAnalyze();

    // Setup mutation observer for dynamic content
    this.setupDynamicContentObserver();

    // Monitor for modal appearances
    this.setupModalMonitoring();
  }

  /**
   * Handle messages from background script
   */
  private async handleMessage(message: ExtensionMessage, sendResponse: (response?: any) => void): Promise<void> {
    try {
      switch (message.type) {
        case 'SCAN_FOR_TOS':
          await this.performTOSScan();
          sendResponse({ success: true });
          break;
        
        default:
          sendResponse({ error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Check if auto-analyze is enabled and perform initial scan if so
   */
  private async checkAutoAnalyze(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      
      if (response?.success && response.settings?.autoAnalyze) {
        // Wait for page to stabilize before scanning
        await this.waitForPageStable();
        await this.performTOSScan();
      }
    } catch (error) {
      // Silently fail if background script not available
      console.debug('Could not check auto-analyze setting:', error);
    }
  }

  /**
   * Perform TOS scan and queue analysis
   */
  private async performTOSScan(): Promise<void> {
    try {
      const documents = this.detector.detectTOSElements();
      
      for (const document of documents) {
        if (this.shouldAnalyzeDocument(document)) {
          this.queueAnalysis(document);
        }
      }
      
      await this.processAnalysisQueue();
    } catch (error) {
      console.error('TOS scan failed:', error);
    }
  }

  /**
   * Handle detected TOS content
   */
  private handleTOSDetected(detail: { element: Element; selector: string }): void {
    const { element, selector } = detail;
    
    // Extract document information
    const content = this.extractContent(element);
    if (content && content.length > 100) {
      const document: TOSDocument = {
        id: this.generateId(),
        url: window.location.href,
        title: this.extractTitle(element) || 'Dynamic TOS Content',
        content,
        extractedAt: new Date(),
        source: 'modal', // Assume modal for dynamically detected content
        selectors: [selector]
      };
      
      if (this.shouldAnalyzeDocument(document)) {
        this.queueAnalysis(document);
        this.processAnalysisQueue();
      }
    }
  }

  /**
   * Check if document should be analyzed
   */
  private shouldAnalyzeDocument(document: TOSDocument): boolean {
    // Skip if content is too short
    if (document.content.length < 200) {
      return false;
    }
    
    // Skip if we've already queued this content
    return !this.analysisQueue.some(queued => 
      queued.content === document.content && queued.url === document.url
    );
  }

  /**
   * Queue document for analysis
   */
  private queueAnalysis(document: TOSDocument): void {
    this.analysisQueue.push(document);
  }

  /**
   * Process queued analyses
   */
  private async processAnalysisQueue(): Promise<void> {
    if (this.isAnalyzing || this.analysisQueue.length === 0) {
      return;
    }

    this.isAnalyzing = true;

    while (this.analysisQueue.length > 0) {
      const document = this.analysisQueue.shift();
      if (document) {
        await this.requestAnalysis(document);
        // Add small delay between analyses
        await this.delay(1000);
      }
    }

    this.isAnalyzing = false;
  }

  /**
   * Request analysis from background script
   */
  private async requestAnalysis(document: TOSDocument): Promise<void> {
    return new Promise((resolve) => {
      const message: ExtensionMessage = {
        type: 'ANALYZE_TOS',
        payload: { document }
      };

      chrome.runtime.sendMessage(message, (response) => {
        if (response?.success) {
          this.handleAnalysisResult(response.analysis);
        } else {
          console.error('Analysis failed:', response?.error);
        }
        resolve();
      });
    });
  }

  /**
   * Handle analysis result
   */
  private async handleAnalysisResult(analysis: any): Promise<void> {
    const isSevere = analysis.assessment.overall === 'high' || analysis.assessment.overall === 'critical';
    
    if (isSevere) {
      // Show banner on page
      this.showRiskIndicator(analysis);
      
      // Only auto-open popup if user has enabled notifications and auto-analyze
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS'
        });
        
        if (response?.success && 
            response.settings?.autoAnalyze && 
            response.settings?.showNotifications) {
          chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        }
      } catch (error) {
        console.debug('Could not check settings for auto-popup:', error);
      }
    }

    // Update popup badge
    this.updateBadge(analysis.assessment.overall);
  }

  /**
   * Show visual risk indicator on the page
   */
  private showRiskIndicator(analysis: any): void {
    // Remove existing indicators
    const existingIndicators = document.querySelectorAll('.tos-analyzer-indicator');
    existingIndicators.forEach(indicator => indicator.remove());

    // Create risk indicator
    const indicator = document.createElement('div');
    indicator.className = 'tos-analyzer-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: ${analysis.assessment.overall === 'critical' ? '#dc3545' : '#fd7e14'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.3s ease;
      max-width: 300px;
    `;

    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">${analysis.assessment.overall === 'critical' ? '🚨' : '⚠️'}</span>
        <div>
          <div style="font-weight: 600;">TOS Risk: ${analysis.assessment.overall.toUpperCase()}</div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
            ${analysis.assessment.summary.substring(0, 60)}...
          </div>
        </div>
      </div>
    `;

    // Add click handler to open popup
    indicator.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
      }
    }, 10000);

    document.body.appendChild(indicator);
  }

  /**
   * Update extension badge
   */
  private updateBadge(riskLevel: string): void {
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE',
      payload: { riskLevel }
    });
  }

  /**
   * Setup mutation observer for dynamic content
   */
  private setupDynamicContentObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        // Check for added nodes that might contain TOS content
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (this.mightContainTOS(element)) {
              shouldScan = true;
            }
          }
        });
      });
      
      if (shouldScan) {
        // Debounce scanning
        clearTimeout(this.scanTimeout);
        this.scanTimeout = setTimeout(() => {
          this.performTOSScan();
        }, 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private scanTimeout: any;

  /**
   * Check if element might contain TOS content
   */
  private mightContainTOS(element: Element): boolean {
    const text = element.textContent?.toLowerCase() || '';
    let classNameValue = '';
    const cls = (element as any).className;
    if (typeof cls === 'string') {
      classNameValue = cls;
    } else if (typeof cls === 'object' && 'baseVal' in cls) {
      // SVGAnimatedString
      classNameValue = cls.baseVal as string;
    } else if (typeof cls === 'object' && 'value' in cls) {
      classNameValue = (cls as any).value as string;
    }
    const className = classNameValue.toLowerCase();
    const id = element.id?.toLowerCase() || '';
    
    const tosKeywords = ['terms', 'privacy', 'policy', 'agreement', 'legal'];
    
    return tosKeywords.some(keyword => 
      text.includes(keyword) || className.includes(keyword) || id.includes(keyword)
    );
  }

  /**
   * Setup modal monitoring
   */
  private setupModalMonitoring(): void {
    // Monitor for modal/dialog appearances
    const checkForModals = () => {
      const modals = document.querySelectorAll([
        '[role="dialog"]',
        '.modal',
        '.popup',
        '[class*="modal"]',
        '[id*="modal"]'
      ].join(','));

      modals.forEach((modalElement) => {
        const modal = modalElement as HTMLElement;
        if (modal.offsetParent !== null && !modal.hasAttribute('data-tos-checked')) {
          modal.setAttribute('data-tos-checked', 'true');
          
          // Check if modal contains TOS content
          if (this.mightContainTOS(modal)) {
            setTimeout(() => {
              this.performTOSScan();
            }, 500);
          }
        }
      });
    };

    // Check for modals periodically
    setInterval(checkForModals, 2000);
    
    // Also check when visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(checkForModals, 1000);
      }
    });
  }

  /**
   * Extract content from element
   */
  private extractContent(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    return clone.textContent?.trim() || '';
  }

  /**
   * Extract title from element
   */
  private extractTitle(element: Element): string | null {
    const titleSelectors = ['h1', 'h2', 'h3', '.title', '.heading', '[class*="title"]'];
    
    for (const selector of titleSelectors) {
      const titleEl = element.querySelector(selector);
      if (titleEl?.textContent?.trim()) {
        return titleEl.textContent.trim();
      }
    }
    
    return null;
  }

  /**
   * Wait for page to stabilize
   */
  private async waitForPageStable(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000); // Wait 2 seconds after complete
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 2000);
        });
      }
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on unload
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.detector.destroy();
  }
}

// Initialize content script
const contentScript = new ContentScript();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentScript['cleanup']();
}); 