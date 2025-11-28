# Schematic Generation Improvements

## Summary of Changes

This document outlines the improvements made to the schematic generation system based on graph transformation principles.

## Completed Improvements

### 1. ✅ KiCad Grid Configuration
- **Setting**: Grid configured to default 100mm
- **Location**: `src/utils/schematic.ts` line ~1231
- **Implementation**: Added `(grid (size 100) (style dots))` to schematic header
- **Benefit**: Provides consistent grid alignment for large schematics

### 2. ✅ Symbol Library Integration
- **File Location**: `kicad/symbols/kicadunlocked.kicad_sym`
- **Status**: File moved from root directory to organized subdirectory
- **Note**: KiCad schematics reference symbol libraries when placing symbols (not in header)
- **Future Work**: Can reference symbols from this library when placing components

### 3. ✅ Graph-Based Component Connectivity Analysis
- **Function**: `buildComponentConnectivityGraph()`
- **Purpose**: Builds a graph where components are nodes and shared nets create edges
- **Location**: `src/utils/schematic.ts` lines ~1147-1177
- **Benefit**: Enables functional block clustering and improved layout algorithms

### 4. ✅ Functional Block Clustering
- **Function**: `clusterComponents()`
- **Algorithm**: Simple DFS-based clustering to group connected components
- **Location**: `src/utils/schematic.ts` lines ~1183-1212
- **Benefit**: Identifies functional blocks (components that share many connections)
- **Output**: Logs cluster information for debugging

## Current Layout Algorithm

The current implementation uses a **hybrid approach**:

1. **PCB Coordinate Preservation**: Components maintain their relative positions from the PCB layout
   - Preserves spatial relationships
   - Naturally groups components that are physically close
   - Components in the same functional block (connected via traces) are typically close on PCB

2. **Graph-Based Analysis**: Connectivity graph is built and analyzed
   - Identifies functional blocks
   - Logs clustering information
   - Ready for future force-directed layout improvements

3. **Scaling and Translation**: PCB coordinates are scaled to fit A3 paper
   - Maintains aspect ratio
   - Centers layout within usable area
   - Leaves margins for labels and power/ground symbols

## Future Improvements (Based on Algorithm Document)

### Phase 2 Enhancements (Recommended Next Steps)

1. **Force-Directed Layout**:
   - Use Fruchterman-Reingold algorithm for initial placement
   - Apply constraints (power top, ground bottom, inputs left, outputs right)
   - Group clustered components spatially

2. **Orthogonal Wire Routing**:
   - Implement Lee algorithm or A* with Manhattan distance
   - Minimize wire crossings using planarization techniques
   - Follow KiCad's preference for orthogonal routing

3. **Intelligent Net Naming**:
   - Pattern recognition for common signals (CLK, MOSI, TX, etc.)
   - Based on component types and connections

4. **Hierarchical Sheets**:
   - Create sub-sheets for major functional blocks
   - Improve readability for complex boards

### Advanced Algorithms to Consider

1. **Community Detection**: Louvain method for better functional grouping
2. **Signal Flow Detection**: Topological sorting for left-to-right flow
3. **Crossing Minimization**: Sugiyama framework for layered graphs

## Symbol Library Usage

The `kicadunlocked.kicad_sym` file contains KiCad symbol definitions that can be referenced when placing components. To use symbols from this library:

1. Ensure the library file is accessible to KiCad
2. Reference symbols using the format: `(lib_id "library:symbol_name")`
3. The library contains symbols for common components (C, R, D, etc.)

## Testing Recommendations

1. **Grid Alignment**: Verify components align to 100mm grid
2. **Clustering**: Check console logs for functional block identification
3. **Layout Quality**: Review generated schematics for readability
4. **Symbol References**: Test with KiCad to ensure symbols load correctly

## Code Locations

- **Grid Setting**: `src/utils/schematic.ts:1231`
- **Graph Building**: `src/utils/schematic.ts:1147-1177`
- **Clustering**: `src/utils/schematic.ts:1183-1212`
- **Component Layout**: `src/utils/schematic.ts:1214-1270`
- **Symbol Library**: `kicad/symbols/kicadunlocked.kicad_sym`

