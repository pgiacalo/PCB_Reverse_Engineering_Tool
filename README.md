# PCB Reverse Engineering Tool

A browser-based photo editing tool designed to aid in the reverse engineering of 2-sided printed circuit boards (PCBs). This tool allows engineers and hobbyists to load top and bottom PCB photos, overlay them with precise alignment, control photo transparency, and add annotations to facilitate the reverse engineering process.

## Video Instructions

A 3 minute video that explains how to use the tool can be found at the the following link.
https://youtu.be/X4hGUUNUJ60

## Live Demo

🌐 **Try the tool online**: [https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool](https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool)

The application is hosted on GitHub and is available globally. No installation required - just open the link in your browser to try the tool. 

## Installation Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm (version 8 or higher)
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)

### Project Dependencies
- Runtime: `react`, `react-dom`, `react-colorful`, `lucide-react`
- Dev: `vite`, `typescript`, ESLint tooling, `gh-pages` (for manual Pages deploy)

### Step-by-Step Installation

1. **Clone or download the project**
   ```bash
   git clone https://github.com/pgiacalo/PCB_Reverse_Engineering_Tool.git
   cd PCB_reverse_engineer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   
   **Option A: Using the convenience script (Recommended)**
   ```bash
   ./run_local.sh
   ```
   
   **Option B: Using npm directly**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the URL shown in your terminal)

## Quick Start with run_local.sh

For the easiest development experience, use the included convenience script:

### **What the script does:**
- ✅ **Checks dependencies** and installs them automatically if needed
- ✅ **Starts the development server** with hot reload
- ✅ **Shows helpful information** about the local URL
- ✅ **Provides clear instructions** for stopping the server

### **How to use:**
```bash
# Make sure you're in the project directory
cd PCB_reverse_engineer

