# Memory Leak Analysis and Fixes

## Problem Summary

After ~50 minutes of use in full-screen mode, the browser exhibits:
- Blinking/flickering in different screen regions
- Visual elements disappearing
- Browser appears overloaded (memory issues)
- Developer Console shows blank black area (possible canvas context loss)

## Root Causes Identified

### 1. **ImageBitmap Memory Leak** (CRITICAL)
**Location**: `src/App.tsx` lines 2297, 12273, and `src/utils/fileOperations.ts` line 239, 252

**Problem**: 
- `createImageBitmap()` creates ImageBitmap objects that **must be explicitly closed** with `.close()` to free memory
- The code creates ImageBitmaps but never closes them
- Each ImageBitmap can hold significant memory (full image data in GPU memory)
- Over time, these accumulate and exhaust GPU/system memory

**Impact**: HIGH - This is likely the primary cause of the memory issues

**Fix Required**:
- Close ImageBitmaps when images are replaced or project is closed
- Store ImageBitmap references and close them in cleanup functions

### 2. **Canvas Element Leak in Keystone Warping** (CRITICAL)
**Location**: `src/App.tsx` lines 5118-5169 (`drawImageWithKeystone` function)

**Problem**:
- Every time `drawCanvas()` is called, it creates new canvas elements:
  - `base` canvas (line 5118)
  - `temp` canvas (line 5133) - if keystoneV is applied
  - `temp2` canvas (line 5154) - if keystoneH is applied
- These canvas elements are never explicitly cleaned up
- `drawCanvas()` is called frequently (on every state change: drawingStrokes, components, canvasSize, etc.)
- Over 50 minutes, this could create thousands of canvas elements

**Impact**: HIGH - Creates many DOM elements and canvas contexts that consume memory

**Fix Required**:
- Reuse canvas elements or explicitly clean them up
- Consider caching keystone-warped images if keystone values don't change frequently
- Use `OffscreenCanvas` instead of DOM canvas elements where possible

### 3. **Object URL Leak** (MEDIUM)
**Location**: `src/App.tsx` lines 2298, 12274

**Problem**:
- `URL.createObjectURL()` creates blob URLs that must be revoked with `URL.revokeObjectURL()`
- Object URLs are created for images but only revoked in some export functions
- Image loading creates URLs that are never revoked

**Impact**: MEDIUM - Each URL holds a reference to the blob in memory

**Fix Required**:
- Revoke object URLs when images are replaced or project is closed
- Store URL references and revoke them in cleanup

### 4. **Frequent Event Listener Re-registration** (LOW-MEDIUM)
**Location**: `src/App.tsx` lines 8411-8427

**Problem**:
- The `handleKeyDown` effect has a massive dependency array (27+ dependencies)
- Every time any of these dependencies change, the event listeners are removed and re-added
- This could happen frequently during normal use

**Impact**: LOW-MEDIUM - Not a memory leak per se, but inefficient and could contribute to performance issues

**Fix Required**:
- Use refs for values that don't need to trigger re-registration
- Reduce dependency array size by using refs for frequently-changing values

### 5. **Canvas Context Loss** (SYMPTOM, not cause)
**Location**: Developer Console black area

**Problem**:
- When memory pressure is high, browsers may lose canvas contexts
- This is a symptom of the memory leaks above, not a separate issue

**Impact**: SYMPTOM - Indicates severe memory pressure

**Fix Required**:
- Fixing the above leaks should resolve this

## Proposed Fixes

### Fix 1: ImageBitmap Cleanup
1. Store ImageBitmap references in state/refs
2. Close ImageBitmaps when:
   - New image is loaded (close old one first)
   - Project is closed
   - Image is removed
3. Add cleanup in `closeProject` function

### Fix 2: Canvas Element Reuse/Cleanup
1. **Option A (Recommended)**: Cache keystone-warped images
   - Only re-warp when keystone values change
   - Store warped result and reuse it
   - Clean up cache when keystone changes or project closes

2. **Option B**: Reuse canvas elements
   - Create canvas elements once and reuse them
   - Clear and resize as needed

3. **Option C**: Use OffscreenCanvas
   - Use `OffscreenCanvas` instead of DOM canvas elements
   - Better memory management

### Fix 3: Object URL Cleanup
1. Store object URL references
2. Revoke URLs when:
   - New image is loaded (revoke old one first)
   - Project is closed
   - Image is removed

### Fix 4: Optimize Event Listeners
1. Use refs for frequently-changing values in `handleKeyDown`
2. Reduce dependency array size
3. Only re-register when truly necessary

## Implementation Priority

1. **PRIORITY 1**: Fix ImageBitmap cleanup (highest impact) ✅ **COMPLETED**
2. **PRIORITY 2**: Fix canvas element leak in keystone warping ✅ **COMPLETED** (only helps if keystone is used)
3. **PRIORITY 3**: Fix object URL cleanup ✅ **COMPLETED**
4. **PRIORITY 4**: Optimize event listeners (performance improvement) - **DEFERRED** (lower priority)

## Additional Findings

### ImageData Leak in Filters (FIXED)
**Location**: `src/utils/canvas.ts` `drawTransformedImage` function

**Problem**: 
- When grayscale or edge detection filters are enabled, `getImageData()` creates ImageData objects
- However, this function is NOT currently used in the main drawing code
- The grayscale filter is applied using CSS filters (`ctx.filter = 'grayscale(100%)'`) instead
- **Status**: Fixed with caching, but function not in active use

### Impact Assessment for User's Use Case

The user reported:
- Problem occurred long after image transformations were finished
- Did NOT use keystone or slant tools
- Was using: tools, drawing objects, zooming, AI features, via/pad pattern tools

**Fixes that apply to user's use case:**
1. ✅ **ImageBitmap cleanup** - CRITICAL - Images are loaded even if not transformed, so this fix applies
2. ✅ **Object URL cleanup** - CRITICAL - Images create Object URLs when loaded, so this fix applies
3. ⚠️ **Keystone cache** - Only helps if keystone is used (user didn't use it)

**Conclusion**: The ImageBitmap and Object URL cleanup fixes are the most critical and apply regardless of which tools are used. These should resolve the memory issues the user experienced.

## Testing Recommendations

1. Monitor memory usage in Chrome DevTools Performance/Memory profiler
2. Test with large images (high-resolution PCB photos)
3. Test extended sessions (1+ hours)
4. Test rapid state changes (drawing, component placement)
5. Verify cleanup when closing/reopening projects

## Additional Considerations

- **Canvas size**: Large canvas elements consume more memory
- **Image resolution**: High-resolution images consume significant memory
- **Browser limits**: Different browsers have different memory limits
- **GPU memory**: ImageBitmaps use GPU memory, which may be limited
