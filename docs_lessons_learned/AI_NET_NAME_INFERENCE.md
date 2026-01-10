# AI-Powered Net Name Inference

## Overview

This feature uses AI to automatically suggest descriptive names for generic signal nets (N$1, N$2, etc.) in the exported netlist. The AI analyzes the netlist structure, connected components, pin names, and signal flow patterns to infer meaningful names that follow industry-standard naming conventions.

## User Experience

### Workflow

1. User clicks **File → Export Netlist**
2. PCB Tracer generates the hybrid netlist
3. **AI Analysis** (automatic, behind the scenes):
   - Netlist is sent to AI for analysis
   - AI identifies generic signal nets (N$1, N$2, etc.)
   - AI suggests descriptive names based on connectivity
   - Each suggestion includes a confidence score (0.0-1.0)
4. **Review Dialog** (if suggestions found):
   - Dialog shows all suggestions with confidence >= 0.5
   - User can review each suggestion:
     - Original name (e.g., N$1)
     - Suggested name (e.g., SPI_MOSI)
     - Confidence level (Very High, High, Moderate, Low)
     - Reasoning explanation
   - User can select/deselect individual suggestions
   - User clicks **Apply Selected** or **Cancel**
5. **Export**:
   - If applied: Netlist is updated with selected names
   - If cancelled: Original netlist is saved unchanged
   - File is saved to `netlists/` directory

### If AI Fails

- If AI service is unavailable or returns an error
- If no generic signal nets are found
- If all confidence scores are below threshold
- **Result**: Export continues normally with original names (no interruption)

## Technical Implementation

### Files Created

1. **`src/utils/netNameInference.ts`**
   - `analyzeNetNames()`: Calls AI to analyze netlist
   - `applyNetNameSuggestions()`: Updates netlist with approved names
   - `validateNetName()`: Validates suggested names

2. **`src/components/NetNameSuggestionDialog/NetNameSuggestionDialog.tsx`**
   - Interactive dialog for reviewing suggestions
   - Checkbox selection (select all/deselect all)
   - Draggable dialog
   - Confidence badges and reasoning display

3. **`src/data/aiPrompts.json`** (updated)
   - Added `net_name_inference` prompt template
   - Instructs AI on naming conventions
   - Defines confidence scoring guidelines

### Files Modified

1. **`src/App.tsx`**
   - Modified `handleExportNetlist()` to call AI before saving
   - Added state for dialog and suggestions
   - Added handlers for apply/cancel actions
   - Added dialog drag support
   - Renders `NetNameSuggestionDialog`

## AI Prompt Design

### Input to AI

The AI receives the complete netlist JSON, which includes:
- Components with designators, part numbers, values
- Nets with connections (component pins, vias, pads)
- Pin names and types (CLK, DATA, RESET, etc.)
- Test points (if available)

### AI Analysis Strategy

The AI considers:
1. **Connected component types** (microcontroller, memory, sensors, etc.)
2. **Pin names and types** (MOSI, SCK, SDA, TX, RX, etc.)
3. **Signal flow patterns** (input → processing → output)
4. **Common naming conventions** (SPI_MOSI, I2C_SDA, UART_TX, etc.)
5. **Test point names** (if connected to the net)

### Output Format

```json
{
  "suggestions": [
    {
      "original_name": "N$1",
      "suggested_name": "SPI_MOSI",
      "confidence": 0.85,
      "reasoning": "Connected to microcontroller SPI MOSI pin and flash memory DI pin, indicating SPI Master Out Slave In signal."
    },
    {
      "original_name": "N$2",
      "suggested_name": "AUDIO_LEFT",
      "confidence": 0.92,
      "reasoning": "Connected to left channel of audio amplifier input and left channel of audio jack connector."
    }
  ]
}
```

## Confidence Scoring

### Guidelines

- **0.9-1.0 (Very High)**: Clear signal purpose, standard naming, multiple confirming connections
- **0.7-0.89 (High)**: Clear signal purpose, good evidence
- **0.5-0.69 (Moderate)**: Reasonable inference, some ambiguity
- **0.3-0.49 (Low)**: Educated guess, significant ambiguity
- **0.0-0.29 (Very Low)**: Highly uncertain

### Default Threshold

- **0.5**: Shows moderate+ confidence suggestions in dialog
- Lower threshold can be used to see more suggestions (including low confidence)

### Confidence Factors

- Certainty of diagnosis
- Quality of evidence (pin names, component types)
- Match to symptoms/patterns
- Availability of manufacturer documentation
- Number of confirming connections

## Naming Conventions

### Standard Patterns

- **Underscores** for multi-word names: `AUDIO_LEFT`, not `AudioLeft`
- **Uppercase** for signal names: `RESET`, not `reset`
- **Specific but concise**: `UART_TX`, not `UART_TRANSMIT_DATA_LINE`
- **Brackets for buses**: `DATA[0]`, `DATA[1]`, `ADDR[15]`
- **Differential pairs**: `USB_DP`, `USB_DN` or `DIFF_P`, `DIFF_N`

### Common Signal Names

