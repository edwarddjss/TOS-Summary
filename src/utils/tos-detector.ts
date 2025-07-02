import { TOSDocument } from '../types';

// Common patterns for TOS/Privacy Policy detection
const TOS_KEYWORDS = [
  'terms of service', 'terms of use', 'terms and conditions',
  'privacy policy', 'privacy notice', 'privacy statement',
  'user agreement', 'end user license', 'eula',
  'cookie policy', 'data protection', 'legal notice'
];

const TOS_LINK_PATTERNS = [
  /terms.{0,10}(of.{0,5})?(service|use|condition)/i,
  /privacy.{0,10}(policy|notice|statement)/i,
  /user.{0,10}agreement/i,
  /legal.{0,10}notice/i,
  /cookie.{0,10}policy/i,
  /eula/i
];

const TOS_SELECTORS = [
  // Common TOS link selectors
  'a[href*="terms"]',
  'a[href*="privacy"]',
  'a[href*="legal"]',
  'a[href*="policy"]',
  'a[href*="agreement"]',
  'a[href*="eula"]',
  
  // Modal and popup selectors
  '[class*="modal"][class*="terms"]',
  '[class*="modal"][class*="privacy"]',
  '[id*="terms"]',
  '[id*="privacy"]',
  
  // Checkbox areas
  'label[for*="terms"]',
  'label[for*="privacy"]',
  'input[name*="terms"]',
  'input[name*="privacy"]',
  
  // Common content areas
  '[class*="terms-content"]',
  '[class*="privacy-content"]',
  '[class*="legal-text"]'
];

export class TOSDetector {
  private mutationObserver: MutationObserver | null = null;
  private detectedElements: Set<Element> = new Set();

  constructor() {
    this.setupMutationObserver();
  }

  /**
   * Main detection method - finds TOS elements on the current page
   */
  public detectTOSElements(): TOSDocument[] {
    const documents: TOSDocument[] = [];
    
    // Check for modal/popup TOS
    documents.push(...this.detectModals());
    
    // Check for TOS links
    documents.push(...this.detectLinks());
    
    // Check for embedded TOS content
    documents.push(...this.detectEmbeddedContent());
    
    // Generic detection based on headings (Terms of Service/Privacy Policy text in headings)
    documents.push(...this.detectHeadingSections());
    
    // Check for checkbox-associated TOS
    documents.push(...this.detectCheckboxTOS());
    
    return documents;
  }

  /**
   * Detect TOS in modal dialogs and popups
   */
  private detectModals(): TOSDocument[] {
    const documents: TOSDocument[] = [];
    
    const modals = document.querySelectorAll([
      '[role="dialog"]',
      '.modal',
      '.popup',
      '[class*="modal"]',
      '[id*="modal"]'
    ].join(','));

    modals.forEach((modal) => {
      if (this.containsTOSContent(modal)) {
        const content = this.extractTextContent(modal);
        if (content && content.length > 100) {
          documents.push({
            id: this.generateId(),
            url: window.location.href,
            title: this.extractTitle(modal) || 'Modal Terms',
            content,
            extractedAt: new Date(),
            source: 'modal',
            selectors: [this.getSelector(modal)]
          });
        }
      }
    });

    return documents;
  }

  /**
   * Detect TOS links that lead to full documents
   */
  private detectLinks(): TOSDocument[] {
    const documents: TOSDocument[] = [];
    
    const links = document.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>;
    
    links.forEach((link) => {
      const linkText = link.textContent?.toLowerCase() || '';
      const href = link.href.toLowerCase();
      
      if (this.isTOSLink(linkText, href)) {
        // Try to fetch content if it's a relative link or same domain
        if (this.isSameDomain(link.href)) {
          this.fetchTOSContent(link.href).then((content) => {
            if (content) {
              documents.push({
                id: this.generateId(),
                url: link.href,
                title: linkText || 'Terms Document',
                content,
                extractedAt: new Date(),
                source: 'link',
                selectors: [this.getSelector(link)]
              });
            }
          });
        }
      }
    });

    return documents;
  }

