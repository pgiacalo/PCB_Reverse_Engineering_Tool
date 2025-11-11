# Technology Stack - PCB Reverse Engineering Tool

## Overview
This is a **browser-based, single-page application (SPA)** for reverse engineering PCB boards from photographs. It runs entirely in the browser with no backend server required.

---

## Core Technologies

### 1. **React 19.1.1** - UI Framework
- **What it is**: Modern JavaScript library for building user interfaces
- **Why we use it**: 
  - Component-based architecture for modular, reusable UI
  - Efficient DOM updates via Virtual DOM
  - Rich ecosystem and excellent developer experience
  - Hooks for state management and side effects
- **Key features used**:
  - `useState` - Component state management
  - `useRef` - Direct DOM/Canvas access and mutable values
  - `useEffect` - Side effects (canvas rendering, event listeners)
  - `useCallback` - Memoized callbacks for performance

### 2. **TypeScript 5.9.3** - Programming Language
- **What it is**: Typed superset of JavaScript
- **Why we use it**:
  - Type safety catches bugs at compile time
  - Better IDE support (autocomplete, refactoring)
  - Self-documenting code via type definitions
  - Easier to maintain large codebases
- **Key features used**:
  - Interfaces for data structures (PCBComponent, Via, Trace, etc.)
  - Type guards for runtime type checking
  - Generics for reusable utility functions
  - Strict null checks

### 3. **Vite 7.1.7** - Build Tool & Dev Server
- **What it is**: Next-generation frontend build tool
- **Why we use it**:
  - ⚡ Lightning-fast hot module replacement (HMR)
  - Optimized production builds
  - Native ES modules support
  - Simple configuration
- **Features**:
  - Dev server with instant updates
  - TypeScript compilation
  - CSS processing
  - Production bundling and minification

---

## Browser APIs (Native Web Technologies)

### 4. **HTML5 Canvas API** - Graphics Rendering
- **What it is**: Native browser API for 2D graphics
- **Why we use it**: 
  - Hardware-accelerated rendering
  - Pixel-perfect drawing control
  - No external dependencies
  - Excellent performance
- **Key features used**:
  - `CanvasRenderingContext2D` - 2D drawing operations
  - `ImageBitmap` - Efficient image handling
  - `ImageData` - Pixel-level manipulation
  - `OffscreenCanvas` - Off-main-thread rendering
  - Transformations (translate, scale, rotate, transform matrix)
  - Path drawing (lines, circles, arcs)
  - Clipping and compositing

### 5. **File System Access API** - File Operations
- **What it is**: Modern browser API for file system interaction
- **Why we use it**:
  - Native file picker dialogs
  - Save files with suggested names
  - Better user experience than traditional file inputs
- **Features used**:
  - `showOpenFilePicker()` - Open project files
  - `showSaveFilePicker()` - Save project with custom filename
  - Fallback to traditional `<input type="file">` for older browsers

### 6. **Web Workers API** - Background Processing
- **What it is**: JavaScript threads for heavy computation
- **Why we use it**:
  - Keeps UI responsive during intensive tasks
  - Parallel processing
  - No blocking of main thread
- **Workers in use**:
  - `cvWorker.ts` - Computer vision processing (planned)
  - `skeletonize.ts` - Image skeletonization algorithms

### 7. **Drag and Drop API** - File Upload
- **What it is**: Native browser drag-and-drop support
- **Why we use it**: Intuitive file loading UX

### 8. **Local Storage API** - Persistent State
- **What it is**: Browser storage for key-value pairs
- **Why we use it**: Save user preferences and recent projects

---

## UI Libraries & Components

### 9. **Lucide React 0.545.0** - Icon Library
- **What it is**: Beautiful, consistent SVG icon set
- **Why we use it**:
  - 1000+ icons with consistent design
  - Tree-shakeable (only imports used icons)
  - React components (easy integration)
- **Icons used**:
  - `MousePointer` - Select tool
  - `Circle` - Via tool
  - `PenLine` - Trace tool
  - `Cpu` - Component tool
  - `Hand` - Pan/Move tool
  - `ZoomIn`/`ZoomOut` - Magnify tool
  - `Droplet` - Ground/Power symbols
  - `Eraser` - Erase tool
  - `Palette` - Color picker
  - And more...

### 10. **React Colorful 5.6.1** - Color Picker
- **What it is**: Lightweight color picker component
- **Why we use it**:
  - Small bundle size (~3KB)
  - Touch-friendly
  - Accessible
  - No dependencies
- **Features used**:
  - HSV color space
  - Hex color output
  - Custom color palettes (VGA, ZX Spectrum Next, 32-color)

---

## CSS Technologies

### 11. **CSS3** - Styling
- **Features used**:
  - **Flexbox** - Layout system for toolbars and panels
  - **Grid** - Button layouts
  - **CSS Variables** - Theming (planned)
  - **Backdrop Filter** - Frosted glass effects
  - **Gradients** - Background styling
  - **Transitions & Animations** - Smooth UI interactions
  - **Media Queries** - Responsive design
  - **Box Shadow** - Depth and elevation
  - **Border Radius** - Rounded corners

---

## Development Tools

### 12. **ESLint 9.36.0** - Code Linting
- **What it is**: JavaScript/TypeScript linter
- **Why we use it**: Catch errors, enforce code style
- **Plugins**:
  - `eslint-plugin-react-hooks` - React Hooks rules
  - `eslint-plugin-react-refresh` - Fast Refresh compatibility

### 13. **GitHub Pages** - Hosting
- **What it is**: Free static site hosting
- **Why we use it**:
  - Free hosting for open source
  - Automatic HTTPS
  - CDN distribution
  - Easy deployment via `gh-pages` package

