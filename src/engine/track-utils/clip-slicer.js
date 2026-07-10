import { sharedState } from '../../core/shared-state.js';
import { convertBeatToMs, convertMsToBeat } from './timing-utils.js';
import { getNoteTimes } from './note-utils.js';
import { getClosestSnapPoint, curateClipLengths } from './clip-bounds.js';

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
    if (!track) return;
    
    // Build master timing segments in case we need them
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

    if (track.type === 'master') {
        if (!track.clips || track.clips.length === 0) return;
        track.clips.forEach(clip => {
            clip.startTimeMs = convertBeatToMs(clip.timelineStartBeat, timingSegments);
            clip.endTimeMs = convertBeatToMs(clip.timelineEndBeat, timingSegments);
        });
    } else {
        if (!track.sourceAsset || !track.sourceAsset.hitObjects) return;
        
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
    }
    
    // Find the clip containing startMs
    const containingClip = track.clips.find(c => startMs >= c.startTimeMs && startMs <= c.endTimeMs);
    if (!containingClip) return;
    
    if (track.type === 'master') {
        const newClips = [];
        if (isHighlight) {
            const startBeat = convertMsToBeat(startMs, timingSegments);
            const endBeat = convertMsToBeat(endMs, timingSegments);
            
            const clipStartBeat = containingClip.timelineStartBeat;
            const clipEndBeat = containingClip.timelineEndBeat;
            
            const leftClip = {
                ...containingClip,
                clipId: `clip-${Date.now()}-L-${Math.floor(Math.random() * 10000)}`,
                timelineStartBeat: clipStartBeat,
                timelineEndBeat: startBeat,
                sourceStartBeat: containingClip.sourceStartBeat
            };
            
            const middleClip = {
                ...containingClip,
                clipId: `clip-${Date.now()}-M-${Math.floor(Math.random() * 10000)}`,
                timelineStartBeat: startBeat,
                timelineEndBeat: endBeat,
                sourceStartBeat: containingClip.sourceStartBeat + (startBeat - clipStartBeat)
            };
            
            const rightClip = {
                ...containingClip,
                clipId: `clip-${Date.now()}-R-${Math.floor(Math.random() * 10000)}`,
                timelineStartBeat: endBeat,
                timelineEndBeat: clipEndBeat,
                sourceStartBeat: containingClip.sourceStartBeat + (endBeat - clipStartBeat)
            };
            
            const partitionedClips = [];
            if (leftClip.timelineEndBeat > leftClip.timelineStartBeat) partitionedClips.push(leftClip);
            if (middleClip.timelineEndBeat > middleClip.timelineStartBeat) partitionedClips.push(middleClip);
            if (rightClip.timelineEndBeat > rightClip.timelineStartBeat) partitionedClips.push(rightClip);
            
            track.clips.forEach(c => {
                if (c.clipId === containingClip.clipId) {
                    newClips.push(...partitionedClips);
                } else {
                    newClips.push(c);
                }
            });
            track.clips = newClips;
            sharedState.highlightSelection = null;
        } else {
            const playheadBeat = convertMsToBeat(startMs, timingSegments);
            
            const clipStartBeat = containingClip.timelineStartBeat;
            const clipEndBeat = containingClip.timelineEndBeat;
            
            const leftClip = {
                ...containingClip,
                clipId: `clip-${Date.now()}-L-${Math.floor(Math.random() * 10000)}`,
                timelineStartBeat: clipStartBeat,
                timelineEndBeat: playheadBeat,
                sourceStartBeat: containingClip.sourceStartBeat
            };
            
            const rightClip = {
                ...containingClip,
                clipId: `clip-${Date.now()}-R-${Math.floor(Math.random() * 10000)}`,
                timelineStartBeat: playheadBeat,
                timelineEndBeat: clipEndBeat,
                sourceStartBeat: containingClip.sourceStartBeat + (playheadBeat - clipStartBeat)
            };
            
            const partitionedClips = [];
            if (leftClip.timelineEndBeat > leftClip.timelineStartBeat) partitionedClips.push(leftClip);
            if (rightClip.timelineEndBeat > rightClip.timelineStartBeat) partitionedClips.push(rightClip);
            
            track.clips.forEach(c => {
                if (c.clipId === containingClip.clipId) {
                    newClips.push(...partitionedClips);
                } else {
                    newClips.push(c);
                }
            });
            track.clips = newClips;
        }
        
        sharedState.masterTimeline = [...track.clips];
    } else {
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
}
