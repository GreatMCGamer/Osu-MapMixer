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
            // Only examine file entries at the root of the picked directory (no recursion)
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
 * Trigger Native Directory Picker
 */
async function triggerDirectoryPicker() {
    if (!window.showDirectoryPicker) {
        alert("The Directory Picker API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or another compatible browser, or use Drag & Drop.");
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
 * Process drag & drop files/folders securely using Webkit Entries (flat evaluation)
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
                    // We parse files only inside this top-level directory folder (no subfolder recursion)
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
                    // Direct files dropped
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
        } else {
            // Fallback for standard files
            const file = item.getAsFile();
            if (file) {
                const name = file.name.toLowerCase();
                if (name.endsWith('.osu')) {
                    console.log(`  [osu!] map: ${file.name}`);
                    osuCount++;
                } else if (name.endsWith('.mp3')) {
                    console.log(`  [Audio] track: ${file.name}`);
                    mp3Count++;
                }
            }
        }
    }
    console.log(`%cScan complete: Evaluated ${osuCount} .osu files and ${mp3Count} .mp3 files.`, "color: #28a745;");
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
    const importBtn = document.getElementById('importFolderBtnMenu');
    const exportBtn = document.getElementById('exportBtnMenu');
    
    if (importBtn) {
        importBtn.addEventListener('click', triggerDirectoryPicker);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            console.log("Export triggered.");
        });
    }
}

function setupWelcomeModalListeners() {
    const importFolderBtnModal = document.getElementById('importFolderBtnModal');
    const newCanvasBtn = document.getElementById('newCanvasBtn');
    const welcomeModal = document.getElementById('welcomeModal');
    
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

    dropZone.addEventListener('click', triggerDirectoryPicker);

    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            welcomeModal.style.display = 'none';
            await processDraggedEntries(items);
        }
    }, false);
}