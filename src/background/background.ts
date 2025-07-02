import { ExtensionMessage, AnalyzeTOSMessage, AIWorkerMessage, AIWorkerResponse, AnalysisResult } from '../types';
import { StorageManager } from '../utils/storage';
import { TOSAnalyzerCore } from '../ai/ai-worker';

class BackgroundService {
  private aiWorker: Worker | null = null;
  private pendingAnalyses = new Map<string, (result: any) => void>();
  private fallbackAnalyzer: any | null = null;

  constructor() {
    this.initializeWorker();
    this.setupMessageListeners();
    this.setupStorageCleanup();
  }

  /**
   * Initialize AI worker for analysis
   */
  private async initializeWorker(): Promise<void> {
    try {
      // Use extension-relative URL so the worker can be resolved correctly inside the service worker context
      const workerUrl = chrome.runtime.getURL('dist/ai-worker.js');
      if (typeof Worker === 'undefined') {
        // Service worker environment: fallback to in-process analyzer
        this.fallbackAnalyzer = new TOSAnalyzerCore();
      } else {
        this.aiWorker = new Worker(workerUrl);
      }
      
      if (this.aiWorker) {
        this.aiWorker.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
          const { id, success, data, error } = event.data;
          const resolver = this.pendingAnalyses.get(id);
          
          if (resolver) {
            this.pendingAnalyses.delete(id);
            if (success) {
              resolver(data);
            } else {
              resolver({ error });
            }
          }
        };

        this.aiWorker.onerror = (error) => {
          console.error('AI Worker error:', error);
        };
      }

      // Load the model
      this.sendToWorker('LOAD_MODEL', null);
    } catch (error) {
      console.error('Failed to initialize AI worker:', error);
    }
  }

  /**
   * Setup Chrome extension message listeners
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Indicates we will send a response asynchronously
      }
    );

    // Handle tab updates to potentially trigger analysis
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        const settings = await StorageManager.getSettings();
        if (settings.autoAnalyze) {
          // Check if this URL has recent analysis
          const existingAnalysis = await StorageManager.getAnalysis(tab.url);
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          
          if (!existingAnalysis || new Date(existingAnalysis.document.extractedAt).getTime() < oneHourAgo) {
            // Trigger TOS detection on the page
            chrome.tabs.sendMessage(tabId, { type: 'SCAN_FOR_TOS' });
          }
        }
      }
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'ANALYZE_TOS':
          await this.handleAnalyzeTOS(message as AnalyzeTOSMessage, sendResponse);
          break;
        
        case 'GET_ANALYSIS':
          await this.handleGetAnalysis(message.payload.url, sendResponse);
          break;
        
        case 'CLEAR_ANALYSIS':
          await this.handleClearAnalysis(message.payload.url, sendResponse);
          break;
        
        case 'UPDATE_SETTINGS':
          await this.handleUpdateSettings(message.payload, sendResponse);
          break;
        
        case 'MODEL_STATUS':
          await this.handleModelStatus(sendResponse);
          break;
        
        case 'OPEN_POPUP':
          // Attempt to programmatically open the browser-action popup
          if (chrome.action?.openPopup) {
            chrome.action.openPopup();
          }
          sendResponse({ success: true });
          break;
        
        case 'UPDATE_BADGE':
          await this.handleUpdateBadge(message.payload.riskLevel);
          sendResponse({ success: true });
          break;
        
        case 'GET_SETTINGS':
          await this.handleGetSettings(sendResponse);
          break;
        
        default:
          sendResponse({ error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Handle TOS analysis request
   */
  private async handleAnalyzeTOS(
    message: AnalyzeTOSMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      const { document } = message.payload;
      
      // Check if we already have recent analysis for this content
      const existingAnalysis = await StorageManager.getAnalysis(document.url);
      if (existingAnalysis && this.isSameContent(existingAnalysis.document, document)) {
        sendResponse({ success: true, analysis: existingAnalysis });
        return;
      }

      // Perform analysis using AI worker
      const analysisData = await this.analyzeWithWorker(document);
      
      if (analysisData.error) {
        sendResponse({ success: false, error: analysisData.error });
        return;
      }

      // Create complete analysis result
      const analysisResult: AnalysisResult = {
        document,
        assessment: analysisData.assessment,
        processingTime: analysisData.processingTime,
        modelUsed: analysisData.modelUsed,
        confidence: analysisData.confidence
      };

      // Save analysis
      await StorageManager.saveAnalysis(analysisResult);

      // Show notification if enabled
      await this.showAnalysisNotification(analysisResult);

      sendResponse({ success: true, analysis: analysisResult });
    } catch (error) {
      console.error('Analysis failed:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Analysis failed' });
    }
  }

  /**
   * Handle get analysis request
   */
  private async handleGetAnalysis(url: string, sendResponse: (response?: any) => void): Promise<void> {
    try {
      const analysis = await StorageManager.getAnalysis(url);
      sendResponse({ success: true, analysis });
    } catch (error) {
      console.error('Failed to get analysis:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to get analysis' });
    }
  }

  /**
   * Handle clear analysis request
   */
  private async handleClearAnalysis(url: string, sendResponse: (response?: any) => void): Promise<void> {
    try {
      await StorageManager.clearAnalysis(url);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to clear analysis:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to clear analysis' });
    }
  }

  /**
   * Handle update settings request
   */
  private async handleUpdateSettings(settings: any, sendResponse: (response?: any) => void): Promise<void> {
    try {
      await StorageManager.saveSettings(settings);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to update settings:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to update settings' });
    }
  }

  /**
   * Handle model status request
   */
  private async handleModelStatus(sendResponse: (response?: any) => void): Promise<void> {
    try {
      const status = await this.getWorkerStatus();
      sendResponse({ success: true, status });
    } catch (error) {
      console.error('Failed to get model status:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to get status' });
    }
  }

  /**
   * Send message to AI worker
   */
  private sendToWorker(type: AIWorkerMessage['type'], payload: any): Promise<any> {
    // Use fallback analyzer if worker not available
    if (!this.aiWorker && this.fallbackAnalyzer) {
      if (type === 'ANALYZE') {
        return this.fallbackAnalyzer['analyzeDocument'](payload).then((assessment: any) => ({
          assessment,
          processingTime: 0,
          modelUsed: 'TOS-Analyzer-v1',
          confidence: 0.8
        }));
      }
      if (type === 'MODEL_STATUS') {
        return Promise.resolve({ loaded: true });
      }
      if (type === 'LOAD_MODEL') {
        return Promise.resolve({ status: 'already_loaded' });
      }
    }

    return new Promise((resolve) => {
      if (!this.aiWorker) {
        resolve({ error: 'AI Worker not available' });
        return;
      }

      const id = this.generateId();
      this.pendingAnalyses.set(id, resolve);

      const message: AIWorkerMessage = { id, type, payload };
      this.aiWorker.postMessage(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingAnalyses.has(id)) {
          this.pendingAnalyses.delete(id);
          resolve({ error: 'Analysis timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Analyze document using AI worker
   */
  private async analyzeWithWorker(document: any): Promise<any> {
    return this.sendToWorker('ANALYZE', document);
  }

  /**
   * Get AI worker status
   */
  private async getWorkerStatus(): Promise<any> {
    return this.sendToWorker('MODEL_STATUS', null);
  }

  /**
   * Check if document content is the same as existing analysis
   */
  private isSameContent(existing: any, current: any): boolean {
    return existing.content === current.content && existing.title === current.title;
  }

  /**
   * Show analysis notification
   */
  private async showAnalysisNotification(analysis: AnalysisResult): Promise<void> {
    const settings = await StorageManager.getSettings();
    
    if (!settings.showNotifications) {
      return;
    }

    const riskLevel = analysis.assessment.overall;
    // If popup will auto-open for high/critical risk, skip system notification
    const shouldShow = this.shouldShowNotification(riskLevel, settings.notificationThreshold) && !(riskLevel === 'high' || riskLevel === 'critical');
    
    if (!shouldShow) {
      return;
    }

    const iconPath = this.getNotificationIcon(riskLevel);
    const title = `TOS Analyzer - ${riskLevel.toUpperCase()} Risk`;
    const message = analysis.assessment.summary.substring(0, 100) + '...';

    chrome.notifications.create({
      type: 'basic',
      iconUrl: iconPath,
      title,
      message,
      contextMessage: analysis.document.title,
      buttons: [
        { title: 'View Details' },
        { title: 'Dismiss' }
      ]
    });
  }

  /**
   * Determine if notification should be shown based on risk level and threshold
   */
  private shouldShowNotification(riskLevel: string, threshold: string): boolean {
    const riskPriority = { low: 1, medium: 2, high: 3, critical: 4 };
    const thresholdPriority = { medium: 2, high: 3, critical: 4 };
    
    return riskPriority[riskLevel as keyof typeof riskPriority] >= 
           thresholdPriority[threshold as keyof typeof thresholdPriority];
  }

  /**
   * Get appropriate notification icon for risk level
   */
  private getNotificationIcon(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return '/icons/icon-critical-48.png';
      case 'high': return '/icons/icon-high-48.png';
      case 'medium': return '/icons/icon-medium-48.png';
      default: return '/icons/icon-low-48.png';
    }
  }

  /**
   * Setup periodic storage cleanup
   */
  private setupStorageCleanup(): void {
    // Clean up storage every 24 hours
    setInterval(async () => {
      try {
        await StorageManager.cleanupStorage();
      } catch (error) {
        console.error('Storage cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update extension badge (text & colour) based on risk level
   */
  private async handleUpdateBadge(riskLevel: string): Promise<void> {
    const badgeText = {
      low: '',
      medium: 'MED',
      high: 'HIGH',
      critical: '!!'
    } as Record<string, string>;

    const badgeColour = {
      low: '#6c757d',
      medium: '#fd7e14',
      high: '#dc3545',
      critical: '#b02a37'
    } as Record<string, string>;

    try {
      chrome.action.setBadgeBackgroundColor({ color: badgeColour[riskLevel] || '#6c757d' });
      chrome.action.setBadgeText({ text: badgeText[riskLevel] || '' });
    } catch (error) {
      console.warn('Failed to update badge:', error);
    }
  }

  /**
   * Handle get settings request
   */
  private async handleGetSettings(sendResponse: (response?: any) => void): Promise<void> {
    try {
      const settings = await StorageManager.getSettings();
      sendResponse({ success: true, settings });
    } catch (error) {
      console.error('Failed to get settings:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Failed to get settings' });
    }
  }
}

// Initialize background service
new BackgroundService(); 