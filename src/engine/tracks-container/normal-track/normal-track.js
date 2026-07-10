import { sharedState, getHighlightedTrackId } from '../../../core/shared-state.js';
import { renderTimingGridLines } from '../track-ui.js';
import { getNoteTimes } from '../../track-utils/index.js';
import { renderTracks } from '../track-manager.js';
import { getCachedClip, setCachedClip } from '../../clip-cache.js';

export function createNormalTrack(track, fallbackTimingAsset, totalDurationMs) {
    const highlightedId = getHighlightedTrackId();
    const isHighlighted = (track.id === highlightedId);
    
    const trackEl = document.createElement('div');
    trackEl.className = `track ${track.type}${isHighlighted ? ' highlighted' : ''}`;
    trackEl.id = track.id;

    // Track selection helper that updates DOM classes instantly without re-rendering everything
    const selectTrack = () => {
        if (sharedState.highlightedTrackId !== track.id) {
            sharedState.highlightedTrackId = track.id;
            
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

    // Header Section
    const headerEl = document.createElement('div');
    headerEl.className = 'track-header';
    headerEl.style.cursor = 'pointer';
    headerEl.onclick = () => {
        selectTrack();
    };

    const asset = track.sourceAsset;
    let displayName = track.name || "Normal Track";
    let defaultDifficulty = 'Normal';
    if (asset) {
        defaultDifficulty = asset.difficultyName || 'Normal';
        const difficulty = track.difficultyName || defaultDifficulty;
        const artist = asset.artist || 'Unknown Artist';
        const title = asset.title || 'Unknown Title';
        displayName = `[${difficulty}] ${artist} - ${title}`;
    }

    const titleSpan = document.createElement('span');
    titleSpan.innerText = displayName;
    titleSpan.style.fontFamily = "'Space Grotesk', system-ui, sans-serif";
    titleSpan.style.letterSpacing = "0.5px";
    titleSpan.title = "Double click to rename difficulty";

    // Double click to rename
    titleSpan.ondblclick = (e) => {
        e.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.difficultyName || defaultDifficulty;
        input.style.fontFamily = "'Space Grotesk', system-ui, sans-serif";
        input.style.fontSize = '11px';
        input.style.fontWeight = '600';
        input.style.color = '#fff';
        input.style.background = '#222';
        input.style.border = '1px solid #ff66aa';
        input.style.borderRadius = '3px';
        input.style.padding = '1px 4px';
        input.style.width = '100px';
        input.style.outline = 'none';
        
        input.onclick = (e) => e.stopPropagation();
        input.ondblclick = (e) => e.stopPropagation();
        
        let isSaved = false;
        const saveName = () => {
            if (isSaved) return;
            isSaved = true;
            const val = input.value.trim();
            track.difficultyName = val || defaultDifficulty;
            if (asset) {
                track.name = `[${track.difficultyName}] ${asset.artist || 'Unknown Artist'} - ${asset.title || 'Unknown Title'}`;
            } else {
                track.name = val;
            }
            renderTracks();
        };
        
        input.onblur = saveName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveName();
            } else if (e.key === 'Escape') {
                isSaved = true; // prevent double trigger
                renderTracks();
            }
        };
        
        headerEl.replaceChild(input, titleSpan);
        input.focus();
        input.select();
    };

    headerEl.appendChild(titleSpan);

    // Highlight star icon
    const starSpan = document.createElement('span');
    starSpan.className = 'track-highlight-star';
    starSpan.innerText = isHighlighted ? '★' : '☆';
    starSpan.style.marginLeft = 'auto';
    starSpan.style.fontSize = '12px';
    starSpan.style.color = isHighlighted ? '#ff66aa' : '#555';
    headerEl.appendChild(starSpan);

    trackEl.appendChild(headerEl);

    // Timeline Lane Section
    const laneEl = document.createElement('div');
    laneEl.className = 'track-lane';

    // Add inner scrollable content wrapper
    const contentEl = document.createElement('div');
    contentEl.className = 'track-timeline-content';
    contentEl.style.width = `${(sharedState.zoom || 1.0) * 100}%`;

    // Draw timing point indicators and BPM beat grid lines based on this track's own .osu properties
    const trackTimingAsset = track.sourceAsset || fallbackTimingAsset;
    if (trackTimingAsset) {
        renderTimingGridLines(contentEl, trackTimingAsset, totalDurationMs, {
            showRedLines: true,
            showGreenLines: true,
            showBeatLines: true
        });
    }

    // Render Clips and static hit objects if we have sourceAsset
    if (asset && asset.hitObjects && asset.hitObjects.length > 0) {
        const firstObj = asset.hitObjects[0];
        const minTimeMs = firstObj.originalTimeMs || 0;
        let maxTimeMs = minTimeMs;
        
        asset.hitObjects.forEach(obj => {
            const times = getNoteTimes(obj, track);
            if (times.endTime > maxTimeMs) {
                maxTimeMs = times.endTime;
            }
        });

        // Initialize track.clips if not exists
        if (!track.clips) {
            track.clips = [{
                clipId: `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                ownedObjectIds: asset.hitObjects.map(obj => obj.id),
                startTimeMs: minTimeMs,
                endTimeMs: maxTimeMs
            }];
        } else {
            // Ensure ownedObjectIds is populated for all existing clips
            track.clips.forEach(clip => {
                if (!clip.ownedObjectIds) {
                    clip.ownedObjectIds = asset.hitObjects.filter(note => {
                        const times = getNoteTimes(note, track);
                        return times.startTime >= clip.startTimeMs && times.startTime <= clip.endTimeMs;
                    }).map(note => note.id);
                }
            });
        }

        // Draw each clip
        track.clips.forEach(clip => {
            const leftPct = (clip.startTimeMs / totalDurationMs) * 100;
            const widthPct = ((clip.endTimeMs - clip.startTimeMs) / totalDurationMs) * 100;

            // Filter hit objects that fall within this clip's range via robust object ownership
            const clipObjects = asset.hitObjects.filter(note => {
                return clip.ownedObjectIds && clip.ownedObjectIds.includes(note.id);
            });

            let clipEl = getCachedClip(clip.clipId);
            if (!clipEl) {
                clipEl = document.createElement('div');
                clipEl.className = 'timeline-clip';
                clipEl.setAttribute('data-clip-id', clip.clipId);

                // Add upper 1/5 handle for clip selection
                const handleEl = document.createElement('div');
                handleEl.className = 'clip-upper-handle';
                clipEl.appendChild(handleEl);

                clipObjects.forEach(note => {
                    const times = getNoteTimes(note, track);
                    const clipDurationMs = clip.endTimeMs - clip.startTimeMs || 1000;
                    const noteLeftPct = ((times.startTime - clip.startTimeMs) / clipDurationMs) * 100;
                    
                    const noteEl = document.createElement('div');
                    noteEl.className = `timeline-note ${note.type}`;
                    noteEl.style.left = `${noteLeftPct}%`;
                    noteEl.setAttribute('data-note-id', note.id);

                    if (times.endTime > times.startTime) {
                        const noteWidthPct = ((times.endTime - times.startTime) / clipDurationMs) * 100;
                        noteEl.style.width = `${noteWidthPct}%`;
                    }

                    clipEl.appendChild(noteEl);
                });

                setCachedClip(clip.clipId, clipEl);
            }

            // Always ensure the position and size are up to date (e.g. if dragged or scaled)
            clipEl.style.left = `${leftPct}%`;
            clipEl.style.width = `${widthPct}%`;

            const isClipHighlighted = !!(sharedState.highlightSelection &&
                sharedState.highlightSelection.trackId === track.id &&
                sharedState.highlightSelection.clipId === clip.clipId);

            if (isClipHighlighted) {
                clipEl.classList.add('highlighted-clip');
            } else {
                clipEl.classList.remove('highlighted-clip');
            }

            // Dynamically update the selection state of individual notes
            clipObjects.forEach(note => {
                const noteEl = clipEl.querySelector(`[data-note-id="${note.id}"]`);
                if (noteEl) {
                    const times = getNoteTimes(note, track);
                    const isNoteSelected = !!(sharedState.highlightSelection &&
                        sharedState.highlightSelection.trackId === track.id &&
                        times.startTime >= sharedState.highlightSelection.startMs &&
                        times.startTime <= sharedState.highlightSelection.endMs);
                    
                    if (isNoteSelected) {
                        noteEl.classList.add('selected-note');
                    } else {
                        noteEl.classList.remove('selected-note');
                    }
                }
            });

            contentEl.appendChild(clipEl);
        });
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
