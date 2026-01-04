import rawComponentData from '../../data/componentDefinitions.json';
import type {
  DataDrivenComponentDefinition,
  BaseComponentKind,
  RawComponentDefinition,
} from './schema';

/**
 * Compute the baseType for a given raw definition.
 * Prefers explicit baseType in JSON; falls back to category-based inference.
 */
function computeBaseType(def: RawComponentDefinition): BaseComponentKind {
  if (def.baseType) {
    return def.baseType;
  }
  switch (def.category) {
    case 'Capacitors':
      return 'Capacitor';
    case 'Diodes':
      return 'Diode';
    case 'Resistors':
      return 'Resistor';
    case 'Semiconductors':
      return 'Semiconductor';
    case 'Passive Components':
      return 'Passive';
    case 'Power & Energy':
      return 'PowerEnergy';
    case 'Connectors & Switches':
      // We split connectors and switches later if needed; for now treat both as Connector/Switch.
      if (def.type === 'Switch' || def.subcategory === 'Switch') {
        return 'Switch';
      }
      return 'Connector';
    case 'Other':
      if (def.type === 'Transformer') return 'Transformer';
      return 'Other';
    default:
      return 'Other';
  }
}

/**
 * Normalize raw componentDefinitions.json entries into DataDrivenComponentDefinition objects.
 */
// The JSON file has the shape: { "components": [ ... ] }
const rawDefinitions = (rawComponentData as any).components as RawComponentDefinition[];

export const ALL_DEFINITIONS: DataDrivenComponentDefinition[] = rawDefinitions.map((def) => {
  const key = `${def.category}:${def.subcategory}`;
  const baseType = computeBaseType(def);
  return {
    ...def,
    key,
    baseType,
  };
});

/**
 * Index by key (category:subcategory).
 */
const byKey = new Map<string, DataDrivenComponentDefinition>();
ALL_DEFINITIONS.forEach((def) => {
  byKey.set(def.key, def);
});

/**
 * Lookup helpers
 */
export function getDefinitionByKey(key: string | undefined): DataDrivenComponentDefinition | undefined {
  if (!key) return undefined;
  return byKey.get(key);
}

export function getDefinitionsByBaseType(baseType: BaseComponentKind): DataDrivenComponentDefinition[] {
  return ALL_DEFINITIONS.filter((d) => d.baseType === baseType);
}

export function getAllDefinitions(): DataDrivenComponentDefinition[] {
  return ALL_DEFINITIONS;
}


