# PCB Reverse Engineering Tool - Documentation

## Overview

This directory contains comprehensive documentation for the PCB Reverse Engineering Tool project.

## Documentation Files

### 📋 Project Requirements

**[REQUIREMENTS.md](./REQUIREMENTS.md)**
- Complete technical and functional requirements
- Project goals
- Target PCB complexity (4-layer boards)
- Drawing layer organization (9 layers)
- Component type system requirements (24 component types)
- Layer management requirements
- Core functional requirements

### 🔧 Component System

**[COMPONENT_SYSTEM.md](./COMPONENT_SYSTEM.md)**
- Complete guide to the 24 component types
- Component placement workflow
- Properties dialog specifications
- Pin connection management
- Designator auto-suggestion
- BOM (Bill of Materials) export
- Usage examples and code snippets

### 🔌 Netlist Generation

**[NETLIST_STRATEGY.md](./NETLIST_STRATEGY.md)**
- ID system analysis and design
- Netlist concept (nodes and nets)
- Connectivity graph structure
- Net assignment algorithms
- Netlist format
- Validation and error checking
- Implementation roadmap

### 🔀 Trace System

**[TRACE_SYSTEM.md](./TRACE_SYSTEM.md)**
- Trace creation workflow
- User interaction and snapping behavior
- Data structure design
- Connectivity analysis algorithms
- Geometric intersection testing
- Net navigation and assignment
- Complete trace analysis examples

### 🏗️ Refactoring Guide

**[REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)**
- Code organization strategy
- Completed refactoring work (Phase 1)
- Utility modules created
- Remaining work (UI components, hooks)
- Migration strategy and benefits
- File organization structure

### 💻 Technology Stack

**[TECHNOLOGY_STACK.md](./TECHNOLOGY_STACK.md)**
- Core technologies and frameworks (React, TypeScript, Vite)
- UI libraries and components
- Graphics and rendering (HTML5 Canvas)
- Background processing (Web Workers)
- Development workflow and tooling
- Architecture patterns and project structure

### 📚 Reference Materials

**[PCB Reverse Engineering Tips](./PCB%20Reverse%20Engineering%20Tips)**
- BOM (Bill of Materials) guidelines
- Component identification tips
- Standard PCB designator prefixes (24 types)
- Package type references
- Reverse engineering workflow

## Quick Reference

### Component Types (24 Total)

| Prefix | Type | Default Pins | Prefix | Type | Default Pins |
|--------|------|--------------|--------|------|--------------|
| B, BT | Battery | 2 | Q | Transistor | 3 |
| C | Capacitor | 2 | R | Resistor | 2 |
| D, CR | Diode | 2 | RN | Resistor Network | 8 |
| F | Fuse | 2 | RT | Thermistor | 2 |
| FB | Ferrite Bead | 2 | S, SW | Switch | 2 |
| J, P | Connector | 4 | T | Transformer | 4 |
| JP | Jumper | 3 | TP | Test Point | 1 |
| K | Relay | 5 | U, IC | Integrated Circuit | 8 |
| L | Inductor | 2 | V | Vacuum Tube | 5 |
| LS | Speaker/Buzzer | 2 | VR | Variable Resistor | 3 |
| M | Motor | 2 | X, XTAL, Y | Crystal | 2 |
| PS | Power Supply | 4 | Z | Zener Diode | 2 |

### Drawing Layers (9 Total)

1. **Vias** - Connection nodes linking layers
2. **Power Nodes** - Power plane connections (multi-voltage)
3. **Ground Nodes** - Ground plane connections
4. **Top Pads** - Component pads on top surface
5. **Top Traces** - Signal traces on top layer
6. **Top Components** - Components on top surface
7. **Bottom Pads** - Component pads on bottom surface
8. **Bottom Traces** - Signal traces on bottom layer
9. **Bottom Components** - Components on bottom surface

### ID System

| Element | ID Format | Example |
|---------|-----------|---------|
| Via | `via-{timestamp}-{random}` | `via-1699876543210-abc123` |
| Trace | `trace-{timestamp}-{random}` | `trace-1699876543211-xyz789` |
| Component | `comp-{timestamp}-{random}` | `comp-1699876543212-mno456` |
| Ground | `gnd-{timestamp}-{random}` | `gnd-1699876543213-stu901` |
| Power | `pwr-{timestamp}-{random}` | `pwr-1699876543214-abc234` |
| Point | Sequential integer | `1, 2, 3, ...` |

### Key Algorithms

1. **Trace Connectivity Analysis** - Geometric intersection to find nodes connected by traces
2. **Union-Find Net Assignment** - Group connected nodes into electrical nets
3. **Net Naming** - Automatic naming (GND, +5V, N$1, N$2, etc.)
4. **BOM Export** - Component data export in CSV/JSON format
5. **Netlist Export** - Format for connectivity analysis

## Implementation Status

### ✅ Completed (Phase 1)

- [x] Type definitions for all PCB elements
- [x] Constants and configuration
- [x] Coordinate transformation utilities
- [x] Custom cursor generation
- [x] Canvas drawing utilities
- [x] File operations (save/load)
- [x] Selection utilities
- [x] Component management utilities
- [x] 24 component type system
- [x] ID generation system
- [x] Documentation

### ⏳ In Progress

- [ ] Netlist connectivity analysis
- [ ] Net assignment algorithms
- [ ] Netlist export

### 📋 Planned (Phase 2)

- [ ] UI components (Toolbar, MenuBar, LayersPanel, Canvas)
- [ ] Custom React hooks (useDrawing, useSelection, useTransform)
- [ ] App.tsx refactoring
- [ ] Component properties dialog
- [ ] Net management UI

## Getting Started

1. **For Requirements**: Start with [REQUIREMENTS.md](./REQUIREMENTS.md)
2. **For Technology Stack**: See [TECHNOLOGY_STACK.md](./TECHNOLOGY_STACK.md)
3. **For Component System**: Read [COMPONENT_SYSTEM.md](./COMPONENT_SYSTEM.md)
4. **For Netlist Generation**: See [NETLIST_STRATEGY.md](./NETLIST_STRATEGY.md) and [TRACE_SYSTEM.md](./TRACE_SYSTEM.md)
5. **For Code Organization**: Check [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)
6. **For PCB Basics**: Review [PCB Reverse Engineering Tips](./PCB%20Reverse%20Engineering%20Tips)

## Contributing

When adding new features or modifying existing ones:

1. Update relevant documentation files
2. Add new requirements to REQUIREMENTS.md
3. Document algorithms in appropriate technical docs
4. Update this index if adding new documentation

## External Resources

- **nl2sch Tool**: [GitHub Repository](https://github.com/tpecar/nl2sch)
- **Component Packages**: [DigiKey Package Types](https://forum.digikey.com/t/common-electronic-component-package-types/34882)
- **PCB Reverse Engineering**: [Hackaday Video](https://www.youtube.com/watch?v=dQ9Mh9BbyP0&t=6251s)

---

**Last Updated**: November 2025  
**Project Version**: 1.0.0  
**Documentation Version**: 1.0.0

