// ============================================================================
// File Operations Utilities (Save/Load Project)
// ============================================================================

import type { 
  PCBImage, 
  Via, 
  DrawingStroke, 
  PCBComponent, 
  GroundSymbol,
  ProjectData,
  ViewMode 
} from '../types';
import { APP_VERSION } from '../constants';

/**
 * Format current date/time as YYYY_MM_DD-HH-mm-ss
 */
export function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}_${month}_${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Remove timestamp from filename if present
 * Handles multiple timestamp formats:
 * - Current format: _YYYY_MM_DD-HH-mm-ss (e.g., _2025_11_16-02-18-20)
 * - Old format: _YYYY_MM_DD_HH_mm_ss (e.g., _2025_11_16_02_18_20)
 * This function removes any trailing timestamp pattern(s) from the filename
 */
export function removeTimestampFromFilename(filename: string): string {
  // Remove .json extension if present
  let withoutExt = filename.replace(/\.json$/i, '');
  
  // Pattern 1: Current format with dashes: _YYYY_MM_DD-HH-mm-ss
  // Pattern 2: Old format with underscores: _YYYY_MM_DD_HH_mm_ss
  // Remove all trailing timestamps (handles multiple timestamps)
  // Keep removing until no more timestamps are found
  let previous = '';
  while (previous !== withoutExt) {
    previous = withoutExt;
    // Remove current format timestamp: _YYYY_MM_DD-HH-mm-ss
    withoutExt = withoutExt.replace(/_\d{4}_\d{2}_\d{2}-\d{2}-\d{2}-\d{2}$/, '');
    // Remove old format timestamp: _YYYY_MM_DD_HH_mm_ss
    withoutExt = withoutExt.replace(/_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}$/, '');
  }
  
  return withoutExt;
}

/**
 * Convert an image to a data URL for saving
 */
export async function imageToDataUrl(image: PCBImage): Promise<string> {
  if (image.dataUrl) return image.dataUrl;
  
  // If we have a bitmap, convert it to data URL
  if (image.bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = image.bitmap.width;
    canvas.height = image.bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image.bitmap, 0, 0);
    return canvas.toDataURL('image/png');
  }
  
  // Otherwise, fetch the original URL and convert
  if (image.url.startsWith('data:')) {
    return image.url;
  }
  
  try {
    const response = await fetch(image.url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to data URL:', error);
    return image.url;
  }
}

/**
 * Prepare project data for saving
 */
export async function prepareProjectData(
  topImage: PCBImage | null,
  bottomImage: PCBImage | null,
  vias: Via[],
  tracesTop: DrawingStroke[],
  tracesBottom: DrawingStroke[],
  componentsTop: PCBComponent[],
  componentsBottom: PCBComponent[],
  grounds: GroundSymbol[],
  currentView: ViewMode,
  transparency: number,
  viewScale: number,
  viewPanX: number,
  viewPanY: number
): Promise<ProjectData> {
  // Convert images to data URLs for persistence
  const topImageData = topImage ? {
    ...topImage,
    dataUrl: await imageToDataUrl(topImage),
    bitmap: undefined, // Don't serialize bitmap
  } : null;

  const bottomImageData = bottomImage ? {
    ...bottomImage,
    dataUrl: await imageToDataUrl(bottomImage),
    bitmap: undefined, // Don't serialize bitmap
  } : null;

  return {
    version: APP_VERSION,
    topImage: topImageData as PCBImage | null,
    bottomImage: bottomImageData as PCBImage | null,
    vias,
    tracesTop,
    tracesBottom,
    componentsTop,
    componentsBottom,
    grounds,
    viewSettings: {
      currentView,
      transparency,
      viewScale,
      viewPanX,
      viewPanY,
    },
  };
}

/**
 * Save project to file using File System Access API
 */
export async function saveProject(
  projectData: ProjectData,
  suggestedName?: string
): Promise<void> {
  try {
    const timestamp = formatTimestamp();
    const defaultName = suggestedName || `pcb_project_${timestamp}.json`;
    
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: defaultName,
      types: [{
        description: 'PCB Project Files',
        accept: { 'application/json': ['.json'] },
      }],
    });

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(projectData, null, 2));
    await writable.close();
    
    console.log('Project saved successfully');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Save cancelled by user');
    } else {
      console.error('Failed to save project:', error);
      throw error;
    }
  }
}

/**
 * Load project from file using File System Access API
 */
export async function loadProject(): Promise<ProjectData | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'PCB Project Files',
        accept: { 'application/json': ['.json'] },
      }],
      multiple: false,
    });

    const file = await handle.getFile();
    const text = await file.text();
    const projectData: ProjectData = JSON.parse(text);
    
    // Validate project data
    if (!projectData.version) {
      throw new Error('Invalid project file: missing version');
    }
    
    console.log('Project loaded successfully');
    return projectData;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Load cancelled by user');
      return null;
    } else {
      console.error('Failed to load project:', error);
      throw error;
    }
  }
}

/**
 * Restore images from project data
 * Converts data URLs back to ImageBitmap objects
 */
export async function restoreImage(imageData: PCBImage | null): Promise<PCBImage | null> {
  if (!imageData) return null;
  
  try {
    // If we have a dataUrl, create a bitmap from it
    if (imageData.dataUrl) {
      const response = await fetch(imageData.dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      
      return {
        ...imageData,
        url: imageData.dataUrl,
        bitmap,
      };
    }
    
    // Otherwise, try to load from the original URL
    if (imageData.url) {
      const response = await fetch(imageData.url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      
      return {
        ...imageData,
        bitmap,
      };
    }
    
    return imageData;
  } catch (error) {
    console.error('Failed to restore image:', error);
    return imageData;
  }
}

/**
 * Export project data as JSON string
 */
export function exportProjectAsJSON(projectData: ProjectData): string {
  return JSON.stringify(projectData, null, 2);
}

/**
 * Import project data from JSON string
 */
export function importProjectFromJSON(jsonString: string): ProjectData {
  try {
    const projectData: ProjectData = JSON.parse(jsonString);
    
    // Validate required fields
    if (!projectData.version) {
      throw new Error('Invalid project data: missing version');
    }
    
    return projectData;
  } catch (error) {
    console.error('Failed to parse project JSON:', error);
    throw new Error('Invalid project file format');
  }
}

/**
 * Load an image file and create an ImageBitmap
 */
export async function loadImageFile(file: File): Promise<{
  bitmap: ImageBitmap;
  dataUrl: string;
  width: number;
  height: number;
}> {
  try {
    // Create data URL for persistence
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    // Create bitmap for rendering
    const bitmap = await createImageBitmap(file);
    
    return {
      bitmap,
      dataUrl,
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch (error) {
    console.error('Failed to load image file:', error);
    throw new Error('Failed to load image file');
  }
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

/**
 * Fallback save using download link (for browsers without File System Access API)
 */
export function fallbackSaveProject(projectData: ProjectData, filename: string): void {
  const jsonString = exportProjectAsJSON(projectData);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fallback load using file input (for browsers without File System Access API)
 */
export function fallbackLoadProject(): Promise<ProjectData | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const text = await file.text();
        const projectData = importProjectFromJSON(text);
        resolve(projectData);
      } catch (error) {
        reject(error);
      }
    };
    
    input.oncancel = () => resolve(null);
    input.click();
  });
}

