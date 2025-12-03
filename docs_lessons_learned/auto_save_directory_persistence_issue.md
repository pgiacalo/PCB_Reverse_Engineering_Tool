# Lessons Learned: Auto-Save Directory Persistence Issue

## Problem Statement

When opening an existing project with auto-save enabled, the application was incorrectly saving files to the wrong project's directory. This caused data integrity issues where project files were being saved to incorrect locations, potentially overwriting or mixing files from different projects.

### Example Scenario
1. User creates **Proj1** with auto-save enabled → files save correctly to Proj1 directory
2. User creates **Proj2** with auto-save enabled → files save correctly to Proj2 directory  
3. User opens **Proj1** → auto-save incorrectly saves Proj1 files to **Proj2's directory**

Additionally, saved JSON files contained incorrect `projectDirectoryName` values, indicating the wrong directory context was being persisted.

## Root Causes

### 1. Browser API Compatibility Issue
**Problem:** The `handle.getParent()` method is not available in all browsers. When called, it threw `TypeError: handle.getParent is not a function`, causing the directory handle to remain null or use a stale value from a previous project.

**Lesson:** Always check for browser API availability before using methods that may not be universally supported. The File System Access API is still evolving and browser support varies.

### 2. State vs. Ref Timing Issue
**Problem:** The `buildProjectData()` function was using `projectDirHandle` (state variable) to set `projectDirectoryName` in the JSON. Since React state updates are asynchronous, this could capture a stale value from a previous project before the new state was applied.

**Lesson:** When you need synchronous, immediate access to values (especially in callbacks or async operations), use refs instead of state. Refs provide immediate access while state updates are batched and asynchronous.

### 3. Restored Values Overriding Current Context
**Problem:** When opening a project, `loadProject()` was restoring the `baseName` from the saved file. If a project was last saved with a different name (e.g., "PROJ_2"), opening it would restore that old `baseName` instead of using the current project name (e.g., "PROJ_1").

**Lesson:** Don't blindly restore all values from persisted files. Some values should be derived from the current context rather than restored from the file. Always consider whether a restored value makes sense in the current context.

### 4. Ref Overwrite During Async Operations
**Problem:** A `useEffect` hook was syncing `projectDirHandleRef.current` with `projectDirHandle` state on every state change. When opening a project, this `useEffect` could run during async operations and overwrite the explicitly set ref value with a stale state value before the state update completed.

**Lesson:** When explicitly setting refs during async operations, protect them from being overwritten by `useEffect` hooks. Use flags or guards to prevent unintended overwrites during critical operations.

## Solution Implemented

### 1. Browser Compatibility Check with Fallback
```typescript
// Check if getParent() method exists (browser support varies)
if (typeof (handle as any).getParent === 'function') {
  projectDirHandle = await (handle as any).getParent();
} else {
  // Fallback to directory picker
  console.warn('getParent() not available. Prompting user for directory access...');
  projectDirHandle = await window.showDirectoryPicker({
    startIn: 'documents',
  });
}
```

**Key Points:**
- Always check for method availability before calling
- Provide a user-friendly fallback (directory picker)
- User interaction ensures proper permissions are granted

### 2. Directory Verification
```typescript
// Verify the directory handle is correct
const verifyFileHandle = await projectDirHandle.getFileHandle(file.name);
const verifyFile = await verifyFileHandle.getFile();
if (verifyFile.name !== file.name) {
  throw new Error('Directory verification failed');
}
```

**Key Points:**
- Always verify directory handles are correct before using them
- Don't trust that a handle points to the expected location
- Fail fast if verification fails

### 3. Use Refs for Synchronous Access
```typescript
// In buildProjectData() - use ref instead of state
projectDirectoryName: projectDirHandleRef.current 
  ? projectDirHandleRef.current.name || null 
  : (projectDirHandle ? projectDirHandle.name || null : null),
```

**Key Points:**
- Use refs when you need immediate, synchronous access
- Refs are updated immediately, state updates are async
- Fallback to state only if ref is not available

### 4. Override Restored Values with Current Context
```typescript
// Override baseName from file with current project name
const projectNameWithoutExt = projectNameToUse.replace(/\.json$/i, '');
const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
const cleanBaseName = projectNameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
setAutoSaveBaseName(cleanBaseName);
autoSaveBaseNameRef.current = cleanBaseName;
```

**Key Points:**
- Derive values from current context when appropriate
- Don't restore values that should reflect current state
- Update both state and refs for consistency

### 5. Protection Flag for Ref Updates
```typescript
const isOpeningProjectRef = useRef<boolean>(false);

// When opening project
isOpeningProjectRef.current = true;
// ... set refs explicitly ...
setTimeout(() => {
  isOpeningProjectRef.current = false;
}, 1000);

// In useEffect
React.useEffect(() => {
  if (!isOpeningProjectRef.current) {
    projectDirHandleRef.current = projectDirHandle;
  }
}, [projectDirHandle]);
```

**Key Points:**
- Use flags to protect refs during critical operations
- Clear flags after operations complete
- Prevents race conditions between explicit ref sets and useEffect syncs

## Key Takeaways

### 1. Browser API Compatibility
- **Always check for method availability** before using browser APIs
- **Provide fallbacks** for unsupported methods
- **Test across browsers** to ensure compatibility

### 2. State vs. Refs
- **Use state** for values that trigger re-renders and UI updates
- **Use refs** for values needed synchronously in callbacks or async operations
- **Don't mix them** - be explicit about which one to use and why

### 3. Persistence Strategy
- **Don't blindly restore** all values from persisted files
- **Consider context** - some values should be derived from current state
- **Verify restored values** make sense in the current context

### 4. Async Operations and Refs
- **Protect refs** during async operations that explicitly set them
- **Use flags or guards** to prevent unintended overwrites
- **Clear protection** after operations complete

### 5. Verification and Validation
- **Always verify** directory handles point to expected locations
- **Fail fast** if verification fails
- **Don't assume** handles are correct just because they were obtained

## Prevention Strategies

1. **Code Reviews:** Look for state/ref usage patterns and ensure they're appropriate
2. **Testing:** Test project switching scenarios thoroughly
3. **Documentation:** Document when to use state vs. refs
4. **Type Safety:** Use TypeScript to catch potential issues
5. **Logging:** Keep essential error/warning logs, remove verbose debug logs for production

## Related Files

- `src/App.tsx`: Main implementation
- `AUTO_SAVE_DIRECTORY_BUG_FIX.md`: Detailed technical documentation

## Date

December 2024

