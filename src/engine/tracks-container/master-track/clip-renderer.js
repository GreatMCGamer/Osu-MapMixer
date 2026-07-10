import { sharedState } from '../../../core/shared-state.js';
import { getCachedClip, setCachedClip } from '../../clip-cache.js';
import { getNoteTimes, projectObjectToMaster, convertBeatToMs } from '../../track-utils/index.js';

export function renderMasterClips(contentEl, track, timingAsset, totalDurationMs) {
    if (!track.clips || track.clips.length === 0) return;

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
}
