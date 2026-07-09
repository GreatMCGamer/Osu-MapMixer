/**
 * Exporter Engine
 * Orchestrates gathering the current timeline state, copying metadata from the first
 * imported .osu map, constructing the ProjectState, compiling it to .osu format,
 * and passing it to the packager.
 */

import { sharedState } from '../core/shared-state.js';
import { compileOsuFile } from '../engine/compiler.js';
import { packageOsuFile } from './packager.js';
import { showToast } from '../engine/utils.js';

/**
 * Gathers current editor state, copies metadata from the first imported map,
 * compiles the merged result, and triggers a file download.
 */
export function exportProjectOsu() {
    const sourceAssets = sharedState.sourceAssets || {};
    const assetKeys = Object.keys(sourceAssets);

    if (assetKeys.length === 0) {
        showToast("No maps imported! Please import at least one .osu map to export.", "error");
        return;
    }

    // 1. Get first imported source asset
    const firstAsset = sourceAssets[assetKeys[0]];

    // 2. Build metadata copying from the first imported .osu map
    const title = firstAsset.title || "Mixed Map";
    const artist = firstAsset.artist || "Mixed Artist";
    const audioFilename = firstAsset.audioFilename || "audio.mp3";

    const metadata = {
        title: title,
        artist: artist,
        creator: "osu! Map Mixer",
        audioFilename: audioFilename,
        previewTime: -1,
        tags: ["mixed", "mapmixer"],
        source: "",
        beatmapSetId: -1
    };

    // 3. Build globalTimingSegments using the current active timing source asset
    const globalTimingSegments = [];
    const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
        ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] 
        : firstAsset;

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
            
            globalTimingSegments.push({
                segmentId: `seg-${i}`,
                startMs,
                bpm: 60000 / msPerBeat,
                beatOffset: currentBeatOffset
            });
        }
    }
    if (globalTimingSegments.length === 0) {
        globalTimingSegments.push({ segmentId: 'fallback', startMs: 0, bpm: 120, beatOffset: 0 });
    }

    // 4. Gather the master timeline (MapClips)
    const masterTimeline = sharedState.masterTimeline || [];

    // 5. Look up difficulty settings
    let HP = 4, CS = 4, OD = 8, AR = 9;
    const masterTrack = sharedState.tracks.find(t => t.type === 'master');
    if (masterTrack && masterTrack.difficulty) {
        HP = masterTrack.difficulty.HP || 4;
        CS = masterTrack.difficulty.CS || 4;
        OD = masterTrack.difficulty.OD || 8;
        AR = masterTrack.difficulty.AR || 9;
    }

    const projectState = {
        appVersion: "1.0.0",
        metadata,
        globalTimingSegments,
        sourceAssets,
        masterTimeline,
        difficulty: { HP, CS, OD, AR }
    };

    try {
        // Compile using the existing compiler
        const compiledOsuText = compileOsuFile(projectState);

        // Sanitize filename
        const safeArtist = artist.replace(/[\\/:*?"<>|]/g, "");
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, "");
        const filename = `${safeArtist} - ${safeTitle} (osu! Map Mixer) [Mixed].osu`;

        // Package and trigger download
        packageOsuFile(filename, compiledOsuText);
    } catch (err) {
        console.error("Compilation failed:", err);
        showToast("Error during compilation: " + err.message, "error");
    }
}
