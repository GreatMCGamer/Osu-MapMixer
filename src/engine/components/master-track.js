import { sharedState, getHighlightedTrackId } from '../../core/shared-state.js';
import { renderTimingGridLines, toggleDifficultyDropdown } from '../track-ui.js';
import { renderTracks } from '../track-manager.js';
import { getNoteTimes, projectObjectToMaster, convertBeatToMs } from '../track-utils.js';
import { getCachedClip, setCachedClip } from '../clip-cache.js';

export function createMasterTrack(track, timingAsset, totalDurationMs, index) {
    const highlightedId = getHighlightedTrackId();
    const isHighlighted = (track.id === highlightedId);
    
    const trackEl = document.createElement('div');
    trackEl.className = `track ${track.type}${isHighlighted ? ' highlighted' : ''}`;
    trackEl.id = track.id;

    // Track selection helper that updates DOM classes instantly without re-rendering everything (preventing DOM nodes from being destroyed during double-clicks)
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
            import('../../ui/canvas.js').then(m => m.drawCanvas());
        }
    };

    // Header Section
    const headerEl = document.createElement('div');
    headerEl.className = 'track-header';
    headerEl.style.cursor = 'pointer';
    headerEl.onclick = () => {
        selectTrack();
    };

    // Three dot options box for difficulty settings
    const optionsBtn = document.createElement('span');
    optionsBtn.className = 'track-icon options-master-icon';
    optionsBtn.innerText = '•••';
    optionsBtn.style.marginRight = '8px';
    optionsBtn.style.padding = '1px 4px';
    optionsBtn.style.borderRadius = '3px';
    optionsBtn.style.backgroundColor = '#1a1a1a';
    optionsBtn.style.color = '#ff66aa';
    optionsBtn.style.fontSize = '9px';
    optionsBtn.style.cursor = 'pointer';
    optionsBtn.style.border = '1px solid #ff66aa';
    optionsBtn.style.display = 'inline-flex';
    optionsBtn.style.alignItems = 'center';
    optionsBtn.style.justifyContent = 'center';
    optionsBtn.style.verticalAlign = 'middle';
    optionsBtn.onclick = (e) => {
        e.stopPropagation();
        sharedState.highlightedTrackId = track.id;
        if (!track.difficulty) {
            track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
        }
        sharedState.lastMasterDifficulty = { ...track.difficulty };
        renderTracks();
        
        // Open the difficulty settings dropdown at the newly rendered optionsBtn
        setTimeout(() => {
            const newTrackEl = document.getElementById(track.id);
            if (newTrackEl) {
                const newOptionsBtn = newTrackEl.querySelector('.options-master-icon');
                if (newOptionsBtn) {
                    toggleDifficultyDropdown(track, newOptionsBtn);
                }
            }
        }, 0);
    };
    headerEl.appendChild(optionsBtn);

    const titleSpan = document.createElement('span');
    titleSpan.innerText = track.name || 'Master';
    titleSpan.style.fontFamily = "'Space Grotesk', system-ui, sans-serif";
    titleSpan.style.letterSpacing = "0.5px";
    titleSpan.title = "Double click to rename";
    
    // Double click to rename
    titleSpan.ondblclick = (e) => {
        e.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.name || 'Master';
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
            track.name = val || 'Master';
            track.difficultyName = val || 'Master';
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

    const numberBadge = document.createElement('span');
    numberBadge.className = 'info-bubble';
    numberBadge.innerText = `${index}`;
    numberBadge.style.marginLeft = '8px';
    numberBadge.style.backgroundColor = 'rgba(255, 102, 170, 0.15)';
    numberBadge.style.color = '#ff66aa';
    numberBadge.style.borderColor = 'rgba(255, 102, 170, 0.3)';
    headerEl.appendChild(numberBadge);

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
    
    // Draw timing point indicators and BPM beat grid lines
    if (timingAsset) {
        renderTimingGridLines(contentEl, timingAsset, totalDurationMs, {
            showRedLines: false,
            showGreenLines: true,
            showBeatLines: true
        });
    }

    // Render Clips and static hit objects if we have sourceAsset
    if (track.clips && track.clips.length > 0) {
        
        // Build timing segments for the master track
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

        // Draw each clip
        track.clips.forEach(clip => {
            const isNonDestructive = (clip.sourceAssetId !== undefined);
            
            let clipStartMs, clipEndMs;
            if (isNonDestructive) {
                clipStartMs = convertBeatToMs(clip.timelineStartBeat, timingSegments);
                clipEndMs = convertBeatToMs(clip.timelineEndBeat, timingSegments);
            } else {
                clipStartMs = clip.startTimeMs;
                clipEndMs = clip.endTimeMs;
            }

            const leftPct = (clipStartMs / totalDurationMs) * 100;
            const widthPct = ((clipEndMs - clipStartMs) / totalDurationMs) * 100;

            let clipEl = getCachedClip(clip.clipId);
            if (!clipEl) {
                clipEl = document.createElement('div');
                clipEl.className = 'timeline-clip';
                if (isNonDestructive) {
                    clipEl.classList.add('non-destructive-clip');
                }
                clipEl.setAttribute('data-clip-id', clip.clipId);

                // Add upper 1/5 handle for clip selection
                const handleEl = document.createElement('div');
                handleEl.className = 'clip-upper-handle';
                clipEl.appendChild(handleEl);

                const clipDurationMs = clipEndMs - clipStartMs || 1000;

                if (isNonDestructive) {
                    const sourceAsset = sharedState.sourceAssets ? sharedState.sourceAssets[clip.sourceAssetId] : null;
                    if (sourceAsset && sourceAsset.hitObjects) {
                        sourceAsset.hitObjects.forEach(note => {
                            const projected = projectObjectToMaster(note, clip, timingSegments);
                            if (!projected) return;
                            
                            const noteStartMs = projected.timeMs;
                            let noteEndMs = noteStartMs;
                            
                            if (note.type === 'slider' && note.sliderData) {
                                const durationBeats = note.sliderData.durationBeats || 4;
                                noteEndMs = convertBeatToMs(projected.beat + durationBeats, timingSegments);
                            } else if (note.type === 'spinner' && note.spinnerData) {
                                const durationBeats = note.spinnerData.durationBeats || 4;
                                noteEndMs = convertBeatToMs(projected.beat + durationBeats, timingSegments);
                            }

                            const noteLeftPct = ((noteStartMs - clipStartMs) / clipDurationMs) * 100;
                            const noteEl = document.createElement('div');
                            noteEl.className = `timeline-note ${note.type}`;
                            noteEl.style.left = `${noteLeftPct}%`;
                            noteEl.setAttribute('data-note-id', note.id);

                            if (noteEndMs > noteStartMs) {
                                const noteWidthPct = ((noteEndMs - noteStartMs) / clipDurationMs) * 100;
                                noteEl.style.width = `${noteWidthPct}%`;
                            }

                            clipEl.appendChild(noteEl);
                        });
                    }
                } else {
                    // Legacy clip logic
                    const asset = track.sourceAsset;
                    if (asset && asset.hitObjects) {
                        const clipObjects = asset.hitObjects.filter(note => {
                            return clip.ownedObjectIds && clip.ownedObjectIds.includes(note.id);
                        });

                        clipObjects.forEach(note => {
                            const times = getNoteTimes(note, track);
                            const noteLeftPct = ((times.startTime - clipStartMs) / clipDurationMs) * 100;
                            
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
                    }
                }

                setCachedClip(clip.clipId, clipEl);
            }

            // Always update position/size and selection class dynamically on the cached element
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
            if (isNonDestructive) {
                const sourceAsset = sharedState.sourceAssets ? sharedState.sourceAssets[clip.sourceAssetId] : null;
                if (sourceAsset && sourceAsset.hitObjects) {
                    sourceAsset.hitObjects.forEach(note => {
                        const noteEl = clipEl.querySelector(`[data-note-id="${note.id}"]`);
                        if (noteEl) {
                            const projected = projectObjectToMaster(note, clip, timingSegments);
                            if (projected) {
                                const noteStartMs = projected.timeMs;
                                const isNoteSelected = !!(sharedState.highlightSelection &&
                                    sharedState.highlightSelection.trackId === track.id &&
                                    noteStartMs >= sharedState.highlightSelection.startMs &&
                                    noteStartMs <= sharedState.highlightSelection.endMs);
                                
                                if (isNoteSelected) {
                                    noteEl.classList.add('selected-note');
                                } else {
                                    noteEl.classList.remove('selected-note');
                                }
                            }
                        }
                    });
                }
            } else {
                const asset = track.sourceAsset;
                if (asset && asset.hitObjects) {
                    const clipObjects = asset.hitObjects.filter(note => {
                        return clip.ownedObjectIds && clip.ownedObjectIds.includes(note.id);
                    });

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
                }
            }

            contentEl.appendChild(clipEl);
        });
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
