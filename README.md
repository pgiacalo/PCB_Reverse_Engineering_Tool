# PCB Reverse Engineering Tool

A browser-based photo editing tool designed to aid in the reverse engineering of 2-sided printed circuit boards (PCBs). This tool allows engineers and hobbyists to load top and bottom PCB photos, overlay them with precise alignment, and add annotations to facilitate the reverse engineering process.

## Project Description

This PCB Reverse Engineering Tool solves the challenge of analyzing 2-sided PCBs by providing a digital workspace where images of both sides can be viewed simultaneously with variable transparency. The tool includes image alignment tools, variable transparency levels, and drawing layers to help identify components, trace connections, and document findings during the reverse engineering process.

## Installation Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm (version 8 or higher)
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)

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
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the URL shown in your terminal)

## Live Demo

🌐 **Try the tool online**: [https://pgiacalo.github.io/PCB_reverse_engineer](https://pgiacalo.github.io/PCB_reverse_engineer)

The application is hosted on GitHub Pages and available globally. No installation required - just open the link in your browser!

## Publishing to GitHub Pages

### Automatic Deployment (Recommended)

The project is configured for automatic deployment to GitHub Pages using GitHub Actions. Here's how to set it up:

#### Step 1: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **GitHub Actions**

#### Step 2: Push Your Code
```bash
# Add all files to git
git add .

# Commit your changes
git commit -m "Initial commit with GitHub Pages setup"

# Push to GitHub
git push origin main
```

#### Step 3: Automatic Deployment
- GitHub Actions will automatically build and deploy your app
- Check the **Actions** tab in your repository to monitor deployment
- Your app will be available at: `https://[your-username].github.io/PCB_reverse_engineer`

### Manual Deployment

If you prefer manual deployment:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages**
   ```bash
   # Install gh-pages package
   npm install --save-dev gh-pages
   
   # Add deploy script to package.json
   # "deploy": "gh-pages -d dist"
   
   # Deploy
   npm run deploy
   ```

### Custom Domain (Optional)

To use a custom domain:

1. Create a `CNAME` file in the `public` folder with your domain name
2. Configure your domain's DNS to point to GitHub Pages
3. Enable custom domain in GitHub Pages settings

### Production Build
To create a production build:
```bash
npm run build
npm run preview
```

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

**Reset Transform**
- Click "Reset Transform" to restore both images to original position, scale, and rotation

### Drawing Tools

#### Drawing Setup
1. Select drawing layer:
   - **Top Layer**: Draw on the top PCB image
   - **Bottom Layer**: Draw on the bottom PCB image
2. Choose "Show Both Layers" to see drawings on both layers simultaneously

#### Drawing Operations
- **Draw Tool**: Click and drag to draw lines
- **Eraser Tool**: Click and drag to erase drawn lines
- **Double-click Erase button**: Clear all drawings on the selected layer

#### Color and Brush Controls
- **Color Picker**: Click to open color selection dialog
- **Brush Size**: Adjust with the brush size slider
  - **Double-click the slider** to reset to default size

### Grayscale Mode
- Click "Color Mode" / "Grayscale Mode" button to toggle between color and grayscale views
- Useful for analyzing PCB traces and components

### Double-Click Functionality

**Sliders**
- **Transparency Slider**: Double-click to reset to 50%
- **Brush Size Slider**: Double-click to reset to default size

**Buttons**
- **Erase Button**: Double-click to clear all drawings on the selected layer

### Keyboard Shortcuts

**Arrow Key Controls**
- **On Sliders**: Click slider first, then use ← → arrows for precise adjustment
- **In Transform Mode**: Use ↑↓←→ arrows based on selected transform operation
- **Nudge**: 1 pixel movement
- **Scale**: 1% (up/down) or 0.1% (left/right) changes
- **Rotate**: 1° (up/down) or 0.1° (left/right) changes

**Reset Functions**
- **Double-click any slider**: Reset to default value
- **Double-click Erase button**: Clear selected drawing layer

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