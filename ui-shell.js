/**
 * Global UI Shell Controllers
 * Centralizes notifications, fullscreen block loaders, and general popups/menus
 */
import { triggerDirectoryPicker } from './file-ingestor.js';
import { handleOszFile } from './extractor.js';

/**
 * Displays the global spinner block along with customized progression notifications
 * @param {string} message 
 */
function showLoader(message) {
    const loaderOverlay = document.getElementById('loaderOverlay');
    const loaderText = document.getElementById('loaderText');
    if (loaderOverlay && loaderText) {
        loaderText.textContent = message;
        loaderOverlay.style.display = 'flex';
    }
}

/**
 * Hides the global progress block
 */
function hideLoader() {
    const loaderOverlay = document.getElementById('loaderOverlay');
    if (loaderOverlay) {
        loaderOverlay.style.display = 'none';
    }
}

/**
 * Spawns localized temporary sliding notification alerts for success, warnings, or errors
 * @param {string} message 
 * @param {string} type 
 */
function showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto delete toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease-out reverse forwards";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

/**
 * Binds actions to navigation links inside the top header
 */
function setupMenuListeners() {
    const importOszBtnMenu = document.getElementById('importOszBtnMenu');
    const importFolderBtnMenu = document.getElementById('importFolderBtnMenu');
    const exportBtn = document.getElementById('exportBtnMenu');
    const fileInput = document.getElementById('oszFileInput');
    
    if (importOszBtnMenu && fileInput) {
        importOszBtnMenu.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtnMenu) {
        importFolderBtnMenu.addEventListener('click', triggerDirectoryPicker);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            console.log("Export triggered.");
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const welcomeModal = document.getElementById('welcomeModal');
                if (welcomeModal) welcomeModal.style.display = 'none';
                await handleOszFile(e.target.files[0]);
            }
        });
    }
}

/**
 * Configures initial prompt interfaces, loading state dismissals, and clean setup paths
 */
function setupWelcomeModalListeners() {
    const importOszBtnModal = document.getElementById('importOszBtnModal');
    const importFolderBtnModal = document.getElementById('importFolderBtnModal');
    const newCanvasBtn = document.getElementById('newCanvasBtn');
    const welcomeModal = document.getElementById('welcomeModal');
    const fileInput = document.getElementById('oszFileInput');
    
    if (importOszBtnModal && fileInput) {
        importOszBtnModal.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtnModal) {
        importFolderBtnModal.addEventListener('click', triggerDirectoryPicker);
    }
    if (newCanvasBtn) {
        newCanvasBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
        });
    }
}

export { showLoader, hideLoader, showToast, setupMenuListeners, setupWelcomeModalListeners };