import { sharedState } from '../../core/shared-state.js';
import { convertBeatToMs } from './timing-utils.js';

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
