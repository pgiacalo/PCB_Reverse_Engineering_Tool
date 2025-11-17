# Using nl2sch to Generate Schematics from Netlist

## Overview

`nl2sch` is a Python tool that converts KiCad netlist files (`.net`) into KiCad schematic files (`.kicad_sch`). This allows you to automatically generate a schematic representation from your reverse-engineered PCB netlist.

## Prerequisites

1. **Python 3.x** installed on your system
2. **nl2sch** tool installed
3. **KiCad** installed (to view/edit the generated schematic)
4. **Netlist file** exported from the PCB Reverse Engineering Tool (`.net` format)

## Installation

### Step 1: Clone or Download nl2sch

```bash
# Clone the repository
git clone https://github.com/tpecar/nl2sch.git
cd nl2sch
```

Or download the repository as a ZIP file from: https://github.com/tpecar/nl2sch

### Step 2: Install Dependencies

```bash
# Check if pip is available
pip --version

# Install required Python packages (if any)
# Check the repository's requirements.txt or README for specific dependencies
pip install -r requirements.txt  # If requirements.txt exists
```

### Step 3: Verify Installation

```bash
# Check if nl2sch is accessible
python nl2sch.py --help
# or
python3 nl2sch.py --help
```

## Usage Procedure

### Step 1: Export Netlist from PCB Tool

1. Open your project in the PCB Reverse Engineering Tool
2. Ensure all components have designators (e.g., U1, R1, C1)
3. Connect component pins to vias/traces as needed
4. Go to **File → Export Netlist…**
5. Save the file (e.g., `my_project.net`)

### Step 2: Prepare the Netlist File

Verify your netlist file is correctly formatted:

```bash
# View the netlist file
cat my_project.net
```

The file should start with:
```
(
  (components
    (comp (ref U1) ...)
    ...
  )
  (nets
    (net (code 1) (name GND) ...)
    ...
  )
)
```

### Step 3: Run nl2sch

```bash
# Basic usage
nl2sch input.Net component_root output.kicad_sch

# Example with missing components allowed (recommended for first run)
nl2sch --allow-missing-components ./my_project.Net ~/nl2sch/components ./my_project.kicad_sch
```

**Command Format:**
```
nl2sch [options] <netlist_file> <component_root> <output_schematic_file>
```

**Important Options:**
- `--allow-missing-components` (`-ac`): Skip components that don't have matching library files (recommended for first run)
- `--allow-missing-pins` (`-ap`): Allow components with missing pin definitions
- `--component-grouping <file>` (`-cg`): XLS/ODS file for grouping components into schematic sections

### Step 4: Open in KiCad

1. Open KiCad
2. Go to **File → Open**
3. Select the generated `.kicad_sch` file
4. Review the schematic layout

### Step 5: Adjust Schematic Layout (Optional)

The auto-generated schematic may need manual adjustments:

1. **Reposition components** for better readability
2. **Adjust net routing** to reduce wire crossings
3. **Add labels** for clarity
4. **Group related components** together
5. **Add power/ground symbols** if needed

## Troubleshooting

### Issue: "Command not found: python"

**Solution:**
- Try `python3` instead of `python`
- Ensure Python is installed and in your PATH

### Issue: "Module not found" errors

**Solution:**
```bash
# Install missing dependencies
pip install <module_name>
# or
pip3 install <module_name>
```

### Issue: "Invalid netlist format"

**Solution:**
- Verify the netlist file is in KiCad Protel format
- Check that all components have designators
- Ensure the file is not corrupted

### Issue: Generated schematic is empty or incomplete

**Possible Causes:**
1. **Missing component designators**: All components must have designators (U1, R1, etc.)
2. **No pin connections**: Component pins must be connected to nets
3. **Isolated nets**: Nets with no component connections won't appear

**Check:**
- Review the netlist file for component entries
- Verify pin connections in the PCB tool
- Check console output from netlist generation for warnings

### Issue: "ERROR: [U1 DIP-8 Schmidt Trigger] could not be mapped to any SchComponent"

**Cause:** nl2sch requires component library files (`.kicad_sch` files) in the `component_root` directory that define how to map netlist components to schematic symbols.

**Solution 1 (Quick):** Use the `--allow-missing-components` flag to skip components without library files:
```bash
nl2sch --allow-missing-components ./Pulse_Gen.Net ~/nl2sch/components ./Pulse_Gen.kicad_sch
```

**Solution 2 (Complete):** Create component library files. See the `~/nl2sch/ebaz4205/components/` directory for examples. Each component needs a `.kicad_sch` file that defines:
- Matching rules (designator prefix, footprint pattern, value pattern)
- Schematic symbol template
- Pin mappings

**Note:** The netlist format is correct if you see "Netlist parsed, X components, Y nets". The missing component library files are a separate issue.

### Issue: Components appear but no connections

**Possible Causes:**
1. **Nets have no component pins**: Only nets with component pin connections are included
2. **Pin connections not established**: Component pins must be connected to vias/traces

**Solution:**
- In the PCB tool, ensure component pins are connected to vias/traces
- Re-export the netlist after making connections

## Advanced Usage

### Custom Component Libraries

If nl2sch supports custom component libraries:

```bash
python nl2sch.py --library custom_lib.json input.net output.kicad_sch
```

### Output Options

Check nl2sch help for additional options:

```bash
python nl2sch.py --help
```

Common options might include:
- `--verbose`: Show detailed processing information
- `--output-dir`: Specify output directory
- `--format`: Choose output format variant

## Workflow Summary

```
PCB Reverse Engineering Tool
    ↓ (Export Netlist)
my_project.net
    ↓ (nl2sch conversion)
my_project.kicad_sch
    ↓ (Open in KiCad)
KiCad Schematic Editor
    ↓ (Manual adjustments)
Final Schematic
```

## Example Session

```bash
# 1. Export netlist from PCB tool (via File → Export Netlist…)
#    Saved as: schmidt_trigger.net

# 2. Convert to schematic
cd /path/to/nl2sch
python nl2sch.py ~/Downloads/schmidt_trigger.net ~/Documents/schmidt_trigger.kicad_sch

# 3. Open in KiCad
kicad ~/Documents/schmidt_trigger.kicad_sch
```

## Notes

- **Component Designators**: Must be unique and follow standard naming (U1, R1, C1, etc.)
- **Net Names**: Power nets (e.g., "+5V") and ground ("GND") are preserved
- **Signal Nets**: Auto-named as "N$1", "N$2", etc.
- **Footprints**: Component footprints from the netlist are preserved
- **Pin Numbers**: Must match the component's actual pin configuration

## References

- **nl2sch Repository**: https://github.com/tpecar/nl2sch
- **KiCad Documentation**: https://docs.kicad.org/
- **Netlist Format**: See `docs_lessons_learned/KICAD_NETLIST_IMPLEMENTATION.md`

