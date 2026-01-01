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

/**
 * Centralized exports for all custom hooks
 */
export { useDrawing } from './useDrawing';
export type { DrawingPoint, DrawingStroke } from './useDrawing';

export { useSelection } from './useSelection';

export { useTransform } from './useTransform';

export { useImage } from './useImage';
export type { PCBImage, ViewMode } from './useImage';

export { useView } from './useView';

export { useComponents, combineValueAndUnit } from './useComponents';

export { usePowerGround } from './usePowerGround';
export type { PowerBus, GroundBus, PowerSymbol, GroundSymbol } from './usePowerGround';

export { useLayerSettings } from './useLayerSettings';

export { useToolRegistry } from './useToolRegistry';
export type { Tool, Layer, ToolSettings, ToolDefinition } from './useToolRegistry';

export { useToolState } from './useToolState';
export type { ToolState, UseToolStateProps } from './useToolState';

export { useLocks } from './useLocks';

export { useDialogs } from './useDialogs';

export { useFileOperations } from './useFileOperations';

export { usePCBConnectivity } from './usePCBConnectivity';

export { useUndo } from './useUndo';
export type { UndoSnapshot } from './useUndo';
