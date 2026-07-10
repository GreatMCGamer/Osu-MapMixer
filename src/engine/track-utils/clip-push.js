import { sharedState } from '../../core/shared-state.js';
import { getNoteTimes } from './note-utils.js';
import { convertBeatToMs } from './timing-utils.js';

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
