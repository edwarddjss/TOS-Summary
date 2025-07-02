// Core types for TOS Analysis Extension

export interface TOSDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  extractedAt: Date;
  source: 'popup' | 'modal' | 'link' | 'checkbox' | 'embedded';
  selectors: string[];
}

export interface RiskAssessment {
  overall: 'low' | 'medium' | 'high' | 'critical';
  categories: RiskCategory[];
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  analysisVersion: string;
}

export interface RiskCategory {
  name: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  impact: string;
}

export interface AnalysisResult {
  document: TOSDocument;
  assessment: RiskAssessment;
  processingTime: number;
  modelUsed: string;
  confidence: number;
}

export interface ExtensionSettings {
  autoAnalyze: boolean;
  showNotifications: boolean;
  notificationThreshold: 'medium' | 'high' | 'critical';
  enableAccessibility: boolean;
  donationDismissed: boolean;
  lastDonationPrompt: Date | null;
}

export interface UIState {
  isAnalyzing: boolean;
  currentAnalysis: AnalysisResult | null;
  recentAnalyses: AnalysisResult[];
  error: string | null;
  modelLoaded: boolean;
}

// Chrome extension messaging types
export interface ExtensionMessage {
  type:
    | 'ANALYZE_TOS'
    | 'GET_ANALYSIS'
    | 'CLEAR_ANALYSIS'
    | 'UPDATE_SETTINGS'
    | 'MODEL_STATUS'
    | 'SCAN_FOR_TOS'
    | 'OPEN_POPUP'
    | 'UPDATE_BADGE'
    | 'GET_SETTINGS';
  payload?: any;
}

export interface AnalyzeTOSMessage extends ExtensionMessage {
  type: 'ANALYZE_TOS';
  payload: {
    document: TOSDocument;
  };
}

export interface GetAnalysisMessage extends ExtensionMessage {
  type: 'GET_ANALYSIS';
  payload: {
    url: string;
  };
}

// AI Worker types
export interface AIWorkerMessage {
  id: string;
  type: 'ANALYZE' | 'LOAD_MODEL' | 'MODEL_STATUS';
  payload: any;
}

export interface AIWorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
} 