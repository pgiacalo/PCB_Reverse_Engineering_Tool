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
    if (typeof window === 'undefined') return 'sessionStorage';
    const config = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (config) {
      try {
        const parsed = JSON.parse(config);
        return parsed.apiKeyStorageType || 'sessionStorage';
      } catch {
        return 'sessionStorage';
      }
    }
    return 'sessionStorage';
  }
  
  private getStorage(): Storage {
    const storageType = this.getStorageType();
    return storageType === 'localStorage' ? localStorage : sessionStorage;
  }
  
  getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    const storage = this.getStorage();
    const key = storage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    return key?.trim() || null;
  }
  
  saveApiKey(key: string, storageType: APIKeyStorageType): void {
    if (typeof window === 'undefined') return;
    
    // Clear from both storages first
    sessionStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    localStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    
    // Save to the selected storage
    const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
    storage.setItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`, key.trim());
  }
  
  removeApiKey(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
    localStorage.removeItem(`${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`);
  }
  
  hasApiKey(): boolean {
    return !!this.getApiKey();
  }
  
  getModel(): string {
    if (typeof window === 'undefined') return this.info.defaultModel;
    const model = localStorage.getItem(`${STORAGE_KEYS.MODEL_PREFIX}${SERVICE_ID}`);
    return model || this.info.defaultModel;
  }
  
  saveModel(model: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_KEYS.MODEL_PREFIX}${SERVICE_ID}`, model);
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
}

export const claudeService = new ClaudeService();
