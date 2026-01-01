/**
 * Electron File System Abstraction
 * Provides file system operations that work in both browser and Electron
 * 
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

// Type definitions for Electron API
interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  showDirectoryPicker: () => Promise<{ path: string | null; canceled: boolean }>;
  readFile: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  readFileBinary: (path: string) => Promise<{ success: boolean; data?: string; mimeType?: string; error?: string }>;
  writeFile: (path: string, data: string) => Promise<{ success: boolean; error?: string }>;
  writeFileBinary: (path: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;
  readDir: (path: string) => Promise<{ success: boolean; entries?: Array<{ name: string; isDirectory: boolean; isFile: boolean }>; error?: string }>;
  mkdir: (path: string) => Promise<{ success: boolean; error?: string }>;
  exists: (path: string) => Promise<boolean>;
  removeEntry: (path: string) => Promise<{ success: boolean; error?: string }>;
  copyFile: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>;
  moveFile: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>;
  getLastDirectory: () => Promise<string>;
  setLastDirectory: (dir: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return !!(window.electronAPI?.isElectron);
}

/**
 * Electron-compatible directory handle that mimics FileSystemDirectoryHandle
 */
export class ElectronDirectoryHandle {
  private _path: string;
  private _name: string;

  constructor(path: string) {
    this._path = path;
    this._name = path.split('/').pop() || path;
  }

  get name(): string {
    return this._name;
  }

  get path(): string {
    return this._path;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<ElectronFileHandle> {
    const filePath = `${this._path}/${name}`;
    
    if (options?.create) {
      const exists = await window.electronAPI!.exists(filePath);
      if (!exists) {
        await window.electronAPI!.writeFile(filePath, '');
      }
    }
    
    return new ElectronFileHandle(filePath, name);
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<ElectronDirectoryHandle> {
    const dirPath = `${this._path}/${name}`;
    
    if (options?.create) {
      await window.electronAPI!.mkdir(dirPath);
    }
    
    return new ElectronDirectoryHandle(dirPath);
  }

  async *entries(): AsyncGenerator<[string, ElectronFileHandle | ElectronDirectoryHandle]> {
    const result = await window.electronAPI!.readDir(this._path);
    if (result.success && result.entries) {
      for (const entry of result.entries) {
        if (entry.isDirectory) {
          yield [entry.name, new ElectronDirectoryHandle(`${this._path}/${entry.name}`)];
        } else {
          yield [entry.name, new ElectronFileHandle(`${this._path}/${entry.name}`, entry.name)];
        }
      }
    }
  }

  async *values(): AsyncGenerator<ElectronFileHandle | ElectronDirectoryHandle> {
    for await (const [, handle] of this.entries()) {
      yield handle;
    }
  }

  async *keys(): AsyncGenerator<string> {
    const result = await window.electronAPI!.readDir(this._path);
    if (result.success && result.entries) {
      for (const entry of result.entries) {
        yield entry.name;
      }
    }
  }

  async removeEntry(name: string): Promise<void> {
    const entryPath = `${this._path}/${name}`;
    const result = await window.electronAPI!.removeEntry(entryPath);
    if (!result.success) {
      throw new Error(result.error || `Failed to remove ${name}`);
    }
  }

  // For compatibility - always granted in Electron
  async requestPermission(): Promise<'granted'> {
    return 'granted';
  }

  async queryPermission(): Promise<'granted'> {
    return 'granted';
  }
}

/**
 * Electron-compatible file handle that mimics FileSystemFileHandle
 */
export class ElectronFileHandle {
  private _path: string;
  private _name: string;
  public kind: 'file' = 'file';

  constructor(path: string, name: string) {
    this._path = path;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get path(): string {
    return this._path;
  }

  async getFile(): Promise<File> {
    // Check if this is an image file
    const ext = this._name.toLowerCase().split('.').pop();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    
    if (ext && imageExtensions.includes(ext)) {
      // Use binary read for images
      const result = await window.electronAPI!.readFileBinary(this._path);
      if (result.success && result.data !== undefined) {
        // Convert base64 back to binary
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new File([bytes], this._name, { type: result.mimeType || 'application/octet-stream' });
      }
      throw new Error(result.error || 'Failed to read image file');
    } else {
      // Use text read for other files
      const result = await window.electronAPI!.readFile(this._path);
      if (result.success && result.data !== undefined) {
        return new File([result.data], this._name, { type: 'application/octet-stream' });
      }
      throw new Error(result.error || 'Failed to read file');
    }
  }

  async createWritable(): Promise<ElectronWritableStream> {
    return new ElectronWritableStream(this._path);
  }
}

/**
 * Electron-compatible writable stream
 */
export class ElectronWritableStream {
  private _path: string;
  private _data: string = '';

  constructor(path: string) {
    this._path = path;
  }

  async write(data: string | Blob | ArrayBuffer): Promise<void> {
    if (typeof data === 'string') {
      this._data += data;
    } else if (data instanceof Blob) {
      this._data += await data.text();
    } else if (data instanceof ArrayBuffer) {
      this._data += new TextDecoder().decode(data);
    }
  }

  async close(): Promise<void> {
    const result = await window.electronAPI!.writeFile(this._path, this._data);
    if (!result.success) {
      throw new Error(result.error || 'Failed to write file');
    }
  }
}

/**
 * Show directory picker - works in both browser and Electron
 */
export async function showDirectoryPicker(): Promise<FileSystemDirectoryHandle | ElectronDirectoryHandle> {
  if (isElectron()) {
    const result = await window.electronAPI!.showDirectoryPicker();
    if (result.canceled || !result.path) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }
    return new ElectronDirectoryHandle(result.path);
  } else {
    // Use browser's File System Access API
    return await (window as any).showDirectoryPicker();
  }
}

/**
 * Check if File System Access API is available
 */
export function isFileSystemAccessSupported(): boolean {
  return isElectron() || 'showDirectoryPicker' in window;
}
