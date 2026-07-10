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
    const t0 = performance.now();
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t0_grid = performance.now();
    drawGrid(ctx, canvas.width, canvas.height);
    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.gridRenderMs = performance.now() - t0_grid;
    }
    
    drawHitObjects(ctx, canvas);
    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.canvasRenderMs = performance.now() - t0;
    }
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

    let sliderRenderTotal = 0;
    let circleRenderTotal = 0;

    const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
    const currentTimeMs = sharedState.playheadPosition * totalDuration;

    const PAD = 54.4; // Radius of Circle Size 0 to ensure everything is always fully visible
    const scale = Math.min(canvas.width / (512 + 2 * PAD), canvas.height / (384 + 2 * PAD));
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
    const t0_filter = performance.now();
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
    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.hitObjectFilterMs = performance.now() - t0_filter;
    }

    // Draw the 512x384 playfield dashed boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(tx(0), ty(0), 512 * scale, 384 * scale);
    ctx.restore();

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

        if (note.type === 'slider' && note.sliderData && note.sliderData.bakedPath) {
            const t0_slider = performance.now();
            drawSmoothSlider(ctx, note, tx, ty, CIRCLE_RADIUS * 2, rgb, isHighlighted, scale);
            sliderRenderTotal += performance.now() - t0_slider;
        } else if (note.type === 'spinner') {
            const t0_spinner = performance.now();
            ctx.beginPath();
            ctx.arc(tx(256), ty(192), CIRCLE_RADIUS * 3, 0, Math.PI * 2);
            ctx.strokeStyle = isHighlighted ? 'rgba(255, 102, 170, 0.8)' : `rgba(${rgb}, 0.3)`;
            ctx.lineWidth = isHighlighted ? 6 : 4;
            ctx.stroke();
            circleRenderTotal += performance.now() - t0_spinner;
        }

        // Draw hit circle / slider head
        if (note.type === 'circle' || note.type === 'slider') {
            const t0_circle = performance.now();
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
            ctx.fillStyle = `rgba(${rgb}, 0.3)`;
            ctx.fill();

            ctx.lineWidth = isHighlighted ? 5 : 3;
            ctx.strokeStyle = isHighlighted ? '#ff66aa' : 'white';
            ctx.stroke();

            // Draw combo number
            const comboNum = note.comboNumber !== undefined ? note.comboNumber : 1;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.round(CIRCLE_RADIUS * 0.8)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(comboNum, tx(note.x), ty(note.y));
            circleRenderTotal += performance.now() - t0_circle;
        }

        // Draw moving slider ball and follow circle if active
        if (note.type === 'slider' && currentTimeMs >= startTime && currentTimeMs <= endTime) {
            const t0_ball = performance.now();
            const ballPos = getSliderBallPosition(note, currentTimeMs, startTime, endTime);
            sliderRenderTotal += performance.now() - t0_ball;
            const bx = tx(ballPos.x);
            const by = ty(ballPos.y);

            const t0_ball_draw = performance.now();
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
            ctx.fillStyle = `rgba(${rgb}, 0.3)`;
            ctx.fill();

            // Draw inner white core of the slider ball
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Outer ring of the slider ball itself
            ctx.beginPath();
            ctx.arc(bx, by, CIRCLE_RADIUS * 0.95, 0, Math.PI * 2);
            ctx.strokeStyle = isHighlighted ? '#ff66aa' : '#ffffff';
            ctx.lineWidth = isHighlighted ? 5 : 3 * scale;
            ctx.stroke();
            circleRenderTotal += performance.now() - t0_ball_draw;
        }
    });

    if (sharedState.performanceTimings) {
        sharedState.performanceTimings.sliderRenderMs = sliderRenderTotal;
        sharedState.performanceTimings.circleRenderMs = circleRenderTotal;
    }

    ctx.globalAlpha = 1;
}

/**
 * Procedurally generates smooth slider bodies using mathematical layered gradients
 */
