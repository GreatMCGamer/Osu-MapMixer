export function calculatePlayfieldSize(windowWidth, windowHeight, topOffset, bottomOffset, padding) {
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

export function updateCanvasSize() {
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

export function drawGrid(ctx, width, height) {
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
