/**
 * Landmark-based Image Alignment
 * 
 * Uses 4 corresponding landmark points to calculate precise image transformations
 * to align a bottom PCB image to a top PCB image.
 * 
 * IMPORTANT: The bottom image is always flipped relative to the top image because
 * they are photographs of opposite sides of the same board. The algorithm determines
 * whether to flip horizontally or vertically based on which produces better alignment.
 * 
 * Algorithm overview:
 * 1. Calculate centroids of both landmark sets
 * 2. Center points around their centroids
 * 3. Try both flip options (horizontal and vertical) - one MUST be applied
 * 4. For each option, calculate optimal rotation using Procrustes analysis
 * 5. Calculate scale factor from average point distances
 * 6. Select the flip option with lowest alignment error
 * 7. Calculate translation to align centroids
 */

export interface Point {
  x: number;
  y: number;
}

export interface AlignmentTransform {
  flipX: boolean;
  flipY: boolean;
  rotation: number;  // degrees
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ImageInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

interface TransformCandidate {
  transform: AlignmentTransform;
  error: number;
  description: string;
}

/**
 * Calculate the centroid (geometric center) of a set of points
 */
function calculateCentroid(points: Point[]): Point {
  const n = points.length;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n
  };
}

/**
 * Calculate average distance of points from origin (used for scale calculation)
 */
function calculateAverageDistance(points: Point[]): number {
  const total = points.reduce((sum, p) => sum + Math.sqrt(p.x * p.x + p.y * p.y), 0);
  return total / points.length;
}

/**
 * Calculate optimal rotation angle using Procrustes analysis
 * This finds the rotation that minimizes the sum of squared distances
 * between corresponding points.
 * 
 * Uses the formula: θ = atan2(Σ(tx*sy - ty*sx), Σ(tx*sx + ty*sy))
 * where t = target points, s = source points (both centered)
 */
function calculateOptimalRotation(target: Point[], source: Point[]): number {
  let sumSin = 0;
  let sumCos = 0;
  
  for (let i = 0; i < target.length; i++) {
    const tx = target[i].x;
    const ty = target[i].y;
    const sx = source[i].x;
    const sy = source[i].y;
    
    // Cross product component (for sin)
    sumSin += tx * sy - ty * sx;
    // Dot product component (for cos)
    sumCos += tx * sx + ty * sy;
  }
  
  const angleRad = Math.atan2(sumSin, sumCos);
  return angleRad * 180 / Math.PI;
}



/**
 * Calculate transform with a specific flip option
 * 
 * The order of operations is:
 * 1. FLIP around image center → moves the landmark centroid
 * 2. TRANSLATE to align flipped centroid with top centroid
 * 3. SCALE around the aligned centroids
 * 4. ROTATE around the aligned centroids
 * 
 * @param imageInfo - Required to know where image center is for flip pivot
 */