# Run the convenience script
./run_local.sh
```

### **Script output:**
```
🔧 Starting PCB Reverse Engineering Tool...
📁 Project directory: /path/to/PCB_reverse_engineer
🚀 Starting development server...
🌐 Your app will be available at: http://localhost:5173/
📝 Press Ctrl+C to stop the server
```

### **Port handling:**
- The script automatically handles port conflicts
- If port 5173 is in use, it will find the next available port
- The actual URL will be displayed in the terminal output

## Deployment to a Web Server (GitHub Pages)

See the GitHub Pages guide: [README_FOR_GITHUB_PAGES.md](README_FOR_GITHUB_PAGES.md).

## Usage Instructions

### Getting Started

1. **Load PCB Images**
   - Click "Load Top PCB" button and select your top-side PCB photo
   - Click "Load Bottom PCB" button and select your bottom-side PCB photo
   - Images will appear in the canvas area

2. **Switch Between Views**
   - **Top View**: Shows only the top PCB image
   - **Bottom View**: Shows only the bottom PCB image  
   - **Overlay View**: Shows both images overlaid with transparency control

3. **Adjust Transparency**
   - Use the "Transparency" slider to control bottom image visibility
   - 0% = bottom image completely hidden
   - 100% = bottom image fully visible
   - **Double-click the slider** to reset to 50%

### Image Transform Controls

#### Transform Mode Selection
1. Click the "Transform" button to enter transform mode
2. Select which image to transform:
   - **Top Image**: Transform the top PCB image
   - **Bottom Image**: Transform the bottom PCB image

#### Transform Operations

**Move (Drag)**
- Click and drag on the selected image to reposition it
- Use for rough alignment

**Nudge (Arrow Keys)**
- Select "Nudge" radio button
- Use arrow keys for pixel-perfect positioning:
  - ↑↓←→ = 1 pixel movement in each direction

**Scale (Arrow Keys)**
- Select "Scale" radio button  
- Use arrow keys for precise scaling:
  - ↑ = +1% scaling
  - ↓ = -1% scaling
  - → = +0.1% scaling (fine adjustment)
  - ← = -0.1% scaling (fine adjustment)

**Rotate (Arrow Keys)**
- Select "Rotate" radio button
- Use arrow keys for precise rotation:
  - ↑ = +1 degree rotation
  - ↓ = -1 degree rotation
  - → = +0.1 degree rotation (fine adjustment)
  - ← = -0.1 degree rotation (fine adjustment)

**Flip Controls**
- **Horizontal Flip**: Flip image left-to-right
- **Vertical Flip**: Flip image top-to-bottom
- Use these to correct image orientation

**Slant (Skew) (Arrow Keys)**
- Select "Slant" radio button
- Applies an affine skew (shear) to the image:
  - ↑/↓ = ±0.5° vertical slant
  - ←/→ = ±0.5° horizontal slant

**Keystone (Arrow Keys)**
- Select "Keystone" radio button
- Applies a perspective-like taper (keystone) similar to correcting camera perspective:
  - ↑/↓ = ±0.5° vertical keystone (top vs bottom width)
  - ←/→ = ±0.5° horizontal keystone (left vs right width)

**Black & White / Invert**
- Click "Black & White" to enable edge-highlighted black/white rendering of the images (useful for emphasizing PCB traces and outlines).
- Once enabled, the same button changes to "Invert"; click it to swap black and white.
- The "Color Mode" button exits both Grayscale and Black & White/Invert, restoring full color.

**Reset Transform**
- Click "Reset Transform" to restore the currently selected image (Top or Bottom) to its original position, rotation, scale, flips, slant, and keystone
  - Also restores full color by turning off Grayscale and Black & White/Invert

### Drawing Tools

#### Drawing Setup
1. Select drawing layer:
   - **Top Layer**: Draw on the top PCB image
   - **Bottom Layer**: Draw on the bottom PCB image
2. Choose "Show Both Layers" to see drawings on both layers simultaneously

#### Drawing Operations
- **Draw Tool**: Click and drag to draw lines
- **Via Tool** (<code>V</code>): Place via connections between layers
- **Pad Tool** (<code>P</code>): Place component pads (SMD and through-hole)
- **Test Point Tool** (<code>Y</code>): Place test points for circuit testing
- **Component Tool** (<code>C</code>): Place and annotate components
- **Power Tool** (<code>B</code>): Place power nodes
- **Ground Tool** (<code>G</code>): Place ground nodes
- **Eraser Tool** (<code>E</code>): Click and drag to erase drawn lines
- **Double-click Erase button**: Clear all drawings on the selected layer

#### Color and Brush Controls
- **Color Picker**: Click to open color selection dialog
- **Brush Size**: Adjust with the brush size slider
  - **Double-click the slider** to reset to default size

### Grayscale Mode
- Click "Color Mode" / "Grayscale Mode" button to toggle between color and grayscale views
- Useful for analyzing PCB traces and components
- When Black & White/Invert is active, this button reads "Color Mode" and returns to full color

### Double-Click Functionality

**Sliders**
- **Transparency Slider**: Double-click to reset to 50%
- **Brush Size Slider**: Double-click to reset to default size

**Buttons**
- **Erase Button**: Double-click to clear all drawings on the selected layer

### Keyboard Shortcuts

**Tool Selection**
- **Select** — <code>S</code>
- **Via** — <code>V</code>
- **Pad** — <code>P</code>
- **Test Point** — <code>Y</code>
- **Trace** — <code>T</code>
- **Component** — <code>C</code>
- **Power** — <code>B</code>
- **Ground** — <code>G</code>
- **Erase** — <code>E</code>
- **Move (Pan)** — <code>H</code>
- **Zoom** — <code>Z</code>
- **Center** — <code>X</code>
- **Information Dialog** — <code>Ctrl</code> + <code>I</code>
- **Component Properties** — double-click component

**Arrow Key Controls**
- **On Sliders**: Click slider first, then use ← → arrows for precise adjustment
- **In Transform Mode**: Use ↑↓←→ arrows based on selected transform operation
- **Nudge**: 1 pixel movement
- **Scale**: 1% (up/down) or 0.1% (left/right) changes
- **Rotate**: 1° (up/down) or 0.1° (left/right) changes
- **Slant**: 0.5° per arrow (vertical on ↑/↓, horizontal on ←/→)
- **Keystone**: 0.5° per arrow (vertical on ↑/↓, horizontal on ←/→)

**Reset Functions**
- **Double-click any slider**: Reset to default value
- **Double-click Erase button**: Clear selected drawing layer

## High-Contrast 32‑Color Palette

This palette is optimized for strong visual separation on PCB imagery, includes neutral grays/blacks, and is broadly color‑blind friendly. It’s arranged as an 8×4 grid to match the in‑app picker (swatches sized 22×22).

<table>
  <tr>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#000000;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#000000</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#3C3C3C;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#3C3C3C</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#7F7F7F;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#7F7F7F</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#BFBFBF;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#BFBFBF</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#0072B2;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#0072B2</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#56B4E9;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#56B4E9</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#00BFC4;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#00BFC4</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#332288;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#332288</div></td>
  </tr>
  <tr>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#1F77B4;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#1F77B4</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#A6CEE3;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#A6CEE3</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#17BECF;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#17BECF</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#6A3D9A;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#6A3D9A</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#009E73;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#009E73</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#B3DE69;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#B3DE69</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#E69F00;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#E69F00</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#F0E442;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#F0E442</div></td>
  </tr>
  <tr>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#2CA02C;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#2CA02C</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#B2DF8A;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#B2DF8A</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#BCBD22;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#BCBD22</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#FFED6F;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#FFED6F</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#E15759;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#E15759</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#D62728;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#D62728</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#FB9A99;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#FB9A99</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#CC79A7;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#CC79A7</div></td>
  </tr>
  <tr>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#AA4499;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#AA4499</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#F781BF;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#F781BF</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#9467BD;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#9467BD</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#CAB2D6;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#CAB2D6</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#9C755F;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#9C755F</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#8C564B;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#8C564B</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#FF7F0E;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#FF7F0E</div></td>
    <td align="center" style="padding:6px;"><div style="width:22px;height:22px;background:#FFFFFF;border:1px solid #999;border-radius:3px;"></div><div style="font-size:12px;">#FFFFFF</div></td>
  </tr>
</table>

### View Controls: Magnify

The Magnify tool lets you zoom into the canvas at the exact point you click. It scales the entire view (both images and drawing layers) and pans automatically so the clicked point stays under your cursor.

How to use:
- Click the "Magnify" button in the View Controls to enter magnify mode.
- Click on the canvas to zoom in by 2× at the cursor location.
- Hold Shift and click to zoom out by 0.5×.
- Double‑click the Magnify button to return to the view size and position from before you entered magnify mode.

Notes:
- All drawing and erasing actions are mapped to the zoomed view so strokes align with what you see.
- Current zoom is clamped between 0.25× and 8×.

## API Documentation

### Core Components

#### `PCBViewer`
Main component that manages the PCB viewing experience.

```typescript
interface PCBViewerProps {
  topImage?: string;
  bottomImage?: string;
  onImageLoad?: (type: 'top' | 'bottom', url: string) => void;
}
```

#### `ImageOverlay`
Handles the overlay and alignment of PCB images.

```typescript
interface ImageOverlayProps {
  topImage: string;
  bottomImage: string;
  transparency: number;
  zoom: number;
  currentView: 'top' | 'bottom';
}
```

#### `DrawingCanvas`
Manages drawing operations on the PCB layers.

```typescript
interface DrawingCanvasProps {
  layer: 'top' | 'bottom';
  brushColor: string;
  brushSize: number;
  tool: 'draw' | 'erase';
  onDrawingChange: (drawing: DrawingData) => void;
}
```

#### `ControlPanel`
Provides UI controls for all tool functions.

```typescript
interface ControlPanelProps {
  transparency: number;
  zoom: number;
  currentView: 'top' | 'bottom';
  brushColor: string;
  brushSize: number;
  tool: 'draw' | 'erase';
  onTransparencyChange: (value: number) => void;
  onZoomChange: (value: number) => void;
  onViewChange: (view: 'top' | 'bottom') => void;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (tool: 'draw' | 'erase') => void;
}
```

### Utility Functions

#### `imageUtils`
```typescript
// Scale image to fit container while maintaining aspect ratio
export const scaleImageToFit: (image: HTMLImageElement, container: { width: number; height: number }) => { width: number; height: number };

