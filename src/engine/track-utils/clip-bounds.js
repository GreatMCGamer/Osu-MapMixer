import { getNoteTimes } from './note-utils.js';

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