function calculateWithFlip(
  topPoints: Point[],
  bottomPoints: Point[],
  flipX: boolean,
  flipY: boolean,
  description: string,
  imageInfo?: ImageInfo
): TransformCandidate {
  // Calculate top centroid (target)
  const topCentroid = calculateCentroid(topPoints);
  
  // Calculate image center (pivot point for flip)
  const imageCenter: Point = imageInfo ? {
    x: imageInfo.x + (imageInfo.width * imageInfo.scale) / 2,
    y: imageInfo.y + (imageInfo.height * imageInfo.scale) / 2
  } : calculateCentroid(bottomPoints); // Fallback to landmark centroid
  
  console.log(`\n--- ${description} ---`);
  console.log(`Image center (flip pivot): (${imageCenter.x.toFixed(1)}, ${imageCenter.y.toFixed(1)})`);
  console.log(`Top centroid: (${topCentroid.x.toFixed(1)}, ${topCentroid.y.toFixed(1)})`);
  
  // STEP 1: Flip bottom landmarks around image center
  const flippedBottomPoints = bottomPoints.map(p => {
    let x = p.x;
    let y = p.y;
    if (flipX) x = 2 * imageCenter.x - x;  // Reflect across vertical axis through image center
    if (flipY) y = 2 * imageCenter.y - y;  // Reflect across horizontal axis through image center
    return { x, y };
  });
  
  // Calculate centroid of FLIPPED bottom landmarks
  const flippedBottomCentroid = calculateCentroid(flippedBottomPoints);
  console.log(`Flipped bottom centroid: (${flippedBottomCentroid.x.toFixed(1)}, ${flippedBottomCentroid.y.toFixed(1)})`);
  
  // STEP 2: Translation to align flipped centroid with top centroid
  const translateX = topCentroid.x - flippedBottomCentroid.x;
  const translateY = topCentroid.y - flippedBottomCentroid.y;
  console.log(`Translation to align centroids: (${translateX.toFixed(1)}, ${translateY.toFixed(1)})`);
  
  // Center points around their respective centroids for scale and rotation calculation
  const topCentered = topPoints.map(p => ({ 
    x: p.x - topCentroid.x, 
    y: p.y - topCentroid.y 
  }));
  
  const flippedBottomCentered = flippedBottomPoints.map(p => ({ 
    x: p.x - flippedBottomCentroid.x, 
    y: p.y - flippedBottomCentroid.y 
  }));
  
  // STEP 3: Calculate scale factor (ratio of average distances from centroid)
  const topAvgDist = calculateAverageDistance(topCentered);
  const bottomAvgDist = calculateAverageDistance(flippedBottomCentered);
  const scale = (topAvgDist > 0 && bottomAvgDist > 0) ? topAvgDist / bottomAvgDist : 1;
  console.log(`Scale: ${scale.toFixed(4)} (top avg dist: ${topAvgDist.toFixed(1)}, bottom avg dist: ${bottomAvgDist.toFixed(1)})`);
  
  // STEP 4: Calculate optimal rotation using Procrustes analysis
  const rotation = calculateOptimalRotation(topCentered, flippedBottomCentered);
  console.log(`Rotation: ${rotation.toFixed(2)}°`);

  const transform: AlignmentTransform = {
    flipX,
    flipY,
    rotation,
    scale,
    translateX,
    translateY
  };

  // Calculate alignment error
  const error = calculateAlignmentError(topPoints, flippedBottomPoints, flippedBottomCentroid, topCentroid, scale, rotation, translateX, translateY);
  console.log(`Alignment error: ${error.toFixed(2)}px`);

  return { transform, error, description };
}

/**
 * Calculate RMS alignment error
 * 
 * Simulates: flip → translate → scale → rotate
 * Scale and rotate are around the aligned centroid (topCentroid after translation)
 */
function calculateAlignmentError(
  topPoints: Point[],
  flippedBottomPoints: Point[],
  flippedBottomCentroid: Point,
  _topCentroid: Point,  // Unused but kept for API consistency
  scale: number,
  rotation: number,
  translateX: number,
  translateY: number
): number {
  let totalSquaredError = 0;
  
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  for (let i = 0; i < topPoints.length; i++) {
    // Start with flipped point, centered around flipped centroid
    let x = flippedBottomPoints[i].x - flippedBottomCentroid.x;
    let y = flippedBottomPoints[i].y - flippedBottomCentroid.y;
    
    // Apply scale (around centroid)
    x *= scale;
    y *= scale;
    
    // Apply rotation (around centroid)
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    
    // Add back centroid and apply translation
    const finalX = rx + flippedBottomCentroid.x + translateX;
    const finalY = ry + flippedBottomCentroid.y + translateY;
    
    // This should equal topCentroid + (rx, ry) = topPoints[i] ideally
    const dx = finalX - topPoints[i].x;
    const dy = finalY - topPoints[i].y;
    totalSquaredError += dx * dx + dy * dy;
  }
  
  return Math.sqrt(totalSquaredError / topPoints.length);
}


/**
 * Calculate transformation parameters from 4 corresponding landmark pairs
 * 
 * This is the main entry point for the landmark alignment algorithm.
 * It tries multiple flip options and selects the one with the lowest error.
 * 
 * @param topPoints - 4 landmark points on the top image (world coordinates)
 * @param bottomPoints - 4 landmark points on the bottom image (world coordinates)
 * @param bottomImageInfo - Current state of the bottom image (for calculating proper translation)
 */
