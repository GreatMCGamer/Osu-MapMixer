/**
 * Core State & Playback Engine
 * Manages the timeline playback clock, ticks, state mutations, and animation loops
 */

// State Management
const state = {
    isPlaying: false,
    playheadPosition: 0, // Percentage of the track (0 to 1)
    lastTimestamp: 0,
    playbackSpeed: 0.001 // Progress per millisecond
};

/**
 * Animation loop for playback
 * @param {number} timestamp 
 */
function animationLoop(timestamp) {
    if (state.isPlaying) {
        if (!state.lastTimestamp) state.lastTimestamp = timestamp;
        const deltaTime = timestamp - state.lastTimestamp;
        
        state.playheadPosition += deltaTime * state.playbackSpeed;
        
        // Loop playback
        if (state.playheadPosition >= 1) {
            state.playheadPosition = 0;
        }
        
        state.lastTimestamp = timestamp;
        // Note: drawCanvas and drawPlayhead are called from the UI components
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
            state.isPlaying = !state.isPlaying;
            if (!state.isPlaying) {
                state.lastTimestamp = 0; // Reset delta calculation
            }
        }
    });
}

export { state, animationLoop, setupPlaybackControls };