/**
 * Ingestion Worker
 * Pure functions for parsing .osu strings into the strict SourceAsset contract.
 */

// --- Utility: Fast UUIDv4 ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- Math & Curve Utilities (Ported from curve_utils.py) ---
function getPointOnLinear(p1, p2, t) {
    return [
        p1[0] * (1 - t) + p2[0] * t,
        p1[1] * (1 - t) + p2[1] * t
    ];
}

function getPointOnBezier(points, t) {
    const n = points.length - 1;
    if (n === 0) return points[0];
    if (n === 1) return getPointOnLinear(points[0], points[1], t);

    const newPoints = [];
    for (let i = 0; i < n; i++) {
        newPoints.push([
            points[i][0] * (1 - t) + points[i + 1][0] * t,
            points[i][1] * (1 - t) + points[i + 1][1] * t
        ]);
    }
    return getPointOnBezier(newPoints, t);
}

function getPointOnPerfectCurve(points, t) {
    if (points.length !== 3) throw new Error("Perfect Curve requires exactly 3 points.");
    const [p1, p2, p3] = points;

    const area = p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]);
    if (Math.abs(area) < 1e-6) return getPointOnLinear(p1, p3, t); // Collinear fallback

    const D = 2 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]));
    const Ux = ((p1[0] ** 2 + p1[1] ** 2) * (p2[1] - p3[1]) + (p2[0] ** 2 + p2[1] ** 2) * (p3[1] - p1[1]) + (p3[0] ** 2 + p3[1] ** 2) * (p1[1] - p2[1])) / D;
    const Uy = ((p1[0] ** 2 + p1[1] ** 2) * (p3[0] - p2[0]) + (p2[0] ** 2 + p2[1] ** 2) * (p1[0] - p3[0]) + (p3[0] ** 2 + p3[1] ** 2) * (p2[0] - p1[0])) / D;

    const radius = Math.sqrt((p1[0] - Ux) ** 2 + (p1[1] - Uy) ** 2);
    let angle1 = Math.atan2(p1[1] - Uy, p1[0] - Ux);
    let angle2 = Math.atan2(p2[1] - Uy, p2[0] - Ux);
    let angle3 = Math.atan2(p3[1] - Uy, p3[0] - Ux);

    const TWO_PI = 2 * Math.PI;
    angle1 = (angle1 + TWO_PI) % TWO_PI;
    angle2 = (angle2 + TWO_PI) % TWO_PI;
    angle3 = (angle3 + TWO_PI) % TWO_PI;

    const crossProduct = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    let endAngle = angle3;

    if (crossProduct < 0) {
        endAngle = (angle3 > angle1) ? angle3 - TWO_PI : angle3;
    } else {
        endAngle = (angle3 < angle1) ? angle3 + TWO_PI : angle3;
    }

    const interpolatedAngle = angle1 + (endAngle - angle1) * t;
    return [
        Ux + radius * Math.cos(interpolatedAngle),
        Uy + radius * Math.sin(interpolatedAngle)
    ];
}

function distance(p1, p2) {
    return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
}

// --- Main Ingestion Logic ---
/**
 * Parses .osu content into a structured SourceAsset
 * @param {string} osuContent - Raw content of the .osu file
 * @param {string} fileName - Name of the file being parsed
 * @returns {Object} Parsed source asset
 */