---

## Key Algorithms & Techniques

### 14. **Computer Graphics Algorithms**
- **Coordinate Transformations**:
  - Screen ↔ Canvas ↔ World coordinate systems
  - Affine transformations (translate, scale, rotate, skew)
  - Perspective transformations (keystone correction)
  - Device Pixel Ratio (DPR) handling for Retina displays

- **Drawing Algorithms**:
  - Line drawing with snapping
  - Circle/arc rendering for vias
  - Polyline/polygon rendering for traces
  - Hit-testing (point-in-circle, point-to-segment distance)
  - Bounding box calculations
  - Marquee selection (rectangle intersection)

- **Image Processing**:
  - Grayscale conversion
  - Edge detection (Sobel operator)
  - Image inversion
  - Alpha blending for overlay mode
  - Image skeletonization (planned)

### 15. **Data Structures**
- **Spatial Data**:
  - Point lists for traces
  - Circle definitions for vias
  - Component hierarchies
  - Layer-based organization
  
- **State Management**:
  - Undo/Redo stacks
  - Transform state per image
  - Selection sets
  - Drawing mode state machines

### 16. **File Formats**
- **JSON** - Project save/load format
  - Stores all drawing data
  - Embeds images as base64 data URLs
  - Human-readable for debugging
  
- **KiCad Netlist** (planned output)
  - Industry-standard format
  - Enables schematic generation via `nl2sch`

---

## Architecture Patterns

### 17. **Component Architecture**
```
App.tsx (Main container)
├── MenuBar (File, View, Transform, Tools)
├── Toolbar (Left icon toolbar)
├── LayersPanel (Layer visibility & thumbnails)
├── Canvas (Main drawing area)
│   ├── Background images (Top/Bottom PCB)
│   ├── Drawing layers (Vias, Traces, Components, Ground, Power)
│   └── Selection overlay
└── Dialogs (Component properties, voltage settings)
```

### 18. **State Management Pattern**
- **Local Component State** (`useState`)
  - UI state (current tool, selected layer, etc.)
  - Drawing state (strokes, vias, components)
  - View state (pan, zoom, transparency)
  - Transform state per image

- **Refs** (`useRef`)
  - Canvas element reference
  - File input references
  - Animation frame IDs
  - Previous state for comparisons

### 19. **Event-Driven Architecture**
- **Mouse Events**: Drawing, panning, selection
- **Keyboard Events**: Shortcuts, modifiers (Shift, Cmd/Ctrl)
- **File Events**: Image/project loading
- **Resize Events**: Responsive canvas sizing

---

## Performance Optimizations

### 20. **Rendering Optimizations**
- **ImageBitmap** - Faster than HTMLImageElement
- **OffscreenCanvas** - Background processing
- **RequestAnimationFrame** - Smooth animations
- **Memoization** - Prevent unnecessary re-renders
- **Debouncing** - Throttle expensive operations
- **Layer Caching** - Redraw only changed layers

### 21. **Memory Management**
- **Object Pooling** - Reuse objects where possible
- **Garbage Collection Awareness** - Minimize allocations in hot paths
- **Image Disposal** - Clean up ImageBitmap resources

---

## Browser Compatibility

### Minimum Requirements:
- **Chrome/Edge**: 86+ (File System Access API)
- **Firefox**: 90+ (most features, File System Access via polyfill)
- **Safari**: 14+ (most features, File System Access via polyfill)

### Progressive Enhancement:
- Falls back to `<input type="file">` if File System Access API unavailable
- Graceful degradation for older browsers

---

## Future Technologies (Planned)

### 22. **Computer Vision (OpenCV.js or TensorFlow.js)**
- Automatic trace detection
- Component recognition
- Via detection
- Text extraction (OCR)

### 23. **WebAssembly (WASM)**
- High-performance image processing
- Complex algorithms (skeletonization, pathfinding)

### 24. **IndexedDB**
- Store large projects locally
- Offline support
- Project history

---

## Summary

### **Core Stack**:
✅ **React 19** - UI framework  
✅ **TypeScript 5** - Type-safe JavaScript  
✅ **Vite 7** - Build tool  
✅ **HTML5 Canvas** - Graphics rendering  
✅ **Native Browser APIs** - File system, workers, storage  

### **Why This Stack?**:
1. **Zero Backend** - Runs entirely in browser
2. **Fast Development** - Vite HMR, React dev tools
3. **Type Safety** - TypeScript catches bugs early
4. **Performance** - Canvas API, Web Workers, ImageBitmap
5. **Modern UX** - Native file dialogs, drag-and-drop
6. **Free Hosting** - GitHub Pages
7. **Cross-Platform** - Works on Windows, Mac, Linux
8. **Maintainable** - Component-based, typed, modular

### **Key Strengths**:
- 🚀 **Fast** - Vite dev server, optimized rendering
- 🎨 **Powerful** - Full Canvas API, image processing
- 📦 **Lightweight** - Minimal dependencies (~50KB total)
- 🔧 **Maintainable** - TypeScript, modular architecture
- 🌐 **Accessible** - No installation, works in browser
- 💰 **Free** - All open-source technologies

---

## Learning Resources

### For React:
- [React Official Docs](https://react.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### For Canvas:
- [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [HTML5 Canvas Deep Dive](https://joshondesign.com/p/books/canvasdeepdive/toc.html)

### For TypeScript:
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### For Vite:
- [Vite Guide](https://vite.dev/guide/)

---

**This stack provides a powerful, modern foundation for building complex graphics applications entirely in the browser!** 🎉

