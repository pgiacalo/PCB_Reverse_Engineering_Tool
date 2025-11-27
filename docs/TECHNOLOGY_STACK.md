# Technology Stack

## Overview

The PCB Reverse Engineering Tool is a modern browser-based single-page application (SPA) that enables users to reverse engineer printed circuit boards by tracing connections, placing components, and generating KiCad-compatible netlists. The application runs entirely client-side in the browser, leveraging modern web technologies to provide a responsive, interactive drawing experience with no backend server requirements.

This document outlines the core technologies, frameworks, and tools used to build and deploy the application.

## Core Technologies

### **Frontend Framework**
- **React 19.1.1** - Modern UI framework using functional components and hooks for state management
- **React DOM 19.1.1** - React rendering engine for the browser

### **Build & Development Tools**
- **Vite 7.1.7** - Fast build tool and development server with hot module replacement (HMR)
- **TypeScript 5.9.3** - Type-safe JavaScript for improved code quality and developer experience

### **UI Components & Libraries**
- **lucide-react** - Comprehensive icon library for React components
- **react-colorful** - Lightweight color picker component for selecting trace/component colors

### **Graphics & Rendering**
- **HTML5 Canvas API** - Native browser canvas for drawing PCB elements (traces, pads, vias, components)
  - Custom rendering engine for high-precision coordinate-based drawing
  - Zoom and pan functionality with sub-pixel precision
  - Layer-based rendering system

### **Background Processing**
- **Web Workers API** - Off-main-thread processing for image analysis
  - `cvWorker.ts` - Computer vision operations for image processing
  - `skeletonize.ts` - Trace skeletonization algorithms

### **Utilities & Export**
- **jsPDF 3.0.4** - Client-side PDF generation for exporting project documentation

### **Code Quality & Linting**
- **ESLint 9.36.0** - JavaScript/TypeScript linting and code quality enforcement
- **TypeScript ESLint** - TypeScript-specific linting rules and type checking
- **ESLint React Plugins** - React-specific linting rules (hooks, refresh)

### **Deployment**
- **GitHub Pages** - Static site hosting via `gh-pages` package
  - Automated deployment workflow
  - Base path configuration for GitHub Pages subdirectory

## Architecture Pattern

### **Single Page Application (SPA)**
- Pure client-side application with no backend server
- All processing occurs in the browser
- Project data stored in browser localStorage
- File-based import/export for project persistence

### **Component-Based Architecture**
- React functional components with hooks
- Custom hooks for state management and business logic:
  - `useDrawing` - Drawing operations and stroke management
  - `useSelection` - Selection state and operations
  - `useTransform` - Transform operations (move, rotate, scale)
  - `useImage` - Image loading and management
  - `useView` - Viewport and camera controls
  - `useComponents` - Component management
  - `usePowerGround` - Power and ground node management
  - `useLayerSettings` - Layer visibility and settings
  - `useToolRegistry` - Tool state and settings persistence
  - `useLocks` - Lock state management
  - `useDialogs` - Dialog state management
  - `useFileOperations` - File save/load operations
  - `usePCBConnectivity` - Netlist and connectivity analysis

### **State Management**
- React hooks (`useState`, `useRef`, `useCallback`, `useMemo`, `useEffect`)
- Custom hooks for domain-specific state
- LocalStorage for tool settings persistence
- Project file format (JSON) for complete project state

## Development Workflow

### **Scripts**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint code quality checks
- `npm run preview` - Preview production build locally
- `npm run deploy` - Deploy to GitHub Pages

### **Configuration**
- **Vite Config** (`vite.config.ts`) - Build configuration with React plugin
- **TypeScript Config** - Separate configs for app and node environments
- **ESLint Config** - Modern flat config format with TypeScript and React rules

## Browser Compatibility

The application uses modern web APIs and requires a browser that supports:
- ES6+ JavaScript features
- HTML5 Canvas API
- Web Workers API
- LocalStorage API
- File API (FileReader)
- Modern CSS features

Recommended browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Project Structure

```
src/
├── components/     # React UI components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions and algorithms
├── types/          # TypeScript type definitions
├── constants/      # Application constants
├── handlers/      # Event handlers
└── workers/        # Web Worker scripts
```

## Key Features Enabled by Technology Choices

1. **High-Performance Drawing** - Canvas API provides efficient 2D rendering for complex PCB layouts
2. **Type Safety** - TypeScript catches errors at compile time and improves maintainability
3. **Fast Development** - Vite's HMR enables instant feedback during development
4. **Offline Capability** - Pure client-side architecture works without internet connection
5. **Portable Projects** - JSON-based project files can be shared and version controlled
6. **Responsive UI** - React's component model enables modular, maintainable UI code

---

**Last Updated**: January 2025  
**React Version**: 19.1.1  
**Vite Version**: 7.1.7  
**TypeScript Version**: 5.9.3

