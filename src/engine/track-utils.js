import { sharedState } from '../core/shared-state.js';

/**
 * Calculates start and end times in milliseconds for a hit object, resolving slider/spinner durations
 */
export function getNoteTimes(note, track) {
    const startTime = note.originalTimeMs || 0;
    let endTime = startTime;
    if (note.type === 'slider' && note.sliderData && note.sliderData.durationBeats) {
        let activeMsPerBeat = 500;
        if (track && track.sourceAsset && track.sourceAsset.timingPoints) {
            for (const tp of track.sourceAsset.timingPoints) {
                if (tp.uninherited && tp.beat <= note.beat) {
                    activeMsPerBeat = tp.msPerBeat;
                }
            }
        }
        if (!isFinite(activeMsPerBeat) || isNaN(activeMsPerBeat)) activeMsPerBeat = 0;
        endTime = startTime + note.sliderData.durationBeats * activeMsPerBeat;
    } else if (note.type === 'spinner' && note.spinnerData && note.spinnerData.durationBeats) {
        let activeMsPerBeat = 500;
        if (track && track.sourceAsset && track.sourceAsset.timingPoints) {
            for (const tp of track.sourceAsset.timingPoints) {
                if (tp.uninherited && tp.beat <= note.beat) {
                    activeMsPerBeat = tp.msPerBeat;
                }
            }
        }
        if (!isFinite(activeMsPerBeat) || isNaN(activeMsPerBeat)) activeMsPerBeat = 0;
        endTime = startTime + note.spinnerData.durationBeats * activeMsPerBeat;
    }
    return { startTime, endTime };
}

/**
 * Returns a user-friendly display name for a loaded MP3 file based on available .osu metadata
 * @param {Object} file 
 * @returns {string} Display name
 */
export function getMp3DisplayName(file) {
    if (!sharedState.sourceAssets) return file.filename;
    
    const fileLower = file.filename.toLowerCase();
    
    // 1. Try to find a sourceAsset with exact matching AudioFilename AND matching packageContext
    let match = Object.values(sharedState.sourceAssets).find(asset => {
        return asset.audioFilename && 
               asset.audioFilename.toLowerCase() === fileLower && 
               asset.packageContext === file.packageContext;
    });

    // 2. Try to find any sourceAsset with matching AudioFilename (without packageContext matching)
    if (!match) {
        match = Object.values(sharedState.sourceAssets).find(asset => {
            return asset.audioFilename && asset.audioFilename.toLowerCase() === fileLower;
        });
    }

    // 3. Fallback: if no match, use the first available source asset
    if (!match) {
        const assets = Object.values(sharedState.sourceAssets);
        if (assets.length > 0) {
            match = assets[0];
        }
    }

    if (match && match.title && match.artist) {
        const titleStr = match.title !== "Unknown Title" ? match.title : "";
        const artistStr = match.artist !== "Unknown Artist" ? match.artist : "";
        if (titleStr || artistStr) {
            const label = artistStr && titleStr ? `${artistStr} - ${titleStr}` : (titleStr || artistStr);
            return `${label} (${file.filename})`;
        }
    }
    
    return file.filename;
}

/**
 * Calculates the maximum beat count among all parsed hit objects to determine the timeline scale.
 */
export function getMaxBeats() {
    let max = 100; // Baseline fallback
    if (sharedState.sourceAssets) {
        Object.values(sharedState.sourceAssets).forEach(asset => {
            if (asset.hitObjects && asset.hitObjects.length > 0) {
                asset.hitObjects.forEach(obj => {
                    let endBeat = obj.beat;
                    if (obj.type === 'spinner' && obj.spinnerData) {
                        endBeat = obj.spinnerData.endBeat;
                    } else if (obj.type === 'slider' && obj.sliderData) {
                        endBeat = obj.sliderData.endBeat || (obj.beat + 4);
                    }
                    if (endBeat > max) {
                        max = endBeat;
                    }
                });
            }
        });
    }
    return max + 10; // 10 beats of breathing space at the end
}

export function getBestTimeInterval(visibleDuration) {
    const candidateIntervals = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const target = visibleDuration / 10;
    for (const interval of candidateIntervals) {
        if (interval >= target) {
            return interval;
        }
    }
    return candidateIntervals[candidateIntervals.length - 1];
}

