// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Hide the welcome modal initially
    const welcomeModal = document.getElementById('welcomeModal');
    welcomeModal.style.display = 'flex';
    
    // Get the canvas element
    const canvas = document.getElementById('beatmapCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set initial canvas dimensions and draw
    updateCanvasSize();
    drawCanvas();
    
    // Set up event listeners for menu items
    setupMenuListeners();
    
    // Set up event listeners for welcome modal buttons
    setupWelcomeModalListeners();
    
    // Set up drag and drop functionality
    setupDragAndDrop();

    // Handle window resize
    window.addEventListener('resize', function() {
        updateCanvasSize();
        drawCanvas();
        console.log('Window resized - canvas size updated');
    });
});

/**
 * Pure function to calculate the new canvas size based on window dimensions.
 * Ensures a square canvas that fits within the window with at least 50px padding.
 * @param {number} windowWidth 
 * @param {number} windowHeight 
 * @param {number} topOffset - The height of the menu bar
 * @param {number} bottomOffset - The height of the master track
 * @param {number} padding - The required padding
 * @returns {number} The new dimension for the square canvas
 */
function calculateSquareSize(windowWidth, windowHeight, topOffset, bottomOffset, padding) {
    const availableWidth = windowWidth - (padding * 2);
    const availableHeight = windowHeight - topOffset - bottomOffset - (padding * 2);
    
    // The square size is the minimum of the available width and height
    return Math.max(0, Math.min(availableWidth, availableHeight));
}

/**
 * Updates the canvas element's width and height based on the window size.
 */
function updateCanvasSize() {
    const canvas = document.getElementById('beatmanCanvas') || document.getElementById('beatmapCanvas');
    if (!canvas) return;

    const padding = 50;
    const menuBarHeight = 40;
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

// Function to draw the initial canvas content
function drawCanvas() {
    const canvas = document.getElementById('beatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a simple grid pattern to visualize the canvas
    drawGrid(ctx, canvas.width, canvas.height);
    
    // Draw center point
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 5, 0, Math.PI * 2);
    ctx.fill();
}

// Function to draw grid on canvas
function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

// Set up event listeners for menu items
function setupMenuListeners() {
    const importBtn = document.querySelector('.menu-item:first-child');
    const exportBtn = document.querySelector('.menu-item:last-child');
    
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            alert('Import functionality would be implemented here');
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            alert('Export functionality would be implemented here');
        });
    }
}

// Set up event listeners for welcome modal buttons
function setupWelcomeModalListeners() {
    const loadProjectBtn = document.getElementById('loadProjectBtn');
    const newCanvasBtn = document.getElementById('newCanvasBtn');
    const welcomeModal = document.getElementById('welcomeModal');
    
    if (loadProjectBtn) {
        loadProjectBtn.addEventListener('click', function() {
            welcomeModal.style.display = 'none';
            alert('Load project functionality would be implemented here');
        });
    }
    
    if (newCanvasBtn) {
        newCanvasBtn.addEventListener('click', function() {
            welcomeModal.style.display = 'none';
            alert('New empty canvas functionality would be implemented here');
        });
    }
}

// Set up drag and drop functionality
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const welcomeModal = document.getElementById('welcomeModal');
    
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('drag-over');
    }
    
    function unhighlight() {
        dropZone.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            welcomeModal.style.display = 'none';
            alert(`File dropped: ${files[0].name}\n\nFile processing would be implemented here`);
        }
    }
}