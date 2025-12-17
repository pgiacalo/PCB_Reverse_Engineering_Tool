/**
 * Copyright (c) 2025 Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Component Designator to Component Type mapping
 * This file imports component definitions from an external JSON file that is bundled at build time.
 * The JSON file can be easily modified to update the list of components and their designators.
 * 
 * The JSON is bundled into the JavaScript bundle by Vite, making it available in memory at runtime
 * without requiring file system access permissions.
 */
import componentDefinitions from './componentDefinitions.json';
import type { ComponentDefinition } from './componentDefinitions.d';

// Export the full definitions (bundled at build time, available in memory at runtime)
export const COMPONENT_DEFINITIONS = componentDefinitions;

// Export individual components array for easy access
export const COMPONENT_LIST: ComponentDefinition[] = componentDefinitions.components as ComponentDefinition[];

// Export categories for UI organization
export const COMPONENT_CATEGORIES_STRUCTURE = componentDefinitions.categories;

// Simple mapping from a single designator prefix to a human-readable component description.
// There is exactly one designator per (category, subcategory) combination in the JSON.
export interface ComponentDesignatorEntry {
  designator: string;
  componentType: string;
}

// Build a flat list of designators for search and any legacy consumers
export const COMPONENT_DESIGNATORS: ComponentDesignatorEntry[] = COMPONENT_LIST.map(comp => ({
  designator: comp.designator,
  componentType: comp.description,
}));

// Helper function: Find component by designator
export function findComponentByDesignator(designator: string): ComponentDefinition | undefined {
  return COMPONENT_LIST.find(comp => 
    comp.designator === designator ||
    (Array.isArray(comp.designators) && comp.designators!.includes(designator))
  ) as ComponentDefinition | undefined;
}

// Helper function: Find components by category
export function findComponentsByCategory(category: string): ComponentDefinition[] {
  return COMPONENT_LIST.filter(comp => comp.category === category) as ComponentDefinition[];
}

// Helper function: Find components by type
export function findComponentsByType(type: string): ComponentDefinition[] {
  return COMPONENT_LIST.filter(comp => comp.type === type) as ComponentDefinition[];
}

// Helper function: Search components (searches searchText field)
export function searchComponents(searchTerm: string): ComponentDefinition[] {
  const searchLower = searchTerm.toLowerCase();
  return COMPONENT_LIST.filter(comp => 
    comp.searchText.toLowerCase().includes(searchLower) ||
    comp.displayName.toLowerCase().includes(searchLower) ||
    comp.description.toLowerCase().includes(searchLower) ||
    comp.category.toLowerCase().includes(searchLower) ||
    comp.subcategory.toLowerCase().includes(searchLower) ||
    comp.designator.toLowerCase().includes(searchLower) ||
    (Array.isArray(comp.designators) && comp.designators!.some((d: string) => d.toLowerCase().includes(searchLower)))
  ) as ComponentDefinition[];
}



