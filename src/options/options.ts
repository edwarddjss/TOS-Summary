import { ExtensionSettings } from '../types';
import { StorageManager } from '../utils/storage';

class OptionsController {
  private settings: ExtensionSettings | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupEventListeners();
    this.populateForm();
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await StorageManager.getSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  private setupEventListeners(): void {
    // Form submission
    const form = document.getElementById('settingsForm') as HTMLFormElement;
    form?.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Export data
    const exportBtn = document.getElementById('exportDataBtn');
    exportBtn?.addEventListener('click', () => this.exportData());

    // Import data
    const importBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;
    importBtn?.addEventListener('click', () => importFileInput?.click());
    importFileInput?.addEventListener('change', (e) => this.importData(e));

    // Clear data
    const clearBtn = document.getElementById('clearDataBtn');
    clearBtn?.addEventListener('click', () => this.showConfirmation('clearData'));

    // Donation buttons
    const donateBtn = document.getElementById('donateBtn');
    donateBtn?.addEventListener('click', () => this.openDonationPage());

    const dismissDonationBtn = document.getElementById('dismissDonationBtn');
    dismissDonationBtn?.addEventListener('click', () => this.dismissDonation());

    // Confirmation modal
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');
    confirmYes?.addEventListener('click', () => this.handleConfirmation(true));
    confirmNo?.addEventListener('click', () => this.handleConfirmation(false));

    // Links
    const privacyLink = document.getElementById('privacyPolicyLink');
    privacyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://tosanalyzer.com/privacy' });
    });

    const supportLink = document.getElementById('supportLink');
    supportLink?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/your-org/tos-analyzer-extension/issues' });
    });

    const githubLink = document.getElementById('githubLink');
    githubLink?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/your-org/tos-analyzer-extension' });
    });
  }

  private populateForm(): void {
    if (!this.settings) return;

    // Analysis settings
    const autoAnalyzeCheckbox = document.getElementById('autoAnalyze') as HTMLInputElement;
    if (autoAnalyzeCheckbox) {
      autoAnalyzeCheckbox.checked = this.settings.autoAnalyze;
    }

    const showNotificationsCheckbox = document.getElementById('showNotifications') as HTMLInputElement;
    if (showNotificationsCheckbox) {
      showNotificationsCheckbox.checked = this.settings.showNotifications;
    }

    const notificationThresholdSelect = document.getElementById('notificationThreshold') as HTMLSelectElement;
    if (notificationThresholdSelect) {
      notificationThresholdSelect.value = this.settings.notificationThreshold;
    }

    // Accessibility settings
    const enableAccessibilityCheckbox = document.getElementById('enableAccessibility') as HTMLInputElement;
    if (enableAccessibilityCheckbox) {
      enableAccessibilityCheckbox.checked = this.settings.enableAccessibility;
    }

    // Hide donation section if dismissed
    if (this.settings.donationDismissed) {
      const supportSection = document.querySelector('.settings-section:last-of-type') as HTMLElement | null;
      if (supportSection) {
        supportSection.style.display = 'none';
      }
    }
  }

  private async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const formData = new FormData(event.target as HTMLFormElement);
    
    const newSettings: Partial<ExtensionSettings> = {
      autoAnalyze: formData.has('autoAnalyze'),
      showNotifications: formData.has('showNotifications'),
      notificationThreshold: formData.get('notificationThreshold') as 'medium' | 'high' | 'critical',
      enableAccessibility: formData.has('enableAccessibility')
    };

    try {
      await StorageManager.saveSettings(newSettings);
      this.settings = { ...this.settings!, ...newSettings };
      this.showStatus('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  private async exportData(): Promise<void> {
    try {
      const exportData = await StorageManager.exportData();
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `tos-analyzer-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showStatus('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showStatus('Failed to export data', 'error');
    }
  }

  private async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    try {
      const content = await this.readFileAsText(file);
      await StorageManager.importData(content);
      
      // Reload settings
      await this.loadSettings();
      this.populateForm();
      
      this.showStatus('Data imported successfully', 'success');
    } catch (error) {
      console.error('Import failed:', error);
      this.showStatus('Failed to import data', 'error');
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private currentConfirmationAction: string | null = null;

  private showConfirmation(action: string): void {
    this.currentConfirmationAction = action;
    
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    
    if (modal && title && message) {
      modal.style.display = 'block';
      
      switch (action) {
        case 'clearData':
          title.textContent = 'Clear All Data';
          message.textContent = 'This will permanently delete all analysis data and reset settings to defaults. This action cannot be undone.';
          break;
        default:
          title.textContent = 'Confirm Action';
          message.textContent = 'Are you sure you want to proceed?';
      }
    }
  }

  private async handleConfirmation(confirmed: boolean): Promise<void> {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      modal.style.display = 'none';
    }

    if (!confirmed || !this.currentConfirmationAction) {
      this.currentConfirmationAction = null;
      return;
    }

    try {
      switch (this.currentConfirmationAction) {
        case 'clearData':
          await this.clearAllData();
          break;
      }
    } catch (error) {
      console.error('Confirmation action failed:', error);
    }

    this.currentConfirmationAction = null;
  }

  private async clearAllData(): Promise<void> {
    try {
      await StorageManager.clearAllAnalyses();
      await StorageManager.saveSettings({
        autoAnalyze: false,
        showNotifications: true,
        notificationThreshold: 'medium',
        enableAccessibility: true,
        donationDismissed: false,
        lastDonationPrompt: null
      });
      
      // Reload settings and form
      await this.loadSettings();
      this.populateForm();
      
      this.showStatus('All data cleared successfully', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showStatus('Failed to clear data', 'error');
    }
  }

  private openDonationPage(): void {
    chrome.tabs.create({ url: 'https://buymeacoffee.com/tosanalyzer' });
  }

  private async dismissDonation(): Promise<void> {
    try {
      await StorageManager.saveSettings({ 
        donationDismissed: true,
        lastDonationPrompt: new Date()
      });
      
      const supportSection = document.querySelector('.settings-section:last-of-type') as HTMLElement | null;
      if (supportSection) {
        supportSection.style.display = 'none';
      }
      
      this.showStatus('Donation prompts disabled', 'success');
    } catch (error) {
      console.error('Failed to dismiss donation:', error);
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    const statusMessage = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');
    
    if (statusMessage && statusText) {
      statusText.textContent = message;
      statusMessage.className = `status-message ${type}`;
      statusMessage.style.display = 'block';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize options controller when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OptionsController());
} else {
  new OptionsController();
} 