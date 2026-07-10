# osu! Map Mixer

A modern, high-performance web-based graphical interface for editing, mixing, and combining **osu! beatmaps** as if they were multi-track video or audio clips. 

With **osu! Map Mixer**, users can import compressed osu! mapsets (`.osz`) or individual chart files (`.osu`), align them along an interactive timeline, arrange/slice them with precise timing grid-snapping, and export a perfectly synchronized, compiled playable beatmap.

---

## 🎨 Visual Preview

*   **Dynamic Visualizer Canvas**: Located at the top of the workspace, rendering hit objects (circles, sliders, spinners) in real-time.
*   **Multi-Lane Sequencing Timeline**: Located at the bottom of the workspace, providing advanced drag-and-drop, slicing, track-highlighting, and timing ruler indicators.
*   **Dual-Paned Layout**: Seamlessly divided by a drag-resizable splitter bar to maximize workspace customized to your screen layout.

---

## ✨ Features

### 1. Multi-Track Timeline Sequencing
*   **Master & Normal Tracks**: Create parent "Master Tracks" for diff-specific settings and sequence "Normal Tracks" containing imported map clips.
*   **Non-Destructive Slicing & Moving**: Drag and slide beatmap clips on the timeline with millisecond and beat-precision snapping.
*   **Tactile Scroll & Zoom**: Effortlessly pinch/scroll horizontally to scale the visible timeline window (down to 1.0s granularity) or move the playhead timeline directly.
*   **Global Playback Clock**: Play, pause, adjust speed, and seek via the status orchestrator or the timeline lanes.

### 2. Precise Timing & Grid Engine
*   **BPM & Timing Segments**: Auto-detects custom timing points (uninherited/inherited points) of active map tracks.
*   **Beat Divider Snapping**: Snap clips, cuts, and positioning to custom beat fractions (1/1, 1/2, 1/4, 1/8, etc.) aligned with the map's native tempo.
*   **Playhead Synchronization**: Live playhead with high-precision timestamp calculations to guarantee perfect audio-visual sync.

### 3. Comprehensive Import/Export Pipeline
*   **Direct Ingestion**: Drag and drop `.osz` archives or `.osu` text files to instantly parse beatmaps, hit objects, metadata, and timing points on client-side web workers.
*   **Audio Binding**: Load customized background MP3 tracks to drive playhead clocks and visual playback cues.
*   **Exporter**: Packages the sequenced clips, compiles individual hit objects into custom timeline timestamps, updates headers, offsets, and difficulty properties, and exports a clean, playable standard `.osu` or compressed `.osz` map format.

---

## 🏗️ Technical Architecture

The codebase is engineered with clear separation of concerns under a lightweight, full-stack structure:

```
src/
├── core/                   # State Management & Contracts
│   ├── shared-state.js     # Single source of truth for playback, tracks, and selection
│   ├── state.js            # Playback orchestrator, clock ticks, and loops
│   └── data-contracts.js   # Type specifications and structures
│
├── engine/                 # Mixer Compilers & Tracks Layout
│   ├── track-utils/        # Timing, note calculation, bounds, and slicing helpers
│   ├── tracks-container/   # Interactive Track Lanes and Headers
│   │   ├── master-track/   # Header and clip managers for active compositions
│   │   ├── normal-track/   # Nested child tracks with timing grid lines
│   │   └── timeline/       # Scroll, zoom, selection bounds, and playhead calculations
│   ├── compiler.js         # Core compilation logic merging stacked clips
│   └── preview-compiler.js # On-the-fly rendering logic for real-time playhead previewing
│
├── pipeline/               # Ingestion Workers & Extractors
│   ├── extractor.js        # Extracts binaries from zipped .osz files
│   ├── ingestion-handler.js# Dispatches charts and handles pipeline state updates
│   └── ingestion-worker.js # Parsers mapping .osu text streams to structured objects
│
├── ui/                     # UI Shell Elements & Canvas Renderers
│   ├── canvas/             # Modular playfield visualizer engine
│   │   ├── index.js        # Core drawing orchestrator
│   │   ├── layout.js       # Grid, scaling, and canvas size handlers
│   │   ├── slider-renderer.js # Mathematical slider gradient & ball calculations
│   │   └── hit-objects.js  # Approach rings, circles, spinners, and fades
│   ├── canvas.js           # Backward-compatible canvas entry point
│   ├── divider.js          # Resizable vertical divider handler
│   └── ui-shell.js         # Welcome modals, toasts, loader systems, and menu links
│
└── app.js                  # Main entry point and orchestrator
```

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   npm or yarn

### Installation
1. Clone the repository or navigate to your local directory.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development Server
Start the local development server with Hot Module Replacement (HMR) and real-time previews on port 3000:
```bash
npm run dev
```

### Production Build
Compile and bundle the application into optimized static assets under `/dist`:
```bash
npm run build
```
You can run a local preview of the production build using:
```bash
npm run preview
```

---

## 📖 User Guide

1.  **Import Assets**: Click **Import** in the top menu or drag and drop an `.osz` mapset file into the app.
2.  **Add a Master Track**: Click the corresponding option in the utility bar to create a Master track target representing your final difficulty.
3.  **Arrange Clips**: Slice, split, delete, or drag the imported beatmap clips across child track lanes to design your custom mixed composition.
4.  **Refine Difficulties**: Tweak Difficulty properties (Circle Size (CS), Approach Rate (AR), Overall Difficulty (OD), HP Drain) directly from the track header settings.
5.  **Visualize**: Hit play or seek across the timeline to verify hit objects match the music on the interactive canvas.
6.  **Export**: Open the menu bar and select **Export** to package and save your compiled work as an `.osz` file ready to load directly into the osu! game client.
