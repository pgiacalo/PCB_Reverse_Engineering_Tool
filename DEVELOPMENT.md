# Development Guide

This guide is for developers who want to build, modify, or contribute to the PCB Reverse Engineering Tool.

## Prerequisites

- Node.js (version 16 or higher)
- npm (version 8 or higher)
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)

## Project Dependencies

- **Runtime**: `react`, `react-dom`, `react-colorful`, `lucide-react`
- **Dev**: `vite`, `typescript`, ESLint tooling, `gh-pages` (for manual Pages deploy)

## Installation

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

## AI API Key Configuration (Development)

For AI-powered pin name extraction from datasheets, you can configure the API key:

1. Open any Integrated Circuit component's properties
2. Go to File → AI Settings (or the API key dialog will appear when you try to extract datasheet information)
3. Enter your Google Gemini API key and click "Save API Key"
4. The key is stored in your browser's sessionStorage (secure, not exposed in code or build)

Get your free API key from: https://aistudio.google.com/apikey

**How API Keys Work:**
- **API Key Storage**: The Gemini API key is stored in browser `sessionStorage`, which means:
  - The key is automatically cleared when you close the browser tab or window
  - You'll need to re-enter your API key each time you start a new session
  - This provides better security than persistent storage
- **Model Preference**: Your selected Gemini model is stored in `localStorage` and persists across sessions
- **Security**: API keys are never bundled into the build or exposed in the application code
- Environment variables are NOT used to prevent API keys from being exposed in production builds
- Never commit API keys to the repository

## Deployment to GitHub Pages

See the GitHub Pages guide: [README_FOR_GITHUB_PAGES.md](docs/setup/README_FOR_GITHUB_PAGES.md)

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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For development support and questions:
- Create an issue in the repository
- Check the documentation in the `/docs` folder
- Review the requirements in `docs/REQUIREMENTS.md`

---

*Last Updated: [Current Date]*
*Version: 3.0*

