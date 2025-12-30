# PCB Tracer JSON Schemas

This directory contains JSON Schema definitions for data files used by PCB Tracer.

## Schema Files

### `componentDefinitions.schema.json`

Defines the structure of `componentDefinitions.json` - the master list of available PCB component types.

**Used by:** `src/data/componentDefinitions.json`

**Key structures:**
- Component definitions (type, category, subcategory, designator, pins)
- Component field definitions (name, label, type, units)
- Category hierarchy

### `pads-netlist.schema.json`

Defines the structure of PADS-PCB JSON netlist files exported via **File → Export Netlist → PADS-PCB (.json)**.

**Output location:** `<project>/netlists/<project>_PADS.json`

**Key structures:**
- `design_info` - Project name and export date
- `components` - Array of components with designators, values, packages, and pin definitions
- `nets` - Array of electrical nets with component pin connections

## Pin Types

Both schemas use a standardized set of pin types:

| Type | Description |
|------|-------------|
| `input` | Input pin |
| `output` | Output pin |
| `bidirectional` | Bidirectional I/O |
| `tristate` | Tri-state output |
| `passive` | Passive component pin (resistor, capacitor, etc.) |
| `power` | Power supply pin (VCC, VDD) |
| `ground` | Ground pin (GND, VSS) |
| `open_collector` | Open collector/drain output |
| `open_emitter` | Open emitter output |
| `no_connect` | No internal connection |
| `unspecified` | Pin type not specified |

## Validation

You can validate JSON files against these schemas using:

**Online:** [JSON Schema Validator](https://www.jsonschemavalidator.net/)

**CLI (ajv-cli):**
```bash
npm install -g ajv-cli
ajv validate -s schemas/pads-netlist.schema.json -d path/to/export.json
```

**VS Code:** Install the "JSON Schema Validator" extension and add to your `.vscode/settings.json`:
```json
{
  "json.schemas": [
    {
      "fileMatch": ["*_PADS.json"],
      "url": "./schemas/pads-netlist.schema.json"
    }
  ]
}
```

## Schema Version

All schemas use JSON Schema Draft-07: `http://json-schema.org/draft-07/schema#`
