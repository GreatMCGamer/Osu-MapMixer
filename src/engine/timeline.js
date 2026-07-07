/**
 * Interactive Timeline Component (Master Track)
 * Governs interactions, render positioning, and playhead updates for the sequencing track
 */
import { sharedState } from '../core/shared-state.js';
import { drawCanvas } from '../ui/canvas.js';

/**
 * Updates the zoom amount indicator in the bottom status bar
 */
export function updateBottomStatusBar() {
    const zoomBubble = document.getElementById('zoom-bubble');
    if (zoomBubble) {
        const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration : 180.0;
        const visibleDuration = totalDuration / (sharedState.zoom || 1.0);
        zoomBubble.innerText = `Visible: ${visibleDuration.toFixed(1)}s`;
    }
}

/**
 * Computes and updates the CSS positioning of the red playhead line based on the global state's playhead percentage
 */
function drawPlayhead() {
    // Get all track lanes
    const lanes = document.querySelectorAll('.track-lane');
    if (lanes.length === 0) return;
    
    const laneWidth = lanes[0].offsetWidth;
    const zoom = sharedState.zoom || 1.0;
    const totalTimelineWidth = laneWidth * zoom;
    const scrollMax = Math.max(0, totalTimelineWidth - laneWidth);

    // Playhead pixel position in the full zoomed timeline
    const playheadX = sharedState.playheadPosition * totalTimelineWidth;

    // Centering scroll calculation: once playhead reaches middle of screen, scroll sideways to keep it centered
    let scrollLeft = 0;
    if (playheadX > laneWidth / 2) {
        scrollLeft = Math.min(scrollMax, playheadX - laneWidth / 2);
    }
    
    sharedState.scrollLeft = scrollLeft;

    lanes.forEach(lane => {
        const content = lane.querySelector('.track-timeline-content');
        if (content) {
            content.style.width = `${zoom * 100}%`;
            
            let playhead = content.querySelector('.playhead');
            if (!playhead) {
                playhead = document.createElement('div');
                playhead.className = 'playhead';
                content.appendChild(playhead);
            }
            playhead.style.left = `${sharedState.playheadPosition * 100}%`;
        }
        lane.scrollLeft = scrollLeft;
    });

    updateBottomStatusBar();
}

/**
 * Listens for user clicks on the master track container to recalculate and seek the playback timeline's percentage
 */
function setupTrackInteractions() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    
    // Click on track lanes to seek playhead position
    container.addEventListener('click', function(e) {
        const lane = e.target.closest('.track-lane');
        if (!lane) return;
        
        const rect = lane.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        const zoom = sharedState.zoom || 1.0;
        const totalWidth = rect.width * zoom;
        const absoluteClickX = clickX + lane.scrollLeft;
        
        sharedState.playheadPosition = Math.max(0, Math.min(1, absoluteClickX / totalWidth));
        drawPlayhead();
        drawCanvas();
    });

    // Wheel event listener for custom scroll/zoom actions
    window.addEventListener('wheel', function(e) {
        const divider = document.getElementById('divider');
        const dividerRect = divider ? divider.getBoundingClientRect() : null;
        const dividerY = dividerRect ? dividerRect.top : window.innerHeight * 0.6666;
        
        if (e.clientY < dividerY) {
            // Above divider line: scroll wheel moves playhead
            e.preventDefault();
            const scrollAmount = e.deltaY * 0.0005; // adjusting sensitivity
            sharedState.playheadPosition = Math.max(0, Math.min(1, sharedState.playheadPosition + scrollAmount));
            drawPlayhead();
            drawCanvas();
        } else {
            // Under divider line
            const isNamePlate = e.target.closest('.track-header') || e.target.closest('.tracks-controls-bar');
            if (isNamePlate) {
                // Scroll name plates up/down (standard vertical scrolling)
            } else {
                // Zoom timeline horizontally based on visible duration
                e.preventDefault();
                const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration : 180.0;
                const oldZoom = sharedState.zoom || 1.0;
                const currentVisible = totalDuration / oldZoom;
                
                // Scrolling up (e.deltaY < 0) zooms in (decreases visible duration)
                // Scrolling down (e.deltaY > 0) zooms out (increases visible duration)
                const factor = e.deltaY < 0 ? (1 / 1.1) : 1.1;
                let newVisible = currentVisible * factor;
                
                // Clamp visible duration between 1.0s (maximum zoom) and totalDuration (minimum zoom)
                const minVisible = 1.0;
                const maxVisible = Math.max(1.0, totalDuration);
                newVisible = Math.max(minVisible, Math.min(maxVisible, newVisible));
                
                const newZoom = totalDuration / newVisible;
                
                if (Math.abs(newZoom - oldZoom) > 0.0001) {
                    sharedState.zoom = newZoom;
                    updateBottomStatusBar();
                    
                    // Dynamic import to avoid circular dependencies and trigger re-render
                    import('./track-manager.js').then(m => m.renderTracks());
                }
            }
        }
    }, { passive: false });

    updateBottomStatusBar();
}

export { drawPlayhead, setupTrackInteractions };
