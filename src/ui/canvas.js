import { sharedState, getHighlightedTrackId, getActiveDifficulty } from '../core/shared-state.js';
import { getNoteTimes, projectObjectToMaster, convertBeatToMs } from '../engine/track-utils.js';
import { compilePreviewTrack } from '../engine/preview-compiler.js';

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

let lastTracksStateStr = '';

function checkPreviewDirty() {
    const tracksSummary = sharedState.tracks.map(t => {
        return `${t.id}-${t.type}-${t.clips ? t.clips.length : 0}-${t.clips ? t.clips.map(c => `${c.clipId}-${c.timelineStartBeat}-${c.timelineEndBeat}-${c.startTimeMs}-${c.endTimeMs}`).join(',') : ''}`;
    }).join('|');
    const stateStr = `${sharedState.highlightedTrackId}|${sharedState.selectedTimingSourceAssetId}|${tracksSummary}`;
    if (stateStr !== lastTracksStateStr) {
        lastTracksStateStr = stateStr;
        return true;
    }
    return false;
}

/**
 * Calculates mathematically balanced viewport bounds to keep the preview screen a perfect 4:3 aspect ratio

 * matching the official osu! playfield coordinate space (512x384).
 * @param {number} windowWidth 
 * @param {number} windowHeight 
 * @param {number} topOffset 
 * @param {number} bottomOffset 
 * @param {number} padding 
 * @returns {{width: number, height: number}} 
 */
