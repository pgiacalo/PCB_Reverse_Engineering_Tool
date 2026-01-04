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
  /**
   * The actual ComponentType used in the code (e.g., "Transistor", "IntegratedCircuit", "Resistor").
   * This is the data-driven source of truth for componentType, eliminating the need for hardcoded mapping logic.
   * For semiconductors: "Transistor" for BJT/MOSFET/JFET, "IntegratedCircuit" for Op Amps and other ICs.
   * For other components: typically matches the `type` field (e.g., "Resistor", "Capacitor").
   */
  componentType: string;
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
  /**
   * Whether the Component Properties dialog should include the AI section for datasheet lookups.
   * Defaults to false. Set to true for components that support AI datasheet extraction.
   */
  enableAI?: boolean;
  /**
   * Unique name of the AI prompt to use for this component (e.g., "bjt_npn", "single_op_amp").
   * This references a prompt in src/data/aiPrompts.json.
   * This is the preferred method for specifying prompts - it keeps prompts centralized and maintainable.
   */
  aiPromptName?: string;
  /**
   * Custom AI prompt for datasheet extraction (inline string).
   * This is for backward compatibility and component-specific overrides.
   * If both aiPromptName and aiPrompt are provided, aiPromptName takes precedence.
   * If neither is provided, a default prompt will be used.
   */
  aiPrompt?: string;
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


