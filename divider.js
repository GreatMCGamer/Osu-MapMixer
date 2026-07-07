/**
 * Divider Interaction Controller
 * Manages the mouse-driven resizing of the canvas/timeline split
 */
import { updateCanvasSize, drawCanvas } from './canvas.js';

/**
 * Initializes drag-to-resize functionality for the divider element
 */
function setupDividerResizing() {
    const divider = document.getElementById('divider');
    if (!divider) return;

    let isDragging = false;

    divider.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'row-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Calculate new position as percentage
        const newTop = (e.clientY / window.innerHeight) * 100;
        
        // Constrain between 10% and 90%
        const constrainedTop = Math.max(10, Math.min(90, newTop));
        
        divider.style.top = `${constrainedTop}%`;
        
        // Update CSS variable for CSS-based layout
        document.documentElement.style.setProperty('--divider-top', `${constrainedTop}%`);
        
        // Trigger canvas resize
        updateCanvasSize();
        drawCanvas();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });
}

export { setupDividerResizing };
