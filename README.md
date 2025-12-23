# PCB Reverse Engineering Tool v3.0

A powerful, browser-based tool designed for reverse engineering, troubleshooting, signal path tracing, and electronics learning on 2 to 4 layer printed circuit boards (PCBs). Perfect for engineers, technicians, and hobbyists who need to analyze and document PCB layouts.

## What Can You Do?

- **Load PCB images** from multiple layers and overlay them with precise alignment
- **Annotate components, traces, vias, pads, power nodes, and ground connections** directly on your PCB photos
- **Transform and align images** with pixel-perfect precision using move, rotate, scale, and perspective correction tools
- **🔍 Trace signal paths through multi-layer PCBs** - The tool provides a **virtual PCB x-ray**, enabling you to easily visualize and follow signal paths across multiple layers by overlaying top and bottom images with adjustable transparency
- **Document your analysis** with comprehensive annotations and notes
- **AI-powered features** to automatically extract component information from datasheet PDFs

## Why Use This Tool?

Working with PCBs can be challenging when you need to:
- Troubleshoot circuit issues across multiple layers
- Reverse engineer existing designs
- Document modifications and repairs
- Learn how complex circuits work
- **🔍 Trace signal paths through multi-layer PCBs** - See through layers like an x-ray! The tool's virtual PCB x-ray capability lets you overlay top and bottom images with adjustable transparency, making it easy to visualize and follow signal paths that travel between layers through vias and connections

This tool makes it **easy** by letting you work directly with your PCB photos in your browser—no complex software installation, no learning curve. Just load your images and start annotating. The virtual x-ray view helps you see connections that would otherwise be hidden inside the board.

## Try It Now

🌐 **[Open the tool in your browser](https://pgiacalo.github.io/PCB_Reverse_Engineering_Tool)**

**No installation required** - just open the link and start using it immediately. The application runs entirely in your browser, so your data stays private and secure.

## Requirements

- **Modern web browser** (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+)
- That's it! No downloads, no setup, no installation.

## Getting Started

1. Click the link above to open the tool
2. Load your PCB images using the "Load Top PCB" and "Load Bottom PCB" buttons
3. Start annotating with the intuitive drawing tools

**For detailed instructions**, see the **Help menu** in the application, which includes:
- Complete usage guide
- Keyboard shortcuts
- Tool descriptions
- Tips and tricks

## Video Tutorial

Watch a 3-minute video that explains how to use the tool:
[https://youtu.be/X4hGUUNUJ60](https://youtu.be/X4hGUUNUJ60)

## AI-Powered Features (Optional)

The tool includes AI-powered features for extracting component information from datasheet PDFs:

- **Automatic pin name extraction** from datasheet PDFs
- **Component property extraction** (voltage, current, temperature, IC type, package type, etc.)

To use these features, simply go to **File → AI Settings** in the application and enter your Google Gemini API key (get a free key from [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)).

**Security Note:** API keys are stored securely in your browser's localStorage and never exposed in code or shared with anyone.

## For Developers

If you want to build, modify, or contribute to this project, see [DEVELOPMENT.md](DEVELOPMENT.md) for development setup, build instructions, and technical documentation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the Help menu in the application
- Review the requirements in `docs/REQUIREMENTS.md`

---

*Version: 3.0*
