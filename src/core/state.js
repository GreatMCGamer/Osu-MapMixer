/**
 * Core State & Playback Engine
 * Manages the timeline playback clock, ticks, state mutations, and animation loops
 */
import { drawCanvas } from '../ui/canvas.js';
import { drawPlayhead } from '../engine/timeline.js';
import { sharedState } from './shared-state.js';

let audioEl = null;
let lastSelectedMp3Url = null;

/**
 * Lazily initializes or updates the HTML5 Audio element to match selectedMp3
 */
export function getAudioPlayer() {
    if (typeof window === 'undefined') return null;
    
    if (!audioEl) {
        audioEl = new Audio();
        audioEl.addEventListener('ended', () => {
            if (sharedState.isPlaying) {
                sharedState.playheadPosition = 0;
                audioEl.currentTime = 0;
                audioEl.play().catch(err => console.warn("[Audio] Loop play failed on ended:", err));
            }
        });
    }

    // Keep volume in sync
    const targetVolume = sharedState.volume !== undefined ? sharedState.volume : 0.5;
    if (audioEl.volume !== targetVolume) {
        audioEl.volume = targetVolume;
    }

    const selected = sharedState.selectedMp3;
    if (selected && selected.url) {
        if (lastSelectedMp3Url !== selected.url) {
            lastSelectedMp3Url = selected.url;
            audioEl.src = selected.url;
            audioEl.load();
            
            // Sync currentTime immediately upon source load
            const duration = selected.duration || 0;
            if (duration > 0) {
                audioEl.currentTime = sharedState.playheadPosition * duration;
            }
        }
    } else {
        if (lastSelectedMp3Url !== null) {
            audioEl.removeAttribute('src');
            audioEl.load();
            lastSelectedMp3Url = null;
        }
    }

    return audioEl;
}

/**
 * Animation loop for playback
 * @param {number} timestamp 
 */
function animationLoop(timestamp) {
    const player = getAudioPlayer();
    const hasAudio = !!(sharedState.selectedMp3 && sharedState.selectedMp3.url);

    if (sharedState.isPlaying) {
        if (hasAudio && player) {
            // Ensure audio volume is synchronized
            const targetVolume = sharedState.volume !== undefined ? sharedState.volume : 0.5;
            if (player.volume !== targetVolume) {
                player.volume = targetVolume;
            }

            // Detect seek (if playhead was manually moved far away from current audio time)
            if (player.duration && !isNaN(player.duration)) {
                const expectedTime = sharedState.playheadPosition * player.duration;
                if (Math.abs(player.currentTime - expectedTime) > 0.08) {
                    player.currentTime = expectedTime;
                }
            }

            // Play if paused
            if (player.paused) {
                player.play().catch(err => console.warn("[Audio] Playback failed:", err));
            }

            // Drive playhead from audio clock
            if (player.duration && !isNaN(player.duration)) {
                sharedState.playheadPosition = player.currentTime / player.duration;
            }
        } else {
            // Fallback delta-time ticking when no audio is active
            if (!sharedState.lastTimestamp) sharedState.lastTimestamp = timestamp;
            const deltaTime = timestamp - sharedState.lastTimestamp;
            
            sharedState.playheadPosition += deltaTime * sharedState.playbackSpeed;
            
            // Loop playback
            if (sharedState.playheadPosition >= 1) {
                sharedState.playheadPosition = 0;
            }
        }
        
        sharedState.lastTimestamp = timestamp;
        
        // Actively trigger screen and timeline repaints on clock tick
        drawCanvas();
        drawPlayhead();
    } else {
        // Not playing
        if (hasAudio && player && !player.paused) {
            player.pause();
        }
        
        // Synchronize audio currentTime when paused and playhead moves (seek)
        if (hasAudio && player && player.duration && !isNaN(player.duration)) {
            const expectedTime = sharedState.playheadPosition * player.duration;
            if (Math.abs(player.currentTime - expectedTime) > 0.08) {
                player.currentTime = expectedTime;
            }
        }

        sharedState.lastTimestamp = 0;
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