export function parseOsuToSourceAsset(osuContent, fileName) {
    const lines = osuContent.split(/\r?\n/);
    let section = "";
    
    let difficultyName = "Unknown";
    let title = "Unknown Title";
    let artist = "Unknown Artist";
    let audioFilename = "";
    let sliderMultiplier = 1.4; // Default fallback
    let sliderTickRate = 1.0;
    const rawTimingLines = [];
    const rawHitObjectLines = [];

    // 1. Initial Pass: Organize sections
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("//")) continue;
        if (line.startsWith("[")) {
            section = line.slice(1, -1);
            continue;
        }

        if (section === "General") {
            if (line.startsWith("AudioFilename:")) {
                audioFilename = line.substring(14).trim();
            }
        } else if (section === "Metadata") {
            if (line.startsWith("Version:")) {
                difficultyName = line.substring(8).trim();
            } else if (line.startsWith("Title:")) {
                title = line.substring(6).trim();
            } else if (line.startsWith("Artist:")) {
                artist = line.substring(7).trim();
            }
        } else if (section === "Difficulty") {
            if (line.startsWith("SliderMultiplier:")) {
                sliderMultiplier = parseFloat(line.split(':')[1].trim());
            } else if (line.startsWith("SliderTickRate:")) {
                sliderTickRate = parseFloat(line.split(':')[1].trim());
            }
        } else if (section === "TimingPoints") {
            rawTimingLines.push(line);
        } else if (section === "HitObjects") {
            rawHitObjectLines.push(line);
        }
    }

    // 2. Parse Timing Points and Build Beat Map
    const parsedTimingPoints = [];
    const uninheritedSegments = [];

    let currentBeatOffset = 0;
    let lastRedLineTime = 0;
    let lastMsPerBeat = 0;
    let originalBpm = 0;

    for (const line of rawTimingLines) {
        const parts = line.split(',');
        if (parts.length < 8) continue;

        const time = parseFloat(parts[0]);
        const beatLength = parseFloat(parts[1]);
        const uninherited = parseInt(parts[6]) === 1;

        if (uninherited) {
            if (lastMsPerBeat > 0) {
                const msElapsed = time - lastRedLineTime;
                currentBeatOffset += msElapsed / lastMsPerBeat;
            }
            lastRedLineTime = time;
            lastMsPerBeat = beatLength;
            uninheritedSegments.push({ startMs: time, msPerBeat: beatLength, beatOffset: currentBeatOffset });
            
            if (originalBpm === 0) originalBpm = 60000 / beatLength; // Best-effort base BPM
        }

        parsedTimingPoints.push({
            time,
            msPerBeat: beatLength, // Will be negative for green lines
            meter: parseInt(parts[2]),
            sampleSet: parseInt(parts[3]),
            sampleIndex: parseInt(parts[4]),
            volume: parseInt(parts[5]),
            uninherited
        });
    }

    // Mathematical Conversion Function to Relative Beat Space
    const getBeatAtTime = (t) => {
        let activeSegment = uninheritedSegments[0];
        for (let i = uninheritedSegments.length - 1; i >= 0; i--) {
            if (t >= uninheritedSegments[i].startMs - 2) { // 2ms epsilon allowance
                activeSegment = uninheritedSegments[i];
                break;
            }
        }
        if (!activeSegment) return 0;
        // B(t) = beatOffset + ((t - startMs) / msPerBeat)
        return activeSegment.beatOffset + ((t - activeSegment.startMs) / activeSegment.msPerBeat);
    };

    // Prepare final contract timing points
    const finalTimingPoints = parsedTimingPoints.map(tp => ({
        beat: getBeatAtTime(tp.time),
        msPerBeat: tp.uninherited ? tp.msPerBeat : 0, 
        meter: tp.meter,
        sampleSet: tp.sampleSet,
        sampleIndex: tp.sampleIndex,
        volume: tp.volume,
        uninherited: tp.uninherited,
        sliderVelocityMult: tp.uninherited ? 1.0 : (100.0 / Math.abs(tp.msPerBeat))
    }));

    // 3. Parse Hit Objects
    const hitObjects = [];
    let currentCombo = 1;

    for (const line of rawHitObjectLines) {
        const parts = line.split(',');
        if (parts.length < 5) continue;

        const x = parseInt(parts[0]);
        const y = parseInt(parts[1]);
        const originalTimeMs = parseInt(parts[2]);
        const typeFlags = parseInt(parts[3]);
        const hitsound = parseInt(parts[4]);
        const beat = getBeatAtTime(originalTimeMs);

        const isCircle = (typeFlags & 1) > 0;
        const isSlider = (typeFlags & 2) > 0;
        const isNewCombo = (typeFlags & 4) > 0;
        const isSpinner = (typeFlags & 8) > 0;

        if (isNewCombo) currentCombo = 1;

        let objType = "circle";
        let sliderData;
        let spinnerData;

        if (isSpinner && parts.length >= 6) {
            objType = "spinner";
            const endTimeMs = parseInt(parts[5]);
            const endBeat = getBeatAtTime(endTimeMs);
            spinnerData = {
                durationBeats: endBeat - beat,
                endBeat: endBeat
            };
        } else if (isSlider && parts.length >= 8) {
            objType = "slider";
            const curveData = parts[5].split('|');
            const curveTypeChar = curveData[0];
            const slides = parseInt(parts[6]);
            const pixelLength = parseFloat(parts[7]);

            let curveType = "Linear";
            if (curveTypeChar === 'B') curveType = "Bezier";
            if (curveTypeChar === 'P') curveType = "PerfectCurve";
            if (curveTypeChar === 'C') curveType = "Catmull";

            const controlPoints = [[x, y]];
            for (let i = 1; i < curveData.length; i++) {
                const coords = curveData[i].split(':');
                controlPoints.push([parseInt(coords[0]), parseInt(coords[1])]);
            }

            // Bake path (O(log N) lookup density optimization)
            const bakedPath = [];
            const RESOLUTION = 200; // Segments to evaluate
            let cumulativeDistance = 0;
            let prevPoint = controlPoints[0];

            for (let i = 0; i <= RESOLUTION; i++) {
                const t = i / RESOLUTION;
                let currPoint;

                try {
                    if (curveType === "Linear") {
                        currPoint = getPointOnLinear(controlPoints[0], controlPoints[controlPoints.length - 1], t);
                    } else if (curveType === "PerfectCurve" && controlPoints.length === 3) {
                        currPoint = getPointOnPerfectCurve(controlPoints, t);
                    } else {
                        currPoint = getPointOnBezier(controlPoints, t);
                    }
                } catch (e) {
                    currPoint = prevPoint; // Fallback to avoid breaking worker loop
                }

                if (i > 0) {
                    const d = distance(prevPoint, currPoint);
                    cumulativeDistance += d;
                }

                // Only append if we haven't exceeded intended pixel length
                if (cumulativeDistance <= pixelLength + 2) { 
                    bakedPath.push({
                        x: currPoint[0],
                        y: currPoint[1],
                        dist: cumulativeDistance
                    });
                }
                
                prevPoint = currPoint;
                if (cumulativeDistance >= pixelLength) break;
            }

            // Fallback for single point / degenerate curves
            if (bakedPath.length === 0) bakedPath.push({ x, y, dist: 0 });

            // Find active timing point for slider velocity multiplier
            let activeVelocityMult = 1.0;
            for (let i = 0; i < finalTimingPoints.length; i++) {
                const tp = finalTimingPoints[i];
                if (tp.beat <= beat) {
                    if (!tp.uninherited) {
                        activeVelocityMult = tp.sliderVelocityMult;
                    } else {
                        activeVelocityMult = 1.0;
                    }
                } else {
                    break;
                }
            }
            const pixelsPerBeat = 100.0 * sliderMultiplier * activeVelocityMult;
            const durationBeats = (pixelLength / pixelsPerBeat) * slides;
            const endBeat = beat + durationBeats;

            sliderData = {
                curveType,
                pixelLength,
                slides,
                edgeHitsounds: [], // Can be populated if edgeSounds exist in string
                edgeAdditions: [],
                bakedPath,
                durationBeats,
                endBeat
            };
        }

        hitObjects.push({
            id: generateUUID(),
            type: objType,
            beat: beat,
            originalTimeMs: originalTimeMs,
            x,
            y,
            comboNumber: currentCombo++,
            isNewCombo,
            hitsound,
            sliderData,
            spinnerData
        });
    }

    return {
        assetId: generateUUID(), // Unique representation of this map file 
        difficultyName,
        title,
        artist,
        audioFilename,
        originalBpm, // Kept for UI reference [cite: 20]
        timingPoints: finalTimingPoints,
        hitObjects
    };
}