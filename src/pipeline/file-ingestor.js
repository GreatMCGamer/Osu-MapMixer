/**
 * Local File System & Directory Ingestors
 * Interacts with physical directory nodes (Local Filesystem API) and manages drop event parsing logic
 */
import { showToast } from '../engine/utils.js';
import { handleOszFile, loadMp3File } from './extractor.js';
import { processSingleOsuFile } from './ingestion-handler.js';

/**
 * Universal helper to extract a standard File object from multiple API entry shapes:
 * 1. FileSystemFileHandle (Modern File System Access API)
 * 2. FileSystemFileEntry (Drag and Drop webkitGetAsEntry API)
 * 3. Standard File object
 */
async function getFileFromAny(fileOrHandleOrEntry) {
    if (!fileOrHandleOrEntry) return null;
    
    // 1. FileSystemFileHandle
    if (typeof fileOrHandleOrEntry.getFile === 'function') {
        return await fileOrHandleOrEntry.getFile();
    }
    
    // 2. FileSystemFileEntry
    if (typeof fileOrHandleOrEntry.file === 'function') {
        return await new Promise((resolve, reject) => {
            fileOrHandleOrEntry.file(resolve, reject);
        });
    }
    
    // 3. Already a File/Blob object
    return fileOrHandleOrEntry;
}

/**
 * Iteratively reads all entries from a FileSystemDirectoryEntry to ensure robust listing of files.
 */
function readAllEntries(directoryEntry) {
    const reader = directoryEntry.createReader();
    const result = [];
    
    return new Promise((resolve, reject) => {
        const read = () => {
            reader.readEntries((entries) => {
                if (entries.length === 0) {
                    resolve(result);
                } else {
                    result.push(...entries);
                    read();
                }
            }, reject);
        };
        read();
    });
}

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
                    await processOsuFile(entry, dirHandle.name);
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${entry.name}`);
                    try {
                        const file = await entry.getFile();
                        const arrayBuffer = await file.arrayBuffer();
                        loadMp3File(entry.name, arrayBuffer, dirHandle.name);
                        mp3Count++;
                    } catch (e) {
                        console.error("Error reading directory MP3:", entry.name, e);
                    }
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
 * @param {FileSystemFileHandle|FileSystemFileEntry|File} fileOrHandle 
 * @param {string|null} packageContext
 */
async function processOsuFile(fileOrHandle, packageContext = null) {
    const name = fileOrHandle ? (fileOrHandle.name || "unknown") : "unknown";
    try {
        const file = await getFileFromAny(fileOrHandle);
        if (!file) throw new Error("Could not retrieve file object");
        const content = await file.text();
        await processSingleOsuFile(file.name || name, content, packageContext);
    } catch (error) {
        console.error(`Failed to process file ${name}:`, error);
        showToast(`Failed to process ${name}`, "error");
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
                    try {
                        const entries = await readAllEntries(entry);
                        for (const subEntry of entries) {
                            if (subEntry.isFile) {
                                const name = subEntry.name.toLowerCase();
                                if (name.endsWith('.osu')) {
                                    console.log(`  [osu!] map: ${subEntry.name}`);
                                    await processOsuFile(subEntry, entry.name);
                                    osuCount++;
                                } else if (name.endsWith('.mp3')) {
                                    console.log(`  [Audio] track: ${subEntry.name}`);
                                    try {
                                        const file = await getFileFromAny(subEntry);
                                        if (file) {
                                            const arrayBuffer = await file.arrayBuffer();
                                            loadMp3File(subEntry.name, arrayBuffer, entry.name);
                                            mp3Count++;
                                        }
                                    } catch (e) {
                                        console.error("Error reading sub-entry MP3:", subEntry.name, e);
                                    }
                                }
                            }
                        }
                    } catch (dirErr) {
                        console.error("Error reading directory entry:", entry.name, dirErr);
                    }
                } else if (entry.isFile) {
                    const file = item.getAsFile();
                    if (file) {
                        const name = file.name.toLowerCase();
                        if (name.endsWith('.osz')) {
                            await handleOszFile(file);
                        } else if (name.endsWith('.osu')) {
                            console.log(`  [osu!] map: ${file.name}`);
                            await processOsuFile(file);
                            osuCount++;
                        } else if (name.endsWith('.mp3')) {
                            console.log(`  [Audio] track: ${file.name}`);
                            try {
                                const arrayBuffer = await file.arrayBuffer();
                                loadMp3File(file.name, arrayBuffer);
                                mp3Count++;
                            } catch (e) {
                                console.error("Error reading file MP3:", file.name, e);
                            }
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
                    await processOsuFile(file);
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${file.name}`);
                    try {
                        const arrayBuffer = await file.arrayBuffer();
                        loadMp3File(file.name, arrayBuffer);
                        mp3Count++;
                    } catch (e) {
                        console.error("Error reading file MP3:", file.name, e);
                    }
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