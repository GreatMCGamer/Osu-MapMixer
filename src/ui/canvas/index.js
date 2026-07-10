import { sharedState } from '../../core/shared-state.js';
import { drawGrid, calculatePlayfieldSize, updateCanvasSize } from './layout.js';
import { drawHitObjects } from './hit-objects.js';

/**
 * Erases and repaints grid segments and reference anchors on the screen context
 */
export function drawCanvas() {
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

export { calculatePlayfieldSize, updateCanvasSize, drawGrid };
