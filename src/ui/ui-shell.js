/**
 * Global UI Shell Controllers
 * Centralizes notifications, fullscreen block loaders, and general popups/menus
 */
import { triggerDirectoryPicker } from '../pipeline/file-ingestor.js';
import { handleOszFile } from '../pipeline/extractor.js';
import { showLoader, hideLoader, showToast } from '../engine/utils.js';
import { sharedState } from '../core/shared-state.js';
import { exportProjectOsu } from '../export/exporter.js';
import { renderTracks } from '../engine/track-manager.js';

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
                const debugDropdown = document.getElementById('debugDropdown');
                if (debugDropdown) debugDropdown.classList.remove('active');
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
    }

    const debugDropdown = document.getElementById('debugDropdown');
    const updateDebugDropdownVisibility = () => {
        if (debugDropdown) {
            debugDropdown.style.display = sharedState.showDebugDropdown ? 'inline-block' : 'none';
        }
    };
    updateDebugDropdownVisibility();

    if (debugDropdown) {
        debugDropdown.addEventListener('click', (e) => {
            const isTrigger = e.target.closest('#debugDropdownTrigger') || e.target === debugDropdown;
            if (isTrigger) {
                debugDropdown.classList.toggle('active');
                if (importDropdown) importDropdown.classList.remove('active');
                e.stopPropagation();
            }
        });
        
        const dropdownContent = debugDropdown.querySelector('.dropdown-content');
        if (dropdownContent) {
            dropdownContent.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't close debug dropdown when clicking inside it
            });
        }
    }

    // Register global hotkey (Ctrl+Alt+D) to toggle debug dropdown visibility
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
            e.preventDefault();
            sharedState.showDebugDropdown = !sharedState.showDebugDropdown;
            localStorage.setItem('debug', sharedState.showDebugDropdown ? 'true' : 'false');
            updateDebugDropdownVisibility();
            showToast(sharedState.showDebugDropdown ? 'Debug menu enabled' : 'Debug menu disabled');
        }
    });

    document.addEventListener('click', () => {
        if (importDropdown) importDropdown.classList.remove('active');
        if (debugDropdown) debugDropdown.classList.remove('active');
    });

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const welcomeModal = document.getElementById('welcomeModal');
                if (welcomeModal) welcomeModal.style.display = 'none';
                await handleOszFile(e.target.files[0]);
            }
        });
    }

    const toggleTimingLines = document.getElementById('toggle-timing-lines');
    if (toggleTimingLines) {
        toggleTimingLines.addEventListener('change', (e) => {
            sharedState.showTimingLines = e.target.checked;
            renderTracks();
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