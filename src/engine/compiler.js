/**
 * Compiler Engine
 * 
 * Reverses the ingestion process: Takes the Master Track's MapClips (in relative beat space)
 * and translates them back into pristine, absolute millisecond timestamps.
 * Finally streams this into a complete .osu format text string.
 */

import { beatsToMs } from '../core/timing-math.js';

/**
 * Compiles a full project state into an .osu file string.
 * @param {Object} projectState - The ProjectState conforming to data-contracts.ts
 * @returns {string} The fully compiled .osu file content
 */
export function compileOsuFile(projectState) {
    const { appVersion, metadata, globalTimingSegments, sourceAssets, masterTimeline } = projectState;
    
    let osuText = `osu file format v14\n\n`;
    
    // [General]
    osuText += `[General]\n`;
    osuText += `AudioFilename: ${metadata.audioFilename || 'audio.mp3'}\n`;
    osuText += `AudioLeadIn: 0\n`;
    osuText += `PreviewTime: ${metadata.previewTime || -1}\n`;
    osuText += `Countdown: 0\n`;
    osuText += `SampleSet: Normal\n`;
    osuText += `StackLeniency: 0.7\n`;
    osuText += `Mode: 0\n`;
    osuText += `LetterboxInBreaks: 0\n`;
    osuText += `WidescreenStoryboard: 1\n\n`;
    
    // [Metadata]
    osuText += `[Metadata]\n`;
    osuText += `Title:${metadata.title || 'Unknown Title'}\n`;
    osuText += `TitleUnicode:${metadata.title || 'Unknown Title'}\n`;
    osuText += `Artist:${metadata.artist || 'Unknown Artist'}\n`;
    osuText += `ArtistUnicode:${metadata.artist || 'Unknown Artist'}\n`;
    osuText += `Creator:${metadata.creator || 'osu! Map Mixer'}\n`;
    osuText += `Version:Mixed\n`;
    osuText += `Source:${metadata.source || ''}\n`;
    osuText += `Tags:${(metadata.tags || []).join(' ')}\n`;
    osuText += `BeatmapID:0\n`;
    osuText += `BeatmapSetID:${metadata.beatmapSetId || -1}\n\n`;
    
    // [Difficulty]
    // Here we'd pull from the active master track difficulty settings
    // Assuming projectState has difficulty settings for the export, or use defaults
    const diff = projectState.difficulty || { CS: 4, AR: 9, OD: 8, HP: 4 };
    osuText += `[Difficulty]\n`;
    osuText += `HPDrainRate:${diff.HP}\n`;
    osuText += `CircleSize:${diff.CS}\n`;
    osuText += `OverallDifficulty:${diff.OD}\n`;
    osuText += `ApproachRate:${diff.AR}\n`;
    osuText += `SliderMultiplier:1.4\n`;
    osuText += `SliderTickRate:1\n\n`;
    
    // [Events]
    osuText += `[Events]\n`;
    osuText += `//Background and Video events\n`;
    osuText += `//Break Periods\n`;
    osuText += `//Storyboard Layer 0 (Background)\n`;
    osuText += `//Storyboard Layer 1 (Fail)\n`;
    osuText += `//Storyboard Layer 2 (Pass)\n`;
    osuText += `//Storyboard Layer 3 (Foreground)\n`;
    osuText += `//Storyboard Layer 4 (Overlay)\n`;
    osuText += `//Storyboard Sound Samples\n\n`;
    
    // 1. Resolve all objects from master timeline MapClips
    const finalObjects = [];
    const sliderTimingPoints = [];
    
    for (const clip of (masterTimeline || [])) {
        const source = sourceAssets[clip.sourceAssetId];
        if (!source) continue;
        
        // Find objects within the clip's source beat range
        const clipDurationBeats = clip.timelineEndBeat - clip.timelineStartBeat;
        const sourceEndBeat = clip.sourceStartBeat + clipDurationBeats;
        
        for (const obj of source.hitObjects) {
            // Check if object falls inside the source beat window
            if (obj.beat >= clip.sourceStartBeat && obj.beat <= sourceEndBeat) {
                // Ignore if user deleted it from this clip
                if (clip.deletedObjectIds && clip.deletedObjectIds.includes(obj.id)) {
                    continue;
                }
                
                // 2. Map beat from source-local space to global timeline space
                const offsetInClip = obj.beat - clip.sourceStartBeat;
                const globalBeat = clip.timelineStartBeat + offsetInClip;
                
                // 3. Translate global beat back to pristine ms timestamp
                const mappedMs = beatsToMs(globalBeat, globalTimingSegments);
                
                // 4. Apply non-destructive spatial transforms
                let x = obj.x;
                let y = obj.y;
                
                // A full implementation would apply scale, rotation, mirror based on clip's bounding box
                if (clip.transforms) {
                    if (clip.transforms.offsetX) x += clip.transforms.offsetX;
                    if (clip.transforms.offsetY) y += clip.transforms.offsetY;
                    if (clip.transforms.mirrorX) x = 512 - x;
                    if (clip.transforms.mirrorY) y = 384 - y;
                }
                
                // Clamp just in case
                x = Math.max(0, Math.min(512, Math.round(x)));
                y = Math.max(0, Math.min(384, Math.round(y)));
                
                finalObjects.push({
                    mappedMs: Math.round(mappedMs),
                    x, y,
                    originalObj: obj
                });

                // Dynamically compute slider velocity based on durationBeats & physical length
                if (obj.type === 'slider' && obj.sliderData) {
                    const sd = obj.sliderData;
                    if (sd.pixelLength > 0 && sd.durationBeats > 0) {
                        const sliderMultiplier = 1.4; // aligned with difficulty SliderMultiplier: 1.4
                        const svMult = sd.pixelLength / (sd.durationBeats * 100 * sliderMultiplier);
                        const msPerBeatVal = -100 / svMult;
                        
                        sliderTimingPoints.push({
                            timeMs: Math.round(mappedMs),
                            msPerBeat: msPerBeatVal,
                            uninherited: 0
                        });
                    }
                }
            }
        }
    }
    
    // Sort chronologically
    finalObjects.sort((a, b) => a.mappedMs - b.mappedMs);
    
    // Build and sort [TimingPoints]
    const allTimingPoints = [];
    if (globalTimingSegments && globalTimingSegments.length > 0) {
        for (const ts of globalTimingSegments) {
            const msPerBeat = 60000 / ts.bpm;
            allTimingPoints.push({
                timeMs: Math.round(ts.startMs),
                msPerBeat: msPerBeat,
                uninherited: 1
            });
        }
    } else {
        allTimingPoints.push({
            timeMs: 0,
            msPerBeat: 500,
            uninherited: 1
        });
    }
    
    // Merge slider velocity points
    allTimingPoints.push(...sliderTimingPoints);
    
    // Sort all timing points chronologically (and by uninherited descending so Red lines take precedence at same MS)
    allTimingPoints.sort((a, b) => {
        if (a.timeMs !== b.timeMs) {
            return a.timeMs - b.timeMs;
        }
        return b.uninherited - a.uninherited;
    });
    
    // Write [TimingPoints]
    osuText += `[TimingPoints]\n`;
    for (const tp of allTimingPoints) {
        // format: timeMs, msPerBeat, meter(4), sampleSet(1), sampleIndex(0), volume(100), uninherited(0 or 1), effects(0)
        osuText += `${tp.timeMs},${tp.msPerBeat.toFixed(6)},4,1,0,100,${tp.uninherited},0\n`;
    }
    osuText += `\n`;
    
    // [HitObjects]
    osuText += `[HitObjects]\n`;
    
    // 5. Stream to text
    for (const fo of finalObjects) {
        const o = fo.originalObj;
        
        let typeFlags = 0;
        if (o.type === 'circle') typeFlags |= 1;
        if (o.type === 'slider') typeFlags |= 2;
        if (o.isNewCombo) typeFlags |= 4;
        if (o.type === 'spinner') typeFlags |= 8;
        
        if (o.type === 'circle') {
            osuText += `${fo.x},${fo.y},${fo.mappedMs},${typeFlags},${o.hitsound},0:0:0:0:\n`;
        } else if (o.type === 'slider') {
            // Re-encode slider data
            const sd = o.sliderData;
            let curveTypeChar = 'L';
            if (sd.curveType === 'Bezier') curveTypeChar = 'B';
            if (sd.curveType === 'PerfectCurve') curveTypeChar = 'P';
            if (sd.curveType === 'Catmull') curveTypeChar = 'C';
            
            // Note: Control points encoding logic would normally go here.
            // For now, outputting a fallback linear slider using baked path endpoint
            const endPoint = sd.bakedPath && sd.bakedPath.length > 0 ? sd.bakedPath[sd.bakedPath.length - 1] : { x: fo.x, y: fo.y };
            const curveData = `${curveTypeChar}|${Math.round(endPoint.x)}:${Math.round(endPoint.y)}`;
            
            osuText += `${fo.x},${fo.y},${fo.mappedMs},${typeFlags},${o.hitsound},${curveData},${sd.slides},${sd.pixelLength}\n`;
        } else if (o.type === 'spinner') {
            const sd = o.spinnerData;
            const globalEndBeat = fo.mappedMs + (sd ? sd.durationBeats : 1); // rough fallback
            const endMs = beatsToMs(globalEndBeat, globalTimingSegments);
            osuText += `${fo.x},${fo.y},${fo.mappedMs},${typeFlags},${o.hitsound},${Math.round(endMs)}\n`;
        }
    }
    
    return osuText;
}
