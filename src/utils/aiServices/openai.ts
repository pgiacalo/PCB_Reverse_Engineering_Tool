/**
 * OpenAI ChatGPT AI Service Implementation
 * 
 * Supports PDF processing via the Chat Completions API with file attachments.
 * GPT-4o and newer models support document understanding.
 */

import type { 
  AIService, 
  AIServiceInfo, 
  AIExtractionRequest, 
  AIExtractionResponse,
  APIKeyStorageType 
} from './types';
import { STORAGE_KEYS } from './types';

const SERVICE_ID = 'openai';

// NOTE: This service is currently disabled (not imported in index.ts)
// The type assertion below bypasses the AIServiceProvider check since 'openai' was removed
export const OPENAI_SERVICE_INFO: AIServiceInfo = {
  id: 'openai' as any, // Type assertion - re-add 'openai' to AIServiceProvider when enabling
  name: 'OpenAI ChatGPT',
  description: 'OpenAI\'s GPT models with PDF support',
  models: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model', supportsPDF: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', supportsPDF: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation', supportsPDF: true },
  ],
  defaultModel: 'gpt-4o',
  apiKeyPlaceholder: 'sk-...',
  apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
  supportsPDF: true,
};

class OpenAIService implements AIService {
  readonly info = OPENAI_SERVICE_INFO;
  
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
    return 'https://api.openai.com/v1/chat/completions';
  }
  
  async extractFromPDF(request: AIExtractionRequest): Promise<AIExtractionResponse> {
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();
    
    if (!apiKey || !apiUrl) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      // OpenAI uses a different format for file attachments
      // For PDFs, we use the file content type with base64 data URL
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'datasheet.pdf',
                  file_data: `data:${request.mimeType || 'application/pdf'};base64,${request.pdfBase64}`
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
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
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
      
      // Extract response text from OpenAI's format
      let responseText = '';
      if (data.choices?.[0]?.message?.content) {
        responseText = data.choices[0].message.content;
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

  async analyzeText(request: import('./types').AITextAnalysisRequest): Promise<AIExtractionResponse> {
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
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: request.prompt
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
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
      
      // Extract response text from OpenAI's format
      let responseText = '';
      if (data.choices?.[0]?.message?.content) {
        responseText = data.choices[0].message.content;
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

export const openaiService = new OpenAIService();
