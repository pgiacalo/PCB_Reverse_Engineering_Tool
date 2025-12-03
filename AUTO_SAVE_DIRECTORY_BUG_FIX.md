# Auto-Save Directory Bug Fix

## Problem Description

When opening an existing project with auto-save enabled, the application was incorrectly saving files to the wrong project's directory. For example:

1. User creates **Proj1** with auto-save enabled → files save correctly to Proj1 directory
2. User creates **Proj2** with auto-save enabled → files save correctly to Proj2 directory  
3. User opens **Proj1** → auto-save incorrectly saves Proj1 files to **Proj2's directory**

Additionally, the saved JSON files contained incorrect `projectDirectoryName` values (e.g., showing "PROJ_1" when it should show "PROJ_2").

## Root Causes Identified

### 1. `getParent()` Method Not Available
The `handle.getParent()` method is not available in all browsers. When this method was called, it threw an error: `TypeError: handle.getParent is not a function`, causing the directory handle to remain null or use a stale value from a previous project.

### 2. Base Name from File Overriding Current Project Name
When opening a project, `loadProject()` was restoring the `baseName` from the saved file. If Proj1 was last saved when it was named "PROJ_2", opening it would restore `baseName=PROJ_2` instead of using the current project name "PROJ_1".

### 3. `projectDirectoryName` Using State Instead of Ref
The `buildProjectData()` function was using `projectDirHandle` (state variable) to set `projectDirectoryName` in the JSON. Since state updates are asynchronous, this could capture a stale value from a previous project.

### 4. Directory Handle Ref Being Overwritten
The `useEffect` hook that syncs `projectDirHandleRef.current` with `projectDirHandle` state was running during async operations when opening a project. This could overwrite the explicitly set ref value with a stale state value before the state update completed.

## Solution Implemented

### 1. Browser Compatibility Check for `getParent()`
```typescript
// Check if getParent() method exists (browser support varies)
if (typeof (handle as any).getParent === 'function') {
  projectDirHandle = await (handle as any).getParent();
  console.log(`✓ Got directory handle via getParent(): "${projectDirHandle.name}"`);
} else {
  // Fallback to directory picker
  console.warn('getParent() not available. Prompting user for directory access...');
  const w = window as any;
  if (typeof w.showDirectoryPicker === 'function') {
    projectDirHandle = await w.showDirectoryPicker({
      startIn: 'documents',
    });
    console.log(`✓ Got directory handle via showDirectoryPicker(): "${projectDirHandle.name}"`);
  }
}
```

### 2. Directory Verification
Added verification to ensure the directory handle is correct by checking that the opened file actually exists in the selected directory:
```typescript
const verifyFileHandle = await projectDirHandle.getFileHandle(file.name);
const verifyFile = await verifyFileHandle.getFile();
if (verifyFile.name !== file.name) {
  throw new Error('Directory verification failed - selected directory does not contain the opened file');
}
```

### 3. Override Base Name with Current Project Name
When opening a project with auto-save enabled, the code now overrides the `baseName` from the file with the current project's name:
```typescript
// CRITICAL: Update base name to match the CURRENT project name, not the one from the file
const projectNameWithoutExt = projectNameToUse.replace(/\.json$/i, '');
const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
const cleanBaseName = projectNameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
setAutoSaveBaseName(cleanBaseName);
autoSaveBaseNameRef.current = cleanBaseName;
```

### 4. Use Ref Instead of State for `projectDirectoryName`
Changed `buildProjectData()` to use `projectDirHandleRef.current` instead of `projectDirHandle` state:
```typescript
// CRITICAL: Use projectDirHandleRef.current for auto-save to ensure we use the correct directory
// The ref is updated immediately when opening a project, while state updates are async
projectDirectoryName: projectDirHandleRef.current 
  ? projectDirHandleRef.current.name || null 
  : (projectDirHandle ? projectDirHandle.name || null : null),
```

### 5. Protection Flag to Prevent Ref Overwrite
Added `isOpeningProjectRef` flag to prevent the `useEffect` from overwriting the ref during async operations:
```typescript
const isOpeningProjectRef = useRef<boolean>(false);

// When opening project
isOpeningProjectRef.current = true;
// ... set projectDirHandleRef.current explicitly ...
setTimeout(() => {
  isOpeningProjectRef.current = false;
}, 1000);

// In useEffect
React.useEffect(() => {
  // Only sync if we're not in the middle of opening a project
  if (!isOpeningProjectRef.current) {
    projectDirHandleRef.current = projectDirHandle;
  }
}, [projectDirHandle]);
```

### 6. Force Restart Auto-Save Interval
When opening a project with auto-save enabled, the code now explicitly clears and restarts the auto-save interval:
```typescript
if (autoSaveIntervalRef.current) {
  console.log('Auto save: Clearing existing interval to restart with new directory and baseName');
  clearInterval(autoSaveIntervalRef.current);
  autoSaveIntervalRef.current = null;
}
// The useEffect will automatically recreate the interval with the new values
```

## Testing

To verify the fix:

1. Create **Proj1** with auto-save enabled
2. Create **Proj2** with auto-save enabled  
3. Open **Proj1** - verify:
   - Directory picker appears if `getParent()` not available
   - Console shows correct directory name (Proj1)
   - Console shows correct baseName (PROJ_1, not PROJ_2)
   - Auto-save saves files to Proj1 directory
   - JSON file contains `"projectDirectoryName": "PROJ_1"`

## Files Modified

- `src/App.tsx`:
  - `handleOpenProject()`: Added browser compatibility check, directory verification, baseName override
  - `buildProjectData()`: Changed to use `projectDirHandleRef.current` for `projectDirectoryName`
  - Added `isOpeningProjectRef` flag and protection logic in `useEffect`

## Key Takeaways

1. **Always check browser API availability** - Not all browsers support all File System Access API methods
2. **Use refs for synchronous access** - Refs provide immediate access, while state updates are asynchronous
3. **Verify directory handles** - Always verify that a directory handle actually contains the expected files
4. **Override restored values when needed** - Don't blindly restore values from files; use current context when appropriate
5. **Protect refs during async operations** - Use flags to prevent `useEffect` hooks from overwriting explicitly set ref values