function drawSmoothSlider(ctx, note, tx, ty, trackDiam, baseRgb, isHighlighted, scale) {
    if (!note.sliderData || !note.sliderData.bakedPath || note.sliderData.bakedPath.length === 0) return;

    if (!note.sliderData.cachedCanvas || 
        note.sliderData.cachedWidth !== ctx.canvas.width ||
        note.sliderData.cachedHeight !== ctx.canvas.height ||
        note.sliderData.cachedIsHighlighted !== isHighlighted) {
        
        const baked = note.sliderData.bakedPath;
        let minX = baked[0].x, maxX = baked[0].x;
        let minY = baked[0].y, maxY = baked[0].y;
        for (let i = 1; i < baked.length; i++) {
            if (baked[i].x < minX) minX = baked[i].x;
            if (baked[i].x > maxX) maxX = baked[i].x;
            if (baked[i].y < minY) minY = baked[i].y;
            if (baked[i].y > maxY) maxY = baked[i].y;
        }

        const padding = (trackDiam / scale) / 2 + (15 / scale);
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        const w = (maxX - minX) * scale;
        const h = (maxY - minY) * scale;

        const sCanvas = document.createElement('canvas');
        sCanvas.width = Math.ceil(w);
        sCanvas.height = Math.ceil(h);
        const sCtx = sCanvas.getContext('2d');
        sCtx.lineCap = 'round';
        sCtx.lineJoin = 'round';

        const localTx = (x) => (x - minX) * scale;
        const localTy = (y) => (y - minY) * scale;

        const path = new Path2D();
        path.moveTo(localTx(baked[0].x), localTy(baked[0].y));
        for (let i = 1; i < baked.length; i++) {
            path.lineTo(localTx(baked[i].x), localTy(baked[i].y));
        }

        const bodyWidth = trackDiam * 0.82;
        const borderRgb = isHighlighted ? '255, 102, 170' : '255,255,255';
        
        // 1. Outer border
        sCtx.lineWidth = isHighlighted ? trackDiam + 10 : trackDiam;
        sCtx.strokeStyle = `rgb(${borderRgb})`;
        sCtx.stroke(path);

        // 2. Hollow out
        sCtx.globalCompositeOperation = 'destination-out';
        sCtx.lineWidth = bodyWidth;
        sCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
        sCtx.stroke(path);
        sCtx.globalCompositeOperation = 'source-over';

        // Highlight (brighten)
        const parts = baseRgb.split(',').map(Number);
        const highlight = `${Math.min(255, parts[0]+90)},${Math.min(255, parts[1]+90)},${Math.min(255, parts[2]+90)}`;

        const layers = [
            { widthFactor: 1.0, alpha: 0.05, brightness: 0.10 },
            { widthFactor: 0.9, alpha: 0.50, brightness: 0.18 },
            { widthFactor: 0.8, alpha: 0.50, brightness: 0.32 },
            { widthFactor: 0.7, alpha: 0.50, brightness: 0.48 },
            { widthFactor: 0.6, alpha: 0.50, brightness: 0.62 },
            { widthFactor: 0.5, alpha: 0.50, brightness: 0.75 },
            { widthFactor: 0.4, alpha: 0.50, brightness: 0.85 },
            { widthFactor: 0.3, alpha: 0.50, brightness: 0.92 },
            { widthFactor: 0.2, alpha: 0.50, brightness: 0.97 },
            { widthFactor: 0.1, alpha: 0.50, brightness: 1.00 }
        ];

        for (const layer of layers) {
            const lw = bodyWidth * layer.widthFactor;
            const base = parts;
            const high = highlight.split(',').map(Number);
            const r = Math.round(base[0] * (1 - layer.brightness) + high[0] * layer.brightness);
            const g = Math.round(base[1] * (1 - layer.brightness) + high[1] * layer.brightness);
            const b = Math.round(base[2] * (1 - layer.brightness) + high[2] * layer.brightness);

            sCtx.globalAlpha = layer.alpha * 0.3;
            sCtx.lineWidth = lw;
            sCtx.strokeStyle = `rgb(${r},${g},${b})`;
            sCtx.stroke(path);
        }
        sCtx.globalAlpha = 1.0;

        note.sliderData.cachedCanvas = sCanvas;
        note.sliderData.cachedWidth = ctx.canvas.width;
        note.sliderData.cachedHeight = ctx.canvas.height;
        note.sliderData.cachedIsHighlighted = isHighlighted;
        note.sliderData.cachedMinX = minX;
        note.sliderData.cachedMinY = minY;
    }

    ctx.drawImage(note.sliderData.cachedCanvas, tx(note.sliderData.cachedMinX), ty(note.sliderData.cachedMinY));
}

/**
 * A utility drawing function that loops grid spacing structures strictly inside the playfield area
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 */
function drawGrid(ctx, width, height) {
    const canvas = ctx.canvas;
    if (!canvas) return;
    const PAD = 54.4;
    const scale = Math.min(canvas.width / (512 + 2 * PAD), canvas.height / (384 + 2 * PAD));
    const offsetX = (canvas.width - 512 * scale) / 2;
    const offsetY = (canvas.height - 384 * scale) / 2;

    const playfieldWidth = 512 * scale;
    const playfieldHeight = 384 * scale;

    const step = playfieldHeight / 12; // exactly 32 * scale
    
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    
    // Draw vertical columns inside playfield
    const numCols = 16;
    for (let i = 0; i <= numCols; i++) {
        const x = offsetX + i * step;
        ctx.beginPath();
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, offsetY + playfieldHeight);
        ctx.stroke();
    }
    
    // Draw horizontal rows inside playfield
    const numRows = 12;
    for (let i = 0; i <= numRows; i++) {
        const y = offsetY + i * step;
        ctx.beginPath();
        ctx.moveTo(offsetX, y);
        ctx.lineTo(offsetX + playfieldWidth, y);
        ctx.stroke();
    }

    // Draw center crosshairs/axes with a slightly brighter opacity for professional styling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    
    // Vertical center axis
    ctx.beginPath();
    ctx.moveTo(offsetX + playfieldWidth / 2, offsetY);
    ctx.lineTo(offsetX + playfieldWidth / 2, offsetY + playfieldHeight);
    ctx.stroke();

    // Horizontal center axis
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + playfieldHeight / 2);
    ctx.lineTo(offsetX + playfieldWidth, offsetY + playfieldHeight / 2);
    ctx.stroke();

    ctx.restore();
}

export { calculatePlayfieldSize, updateCanvasSize, drawCanvas, drawGrid };