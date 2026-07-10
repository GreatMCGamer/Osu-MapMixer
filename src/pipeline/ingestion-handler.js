/**
 * Ingestion Handler
 * Integrates the ingestion-worker.js with the existing file processing pipeline
 */

import { showToast } from '../engine/utils.js';
import { parseOsuToSourceAsset } from './ingestion-worker.js';
import { addNormalTrack } from '../engine/tracks-container/track-manager.js';
import { sharedState } from '../core/shared-state.js';

/**
 * Processes raw .osu file content using the ingestion worker
 * @param {string} osuContent - Raw content of the .osu file
 * @param {string} fileName - Name of the file being processed
 * @returns {Object} Parsed source asset
 */
function processOsuContent(osuContent, fileName) {
    try {
        console.log(`%c[Processing]: ${fileName}`, "color: #00bcd4;");
        const t0 = performance.now();
        const sourceAsset = parseOsuToSourceAsset(osuContent, fileName);
        const duration = performance.now() - t0;
        console.log(`%c[Success]: Parsed ${fileName} in ${duration.toFixed(2)}ms`, "color: #28a745; font-weight: bold;");
        return sourceAsset;
    } catch (error) {
        console.error(`%c[Error]: Failed to parse ${fileName}`, "color: #dc3545; font-weight: bold;", error);
        throw error;
    }
}

/**
 * Saves the parsed source asset to a persistent storage or shared state
 * @param {Object} sourceAsset - The parsed source asset to save
 */
function saveSourceAsset(sourceAsset) {
    try {
        if (!sharedState.sourceAssets) {
            sharedState.sourceAssets = {};
        }
        sharedState.sourceAssets[sourceAsset.assetId] = sourceAsset;
        console.log(`%c[Saved]: Asset ${sourceAsset.assetId}`, "color: #28a745; font-weight: bold;");
        return sourceAsset;
    } catch (error) {
        console.error(`%c[Error]: Failed to save asset`, "color: #dc3545; font-weight: bold;", error);
        throw error;
    }
}

/**
 * Processes a single .osu file
 * @param {string} fileName - Name of the file
 * @param {string} content - Content of the file
 * @param {string|null} packageContext - Name of the package or source context
 */
async function processSingleOsuFile(fileName, content, packageContext = null) {
    try {
        const sourceAsset = processOsuContent(content, fileName);
        if (packageContext) {
            sourceAsset.packageContext = packageContext;
        }
        const savedAsset = saveSourceAsset(sourceAsset);
        addNormalTrack({ name: fileName, assetId: savedAsset.assetId, sourceAsset: savedAsset });
        showToast(`Successfully processed ${fileName}`, "success");
        return savedAsset;
    } catch (error) {
        showToast(`Failed to process ${fileName}`, "error");
        throw error;
    }
}

export { processSingleOsuFile, processOsuContent, saveSourceAsset };