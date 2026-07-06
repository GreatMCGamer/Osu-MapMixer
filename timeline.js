/**
 * Interactive Timeline Component (Master Track)
 * Governs interactions, render positioning, and playhead updates for the sequencing track
 */
import { sharedState } from './shared-state.js';
import { drawCanvas } from './canvas.js';

/**
 * Computes and updates the CSS positioning of the red playhead line based on the global state's playhead percentage
 */
function drawPlayhead() {
    const masterTrack = document.getElementById('master-track');
    const playhead = document.getElementById('playhead');
    if (!playhead || !masterTrack) return;

    const x = sharedState.playheadPosition * masterTrack.offsetWidth;
    playhead.style.left = `${x}px`;
}

/**
 * Listens for user clicks on the master track container to recalculate and seek the playback timeline's percentage
 * @param {HTMLElement} track 
 */
function setupTrackInteractions(track) {
    if (!track) return;
    
    track.addEventListener('click', function(e) {
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        // Update Central State and force repaints
        sharedState.playheadPosition = clickX / rect.width;
        drawPlayhead();
        drawCanvas();
    });
}

export { drawPlayhead, setupTrackInteractions };