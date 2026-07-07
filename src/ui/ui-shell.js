/**
 * Global UI Shell Controllers
 * Centralizes notifications, fullscreen block loaders, and general popups/menus
 */
import { triggerDirectoryPicker } from '../pipeline/file-ingestor.js';
import { handleOszFile } from '../pipeline/extractor.js';
import { showLoader, hideLoader, showToast } from '../engine/utils.js';

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