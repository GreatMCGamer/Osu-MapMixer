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
    playbackSpeed: 0.001, // Progress per millisecond
    tracks: [
        { id: 'master-1', type: 'master' }
    ]
};

export { sharedState };