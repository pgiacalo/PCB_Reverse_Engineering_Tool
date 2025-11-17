# nl2sch Setup and Installation Instructions

## Overview

This guide provides complete instructions for installing and setting up `nl2sch`, a tool that converts KiCad Protel netlist files into KiCad schematic files. The setup includes installation, component library configuration, and path setup for macOS.

## Prerequisites

- **macOS** (instructions are for macOS, but can be adapted for Linux)
- **Python 3.9+** (check with `python3 --version`)
- **Git** (for cloning the repository)
- **KiCad** (optional, for viewing generated schematics)

## Quick Setup (Automated)

Run the provided shell script to automate the entire setup:

```bash
chmod +x setup_nl2sch.sh
./setup_nl2sch.sh
```

## Manual Setup Instructions

### Step 1: Clone nl2sch Repository

```bash
# Clone the repository to your home directory
cd ~
git clone https://github.com/tpecar/nl2sch.git

# Verify the clone
cd nl2sch
ls -la
```

### Step 2: Install Python Dependencies

```bash
cd ~/nl2sch

# Check if pipenv is available (nl2sch uses pipenv for dependency management)
pip3 install pipenv

# Install dependencies
pipenv install

# Or if pipenv is not available, check for requirements.txt
if [ -f requirements.txt ]; then
    pip3 install -r requirements.txt
fi
```

### Step 3: Create Component Library Directory

```bash
# Create the component library directory
mkdir -p ~/nl2sch/components

# Copy example components (optional, for reference)
cp -r ~/nl2sch/ebaz4205/components/* ~/nl2sch/components/ 2>/dev/null || echo "Example components not available"
```

### Step 4: Setup Global Access (macOS)

The setup script creates a wrapper in `~/bin/nl2sch` that:
- Automatically finds nl2sch.py
- Handles Python path detection
- Makes nl2sch accessible from anywhere

```bash
# Create ~/bin directory if it doesn't exist
mkdir -p ~/bin

# Create wrapper script
cat > ~/bin/nl2sch << 'EOF'
#!/bin/zsh
# Wrapper script for nl2sch.py
# Searches for nl2sch.py in common locations

NL2SCH_PATHS=(
  "$HOME/nl2sch/nl2sch.py"
  "$HOME/tools/nl2sch/nl2sch.py"
  "$HOME/Documents/nl2sch/nl2sch.py"
  "/usr/local/lib/nl2sch/nl2sch.py"
  "/opt/nl2sch/nl2sch.py"
)

NL2SCH_SCRIPT=""
for path in "${NL2SCH_PATHS[@]}"; do
  if [[ -f "$path" ]]; then
    NL2SCH_SCRIPT="$path"
    break
  fi
done

if [[ -z "$NL2SCH_SCRIPT" ]]; then
  echo "Error: nl2sch.py not found!" >&2
  echo "" >&2
  echo "Please install nl2sch by running:" >&2
  echo "  git clone https://github.com/tpecar/nl2sch.git ~/nl2sch" >&2
  echo "" >&2
  echo "Or if you have it elsewhere, update ~/bin/nl2sch to point to the correct path." >&2
  exit 1
fi

# Find python3 - try multiple methods
PYTHON3=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON3="$(command -v python3)"
elif [[ -f "/Users/$USER/radioconda/bin/python3" ]]; then
  PYTHON3="/Users/$USER/radioconda/bin/python3"
elif [[ -f "$HOME/radioconda/bin/python3" ]]; then
  PYTHON3="$HOME/radioconda/bin/python3"
elif [[ -f "/usr/local/bin/python3" ]]; then
  PYTHON3="/usr/local/bin/python3"
elif [[ -f "/opt/homebrew/bin/python3" ]]; then
  PYTHON3="/opt/homebrew/bin/python3"
fi

if [[ -z "$PYTHON3" ]]; then
  echo "Error: python3 not found!" >&2
  echo "Please ensure Python 3 is installed and accessible." >&2
  exit 1
fi

# Execute nl2sch.py with all arguments
exec "$PYTHON3" "$NL2SCH_SCRIPT" "$@"
EOF

# Make wrapper executable
chmod +x ~/bin/nl2sch

# Add ~/bin to PATH in ~/.zshrc (if using zsh)
if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zshrc 2>/dev/null; then
  echo '' >> ~/.zshrc
  echo '# Add ~/bin to PATH for custom scripts' >> ~/.zshrc
  echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
  echo "Added ~/bin to PATH in ~/.zshrc"
fi

# Reload shell configuration
source ~/.zshrc 2>/dev/null || echo "Please run: source ~/.zshrc"
```

### Step 5: Verify Installation

```bash
# Check if nl2sch is accessible
which nl2sch

# Test nl2sch
nl2sch --help

# Verify component library directory exists
ls -la ~/nl2sch/components/
```

