export function getSliderBallPosition(note, currentTimeMs, startTime, endTime) {
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

export function drawSmoothSlider(ctx, note, tx, ty, trackDiam, baseRgb, isHighlighted, scale) {
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