function calculatePlayfieldSize(windowWidth, windowHeight, topOffset, bottomOffset, padding) {
    const availableWidth = windowWidth - (padding * 2);
    const availableHeight = windowHeight - topOffset - bottomOffset - (padding * 2);

    // osu! aspect ratio is 4:3
    // W / H = 4 / 3 => W = H * 4 / 3
    let height = availableHeight;
    let width = height * 4 / 3;

    if (width > availableWidth) {
        width = availableWidth;
        height = width * 3 / 4;
    }

    return {
        width: Math.max(0, width),
        height: Math.max(0, height)
    };
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

    const size = calculatePlayfieldSize(
        window.innerWidth,
        window.innerHeight,
        menuBarHeight,
        (window.innerHeight - dividerTop),
        padding
    );

    canvas.width = size.width;
    canvas.height = size.height;
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
 * Calculates the current interpolated coordinates of a slider ball along its path.
 * @param {Object} note 
 * @param {number} currentTimeMs 
 * @param {number} startTime 
 * @param {number} endTime 
 * @returns {{x: number, y: number}}
 */
function getSliderBallPosition(note, currentTimeMs, startTime, endTime) {
    if (!note.sliderData || !note.sliderData.bakedPath || note.sliderData.bakedPath.length === 0) {
        return { x: note.x, y: note.y };
    }
    const durationMs = endTime - startTime;
    if (durationMs <= 0) {
        return { x: note.x, y: note.y };
    }

    const progress = Math.max(0, Math.min(1, (currentTimeMs - startTime) / durationMs));
    const slides = note.sliderData.slides || 1;
    
    const scaledProgress = progress * slides;
    const slideIndex = Math.floor(scaledProgress);
    const slideProgress = scaledProgress % 1;
    
    // If slideIndex is odd, the ball is traveling backwards
    const isGoingBackwards = (slideIndex % 2 === 1);
    const targetFraction = isGoingBackwards ? (1 - slideProgress) : slideProgress;
    
    const pixelLength = note.sliderData.pixelLength || 100;
    const targetDist = targetFraction * pixelLength;
    
    const bakedPath = note.sliderData.bakedPath;
    if (bakedPath.length === 1) return bakedPath[0];
    if (targetDist <= bakedPath[0].dist) return bakedPath[0];
    if (targetDist >= bakedPath[bakedPath.length - 1].dist) return bakedPath[bakedPath.length - 1];

    for (let i = 0; i < bakedPath.length - 1; i++) {
        const p1 = bakedPath[i];
        const p2 = bakedPath[i + 1];
        if (targetDist >= p1.dist && targetDist <= p2.dist) {
            const range = p2.dist - p1.dist;
            if (range === 0) return p1;
            const t = (targetDist - p1.dist) / range;
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            };
        }
    }
    
    return bakedPath[bakedPath.length - 1];
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

    // Compile active preview objects onto the ghost preview track if state changed
    if (checkPreviewDirty() || !sharedState.ghostPreviewTrack) {
        compilePreviewTrack();
    }

    // Retrieve active objects from the ghost preview track, filtering by AR_TIME
    const activeObjects = [];
    if (sharedState.ghostPreviewTrack && sharedState.ghostPreviewTrack.sourceAsset && sharedState.ghostPreviewTrack.sourceAsset.hitObjects) {
        sharedState.ghostPreviewTrack.sourceAsset.hitObjects.forEach(obj => {
            if (currentTimeMs >= obj.startTime - AR_TIME && currentTimeMs <= obj.endTime + 150) {
                activeObjects.push({
                    note: obj,
                    track: sharedState.tracks.find(t => t.id === obj.trackId) || { id: obj.trackId },
                    startTime: obj.startTime,
                    endTime: obj.endTime
                });
            }
        });
    }

    // Sort descending by startTime so earlier objects are drawn ON TOP of later ones
    activeObjects.sort((a, b) => b.startTime - a.startTime);

    activeObjects.forEach(obj => {
        const { note, startTime, endTime } = obj;
        const color = DEFAULT_COMBO_COLORS[(note.comboColorIndex !== undefined ? note.comboColorIndex : (note.comboNumber || 0)) % DEFAULT_COMBO_COLORS.length];
        const rgb = `${color.r},${color.g},${color.b}`;

        const isHighlighted = !!(sharedState.highlightSelection &&
            sharedState.highlightSelection.trackId === obj.track.id &&
            startTime >= sharedState.highlightSelection.startMs &&
            startTime <= sharedState.highlightSelection.endMs);

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

        // Draw glowing halo for highlighted objects
        if (isHighlighted && (note.type === 'circle' || note.type === 'slider')) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(tx(note.x), ty(note.y), CIRCLE_RADIUS * 1.35, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff66aa';
            ctx.lineWidth = 4 * scale;
            ctx.shadowColor = '#ff66aa';
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.restore();
        }

        if (note.type === 'slider' && note.sliderData && note.sliderData.bakedPath) {
            drawSmoothSlider(ctx, note, tx, ty, CIRCLE_RADIUS * 2, rgb, isHighlighted);
        } else if (note.type === 'spinner') {
            ctx.beginPath();
            ctx.arc(tx(256), ty(192), CIRCLE_RADIUS * 3, 0, Math.PI * 2);
            ctx.strokeStyle = isHighlighted ? 'rgba(255, 102, 170, 0.8)' : `rgba(${rgb}, 0.5)`;
            ctx.lineWidth = isHighlighted ? 6 : 4;
            ctx.stroke();
        }

        // Draw hit circle / slider head
        if (note.type === 'circle' || note.type === 'slider') {
            // Draw approach circle
            if (currentTimeMs < startTime) {
                const approachScale = 1 + 2 * (1 - (currentTimeMs - (startTime - AR_TIME)) / AR_TIME);
                ctx.beginPath();
                ctx.arc(tx(note.x), ty(note.y), CIRCLE_RADIUS * approachScale, 0, Math.PI * 2);
                ctx.strokeStyle = isHighlighted ? '#ff66aa' : `rgb(${rgb})`;
                ctx.lineWidth = isHighlighted ? 3 : 2;
                ctx.stroke();
            }

            // Draw circle body
            ctx.beginPath();
            ctx.arc(tx(note.x), ty(note.y), CIRCLE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = isHighlighted ? '#ff66aa' : 'white';
            ctx.stroke();

            // Draw combo number
            const comboNum = note.comboNumber !== undefined ? note.comboNumber : 1;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(CIRCLE_RADIUS * 0.8)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(comboNum, tx(note.x), ty(note.y));
        }

        // Draw moving slider ball and follow circle if active
        if (note.type === 'slider' && currentTimeMs >= startTime && currentTimeMs <= endTime) {
            const ballPos = getSliderBallPosition(note, currentTimeMs, startTime, endTime);
            const bx = tx(ballPos.x);
            const by = ty(ballPos.y);

            // 1. Draw slider follow circle (glowing outer ring)
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 1.7, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 4 * scale;
            ctx.shadowColor = '#ff66aa';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.restore();

            // Secondary subtle inner ring
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
            ctx.lineWidth = 1.5 * scale;
            ctx.stroke();

            // 2. Draw slider ball body
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 0.95, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${rgb})`;
            ctx.fill();

            // Draw inner white core of the slider ball
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Outer ring of the slider ball itself
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 0.95, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 * scale;
            ctx.stroke();
        }
    });

    ctx.globalAlpha = 1;
}

/**
 * Procedurally generates smooth slider bodies using mathematical layered gradients
 */
function drawSmoothSlider(ctx, note, tx, ty, trackDiam, baseRgb, isHighlighted) {
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
    const borderRgb = isHighlighted ? '255, 102, 170' : '255,255,255';
    
    // 1. Outer border
    sCtx.lineWidth = isHighlighted ? trackDiam * 1.2 : trackDiam;
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
    // Grid spacing (step) is determined solely by the vertical distance (height)
    // We divide the vertical height into 12 segments (384 / 12 = 32 osu!px per grid cell).
    const step = height / 12;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    
    // Draw vertical columns based on step size
    const numCols = Math.round(width / step);
    for (let i = 0; i <= numCols; i++) {
        const x = i * step;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw horizontal rows based on step size (exactly 12 rows)
    const numRows = 12;
    for (let i = 0; i <= numRows; i++) {
        const y = i * step;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw center crosshairs/axes with a slightly brighter opacity for professional styling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    
    // Vertical center axis
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Horizontal center axis
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

export { calculatePlayfieldSize, updateCanvasSize, drawCanvas, drawGrid };