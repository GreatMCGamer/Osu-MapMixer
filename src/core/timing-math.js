/**
 * timing-math.js
 * Implementation of the core data contracts and mathematical conversions 
 * between absolute time (ms) and relative rhythmic values (beats).
 * 
 * By strictly enforcing this transaction—Milliseconds → Beats (Extraction) 
 * → Transforms (Mixing) → Milliseconds (Export)—the editor guarantees that 
 * you can splice patterns from wildly different songs and BPMs, and they 
 * will always snap perfectly to the active song's rhythm.
 */

/**
 * Calculates the exact relative float beat where a given absolute millisecond falls.
 * B(t) = beatOffset + ((t - startMs) / (60000 / bpm))
 * 
 * @param {number} t - Absolute time in milliseconds
 * @param {Array} timingSegments - Array of TimingSegment objects
 * @returns {number} The relative float beat
 */
export function msToBeats(t, timingSegments) {
    if (!timingSegments || timingSegments.length === 0) return 0;
    
    // Find active segment
    let activeSegment = timingSegments[0];
    for (let i = timingSegments.length - 1; i >= 0; i--) {
        if (t >= timingSegments[i].startMs - 2) { // 2ms epsilon allowance
            activeSegment = timingSegments[i];
            break;
        }
    }
    
    const msPerBeat = 60000 / activeSegment.bpm;
    return activeSegment.beatOffset + ((t - activeSegment.startMs) / msPerBeat);
}

/**
 * Recalculates absolute millisecond timestamps from a relative float beat.
 * T(b) = startMs + ((b - beatOffset) * (60000 / bpm))
 * 
 * @param {number} b - Relative float beat
 * @param {Array} timingSegments - Array of TimingSegment objects
 * @returns {number} The absolute time in milliseconds
 */
export function beatsToMs(b, timingSegments) {
    if (!timingSegments || timingSegments.length === 0) return 0;
    
    // Find active segment based on beat
    let activeSegment = timingSegments[0];
    for (let i = timingSegments.length - 1; i >= 0; i--) {
        // small epsilon for float precision
        if (b >= timingSegments[i].beatOffset - 0.001) { 
            activeSegment = timingSegments[i];
            break;
        }
    }
    
    const msPerBeat = 60000 / activeSegment.bpm;
    return activeSegment.startMs + ((b - activeSegment.beatOffset) * msPerBeat);
}

/**
 * Utility to calculate cumulative beat offsets for an array of timing points (e.g. from an osu map).
 * Useful when generating the globalTimingSegments array.
 * 
 * @param {Array} rawRedLines - Array of objects with { startMs, msPerBeat }
 * @returns {Array} Array of TimingSegment
 */
export function buildTimingSegments(rawRedLines) {
    if (!rawRedLines || rawRedLines.length === 0) return [];
    
    // Sort chronologically just in case
    const sorted = [...rawRedLines].sort((a, b) => a.startMs - b.startMs);
    
    const segments = [];
    let currentBeatOffset = 0;
    let lastMs = 0;
    let lastMsPerBeat = 0;
    
    for (let i = 0; i < sorted.length; i++) {
        const line = sorted[i];
        
        if (lastMsPerBeat > 0) {
            const msElapsed = line.startMs - lastMs;
            currentBeatOffset += msElapsed / lastMsPerBeat;
        }
        
        lastMs = line.startMs;
        lastMsPerBeat = line.msPerBeat;
        
        segments.push({
            segmentId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            startMs: line.startMs,
            bpm: 60000 / line.msPerBeat,
            beatOffset: currentBeatOffset
        });
    }
    
    return segments;
}
