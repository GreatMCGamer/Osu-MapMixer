/**
 * Main Orchestrator: Entry Point
 * Ensures DOM readiness before attaching event listeners to imported modules.
 */
import { renderTracks } from './engine/tracks-container/track-manager.js';
import { setupDividerResizing } from './ui/divider.js';
import { animationLoop, setupPlaybackControls } from './core/state.js';
import { setupMenuListeners, setupWelcomeModalListeners } from './ui/ui-shell.js';
import { updateCanvasSize, drawCanvas } from './ui/canvas.js';
import { setupTrackInteractions } from './engine/tracks-container/timeline.js';
import { setupDragAndDrop } from './pipeline/file-ingestor.js';
import { setupClipboardPasteListener, setupURLInputListeners } from './pipeline/extractor.js';
import { sharedState } from './core/shared-state.js';

async function initializeApp() {
    console.log("Initializing App...");

    // 1. Wait for DOM to be fully parsed
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    // 2. Show welcome modal
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.style.display = 'flex';
    }

    // 3. Setup UI elements safely
    renderTracks();
    
    // Ensure playhead exists
    // ... (need to rethink playhead logic for multiple tracks)


    // 4. Initialize Modules
    // We call setup functions AFTER ensuring elements exist in the DOM
    setupMenuListeners();
    setupWelcomeModalListeners();
    setupDividerResizing();
    setupDragAndDrop();
    setupPlaybackControls();
    setupTrackInteractions(); // Updated to not take an element directly, or handle multiple tracks
    setupClipboardPasteListener();
    setupURLInputListeners();

    // 5. Initial Render
    updateCanvasSize();
    drawCanvas();

    // 6. Start Loop
    requestAnimationFrame(animationLoop);

    // 7. Handle Responsive Resizing
    window.addEventListener('resize', () => {
        sharedState.cachedLaneWidth = null;
        updateCanvasSize();
        drawCanvas();
    });
    
    console.log("App Initialized Successfully.");
}

// Kickoff
initializeApp().catch(console.error);