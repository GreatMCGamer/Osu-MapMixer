/**
 * Main Orchestrator: Entry Point
 * Ensures DOM readiness before attaching event listeners to imported modules.
 */
import { setupDividerResizing } from './divider.js';
import { animationLoop, setupPlaybackControls } from './state.js';
import { setupMenuListeners, setupWelcomeModalListeners } from './ui-shell.js';
import { updateCanvasSize, drawCanvas } from './canvas.js';
import { setupTrackInteractions } from './timeline.js';
import { setupDragAndDrop } from './file-ingestor.js';
import { setupClipboardPasteListener, setupURLInputListeners } from './extractor.js';

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
    const masterTrack = document.getElementById('master-track');
    
    // Ensure playhead exists
    if (!document.getElementById('playhead')) {
        const playhead = document.createElement('div');
        playhead.id = 'playhead';
        playhead.className = 'playhead';
        if (masterTrack) masterTrack.appendChild(playhead);
    }

    // 4. Initialize Modules
    // We call setup functions AFTER ensuring elements exist in the DOM
    setupMenuListeners();
    setupWelcomeModalListeners();
    setupDividerResizing();
    setupDragAndDrop();
    setupPlaybackControls();
    setupTrackInteractions(masterTrack);
    setupClipboardPasteListener();
    setupURLInputListeners();

    // 5. Initial Render
    updateCanvasSize();
    drawCanvas();

    // 6. Start Loop
    requestAnimationFrame(animationLoop);

    // 7. Handle Responsive Resizing
    window.addEventListener('resize', () => {
        updateCanvasSize();
        drawCanvas();
    });
    
    console.log("App Initialized Successfully.");
}

// Kickoff
initializeApp().catch(console.error);