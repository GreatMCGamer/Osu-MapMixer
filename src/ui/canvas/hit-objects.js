import { sharedState, getActiveDifficulty } from '../../core/shared-state.js';
import { compilePreviewTrack } from '../../engine/preview-compiler.js';
import { getSliderBallPosition, drawSmoothSlider } from './slider-renderer.js';

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

export function drawHitObjects(ctx, canvas) {
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
