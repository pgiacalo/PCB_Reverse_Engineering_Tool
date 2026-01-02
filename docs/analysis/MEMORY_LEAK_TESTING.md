# Memory Leak Testing Guide

## Built-in Memory Monitor

The application now includes a built-in memory monitor that displays memory usage below the canvas, to the left of the x,y coordinates display.

**Features:**
- Updates automatically every 1 minute
- Shows: "Mem: X.XMB / YYYMB" (used memory / heap limit)
- Easy to disable: Set `ENABLE_MEMORY_MONITOR = false` in `src/App.tsx` (around line 147)
- Only works in Chrome/Edge (shows "N/A (Chrome/Edge only)" in other browsers)

**To disable:**
1. Open `src/App.tsx`
2. Find the line: `const ENABLE_MEMORY_MONITOR = true;`
3. Change to: `const ENABLE_MEMORY_MONITOR = false;`

**What to watch for:**
- Memory should stabilize after operations
- Continuous growth indicates leaks
- Compare values before/after operations
- Normal: Memory grows during operations, returns to baseline
- Problem: Memory continuously grows and never returns

## Quick Testing Methods (5-15 minutes)

### Method 1: Browser DevTools Memory Profiler (RECOMMENDED)

**Time**: 5-10 minutes  
**Best for**: Detecting ImageBitmap and Object URL leaks

#### Steps:

1. **Open Chrome DevTools** (F12 or Cmd+Option+I on Mac)
2. **Go to Memory tab**
3. **Take a baseline snapshot**:
   - Click the "Take heap snapshot" button (circle icon)
   - Wait for snapshot to complete
   - Note the total size (e.g., "15.2 MB")

4. **Perform operations that should trigger cleanup**:
   - Load a project with images
   - Close the project (File → Close Project or create new project)
   - Load the same project again
   - Repeat 5-10 times

5. **Take another snapshot**:
   - Click "Take heap snapshot" again
   - Compare total size with baseline
   - **Expected**: Size should be similar or only slightly larger
   - **Problem**: If size grows significantly (e.g., +50MB), leaks are present

6. **Search for leaked objects**:
   - In the snapshot, use the search box (top)
   - Search for: `ImageBitmap`
   - **Expected**: Should see 0-2 ImageBitmap objects (current images only)
   - **Problem**: If you see many ImageBitmap objects, they're not being closed
   
   - Search for: `Blob`
   - **Expected**: Should see minimal Blob objects
   - **Problem**: If Blob count grows, Object URLs aren't being revoked

### Method 2: Performance Monitor (Real-time)

**Time**: 5-10 minutes  
**Best for**: Watching memory grow in real-time

#### Steps:

1. **Open Chrome DevTools** → **Performance Monitor** tab
   - If not visible: DevTools → More tools → Performance Monitor
   - Or: DevTools Settings → Experiments → Enable "Performance Monitor"

2. **Watch memory metrics**:
   - **JavaScript Heap Size**: Should stabilize after operations
   - **Used JS Heap**: Should not continuously grow
   - **Total Memory**: Should remain relatively stable

3. **Perform rapid operations**:
   - Load project → Close project → Load project (repeat 10-20 times)
   - Zoom in/out rapidly (50+ times)
   - Draw many objects (100+ vias, pads, traces)
   - Toggle filters on/off repeatedly

4. **Watch for**:
   - **Good**: Memory spikes during operations, then returns to baseline
   - **Bad**: Memory continuously grows and never returns to baseline

### Method 3: Force Garbage Collection + Memory Check

**Time**: 2-5 minutes  
**Best for**: Quick verification of cleanup

#### Steps:

1. **Enable DevTools memory profiling**:
   - Open DevTools → Performance tab
   - Check "Memory" checkbox
   - Click Record

2. **Perform operations**:
   - Load project with images
   - Draw 50+ objects
   - Close project
   - Load project again
   - Repeat 3-5 times

3. **Force garbage collection**:
   - In DevTools Console, run: `window.gc()` (if available)
   - Or: DevTools → Memory tab → "Collect garbage" button (trash icon)

4. **Check memory**:
   - Take heap snapshot
   - Search for `ImageBitmap` - should be 0-2
   - Search for `Blob` - should be minimal

### Method 4: Stress Test Script (Automated)

**Time**: 5-10 minutes  
**Best for**: Rapidly triggering many operations

#### Create a test script in Console:

```javascript
// Run this in DevTools Console to rapidly test memory cleanup
async function stressTest() {
  console.log('Starting stress test...');
  const startMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Simulate rapid project operations
  for (let i = 0; i < 20; i++) {
    console.log(`Iteration ${i + 1}/20`);
    
    // Trigger operations that should clean up resources
    // (You'll need to adapt these to your actual app functions)
    // Example: Load/close project, toggle filters, etc.
    
    // Wait a bit between operations
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Force garbage collection if available
  if (window.gc) window.gc();
  
  const endMemory = performance.memory?.usedJSHeapSize || 0;
  const growth = ((endMemory - startMemory) / 1024 / 1024).toFixed(2);
  
  console.log(`Memory growth: ${growth} MB`);
  console.log(growth > 50 ? '⚠️ LEAK DETECTED' : '✅ No significant leak');
}

stressTest();
```

