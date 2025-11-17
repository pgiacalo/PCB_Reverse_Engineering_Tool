#!/bin/bash
# nl2sch Setup Script for macOS
# This script automates the complete setup of nl2sch for use with the PCB Reverse Engineering Tool

set -e  # Exit on error

echo "=========================================="
echo "nl2sch Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please adapt for your system."
    exit 1
fi

# Step 1: Check Python 3
print_info "Checking Python 3 installation..."
if command -v python3 >/dev/null 2>&1; then
    PYTHON3_VERSION=$(python3 --version)
    print_success "Python 3 found: $PYTHON3_VERSION"
    PYTHON3_PATH=$(command -v python3)
else
    print_error "Python 3 not found. Please install Python 3.9 or later."
    echo "  Install via Homebrew: brew install python3"
    echo "  Or download from: https://www.python.org/downloads/"
    exit 1
fi

# Step 2: Check Git
print_info "Checking Git installation..."
if command -v git >/dev/null 2>&1; then
    print_success "Git found: $(git --version)"
else
    print_error "Git not found. Please install Git."
    echo "  Install via Homebrew: brew install git"
    exit 1
fi

# Step 3: Clone nl2sch repository
print_info "Setting up nl2sch repository..."
NL2SCH_DIR="$HOME/nl2sch"

if [ -d "$NL2SCH_DIR" ]; then
    print_info "nl2sch directory already exists at $NL2SCH_DIR"
    read -p "Update existing repository? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$NL2SCH_DIR"
        git pull || print_error "Failed to update repository"
    fi
else
    print_info "Cloning nl2sch repository..."
    git clone https://github.com/tpecar/nl2sch.git "$NL2SCH_DIR" || {
        print_error "Failed to clone nl2sch repository"
        exit 1
    }
    print_success "Repository cloned to $NL2SCH_DIR"
fi

# Step 4: Install Python dependencies
print_info "Installing Python dependencies..."
cd "$NL2SCH_DIR"

# Check for pipenv
if command -v pipenv >/dev/null 2>&1; then
    print_info "Using pipenv for dependency management..."
    pipenv install || print_error "Failed to install dependencies with pipenv"
    print_success "Dependencies installed with pipenv"
elif [ -f "requirements.txt" ]; then
    print_info "Installing from requirements.txt..."
    pip3 install -r requirements.txt || print_error "Failed to install from requirements.txt"
    print_success "Dependencies installed from requirements.txt"
else
    print_info "No requirements.txt found. nl2sch may work without additional dependencies."
fi

# Step 5: Create component library directory
print_info "Setting up component library directory..."
COMPONENTS_DIR="$NL2SCH_DIR/components"
mkdir -p "$COMPONENTS_DIR"
print_success "Component library directory created: $COMPONENTS_DIR"

# Copy example components if available (optional)
if [ -d "$NL2SCH_DIR/ebaz4205/components" ]; then
    print_info "Example components found. Copying to components directory..."
    cp -r "$NL2SCH_DIR/ebaz4205/components/"* "$COMPONENTS_DIR/" 2>/dev/null || true
    print_success "Example components copied (for reference)"
fi

# Step 6: Create wrapper script
print_info "Creating nl2sch wrapper script..."
BIN_DIR="$HOME/bin"
mkdir -p "$BIN_DIR"

cat > "$BIN_DIR/nl2sch" << 'EOF'
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

chmod +x "$BIN_DIR/nl2sch"
print_success "Wrapper script created: $BIN_DIR/nl2sch"

# Step 7: Add ~/bin to PATH
print_info "Configuring PATH..."
ZSHRC="$HOME/.zshrc"

if ! grep -q 'export PATH="$HOME/bin:$PATH"' "$ZSHRC" 2>/dev/null; then
    echo '' >> "$ZSHRC"
    echo '# Add ~/bin to PATH for custom scripts (added by nl2sch setup)' >> "$ZSHRC"
    echo 'export PATH="$HOME/bin:$PATH"' >> "$ZSHRC"
    print_success "Added ~/bin to PATH in $ZSHRC"
else
    print_info "~/bin already in PATH"
fi

# Step 8: Verify installation
print_info "Verifying installation..."
export PATH="$HOME/bin:$PATH"

if command -v nl2sch >/dev/null 2>&1; then
    print_success "nl2sch is accessible"
    echo ""
    echo "Testing nl2sch..."
    nl2sch --help >/dev/null 2>&1 && print_success "nl2sch is working" || print_error "nl2sch test failed"
else
    print_error "nl2sch not found in PATH"
    echo "  Please run: source ~/.zshrc"
    echo "  Or open a new terminal window"
fi

# Summary
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Installation Summary:"
echo "  • nl2sch repository: $NL2SCH_DIR"
echo "  • Component library: $COMPONENTS_DIR"
echo "  • Wrapper script: $BIN_DIR/nl2sch"
echo "  • PATH configured in: $ZSHRC"
echo ""
echo "Next Steps:"
echo "  1. Reload your shell: source ~/.zshrc"
echo "  2. Test nl2sch: nl2sch --help"
echo "  3. Export netlist from PCB tool: File → Export Netlist (Protel/nl2sch)..."
echo "  4. Convert to schematic:"
echo "     nl2sch --allow-missing-components ./project.Net ~/nl2sch/components ./project.kicad_sch"
echo ""
echo "For detailed usage instructions, see:"
echo "  docs_lessons_learned/nl2sch_setup_instructions.md"
echo ""


