import { ExtensionSettings, AnalysisResult, UIState } from '../types';

// Default settings
const DEFAULT_SETTINGS: ExtensionSettings = {
  autoAnalyze: false,
  showNotifications: true,
  notificationThreshold: 'medium',
  enableAccessibility: true,
  donationDismissed: false,
  lastDonationPrompt: null
};

export class StorageManager {
  private static readonly SETTINGS_KEY = 'tos_analyzer_settings';
  private static readonly ANALYSES_KEY = 'tos_analyzer_analyses';
  private static readonly UI_STATE_KEY = 'tos_analyzer_ui_state';

  /**
   * Get extension settings
   */
  static async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.sync.get(this.SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS, ...result[this.SETTINGS_KEY] };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save extension settings
   */
  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await chrome.storage.sync.set({ [this.SETTINGS_KEY]: updatedSettings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get analysis results for a URL
   */
  static async getAnalysis(url: string): Promise<AnalysisResult | null> {
    try {
      const result = await chrome.storage.local.get(this.ANALYSES_KEY);
      const analyses = result[this.ANALYSES_KEY] || {};
      return analyses[url] || null;
    } catch (error) {
      console.error('Failed to get analysis:', error);
      return null;
    }
  }

  /**
   * Save analysis result
   */
  static async saveAnalysis(analysis: AnalysisResult): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.ANALYSES_KEY);
      const analyses = result[this.ANALYSES_KEY] || {};
      analyses[analysis.document.url] = analysis;
      
      // Keep only last 100 analyses to prevent storage bloat
      const urls = Object.keys(analyses);
      if (urls.length > 100) {
        const sortedAnalyses = urls
          .map(url => analyses[url])
          .sort((a, b) => new Date(b.document.extractedAt).getTime() - new Date(a.document.extractedAt).getTime())
          .slice(0, 100);
        
        const trimmedAnalyses: Record<string, AnalysisResult> = {};
        sortedAnalyses.forEach(analysis => {
          trimmedAnalyses[analysis.document.url] = analysis;
        });
        
        await chrome.storage.local.set({ [this.ANALYSES_KEY]: trimmedAnalyses });
      } else {
        await chrome.storage.local.set({ [this.ANALYSES_KEY]: analyses });
      }
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
    }
  }

  /**
   * Get all recent analyses
   */
  static async getRecentAnalyses(limit: number = 10): Promise<AnalysisResult[]> {
    try {
      const result = await chrome.storage.local.get(this.ANALYSES_KEY);
      const analyses: Record<string, AnalysisResult> = result[this.ANALYSES_KEY] || {};
      
      return Object.values(analyses)
        .sort((a, b) => new Date(b.document.extractedAt).getTime() - new Date(a.document.extractedAt).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get recent analyses:', error);
      return [];
    }
  }

  /**
   * Clear analysis for a specific URL
   */
  static async clearAnalysis(url: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.ANALYSES_KEY);
      const analyses = result[this.ANALYSES_KEY] || {};
      delete analyses[url];
      await chrome.storage.local.set({ [this.ANALYSES_KEY]: analyses });
    } catch (error) {
      console.error('Failed to clear analysis:', error);
      throw error;
    }
  }

  /**
   * Clear all analyses
   */
  static async clearAllAnalyses(): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.ANALYSES_KEY]: {} });
    } catch (error) {
      console.error('Failed to clear all analyses:', error);
      throw error;
    }
  }

  /**
   * Get UI state
   */
  static async getUIState(): Promise<Partial<UIState>> {
    try {
      const result = await chrome.storage.local.get(this.UI_STATE_KEY);
      return result[this.UI_STATE_KEY] || {};
    } catch (error) {
      console.error('Failed to get UI state:', error);
      return {};
    }
  }

  /**
   * Save UI state
   */
  static async saveUIState(state: Partial<UIState>): Promise<void> {
    try {
      const currentState = await this.getUIState();
      const updatedState = { ...currentState, ...state };
      await chrome.storage.local.set({ [this.UI_STATE_KEY]: updatedState });
    } catch (error) {
      console.error('Failed to save UI state:', error);
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{ used: number; quota: number }> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      return {
        used: usage,
        quota: chrome.storage.local.QUOTA_BYTES
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { used: 0, quota: 0 };
    }
  }

  /**
   * Check if storage is approaching limit
   */
  static async isStorageNearLimit(): Promise<boolean> {
    const stats = await this.getStorageStats();
    return stats.used / stats.quota > 0.8; // 80% threshold
  }

  /**
   * Cleanup old data if storage is near limit
   */
  static async cleanupStorage(): Promise<void> {
    if (await this.isStorageNearLimit()) {
      // Keep only last 50 analyses
      const recentAnalyses = await this.getRecentAnalyses(50);
      const analyses: Record<string, AnalysisResult> = {};
      recentAnalyses.forEach(analysis => {
        analyses[analysis.document.url] = analysis;
      });
      await chrome.storage.local.set({ [this.ANALYSES_KEY]: analyses });
    }
  }

  /**
   * Export all data for backup
   */
  static async exportData(): Promise<string> {
    try {
      const [settings, analyses, uiState] = await Promise.all([
        this.getSettings(),
        chrome.storage.local.get(this.ANALYSES_KEY),
        this.getUIState()
      ]);

      return JSON.stringify({
        settings,
        analyses: analyses[this.ANALYSES_KEY] || {},
        uiState,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import data from backup
   */
  static async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.settings) {
        await chrome.storage.sync.set({ [this.SETTINGS_KEY]: data.settings });
      }
      
      if (data.analyses) {
        await chrome.storage.local.set({ [this.ANALYSES_KEY]: data.analyses });
      }
      
      if (data.uiState) {
        await chrome.storage.local.set({ [this.UI_STATE_KEY]: data.uiState });
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }
} 