export function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        if (secs % 1 === 0) {
            return `${mins}:${Math.floor(secs).toString().padStart(2, '0')}`;
        } else {
            const integerSecs = Math.floor(secs);
            const dec = Math.round((secs % 1) * 10);
            return `${mins}:${integerSecs.toString().padStart(2, '0')}.${dec}`;
        }
    } else {
        if (secs % 1 === 0) {
            return `${Math.floor(secs)}s`;
        } else {
            return `${secs.toFixed(1)}s`;
        }
    }
}

export function getTimingAndBeatLines(timingAsset, totalDurationMs) {
    const redLines = [];
    const greenLines = [];
    const beatLines = [];

    if (!timingAsset || !timingAsset.timingPoints) {
        return { redLines, greenLines, beatLines };
    }

    // Sort timing points by beat / timeMs
    const tps = [...timingAsset.timingPoints].sort((a, b) => {
        const timeA = typeof a.timeMs === 'number' ? a.timeMs : 0;
        const timeB = typeof b.timeMs === 'number' ? b.timeMs : 0;
        return timeA - timeB;
    });

    // Separate Red and Green lines
    const uninheritedPoints = tps.filter(tp => tp.uninherited);

    // 1. Gather Red Lines
    uninheritedPoints.forEach(tp => {
        const timeMs = tp.timeMs;
        if (typeof timeMs === 'number' && timeMs >= 0 && timeMs <= totalDurationMs) {
            const bpm = tp.msPerBeat > 0 ? Math.round(60000 / tp.msPerBeat) : 120;
            redLines.push({
                timeMs,
                label: `${bpm} BPM`
            });
        }
    });

    // 2. Gather Green Lines ONLY for volume changes (and only if volume actually changed)
    let lastVolume = null;
    tps.forEach(tp => {
        const timeMs = tp.timeMs;
        if (typeof timeMs === 'number' && timeMs >= 0 && timeMs <= totalDurationMs) {
            const currentVolume = typeof tp.volume === 'number' ? tp.volume : 100;
            if (lastVolume !== null && currentVolume !== lastVolume) {
                greenLines.push({
                    timeMs,
                    label: `Vol: ${currentVolume}%`
                });
            }
            lastVolume = currentVolume;
        }
    });

    // 3. Calculate BPM Beats
    for (let i = 0; i < uninheritedPoints.length; i++) {
        const tp = uninheritedPoints[i];
        const startMs = typeof tp.timeMs === 'number' ? tp.timeMs : 0;
        const nextTp = uninheritedPoints[i + 1];
        const endMs = nextTp && typeof nextTp.timeMs === 'number' ? nextTp.timeMs : totalDurationMs;
        const msPerBeat = tp.msPerBeat;

        if (!msPerBeat || msPerBeat < 10) continue; // max 6000 bpm, avoids infinite loops on aspire maps

        let beatIdx = 0;
        let time = startMs;
        
        // Project beats backward from first Red line to 0ms if it starts late
        if (i === 0 && startMs > 0) {
            let backwardTime = startMs - msPerBeat;
            let backwardBeatIdx = -1;
            while (backwardTime >= 0) {
                beatLines.push({
                    timeMs: backwardTime,
                    beatNumber: backwardBeatIdx,
                    isMajor: Math.abs(backwardBeatIdx) % 4 === 0
                });
                backwardTime -= msPerBeat;
                backwardBeatIdx--;
            }
        }

        while (time <= endMs && time <= totalDurationMs) {
            const startBeatVal = typeof tp.beat === 'number' ? tp.beat : 0;
            const beatNum = Math.round(startBeatVal) + beatIdx;
            beatLines.push({
                timeMs: time,
                beatNumber: beatNum,
                isMajor: beatNum % 4 === 0
            });

            time += msPerBeat;
            beatIdx++;
        }
    }

    // Sort beatLines chronologically
    beatLines.sort((a, b) => a.timeMs - b.timeMs);

    return { redLines, greenLines, beatLines };
}

/**
 * Finds the closest snap point (startTime or endTime) of any note on the track relative to a target millisecond timestamp,
 * respecting clip and selection ownership.
 * This satisfies: "Slicing snaps the clip lengths to the closest circle, spinner start/end or slider start/end"
 */
