# PCB Reverse Engineering Tool

A web-based photo editing tool designed to aid in the reverse engineering of 2-sided printed circuit boards (PCBs). This tool allows engineers and hobbyists to load top and bottom PCB photos, overlay them with precise alignment, and add annotations to facilitate the reverse engineering process.

## Project Description

The PCB Reverse Engineering Tool solves the challenge of analyzing complex 2-sided PCBs by providing a digital workspace where both sides can be viewed simultaneously with variable transparency. The tool includes drawing capabilities, zoom controls, and layer management to help identify components, trace connections, and document findings during the reverse engineering process.

## Installation Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm (version 8 or higher)
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)

### Step-by-Step Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd PCB_reverse_engineer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the URL shown in your terminal)

### Production Build
To create a production build:
```bash
npm run build
npm run preview
```

## Usage Examples

### Basic Workflow

1. **Load PCB Images**
   ```typescript
   // Click "Load Top PCB" and "Load Bottom PCB" buttons
   // Select your PCB photos from your device
   ```

2. **Align and Scale Images**
   ```typescript
   // Use the alignment tools to match the physical PCB dimensions
   // Adjust scale to match actual PCB size
   ```

3. **Switch Between Views**
   ```typescript
   // Toggle between "Top View" and "Bottom View" buttons
   // Use transparency slider to see through layers
   ```

4. **Add Annotations**
   ```typescript
   // Select drawing tool and choose color
   // Draw directly on the PCB images
   // Use eraser to remove annotations
   ```

### Advanced Features

**Transparency Control**
- Adjust bottom layer transparency (0-100%)
- See component connections through layers
- Maintain drawing visibility

**Drawing Tools**
- Multiple colors with color picker
- Adjustable brush sizes
- Draw on both top and bottom layers
- Eraser with configurable size

**Image Transform Controls**
- **Move**: Click and drag to reposition images
- **Scale**: Resize images from 0.1x to 3x
- **Rotate**: Rotate images from -180° to +180°
- **Flip X/Y**: Flip images horizontally or vertically to correct orientation
- **Nudge**: Use arrow keys for pixel-perfect positioning

**Keyboard Controls**
- **Arrow Keys on Sliders**: Use ← → arrows to adjust slider values precisely
- **Arrow Keys in Transform Mode**: Use ↑↓←→ to nudge selected image pixel by pixel
- **Double-Click Reset**: Double-click any slider to reset to default value
- **Slider Focus**: Click on a slider first, then use arrow keys for fine control

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