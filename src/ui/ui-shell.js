/**
 * Global UI Shell Controllers
 * Centralizes notifications, fullscreen block loaders, and general popups/menus
 */
import { triggerDirectoryPicker } from '../pipeline/file-ingestor.js';
import { handleOszFile } from '../pipeline/extractor.js';
import { showLoader, hideLoader, showToast } from '../engine/utils.js';
import { sharedState } from '../core/shared-state.js';
import { exportProjectOsu } from '../export/exporter.js';

/**
 * Binds actions to navigation links inside the top header
 */
function setupMenuListeners() {
    const importOszBtnMenu = document.getElementById('importOszBtnMenu');
    const importFolderBtnMenu = document.getElementById('importFolderBtnMenu');
    const exportBtn = document.getElementById('exportBtnMenu');
    const fileInput = document.getElementById('oszFileInput');
    const importDropdown = document.getElementById('importDropdown');
    
    if (importOszBtnMenu && fileInput) {
        importOszBtnMenu.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtnMenu) {
        importFolderBtnMenu.addEventListener('click', triggerDirectoryPicker);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            console.log("Export triggered.");
            exportProjectOsu();
        });
    }

    // Volume Control Listener
    const volumeSlider = document.getElementById('volumeSlider');
    const volumePercent = document.getElementById('volumePercent');
    const volumeMuteBtn = document.getElementById('volumeMuteBtn');

    if (volumeSlider && volumePercent) {
        const initialVol = sharedState.volume !== undefined ? sharedState.volume : 0.5;
        volumeSlider.value = initialVol;
        volumePercent.innerText = `${Math.round(initialVol * 100)}%`;

        const updateVolume = (val) => {
            sharedState.volume = val;
            volumePercent.innerText = `${Math.round(val * 100)}%`;
            if (volumeMuteBtn) {
                if (val === 0) {
                    volumeMuteBtn.innerText = '🔇';
                } else if (val < 0.5) {
                    volumeMuteBtn.innerText = '🔉';
                } else {
                    volumeMuteBtn.innerText = '🔊';
                }
            }
        };

        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            updateVolume(val);
        });

        // Toggle mute when clicking the icon
        let previousVolume = 0.5;
        if (volumeMuteBtn) {
            volumeMuteBtn.addEventListener('click', () => {
                const currentVol = sharedState.volume !== undefined ? sharedState.volume : 0.5;
                if (currentVol > 0) {
                    previousVolume = currentVol;
                    volumeSlider.value = 0;
                    updateVolume(0);
                } else {
                    volumeSlider.value = previousVolume;
                    updateVolume(previousVolume);
                }
            });
        }
    }

    if (importDropdown) {
        importDropdown.addEventListener('click', (e) => {
            const isTrigger = e.target.closest('#importDropdownTrigger') || e.target === importDropdown;
            if (isTrigger) {
                importDropdown.classList.toggle('active');
                e.stopPropagation();
            }
        });
        
        const dropdownContent = importDropdown.querySelector('.dropdown-content');
        if (dropdownContent) {
            dropdownContent.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown-item')) {
                    e.stopPropagation();
                } else {
                    importDropdown.classList.remove('active');
                }
            });
        }

        document.addEventListener('click', () => {
            importDropdown.classList.remove('active');
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