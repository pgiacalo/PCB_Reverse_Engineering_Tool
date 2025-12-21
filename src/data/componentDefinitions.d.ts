/**
 * Type definitions for componentDefinitions.json
 */

export interface ComponentFieldDefinition {
  name: string;
  label: string;
  type: 'number' | 'string' | 'enum';
  units?: string[];
  defaultUnit?: string;
  defaultValue?: string | number;
  required?: boolean;
  enumValues?: string[];  // For enum types
}

export interface ComponentDefinition {
  category: string;
  subcategory: string;
  type: string;
  displayName: string;
  description: string;
  searchText: string;
  /**
   * Primary PCB designator prefix for this component (e.g., "R", "RN", "CE").
   * There is exactly one designator per (category, subcategory) combination.
   */
  designator: string;
  /**
   * Legacy field preserved for backward compatibility with older project files.
   * New code should treat `designator` as the single source of truth and ignore this.
   */
  designators?: string[];
  defaultPins: number;
  /**
   * Whether the component has a fixed pin count that cannot be changed.
   * Defaults to true. Set to false for components like Integrated Circuits that can have variable pin counts.
   */
  fixedPinCount?: boolean;
  subtype?: string;
  properties?: Record<string, any>;  // Variant properties (e.g., capacitorType, diodeType)
  fields?: ComponentFieldDefinition[];  // Field definitions for this component
}

export interface ComponentCategory {
  subcategories: string[];
}

export interface ComponentDefinitions {
  components: ComponentDefinition[];
  categories: Record<string, ComponentCategory>;
}

declare const componentDefinitions: ComponentDefinitions;
export default componentDefinitions;


