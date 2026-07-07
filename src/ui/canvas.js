import { sharedState, getHighlightedTrackId, getActiveDifficulty } from '../core/shared-state.js';

/**
 * Main Beatmap Canvas Visualizer
 * Handles pixel drawing calculations, canvas grids, viewport boundaries, and geometric scaling coordinates
 */

const DEFAULT_COMBO_COLORS = [
    { r: 255, g: 192, b: 0 },
    { r: 0,   g: 202, b: 0 },
    { r: 18,  g: 124, b: 255 },
    { r: 242, g: 24,  b: 57 }
];

/**
 * Checks if a track contains a pattern clip active at a specific timestamp.
 */
function trackHasClipAt(track, timeMs) {
    if (!track.sourceAsset || !track.sourceAsset.hitObjects || track.sourceAsset.hitObjects.length === 0) {
        return false;
    }
    
    const beatLengthMs = (track.sourceAsset.finalTimingPoints && track.sourceAsset.finalTimingPoints.length > 0) 
        ? track.sourceAsset.finalTimingPoints[0].beatLength 
        : 500;
        
    const firstObj = track.sourceAsset.hitObjects[0];
    const minTime = firstObj.originalTimeMs || (firstObj.beat * beatLengthMs);
    
    let maxTime = minTime;
    track.sourceAsset.hitObjects.forEach(note => {
        const startTime = note.originalTimeMs || (note.beat * beatLengthMs);
        let endTime = startTime;
        if (note.type === 'slider' && note.sliderData && note.sliderData.durationBeats) {
            const durationMs = note.sliderData.durationBeats * beatLengthMs;
            endTime = startTime + durationMs;
        } else if (note.type === 'spinner' && note.spinnerData) {
            const durationMs = note.spinnerData.durationBeats * beatLengthMs;
            endTime = startTime + durationMs;
        }
        if (endTime > maxTime) {
            maxTime = endTime;
        }
    });
    
    return timeMs >= minTime && timeMs <= maxTime;
}

/**
 * Calculates mathematically balanced viewport bounds to keep the preview screen a perfect square regardless of responsive resizing
 * @param {number} windowWidth 
 * @param {number} windowHeight 
 * @param {number} topOffset 
 * @param {number} bottomOffset 
 * @param {number} padding 
 * @returns {number} 
 */
function calculateSquareSize(windowWidth, windowHeight, topOffset, bottomOffset, padding) {
    const availableWidth = windowWidth - (padding * 2);
    const availableHeight = windowHeight - topOffset - bottomOffset - (padding * 2);
    return Math.max(0, Math.min(availableWidth, availableHeight));
}

/**
 * Triggers canvas size adjustments depending on outer layout margins (menu, timeline heights) and forces visual refreshes
 */
function updateCanvasSize() {
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;

    const padding = 50;
    // The canvas area is between the menu bar and the divider
    const menuBarHeight = Math.max(20, window.innerHeight / 48);
    const dividerElement = document.getElementById('divider');
    const dividerTop = dividerElement ? dividerElement.getBoundingClientRect().top : window.innerHeight * 0.6666;
    
    // The canvas area is between the menu bar and the divider
    const availableHeight = dividerTop - menuBarHeight;

    const newSize = calculateSquareSize(
        window.innerWidth,
        window.innerHeight,
        menuBarHeight,
        (window.innerHeight - dividerTop),
        padding
    );

    canvas.width = newSize;
    canvas.height = newSize;
}

/**
 * Erases and repaints grid segments and reference anchors on the screen context
 */
function drawCanvas() {
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    
    drawHitObjects(ctx, canvas);
}

/**
 * Draws standard osu! hit objects (circles, sliders, spinners) onto the playfield canvas.
 * Adapts mathematical slider layered gradients and approach circles for the visualizer.
 */
