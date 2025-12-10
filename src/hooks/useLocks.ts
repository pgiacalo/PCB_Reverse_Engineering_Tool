/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing lock states for different PCB element types
 */
export function useLocks() {
  const [areImagesLocked, setAreImagesLocked] = useState(false);
  const [areViasLocked, setAreViasLocked] = useState(false);
  const [arePadsLocked, setArePadsLocked] = useState(false);
  const [areTestPointsLocked, setAreTestPointsLocked] = useState(false);
  const [areTracesLocked, setAreTracesLocked] = useState(false);
  const [areComponentsLocked, setAreComponentsLocked] = useState(false);
  const [areGroundNodesLocked, setAreGroundNodesLocked] = useState(false);
  const [arePowerNodesLocked, setArePowerNodesLocked] = useState(false);

  const lockAll = useCallback(() => {
    setAreImagesLocked(true);
    setAreViasLocked(true);
    setArePadsLocked(true);
    setAreTestPointsLocked(true);
    setAreTracesLocked(true);
    setAreComponentsLocked(true);
    setAreGroundNodesLocked(true);
    setArePowerNodesLocked(true);
  }, []);

  const unlockAll = useCallback(() => {
    setAreImagesLocked(false);
    setAreViasLocked(false);
    setArePadsLocked(false);
    setAreTestPointsLocked(false);
    setAreTracesLocked(false);
    setAreComponentsLocked(false);
    setAreGroundNodesLocked(false);
    setArePowerNodesLocked(false);
  }, []);

  return {
    // State
    areImagesLocked,
    setAreImagesLocked,
    areViasLocked,
    setAreViasLocked,
    arePadsLocked,
    setArePadsLocked,
    areTestPointsLocked,
    setAreTestPointsLocked,
    areTracesLocked,
    setAreTracesLocked,
    areComponentsLocked,
    setAreComponentsLocked,
    areGroundNodesLocked,
    setAreGroundNodesLocked,
    arePowerNodesLocked,
    setArePowerNodesLocked,
    
    // Actions
    lockAll,
    unlockAll,
  };
}

