import { COMPONENT_LIST } from '../data/componentDesignators';
import type { ComponentDefinition } from '../data/componentDefinitions.d';

/**
 * Resolve a component definition from a component instance using componentDefinitionKey.
 * This is the only way to resolve definitions - all components must have a valid key.
 * 
 * If a component doesn't have a key, it means it wasn't created properly through the
 * data-driven system, and undefined will be returned (which will show an error message).
 */
export function resolveComponentDefinition(component: any): ComponentDefinition | undefined {
  if (!component) return undefined;

  const defKey = component.componentDefinitionKey as string | undefined;
  if (!defKey) {
    console.warn('[resolveComponentDefinition] Component missing componentDefinitionKey:', {
      id: component.id,
      componentType: component.componentType,
      designator: component.designator
    });
    return undefined;
  }

  // Support both old format (category:subcategory:type) and new format (category:subcategory)
  const def = COMPONENT_LIST.find(d => {
    const newKey = `${d.category}:${d.subcategory}`;
    const oldKey = `${d.category}:${d.subcategory}:${d.type}`;
    return defKey === newKey || defKey === oldKey;
  });

  if (!def) {
    console.warn('[resolveComponentDefinition] Key not found in definitions:', {
      key: defKey,
      componentId: component.id,
      componentType: component.componentType
    });
  }

  return def;
}
