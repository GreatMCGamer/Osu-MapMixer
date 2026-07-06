// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Hide the welcome modal initially
    const welcomeModal = document.getElementById('welcomeModal');
    welcomeModal.style.display = 'flex';
    
    // Get the canvas element
    const canvas = document.getElementById('beatmapCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    // We'll make it a square canvas with a reasonable size
    const canvasSize = 600;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Draw initial canvas content
    drawCanvas();
    
    // Set up event listeners for menu items
    setupMenuListeners();
    
    // Set up event listeners for welcome modal buttons
    setupWelcomeModalListeners();
    
    // Set up drag and drop functionality
    setupDragAndDrop();
});

// Function to draw the initial canvas content
function drawCanvas() {
    const canvas = document.getElementById('beatmapCanvas');
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
    
    importBtn.addEventListener('click', function() {
        alert('Import functionality would be implemented here');
        // In a real implementation, this would open a file dialog
    });
    
    exportBtn.addEventListener('click', function() {
        alert('Export functionality would be implemented here');
        // In a real implementation, this would save the beatmap
    });
}

// Set up event listeners for welcome modal buttons
function setupWelcomeModalListeners() {
    const loadProjectBtn = document.getElementById('loadProjectBtn');
    const newCanvasBtn = document.getElementById('newCanvasBtn');
    const welcomeModal = document.getElementById('welcomeModal');
    
    loadProjectBtn.addEventListener('click', function() {
        // Hide the welcome modal
        welcomeModal.style.display = 'none';
        alert('Load project functionality would be implemented here');
        // In a real implementation, this would open a file dialog for .osz files or map folders
    });
    
    newCanvasBtn.addEventListener('click', function() {
        // Hide the welcome modal
        welcomeModal.style.display = 'none';
        alert('New empty canvas functionality would be implemented here');
        // In a real implementation, this would create a new empty canvas
    });
}

// Set up drag and drop functionality
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const welcomeModal = document.getElementById('welcomeModal');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
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
            // Hide the welcome modal
            welcomeModal.style.display = 'none';
            
            // Process the dropped files
            alert(`File dropped: ${files[0].name}\n\nFile processing would be implemented here`);
            // In a real implementation, this would process .osz files or map folders
        }
    }
}

// Handle window resize
window.addEventListener('resize', function() {
    // In a real implementation, we might need to redraw or adjust canvas
    console.log('Window resized - canvas may need adjustment');
});