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
