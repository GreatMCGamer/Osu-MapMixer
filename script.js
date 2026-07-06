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
    setupClipboardPasteListener();
    setupURLInputListeners();

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
        showToast(`Loaded Directory: ${dirHandle.name} with ${osuCount} maps.`, "success");
    } catch (err) {
        console.error("Error reading directory contents:", err);
        showToast("Error reading directory contents", "error");
    }
}

/**
 * JSZip: Extract .osz archive entirely in-memory
 * @param {File} file 
 */
async function handleOszFile(file) {
    if (!window.JSZip) {
        console.error("JSZip library has not loaded yet.");
        showToast("Decompressor library not loaded", "error");
        return;
    }

    showLoader("Extracting .osz package...");

    try {
        const zip = await JSZip.loadAsync(file);
        let osuCount = 0;
        let mp3Count = 0;

        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;

            const nameLower = filename.toLowerCase();
            if (nameLower.endsWith('.osu')) {
                const textContent = await zipEntry.async("string");
                console.log(`%c[OSU Map Extracted]: ${filename}`, "color: #28a745; font-weight: bold;");
                console.log(textContent.slice(0, 450) + "\n... [truncated]");
                osuCount++;
            } else if (nameLower.endsWith('.mp3')) {
                const bufferContent = await zipEntry.async("arraybuffer");
                console.log(`%c[Audio Extracted]: ${filename}`, "color: #ff9800; font-weight: bold;");
                mp3Count++;
            }
        }
        hideLoader();
        showToast(`Successfully unpacked ${osuCount} difficulty maps!`, "success");
    } catch (err) {
        hideLoader();
        console.error("Failed to parse .osz:", err);
        showToast("Failed to unpack .osz", "error");
    }
}

/**
 * Parses and fetches a raw .osu beatmap text from a Beatmap ID using the verified AllOrigins JSON Proxy Wrapper
 * @param {string} beatmapId 
 */
async function fetchBeatmapById(beatmapId) {
    showLoader(`Connecting to osu! servers...`);
    const targetUrl = `https://osu.ppy.sh/osu/${beatmapId}`;

    // Only keep the verified proxy strategy that successfully resolved CORS restrictions and fetched the data
    const fetchStrategies = [
        {
            name: "AllOrigins JSON Proxy Wrapper",
            url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            type: "json-wrap",
            timeout: 15000 // Large timeout since public wrappers can be throttled
        }
    ];

    let success = false;
    let rawText = "";

    for (let i = 0; i < fetchStrategies.length; i++) {
        const strategy = fetchStrategies[i];
        console.log(`%c[Ingestion]: Attempting download via: ${strategy.name}...`, "color: #00bcd4;");
        showLoader(`Downloading via [${i + 1}/${fetchStrategies.length}]...`);

        let timeoutId;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), strategy.timeout);

            const response = await fetch(strategy.url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let responseText = "";

            if (strategy.type === "json-wrap") {
                const json = await response.json();
                responseText = json.contents || "";
            } else {
                responseText = await response.text();
            }

            if (responseText && responseText.trim().startsWith("osu file format")) {
                rawText = responseText;
                success = true;
                console.log(`%c[Ingestion Success]: Downloaded successfully via: ${strategy.name}!`, "color: #28a745; font-weight: bold;");
                break;
            } else {
                throw new Error("Received response, but raw data is missing a valid 'osu file format' header.");
            }
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError' || err.message.includes('abort');
            const errorMsg = isTimeout ? `Request timed out after ${strategy.timeout / 1000}s` : err.message;
            console.warn(`[Strategy Warning]: ${strategy.name} failed. Error: ${errorMsg}`);
        }
    }

    if (success) {
        console.log(`%c[Beatmap Content Preview]: ID ${beatmapId}`, "color: #ff66aa; font-weight: bold;");
        console.log(rawText.slice(0, 600) + "\n... [truncated]");

        hideLoader();
        showToast(`Downloaded Beatmap #${beatmapId}!`, "success");

        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'none';
    } else {
        hideLoader();
        console.error(`Failed to download beatmap ID ${beatmapId} using all public mirrors and CORS gateways.`);
        showToast(`Could not connect to osu! servers. Please drop the .osz file manually.`, "error");
    }
}

/**
 * Scans string for various osu! url designs and extracts the ID
 * @param {string} input 
 */
function processInputText(input) {
    const text = input.trim();
    if (!text) return;

    // Regex combinations:
    // 1. https://osu.ppy.sh/beatmapsets/1826388#osu/3748430
    // 2. https://osu.ppy.sh/beatmaps/3748430
    // 3. https://osu.ppy.sh/b/3748430
    // 4. Raw beatmap ID: 3748430
    
    const bIDRegex = /(?:osu\.ppy\.sh\/b\/|osu\.ppy\.sh\/beatmaps\/|#osu\/)(\d+)/i;
    const match = text.match(bIDRegex);
    
    if (match && match[1]) {
        fetchBeatmapById(match[1]);
        return;
    }

    // Direct numerical input match
    if (/^\d+$/.test(text)) {
        fetchBeatmapById(text);
        return;
    }

    showToast("Invalid URL or Beatmap ID structure", "error");
}

// --- Clipboard & Input Handlers ---

function setupClipboardPasteListener() {
    window.addEventListener('paste', (e) => {
        // Stop intercepting paste events if user is actively writing inside an input field
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
            return; 
        }

        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        if (pastedText) {
            console.log(`%c[Pasted text detected]: ${pastedText}`, "color: #00bcd4;");
            processInputText(pastedText);
        }
    });
}

function setupURLInputListeners() {
    const modalUrlInput = document.getElementById('modalUrlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const menuUrlInput = document.getElementById('menuUrlInput');

    if (loadUrlBtn && modalUrlInput) {
        loadUrlBtn.addEventListener('click', () => {
            processInputText(modalUrlInput.value);
            modalUrlInput.value = '';
        });
        modalUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                processInputText(modalUrlInput.value);
                modalUrlInput.value = '';
            }
        });
    }

    if (menuUrlInput) {
        menuUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                processInputText(menuUrlInput.value);
                menuUrlInput.value = '';
            }
        });
    }
}

// --- Loader & UI Toasts ---

function showLoader(message) {
    const loaderOverlay = document.getElementById('loaderOverlay');
    const loaderText = document.getElementById('loaderText');
    if (loaderOverlay && loaderText) {
        loaderText.textContent = message;
        loaderOverlay.style.display = 'flex';
    }
}

function hideLoader() {
    const loaderOverlay = document.getElementById('loaderOverlay');
    if (loaderOverlay) {
        loaderOverlay.style.display = 'none';
    }
}

// --- Trigger Directory Picker ---

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

// --- Process Drag & Drop ---

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
        showToast(`Imported ${osuCount} maps & ${mp3Count} tracks.`, "success");
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

function showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto delete toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease-out reverse forwards";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}