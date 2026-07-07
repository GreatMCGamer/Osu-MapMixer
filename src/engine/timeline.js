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
    // Get all master tracks
    const masterTracks = document.querySelectorAll('.track.master');
    
    masterTracks.forEach(masterTrack => {
        let playhead = masterTrack.querySelector('.playhead');
        if (!playhead) {
            playhead = document.createElement('div');
            playhead.className = 'playhead';
            masterTrack.appendChild(playhead);
        }

        const x = sharedState.playheadPosition * masterTrack.offsetWidth;
        playhead.style.left = `${x}px`;
    });
}

/**
 * Listens for user clicks on the master track container to recalculate and seek the playback timeline's percentage
 */
function setupTrackInteractions() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    
    container.addEventListener('click', function(e) {
        const track = e.target.closest('.track.master');
        if (!track) return;
        
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        // Update Central State and force repaints
        sharedState.playheadPosition = clickX / rect.width;
        drawPlayhead();
        drawCanvas();
    });
}

export { drawPlayhead, setupTrackInteractions };