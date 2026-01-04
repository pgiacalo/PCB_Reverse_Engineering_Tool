import type {
  ComponentDefinition as LegacyComponentDefinition,
  ComponentFieldDefinition as LegacyFieldDefinition,
} from '../../data/componentDefinitions.d';

/**
 * High-level base categories we want for the new data-driven system.
 * These are independent of the existing ComponentType union.
 */
export type BaseComponentKind =
  | 'Capacitor'
  | 'Diode'
  | 'Resistor'
  | 'Semiconductor'
  | 'Passive'
  | 'PowerEnergy'
  | 'Connector'
  | 'Switch'
  | 'Transformer'
  | 'Other';

/**
 * Re-export field definition type so the new system has a single source of truth.
 */
export type ComponentFieldDefinition = LegacyFieldDefinition;

/**
 * Normalized component definition used by the data-driven system.
 *
 * - Wraps the legacy ComponentDefinition
 * - Adds a stable key and a computed baseType
 */
export interface DataDrivenComponentDefinition extends LegacyComponentDefinition {
  /**
   * Stable unique key for this definition (category:subcategory).
   */
  key: string;

  /**
   * High-level base kind used by the new system.
   */
  baseType: BaseComponentKind;
}

export interface RawComponentDefinition extends LegacyComponentDefinition {
  /**
   * Optional explicit baseType in JSON. If omitted, the loader will infer it.
   */
  baseType?: BaseComponentKind;
}



