import { AIWorkerMessage, AIWorkerResponse, TOSDocument, RiskAssessment } from '../types';

// Web Worker context
declare const self: DedicatedWorkerGlobalScope;

export class TOSAnalyzerCore {
  private modelLoaded = false;
  private textGenerator: any = null;
  private textClassifier: any = null;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    self.onmessage = async (event: MessageEvent<AIWorkerMessage>) => {
      const { id, type, payload } = event.data;
      
      try {
        let response: AIWorkerResponse;
        
        switch (type) {
          case 'LOAD_MODEL':
            response = await this.handleLoadModel(id);
            break;
          case 'ANALYZE':
            response = await this.handleAnalyze(id, payload);
            break;
          case 'MODEL_STATUS':
            response = {
              id,
              success: true,
              data: { loaded: this.modelLoaded }
            };
            break;
          default:
            throw new Error(`Unknown message type: ${type}`);
        }
        
        self.postMessage(response);
      } catch (error) {
        self.postMessage({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  }

  private async handleLoadModel(id: string): Promise<AIWorkerResponse> {
    if (this.modelLoaded) {
      return { id, success: true, data: { status: 'already_loaded' } };
    }

    try {
      // Dynamically import transformers to reduce initial bundle size
      const { pipeline, env } = await import('@huggingface/transformers');
      
      // Configure Transformers.js for web environment
      env.allowLocalModels = false;
      env.allowRemoteModels = true;

      // Load only a lightweight text classification model
      // Skip text generation to reduce bundle size - use rule-based summaries instead
      this.textClassifier = await pipeline(
        'text-classification',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { 
          dtype: 'q8', // Use q8 instead of q4 for better compatibility
          progress_callback: (progress: any) => {
            // Send progress updates to main thread
            self.postMessage({
              id,
              success: true,
              data: { status: 'loading', progress }
            });
          }
        }
      );

      // Don't load text generation model to reduce bundle size
      // this.textGenerator = null;

      this.modelLoaded = true;
      
      return {
        id,
        success: true,
        data: { status: 'loaded', modelName: 'DistilBERT TOS Analyzer' }
      };
    } catch (error) {
      return {
        id,
        success: false,
        error: `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async handleAnalyze(id: string, document: TOSDocument): Promise<AIWorkerResponse> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    try {
      const startTime = Date.now();
      const assessment = await this.analyzeDocument(document);
      const processingTime = Date.now() - startTime;

      return {
        id,
        success: true,
        data: {
          assessment,
          processingTime,
          modelUsed: 'TOS-Analyzer-v1',
          confidence: 0.85
        }
      };
    } catch (error) {
      return {
        id,
        success: false,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async analyzeDocument(document: TOSDocument): Promise<RiskAssessment> {
    const content = document.content.toLowerCase();
    
    // Use rule-based analysis with AI model available for future enhancements
    const riskCategories = [
      this.analyzeDataCollection(content),
      this.analyzeDataSharing(content),
      this.analyzeUserRights(content),
      this.analyzeDisputeResolution(content),
      this.analyzeTermination(content),
      this.analyzeLiability(content),
      this.analyzeChangesToTerms(content)
    ];

    // Calculate overall risk
    const riskLevels = riskCategories.map(cat => cat.level);
    const overallRisk = this.calculateOverallRisk(riskLevels);

    // Generate summary (use rule-based for now to reduce bundle size)
    const summary = this.generateSummary(riskCategories, overallRisk);
    const keyPoints = this.extractKeyPoints(riskCategories);
    const recommendations = this.generateRecommendations(riskCategories);

    return {
      overall: overallRisk,
      categories: riskCategories,
      summary,
      keyPoints,
      recommendations,
      analysisVersion: '2.1.0'
    };
  }

  private analyzeDataCollection(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];
    
    const criticalPatterns = [
      'biometric data', 'genetic data', 'financial information', 'social security',
      'sensitive personal', 'health information', 'medical records'
    ];
    
    const highRiskPatterns = [
      'precise location', 'device fingerprint', 'personal preferences',
      'behavioral data', 'advertising id', 'facial recognition'
    ];
    
    const mediumRiskPatterns = [
      'personal information', 'collect data', 'tracking', 'cookies',
      'ip address', 'approximate location', 'device information'
    ];

    criticalPatterns.forEach(p => {
      if (content.includes(p)) {
        level = 'critical';
        evidence.push(`Collects ${p}`);
      }
    });
    
    if (level === 'low') {
      highRiskPatterns.forEach(p => {
        if (content.includes(p)) {
          level = 'high';
          evidence.push(`Collects ${p}`);
        }
      });
    }

    if (level === 'low') {
      mediumRiskPatterns.forEach(p => {
        if (content.includes(p)) {
          level = 'medium';
          evidence.push(`Collects ${p}`);
        }
      });
    }

    return {
      name: 'Data Collection',
      level,
      description: 'What personal information is collected',
      evidence,
      impact: {
        low: 'Limited data collection',
        medium: 'Moderate privacy implications',
        high: 'High privacy risk',
        critical: 'Critical data collection risk'
      }[level]
    };
  }

  private analyzeDataSharing(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];
    
    const criticalPatterns = [
      'sell your data', 'sell personal information', 'monetize data'
    ];
    
    const highRiskPatterns = [
      'third parties', 'share with partners', 'affiliate companies',
      'advertising networks', 'data brokers'
    ];
    
    const mediumRiskPatterns = [
      'service providers', 'analytics', 'marketing purposes'
    ];

    criticalPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        level = 'critical';
        evidence.push(`May ${pattern}`);
      }
    });

    if (level === 'low') {
      highRiskPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          level = 'high';
          evidence.push(`Shares data with ${pattern}`);
        }
      });
    }

    if (level === 'low') {
      mediumRiskPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          level = 'medium';
          evidence.push(`Data shared for ${pattern}`);
        }
      });
    }

    return {
      name: 'Data Sharing',
      level,
      description: 'How your data is shared with others',
      evidence,
      impact: {
        low: 'Minimal data sharing',
        medium: 'Limited sharing for service delivery',
        high: 'Extensive data sharing with third parties',
        critical: 'Data may be sold for profit'
      }[level]
    };
  }

  private analyzeUserRights(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'high'; // Default to high, improve if rights found
    const evidence: string[] = [];
    
    const goodRightsPatterns = [
      'right to delete', 'data portability', 'opt out', 'unsubscribe',
      'access your data', 'correct inaccurate', 'withdraw consent'
    ];
    
    const limitedRightsPatterns = [
      'contact us to', 'upon request', 'reasonable efforts'
    ];

    let rightsCount = 0;
    goodRightsPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        rightsCount++;
        evidence.push(`Provides ${pattern}`);
      }
    });

    limitedRightsPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        evidence.push(`Limited: ${pattern}`);
      }
    });

    if (rightsCount >= 3) {
      level = 'low'; // Good user rights
    } else if (rightsCount >= 1) {
      level = 'medium';
    }

    return {
      name: 'User Rights',
      level,
      description: 'Your rights regarding your personal data',
      evidence,
      impact: {
        low: 'Strong user rights and control',
        medium: 'Some user rights provided',
        high: 'Limited user rights and control',
        critical: 'No user rights provided'
      }[level]
    };
  }

  private analyzeTermination(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];
    
    const highRiskPatterns = [
      'terminate without notice', 'suspend immediately', 'at our sole discretion',
      'for any reason', 'no refund'
    ];
    
    const mediumRiskPatterns = [
      'terminate for cause', 'reasonable notice', 'violation of terms'
    ];

    highRiskPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        level = 'high';
        evidence.push(`Can ${pattern}`);
      }
    });

    if (level === 'low') {
      mediumRiskPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          level = 'medium';
          evidence.push(`May ${pattern}`);
        }
      });
    }

    return {
      name: 'Account Termination',
      level,
      description: 'How your account can be terminated',
      evidence,
      impact: {
        low: 'Fair termination process',
        medium: 'Termination with reasonable cause',
        high: 'Account can be terminated without notice',
        critical: 'Immediate termination without recourse'
      }[level]
    };
  }

  private analyzeLiability(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];
    
    const highRiskPatterns = [
      'no liability', 'disclaim all warranties', 'use at your own risk',
      'exclude damages', 'limitation of liability', 'as is basis'
    ];

    highRiskPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        level = 'high';
        evidence.push(`Contains ${pattern} clause`);
      }
    });

    return {
      name: 'Liability & Warranties',
      level,
      description: 'Service liability and warranty terms',
      evidence,
      impact: {
        low: 'Standard liability terms',
        medium: 'Some limitations on liability',
        high: 'Limited recourse if service fails',
        critical: 'No recourse if service fails'
      }[level]
    };
  }

  private analyzeChangesToTerms(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];
    
    const highRiskPatterns = [
      'change without notice', 'modify at any time', 'sole discretion to change'
    ];
    
    const mediumRiskPatterns = [
      'reasonable notice', 'notify of changes', 'email notification'
    ];

    highRiskPatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        level = 'high';
        evidence.push(`Can ${pattern}`);
      }
    });

    if (level === 'low') {
      mediumRiskPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          level = 'medium';
          evidence.push(`Will provide ${pattern}`);
        }
      });
    }

    return {
      name: 'Changes to Terms',
      level,
      description: 'How terms can be modified',
      evidence,
      impact: {
        low: 'Stable terms',
        medium: 'Changes with notification',
        high: 'Terms can change without notice',
        critical: 'Terms can change retroactively without notice'
      }[level]
    };
  }

  private analyzeDisputeResolution(content: string) {
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const evidence: string[] = [];

    const criticalPatterns = [
      'binding arbitration',
      'class action waiver',
      'waive.*?jury trial',
      'arbitration.*?sole discretion'
    ];

    const highPatterns = [
      'arbitration',
      'venue.*?california',
      'governing law',
      'limitation period'
    ];

    criticalPatterns.forEach(p => {
      const regex = new RegExp(p, 'i');
      if (regex.test(content)) {
        level = 'critical';
        evidence.push(`Contains ${p}`);
      }
    });

    if (level === 'low') {
      highPatterns.forEach(p => {
        const regex = new RegExp(p, 'i');
        if (regex.test(content)) {
          level = 'high';
          evidence.push(`Contains ${p}`);
        }
      });
    }

    return {
      name: 'Dispute Resolution',
      level,
      description: 'Arbitration and legal venue clauses',
      evidence,
      impact: {
        low: 'Standard court venue terms',
        medium: 'Some arbitration provisions',
        high: 'Mandatory arbitration limits legal options',
        critical: 'Arbitration + class-action waiver severely restricts rights'
      }[level]
    };
  }

  private calculateOverallRisk(riskLevels: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (riskLevels.includes('critical')) return 'critical';
    if (riskLevels.filter(r => r === 'high').length >= 2) return 'high';
    if (riskLevels.includes('high')) return 'high';
    if (riskLevels.filter(r => r === 'medium').length >= 3) return 'high';
    if (riskLevels.includes('medium')) return 'medium';
    return 'low';
  }

  private generateSummary(categories: any[], overallRisk: string): string {
    const highRiskCategories = categories.filter(cat => cat.level === 'high' || cat.level === 'critical');
    
    if (overallRisk === 'critical') {
      return 'Critical privacy concerns identified. This service may sell your personal data or has extremely restrictive terms.';
    } else if (overallRisk === 'high') {
      return `High risk terms detected. Major concerns: ${highRiskCategories.map(cat => cat.name).join(', ')}. Review carefully before accepting.`;
    } else if (overallRisk === 'medium') {
      return 'Moderate privacy and terms concerns. Some data collection and sharing occurs, but with reasonable protections.';
    } else {
      return 'Generally acceptable terms with standard privacy practices and user protections.';
    }
  }

  private extractKeyPoints(categories: any[]): string[] {
    const points: string[] = [];
    
    categories.forEach(category => {
      if (category.level === 'high' || category.level === 'critical') {
        points.push(`⚠️ ${category.name}: ${category.impact}`);
      } else if (category.level === 'medium') {
        points.push(`ⓘ ${category.name}: ${category.impact}`);
      }
    });

    return points.slice(0, 5); // Top 5 key points
  }

  private generateRecommendations(categories: any[]): string[] {
    const recommendations: string[] = [];
    
    const dataCollection = categories.find(cat => cat.name === 'Data Collection');
    const dataSharing = categories.find(cat => cat.name === 'Data Sharing');
    const userRights = categories.find(cat => cat.name === 'User Rights');

    if (dataSharing?.level === 'critical') {
      recommendations.push('Consider avoiding this service if privacy is important to you');
    } else if (dataSharing?.level === 'high') {
      recommendations.push('Review privacy settings to limit data sharing where possible');
    }

    if (dataCollection?.level === 'high') {
      recommendations.push('Provide only necessary information during signup');
    }

    if (userRights?.level === 'high') {
      recommendations.push('Consider exercising your data rights if available');
    }

    if (recommendations.length === 0) {
      recommendations.push('Terms appear reasonable, but always review privacy settings');
    }

    return recommendations;
  }

  /**
   * Generate AI-powered summary using text generation model
   */
  private async generateAISummary(categories: any[], overallRisk: string): Promise<string> {
    if (!this.textGenerator) {
      // Fallback to rule-based summary if model not loaded
      return this.generateSummary(categories, overallRisk);
    }

    try {
      // Create a concise input for the AI model
      const riskInfo = categories
        .filter(cat => cat.level === 'high' || cat.level === 'critical')
        .map(cat => `${cat.name}: ${cat.level}`)
        .join(', ');

      const prompt = `Terms of Service Analysis Summary (Risk: ${overallRisk}). Key concerns: ${riskInfo}. Summary:`;
      
      const result = await this.textGenerator(prompt, {
        max_new_tokens: 50,
        temperature: 0.3,
        do_sample: true
      });

      // Extract generated text and clean it up
      const summary = result[0]?.generated_text?.replace(prompt, '').trim();
      
      // Fallback if AI generation fails
      if (!summary || summary.length < 10) {
        return this.generateSummary(categories, overallRisk);
      }

      return summary;
    } catch (error) {
      console.warn('AI summary generation failed, using fallback:', error);
      return this.generateSummary(categories, overallRisk);
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateAIRecommendations(categories: any[]): Promise<string[]> {
    if (!this.textGenerator) {
      // Fallback to rule-based recommendations
      return this.generateRecommendations(categories);
    }

    try {
      const highRiskCategories = categories.filter(cat => cat.level === 'high' || cat.level === 'critical');
      
      if (highRiskCategories.length === 0) {
        return ['Terms appear reasonable, but always review privacy settings'];
      }

      const risks = highRiskCategories.map(cat => cat.name).join(', ');
      const prompt = `Privacy recommendations for high-risk terms (${risks}):`;
      
      const result = await this.textGenerator(prompt, {
        max_new_tokens: 60,
        temperature: 0.3,
        do_sample: true
      });

      const recommendation = result[0]?.generated_text?.replace(prompt, '').trim();
      
      if (!recommendation || recommendation.length < 10) {
        return this.generateRecommendations(categories);
      }

      // Split into individual recommendations if possible
      const recommendations = recommendation.split('.').filter((r: string) => r.trim().length > 5).slice(0, 3);
      
      return recommendations.length > 0 ? recommendations : this.generateRecommendations(categories);
    } catch (error) {
      console.warn('AI recommendations generation failed, using fallback:', error);
      return this.generateRecommendations(categories);
    }
  }
}

// Initialize only when running inside a Dedicated Worker (self has postMessage and no chrome.runtime)
try {
  // Detect if we're in a dedicated worker context by checking for 'postMessage' and absence of 'chrome'
  if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && !(self as any).chrome) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    new TOSAnalyzerCore();
  }
} catch {
  /* no-op */
} 