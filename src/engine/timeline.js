/**
 * Interactive Timeline Component (Master Track)
 * Governs interactions, render positioning, and playhead updates for the sequencing track
 */
import { sharedState } from '../core/shared-state.js';
import { drawCanvas } from '../ui/canvas.js';
import { convertBeatToMs, convertMsToBeat } from './track-utils.js';

function getTimingSegments() {
    const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
        ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] 
        : null;
        
    let timingSegments = [];
    if (timingAsset && timingAsset.timingPoints) {
        const uninheritedPoints = timingAsset.timingPoints.filter(tp => tp.uninherited);
        const sortedLines = [...uninheritedPoints].sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
        
        let currentBeatOffset = 0;
        let lastMs = 0;
        let lastMsPerBeat = 0;
        for (let i = 0; i < sortedLines.length; i++) {
            const startMs = sortedLines[i].timeMs || 0;
            const msPerBeat = sortedLines[i].msPerBeat || 500;
            
            if (lastMsPerBeat > 0) {
                currentBeatOffset += (startMs - lastMs) / lastMsPerBeat;
            }
            
            lastMs = startMs;
            lastMsPerBeat = msPerBeat;
            timingSegments.push({
                segmentId: `seg-${i}`,
                startMs,
                bpm: 60000 / msPerBeat,
                beatOffset: currentBeatOffset
            });
        }
    }
    if (timingSegments.length === 0) {
        timingSegments.push({ segmentId: 'fallback', startMs: 0, bpm: 120, beatOffset: 0 });
    }
    return timingSegments;
}

function getClipTimeRange(clip, timingSegments) {
    const isNonDestructive = (clip.sourceAssetId !== undefined);
    let startMs, endMs;
    if (isNonDestructive) {
        startMs = convertBeatToMs(clip.timelineStartBeat, timingSegments);
        endMs = convertBeatToMs(clip.timelineEndBeat, timingSegments);
    } else {
        startMs = clip.startTimeMs || 0;
        endMs = clip.endTimeMs || 0;
    }
    return { startMs, endMs, duration: endMs - startMs };
}

/**
 * Updates the zoom amount indicator in the bottom status bar
 */
export function updateBottomStatusBar() {
    const t0 = performance.now();
    const zoomBubble = document.getElementById('zoom-bubble');
    const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration : 180.0;
    if (zoomBubble) {
        const visibleDuration = totalDuration / (sharedState.zoom || 1.0);
        zoomBubble.innerText = `Visible: ${visibleDuration.toFixed(1)}s`;
    }

    const playheadBubble = document.getElementById('playhead-bubble');
    if (playheadBubble) {
        const playheadTime = sharedState.playheadPosition * totalDuration;
        
        const mins = Math.floor(playheadTime / 60);
        const secs = Math.floor(playheadTime % 60);
        const ms = Math.floor((playheadTime % 1) * 1000);
        const timestampStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        
        const totalMins = Math.floor(totalDuration / 60);
        const totalSecs = Math.floor(totalDuration % 60);
        const totalMs = Math.floor((totalDuration % 1) * 1000);
        const totalStr = `${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}.${totalMs.toString().padStart(3, '0')}`;
        
        playheadBubble.innerText = `Time: ${timestampStr} / ${totalStr}`;
    }
    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.statusBarUpdateMs = performance.now() - t0;
    }
}

/**
 * Computes and updates the CSS positioning of the red playhead line based on the global state's playhead percentage
 */
