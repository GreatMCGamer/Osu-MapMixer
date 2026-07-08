# Osu! Map Mixer

A graphical interface tool for editing and combining beatmaps for osu! as if they are "videos"  in a video editor.
(Project is fully Vibe coded)

## Features

- Video editor-like interface for beatmap editing
- Canvas for beatmap object visualization
- Master track for timeline editing
- Import and export functionality
- Multi-track timeline editing
- Beatmap component rendering

## Project Structure

- `index.html` - Main HTML structure
- `package.json` - Project dependencies and scripts
- `vite.config.js` - Vite configuration

### Source Code Structure

- `src/`
  - `app.js` - Main application entry point
  - `core/` - Core data contracts and shared state management
    - `data-contracts.js` - Data contracts for beatmap objects
    - `shared-state.js` - Shared state management
    - `state.js` - Application state handling
    - `timing-math.js` - Timing and BPM conversion utilities
  - `engine/` - Core engine logic
    - `clip-cache.js` - Cache management for beatmap clips
    - `compiler.js` - Beatmap compilation logic
    - `components/` - Timeline components
      - `master-track.js` - Master track implementation
      - `normal-track.js` - Normal track implementation
      - `timeline-bar.js` - Timeline bar UI component
      - `utility-bar.js` - Utility bar UI component
    - `timeline.js` - Timeline management
    - `track-manager.js` - Track management logic
    - `track-ui.js` - Track UI rendering
    - `track-utils.js` - Track utility functions
    - `utils.js` - General utility functions
  - `pipeline/` - Data ingestion and processing pipeline
    - `extractor.js` - Beatmap data extraction
    - `file-ingestor.js` - File ingestion logic
    - `ingestion-handler.js` - Ingestion handling
    - `ingestion-worker.js` - Ingestion worker logic
  - `ui/` - User interface components
    - `canvas.js` - Canvas rendering
    - `ui-shell.js` - Main UI shell

## Development

This project uses Vite for development and build processes.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Architecture

The application follows a flat, transactional architecture with horizontal data flows:

1. Data ingestion pipeline processes osu! beatmaps
2. Core state management handles application data
3. Engine components manage timeline and track logic
4. UI components render the interface

All data contracts are immutable and read-only to ensure data integrity.