## Component Library Files

nl2sch requires component library files (`.kicad_sch` files) in the `component_root` directory. These files define:

1. **Matching Rules**: How to match netlist components (by designator prefix, footprint pattern, value pattern)
2. **Schematic Symbol Template**: The KiCad schematic symbol representation
3. **Pin Mappings**: How netlist pins map to schematic symbol pins

### Example Component Library Structure

```
~/nl2sch/components/
├── U.kicad_sch          # For integrated circuits (U1, U2, etc.)
├── R.kicad_sch          # For resistors (R1, R2, etc.)
├── C.kicad_sch          # For capacitors (C1, C2, etc.)
├── D.kicad_sch          # For diodes (D1, D2, etc.)
└── ...
```

### Creating Component Library Files

See examples in `~/nl2sch/ebaz4205/components/` for reference. Each file should:

1. Define matching rules using component properties
2. Include a schematic symbol template
3. Map pin names to netlist pin numbers

## Usage

### Basic Usage

```bash
nl2sch <netlist_file> <component_root> <output_schematic_file>
```

### Example

```bash
# Export netlist from PCB Reverse Engineering Tool
# File -> Export Netlist (Protel/nl2sch)...
# Saves as: Pulse_Gen.Net

# Convert to schematic
nl2sch ./Pulse_Gen.Net ~/nl2sch/components ./Pulse_Gen.kicad_sch
```

### With Missing Components Allowed

If you don't have component library files for all components:

```bash
nl2sch --allow-missing-components ./Pulse_Gen.Net ~/nl2sch/components ./Pulse_Gen.kicad_sch
```

This will:
- Generate a schematic for components that have library files
- Skip components without matching library files
- Still create the schematic file

### Command Options

- `--allow-missing-components` (`-ac`): Skip components without library files
- `--allow-missing-pins` (`-ap`): Allow components with missing pin definitions
- `--component-grouping <file>` (`-cg`): XLS/ODS file for grouping components
- `--width <pixels>`: Maximum width of component groups
- `--spacing <pixels>`: Spacing between component groups

## Troubleshooting

### "nl2sch: command not found"

**Solution:**
```bash
# Reload shell configuration
source ~/.zshrc

# Or manually add to PATH for current session
export PATH="$HOME/bin:$PATH"

# Verify ~/bin is in PATH
echo $PATH | grep -q "$HOME/bin" && echo "PATH is correct" || echo "PATH missing ~/bin"
```

### "python3 not found"

**Solution:**
- Install Python 3: `brew install python3` (if using Homebrew)
- Or download from [python.org](https://www.python.org/downloads/)
- Update the wrapper script (`~/bin/nl2sch`) to point to your Python 3 installation

### "nl2sch.py not found"

**Solution:**
```bash
# Verify nl2sch is cloned
ls -la ~/nl2sch/nl2sch.py

# If not found, clone it
git clone https://github.com/tpecar/nl2sch.git ~/nl2sch
```

### "ERROR: [U1 DIP-8 Schmidt Trigger] could not be mapped to any SchComponent"

**Cause:** Missing component library file for U1.

**Solution:**
- Use `--allow-missing-components` flag to skip missing components
- Or create a component library file (see examples in `~/nl2sch/ebaz4205/components/`)

### "Netlist parsed, X components, Y nets" but no schematic generated

**Cause:** All components were skipped due to missing library files.

**Solution:**
- Use `--allow-missing-components` to see which components are missing
- Create component library files for your components
- Check that component_root directory path is correct

## Workflow Integration

### Complete Workflow

1. **Reverse Engineer PCB** using PCB Reverse Engineering Tool
2. **Export Netlist** using File → Export Netlist (Protel/nl2sch)...
3. **Convert to Schematic**:
   ```bash
   nl2sch --allow-missing-components ./project.Net ~/nl2sch/components ./project.kicad_sch
   ```
4. **Open in KiCad** to view/edit the generated schematic
5. **Create Component Libraries** for missing components (optional, for complete schematic)

## Files Created by Setup

- `~/nl2sch/` - nl2sch repository
- `~/nl2sch/components/` - Component library directory
- `~/bin/nl2sch` - Wrapper script for global access
- `~/.zshrc` - Updated with PATH configuration

## References

- **nl2sch Repository**: https://github.com/tpecar/nl2sch
- **KiCad Documentation**: https://docs.kicad.org/
- **Example Components**: `~/nl2sch/ebaz4205/components/`
- **Netlist Format**: See `docs_lessons_learned/KICAD_NETLIST_IMPLEMENTATION.md`

## Next Steps

After setup:

1. **Test with a simple netlist** to verify installation
2. **Create component library files** for your commonly used components
3. **Integrate into your workflow** for PCB reverse engineering projects


