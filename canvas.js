/**
 * Main Beatmap Canvas Visualizer
 * Handles pixel drawing calculations, canvas grids, viewport boundaries, and geometric scaling coordinates
 */

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

/**
 * Erases and repaints grid segments and reference anchors on the screen context
 */
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

/**
 * A utility drawing function that loops grid spacing structures across the canvas element
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width 
 * @param {number} height 
 */
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

export { calculateSquareSize, updateCanvasSize, drawCanvas, drawGrid };