import { sharedState, getHighlightedTrackId } from '../../../core/shared-state.js';
import { renderTimingGridLines } from '../track-ui.js';
import { renderTracks } from '../track-manager.js';
import { getNoteTimes } from '../../track-utils/index.js';
import { createMasterHeader } from './header.js';
import { renderMasterClips } from './clip-renderer.js';

export function createMasterTrack(track, timingAsset, totalDurationMs, index) {
    const highlightedId = getHighlightedTrackId();
    const isHighlighted = (track.id === highlightedId);
    
    const trackEl = document.createElement('div');
    trackEl.className = `track ${track.type}${isHighlighted ? ' highlighted' : ''}`;
    trackEl.id = track.id;

    // Track selection helper that updates DOM classes instantly without re-rendering everything
    const selectTrack = () => {
        if (sharedState.highlightedTrackId !== track.id) {
            sharedState.highlightedTrackId = track.id;
            if (!track.difficulty) {
                track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
            }
            sharedState.lastMasterDifficulty = { ...track.difficulty };
            
            // Instantly update highlights in the DOM
            document.querySelectorAll('.track').forEach(el => {
                const star = el.querySelector('.track-highlight-star');
                if (el.id === track.id) {
                    el.classList.add('highlighted');
                    if (star) {
                        star.innerText = '★';
                        star.style.color = '#ff66aa';
                    }
                } else {
                    el.classList.remove('highlighted');
                    if (star) {
                        star.innerText = '☆';
                        star.style.color = '#555';
                    }
                }
            });
            import('../../../ui/canvas.js').then(m => m.drawCanvas());
        }
    };

    // Header Section (using modular header builder)
    const headerEl = createMasterHeader(track, index, selectTrack, isHighlighted);
    trackEl.appendChild(headerEl);

    // Timeline Lane Section
    const laneEl = document.createElement('div');
    laneEl.className = 'track-lane';

    // Add inner scrollable content wrapper
    const contentEl = document.createElement('div');
    contentEl.className = 'track-timeline-content';
    contentEl.style.width = `${(sharedState.zoom || 1.0) * 100}%`;
    
    // Draw timing point indicators and BPM beat grid lines
    if (timingAsset) {
        renderTimingGridLines(contentEl, timingAsset, totalDurationMs, {
            showRedLines: false,
            showGreenLines: true,
            showBeatLines: true
        });
    }

    // Render Clips and static hit objects (using modular clip renderer)
    if (track.clips && track.clips.length > 0) {
        renderMasterClips(contentEl, track, timingAsset, totalDurationMs);
    } else if (track.sourceAsset && track.sourceAsset.hitObjects && track.sourceAsset.hitObjects.length > 0) {
        // Fallback if no clips exist yet (should have been initialized, but just in case)
        const asset = track.sourceAsset;
        const firstObj = asset.hitObjects[0];
        const minTimeMs = firstObj.originalTimeMs || 0;
        let maxTimeMs = minTimeMs;
        
        asset.hitObjects.forEach(obj => {
            const times = getNoteTimes(obj, track);
            if (times.endTime > maxTimeMs) {
                maxTimeMs = times.endTime;
            }
        });

        // Initialize track.clips
        track.clips = [{
            clipId: `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ownedObjectIds: asset.hitObjects.map(obj => obj.id),
            startTimeMs: minTimeMs,
            endTimeMs: maxTimeMs
        }];
        renderTracks(); // Re-render to show clips
    }

    // Render selection overlay if highlighted
    if (sharedState.highlightSelection && sharedState.highlightSelection.trackId === track.id) {
        const sel = sharedState.highlightSelection;
        const selLeftPct = (sel.startMs / totalDurationMs) * 100;
        const selWidthPct = ((sel.endMs - sel.startMs) / totalDurationMs) * 100;

        const selectionOverlay = document.createElement('div');
        selectionOverlay.className = 'timeline-selection-overlay';
        selectionOverlay.style.left = `${selLeftPct}%`;
        selectionOverlay.style.width = `${selWidthPct}%`;
        contentEl.appendChild(selectionOverlay);
    }

    laneEl.appendChild(contentEl);
    trackEl.appendChild(laneEl);
    
    return trackEl;
}