export function getClosestSnapPoint(track, targetMs, options = {}) {
    if (!track || !track.sourceAsset || !track.sourceAsset.hitObjects || track.sourceAsset.hitObjects.length === 0) {
        return targetMs;
    }
    
    const { filterClip, selection, preferInsideSelection } = options;
    
    let closestMs = targetMs;
    let minDiff = Infinity;
    
    track.sourceAsset.hitObjects.forEach(note => {
        // If a filterClip is provided, the note must be "owned" by this clip
        if (filterClip) {
            const isOwned = filterClip.ownedObjectIds && filterClip.ownedObjectIds.includes(note.id);
            if (!isOwned) return;
        }
        
        // If selection is provided and preferInsideSelection is enabled, the note must be within the selection bounds
        if (selection && preferInsideSelection) {
            const { startTime } = getNoteTimes(note, track);
            const isInsideSelection = (startTime >= selection.startMs && startTime <= selection.endMs);
            if (!isInsideSelection) return;
        }
        
        const { startTime, endTime } = getNoteTimes(note, track);
        
        const dStart = Math.abs(startTime - targetMs);
        if (dStart < minDiff) {
            minDiff = dStart;
            closestMs = startTime;
        }
        
        const dEnd = Math.abs(endTime - targetMs);
        if (dEnd < minDiff) {
            minDiff = dEnd;
            closestMs = endTime;
        }
    });
    
    return closestMs;
}

/**
 * Curates/calculates the startTimeMs and endTimeMs boundaries of each clip on a track
 * based on the hit objects they own. Any empty clips are removed.
 */
export function curateClipLengths(track) {
    if (!track.clips || !track.sourceAsset || !track.sourceAsset.hitObjects) return;
    
    track.clips = track.clips.filter(clip => {
        if (!clip.ownedObjectIds || clip.ownedObjectIds.length === 0) {
            return false;
        }
        
        const ownedNotes = track.sourceAsset.hitObjects.filter(note => clip.ownedObjectIds.includes(note.id));
        if (ownedNotes.length === 0) {
            return false;
        }
        
        let minTimeMs = Infinity;
        let maxTimeMs = -Infinity;
        
        ownedNotes.forEach(note => {
            const { startTime, endTime } = getNoteTimes(note, track);
            if (startTime < minTimeMs) minTimeMs = startTime;
            if (endTime > maxTimeMs) maxTimeMs = endTime;
        });
        
        clip.startTimeMs = minTimeMs;
        clip.endTimeMs = maxTimeMs;
        return true;
    });
}

/**
 * Triggers the clip slicing action on the active track.
 * Slices at selection ends if a highlight selection is active, or at the playhead position otherwise.
 * Snaps all slice edges to the closest note start/end boundary.
 */