function drawPlayhead() {
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

/**
 * Listens for user clicks on the master track container to recalculate and seek the playback timeline's percentage
 */
function setupTrackInteractions() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    
    let isDragging = false;
    let dragStartMs = 0;
    let dragTrackId = null;
    let dragStartX = 0;

    let isDraggingClip = false;
    let draggedClipTrackId = null;
    let draggedClipId = null;
    let draggedClipStartBeat = 0;
    let draggedClipStartMs = 0;
    let draggedClipDurationBeats = 0;
    let draggedClipDurationMs = 0;
    let dragClipStartMouseMs = 0;
    let dragClipStartMouseBeat = 0;

    const calculateTimeForTrack = (clientX, trackId) => {
        const trackEl = document.getElementById(trackId);
        if (!trackEl) return 0;
        const contentEl = trackEl.querySelector('.track-timeline-content');
        if (!contentEl) return 0;
        const contentRect = contentEl.getBoundingClientRect();
        const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
        const x = clientX - contentRect.left;
        const timeMs = (x / contentRect.width) * totalDuration;
        return Math.max(0, Math.min(totalDuration, timeMs));
    };

    // Mousedown on track lanes to start drag-highlight
    container.addEventListener('mousedown', function(e) {
        const lane = e.target.closest('.track-lane');
        const trackEl = e.target.closest('.track');
        if (!lane || !trackEl) return;

        // Ignore if clicking on buttons, badges, three-dots options, options menu, or renaming inputs
        if (
            e.target.closest('.track-icon') || 
            e.target.closest('.timing-segment-indicator') || 
            e.target.closest('.options-btn') || 
            e.target.closest('.options-dropdown') ||
            e.target.tagName.toLowerCase() === 'input'
        ) {
            return;
        }

        // Intercept upper edge clip selection
        const laneRect = lane.getBoundingClientRect();
        const clickYPct = (e.clientY - laneRect.top) / laneRect.height;
        const isUpperHandleClick = clickYPct <= 0.2 || !!e.target.closest('.clip-upper-handle');

        if (isUpperHandleClick) {
            const trackId = trackEl.id;
            const track = sharedState.tracks.find(t => t.id === trackId);
            if (track && track.clips && track.clips.length > 0) {
                const clickMs = calculateTimeForTrack(e.clientX, trackId);
                const timingSegments = getTimingSegments();
                
                // Find all clips on this track that contain clickMs
                const overlappingClips = [];
                track.clips.forEach(clip => {
                    const range = getClipTimeRange(clip, timingSegments);
                    // 5ms padding for friendly click boundaries
                    if (clickMs >= range.startMs - 5 && clickMs <= range.endMs + 5) {
                        overlappingClips.push({ clip, range });
                    }
                });

                if (overlappingClips.length > 0) {
                    // Sort overlapping clips by duration ascending (shortest first)
                    overlappingClips.sort((a, b) => a.range.duration - b.range.duration);
                    
                    const bestMatch = overlappingClips[0];
                    const clip = bestMatch.clip;
                    const range = bestMatch.range;
                    
                    sharedState.highlightSelection = {
                        trackId: trackId,
                        startMs: range.startMs,
                        endMs: range.endMs,
                        clipId: clip.clipId
                    };
                    sharedState.highlightedTrackId = trackId;
                    if (track.type === 'master') {
                        sharedState.lastActiveMasterId = track.id;
                        
                        // Initialize clip dragging state only for master tracks
                        isDraggingClip = true;
                        draggedClipTrackId = trackId;
                        draggedClipId = clip.clipId;
                        
                        const isNonDestructive = (clip.sourceAssetId !== undefined);
                        if (isNonDestructive) {
                            draggedClipStartBeat = clip.timelineStartBeat;
                            draggedClipDurationBeats = clip.timelineEndBeat - clip.timelineStartBeat;
                            dragClipStartMouseBeat = convertMsToBeat(clickMs, timingSegments);
                        } else {
                            draggedClipStartMs = clip.startTimeMs || 0;
                            draggedClipDurationMs = (clip.endTimeMs || 0) - (clip.startTimeMs || 0);
                            dragClipStartMouseMs = clickMs;
                        }
                    }
                    
                    isDragging = false;
                    
                    import('./track-manager.js').then(m => m.renderTracks());
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }

        isDragging = true;
        dragTrackId = trackEl.id;
        dragStartX = e.clientX;
        dragStartMs = calculateTimeForTrack(e.clientX, dragTrackId);

        sharedState.highlightSelection = {
            trackId: dragTrackId,
            startMs: dragStartMs,
            endMs: dragStartMs
        };

        // Instantly select/highlight the track
        if (sharedState.highlightedTrackId !== dragTrackId) {
            sharedState.highlightedTrackId = dragTrackId;
            const track = sharedState.tracks.find(t => t.id === dragTrackId);
            if (track) {
                if (track.type === 'master') {
                    sharedState.lastActiveMasterId = track.id;
                    if (!track.difficulty) {
                        track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
                    }
                    sharedState.lastMasterDifficulty = { ...track.difficulty };
                }
            }
        }

        e.preventDefault(); // Prevent standard text selection/drag behaviors
    });

    // Mousemove for updating selection range or clip positions
    window.addEventListener('mousemove', function(e) {
        if (isDraggingClip && draggedClipTrackId && draggedClipId) {
            const currentMs = calculateTimeForTrack(e.clientX, draggedClipTrackId);
            const track = sharedState.tracks.find(t => t.id === draggedClipTrackId);
            if (track && track.clips) {
                const clip = track.clips.find(c => c.clipId === draggedClipId);
                if (clip) {
                    const timingSegments = getTimingSegments();
                    const isNonDestructive = (clip.sourceAssetId !== undefined);
                    const beatDivider = sharedState.beatDivider || 4;
                    
                    if (isNonDestructive) {
                        const currentMouseBeat = convertMsToBeat(currentMs, timingSegments);
                        const beatDelta = currentMouseBeat - dragClipStartMouseBeat;
                        const targetStartBeat = draggedClipStartBeat + beatDelta;
                        
                        // Snap to closest fraction of a beat in accordance with the beat divider
                        const snappedStartBeat = Math.round(targetStartBeat * beatDivider) / beatDivider;
                        
                        clip.timelineStartBeat = snappedStartBeat;
                        clip.timelineEndBeat = snappedStartBeat + draggedClipDurationBeats;
                        
                        // Sync highlight selection to stay matched with the clip's dragging boundaries
                        const startMs = convertBeatToMs(clip.timelineStartBeat, timingSegments);
                        const endMs = convertBeatToMs(clip.timelineEndBeat, timingSegments);
                        sharedState.highlightSelection = {
                            trackId: draggedClipTrackId,
                            startMs,
                            endMs,
                            clipId: clip.clipId
                        };
                    } else {
                        // Legacy clip dragging (millisecond-based)
                        const msDelta = currentMs - dragClipStartMouseMs;
                        const targetStartMs = draggedClipStartMs + msDelta;
                        
                        // Convert to beat to apply beat-divider snapping
                        const targetStartBeat = convertMsToBeat(targetStartMs, timingSegments);
                        const snappedStartBeat = Math.round(targetStartBeat * beatDivider) / beatDivider;
                        const snappedStartMs = convertBeatToMs(snappedStartBeat, timingSegments);
                        
                        clip.startTimeMs = snappedStartMs;
                        clip.endTimeMs = snappedStartMs + draggedClipDurationMs;
                        
                        sharedState.highlightSelection = {
                            trackId: draggedClipTrackId,
                            startMs: clip.startTimeMs,
                            endMs: clip.endTimeMs,
                            clipId: clip.clipId
                        };
                    }
                    
                    import('./track-manager.js').then(m => m.renderTracks());
                    import('../ui/canvas.js').then(m => m.drawCanvas());
                }
            }
            return;
        }

        if (!isDragging || !dragTrackId) return;

        const currentMs = calculateTimeForTrack(e.clientX, dragTrackId);
        sharedState.highlightSelection = {
            trackId: dragTrackId,
            startMs: Math.min(dragStartMs, currentMs),
            endMs: Math.max(dragStartMs, currentMs)
        };

        // Render tracks instantly to update the selection overlay and highlighted notes
        import('./track-manager.js').then(m => m.renderTracks());
    });

    // Mouseup to lock selection, seek playhead, or release clip
    window.addEventListener('mouseup', function(e) {
        if (isDraggingClip) {
            isDraggingClip = false;
            draggedClipTrackId = null;
            draggedClipId = null;
            import('./track-manager.js').then(m => m.renderTracks());
            import('../ui/canvas.js').then(m => m.drawCanvas());
            return;
        }

        if (!isDragging || !dragTrackId) return;
        isDragging = false;

        const currentMs = calculateTimeForTrack(e.clientX, dragTrackId);
        const diffX = Math.abs(e.clientX - dragStartX);

        // Robust drag vs click threshold: if mouse moved less than 5 pixels, treat as a single seek-click
        const isClick = diffX < 5;

        if (isClick) {
            const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
            sharedState.playheadPosition = currentMs / totalDuration;
            sharedState.highlightSelection = null;
        } else {
            sharedState.highlightSelection = {
                trackId: dragTrackId,
                startMs: Math.min(dragStartMs, currentMs),
                endMs: Math.max(dragStartMs, currentMs)
            };
        }

        dragTrackId = null;

        import('./track-manager.js').then(m => m.renderTracks());
    });

    // Setup capture scroll event listener for syncing scroll across lanes
    let isSyncingScroll = false;
    container.addEventListener('scroll', function(e) {
        if (isSyncingScroll) return;
        const lane = e.target.closest('.track-lane');
        if (!lane) return;
        
        isSyncingScroll = true;
        const currentScrollLeft = lane.scrollLeft;
        sharedState.scrollLeft = currentScrollLeft;
        
        const lanes = container.querySelectorAll('.track-lane');
        lanes.forEach(otherLane => {
            if (otherLane !== lane && Math.abs(otherLane.scrollLeft - currentScrollLeft) > 1) {
                otherLane.scrollLeft = currentScrollLeft;
            }
        });
        isSyncingScroll = false;
    }, true);

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
                // Zoom timeline horizontally based on visible duration towards mouse position
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
                    const activeLane = e.target.closest('.track-lane') || document.querySelector('.track-lane');
                    const laneWidth = activeLane ? activeLane.offsetWidth : window.innerWidth;
                    
                    let mouseXInLane = laneWidth / 2;
                    if (activeLane) {
                        const rect = activeLane.getBoundingClientRect();
                        mouseXInLane = e.clientX - rect.left;
                    }
                    
                    // Always use sharedState.scrollLeft as the single source of truth to avoid async DOM layout lag
                    const currentScrollLeft = sharedState.scrollLeft || 0;
                    const absoluteXBefore = mouseXInLane + currentScrollLeft;
                    const pct = absoluteXBefore / (laneWidth * oldZoom);
                    const absoluteXAfter = pct * (laneWidth * newZoom);
                    
                    const newScrollLeft = absoluteXAfter - mouseXInLane;
                    const newScrollMax = Math.max(0, (laneWidth * newZoom) - laneWidth);
                    sharedState.scrollLeft = Math.max(0, Math.min(newScrollMax, newScrollLeft));
                    
                    sharedState.zoom = newZoom;
                    
                    // Update the DOM width and scroll position synchronously
                    drawPlayhead();
                    updateBottomStatusBar();
                    
                    // Dynamic import to avoid circular dependencies and trigger re-render of clips/contents
                    import('./track-manager.js').then(m => m.renderTracks());
                }
            }
        }
    }, { passive: false });

    updateBottomStatusBar();
}

export { drawPlayhead, setupTrackInteractions };
