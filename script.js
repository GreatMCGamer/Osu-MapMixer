// Import all modules
import { state, animationLoop, setupPlaybackControls } from './state.js';
import { showLoader, hideLoader, showToast, setupMenuListeners, setupWelcomeModalListeners } from './ui-shell.js';
import { updateCanvasSize, drawCanvas, drawGrid } from './canvas.js';
import { drawPlayhead, setupTrackInteractions } from './timeline.js';
import { triggerDirectoryPicker, handleDirectory, processDraggedEntries, setupDragAndDrop } from './file-ingestor.js';
import { handleOszFile, fetchBeatmapById, processInputText, setupClipboardPasteListener, setupURLInputListeners } from './extractor.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    const welcomeModal = document.getElementById('welcomeModal');
    welcomeModal.style.display = 'flex';
    
    const canvas = document.getElementById('beatmapCanvas');
    const masterTrack = document.getElementById('master-track');
    
    // Create playhead element if it doesn't exist
    if (!document.getElementById('playhead')) {
        const playhead = document.createElement('div');
        playhead.id = 'playhead';
        playhead.className = 'playhead';
        masterTrack.appendChild(playhead);
    }
    
    updateCanvasSize();
    drawCanvas();
    
    setupMenuListeners();
    setupWelcomeModalListeners();
    setupDragAndDrop();
    setupPlaybackControls();
    setupTrackInteractions(masterTrack);
    setupClipboardPasteListener();
    setupURLInputListeners();

    // Animation Loop
    requestAnimationFrame(animationLoop);

    window.addEventListener('resize', function() {
        updateCanvasSize();
        drawCanvas();
    });
});