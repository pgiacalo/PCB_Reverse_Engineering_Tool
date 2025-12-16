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
  designators: string[];
  defaultPins: number;
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