function drawHitObjects(ctx, canvas) {
    if (!sharedState.tracks || sharedState.tracks.length === 0) return;

    const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
    const currentTimeMs = sharedState.playheadPosition * totalDuration;

    const scale = Math.min(canvas.width / 512, canvas.height / 384);
    const offsetX = (canvas.width - 512 * scale) / 2;
    const offsetY = (canvas.height - 384 * scale) / 2;

    const tx = (x) => x * scale + offsetX;
    const ty = (y) => y * scale + offsetY;

    const activeDifficulty = getActiveDifficulty();
    const csVal = typeof activeDifficulty.CS === 'number' ? activeDifficulty.CS : 4.5;
    const arVal = typeof activeDifficulty.AR === 'number' ? activeDifficulty.AR : 9;

    // CS formula: radius in osu!pixels = 54.4 - 4.48 * CS
    const CIRCLE_RADIUS = (54.4 - 4.48 * csVal) * scale;

    // AR formula: timing in ms
    let AR_TIME;
    if (arVal < 5) {
        AR_TIME = 1200 + 600 * (5 - arVal) / 5;
    } else {
        AR_TIME = 1200 - 750 * (arVal - 5) / 5;
    }

    let activeObjects = [];

    // Determine which tracks are allowed to render at the current timestamp based on highlighing
    let tracksToRender = [];
    const activeTrackId = getHighlightedTrackId();

    if (activeTrackId) {
        const activeTrack = sharedState.tracks.find(t => t.id === activeTrackId);
        if (activeTrack) {
            if (activeTrack.type === 'normal') {
                // If a normal track is highlighted, only render that normal track
                tracksToRender = [activeTrack];
            } else {
                // If a master track is highlighted, check if it has a clip at the playhead time
                const masterHasClip = trackHasClipAt(activeTrack, currentTimeMs);
                if (masterHasClip) {
                    tracksToRender = [activeTrack];
                } else {
                    // Fall back to filling missing portion with normal tracks
                    // "The beatmaps/patternclips will fully hide any track under neath them. (0 transparency)"
                    // Search normal tracks in layout order (their order in the sharedState.tracks list)
                    const normalTracks = sharedState.tracks.filter(t => t.type === 'normal');
                    const fillingNormalTrack = normalTracks.find(t => trackHasClipAt(t, currentTimeMs));
                    if (fillingNormalTrack) {
                        tracksToRender = [fillingNormalTrack];
                    }
                }
            }
        }
    }

    tracksToRender.forEach(track => {
        if (!track.sourceAsset || !track.sourceAsset.hitObjects) return;

        // Try to get beat length from timing points if possible, default to 500ms
        const beatLengthMs = (track.sourceAsset.finalTimingPoints && track.sourceAsset.finalTimingPoints.length > 0) 
            ? track.sourceAsset.finalTimingPoints[0].beatLength 
            : 500;

        track.sourceAsset.hitObjects.forEach(note => {
            const startTime = note.originalTimeMs || (note.beat * beatLengthMs); // Fallback to beat calculation if undefined
            let endTime = startTime;
            
            if (note.type === 'slider' && note.sliderData && note.sliderData.durationBeats) {
                const durationMs = note.sliderData.durationBeats * beatLengthMs;
                endTime = startTime + durationMs;
            } else if (note.type === 'spinner' && note.spinnerData) {
                 const durationMs = note.spinnerData.durationBeats * beatLengthMs;
                 endTime = startTime + durationMs;
            }

            if (currentTimeMs >= startTime - AR_TIME && currentTimeMs <= endTime + 150) {
                activeObjects.push({ note, track, startTime, endTime });
            }
        });
    });

    // Sort descending by startTime so earlier objects are drawn ON TOP of later ones
    activeObjects.sort((a, b) => b.startTime - a.startTime);

    activeObjects.forEach(obj => {
        const { note, startTime, endTime } = obj;
        const color = DEFAULT_COMBO_COLORS[(note.comboNumber || 0) % DEFAULT_COMBO_COLORS.length];
        const rgb = `${color.r},${color.g},${color.b}`;

        let alpha = 1;
        if (currentTimeMs < startTime) {
            // Fading in
            alpha = Math.max(0, (currentTimeMs - (startTime - AR_TIME)) / AR_TIME);
        } else if (currentTimeMs > endTime) {
            // Fading out hit object quickly
            alpha = Math.max(0, 1 - (currentTimeMs - endTime) / 150);
            if (alpha <= 0) return;
        }

        ctx.globalAlpha = alpha;

        if (note.type === 'slider' && note.sliderData && note.sliderData.bakedPath) {
            drawSmoothSlider(ctx, note, tx, ty, CIRCLE_RADIUS * 2, rgb);
        } else if (note.type === 'spinner') {
            ctx.beginPath();
            ctx.arc(tx(256), ty(192), CIRCLE_RADIUS * 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw hit circle / slider head
        if (note.type === 'circle' || note.type === 'slider') {
            // Draw approach circle
            if (currentTimeMs < startTime) {
                const approachScale = 1 + 2 * (1 - (currentTimeMs - (startTime - AR_TIME)) / AR_TIME);
                ctx.beginPath();
                ctx.arc(tx(note.x), ty(note.y), CIRCLE_RADIUS * approachScale, 0, Math.PI * 2);
                ctx.strokeStyle = `rgb(${rgb})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Draw circle body
            ctx.beginPath();
            ctx.arc(tx(note.x), ty(note.y), CIRCLE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    });

    ctx.globalAlpha = 1;
}

/**
 * Procedurally generates smooth slider bodies using mathematical layered gradients
 */
function drawSmoothSlider(ctx, note, tx, ty, trackDiam, baseRgb) {
    if (!window.sliderScratch) {
        window.sliderScratch = document.createElement('canvas');
        window.sliderCtx = window.sliderScratch.getContext('2d');
    }
    const sCanvas = window.sliderScratch;
    const sCtx = window.sliderCtx;
    if (sCanvas.width !== ctx.canvas.width || sCanvas.height !== ctx.canvas.height) {
        sCanvas.width = ctx.canvas.width;
        sCanvas.height = ctx.canvas.height;
    }
    sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);
    sCtx.lineCap = 'round';
    sCtx.lineJoin = 'round';

    const path = new Path2D();
    const baked = note.sliderData.bakedPath;
    if (baked.length > 0) {
        path.moveTo(tx(baked[0].x), ty(baked[0].y));
        for (let i = 1; i < baked.length; i++) {
            path.lineTo(tx(baked[i].x), ty(baked[i].y));
        }
    }

    const bodyWidth = trackDiam * 0.82;
    const borderRgb = '255,255,255';
    
    // 1. Outer border
    sCtx.lineWidth = trackDiam;
    sCtx.strokeStyle = `rgb(${borderRgb})`;
    sCtx.stroke(path);

    // 2. Solid base track body
    sCtx.lineWidth = bodyWidth;
    sCtx.strokeStyle = `rgb(${baseRgb})`;
    sCtx.stroke(path);

    // Highlight (brighten)
    const parts = baseRgb.split(',').map(Number);
    const highlight = `${Math.min(255, parts[0]+90)},${Math.min(255, parts[1]+90)},${Math.min(255, parts[2]+90)}`;

    // Soft radial gradient layers (smooth center glow)
    const layers = [
        { widthFactor: 1.0, alpha: 0.05, brightness: 0.10 }, // Gentle start
        { widthFactor: 0.9, alpha: 0.50, brightness: 0.18 }, // Small, natural jump
        { widthFactor: 0.8, alpha: 0.50, brightness: 0.32 },
        { widthFactor: 0.7, alpha: 0.50, brightness: 0.48 }, // Building momentum
        { widthFactor: 0.6, alpha: 0.50, brightness: 0.62 },
        { widthFactor: 0.5, alpha: 0.50, brightness: 0.75 }, // Crossing the midpoint
        { widthFactor: 0.4, alpha: 0.50, brightness: 0.85 },
        { widthFactor: 0.3, alpha: 0.50, brightness: 0.92 },
        { widthFactor: 0.2, alpha: 0.50, brightness: 0.97 }, // Still climbing...
        { widthFactor: 0.1, alpha: 0.50, brightness: 1.00 }  // Reaches peak at the very end
    ];

    for (const layer of layers) {
        const w = bodyWidth * layer.widthFactor;
        const base = parts;
        const high = highlight.split(',').map(Number);
        const r = Math.round(base[0] * (1 - layer.brightness) + high[0] * layer.brightness);
        const g = Math.round(base[1] * (1 - layer.brightness) + high[1] * layer.brightness);
        const b = Math.round(base[2] * (1 - layer.brightness) + high[2] * layer.brightness);

        sCtx.globalAlpha = layer.alpha;
        sCtx.lineWidth = w;
        sCtx.strokeStyle = `rgb(${r},${g},${b})`;
        sCtx.stroke(path);
    }
    sCtx.globalAlpha = 1.0;

    // Render scratch buffer back to main canvas
    ctx.drawImage(sCanvas, 0, 0);
}

/**
 * A utility drawing function that loops grid spacing structures across the canvas element
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 */
function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    const gridSize = 20;
    const stepX = width / gridSize;
    const stepY = height / gridSize;
    
    for (let i = 0; i <= gridSize; i++) {
        const x = i * stepX;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        const y = i * stepY;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

export { calculateSquareSize, updateCanvasSize, drawCanvas, drawGrid };