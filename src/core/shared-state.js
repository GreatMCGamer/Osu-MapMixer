/**
 * Shared State Store
 * Acts as a flat, horizontal data layer accessible by reference imports
 * This file breaks the circular dependency between state.js and timeline.js
 */
// State Store - acts as our flat, horizontal data layers accessible by reference imports
const sharedState = {
    isPlaying: false,
    playheadPosition: 0, // Percentage of the track (0 to 1)
    lastTimestamp: 0,
    playbackSpeed: 1 / 180000, // Progress per millisecond (defaults to 180 seconds fallback duration)
    zoom: 1.0, // Timeline zoom factor (1.0 = 100%)
    mp3Files: [], // List of loaded MP3 files
    selectedMp3: null, // Currently selected main MP3 file
    tracks: [
        { 
            id: 'master-1', 
            type: 'master',
            difficulty: { CS: 4.5, AR: 9, OD: 8, HP: 4 }
        }
    ],
    highlightedTrackId: null, // Currently highlighted track ID for visualizer rendering
    lastMasterDifficulty: { CS: 4.5, AR: 9, OD: 8, HP: 4 },
    beatDivider: 4, // Beat snap divisor (1/1, 1/2, 1/3, 1/4, etc.)
    volume: 0.5, // Audio playback volume (0 to 1, 50% default)
    previewNeedsCompile: true,
    ghostPreviewTrack: null,
    showTimingLines: true,
    showDebugDropdown: (typeof window !== 'undefined' && (
        window.location.search.includes('debug=1') ||
        window.location.search.includes('debug=true') ||
        localStorage.getItem('debug') === 'true'
    )),
    performanceTimings: {
        canvasRenderMs: 0,
        gridRenderMs: 0,
        hitObjectFilterMs: 0,
        sliderRenderMs: 0,
        circleRenderMs: 0,
        playheadUpdateMs: 0,
        laneQueryMs: 0,
        playheadQueryMs: 0,
        laneScrollSyncMs: 0,
        fps: 0
    }
};

/**
 * Returns the currently active difficulty settings (CS, AR, OD, HP) based on the highlighted track.
 * If a master track is highlighted, returns its specific difficulty.
 * If a normal track is highlighted, returns the last active/selected master difficulty.
 */
function getActiveDifficulty() {
    const tracks = sharedState.tracks || [];
    const activeId = getHighlightedTrackId();
    if (!activeId) {
        return sharedState.lastMasterDifficulty || { CS: 4.5, AR: 9, OD: 8, HP: 4 };
    }
    
    const activeTrack = tracks.find(t => t.id === activeId);
    if (activeTrack && activeTrack.type === 'master' && activeTrack.difficulty) {
        return activeTrack.difficulty;
    }
    
    return sharedState.lastMasterDifficulty || { CS: 4.5, AR: 9, OD: 8, HP: 4 };
}

/**
 * Returns the currently highlighted track ID.
 * Defaults to the topmost track (favoring master tracks) if none is selected or if the selected one is missing.
 */
function getHighlightedTrackId() {
    const tracks = sharedState.tracks || [];
    if (tracks.length === 0) return null;
    
    const exists = tracks.some(t => t.id === sharedState.highlightedTrackId);
    if (exists && sharedState.highlightedTrackId) {
        return sharedState.highlightedTrackId;
    }
    
    // Default fallback: first master track
    const firstMaster = tracks.find(t => t.type === 'master');
    if (firstMaster) {
        return firstMaster.id;
    }
    
    // Next fallback: first normal track
    const firstNormal = tracks.find(t => t.type === 'normal');
    if (firstNormal) {
        return firstNormal.id;
    }
    
    return null;
}

export { sharedState, getHighlightedTrackId, getActiveDifficulty };