/**
 * Anthropic Claude AI Service Implementation
 * 
 * Supports native PDF processing via base64 encoded documents.
 * Uses the Messages API with document content blocks.
 */

import type { 
  AIService, 
  AIServiceInfo, 
  AIExtractionRequest,
  AITextAnalysisRequest,
  AIExtractionResponse,
  APIKeyStorageType 
} from './types';
import { STORAGE_KEYS } from './types';

const SERVICE_ID = 'claude';

export const CLAUDE_SERVICE_INFO: AIServiceInfo = {
  id: 'claude',
  name: 'Anthropic Claude',
  description: 'Anthropic\'s Claude with native PDF support',
  models: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced model', supportsPDF: true },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and intelligent', supportsPDF: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest model', supportsPDF: true },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable', supportsPDF: true },
  ],
  defaultModel: 'claude-sonnet-4-20250514',
  apiKeyPlaceholder: 'sk-ant-...',
  apiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
  supportsPDF: true,
};

class ClaudeService implements AIService {
  readonly info = CLAUDE_SERVICE_INFO;
  
  private getStorageType(): APIKeyStorageType {
    if (typeof window === 'undefined') return 'localStorage';
    try {
      const config = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (config) {
        try {
          const parsed = JSON.parse(config);
          return parsed.apiKeyStorageType || 'localStorage';
        } catch {
          return 'localStorage';
        }
      }
    } catch (error) {
      console.warn('Failed to read storage type from localStorage:', error);
    }
    return 'localStorage';
  }
  
  private getStorage(): Storage {
    const storageType = this.getStorageType();
    return storageType === 'localStorage' ? localStorage : sessionStorage;
  }
  
  getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const storageType = this.getStorageType();
      const storage = this.getStorage();
      const keyName = `${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`;
      const key = storage.getItem(keyName);
      
      console.log(`[Claude] getApiKey: storageType=${storageType}, keyName=${keyName}, found=${!!key}`);
      
      return key?.trim() || null;
    } catch (error) {
      console.warn('Failed to read API key from storage:', error);
      return null;
    }
  }
  
  saveApiKey(key: string, storageType: APIKeyStorageType): void {
    if (typeof window === 'undefined') return;
    
    try {
      const keyName = `${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`;
      
      // Clear from both storages first (ignore errors)
      try {
        sessionStorage.removeItem(keyName);
      } catch (error) {
        // Ignore
      }
      try {
        localStorage.removeItem(keyName);
      } catch (error) {
        // Ignore
      }
      
      // Save to the selected storage
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
      storage.setItem(keyName, key.trim());
      
      console.log(`[Claude] saveApiKey: storageType=${storageType}, keyName=${keyName}, saved=${key.trim().substring(0, 10)}...`);
      
      // Verify it was saved
      const verification = storage.getItem(keyName);
      console.log(`[Claude] saveApiKey verification: found=${!!verification}`);
    } catch (error) {
      console.warn('Failed to save API key to storage:', error);
    }
  }
  
  removeApiKey(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    } catch (error) {
      // Ignore
    }
    try {
      localStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    } catch (error) {
      // Ignore
    }
  }
  
  hasApiKey(): boolean {
    try {
      return !!this.getApiKey();
    } catch (error) {
      console.warn('Failed to check for API key:', error);
      return false;
    }
  }
  
  getModel(): string {
    if (typeof window === 'undefined') return this.info.defaultModel;
    try {
      const model = localStorage.getItem(`${STORAGE_KEYS.MODEL_PREFIX}${SERVICE_ID}`);
      return model || this.info.defaultModel;
    } catch (error) {
      console.warn('Failed to read model from localStorage:', error);
      return this.info.defaultModel;
    }
  }
  
  saveModel(model: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_KEYS.MODEL_PREFIX}${SERVICE_ID}`, model);
    } catch (error) {
      console.warn('Failed to save model to localStorage:', error);
    }
  }
  
  getApiUrl(): string | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    return 'https://api.anthropic.com/v1/messages';
  }
  
  async extractFromPDF(request: AIExtractionRequest): Promise<AIExtractionResponse> {
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();
    
    if (!apiKey || !apiUrl) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true', // Required for browser requests
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: request.mimeType || 'application/pdf',
                  data: request.pdfBase64
                }
              },
              {
                type: 'text',
                text: request.prompt
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Claude API error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage += `.\n\n${errorJson.error.message}`;
          }
        } catch {
          if (errorText.length > 1000) {
            errorMessage += `.\n\n${errorText.substring(0, 1000)}... [truncated]`;
          } else {
            errorMessage += `.\n\n${errorText}`;
          }
        }
        return { success: false, error: errorMessage };
      }
      
      const data = await response.json();
      
      // Extract response text from Claude's format
      let responseText = '';
      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            responseText += block.text;
          }
        }
      }
      
      if (!responseText) {
        return { success: false, error: 'No response text from API', rawResponse: data };
      }
      
      return { success: true, text: responseText.trim(), rawResponse: data };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
  
  async analyzeText(request: AITextAnalysisRequest): Promise<AIExtractionResponse> {
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();
    
    if (!apiKey || !apiUrl) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true', // Required for browser requests
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.prompt
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Claude API error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage += `.\n\n${errorJson.error.message}`;
          }
        } catch {
          if (errorText.length > 1000) {
            errorMessage += `.\n\n${errorText.substring(0, 1000)}... [truncated]`;
          } else {
            errorMessage += `.\n\n${errorText}`;
          }
        }
        return { success: false, error: errorMessage };
      }
      
      const data = await response.json();
      
      // Extract response text from Claude's format
      let responseText = '';
      if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === 'text') {
            responseText += block.text;
          }
        }
      }
      
      if (!responseText) {
        return { success: false, error: 'No response text from API', rawResponse: data };
      }
      
      return { success: true, text: responseText.trim(), rawResponse: data };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const claudeService = new ClaudeService();