### Method 5: Network Tab - Check for Blob URLs

**Time**: 2-3 minutes  
**Best for**: Detecting Object URL leaks

#### Steps:

1. **Open DevTools → Network tab**
2. **Filter by "blob:"**
3. **Perform operations**:
   - Load project with images
   - Close project
   - Load project again
   - Repeat 5 times

4. **Check blob URLs**:
   - **Expected**: Should see blob URLs created and then disappear after cleanup
   - **Problem**: If blob URLs accumulate and never disappear, Object URLs aren't being revoked

### Method 6: Canvas Context Check

**Time**: 3-5 minutes  
**Best for**: Detecting canvas context loss (symptom of memory pressure)

#### Steps:

1. **Open DevTools Console**
2. **Run this check**:
   ```javascript
   // Check canvas context
   const canvas = document.querySelector('canvas');
   const ctx = canvas.getContext('2d');
   console.log('Canvas context:', ctx ? 'OK' : 'LOST');
   ```

3. **Perform memory-intensive operations**:
   - Load large images
   - Draw many objects
   - Zoom/pan rapidly
   - Toggle filters

4. **Re-check canvas context**:
   - If context becomes null, memory pressure is too high
   - This indicates leaks are still present

## Specific Test Scenarios

### Test 1: Image Loading/Unloading (2 minutes)
1. Load project with images
2. Close project
3. Load different project
4. Repeat 10 times
5. **Check**: ImageBitmap count should not grow

### Test 2: Rapid Zoom/Pan (3 minutes)
1. Load project
2. Rapidly zoom in/out 100+ times
3. Pan around canvas 100+ times
4. **Check**: Memory should stabilize, not continuously grow

### Test 3: Drawing Operations (3 minutes)
1. Draw 200+ vias
2. Draw 200+ pads
3. Draw 50+ traces
4. Delete all objects
5. **Check**: Memory should return to baseline after deletion

### Test 4: Filter Toggle (2 minutes)
1. Enable grayscale filter
2. Disable grayscale filter
3. Repeat 50 times
4. **Check**: No ImageData objects accumulating

### Test 5: Project Switching (5 minutes)
1. Load Project A
2. Close project
3. Load Project B
4. Close project
5. Load Project A again
6. Repeat 10 cycles
7. **Check**: Memory should not grow with each cycle

## Red Flags (Indicates Leaks)

### ❌ Bad Signs:
- Memory continuously grows during operations
- Memory doesn't return to baseline after operations stop
- ImageBitmap count grows with each project load
- Blob URL count increases and never decreases
- Canvas context becomes null
- Browser becomes sluggish after 10-15 minutes
- Visual glitches (blinking, disappearing elements)

### ✅ Good Signs:
- Memory spikes during operations, returns to baseline
- ImageBitmap count stays at 0-2 (current images only)
- Blob URLs are created and then disappear
- Canvas context remains stable
- Browser remains responsive
- No visual glitches

## Quick Verification Checklist

After running tests, verify:

- [ ] ImageBitmap count doesn't grow beyond current images
- [ ] Object URLs (blob:) are revoked after use
- [ ] Memory returns to baseline after operations
- [ ] Canvas context remains stable
- [ ] No continuous memory growth during extended use
- [ ] Browser remains responsive after 10+ minutes

## Expected Results After Fixes

### Before Fixes:
- ImageBitmap count: 10+ (accumulating)
- Memory growth: +50-100MB after 20 operations
- Blob URLs: Accumulating, never revoked
- Canvas context: May be lost under memory pressure

### After Fixes:
- ImageBitmap count: 0-2 (only current images)
- Memory growth: <10MB after 20 operations
- Blob URLs: Created and revoked properly
- Canvas context: Stable

## Troubleshooting

### If leaks are still detected:

1. **Check cleanup function is called**:
   - Add console.log to `cleanupImageResources()`
   - Verify it's called when images are replaced/closed

2. **Check ImageBitmap.close()**:
   - Verify ImageBitmaps are actually being closed
   - Check for errors in console

3. **Check Object URL revocation**:
   - Verify `URL.revokeObjectURL()` is called
   - Check for errors in console

4. **Check cache clearing**:
   - Verify keystone cache is cleared
   - Verify filter cache is cleared (if used)

## Performance Baseline

**Expected memory usage**:
- Empty project: ~10-20 MB
- Project with 2 images (1920x1080): ~30-50 MB
- Project with many objects: ~50-100 MB
- **Growth after 20 load/unload cycles**: <10 MB

If memory grows more than 10 MB after 20 cycles, investigate further.
