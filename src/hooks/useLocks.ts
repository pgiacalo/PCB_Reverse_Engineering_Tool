/**
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

