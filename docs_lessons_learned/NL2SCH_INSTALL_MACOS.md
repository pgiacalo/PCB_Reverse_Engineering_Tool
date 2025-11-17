# Installing nl2sch on macOS for Global Access

## Quick Setup

### Step 1: Clone nl2sch Repository

```bash
git clone https://github.com/tpecar/nl2sch.git ~/nl2sch
```

This will install nl2sch in your home directory at `~/nl2sch/`.

### Step 2: Verify Installation

The setup script has already:
- ✅ Created `~/bin/nl2sch` wrapper script
- ✅ Added `~/bin` to your PATH in `~/.zshrc`

### Step 3: Reload Your Shell

```bash
source ~/.zshrc
```

Or simply open a new terminal window.

### Step 4: Test the Installation

```bash
nl2sch --help
```

You should see nl2sch help output. If you get "command not found", make sure you've reloaded your shell.

## Usage

Once installed, you can use nl2sch from anywhere:

```bash
# From any directory
nl2sch input.net output.kicad_sch
```

## Custom Installation Location

If you installed nl2sch in a different location, edit `~/bin/nl2sch` and update the `NL2SCH_PATHS` array to include your path.

## Troubleshooting

### "nl2sch.py not found"

**Solution:** Make sure you've cloned the repository:
```bash
git clone https://github.com/tpecar/nl2sch.git ~/nl2sch
```

### "command not found: nl2sch"

**Solution 1:** Reload your shell:
```bash
source ~/.zshrc
```

**Solution 2:** Check if ~/bin is in PATH:
```bash
echo $PATH | grep -q "$HOME/bin" && echo "PATH is correct" || echo "PATH missing ~/bin"
```

**Solution 3:** Manually add to PATH for current session:
```bash
export PATH="$HOME/bin:$PATH"
```

### "Permission denied"

**Solution:** Make the wrapper script executable:
```bash
chmod +x ~/bin/nl2sch
```

## Alternative: Direct Symlink Method

If you prefer a direct symlink instead of a wrapper:

```bash
# Remove the wrapper (if it exists)
rm ~/bin/nl2sch

# Create a symlink (after cloning nl2sch)
ln -s ~/nl2sch/nl2sch.py ~/bin/nl2sch

# Make it executable
chmod +x ~/bin/nl2sch
```

However, this requires the shebang line in nl2sch.py to be correct. The wrapper script method is more reliable.

## Verification

After setup, verify everything works:

```bash
# Check PATH
echo $PATH | tr ':' '\n' | grep bin

# Check nl2sch location
which nl2sch

# Test nl2sch
nl2sch --help
```

All commands should work without errors.


