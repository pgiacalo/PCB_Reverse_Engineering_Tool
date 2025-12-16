import type { PCBComponent } from '../../types';
import type { DataDrivenComponentDefinition, BaseComponentKind } from '../definitions/schema';
import { COMPONENT_TYPE_INFO } from '../../constants';

export interface DesignatorCounters {
  [prefix: string]: number;
}

/**
 * Map baseType/definition to a designator prefix.
 * This is intentionally simple and can evolve independently of the v1 mapping.
 */
export function getBasePrefix(def: DataDrivenComponentDefinition): string {
  // Prefer designators from JSON if present
  if (def.designators && def.designators.length > 0) {
    return def.designators[0];
  }

  // Fallback by baseType
  switch (def.baseType as BaseComponentKind) {
    case 'Capacitor':
      return 'C';
    case 'Diode':
      return 'D';
    case 'Resistor':
      return 'R';
    case 'Semiconductor':
      return 'Q';
    case 'Passive':
      return 'L';
    case 'PowerEnergy':
      return 'PS';
    case 'Connector':
      return 'J';
    case 'Switch':
      return 'S';
    case 'Transformer':
      return 'T';
    case 'Other':
    default:
      return '?';
  }
}

/**
 * Determine the next designator number given existing components and counters.
 */
export function getNextDesignatorNumber(
  prefix: string,
  existingComponents: PCBComponent[],
  counters: DesignatorCounters
): number {
  let maxExisting = 0;
  for (const comp of existingComponents) {
    if (!comp.designator) continue;
    if (!comp.designator.startsWith(prefix)) continue;
    const num = parseInt(comp.designator.slice(prefix.length), 10);
    if (!isNaN(num) && num > maxExisting) {
      maxExisting = num;
    }
  }

  const current = counters[prefix] ?? maxExisting;
  const next = current + 1;
  counters[prefix] = next;
  return next;
}

/**
 * Assign a designator string for a new instance of the given definition.
 */
export function assignDesignator(
  def: DataDrivenComponentDefinition,
  existingComponents: PCBComponent[],
  counters: DesignatorCounters
): string {
  // Use getBasePrefix which already prioritizes def.designators[0] from JSON
  // This ensures we get specific designators like CE, CF, LED, Z instead of generic C, D
  const prefix = getBasePrefix(def);

  const nextNumber = getNextDesignatorNumber(prefix, existingComponents, counters);
  return `${prefix}${nextNumber}`;
}


