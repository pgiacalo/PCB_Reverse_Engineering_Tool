/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

/**
 * AI Prompts Loader
 * 
 * Provides utilities to load and lookup AI prompts from the centralized prompts file.
 * This eliminates the need for hardcoded prompt functions and makes prompts fully data-driven.
 */

import aiPromptsData from '../data/aiPrompts.json';

/**
 * Get an AI prompt by its unique name
 * @param promptName The unique name of the prompt (e.g., "bjt_npn", "single_op_amp")
 * @returns The prompt text, or undefined if not found
 */
export function getAIPrompt(promptName: string): string | undefined {
  return aiPromptsData.prompts[promptName];
}

/**
 * Get all available AI prompts
 * @returns A record mapping prompt names to prompt text
 */
export function getAllAIPrompts(): Record<string, string> {
  return aiPromptsData.prompts;
}

/**
 * Check if a prompt exists
 * @param promptName The unique name of the prompt
 * @returns True if the prompt exists, false otherwise
 */
export function hasAIPrompt(promptName: string): boolean {
  return promptName in aiPromptsData.prompts;
}
