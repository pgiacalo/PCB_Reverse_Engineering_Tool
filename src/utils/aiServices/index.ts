/**
 * AI Services Registry and Factory
 * 
 * Central hub for accessing AI service implementations.
 * Provides service selection, configuration management, and factory methods.
 */

import type { 
  AIService, 
  AIServiceProvider, 
  AIServiceConfig, 
  AIServiceInfo,
  APIKeyStorageType 
} from './types';
import { STORAGE_KEYS, DEFAULT_CONFIG } from './types';
import { geminiService, GEMINI_SERVICE_INFO } from './gemini';
import { claudeService, CLAUDE_SERVICE_INFO } from './claude';
// Note: OpenAI/ChatGPT removed - no native PDF support in Chat Completions API
// import { openaiService, OPENAI_SERVICE_INFO } from './openai';

// Export types
export type { 
  AIService, 
  AIServiceProvider, 
  AIServiceConfig, 
  AIServiceInfo,
  AIExtractionRequest,
  AITextAnalysisRequest,
  AIExtractionResponse,
  APIKeyStorageType,
  AIModel
} from './types';
export { STORAGE_KEYS, DEFAULT_CONFIG } from './types';

// Service registry
const services: Record<AIServiceProvider, AIService> = {
  gemini: geminiService,
  claude: claudeService,
};

// Service info registry (for UI display)
export const SERVICE_INFO: Record<AIServiceProvider, AIServiceInfo> = {
  gemini: GEMINI_SERVICE_INFO,
  claude: CLAUDE_SERVICE_INFO,
};

// List of all available providers (for UI dropdown)
export const AVAILABLE_PROVIDERS: AIServiceProvider[] = ['gemini', 'claude'];

/**
 * Get the current AI service configuration from localStorage
 */
export function getAIConfig(): AIServiceConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          provider: parsed.provider || DEFAULT_CONFIG.provider,
          model: parsed.model || DEFAULT_CONFIG.model,
          apiKeyStorageType: parsed.apiKeyStorageType || DEFAULT_CONFIG.apiKeyStorageType,
        };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
  } catch (error) {
    // localStorage may be blocked or corrupted - return defaults
    console.warn('Failed to read AI config from localStorage:', error);
    return DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

/**
 * Save AI service configuration to localStorage
 */
export function saveAIConfig(config: Partial<AIServiceConfig>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getAIConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
  } catch (error) {
    // localStorage may be blocked or corrupted - log warning but don't crash
    console.warn('Failed to save AI config to localStorage:', error);
  }
}

/**
 * Get the currently selected AI service
 */
export function getCurrentService(): AIService {
  const config = getAIConfig();
  return services[config.provider] || services.gemini;
}

/**
 * Get a specific AI service by provider ID
 */
export function getService(provider: AIServiceProvider): AIService {
  return services[provider];
}

/**
 * Get the currently selected provider
 */
export function getCurrentProvider(): AIServiceProvider {
  return getAIConfig().provider;
}

/**
 * Set the current AI service provider
 */
export function setCurrentProvider(provider: AIServiceProvider): void {
  const service = services[provider];
  if (service) {
    saveAIConfig({ 
      provider,
      model: service.getModel() // Use the service's current model
    });
  }
}

/**
 * Get the current API key storage type
 */
export function getApiKeyStorageType(): APIKeyStorageType {
  return getAIConfig().apiKeyStorageType;
}

/**
 * Set the API key storage type
 */
export function setApiKeyStorageType(storageType: APIKeyStorageType): void {
  saveAIConfig({ apiKeyStorageType: storageType });
}

/**
 * Check if any AI service has an API key configured
 */
export function hasAnyApiKey(): boolean {
  return AVAILABLE_PROVIDERS.some(provider => services[provider].hasApiKey());
}

/**
 * Get service info for all available providers
 */
export function getAllServiceInfo(): AIServiceInfo[] {
  return AVAILABLE_PROVIDERS.map(provider => SERVICE_INFO[provider]);
}

/**
 * Migration: Convert old Gemini-only storage to new multi-service format
 * Call this on app initialization to preserve existing API keys
 */
export function migrateFromLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Check for old-style Gemini API key
    let oldSessionKey: string | null = null;
    let oldLocalKey: string | null = null;
    let oldModel: string | null = null;
    
    try {
      oldSessionKey = sessionStorage.getItem('geminiApiKey');
    } catch (error) {
      console.warn('Failed to read from sessionStorage:', error);
    }
    
    try {
      oldLocalKey = localStorage.getItem('geminiApiKey');
      oldModel = localStorage.getItem('geminiModel');
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
    }
    
    // Check if we already have new-style storage
    let hasNewConfig = false;
    let hasNewGeminiKey = false;
    
    try {
      hasNewConfig = !!localStorage.getItem(STORAGE_KEYS.CONFIG);
    } catch (error) {
      console.warn('Failed to check for new config:', error);
    }
    
    try {
      hasNewGeminiKey = !!(sessionStorage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}gemini`) || 
                           localStorage.getItem(`${STORAGE_KEYS.API_KEY_PREFIX}gemini`));
    } catch (error) {
      console.warn('Failed to check for new Gemini key:', error);
    }
    
    // If we have old keys but no new config, migrate
    if ((oldSessionKey || oldLocalKey) && !hasNewConfig && !hasNewGeminiKey) {
      
      // Determine storage type based on where the old key was
      const storageType: APIKeyStorageType = oldSessionKey ? 'sessionStorage' : 'localStorage';
      const apiKey = oldSessionKey || oldLocalKey;
      
      // Save new config
      saveAIConfig({
        provider: 'gemini',
        model: oldModel || 'gemini-2.0-flash',
        apiKeyStorageType: storageType,
      });
      
      // Save API key in new format
      if (apiKey) {
        geminiService.saveApiKey(apiKey, storageType);
      }
      
      // Save model in new format
      if (oldModel) {
        geminiService.saveModel(oldModel);
      }
      
      // Clean up old keys (ignore errors)
      try {
        sessionStorage.removeItem('geminiApiKey');
      } catch (error) {
        // Ignore
      }
      try {
        localStorage.removeItem('geminiApiKey');
        localStorage.removeItem('geminiModel');
      } catch (error) {
        // Ignore
      }
      
      console.log('Migration complete.');
    }
  } catch (error) {
    // If migration fails, log but don't crash the app
    console.warn('Migration from legacy storage failed:', error);
  }
}
