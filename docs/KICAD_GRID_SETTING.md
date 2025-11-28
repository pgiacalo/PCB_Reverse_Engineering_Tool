# KiCad Grid Setting (100mm)

## Issue

KiCad schematic files (`.kicad_sch`) do not store grid settings in the file itself. The grid is a **view preference** that is user-specific and stored in KiCad's configuration, not in the schematic file.

## Current Status

- ❌ **Grid element removed from schematic file** - The `(grid (size 100) (style dots))` element is not valid in KiCad schematic file format and causes parsing errors
- ✅ **Code updated** - Grid element has been removed from `generateSimpleSchematic()` function
- ⚠️ **Manual configuration required** - Users must set the grid to 100mm in KiCad's view settings

## How to Set Grid to 100mm in KiCad

### Method 1: Via View Menu
1. Open the schematic in KiCad
2. Go to **View → Grid → Set Grid...**
3. Enter `100` in the grid size field
4. Select grid style (dots/lines)
5. Click OK

### Method 2: Via Preferences
1. Open KiCad
2. Go to **Preferences → Schematic Editor → Display Options**
3. Set **Grid Size** to `100 mm`
4. Click OK

### Method 3: Via Keyboard Shortcut
1. While viewing the schematic, press the grid size shortcut
2. Enter `100` when prompted

## Future Solutions

### Option 1: Project-Level Settings
KiCad may support project-level grid settings in future versions. If this becomes available, we can add it to the schematic file.

### Option 2: Configuration File
We could create a KiCad configuration file (`.kicad_pro`) that sets default grid preferences, but this would require users to load the project file, not just the schematic.

### Option 3: Documentation/Instructions
Include instructions in the exported schematic or create a README that explains how to set the grid.

## Recommendation

For now, the best approach is to:
1. Remove the invalid grid element (✅ Done)
2. Document the requirement for users to manually set the grid
3. Consider adding a note in the exported schematic filename or metadata

## Technical Details

The error occurred because KiCad's parser expects specific top-level elements in `.kicad_sch` files:
- `paper`
- `title_block`
- `lib_symbols`
- `symbol` (instances)
- `wire`
- `junction`
- `text`
- `label`
- etc.

The `grid` element is **not** in this list, causing the parser error at line 3, offset 4.

