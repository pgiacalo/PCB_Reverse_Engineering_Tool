# Perspective Change Alignment Issue Analysis

## Problem Description
When using Tools → Change Perspective, the alignment of icons with images gets out of sync, particularly when rotating and then switching front/rear views.

## Root Causes Identified

### 1. **Moving Center Point Problem**

The center point for transformations is recalculated dynamically based on the **current** image position:

```typescript
const getCenterPointForPerspective = useCallback((): { x: number; y: number } => {
  // Use top image center as reference (or bottom if top doesn't exist)
  if (topImage) {
    return { x: topImage.x, y: topImage.y };  // ← Uses CURRENT position
  }
  if (bottomImage) {
    return { x: bottomImage.x, y: bottomImage.y };  // ← Uses CURRENT position
  }
  return { x: 0, y: 0 };
}, [topImage, bottomImage]);
```

**Issue**: When you rotate first, the image position changes. Then when you switch views, the center point is recalculated from the NEW position, not the original position. This causes the flip operation to use a different center point than the rotation operation.

**Example Scenario**:
1. Initial state: Image at (100, 100), Component at (150, 150)
2. Rotate 90°: Center point = (100, 100)
   - Image rotates to new position, say (100, 100) [stays same if center]
   - Component rotates to new position
3. Switch view: Center point recalculated = NEW image position (may have changed)
   - Flip uses this NEW center point
   - Component flips around different center than it rotated around
   - **Result: Misalignment**

### 2. **Non-Commutative Operations**

Rotation and flipping are **non-commutative** when applied to coordinates:
- Rotate then Flip ≠ Flip then Rotate

The current implementation applies these operations sequentially, and each operation modifies the coordinates. This means the order matters, and applying them in different orders gives different results.

### 3. **Dual Transformation Problem**

Both operations modify coordinates AND visual properties:

**Rotation**:
- Modifies x,y coordinates (rotates around center)
- Modifies rotation property (adds angle)
- Modifies orientation for components

**View Switch**:
- Modifies x coordinates (flips horizontally)
- Modifies flipX/flipY properties
- Modifies orientation for components

When both are applied, the coordinate changes compound, and if the center points differ, alignment is lost.

### 4. **Top/Bottom Image Position Mismatch**

The center point is calculated from the top image's position. If top and bottom images have different positions (which is common), using only the top image's position as the center means:
- Bottom image transforms around a center point that may not be appropriate for it
- Icons transform around a center point based on top image, not their own positions
- This causes relative positions to shift

### 5. **Camera Center Also Moves**

Both operations also modify the camera center:
- Rotation: `setCameraWorldCenter(rotatedCamera)`
- View Switch: `setCameraWorldCenter(prev => ({ x: centerX - (prev.x - centerX), y: prev.y }))`

This adds another layer of complexity and potential misalignment.

## Specific Failure Scenario

**Sequence**: Rotate 90° → Switch to Bottom View → Switch to Top View

1. **Initial**: Image at (0, 0), Component at (50, 50), Center = (0, 0)
2. **Rotate 90°**: 
   - Center = (0, 0) [from original image position]
   - Image rotates: (0, 0) → (0, 0) [stays same]
   - Component rotates: (50, 50) → (-50, 50)
   - Camera rotates: (0, 0) → (0, 0)
3. **Switch to Bottom View**:
   - Center recalculated = (0, 0) [from current image position]
   - Image flips: x = 0 - (0 - 0) = 0 [stays same]
   - Component flips: x = 0 - (-50 - 0) = 50
   - Camera flips: x = 0 - (0 - 0) = 0
4. **Switch to Top View**:
   - Center recalculated = (0, 0) [from current image position]
   - Image flips back: x = 0 - (0 - 0) = 0 [stays same]
   - Component flips back: x = 0 - (50 - 0) = -50
   - **Problem**: Component is now at (-50, 50) instead of original (50, 50)!

The component should return to (50, 50) but ends up at (-50, 50) because:
- The flip operations used center point (0, 0) which was correct
- But the rotation changed the component's position
- The flip operations don't account for the rotation that was already applied

## Why This Happens

The fundamental issue is that **each transformation operation is independent** and uses the **current state** to calculate its center point. There's no "memory" of the original state or the sequence of transformations applied. This means:

1. Each operation sees the world in its current transformed state
2. Center points are recalculated from current positions
3. Operations don't "undo" previous transformations before applying new ones
4. The cumulative effect of multiple transformations causes drift

## Solution Approach

To fix this, the perspective operations should:
1. **Use a fixed center point** that doesn't change between operations (e.g., store original center point)
2. **Track transformation state** so operations can be properly reversed
3. **Apply transformations relative to original positions**, not current positions
4. **OR**: Only modify visual properties (rotation, flip) and NOT modify coordinates at all

The user's requirement that "x,y world coordinates shall not be changed" suggests option 4 is the correct approach - only change visual properties, never coordinates.

