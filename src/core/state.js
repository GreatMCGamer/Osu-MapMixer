/**
 * Core State & Playback Engine
 * Manages the timeline playback clock, ticks, state mutations, and animation loops
 */
import { drawCanvas } from '../ui/canvas.js';
import { drawPlayhead } from '../engine/tracks-container/timeline.js';
import { sharedState } from './shared-state.js';

let audioEl = null;
let lastSelectedMp3Url = null;

let frameCount = 0;
let lastFpsUpdate = 0;
let lastDomUpdate = 0;

function updateDebugUI() {
    const timings = sharedState.performanceTimings;
    if (!timings) return;
    
    const canvasEl = document.getElementById('debugCanvasRender');
    const gridEl = document.getElementById('debugGridRender');
    const filterEl = document.getElementById('debugHitObjectFilter');
    const sliderEl = document.getElementById('debugSliderRender');
    const circleEl = document.getElementById('debugCircleRender');
    const playheadEl = document.getElementById('debugPlayheadUpdate');
    const laneQueryEl = document.getElementById('debugLaneQuery');
    const playheadQueryEl = document.getElementById('debugPlayheadQuery');
    const scrollEl = document.getElementById('debugLaneScrollSync');
    const fpsEl = document.getElementById('debugFps');
    
    if (canvasEl) canvasEl.innerText = `${timings.canvasRenderMs.toFixed(2)} ms`;
    if (gridEl) gridEl.innerText = `${timings.gridRenderMs.toFixed(2)} ms`;
    if (filterEl) filterEl.innerText = `${timings.hitObjectFilterMs.toFixed(2)} ms`;
    if (sliderEl) sliderEl.innerText = `${timings.sliderRenderMs.toFixed(2)} ms`;
    if (circleEl) circleEl.innerText = `${timings.circleRenderMs.toFixed(2)} ms`;
    if (playheadEl) playheadEl.innerText = `${timings.playheadUpdateMs.toFixed(2)} ms`;
    if (laneQueryEl) laneQueryEl.innerText = `${timings.laneQueryMs.toFixed(2)} ms`;
    if (playheadQueryEl) playheadQueryEl.innerText = `${timings.playheadQueryMs.toFixed(2)} ms`;
    if (scrollEl) scrollEl.innerText = `${timings.laneScrollSyncMs.toFixed(2)} ms`;
    if (fpsEl) fpsEl.innerText = `${timings.fps} FPS`;
}

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
    // 1. Calculate FPS
    if (!lastFpsUpdate) lastFpsUpdate = timestamp;
    frameCount++;
    if (timestamp - lastFpsUpdate >= 1000) {
        if (sharedState.performanceTimings) {
            sharedState.performanceTimings.fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdate));
        }
        frameCount = 0;
        lastFpsUpdate = timestamp;
    }

    // 2. Update Debug dropdown UI every 250ms
    if (!lastDomUpdate) lastDomUpdate = timestamp;
    if (timestamp - lastDomUpdate >= 250) {
        updateDebugUI();
        lastDomUpdate = timestamp;
    }

    const player = getAudioPlayer();
    const hasAudio = !!(sharedState.selectedMp3 && sharedState.selectedMp3.url);
    const sel = sharedState.highlightSelection;
    const isLooping = !!(sel && Math.abs(sel.endMs - sel.startMs) > 10);

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
                let currentAudioTimeMs = player.currentTime * 1000;
                if (isLooping) {
                    if (currentAudioTimeMs >= sel.endMs || currentAudioTimeMs < sel.startMs) {
                        player.currentTime = sel.startMs / 1000;
                        currentAudioTimeMs = sel.startMs;
                    }
                }
                sharedState.playheadPosition = currentAudioTimeMs / (player.duration * 1000);
            }
        } else {
            // Fallback delta-time ticking when no audio is active
            if (!sharedState.lastTimestamp) sharedState.lastTimestamp = timestamp;
            const deltaTime = timestamp - sharedState.lastTimestamp;
            
            sharedState.playheadPosition += deltaTime * sharedState.playbackSpeed;
            
            // Loop playback
            if (isLooping) {
                const totalDuration = 180000;
                let currentTimeMs = sharedState.playheadPosition * totalDuration;
                if (currentTimeMs >= sel.endMs || currentTimeMs < sel.startMs) {
                    currentTimeMs = sel.startMs;
                    sharedState.playheadPosition = currentTimeMs / totalDuration;
                }
            } else {
                if (sharedState.playheadPosition >= 1) {
                    sharedState.playheadPosition = 0;
                }
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
            if (sharedState.isPlaying) {
                const sel = sharedState.highlightSelection;
                if (sel && Math.abs(sel.endMs - sel.startMs) > 10) {
                    const totalDuration = (sharedState.selectedMp3 && sharedState.selectedMp3.duration)
                        ? sharedState.selectedMp3.duration * 1000
                        : 180000;
                    const currentTimeMs = sharedState.playheadPosition * totalDuration;
                    if (currentTimeMs < sel.startMs || currentTimeMs >= sel.endMs) {
                        sharedState.playheadPosition = sel.startMs / totalDuration;
                    }
                }
            } else {
                sharedState.lastTimestamp = 0; // Reset delta calculation
            }
        }
    });
}

export { sharedState, animationLoop, setupPlaybackControls };