- **SPI**: `SPI_MOSI`, `SPI_MISO`, `SPI_SCK`, `SPI_CS`
- **I2C**: `I2C_SDA`, `I2C_SCL`
- **UART**: `UART_TX`, `UART_RX`
- **USB**: `USB_DP`, `USB_DN`, `USB_VBUS`
- **Audio**: `AUDIO_LEFT`, `AUDIO_RIGHT`, `AUDIO_GND`
- **Clock**: `CLK_12MHZ`, `CLK_32KHZ`, `XTAL_IN`, `XTAL_OUT`
- **Control**: `RESET`, `ENABLE`, `CS`, `WR`, `RD`
- **Analog**: `ANALOG_IN`, `VREF`, `ADC_CH0`

### Reserved Names (Not Used)

- Power/ground nets: `GND`, `VCC`, `VDD`, `VSS`, `VEE`, `VBAT`
- Generic patterns: `N$1`, `N$2`, etc.

## Benefits

1. **Readability**: Makes netlists easier to understand
2. **Troubleshooting**: Helps identify signal paths quickly
3. **Documentation**: Self-documenting netlists
4. **Consistency**: Follows industry-standard naming
5. **Efficiency**: Reduces manual renaming effort
6. **AI Learning**: AI learns from component types and connectivity

## Example Transformations

| Original | Suggested Name | Confidence | Reasoning |
|----------|---------------|------------|-----------|
| N$1 | SPI_MOSI | 0.85 | Connected to MCU SPI MOSI pin and flash memory DI pin |
| N$2 | AUDIO_LEFT | 0.92 | Connected to left channel audio amp and jack |
| N$3 | RESET | 0.88 | Connected to reset pins on multiple ICs |
| N$4 | CLK_12MHZ | 0.79 | Connected to 12MHz crystal and MCU clock input |
| N$5 | I2C_SDA | 0.90 | Connected to I2C SDA pins on sensor and MCU |
| N$6 | USB_DP | 0.95 | Connected to USB D+ pins on connector and IC |
| N$7 | LED_STATUS | 0.73 | Connected to LED anode and current-limiting resistor |

## Error Handling

### AI Service Failures

- Network errors
- API key issues
- Service unavailable
- Timeout

**Behavior**: Log warning, continue with export (no interruption)

### Invalid AI Responses

- Malformed JSON
- Missing required fields
- Invalid confidence scores

**Behavior**: Log error, continue with export

### User Cancellation

- User clicks "Cancel" in review dialog

**Behavior**: Save original netlist without AI suggestions

## Future Enhancements

### Potential Improvements

1. **User Learning**: Remember user's preferred naming patterns
2. **Custom Rules**: Allow user to define custom naming rules
3. **Batch Renaming**: Rename multiple nets at once in the UI
4. **Net Name Editor**: Edit net names directly in PCB Tracer
5. **Naming Templates**: Provide templates for common circuit types
6. **Confidence Tuning**: Allow user to adjust confidence threshold
7. **Suggestion History**: Track and learn from accepted/rejected suggestions
8. **Multi-Language**: Support naming conventions in different languages

### Integration Opportunities

1. **Schematic Generation**: Use descriptive names in generated schematics
2. **BOM Generation**: Reference nets by descriptive names in BOM
3. **Test Point Naming**: Auto-name test points based on connected nets
4. **Documentation Export**: Include net names in exported documentation

## Testing Recommendations

### Test Cases

1. **Simple SPI Circuit**: Verify SPI signal names (MOSI, MISO, SCK, CS)
2. **I2C Bus**: Verify I2C signal names (SDA, SCL)
3. **Audio Circuit**: Verify audio channel names (LEFT, RIGHT)
4. **USB Connection**: Verify USB signal names (DP, DN, VBUS)
5. **Mixed Signals**: Verify correct naming for complex circuits
6. **Edge Cases**: Test with no generic nets, all generic nets, etc.

### Validation

1. **Confidence Scores**: Verify scores are reasonable (0.0-1.0)
2. **Naming Conventions**: Verify names follow standards (uppercase, underscores)
3. **Uniqueness**: Verify no duplicate net names after renaming
4. **Reasoning**: Verify reasoning makes sense for each suggestion
5. **User Workflow**: Verify dialog is intuitive and responsive

## Performance Considerations

### AI Call Timing

- AI analysis happens **after** netlist generation
- AI analysis happens **before** file save
- User sees dialog while AI is processing (if results available)

### Optimization

- Use lower temperature (0.3) for consistent results
- Limit max tokens (4000) to reduce cost and latency
- Filter by confidence threshold to reduce dialog clutter
- Cache AI results (future enhancement)

## Security & Privacy

### Data Sent to AI

- Complete netlist JSON (components, nets, connections)
- No user credentials or personal information
- No project file paths or directory names

### API Key Storage

- API keys stored in localStorage (user's browser)
- API keys never sent to our servers
- User controls which AI service to use (Gemini, Claude)

## Conclusion

The AI-powered net name inference feature significantly improves the usability and readability of exported netlists. By automatically suggesting descriptive names based on circuit analysis, it saves time, reduces errors, and makes troubleshooting more efficient. The confidence-based review system ensures users maintain control while benefiting from AI assistance.