export function calculateTransformFromLandmarks(
  topPoints: Point[],
  bottomPoints: Point[],
  bottomImageInfo?: ImageInfo
): AlignmentTransform {
  if (topPoints.length !== 4 || bottomPoints.length !== 4) {
    throw new Error('Exactly 4 landmark points required for each image');
  }

  console.log('=== LANDMARK ALIGNMENT CALCULATION ===');
  console.log('Top landmarks:', topPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(', '));
  console.log('Bottom landmarks:', bottomPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(', '));
  if (bottomImageInfo) {
    console.log('Bottom image info:', bottomImageInfo);
  }

  // PCB bottom images are ALWAYS flipped relative to top (they're photos of opposite sides)
  // Try both horizontal and vertical flip to determine which is correct
  const candidates: TransformCandidate[] = [
    calculateWithFlip(topPoints, bottomPoints, true, false, 'Horizontal flip', bottomImageInfo),
    calculateWithFlip(topPoints, bottomPoints, false, true, 'Vertical flip', bottomImageInfo),
  ];

  // Log all candidates
  console.log('\n--- Alignment Candidates (flip is required for PCB) ---');
  candidates.forEach((c, i) => {
    console.log(`${i + 1}. ${c.description}: error=${c.error.toFixed(2)}px, rotation=${c.transform.rotation.toFixed(1)}°, scale=${c.transform.scale.toFixed(4)}`);
  });

  // Sort by error (lowest first) and select the best flip option
  candidates.sort((a, b) => a.error - b.error);
  let best = candidates[0];
  
  // If errors are very close (within 5%), prefer the option with smaller rotation
  if (candidates.length > 1 && candidates[1].error < best.error * 1.05) {
    const bestRotAbs = Math.min(Math.abs(best.transform.rotation), Math.abs(best.transform.rotation - 180), Math.abs(best.transform.rotation + 180));
    const altRotAbs = Math.min(Math.abs(candidates[1].transform.rotation), Math.abs(candidates[1].transform.rotation - 180), Math.abs(candidates[1].transform.rotation + 180));
    
    if (altRotAbs < bestRotAbs - 5) {
      console.log(`Preferring "${candidates[1].description}" over "${best.description}" (smaller rotation with similar error)`);
      best = candidates[1];
    }
  }

  console.log(`\n=== SELECTED: ${best.description} ===`);
  console.log(`Error: ${best.error.toFixed(2)}px`);
  console.log(`Rotation: ${best.transform.rotation.toFixed(2)}°`);
  console.log(`Scale: ${best.transform.scale.toFixed(4)}`);
  console.log(`Translation: (${best.transform.translateX.toFixed(1)}, ${best.transform.translateY.toFixed(1)})`);

  return best.transform;
}

/**
 * Simple alignment result (no flip - flip is applied beforehand)
 */
export interface AlignmentResult {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  error: number;
  quality: number;
}

/**
 * Calculate alignment when flip has ALREADY been applied.
 * 
 * This is the simplified version - just calculates:
 * 1. Translation (centroid to centroid)
 * 2. Scale (ratio of average distances)
 * 3. Rotation (Procrustes optimal rotation)
 * 
 * All operations are around the landmark centroids.
 */
