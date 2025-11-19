# About Vias in 4-Layer PCB Stackups

In the most common 4-layer PCB stackup, vias play a crucial role in connecting traces between layers and managing ground/power distribution. Let me explain the typical configuration:

## Standard 4-Layer Stackup

The most common arrangement is:

- **Layer 1 (Top)**: Signal layer
- **Layer 2 (Inner)**: Ground plane
- **Layer 3 (Inner)**: Power plane
- **Layer 4 (Bottom)**: Signal layer

## How Vias Are Used

### 1. Signal Routing Between Top and Bottom

Vias connect signal traces on Layer 1 to Layer 4 when you need to route around obstacles or change sides of the board. These are through-hole vias that pass through all four layers.

### 2. Ground and Power Connections

- **Ground stitching vias**: These connect Layer 1 and Layer 4 to the internal ground plane (Layer 2). They're placed regularly around the board (typically every 1/4 wavelength for high-speed designs, or every 1-2 inches for general designs) to provide low-impedance return paths.

- **Power vias**: Connect components on the outer layers to the power plane (Layer 3) for Vcc distribution.

### 3. Return Path Management

When a signal transitions from top to bottom layer, a nearby ground via should be placed close to the signal via (within a few mm) to provide an uninterrupted return current path. This is critical for signal integrity.

### 4. Thermal Management

Vias under components like voltage regulators help transfer heat from the surface to the inner copper planes, which act as heat sinks.

### 5. Decoupling Capacitors

Vias connect decoupling capacitors between power and ground planes, with short, wide traces or multiple vias to minimize inductance.

## Via Types in 4-Layer Boards

- **Through-hole vias**: Most common, drilled through all layers (cheaper to manufacture)
- **Blind vias**: Connect outer layer to inner layer (Layer 1 to Layer 2/3, or Layer 2/3 to Layer 4) - more expensive
- **Buried vias**: Connect only inner layers (Layer 2 to Layer 3) - rarely needed in 4-layer designs

For most 4-layer designs, standard through-hole vias are sufficient and keep costs down.

