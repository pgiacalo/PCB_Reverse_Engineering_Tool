import { COMPONENT_LIST } from '../data/componentDesignators';
import type { ComponentDefinition } from '../data/componentDefinitions.d';

/**
 * Resolve a component definition from a component instance using:
 * 1) componentDefinitionKey if present
 * 2) Heuristics based on componentType and discriminator properties
 */
export function resolveComponentDefinition(component: any): ComponentDefinition | undefined {
  if (!component) return undefined;

  const defKey = component.componentDefinitionKey as string | undefined;
  if (defKey) {
    const def = COMPONENT_LIST.find(d => `${d.category}:${d.subcategory}:${d.type}` === defKey);
    if (def) return def;
  }

  // 2) Try to resolve by designator prefix (e.g., CE -> Electrolytic Capacitor, CF -> Film Capacitor)
  if (typeof component.designator === 'string' && component.designator.trim() !== '') {
    const match = component.designator.trim().match(/^[A-Za-z]+/);
    const prefix = match ? match[0] : null;
    if (prefix) {
      const byDesignator = COMPONENT_LIST.find(def =>
        Array.isArray(def.designators) && def.designators.includes(prefix)
      );
      if (byDesignator) {
        return byDesignator;
      }
    }
  }

  // 3) Fallback: normalize componentType for matching (e.g., map specific capacitor types to base "Capacitor")
  const normalizedType: string =
    component.componentType === 'Electrolytic Capacitor' || component.componentType === 'Film Capacitor'
      ? 'Capacitor'
      : component.componentType;

  return COMPONENT_LIST.find(def => {
    if (def.type !== normalizedType) return false;
    // Capacitors
    if (def.category === 'Capacitors') {
      const capType = component.capacitorType || component.dielectric;
      if (capType && def.properties?.capacitorType === capType) return true;
      // Fallback: if the component has no discriminator, use the first matching capacitor definition
      if (!capType) return true;
      return false;
    }
    // Diodes
    if (def.category === 'Diodes') {
      const dType = component.diodeType;
      if (dType && def.properties?.diodeType === dType) return true;
      if (!def.properties?.diodeType) return true;
      return false;
    }
    // Resistors
    if (def.category === 'Resistors') {
      const rType = component.resistorType;
      const vrType = component.vrType;
      if (rType && def.properties?.resistorType === rType) return true;
      if (vrType && def.properties?.vrType === vrType) return true;
      if (!def.properties?.resistorType && !def.properties?.vrType) return true;
      return false;
    }
    // Semiconductors
    if (def.category === 'Semiconductors') {
      const sType = component.semiconductorType;
      if (sType && def.properties?.semiconductorType === sType) return true;
      if (!def.properties?.semiconductorType) return true;
      return false;
    }
    // Passive
    if (def.category === 'Passive Components') {
      const pType = component.passiveType;
      if (pType && def.properties?.passiveType === pType) return true;
      if (!def.properties?.passiveType) return true;
      return false;
    }
    // Power & Energy
    if (def.category === 'Power & Energy') {
      const pType = component.powerType;
      if (pType && def.properties?.powerType === pType) return true;
      if (!def.properties?.powerType) return true;
      return false;
    }
    // Connectors & Switches
    if (def.category === 'Connectors & Switches') {
      const cType = component.connectorType;
      const sType = component.switchType;
      if (cType && def.properties?.connectorType === cType) return true;
      if (sType && def.properties?.switchType === sType) return true;
      if (!def.properties?.connectorType && !def.properties?.switchType) return true;
      return false;
    }
    // GenericComponent
    if (component.componentType === 'GenericComponent') {
      const gType = component.genericType;
      if (gType && def.subtype === gType) return true;
      return false;
    }
    // Default: base type match
    return true;
  });
}