export function sliceActiveTrack() {
    let trackId = null;
    let isHighlight = false;
    let startMs = 0;
    let endMs = 0;
    
    if (sharedState.highlightSelection) {
        trackId = sharedState.highlightSelection.trackId;
        startMs = sharedState.highlightSelection.startMs;
        endMs = sharedState.highlightSelection.endMs;
        isHighlight = true;
    } else {
        const activeTrackId = sharedState.highlightedTrackId;
        if (!activeTrackId) return;
        trackId = activeTrackId;
        
        const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
        const playheadMs = sharedState.playheadPosition * totalDuration;
        startMs = playheadMs;
        isHighlight = false;
    }
    
    const track = sharedState.tracks.find(t => t.id === trackId);
    if (!track || !track.sourceAsset || !track.sourceAsset.hitObjects) return;
    
    // Initialize clips if needed
    if (!track.clips) {
        const minTimeMs = track.sourceAsset.hitObjects[0].originalTimeMs || 0;
        let maxTimeMs = minTimeMs;
        track.sourceAsset.hitObjects.forEach(obj => {
            const times = getNoteTimes(obj, track);
            if (times.endTime > maxTimeMs) {
                maxTimeMs = times.endTime;
            }
        });
        track.clips = [{
            clipId: `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ownedObjectIds: track.sourceAsset.hitObjects.map(obj => obj.id),
            startTimeMs: minTimeMs,
            endTimeMs: maxTimeMs
        }];
    } else {
        // Ensure all clips have ownedObjectIds
        track.clips.forEach(clip => {
            if (!clip.ownedObjectIds) {
                clip.ownedObjectIds = track.sourceAsset.hitObjects.filter(note => {
                    const times = getNoteTimes(note, track);
                    return times.startTime >= clip.startTimeMs && times.startTime <= clip.endTimeMs;
                }).map(note => note.id);
            }
        });
    }
    
    // Find the clip containing startMs
    const containingClip = track.clips.find(c => startMs >= c.startTimeMs && startMs <= c.endTimeMs);
    if (!containingClip) return;
    
    const newClips = [];
    
    if (isHighlight) {
        const snapStartMs = getClosestSnapPoint(track, startMs, {
            filterClip: containingClip,
            selection: { startMs, endMs },
            preferInsideSelection: true
        });
        const snapEndMs = getClosestSnapPoint(track, endMs, {
            filterClip: containingClip,
            selection: { startMs, endMs },
            preferInsideSelection: true
        });
        
        const leftOwnedIds = [];
        const middleOwnedIds = [];
        const rightOwnedIds = [];
        
        containingClip.ownedObjectIds.forEach(id => {
            const note = track.sourceAsset.hitObjects.find(n => n.id === id);
            if (!note) return;
            const { startTime } = getNoteTimes(note, track);
            if (startTime < snapStartMs) {
                leftOwnedIds.push(id);
            } else if (startTime > snapEndMs) {
                rightOwnedIds.push(id);
            } else {
                middleOwnedIds.push(id);
            }
        });
        
        // Replace containingClip with the partitioned clips
        track.clips.forEach(c => {
            if (c.clipId === containingClip.clipId) {
                if (leftOwnedIds.length > 0) {
                    newClips.push({
                        clipId: `clip-${Date.now()}-L-${Math.floor(Math.random() * 10000)}`,
                        ownedObjectIds: leftOwnedIds,
                        startTimeMs: 0,
                        endTimeMs: 0
                    });
                }
                if (middleOwnedIds.length > 0) {
                    newClips.push({
                        clipId: `clip-${Date.now()}-M-${Math.floor(Math.random() * 10000)}`,
                        ownedObjectIds: middleOwnedIds,
                        startTimeMs: 0,
                        endTimeMs: 0
                    });
                }
                if (rightOwnedIds.length > 0) {
                    newClips.push({
                        clipId: `clip-${Date.now()}-R-${Math.floor(Math.random() * 10000)}`,
                        ownedObjectIds: rightOwnedIds,
                        startTimeMs: 0,
                        endTimeMs: 0
                    });
                }
            } else {
                newClips.push(c);
            }
        });
        
        track.clips = newClips;
        sharedState.highlightSelection = null;
    } else {
        const snapPlayheadMs = getClosestSnapPoint(track, startMs, {
            filterClip: containingClip
        });
        
        const leftOwnedIds = [];
        const rightOwnedIds = [];
        
        containingClip.ownedObjectIds.forEach(id => {
            const note = track.sourceAsset.hitObjects.find(n => n.id === id);
            if (!note) return;
            const { startTime } = getNoteTimes(note, track);
            if (startTime < snapPlayheadMs) {
                leftOwnedIds.push(id);
            } else {
                rightOwnedIds.push(id);
            }
        });
        
        // Replace containingClip with the partitioned clips
        track.clips.forEach(c => {
            if (c.clipId === containingClip.clipId) {
                if (leftOwnedIds.length > 0) {
                    newClips.push({
                        clipId: `clip-${Date.now()}-L-${Math.floor(Math.random() * 10000)}`,
                        ownedObjectIds: leftOwnedIds,
                        startTimeMs: 0,
                        endTimeMs: 0
                    });
                }
                if (rightOwnedIds.length > 0) {
                    newClips.push({
                        clipId: `clip-${Date.now()}-R-${Math.floor(Math.random() * 10000)}`,
                        ownedObjectIds: rightOwnedIds,
                        startTimeMs: 0,
                        endTimeMs: 0
                    });
                }
            } else {
                newClips.push(c);
            }
        });
        
        track.clips = newClips;
    }
    
    // Curate the lengths of the newly split/updated clips
    curateClipLengths(track);
}

/**
 * Translates a global beat coordinate into absolute milliseconds based on BPM segments.
 */
export function convertBeatToMs(beat, segments) {
    if (!segments || segments.length === 0) return 0;
    // Find the active segment (the last segment where beatOffset <= beat)
    let activeSeg = segments[0];
    for (let i = 1; i < segments.length; i++) {
        if (segments[i].beatOffset <= beat + 0.001) { // Adding small epsilon to avoid precision issues
            activeSeg = segments[i];
        } else {
            break;
        }
    }

    const beatDelta = beat - activeSeg.beatOffset;
    let bpm = activeSeg.bpm;
    if (bpm === 0) bpm = 0.0001;
    let msPerBeat = 60000 / bpm;
    if (!isFinite(msPerBeat) || isNaN(msPerBeat)) msPerBeat = 0;
    return activeSeg.startMs + (beatDelta * msPerBeat);
}

/**
 * Translates absolute milliseconds into global beat coordinates based on BPM segments.
 */
export function convertMsToBeat(ms, segments) {
    if (!segments || segments.length === 0) return 0;
    let activeSeg = segments[0];
    for (let i = segments.length - 1; i >= 0; i--) {
        if (ms >= segments[i].startMs - 2) {
            activeSeg = segments[i];
            break;
        }
    }
    const msDelta = ms - activeSeg.startMs;
    let bpm = activeSeg.bpm;
    if (bpm === 0) bpm = 0.0001;
    let msPerBeat = 60000 / bpm;
    if (msPerBeat === 0) msPerBeat = 0.0001;
    if (!isFinite(msPerBeat) || isNaN(msPerBeat)) return activeSeg.beatOffset;
    
    return activeSeg.beatOffset + (msDelta / msPerBeat);
}

function applySpatialTransforms(x, y, transforms) {
    // Linear offsets for now
    let nx = x + (transforms.offsetX || 0);
    let ny = y + (transforms.offsetY || 0);
    if (transforms.mirrorX) nx = 512 - nx;
    if (transforms.mirrorY) ny = 384 - ny;
    return { x: nx, y: ny };
}

/**
 * Projects a raw hit object from an immutable source asset onto the master timeline.
 * Applies both rhythmic time-stretching and spatial vector transforms.
 */
export function projectObjectToMaster(object, clip, globalTimingSegments) {
    // 1. Check if the object falls inside the clip's boundary window
    const relativeBeat = object.beat - clip.sourceStartBeat;
    const targetBeat = clip.timelineStartBeat + relativeBeat;

    // Small epsilon to allow edge cases
    if (targetBeat < clip.timelineStartBeat - 0.001 || targetBeat > clip.timelineEndBeat + 0.001) {
        return null; // Object is sliced out by the clip boundaries
    }

    // 2. Check if the object was explicitly deleted/hidden by the user
    if (clip.deletedObjectIds && clip.deletedObjectIds.includes(object.id)) {
        return null;
    }

    // 3. Convert the master beat position back to absolute milliseconds
    const timeMs = convertBeatToMs(targetBeat, globalTimingSegments);

    // 4. Apply Spatial Vector Transformations (Scale, Rotate, Offset)
    const transforms = clip.transforms || {};
    const transformedCoords = applySpatialTransforms(object.x, object.y, transforms);

    return {
        x: transformedCoords.x,
        y: transformedCoords.y,
        beat: targetBeat,
        timeMs
    };
}

/**
 * Pushes the currently highlighted objects from the active normal track to the last active Master track as a new non-destructive clip.
 */
export function pushSelectionToMaster() {
    const sel = sharedState.highlightSelection;
    if (!sel) {
        console.warn("[Push] No highlight selection active.");
        return;
    }

    const sourceTrack = sharedState.tracks.find(t => t.id === sel.trackId);
    if (!sourceTrack || !sourceTrack.sourceAsset || !sourceTrack.sourceAsset.hitObjects) {
        console.warn("[Push] Source track or hit objects missing.");
        return;
    }

    // Identify target master track
    const targetMasterTrack = sharedState.tracks.find(t => t.id === sharedState.lastActiveMasterId && t.type === 'master')
        || sharedState.tracks.find(t => t.type === 'master');

    if (!targetMasterTrack) {
        console.error("[Push] No Master track found.");
        return;
    }

    if (!targetMasterTrack.clips) {
        targetMasterTrack.clips = [];
    }

    // Build the timing segments for the master track
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

    // Get the selected clip from the source track
    const sourceClip = sourceTrack.clips.find(c => c.clipId === sel.clipId);
    if (!sourceClip) {
        console.warn("[Push] Could not find the source clip corresponding to the selection.");
        return;
    }

    // Calculate source bounds in beats using the source track's timing points
    let sourceTimingSegments = timingSegments; // Fallback to master if not found
    if (sourceTrack.sourceAsset && sourceTrack.sourceAsset.timingPoints) {
        const sourceUninherited = sourceTrack.sourceAsset.timingPoints.filter(tp => tp.uninherited);
        if (sourceUninherited.length > 0) {
             sourceTimingSegments = [];
             const sortedLines = [...sourceUninherited].sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
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
                 sourceTimingSegments.push({
                     segmentId: `seg-${i}`,
                     startMs,
                     bpm: 60000 / msPerBeat,
                     beatOffset: currentBeatOffset
                 });
             }
        }
    }

    // Function to calculate beat from ms for source track
    const msToBeatSource = (ms) => {
        let activeSeg = sourceTimingSegments[0];
        for (let i = sourceTimingSegments.length - 1; i >= 0; i--) {
            if (ms >= sourceTimingSegments[i].startMs - 2) {
                activeSeg = sourceTimingSegments[i];
                break;
            }
        }
        return activeSeg.beatOffset + ((ms - activeSeg.startMs) / (60000 / activeSeg.bpm));
    };
    
    // Function to calculate beat from ms for master track
    const msToBeatMaster = (ms) => {
        let activeSeg = timingSegments[0];
        for (let i = timingSegments.length - 1; i >= 0; i--) {
            if (ms >= timingSegments[i].startMs - 2) {
                activeSeg = timingSegments[i];
                break;
            }
        }
        return activeSeg.beatOffset + ((ms - activeSeg.startMs) / (60000 / activeSeg.bpm));
    };

    // Calculate source Start/End beats
    const sourceStartBeat = msToBeatSource(sel.startMs);
    const sourceEndBeat = msToBeatSource(sel.endMs);
    const durationBeats = sourceEndBeat - sourceStartBeat;

    // We need to find the first object in the selection
    const highlightedObjects = sourceTrack.sourceAsset.hitObjects.filter(note => {
        const times = getNoteTimes(note, sourceTrack);
        return times.startTime >= sel.startMs && times.startTime <= sel.endMs;
    }).sort((a, b) => getNoteTimes(a, sourceTrack).startTime - getNoteTimes(b, sourceTrack).startTime);

    if (highlightedObjects.length === 0) {
        console.warn("[Push] No objects found in the highlighted selection.");
        return;
    }

    const firstObj = highlightedObjects[0];
    const firstObjTimeMs = getNoteTimes(firstObj, sourceTrack).startTime;

    // First we look at what is the closest beat in the clips parent (source).
    const firstObjBeatSource = msToBeatSource(firstObjTimeMs);
    const closestBeatSource = Math.round(firstObjBeatSource);
    
    // Then we look if the first object is offset from the closest beat and by what size fraction of a beat.
    const offsetFraction = firstObjBeatSource - closestBeatSource;

    // We look at what is the closest beat to the first object in the clip on master.
    const floatFirstObjBeatMaster = msToBeatMaster(firstObjTimeMs);
    const closestBeatMaster = Math.round(floatFirstObjBeatMaster);
    
    // Then if it was offset by some fraction of a beat, we will apply that fractional offset to the clip.
    const targetFirstObjBeatMaster = closestBeatMaster + offsetFraction;

    // The distance from the clip start to the first object on the source track:
    const diffFromClipStart = firstObjBeatSource - sourceStartBeat;
    
    // The target timeline start beat for the clip on master:
    const targetTimelineStartBeat = targetFirstObjBeatMaster - diffFromClipStart;

    const newMapClip = {
        clipId: `clip-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        sourceAssetId: sourceTrack.sourceAsset.assetId,
        timelineStartBeat: targetTimelineStartBeat,
        timelineEndBeat: targetTimelineStartBeat + durationBeats,
        sourceStartBeat: sourceStartBeat,
        transforms: {
            spatialScale: 1.0,
            rotationDegrees: 0,
            offsetX: 0,
            offsetY: 0,
            mirrorX: false,
            mirrorY: false
        },
        deletedObjectIds: []
    };

    targetMasterTrack.clips.push(newMapClip);
    
    // We do NOT modify source track hit objects anymore!
    
    // Update master timeline reference in projectState (this might be useful if we serialize it later)
    if (!sharedState.masterTimeline) {
        sharedState.masterTimeline = [];
    }
    sharedState.masterTimeline.push(newMapClip);

    // Set highlight selection to the newly pushed clip on Master track
    const newStartMs = convertBeatToMs(newMapClip.timelineStartBeat, timingSegments);
    const newEndMs = convertBeatToMs(newMapClip.timelineEndBeat, timingSegments);
    
    sharedState.highlightSelection = {
        trackId: targetMasterTrack.id,
        startMs: newStartMs,
        endMs: newEndMs,
        clipId: newMapClip.clipId
    };
    sharedState.highlightedTrackId = targetMasterTrack.id;

    console.log(`[Push] Projected clip non-destructively to Master Track ${targetMasterTrack.id} as MapClip ${newMapClip.clipId}`);
}
