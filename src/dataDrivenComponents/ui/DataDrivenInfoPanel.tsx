import React from 'react';
import type { PCBComponent } from '../../types';
import type { DataDrivenComponentDefinition, ComponentFieldDefinition } from '../definitions/schema';

export interface DataDrivenInfoPanelProps {
  component: PCBComponent;
  definition: DataDrivenComponentDefinition | null;
}

/**
 * Simple, self-contained information panel that renders a component's
 * data-driven fields from its definition.
 *
 * This is intentionally minimal and can be embedded anywhere for testing.
 */
export const DataDrivenInfoPanel: React.FC<DataDrivenInfoPanelProps> = ({ component, definition }) => {
  if (!definition) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 4 }}>
        No component definition found for <strong>{component.designator}</strong>. Check componentDefinitions.json and definition keys.
      </div>
    );
  }

  const fields: ComponentFieldDefinition[] = definition.fields || [];
  const keyValue = definition.key || '(empty)';

  return (
    <div style={{ padding: 8, fontSize: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 4 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {definition.displayName} ({component.designator})
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
        {definition.description}
      </div>
      {/* Debug / inspection: show which JSON definition was resolved - can be removed in production */}
      {import.meta.env.DEV && (
        <div style={{ fontSize: 10, color: '#999', marginBottom: 6, padding: 4, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2 }}>
          <div><strong>Key:</strong> {keyValue}</div>
          <div><strong>Category:</strong> {definition.category} / {definition.subcategory}</div>
          <div><strong>Type:</strong> {definition.type}</div>
          <div><strong>Designators:</strong> {definition.designators?.join(', ') || 'N/A'}</div>
        </div>
      )}
      {fields.length === 0 ? (
        <div style={{ fontSize: 11, color: '#999' }}>No fields defined for this component type.</div>
      ) : (
        <div style={{ fontSize: 11, color: '#333' }}>
          {fields.map((field) => {
            const val = (component as any)[field.name];
            if (val === undefined || val === null || val === '') return null;
            const unit = (component as any)[`${field.name}Unit`];
            return (
              <div key={field.name} style={{ marginBottom: 2 }}>
                <strong>{field.label}:</strong> {val}{unit ? ` ${unit}` : ''}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


