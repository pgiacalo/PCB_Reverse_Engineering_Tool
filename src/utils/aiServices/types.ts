/**
 * AI Services Types and Interfaces
 * 
 * This module defines the common types used across all AI service implementations.
 * Each AI service (Gemini, Claude) implements these interfaces.
 */

// Supported AI service providers
// Note: OpenAI/ChatGPT removed - no native PDF support in Chat Completions API
export type AIServiceProvider = 'gemini' | 'claude';

// Storage options for API keys
export type APIKeyStorageType = 'sessionStorage' | 'localStorage';

// Service configuration stored in localStorage
export interface AIServiceConfig {
  provider: AIServiceProvider;
  model: string;
  apiKeyStorageType: APIKeyStorageType;
}

// Model definition for each service
export interface AIModel {
  id: string;
  name: string;
  description?: string;
  supportsPDF: boolean;
  maxTokens?: number;
}

// Service metadata
export interface AIServiceInfo {
  id: AIServiceProvider;
  name: string;
  description: string;
  models: AIModel[];
  defaultModel: string;
  apiKeyPlaceholder: string;
  apiKeyHelpUrl: string;
  supportsPDF: boolean;
}

// Request for extracting data from a PDF
export interface AIExtractionRequest {
  prompt: string;
  pdfBase64: string;
  mimeType?: string;
}

// Request for text-only analysis (no PDF)
export interface AITextAnalysisRequest {
  prompt: string;
}

// Response from AI extraction
export interface AIExtractionResponse {
  success: boolean;
  text?: string;
  error?: string;
  rawResponse?: any;
}

// AI Service interface that all providers must implement
export interface AIService {
  readonly info: AIServiceInfo;
  
  // Get API key from storage
  getApiKey(): string | null;
  
  // Save API key to storage
  saveApiKey(key: string, storageType: APIKeyStorageType): void;
  
  // Remove API key from storage
  removeApiKey(): void;
  
  // Check if API key is configured
  hasApiKey(): boolean;
  
  // Get current model
  getModel(): string;
  
  // Save model preference
  saveModel(model: string): void;
  
  // Build API URL for the service
  getApiUrl(): string | null;
  
  // Extract data from PDF using AI
  extractFromPDF(request: AIExtractionRequest): Promise<AIExtractionResponse>;
  
  // Analyze text using AI (no PDF attachment)
  analyzeText(request: AITextAnalysisRequest): Promise<AIExtractionResponse>;
}

// Storage keys
export const STORAGE_KEYS = {
  CONFIG: 'aiServiceConfig',
  API_KEY_PREFIX: 'aiApiKey_',
  MODEL_PREFIX: 'aiModel_',
} as const;

// Default configuration
export const DEFAULT_CONFIG: AIServiceConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  apiKeyStorageType: 'sessionStorage',
};
