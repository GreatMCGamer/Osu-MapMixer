/**
 * Packager Engine
 * Responsible for assembling files (like .osu and audio) and managing browser-side file downloads.
 * Currently, it handles packaging and downloading a single .osu file.
 */

import { showToast } from '../engine/utils.js';

/**
 * Triggers a browser file download using a Blob.
 * @param {string} filename - The name of the file to save as
 * @param {string} textContent - The contents of the file
 */
export function downloadFile(filename, textContent) {
    try {
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`Successfully exported ${filename}`, 'success');
    } catch (error) {
        console.error('Failed to download file:', error);
        showToast('Export failed. Check console for details.', 'error');
    }
}

/**
 * Packages the given .osu text content into a single file download.
 * @param {string} filename - Target filename
 * @param {string} textContent - Raw .osu format file content
 */
export function packageOsuFile(filename, textContent) {
    downloadFile(filename, textContent);
}
