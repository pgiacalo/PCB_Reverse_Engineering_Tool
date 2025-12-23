# Component Data Structure Proposal

## Current Issues
1. Description doesn't include category, so searching "capacitor" doesn't find all capacitor types
2. Display shows redundant information (e.g., "Film Capacitor" when category is already "Capacitors")
3. Data is split across multiple structures (designators, type info, categories)

## Proposed Structure

### Option 1: Flat Structure with Explicit Fields (Recommended)
```json
{
  "components": [
    {
      "category": "Capacitors",
      "subcategory": "Film",
      "type": "Film Capacitor",
      "displayName": "Film",
      "description": "Film capacitor",
      "searchText": "Film Capacitor capacitor film",
      "designator": "CF",
      "defaultPins": 2
    }
  ]
}
```

**Pros:**
- Simple, flat structure
- Easy to search (one field: searchText)
- Clear separation of display vs search
- Easy to maintain

**Cons:**
- Some duplication (category repeated for each component)

### Option 2: Hierarchical Structure
```json
{
  "categories": {
    "Capacitors": {
      "subcategories": {
        "Film": {
          "type": "Film Capacitor",
          "displayName": "Film",
          "description": "Film capacitor",
          "designator": "CF",
          "defaultPins": 2
        }
      }
    }
  }
}
```

**Pros:**
- No duplication of category names
- Natural hierarchy
- Easy to iterate by category

**Cons:**
- More complex to search (need to flatten)
- Harder to look up by designator

### Option 3: Hybrid Structure (Best for this use case)
```json
{
  "components": [
    {
      "category": "Capacitors",
      "subcategory": "Film",
      "type": "Film Capacitor",
      "displayName": "Film",
      "description": "Film capacitor",
      "designator": "CF",
      "defaultPins": 2
    }
  ],
  "categories": {
    "Capacitors": {
      "subcategories": ["General", "Electrolytic", "Film", "Tantalum"]
    }
  }
}
```

**Pros:**
- Components are flat (easy to search/lookup)
- Categories provide structure for UI
- Best of both worlds

**Cons:**
- Two structures to maintain (but they're complementary)

## Recommendation: Option 3 (Hybrid)

### Structure Details

```typescript
interface ComponentDefinition {
  category: string;           // "Capacitors", "Diodes", etc.
  subcategory: string;        // "Film", "LED", "Standard", etc.
  type: string;              // "Film Capacitor", "Diode", etc. (ComponentType)
  displayName: string;       // "Film", "LED", "Capacitor" (what user sees)
  description: string;       // "Film capacitor" (full description)
  searchText: string;         // "Film Capacitor capacitor film" (all searchable terms)
  designator: string;         // "CF" (single designator prefix)
  defaultPins: number;        // 2
  subtype?: string;           // For Diode, VariableResistor, GenericComponent
}
```

### Benefits
1. **Display**: Use `displayName` - clean, no redundancy ("Film" not "Film Capacitor")
2. **Search**: Use `searchText` - includes category, type, description, subcategory
3. **Organization**: Use `category` and `subcategory` for UI grouping
4. **Lookup**: Easy to find by designator, type, or category

### Example Usage

**Display in UI:**
- Show: `displayName` (e.g., "Film")
- Category header already shows "Capacitors", so no need to repeat

**Search:**
- Search "capacitor" → finds all components where `searchText` contains "capacitor"
- Search "film" → finds Film capacitor
- Search "diodes" → finds all diode types

**Lookup:**
- By designator: Find component where `designator === 'CF'`
- By type: Find component where `type === 'Film Capacitor'`
- By category: Filter where `category === 'Capacitors'`