export function calculateAlignmentNoFlip(
  topPoints: Point[],
  bottomPoints: Point[]
): AlignmentResult {
  if (topPoints.length !== 4 || bottomPoints.length !== 4) {
    throw new Error('Exactly 4 landmark points required for each image');
  }

  console.log('=== SIMPLE ALIGNMENT (no flip) ===');
  console.log('Top landmarks:', topPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(', '));
  console.log('Bottom landmarks:', bottomPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(', '));

  // Calculate centroids
  const topCentroid = calculateCentroid(topPoints);
  const bottomCentroid = calculateCentroid(bottomPoints);
  
  console.log(`Top centroid: (${topCentroid.x.toFixed(1)}, ${topCentroid.y.toFixed(1)})`);
  console.log(`Bottom centroid: (${bottomCentroid.x.toFixed(1)}, ${bottomCentroid.y.toFixed(1)})`);

  // Step 1: Translation to align centroids
  const translateX = topCentroid.x - bottomCentroid.x;
  const translateY = topCentroid.y - bottomCentroid.y;
  console.log(`Translation: (${translateX.toFixed(1)}, ${translateY.toFixed(1)})`);

  // Center points around their centroids
  const topCentered = topPoints.map(p => ({ 
    x: p.x - topCentroid.x, 
    y: p.y - topCentroid.y 
  }));
  const bottomCentered = bottomPoints.map(p => ({ 
    x: p.x - bottomCentroid.x, 
    y: p.y - bottomCentroid.y 
  }));

  // Step 2: Calculate scale (ratio of average distances from centroid)
  const topAvgDist = calculateAverageDistance(topCentered);
  const bottomAvgDist = calculateAverageDistance(bottomCentered);
  const scale = (topAvgDist > 0 && bottomAvgDist > 0) ? topAvgDist / bottomAvgDist : 1;
  console.log(`Scale: ${scale.toFixed(4)} (top dist: ${topAvgDist.toFixed(1)}, bottom dist: ${bottomAvgDist.toFixed(1)})`);

  // Step 3: Calculate optimal rotation using Procrustes analysis
  const rotation = calculateOptimalRotation(topCentered, bottomCentered);
  console.log(`Rotation: ${rotation.toFixed(2)}°`);

  // Calculate final error
  const error = calculateSimpleError(topCentered, bottomCentered, scale, rotation);
  const quality = Math.max(0, Math.min(100, 100 - (error * 2)));
  
  console.log(`Error: ${error.toFixed(2)}px, Quality: ${quality.toFixed(0)}%`);

  return {
    translateX,
    translateY,
    scale,
    rotation,
    error,
    quality
  };
}

/**
 * Calculate RMS error for simple alignment (no flip)
 */
function calculateSimpleError(
  topCentered: Point[],
  bottomCentered: Point[],
  scale: number,
  rotation: number
): number {
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  let totalSquaredError = 0;
  
  for (let i = 0; i < topCentered.length; i++) {
    // Scale bottom point
    const sx = bottomCentered[i].x * scale;
    const sy = bottomCentered[i].y * scale;
    
    // Rotate
    const rx = sx * cos - sy * sin;
    const ry = sx * sin + sy * cos;
    
    // Compare to top point
    const dx = rx - topCentered[i].x;
    const dy = ry - topCentered[i].y;
    totalSquaredError += dx * dx + dy * dy;
  }
  
  return Math.sqrt(totalSquaredError / topCentered.length);
}

/**
 * Calculate alignment quality score (0-100%)
 * Based on RMS error in pixels
 */
export function calculateAlignmentQuality(
  topPoints: Point[],
  bottomPoints: Point[],
  transform: AlignmentTransform,
  bottomImageInfo?: ImageInfo
): number {
  // Calculate image center for flip
  const imageCenter: Point = bottomImageInfo ? {
    x: bottomImageInfo.x + (bottomImageInfo.width * bottomImageInfo.scale) / 2,
    y: bottomImageInfo.y + (bottomImageInfo.height * bottomImageInfo.scale) / 2
  } : calculateCentroid(bottomPoints);
  
  // Flip bottom points
  const flippedBottomPoints = bottomPoints.map(p => {
    let x = p.x;
    let y = p.y;
    if (transform.flipX) x = 2 * imageCenter.x - x;
    if (transform.flipY) y = 2 * imageCenter.y - y;
    return { x, y };
  });
  
  const flippedBottomCentroid = calculateCentroid(flippedBottomPoints);
  const topCentroid = calculateCentroid(topPoints);
  
  const error = calculateAlignmentError(
    topPoints, 
    flippedBottomPoints, 
    flippedBottomCentroid, 
    topCentroid, 
    transform.scale, 
    transform.rotation, 
    transform.translateX, 
    transform.translateY
  );
  
  console.log(`Final alignment RMS error: ${error.toFixed(2)} pixels`);
  
  // Convert error to quality percentage
  // 0px error = 100%, 50px error = 0%
  const quality = Math.max(0, Math.min(100, 100 - (error * 2)));
  return quality;
}
