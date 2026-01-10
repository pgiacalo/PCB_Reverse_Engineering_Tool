/**
 * AI-powered net name inference
 * Analyzes netlist to suggest descriptive names for generic signal nets (N$1, N$2, etc.)
 */

import { getCurrentService } from './aiServices';

export interface NetNameSuggestion {
  original_name: string;
  suggested_name: string;
  confidence: number;
  reasoning: string;
}

export interface NetNameInferenceResult {
  suggestions: NetNameSuggestion[];
}

/**
 * Extract the AI prompt for net name inference
 */
async function getNetNameInferencePrompt(): Promise<string> {
  try {
    const prompts = await import('../data/aiPrompts.json');
    return prompts.default?.prompts?.net_name_inference || prompts.prompts?.net_name_inference || '';
  } catch (error) {
    console.error('[NetNameInference] Failed to load AI prompt:', error);
    return '';
  }
}

/**
 * Analyze netlist and suggest descriptive names for generic signal nets
 * @param netlistJson The complete netlist JSON string
 * @param confidenceThreshold Minimum confidence score to include (default: 0.6)
 * @returns Promise with net name suggestions
 */
export async function analyzeNetNames(
  netlistJson: string,
  confidenceThreshold: number = 0.6
): Promise<NetNameInferenceResult> {
  try {
    console.log('[NetNameInference] Starting AI analysis for net names...');
    
    // Get the prompt template
    const promptTemplate = await getNetNameInferencePrompt();
    if (!promptTemplate) {
      throw new Error('Net name inference prompt not found');
    }
    
    // Replace placeholder with actual netlist
    const prompt = promptTemplate.replace('{netlist_json}', netlistJson);
    
    // Get the current AI service and call analyzeText
    const aiService = getCurrentService();
    const aiResponse = await aiService.analyzeText({
      prompt,
      systemPrompt: 'You are an expert electronics engineer. Return ONLY valid JSON with no additional text or markdown formatting.',
      temperature: 0.3, // Lower temperature for more consistent, focused analysis
      maxTokens: 4000
    });
    
    // Check if AI call was successful
    if (!aiResponse.success || !aiResponse.text) {
      throw new Error(aiResponse.error || 'AI service returned no response');
    }
    
    console.log('[NetNameInference] AI response received');
    
    // Parse the AI response text
    let result: NetNameInferenceResult;
    try {
      // Try to parse as JSON directly
      result = JSON.parse(aiResponse.text);
    } catch (parseError) {
      // If direct parse fails, try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }
    
    // Validate the result structure
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error('Invalid AI response structure: missing suggestions array');
    }
    
    // Filter by confidence threshold
    const filteredSuggestions = result.suggestions.filter(
      (suggestion) => suggestion.confidence >= confidenceThreshold
    );
    
    console.log(
      `[NetNameInference] Found ${filteredSuggestions.length} suggestions above confidence threshold ${confidenceThreshold}`
    );
    
    return {
      suggestions: filteredSuggestions
    };
  } catch (error) {
    console.error('[NetNameInference] Error analyzing net names:', error);
    throw error;
  }
}

/**
 * Apply net name suggestions to a netlist JSON string
 * @param netlistJson The original netlist JSON string
 * @param suggestions Array of net name suggestions to apply
 * @returns Updated netlist JSON string with renamed nets
 */
export function applyNetNameSuggestions(
  netlistJson: string,
  suggestions: NetNameSuggestion[]
): string {
  try {
    const netlist = JSON.parse(netlistJson);
    
    if (!netlist.nets || !Array.isArray(netlist.nets)) {
      console.warn('[NetNameInference] Netlist has no nets array');
      return netlistJson;
    }
    
    // Create a map of original name → suggested name
    const nameMap = new Map<string, string>();
    for (const suggestion of suggestions) {
      nameMap.set(suggestion.original_name, suggestion.suggested_name);
    }
    
    // Apply name changes to nets
    let changedCount = 0;
    for (const net of netlist.nets) {
      if (nameMap.has(net.name)) {
        const newName = nameMap.get(net.name)!;
        console.log(`[NetNameInference] Renaming net "${net.name}" → "${newName}"`);
        net.name = newName;
        changedCount++;
      }
    }
    
    // Also update component pin node_id references if they match old net names
    if (netlist.components && Array.isArray(netlist.components)) {
      for (const component of netlist.components) {
        if (component.pins && Array.isArray(component.pins)) {
          for (const pin of component.pins) {
            if (pin.node_id) {
              // Extract net name from semantic node ID (e.g., "node_n_1_5" → "N$1")
              // This is a simplified approach; actual implementation may need more sophisticated parsing
              for (const [oldName, newName] of nameMap.entries()) {
                // If the node_id contains a reference to the old net name, we may need to update it
                // For now, we'll leave node_ids as-is since they use semantic IDs
                // The net name change is sufficient for readability
              }
            }
          }
        }
      }
    }
    
    console.log(`[NetNameInference] Applied ${changedCount} net name changes`);
    
    // Return updated netlist as JSON string
    return JSON.stringify(netlist, null, 2);
  } catch (error) {
    console.error('[NetNameInference] Error applying net name suggestions:', error);
    throw error;
  }
}

/**
 * Validate a suggested net name against naming conventions
 * @param name The suggested name to validate
 * @returns true if valid, false otherwise
 */
export function validateNetName(name: string): boolean {
  // Check for empty or whitespace-only names
  if (!name || !name.trim()) {
    return false;
  }
  
  // Check for valid characters (alphanumeric, underscore, brackets, +, -)
  const validPattern = /^[A-Z0-9_+\-\[\]]+$/;
  if (!validPattern.test(name)) {
    return false;
  }
  
  // Check for reserved names (power/ground nets)
  const reservedNames = ['GND', 'VCC', 'VDD', 'VSS', 'VEE', 'VBAT'];
  if (reservedNames.includes(name)) {
    return false;
  }
  
  // Check for generic names (N$X pattern)
  if (/^N\$\d+$/.test(name)) {
    return false;
  }
  
  return true;
}
