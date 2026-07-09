import { sharedState, getHighlightedTrackId } from '../core/shared-state.js';
import { getNoteTimes, projectObjectToMaster, convertBeatToMs } from './track-utils.js';

/**
 * Checks if a track contains a pattern clip active at a specific timestamp.
 */
export function trackHasClipAt(track, timeMs) {
    if (track.clips && track.clips.length > 0) {
        let timingSegments = [];
        const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
            ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] : null;
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

        return track.clips.some(c => {
            const isNonDestructive = (c.sourceAssetId !== undefined);
            if (isNonDestructive) {
                const clipStartMs = convertBeatToMs(c.timelineStartBeat, timingSegments);
                const clipEndMs = convertBeatToMs(c.timelineEndBeat, timingSegments);
                return timeMs >= clipStartMs && timeMs <= clipEndMs;
            } else {
                return timeMs >= c.startTimeMs && timeMs <= c.endTimeMs;
            }
        });
    }

    if (!track.sourceAsset || !track.sourceAsset.hitObjects || track.sourceAsset.hitObjects.length === 0) {
        return false;
    }
    
    const firstObj = track.sourceAsset.hitObjects[0];
    const minTime = firstObj.originalTimeMs || 0;
    
    let maxTime = minTime;
    track.sourceAsset.hitObjects.forEach(note => {
        const times = getNoteTimes(note, track);
        if (times.endTime > maxTime) {
            maxTime = times.endTime;
        }
    });
    
    return timeMs >= minTime && timeMs <= maxTime;
}

/**
 * Compiles/extracts all active preview objects across all tracks depending on highlighting
 * and fallbacks, then populates the global `sharedState.ghostPreviewTrack`.
 * 
 * @param {number} currentTimeMs - Active viewport playhead time
 * @param {number} AR_TIME - Approach Rate threshold in ms
 */
export function compilePreviewTrack() {
    const compiledObjects = [];

    // Build timing segments for master track
    let timingSegments = [];
    const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
        ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] : null;
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

    const activeTrackId = getHighlightedTrackId();
    let highlightedTrack = activeTrackId ? sharedState.tracks.find(t => t.id === activeTrackId) : null;

    const processTrack = (track, filterFn) => {
        if (track.clips && track.clips.length > 0) {
            track.clips.forEach(clip => {
                const isNonDestructive = (clip.sourceAssetId !== undefined);
                if (isNonDestructive) {
                    const sourceAsset = sharedState.sourceAssets ? sharedState.sourceAssets[clip.sourceAssetId] : null;
                    if (sourceAsset && sourceAsset.hitObjects) {
                        sourceAsset.hitObjects.forEach(origNote => {
                            const projected = projectObjectToMaster(origNote, clip, timingSegments);
                            if (!projected) return;
                            
                            const noteStartMs = projected.timeMs;
                            if (filterFn && !filterFn(noteStartMs, track)) return;
                            
                            let noteEndMs = noteStartMs;
                            
                            if (origNote.type === 'slider' && origNote.sliderData) {
                                const durationBeats = origNote.sliderData.durationBeats || 4;
                                noteEndMs = convertBeatToMs(projected.beat + durationBeats, timingSegments);
                            } else if (origNote.type === 'spinner' && origNote.spinnerData) {
                                const durationBeats = origNote.spinnerData.durationBeats || 4;
                                noteEndMs = convertBeatToMs(projected.beat + durationBeats, timingSegments);
                            }

                            compiledObjects.push({
                                id: origNote.id,
                                type: origNote.type,
                                x: projected.x,
                                y: projected.y,
                                beat: projected.beat,
                                startTime: noteStartMs,
                                endTime: noteEndMs,
                                comboNumber: origNote.comboNumber,
                                isNewCombo: origNote.isNewCombo,
                                hitsound: origNote.hitsound,
                                sliderData: origNote.sliderData,
                                spinnerData: origNote.spinnerData,
                                trackId: track.id
                            });
                        });
                    }
                } else {
                    if (!track.sourceAsset || !track.sourceAsset.hitObjects) return;
                    track.sourceAsset.hitObjects.forEach(note => {
                        if (clip.ownedObjectIds && clip.ownedObjectIds.includes(note.id)) {
                            const { startTime, endTime } = getNoteTimes(note, track);
                            if (filterFn && !filterFn(startTime, track)) return;
                            
                            compiledObjects.push({
                                id: note.id,
                                type: note.type,
                                x: note.x,
                                y: note.y,
                                beat: note.beat,
                                startTime,
                                endTime,
                                comboNumber: note.comboNumber,
                                isNewCombo: note.isNewCombo,
                                hitsound: note.hitsound,
                                sliderData: note.sliderData,
                                spinnerData: note.spinnerData,
                                trackId: track.id
                            });
                        }
                    });
                }
            });
        } else if (track.sourceAsset && track.sourceAsset.hitObjects) {
            track.sourceAsset.hitObjects.forEach(note => {
                const { startTime, endTime } = getNoteTimes(note, track);
                if (filterFn && !filterFn(startTime, track)) return;
                
                compiledObjects.push({
                    id: note.id,
                    type: note.type,
                    x: note.x,
                    y: note.y,
                    beat: note.beat,
                    startTime,
                    endTime,
                    comboNumber: note.comboNumber,
                    isNewCombo: note.isNewCombo,
                    hitsound: note.hitsound,
                    sliderData: note.sliderData,
                    spinnerData: note.spinnerData,
                    trackId: track.id
                });
            });
        }
    };

    if (highlightedTrack && highlightedTrack.type === 'normal') {
        processTrack(highlightedTrack, () => true);
    } else {
        const masterTrack = sharedState.tracks.find(t => t.type === 'master');
        const normalTracks = sharedState.tracks.filter(t => t.type === 'normal');

        if (masterTrack) {
            processTrack(masterTrack, () => true);
        }

        normalTracks.forEach(nt => {
            processTrack(nt, (startTime, track) => {
                if (masterTrack && trackHasClipAt(masterTrack, startTime)) {
                    return false;
                }
                const fillingNormalTrack = normalTracks.find(t => trackHasClipAt(t, startTime));
                if (fillingNormalTrack && fillingNormalTrack.id !== track.id) {
                    return false;
                }
                return true;
            });
        });
    }

    // Sort compiled objects chronologically so we can calculate combos sequentially
    compiledObjects.sort((a, b) => a.startTime - b.startTime);

    let currentComboNumber = 0;
    let currentComboColorIndex = 0;
    const TOTAL_COLORS = 4; // Matching DEFAULT_COMBO_COLORS length in canvas.js

    compiledObjects.forEach((obj, idx) => {
        // First object, or an object marked as isNewCombo, resets the combo count and advances the color index
        if (idx === 0 || obj.isNewCombo) {
            currentComboNumber = 1;
            if (idx > 0) {
                currentComboColorIndex = (currentComboColorIndex + 1) % TOTAL_COLORS;
            } else {
                currentComboColorIndex = 0;
            }
        } else {
            currentComboNumber++;
        }
        obj.comboNumber = currentComboNumber;
        obj.comboColorIndex = currentComboColorIndex;
    });

    sharedState.ghostPreviewTrack = {
        id: 'ghost-preview-track',
        type: 'preview',
        sourceAsset: {
            hitObjects: compiledObjects
        },
        clips: [{
            startTimeMs: 0,
            endTimeMs: 1e12, // Indefinitely
            ownedObjectIds: compiledObjects.map(o => o.id)
        }]
    };
}
