/**
 * Core State & Playback Engine
 * Manages the timeline playback clock, ticks, state mutations, and animation loops
 */
import { drawCanvas } from './canvas.js';
import { drawPlayhead } from './timeline.js';
import { sharedState } from './shared-state.js';

/**
 * Animation loop for playback
 * @param {number} timestamp 
 */
function animationLoop(timestamp) {
    if (sharedState.isPlaying) {
        if (!sharedState.lastTimestamp) sharedState.lastTimestamp = timestamp;
        const deltaTime = timestamp - sharedState.lastTimestamp;
        
        sharedState.playheadPosition += deltaTime * sharedState.playbackSpeed;
        
        // Loop playback
        if (sharedState.playheadPosition >= 1) {
            sharedState.playheadPosition = 0;
        }
        
        sharedState.lastTimestamp = timestamp;
        
        // Fixed: Actively trigger screen and timeline repaints on clock tick
        drawCanvas();
        drawPlayhead();
    }
    
    requestAnimationFrame(animationLoop);
}

/**
 * Sets up spacebar and playback logic
 */
function setupPlaybackControls() {
    window.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            e.preventDefault(); // Prevent scrolling
            sharedState.isPlaying = !sharedState.isPlaying;
            if (!sharedState.isPlaying) {
                sharedState.lastTimestamp = 0; // Reset delta calculation
            }
        }
    });
}

export { sharedState, animationLoop, setupPlaybackControls };