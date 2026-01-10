/**
 * Google Gemini AI Service Implementation
 * 
 * Supports native PDF processing via inline base64 data.
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

const SERVICE_ID = 'gemini';

export const GEMINI_SERVICE_INFO: AIServiceInfo = {
  id: 'gemini',
  name: 'Google Gemini',
  description: 'Google\'s multimodal AI with native PDF support',
  models: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient', supportsPDF: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Previous generation flash', supportsPDF: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'More capable, slower', supportsPDF: true },
  ],
  defaultModel: 'gemini-2.0-flash',
  apiKeyPlaceholder: 'AIza...',
  apiKeyHelpUrl: 'https://aistudio.google.com/apikey',
  supportsPDF: true,
};

class GeminiService implements AIService {
  readonly info = GEMINI_SERVICE_INFO;
  
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
      const storage = this.getStorage();
      const keyName = `${STORAGE_KEYS.API_KEY_PREFIX}${SERVICE_ID}`;
      const key = storage.getItem(keyName);
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
    const model = this.getModel();
    return `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
  }
  
  async extractFromPDF(request: AIExtractionRequest): Promise<AIExtractionResponse> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: request.prompt },
              {
                inlineData: {
                  mimeType: request.mimeType || 'application/pdf',
                  data: request.pdfBase64
                }
              }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            let cleanMessage = errorJson.error.message;
            if (cleanMessage.length > 500) {
              cleanMessage = cleanMessage.replace(/"([A-Za-z0-9+/]{100,})"/g, 
                (_match: string, base64: string) => `"[Base64 data truncated - ${base64.length} characters]"`);
            }
            errorMessage += `.\n\n${cleanMessage}`;
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
      
      // Extract response text
      let responseText = '';
      if (data.candidates?.[0]) {
        if (data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
          return { success: false, error: `Response blocked: ${data.candidates[0].finishReason}` };
        }
        
        const parts = data.candidates[0].content?.parts;
        if (parts?.[0]?.text) {
          responseText = parts[0].text.trim();
        }
      }
      
      if (!responseText) {
        return { success: false, error: 'No response text from API', rawResponse: data };
      }
      
      return { success: true, text: responseText, rawResponse: data };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
  
  async analyzeText(request: AITextAnalysisRequest): Promise<AIExtractionResponse> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: request.prompt }
            ]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
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
      
      // Extract response text
      let responseText = '';
      if (data.candidates?.[0]) {
        if (data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
          return { success: false, error: `Response blocked: ${data.candidates[0].finishReason}` };
        }
        
        const parts = data.candidates[0].content?.parts;
        if (parts?.[0]?.text) {
          responseText = parts[0].text.trim();
        }
      }
      
      if (!responseText) {
        return { success: false, error: 'No response text from API', rawResponse: data };
      }
      
      return { success: true, text: responseText, rawResponse: data };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const geminiService = new GeminiService();
