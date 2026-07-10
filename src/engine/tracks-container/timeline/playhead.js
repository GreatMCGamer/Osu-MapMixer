import { sharedState } from '../../../core/shared-state.js';
import { updateBottomStatusBar } from './timeline-utils.js';

/**
 * Computes and updates the CSS positioning of the red playhead line based on the global state's playhead percentage
 */
export function drawPlayhead() {
    const t0 = performance.now();
    
    // Get all track lanes actively from the document to avoid holding stale/detached elements
    const t0_lane_query = performance.now();
    const lanes = document.querySelectorAll('.track-lane');
    const laneQueryMs = performance.now() - t0_lane_query;
    
    if (lanes.length === 0) return;
    
    // Read the offsetWidth of the first lane once (does not cause layout thrashing if no writes happened yet)
    const laneWidth = lanes[0].offsetWidth;
    if (laneWidth === 0) return; // Wait until container is laid out
    
    const zoom = sharedState.zoom || 1.0;
    const totalTimelineWidth = laneWidth * zoom;
    const scrollMax = Math.max(0, totalTimelineWidth - laneWidth);

    // Playhead pixel position in the full zoomed timeline
    const playheadX = sharedState.playheadPosition * totalTimelineWidth;

    // Centering scroll calculation: ONLY when the track is playing!
    let scrollLeft = sharedState.scrollLeft || 0;
    if (sharedState.isPlaying) {
        if (playheadX > laneWidth / 2) {
            scrollLeft = Math.min(scrollMax, playheadX - laneWidth / 2);
        } else {
            scrollLeft = 0;
        }
        sharedState.scrollLeft = scrollLeft;
    }

    const t0_scroll = performance.now();
    let playheadQueryTotal = 0;
    
    for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        
        // Use cached content element on the DOM element itself
        let content = lane._cachedContent;
        if (!content) {
            content = lane.querySelector('.track-timeline-content');
            lane._cachedContent = content;
        }

        if (content) {
            // Only update DOM style width if the zoom has actually changed
            if (lane._lastZoom !== zoom) {
                lane._lastZoom = zoom;
                content.style.width = `${zoom * 100}%`;
            }
            
            const t0_pq = performance.now();
            // Use cached playhead element on the DOM element itself
            let playhead = lane._cachedPlayhead;
            if (!playhead) {
                playhead = content.querySelector('.playhead');
                if (!playhead) {
                    playhead = document.createElement('div');
                    playhead.className = 'playhead';
                    content.appendChild(playhead);
                }
                lane._cachedPlayhead = playhead;
            }
            playheadQueryTotal += performance.now() - t0_pq;
            
            // Update left style using % representation directly, which does not trigger style invalidation
            const pctStr = `${(sharedState.playheadPosition * 100).toFixed(4)}%`;
            if (playhead._lastLeft !== pctStr) {
                playhead._lastLeft = pctStr;
                playhead.style.left = pctStr;
            }
        }
        
        // Only write to scrollLeft if it actually changed, using cached value
        if (lane._lastScrollLeft !== scrollLeft) {
            lane.scrollLeft = scrollLeft;
            lane._lastScrollLeft = scrollLeft;
        }
    }
    
    const laneScrollSyncMs = performance.now() - t0_scroll - playheadQueryTotal;

    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.laneQueryMs = laneQueryMs;
        sharedState.performanceTimings.playheadQueryMs = playheadQueryTotal;
        sharedState.performanceTimings.laneScrollSyncMs = Math.max(0, laneScrollSyncMs);
        sharedState.performanceTimings.playheadUpdateMs = performance.now() - t0;
    }

    updateBottomStatusBar();
}
