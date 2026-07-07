/**
 * Local File System & Directory Ingestors
 * Interacts with physical directory nodes (Local Filesystem API) and manages drop event parsing logic
 */
import { showToast } from './utils.js';
import { handleOszFile } from './extractor.js';
import { processSingleOsuFile } from './ingestion-handler.js';

/**
 * Invokes modern browser directory selection windows and validates browser capability constraints
 */
async function triggerDirectoryPicker() {
    if (!window.showDirectoryPicker) {
        showToast("Directory Picker API unsupported on this browser. Try Drag-and-Drop!", "error");
        return;
    }
    try {
        const dirHandle = await window.showDirectoryPicker();
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'none';
        await handleDirectory(dirHandle);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error picking directory:", err);
            showToast("Failed to read directory", "error");
        }
    }
}

/**
 * Standardizes direct folder loops, safely looking only for .osu configurations and .mp3 audios on the root layer
 * @param {FileSystemDirectoryHandle} dirHandle 
 */
async function handleDirectory(dirHandle) {
    console.log(`%c[Directory Loaded]: ${dirHandle.name}`, "color: #ff66aa; font-weight: bold;");
    let osuCount = 0;
    let mp3Count = 0;

    try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const name = entry.name.toLowerCase();
                if (name.endsWith('.osu')) {
                    console.log(`  [osu!] map: ${entry.name}`);
                    // Process the .osu file with our ingestion handler
                    await processOsuFile(entry);
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${entry.name}`);
                    mp3Count++;
                }
            }
        }
        showToast(`Loaded Directory: ${dirHandle.name} with ${osuCount} maps.`, "success");
    } catch (err) {
        console.error("Error reading directory contents:", err);
        showToast("Error reading directory contents", "error");
    }
}

/**
 * Processes an individual .osu file
 * @param {FileSystemFileHandle} fileHandle 
 */
async function processOsuFile(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const content = await file.text();
        const fileName = file.name;
        await processSingleOsuFile(fileName, content);
    } catch (error) {
        console.error(`Failed to process file ${fileHandle.name}:`, error);
        showToast(`Failed to process ${fileHandle.name}`, "error");
    }
}

/**
 * Decouples drop-layer items using standard entries, routing individual files versus folder directories appropriately
 * @param {DataTransferItemList} items 
 */
async function processDraggedEntries(items) {
    let osuCount = 0;
    let mp3Count = 0;

    console.log("%c[Drag-and-Drop evaluating items...]", "color: #ff66aa;");

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === 'function') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                if (entry.isDirectory) {
                    console.log(`[Directory Entry]: ${entry.name}`);
                    const reader = entry.createReader();
                    await new Promise((resolve) => {
                        reader.readEntries(async (entries) => {
                            for (const subEntry of entries) {
                                if (subEntry.isFile) {
                                    const name = subEntry.name.toLowerCase();
                                    if (name.endsWith('.osu')) {
                                        console.log(`  [osu!] map: ${subEntry.name}`);
                                        // Process the .osu file with our ingestion handler
                                        await processOsuFile(subEntry);
                                        osuCount++;
                                    } else if (name.endsWith('.mp3')) {
                                        console.log(`  [Audio] track: ${subEntry.name}`);
                                        mp3Count++;
                                    }
                                }
                            }
                            resolve();
                        });
                    });
                } else if (entry.isFile) {
                    const file = item.getAsFile();
                    if (file) {
                        const name = file.name.toLowerCase();
                        if (name.endsWith('.osz')) {
                            await handleOszFile(file);
                        } else if (name.endsWith('.osu')) {
                            console.log(`  [osu!] map: ${file.name}`);
                            // Process the .osu file with our ingestion handler
                            await processOsuFile(file);
                            osuCount++;
                        } else if (name.endsWith('.mp3')) {
                            console.log(`  [Audio] track: ${file.name}`);
                            mp3Count++;
                        }
                    }
                }
            }
        } else {
            const file = item.getAsFile();
            if (file) {
                const name = file.name.toLowerCase();
                if (name.endsWith('.osz')) {
                    await handleOszFile(file);
                } else if (name.endsWith('.osu')) {
                    console.log(`  [osu!] map: ${file.name}`);
                    // Process the .osu file with our ingestion handler
                    await processOsuFile(file);
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${file.name}`);
                    mp3Count++;
                }
            }
        }
    }
    if (osuCount > 0 || mp3Count > 0) {
        showToast(`Imported ${osuCount} maps & ${mp3Count} tracks.`, "success");
    }
}

/**
 * Registers standard hover, drop, and leave hooks to drive state animations for the workspace's upload zones
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const welcomeModal = document.getElementById('welcomeModal');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            welcomeModal.style.display = 'none';
            await processDraggedEntries(items);
        }
    }, false);
    
    // Add click handler to make drop zone responsive
    dropZone.addEventListener('click', () => {
        // Prefer directory picker if available, else trigger file input
        if (window.showDirectoryPicker) {
            triggerDirectoryPicker();
        } else {
            document.getElementById('oszFileInput').click();
        }
    });
}

export { triggerDirectoryPicker, handleDirectory, processDraggedEntries, setupDragAndDrop };