// Calculate alignment offset between two images
export const calculateAlignment: (topImage: HTMLImageElement, bottomImage: HTMLImageElement) => { x: number; y: number };
```

#### `drawingUtils`
```typescript
// Convert drawing data to canvas operations
export const renderDrawing: (canvas: HTMLCanvasElement, drawing: DrawingData) => void;

// Save drawing as image data
export const exportDrawing: (drawing: DrawingData) => string;
```

## Configuration

### Environment Variables
Create a `.env` file in the project root:

```env
# Development settings
VITE_APP_TITLE=PCB Reverse Engineering Tool
VITE_APP_VERSION=1.0.0

# Performance settings
VITE_MAX_IMAGE_SIZE=10485760  # 10MB in bytes
VITE_DEFAULT_ZOOM=100         # Default zoom percentage
```

### Build Configuration
The project uses Vite for building. Configuration can be modified in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
```

### Browser Compatibility
The tool requires modern browser features:
- Canvas API support
- File API for image uploads
- ES6+ JavaScript features
- CSS Grid and Flexbox

## Project Structure

```
PCB_reverse_engineer/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── PCBViewer.tsx   # Main viewer component
│   │   ├── ImageOverlay.tsx # Image overlay system
│   │   ├── DrawingCanvas.tsx # Drawing functionality
│   │   └── ControlPanel.tsx # UI controls
│   ├── hooks/              # Custom React hooks
│   │   ├── useImageLoader.ts
│   │   ├── useDrawing.ts
│   │   └── useZoom.ts
│   ├── utils/              # Utility functions
│   │   ├── imageUtils.ts
│   │   ├── drawingUtils.ts
│   │   └── constants.ts
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── styles/             # CSS and styling
│   │   └── globals.css
│   └── App.tsx             # Main application component
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `/docs` folder
- Review the requirements in `REQUIREMENTS.md`

---

*Last Updated: [Current Date]*
*Version: 1.0*
