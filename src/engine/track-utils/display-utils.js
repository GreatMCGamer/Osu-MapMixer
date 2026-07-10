import { sharedState } from '../../core/shared-state.js';

/**
 * Returns a user-friendly display name for a loaded MP3 file based on available .osu metadata
 * @param {Object} file 
 * @returns {string} Display name
 */
export function getMp3DisplayName(file) {
    if (!sharedState.sourceAssets) return file.filename;
    
    const fileLower = file.filename.toLowerCase();
    
    // 1. Try to find a sourceAsset with exact matching AudioFilename AND matching packageContext
    let match = Object.values(sharedState.sourceAssets).find(asset => {
        return asset.audioFilename && 
               asset.audioFilename.toLowerCase() === fileLower && 
               asset.packageContext === file.packageContext;
    });

    // 2. Try to find any sourceAsset with matching AudioFilename (without packageContext matching)
    if (!match) {
        match = Object.values(sharedState.sourceAssets).find(asset => {
            return asset.audioFilename && asset.audioFilename.toLowerCase() === fileLower;
        });
    }

    // 3. Fallback: if no match, use the first available source asset
    if (!match) {
        const assets = Object.values(sharedState.sourceAssets);
        if (assets.length > 0) {
            match = assets[0];
        }
    }

    if (match && match.title && match.artist) {
        const titleStr = match.title !== "Unknown Title" ? match.title : "";
        const artistStr = match.artist !== "Unknown Artist" ? match.artist : "";
        if (titleStr || artistStr) {
            const label = artistStr && titleStr ? `${artistStr} - ${titleStr}` : (titleStr || artistStr);
            return `${label} (${file.filename})`;
        }
    }
    
    return file.filename;
}

export function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        if (secs % 1 === 0) {
            return `${mins}:${Math.floor(secs).toString().padStart(2, '0')}`;
        } else {
            const integerSecs = Math.floor(secs);
            const dec = Math.round((secs % 1) * 10);
            return `${mins}:${integerSecs.toString().padStart(2, '0')}.${dec}`;
        }
    } else {
        if (secs % 1 === 0) {
            return `${Math.floor(secs)}s`;
        } else {
            return `${secs.toFixed(1)}s`;
        }
    }
}
