# Release Notes - v2.9

## Major Features

### IC Pin Layout Drawing Feature
- **New IC Placement Tool**: Draw vias or pads around an integrated circuit perimeter using click-drag-release mouse interaction
- **Pattern Placement Dialogs**: Option+click on via/pad tools opens dialogs for:
  - Arrangement types: Linear, 2-sided, or 4-sided
  - Number of pins configuration
  - Chip orientation: 0°, 90°, 180°, or 270°
  - Layer selection (for pads): Top or Bottom
- **Counter-Clockwise (CCW) Pin Numbering**: Follows standard IC pin numbering conventions starting from Pin 1 (upper-left corner)
- **Automatic Tool Return**: Tool automatically returns to Select tool after placement
- **Visual Preview**: Orange dashed rectangle preview while dragging
- **Keyboard Shortcuts**: 
  - `Alt/Option+V`: Open Via Pattern Placement dialog
  - `Alt/Option+P`: Open Pad Pattern Placement dialog

### AI-Powered Pin Name Extraction
- **Google Gemini AI Integration**: Automatically extract pin names from datasheet PDFs using Google Gemini API
- **Local File Support**: Upload local PDF datasheets for pin name extraction
- **CORS Proxy Fallback**: Handles CORS restrictions with automatic proxy fallback
- **CSV Format Response**: AI returns pin information in structured CSV format
- **API Key Management**: Secure API key storage (localStorage for production, .env for development)
- **User-Friendly Interface**: "Fetch Pin Names" button with loading states and clear error messages

### Default View 0
- **Automatic Default View**: New projects automatically set View 0 to show origin with photos fully contained within canvas
- **View Management**: Improved view system with automatic initialization

### Component Definitions System
- **Data-Driven Components**: Component definitions stored in `componentDefinitions.json`
- **Pin Names Integration**: Pin names now data-driven based on component definitions
- **Option Key Hover**: Hover over semiconductors with Option key to see pin table

## Improvements

### Keyboard Shortcuts
- **`A` Key**: Opens Component Properties dialog for highlighted component
- **`Alt/Option+V`**: Opens Via Pattern Placement dialog
- **`Alt/Option+P`**: Opens Pad Pattern Placement dialog
- **`Shift` Modifier**: Hold Shift while using +/- buttons to change component size 5x faster
- **Cross-Platform Support**: Improved keyboard shortcut handling for macOS, Windows, and Linux

### Component Properties Dialog
- **Enhanced Datasheet Management**: 
  - Local PDF file upload support
  - Clickable datasheet links (both local and remote)
  - Improved file input display
- **Column Renaming**: "Name" column renamed to "Pin Name" for clarity
- **Field Improvements**: 
  - Removed duplicate Part Number and Manufacturer fields
  - Improved font sizing
  - Better field organization
- **Persistence**: All component properties (including datasheet URL and file name) are now properly persisted and reloaded

### UI/UX Enhancements
- **Splash Screen**: 
  - Video background added
  - Updated messaging (removed "Generate Schematic")
  - Improved cross-platform compatibility
- **Menu Improvements**: 
  - "Images" and "Tools" menu buttons always active (not dimmed)
  - Submenu items properly disabled when no project is active
  - Updated About menu Technologies section (mentions TypeScript, React, and Gemini AI)
- **Donate Button**: Moved to lower right corner with improved styling
- **Component Selection**: Improved Component Selection Dialog UX

### Documentation
- **Updated Help Menu**: Comprehensive documentation of new features
- **Updated About Menu**: Technologies section updated
- **README Updates**: Enhanced descriptions and keyboard shortcuts documentation

## Bug Fixes

### Critical Fixes
- **React Rules of Hooks Violation**: Fixed app crash when double-clicking component icons
  - Moved all hooks to top of component before conditional returns
  - Added comprehensive validation checks
  - Improved error logging
- **Component Property Persistence**: Fixed datasheet URL and file name not being saved/loaded
- **Component Selection**: Fixed component designator mismatch and stale closure bugs

### Component System Fixes
- **Component Cursor Flicker**: Fixed by unifying tool size with component icons
- **Trace Cursor and Preview Flicker**: Fixed by making tool instances single source of truth
- **Component Size/Color Consistency**: Improved consistency across component system
- **Pin Connection Display**: Darker color for Pin 1 connections, improved visibility

### IC Placement Fixes
- **Preview Rectangle Offset**: Fixed preview rectangle positioning
- **Option+Click Functionality**: Restored Option+click to open dialogs
- **Drawing Order**: Ensured correct CCW drawing order

### Deployment Fixes
- **GitHub Pages Deployment**: Improved deployment script for large video files
- **HTTP Buffer Configuration**: Increased buffer size for large file uploads

### Other Fixes
- **Origin Centering**: Fixed origin centering issues
- **Coordinate Transformations**: Fixed perspective view coordinate transformations
- **BOM Export**: Improved BOM values and formatting
- **Auto Save**: Fixed Save Project and Auto Save functionality
- **TypeScript Build Errors**: Fixed all TypeScript build errors

## Technical Improvements

- **Per-Tool Layer Defaults**: Implemented with persistence
- **Component Definition Resolver**: Improved component definition resolution
- **State Management**: Better state clearing between projects
- **Error Handling**: Improved error messages and logging
- **Code Quality**: Fixed linter errors and improved code consistency

## Migration Notes

- **API Key Setup**: For AI pin name extraction, users need to:
  1. Get a Google Gemini API key from Google AI Studio
  2. Enter it in the Component Properties dialog (for GitHub Pages deployment)
  3. Or set `VITE_GEMINI_API_KEY` in `.env` file (for local development)
- **Component Definitions**: Existing projects will continue to work, but new component definitions system provides better pin name management

## Full Changelog

See git log for complete list of commits:
```bash
git log v2.8.0..v2.9 --oneline
```

---

**Release Date**: January 2025  
**Previous Version**: v2.8.0

