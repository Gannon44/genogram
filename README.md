## Genogram Tool

An **interactive, client-side** genogram editor built with vanilla JavaScript, SVG, and lightweight utilities. Designed for speed, offline use on GitHub Pages, and easy export/import of family data as JSON.

---

### Repository Structure

```
genogram-tool/
├── index.html         # Main HTML file; includes canvas and details panel
├── styles/
│   └── main.css       # CSS for layout, shapes, and interactions
├── scripts/
│   ├── app.js         # Entry point: initializes canvas and state
│   ├── model.js       # Data model classes (Person, Relationship, Genogram)
│   ├── view.js        # SVG rendering logic, hit‑testing, dragging
│   ├── controller.js  # Event handling: clicks, drags, keypresses
│   ├── utils.js       # JSON import/export, date calculations
│   └── libs/
│       └── microtemplater.js  # (optional) tiny templating helper
├── assets/
│   └── icons.svg      # Symbols (triangles, twin connectors, etc.)
├── examples/
│   └── sample.json    # Example genogram data for quick load
├── README.md          # Project overview, install & usage
└── LICENSE            # MIT License
```

### Key Features

- **Canvas rendering** via SVG: squares, circles, triangles, lines.
- **Interactive manipulation**: click to select, drag to move, shift‑click to add floating members.
- **Details panel**: dynamic form fields for selected member or relationship, including:
  - Personal data: names, birth/death dates, gender, orientation, notes
  - Relationship types: marriage, separation, adoption, twins, etc.
- **Relationship creation**:
  - Hover‑over handles for adding partners and children
  - Keyboard shortcut (`L`) to link two selected members
- **Auto-layout rules**: orthogonal connectors, chronological ordering of children, no overlaps
- **Import/Export**: full genogram as JSON, easy save/load

### Technology Stack

- **Frontend**: Vanilla ES6 JavaScript (no React/Vue)
- **Rendering**: SVG elements manipulated directly
- **State**: In‑memory JS model; optional `localStorage` for autosaves
- **Hosting**: GitHub Pages (static site)

### Getting Started

1. **Clone** the repo:
   ```bash
   git clone https://github.com/yourusername/genogram-tool.git
   ```
2. **Serve** locally (optional):
   ```bash
   npx http-server .
   ```
3. Open `index.html` in your browser.
4. **Load** `examples/sample.json` via Import to see a demo.

### Future Enhancements

- Undo/redo stack
- CSV/XLSX export
- Custom styling and themes
- Enhanced auto‑layout algorithms

---

*Feedback and contributions welcome!*

