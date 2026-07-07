/**
 * Beatmap Extractor & URL Ingestion Pipeline
 * Processes compressed zip (.osz) binaries, decodes map payload text streams, and coordinates CORS-safe proxy acquisitions
 */
import { showToast, showLoader, hideLoader } from '../engine/utils.js';
import { addNormalTrack, renderTracks } from '../engine/track-manager.js';
import { processSingleOsuFile } from './ingestion-handler.js';
import { sharedState } from '../core/shared-state.js';

/**
 * Decompresses client-side archives in memory using JSZip, parsing configuration strings and extracting sound data
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
                try {
                    await processSingleOsuFile(filename, textContent, file.name);
                } catch (e) {
                    console.error("Error processing zip .osu file:", e);
                }
                osuCount++;
            } else if (nameLower.endsWith('.mp3')) {
                const bufferContent = await zipEntry.async("arraybuffer");
                console.log(`%c[Audio Extracted]: ${filename}`, "color: #ff9800; font-weight: bold;");
                loadMp3File(filename, bufferContent, file.name);
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
 * Initiates download requests of targeted .osu map configurations using multiple CORS proxies
 * @param {string} beatmapId 
 */
async function fetchBeatmapById(beatmapId) {
    showLoader(`Connecting to osu! servers...`);
    const targetUrl = `https://osu.ppy.sh/osu/${beatmapId}`;

    // Added multiple reliable proxies. The script will try them one by one until one works.
    const fetchStrategies = [
        {
            name: "CodeTabs Proxy",
            url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
            type: "raw",
            timeout: 10000 
        },
        {
            name: "CorsProxy.io",
            url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            type: "raw",
            timeout: 10000 
        },
        {
            name: "AllOrigins JSON Proxy Wrapper",
            url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            type: "json-wrap",
            timeout: 15000 
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
 * Normalizes text strings, validating if they correspond to direct IDs or extracting sub-ID references from complex website URLs
 * @param {string} input 
 */
function processInputText(input) {
    const text = input.trim();
    if (!text) return;

    const bIDRegex = /(?:osu\.ppy\.sh\/b\/|osu\.ppy\.sh\/beatmaps\/|#osu\/)(\d+)/i;
    const match = text.match(bIDRegex);
    
    if (match && match[1]) {
        fetchBeatmapById(match[1]);
        return;
    }

    if (/^\d+$/.test(text)) {
        fetchBeatmapById(text);
        return;
    }

    showToast("Invalid URL or Beatmap ID structure", "error");
}

/**
 * Binds global paste commands to extract background clipboard strings whenever active document inputs are not occupied
 */
function setupClipboardPasteListener() {
    window.addEventListener('paste', (e) => {
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

/**
 * Handles button click actions and ENTER key bindings for input bars inside the UI interface
 */
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

/**
 * Loads an MP3 arraybuffer, extracts duration using native browser Audio element,
 * adds it to sharedState, and re-renders tracks.
 * @param {string} filename 
 * @param {ArrayBuffer} arrayBuffer 
 * @param {string|null} packageContext
 */
function loadMp3File(filename, arrayBuffer, packageContext = null) {
    const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.src = url;
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
        const duration = audio.duration;
        console.log(`[Audio Extracted]: ${filename} (package: ${packageContext}) duration is ${duration}s`);
        
        if (!sharedState.mp3Files) {
            sharedState.mp3Files = [];
        }
        
        const id = packageContext ? `${packageContext}/${filename}` : filename;
        const idx = sharedState.mp3Files.findIndex(f => f.id === id);
        const fileObj = { id, filename, packageContext, duration, url, blob };
        if (idx !== -1) {
            sharedState.mp3Files[idx] = fileObj;
        } else {
            sharedState.mp3Files.push(fileObj);
        }
        
        if (!sharedState.selectedMp3) {
            sharedState.selectedMp3 = fileObj;
            const durationMs = duration * 1000;
            sharedState.playbackSpeed = 1 / durationMs;
        }
        
        renderTracks();
    };
    audio.onerror = (e) => {
        console.error("Failed to load MP3 metadata for:", filename, e);
    };
}

export { handleOszFile, fetchBeatmapById, processInputText, setupClipboardPasteListener, setupURLInputListeners, loadMp3File };