  /**
   * Detect embedded TOS content directly on the page
   */
  private detectEmbeddedContent(): TOSDocument[] {
    const documents: TOSDocument[] = [];
    
    TOS_SELECTORS.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (this.containsTOSContent(element)) {
            const content = this.extractTextContent(element);
            if (content && content.length > 200) {
              documents.push({
                id: this.generateId(),
                url: window.location.href,
                title: this.extractTitle(element) || 'Embedded Terms',
                content,
                extractedAt: new Date(),
                source: 'embedded',
                selectors: [selector]
              });
            }
          }
        });
      } catch (e) {
        console.warn(`Error with selector ${selector}:`, e);
      }
    });

    return documents;
  }

  /**
   * Detect TOS associated with checkboxes
   */
  private detectCheckboxTOS(): TOSDocument[] {
    const documents: TOSDocument[] = [];
    
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach((checkbox) => {
      const label = this.findAssociatedLabel(checkbox);
      if (label && this.containsTOSKeywords(label.textContent || '')) {
        // Look for nearby TOS content
        const tosContent = this.findNearbyTOSContent(checkbox);
        if (tosContent) {
          documents.push({
            id: this.generateId(),
            url: window.location.href,
            title: 'Checkbox Terms',
            content: tosContent,
            extractedAt: new Date(),
            source: 'checkbox',
            selectors: [this.getSelector(checkbox)]
          });
        }
      }
    });

    return documents;
  }

  /**
   * Check if element contains TOS-related content
   */
  private containsTOSContent(element: Element): boolean {
    const text = element.textContent?.toLowerCase() || '';
    return this.containsTOSKeywords(text);
  }

  /**
   * Check if text contains TOS keywords
   */
  private containsTOSKeywords(text: string): boolean {
    return TOS_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * Check if a link is likely a TOS link
   */
  private isTOSLink(linkText: string, href: string): boolean {
    return TOS_LINK_PATTERNS.some(pattern => pattern.test(linkText) || pattern.test(href));
  }

  /**
   * Extract clean text content from element
   */
  private extractTextContent(element: Element): string {
    // Remove script and style elements
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
   * Generate unique ID for TOS document
   */
  private generateId(): string {
    return `tos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get CSS selector for element
   */
  private getSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  /**
   * Check if URL is same domain
   */
  private isSameDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === window.location.hostname;
    } catch {
      return false;
    }
  }

  /**
   * Fetch TOS content from URL
   */
  private async fetchTOSContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to find main content
      const content = doc.querySelector('main') || doc.querySelector('.content') || doc.body;
      return this.extractTextContent(content);
    } catch (e) {
      console.warn('Failed to fetch TOS content:', e);
      return null;
    }
  }

  /**
   * Find label associated with checkbox
   */
  private findAssociatedLabel(checkbox: Element): Element | null {
    const id = checkbox.getAttribute('id');
    if (id) {
      return document.querySelector(`label[for="${id}"]`);
    }
    
    // Look for parent label
    return checkbox.closest('label');
  }

  /**
   * Find TOS content near checkbox
   */
  private findNearbyTOSContent(checkbox: Element): string | null {
    let current = checkbox.parentElement;
    let depth = 0;
    
    while (current && depth < 5) {
      const content = this.extractTextContent(current);
      if (content.length > 100 && this.containsTOSKeywords(content)) {
        return content;
      }
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }

  /**
   * Setup mutation observer for dynamic content
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (this.containsTOSContent(element)) {
              this.detectedElements.add(element);
              // Notify content script about new TOS content
              this.notifyNewTOSContent(element);
            }
          }
        });
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Notify about new TOS content
   */
  private notifyNewTOSContent(element: Element): void {
    // This will be called by the content script
    window.dispatchEvent(new CustomEvent('tosDetected', {
      detail: { element, selector: this.getSelector(element) }
    }));
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.detectedElements.clear();
  }

  /**
   * Detect TOS sections by looking for headings that contain keywords
   */
  private detectHeadingSections(): TOSDocument[] {
    const documents: TOSDocument[] = [];

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5');

    headings.forEach((heading) => {
      const text = heading.textContent?.toLowerCase() || '';
      if (this.containsTOSKeywords(text)) {
        // Walk up the DOM to find a reasonably sized container (section/article/div)
        let container: Element | null = heading.parentElement;
        let depth = 0;
        while (container && depth < 3 && container.textContent) {
          const len = container.textContent.length;
          if (len > 300) break; // good enough
          container = container.parentElement;
          depth++;
        }

        const target = container || heading;
        const content = this.extractTextContent(target);

        if (content.length > 300) {
          documents.push({
            id: this.generateId(),
            url: window.location.href,
            title: this.extractTitle(target) || heading.textContent?.trim() || 'Terms',
            content,
            extractedAt: new Date(),
            source: 'embedded',
            selectors: [this.getSelector(heading)]
          });
        }
      }
    });

    return documents;
  }
} 