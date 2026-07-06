// State Management
const state = {
    isPlaying: false,
    playheadPosition: 0, // Percentage of the track (0 to 1)
    lastTimestamp: 0,
    playbackSpeed: 0.001 // Progress per millisecond
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    const welcomeModal = document.getElementById('welcomeModal');
    welcomeModal.style.display = 'flex';
    
    const canvas = document.getElementById('beatmapCanvas');
    const masterTrack = document.getElementById('master-track');
    
    // Create playhead element if it doesn't exist
    if (!document.getElementById('playhead')) {
        const playhead = document.createElement('div');
        playhead.id = 'playhead';
        playhead.className = 'playhead';
        masterTrack.appendChild(playhead);
    }
    
    updateCanvasSize();
    drawCanvas();
    
    setupMenuListeners();
    setupWelcomeModalListeners();
    setupDragAndDrop();
    setupPlaybackControls();
    setupTrackInteractions(masterTrack);

    // Animation Loop
    requestAnimationFrame(animationLoop);

    window.addEventListener('resize', function() {
        updateCanvasSize();
        drawCanvas();
    });
});

/**
 * Animation loop for playback
 */
function animationLoop(timestamp) {
    if (state.isPlaying) {
        if (!state.lastTimestamp) state.lastTimestamp = timestamp;
        const deltaTime = timestamp - state.lastTimestamp;
        
        state.playheadPosition += deltaTime * state.playbackSpeed;
        
        // Loop playback
        if (state.playheadPosition >= 1) {
            state.playheadPosition = 0;
        }
        
        state.lastTimestamp = timestamp;
        drawCanvas();
        drawPlayhead();
    }
    
    requestAnimationFrame(animationLoop);
}

/**
 * Draws the playhead on the master track
 */
function drawPlayhead() {
    const masterTrack = document.getElementById('master-track');
    const playhead = document.getElementById('playhead');
    if (!playhead || !masterTrack) return;

    const x = state.playheadPosition * masterTrack.offsetWidth;
    playhead.style.left = `${x}px`;
}

/**
 * Sets up spacebar and playback logic
 */
function setupPlaybackControls() {
    window.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            e.preventDefault(); // Prevent scrolling
            state.isPlaying = !state.isPlaying;
            if (!state.isPlaying) {
                state.lastTimestamp = 0; // Reset delta calculation
            }
        }
    });
}

/**
 * Allows clicking on the master track to seek
 */
function setupTrackInteractions(track) {
    if (!track) return;
    
    track.addEventListener('click', function(e) {
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        state.playheadPosition = clickX / rect.width;
        drawPlayhead();
        drawCanvas();
    });
}

// --- Dynamic File Handling & Directory Picker ---

/**
 * Handles the selected directory handle, lists all top-level .osu and .mp3 files
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
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${entry.name}`);
                    mp3Count++;
                }
            }
        }
        console.log(`%cScan complete: Found ${osuCount} .osu files and ${mp3Count} .mp3 files.`, "color: #28a745;");
    } catch (err) {
        console.error("Error reading directory contents:", err);
    }
}

/**
 * JSZip: Extract .osz archive entirely in-memory
 * @param {File} file 
 */
async function handleOszFile(file) {
    if (!window.JSZip) {
        console.error("JSZip library has not loaded yet.");
        return;
    }

    console.log(`%c[OSZ File Processing]: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, "color: #ff66aa; font-weight: bold;");

    try {
        const zip = await JSZip.loadAsync(file);
        console.log(`%cDecompressing .osz... Found ${Object.keys(zip.files).length} total files inside.`, "color: #00bcd4; font-weight: bold;");

        let osuCount = 0;
        let mp3Count = 0;

        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;

            const nameLower = filename.toLowerCase();
            if (nameLower.endsWith('.osu')) {
                // Extract .osu content as plain text
                const textContent = await zipEntry.async("string");
                console.log(`%c[OSU Map Extracted]: ${filename}`, "color: #28a745; font-weight: bold;");
                // Log a clean sample of the map config headers
                console.log(textContent.slice(0, 450) + "\n... [truncated preview]");
                osuCount++;
            } else if (nameLower.endsWith('.mp3')) {
                // Extract .mp3 audio as an ArrayBuffer
                const bufferContent = await zipEntry.async("arraybuffer");
                console.log(`%c[Audio Extracted]: ${filename}`, "color: #ff9800; font-weight: bold;");
                console.log(`  Size: ${(bufferContent.byteLength / 1024 / 1024).toFixed(2)} MB, loaded as ArrayBuffer.`);
                mp3Count++;
            }
        }
        console.log(`%c[Decompression Completed] Extracted ${osuCount} .osu files and ${mp3Count} .mp3 audio files.`, "color: #28a745; font-weight: bold;");
    } catch (err) {
        console.error("Failed to parse and decompress the .osz file using JSZip:", err);
    }
}

/**
 * Trigger Native Directory Picker
 */
async function triggerDirectoryPicker() {
    if (!window.showDirectoryPicker) {
        console.warn("showDirectoryPicker is unsupported. Dropping back to custom triggers.");
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
        }
    }
}

/**
 * Process drag & drop items/folders securely
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
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${file.name}`);
                    mp3Count++;
                }
            }
        }
    }
    if (osuCount > 0 || mp3Count > 0) {
        console.log(`%cScan complete: Evaluated ${osuCount} .osu files and ${mp3Count} .mp3 files.`, "color: #28a745;");
    }
}

// --- Canvas & Window Helpers ---

function calculateSquareSize(windowWidth, windowHeight, topOffset, bottomOffset, padding) {
    const availableWidth = windowWidth - (padding * 2);
    const availableHeight = windowHeight - topOffset - bottomOffset - (padding * 2);
    return Math.max(0, Math.min(availableWidth, availableHeight));
}

function updateCanvasSize() {
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;

    const padding = 50;
    const menuBarHeight = 48;
    const masterTrackHeight = 100;

    const newSize = calculateSquareSize(
        window.innerWidth,
        window.innerHeight,
        menuBarHeight,
        masterTrackHeight,
        padding
    );

    canvas.width = newSize;
    canvas.height = newSize;
}

function drawCanvas() {
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff66aa';
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 6, 0, Math.PI * 2);
    ctx.fill();
}

function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

// --- Listeners Setup ---

function setupMenuListeners() {
    const importOszBtnMenu = document.getElementById('importOszBtnMenu');
    const importFolderBtnMenu = document.getElementById('importFolderBtnMenu');
    const exportBtn = document.getElementById('exportBtnMenu');
    const fileInput = document.getElementById('oszFileInput');
    
    if (importOszBtnMenu && fileInput) {
        importOszBtnMenu.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtnMenu) {
        importFolderBtnMenu.addEventListener('click', triggerDirectoryPicker);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            console.log("Export triggered.");
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const welcomeModal = document.getElementById('welcomeModal');
                if (welcomeModal) welcomeModal.style.display = 'none';
                await handleOszFile(e.target.files[0]);
            }
        });
    }
}

function setupWelcomeModalListeners() {
    const importOszBtnModal = document.getElementById('importOszBtnModal');
    const importFolderBtnModal = document.getElementById('importFolderBtnModal');
    const newCanvasBtn = document.getElementById('newCanvasBtn');
    const welcomeModal = document.getElementById('welcomeModal');
    const fileInput = document.getElementById('oszFileInput');
    
    if (importOszBtnModal && fileInput) {
        importOszBtnModal.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtnModal) {
        importFolderBtnModal.addEventListener('click', triggerDirectoryPicker);
    }
    if (newCanvasBtn) {
        newCanvasBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
        });
    }
}

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
}