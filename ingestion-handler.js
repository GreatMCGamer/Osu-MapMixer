/**
 * Ingestion Handler
 * Integrates the ingestion-worker.js with the existing file processing pipeline
 */

import { showToast } from './utils.js';
import { parseOsuToSourceAsset } from './ingestion-worker.js';

/**
 * Processes raw .osu file content using the ingestion worker
 * @param {string} osuContent - Raw content of the .osu file
 * @param {string} fileName - Name of the file being processed
 * @returns {Object} Parsed source asset
 */
function processOsuContent(osuContent, fileName) {
    try {
        console.log(`%c[Processing]: ${fileName}`, "color: #00bcd4;");
        const sourceAsset = parseOsuToSourceAsset(osuContent, fileName);
        console.log(`%c[Success]: Parsed ${fileName}`, "color: #28a745; font-weight: bold;");
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
        // In a real implementation, this would save to a database or shared state
        console.log(`%c[Saved]: Asset ${sourceAsset.assetId}`, "color: #28a745; font-weight: bold;");
        console.log(sourceAsset);
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
 */
async function processSingleOsuFile(fileName, content) {
    try {
        const sourceAsset = processOsuContent(content, fileName);
        const savedAsset = saveSourceAsset(sourceAsset);
        showToast(`Successfully processed ${fileName}`, "success");
        return savedAsset;
    } catch (error) {
        showToast(`Failed to process ${fileName}`, "error");
        throw error;
    }
}

export { processSingleOsuFile, processOsuContent, saveSourceAsset };