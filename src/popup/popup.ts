import { AnalysisResult, ExtensionMessage } from '../types';

class PopupController {
  private currentUrl: string = '';
  private currentAnalysis: AnalysisResult | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Get current tab URL
    await this.getCurrentTabUrl();
    
    // Update website name display
    this.updateWebsiteName();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load existing analysis or scan for new one
    await this.loadAnalysis();
  }

  private async getCurrentTabUrl(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentUrl = tabs[0]?.url || '';
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  private updateWebsiteName(): void {
    const websiteNameEl = document.getElementById('websiteName');
    if (!websiteNameEl) return;

    try {
      if (!this.currentUrl) {
        websiteNameEl.textContent = 'Unknown Website';
        return;
      }

      const url = new URL(this.currentUrl);
      let displayName = url.hostname;

      // Remove www. prefix for cleaner display
      if (displayName.startsWith('www.')) {
        displayName = displayName.slice(4);
      }

      // Handle special cases
      if (displayName.startsWith('chrome://') || displayName.startsWith('moz-extension://') || displayName.startsWith('edge://')) {
        websiteNameEl.textContent = 'Browser Page';
      } else if (displayName === '') {
        websiteNameEl.textContent = 'Local File';
      } else {
        websiteNameEl.textContent = displayName;
      }
    } catch (error) {
      console.error('Failed to parse URL:', error);
      websiteNameEl.textContent = 'Unknown Website';
    }
  }

  private setupEventListeners(): void {
    // Manual scan button
    const manualScanBtn = document.getElementById('manualScanBtn');
    manualScanBtn?.addEventListener('click', () => this.performManualScan());

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    retryBtn?.addEventListener('click', () => this.loadAnalysis());

    // Clear analysis button
    const clearBtn = document.getElementById('clearBtn');
    clearBtn?.addEventListener('click', () => this.clearAnalysis());

    // Export analysis button
    const exportBtn = document.getElementById('exportBtn');
    exportBtn?.addEventListener('click', () => this.exportAnalysis());

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn?.addEventListener('click', () => this.openSettings());

    // Donation button
    const donateBtn = document.getElementById('donateBtn');
    donateBtn?.addEventListener('click', () => this.openDonationPage());

    // Toggle categories
    const toggleCategories = document.getElementById('toggleCategories');
    toggleCategories?.addEventListener('click', () => this.toggleCategories());
  }

  private async loadAnalysis(): Promise<void> {
    this.showLoadingState();

    try {
      // Get existing analysis
      const response = await this.sendMessage({
        type: 'GET_ANALYSIS',
        payload: { url: this.currentUrl }
      });

      if (response.success && response.analysis) {
        this.currentAnalysis = response.analysis;
        this.displayAnalysis(response.analysis);
      } else {
        // No existing analysis - show no analysis state instead of auto-scanning
        this.showNoAnalysisState();
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
      this.showErrorState('Failed to load analysis');
    }
  }

  private async performManualScan(): Promise<void> {
    this.showLoadingState();
    
    try {
      // Send scan request to content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      
      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'SCAN_FOR_TOS' });
        } catch (err) {
          // If no content script receiver, inject the content script manually then retry.
          if (chrome.runtime.lastError?.message?.includes('Receiving end does not exist')) {
            try {
              // Inject content script into all frames (MV3 requires the scripting permission)
              await chrome.scripting.executeScript({
                target: { tabId, allFrames: true },
                files: [chrome.runtime.getURL('content.js')]
              });

              // Retry sending the message
              await chrome.tabs.sendMessage(tabId, { type: 'SCAN_FOR_TOS' });
            } catch (injectErr) {
              console.error('Failed to inject content script:', injectErr);
              this.showErrorState('Unable to inject scanner into this page');
              return;
            }
          } else {
            throw err;
          }
        }
        
        // Wait a bit then check for analysis
        setTimeout(async () => {
          const response = await this.sendMessage({
            type: 'GET_ANALYSIS',
            payload: { url: this.currentUrl }
          });
          
          if (response.success && response.analysis) {
            this.currentAnalysis = response.analysis;
            this.displayAnalysis(response.analysis);
          } else {
            this.showNoAnalysisState();
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Manual scan failed:', error);
      this.showErrorState('Failed to scan for terms');
    }
  }

  private displayAnalysis(analysis: AnalysisResult): void {
    this.hideAllStates();
    
    const resultsDiv = document.getElementById('analysisResults');
    if (resultsDiv) {
      resultsDiv.style.display = 'block';
    }

    // Update risk badge
    this.updateRiskBadge(analysis.assessment.overall);

    // Update document title
    const titleEl = document.getElementById('documentTitle');
    if (titleEl) {
      titleEl.textContent = analysis.document.title;
    }

    // Update analysis meta
    this.updateAnalysisMeta(analysis);

    // Update summary
    const summaryEl = document.getElementById('analysisSummary');
    if (summaryEl) {
      summaryEl.textContent = analysis.assessment.summary;
    }

    // Update key points
    this.updateKeyPoints(analysis.assessment.keyPoints);

    // Update recommendations
    this.updateRecommendations(analysis.assessment.recommendations);

    // Update categories
    this.updateCategories(analysis.assessment.categories);
  }

  private updateRiskBadge(riskLevel: string): void {
    const badge = document.getElementById('riskBadge');
    const levelEl = document.getElementById('riskLevel');
    
    if (badge && levelEl) {
      // Remove existing risk classes
      badge.className = 'risk-badge';
      badge.classList.add(`risk-${riskLevel}`);
      
      levelEl.textContent = riskLevel.toUpperCase();
    }
  }

  private updateAnalysisMeta(analysis: AnalysisResult): void {
    const dateEl = document.getElementById('analysisDate');
    const timeEl = document.getElementById('processingTime');
    
    if (dateEl) {
      const date = new Date(analysis.document.extractedAt);
      dateEl.textContent = `Analyzed ${this.formatRelativeTime(date)}`;
    }
    
    if (timeEl) {
      timeEl.textContent = `${(analysis.processingTime / 1000).toFixed(1)}s processing`;
    }
  }

  private updateKeyPoints(keyPoints: string[]): void {
    const listEl = document.getElementById('keyPointsList');
    if (listEl) {
      listEl.innerHTML = '';
      keyPoints.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        listEl.appendChild(li);
      });
    }
  }

  private updateRecommendations(recommendations: string[]): void {
    const listEl = document.getElementById('recommendationsList');
    if (listEl) {
      listEl.innerHTML = '';
      recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        listEl.appendChild(li);
      });
    }
  }

  private updateCategories(categories: any[]): void {
    const contentEl = document.getElementById('categoriesContent');
    if (contentEl) {
      contentEl.innerHTML = '';
      categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-item';
        categoryDiv.innerHTML = `
          <div class="category-header">
            <span class="category-name">${category.name}</span>
            <span class="category-risk risk-${category.level}">${category.level.toUpperCase()}</span>
          </div>
          <p class="category-description">${category.description}</p>
          <p class="category-impact">${category.impact}</p>
        `;
        contentEl.appendChild(categoryDiv);
      });
    }
  }

  private showLoadingState(): void {
    this.hideAllStates();
    const loadingDiv = document.getElementById('loadingState');
    if (loadingDiv) {
      loadingDiv.style.display = 'block';
    }
  }

  private showNoAnalysisState(): void {
    this.hideAllStates();
    const noAnalysisDiv = document.getElementById('noAnalysisState');
    if (noAnalysisDiv) {
      noAnalysisDiv.style.display = 'block';
    }
  }

  private showErrorState(message: string): void {
    this.hideAllStates();
    const errorDiv = document.getElementById('errorState');
    const messageEl = document.getElementById('errorMessage');
    
    if (errorDiv) {
      errorDiv.style.display = 'block';
    }
    
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  private hideAllStates(): void {
    const states = ['loadingState', 'noAnalysisState', 'analysisResults', 'errorState'];
    states.forEach(stateId => {
      const el = document.getElementById(stateId);
      if (el) {
        el.style.display = 'none';
      }
    });
  }

  private async clearAnalysis(): Promise<void> {
    try {
      await this.sendMessage({
        type: 'CLEAR_ANALYSIS',
        payload: { url: this.currentUrl }
      });
      
      this.currentAnalysis = null;
      this.showNoAnalysisState();
      this.announceToScreenReader('Analysis cleared');
    } catch (error) {
      console.error('Failed to clear analysis:', error);
    }
  }

  private async exportAnalysis(): Promise<void> {
    if (!this.currentAnalysis) return;

    try {
      const exportData = {
        analysis: this.currentAnalysis,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const filename = `tos-analysis-${new Date().toISOString().split('T')[0]}.json`;

      // Use Chrome downloads API to avoid duplicate triggers across browsers
      if (chrome.downloads?.download) {
        chrome.downloads.download({ url, filename, saveAs: true }, () => {
          // Revoke after download triggered
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        });
      } else {
        // Fallback for environments without downloads permission
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.announceToScreenReader('Analysis exported');
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  private openSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  private openDonationPage(): void {
    chrome.tabs.create({ url: 'https://buymeacoffee.com/tosanalyzer' });
  }

  private toggleCategories(): void {
    const content = document.getElementById('categoriesContent');
    const toggle = document.getElementById('toggleCategories');
    
    if (content && toggle) {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      
      // Rotate arrow
      const svg = toggle.querySelector('svg');
      if (svg) {
        svg.style.transform = isVisible ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
    }
  }

  private async sendMessage(message: ExtensionMessage): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }

  private announceToScreenReader(message: string): void {
    const announcements = document.getElementById('announcements');
    if (announcements) {
      announcements.textContent = message;
      setTimeout(() => {
        announcements.textContent = '';
      }, 1000);
    }
  }
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
} 