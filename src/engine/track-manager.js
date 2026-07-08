import { sharedState } from '../core/shared-state.js';
import { drawPlayhead } from './timeline.js';
import { drawCanvas } from '../ui/canvas.js';
import { createUtilityBar } from './components/utility-bar.js';
import { createTimelineBar } from './components/timeline-bar.js';
import { createMasterTrack } from './components/master-track.js';
import { createNormalTrack } from './components/normal-track.js';

export { getNoteTimes, getMp3DisplayName, getMaxBeats } from './track-utils.js';

/**
 * Main rendering entry point for the Tracks interface.
 * Composes the layout exactly matching the physical structure:
 * 1. Utility Bar (+ button, audio selector, timing source selector)
 * 2. Timeline Bar (absolute seconds ruler, major/minor ticks, red lines)
 * 3. Master Tracks Container (with volume-change green lines, beat lines, options)
 * 4. Normal Tracks Container (with hit object clips, circle/slider/spinner details)
 */
export function renderTracks() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    container.innerHTML = '';

    // Create central Tracks Manager wrapper
    const tracksManager = document.createElement('div');
    tracksManager.className = 'tracks-manager';

    // 1. Render & Append Utility Bar
    const utilityBar = createUtilityBar();
    tracksManager.appendChild(utilityBar);

    // 2. Render & Append Timeline Bar
    const timelineBar = createTimelineBar();
    tracksManager.appendChild(timelineBar);

    const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration : 180.0;
    const totalDurationMs = totalDuration * 1000;
    
    const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
        ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] 
        : null;

    // 3. Render Master Tracks Container
    const masterTracksContainer = document.createElement('div');
    masterTracksContainer.className = 'master-tracks-container';
    
    sharedState.tracks
        .filter(track => track.type === 'master')
        .forEach((track, index) => {
            const masterTrackEl = createMasterTrack(track, timingAsset, totalDurationMs, index + 1);
            masterTracksContainer.appendChild(masterTrackEl);
        });
    tracksManager.appendChild(masterTracksContainer);

    // 4. Render Normal Tracks Container
    const normalTracksContainer = document.createElement('div');
    normalTracksContainer.className = 'normal-tracks-container';
    
    sharedState.tracks
        .filter(track => track.type === 'normal')
        .forEach(track => {
            const normalTrackEl = createNormalTrack(track, timingAsset, totalDurationMs);
            normalTracksContainer.appendChild(normalTrackEl);
        });
    tracksManager.appendChild(normalTracksContainer);

    container.appendChild(tracksManager);

    // Post-render updates
    drawPlayhead();
    drawCanvas();
}

/**
 * Adds a new normal difficulty track and refreshes the timeline.
 */
export function addNormalTrack(trackData) {
    sharedState.tracks.push({ id: `normal-${Date.now()}`, type: 'normal', ...trackData });
    renderTracks();
}

/**
 * Adds a new master composited track and refreshes the timeline.
 */
export function addMasterTrack() {
    const newId = `master-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    sharedState.tracks.push({ 
        id: newId, 
        type: 'master',
        difficulty: { CS: 4.5, AR: 9, OD: 8, HP: 4 }
    });
    renderTracks();
}
