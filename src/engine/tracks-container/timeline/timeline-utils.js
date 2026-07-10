import { sharedState } from '../../../core/shared-state.js';
import { convertBeatToMs } from '../../track-utils/index.js';

export function getTimingSegments() {
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

export function getClipTimeRange(clip, timingSegments) {
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
