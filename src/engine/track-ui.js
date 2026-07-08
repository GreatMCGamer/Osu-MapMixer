import { sharedState, getHighlightedTrackId } from '../core/shared-state.js';
import { getTimingAndBeatLines } from './track-utils.js';
import { drawCanvas } from '../ui/canvas.js';
import { renderTracks } from './track-manager.js';

export function renderTimingGridLines(contentEl, timingAsset, totalDurationMs, options = {}) {
    if (!timingAsset) return;

    const { showRedLines = true, showGreenLines = true, showBeatLines = true } = options;
    const { redLines, greenLines, beatLines } = getTimingAndBeatLines(timingAsset, totalDurationMs);

    // 1. Draw beat lines (subtle white/grey lines)
    if (showBeatLines) {
        beatLines.forEach(bl => {
            const pct = (bl.timeMs / totalDurationMs) * 100;
            if (pct < 0 || pct > 100) return;

            const lineEl = document.createElement('div');
            lineEl.className = bl.isMajor ? 'bpm-beat-line major-beat' : 'bpm-beat-line';
            lineEl.style.position = 'absolute';
            lineEl.style.left = `${pct}%`;
            lineEl.style.top = '0';
            lineEl.style.bottom = '0';
            lineEl.style.width = '1px';
            lineEl.style.pointerEvents = 'none';

            contentEl.appendChild(lineEl);
        });
    }

    // 2. Draw red lines (uninherited timing points)
    if (showRedLines) {
        redLines.forEach(rl => {
            const pct = (rl.timeMs / totalDurationMs) * 100;
            if (pct < 0 || pct > 100) return;

            const lineEl = document.createElement('div');
            lineEl.className = 'timing-red-line';
            lineEl.style.position = 'absolute';
            lineEl.style.left = `${pct}%`;
            lineEl.style.top = '0';
            lineEl.style.bottom = '0';
            lineEl.style.width = '1px';
            lineEl.style.pointerEvents = 'none';

            // Add a tiny indicator label
            const labelEl = document.createElement('span');
            labelEl.className = 'timing-line-label';
            labelEl.innerText = rl.label;
            lineEl.appendChild(labelEl);

            contentEl.appendChild(lineEl);
        });
    }

    // 3. Draw green lines (volume changes)
    if (showGreenLines) {
        greenLines.forEach(gl => {
            const pct = (gl.timeMs / totalDurationMs) * 100;
            if (pct < 0 || pct > 100) return;

            const lineEl = document.createElement('div');
            lineEl.className = 'timing-green-line';
            lineEl.style.position = 'absolute';
            lineEl.style.left = `${pct}%`;
            lineEl.style.top = '0';
            lineEl.style.bottom = '0';
            lineEl.style.width = '1px';
            lineEl.style.pointerEvents = 'none';

            // Add a tiny indicator label
            const labelEl = document.createElement('span');
            labelEl.className = 'timing-line-label';
            labelEl.innerText = gl.label;
            lineEl.appendChild(labelEl);

            contentEl.appendChild(lineEl);
        });
    }
}

export function showDeleteConfirmationModal(track, onDelete) {
    const existingModal = document.getElementById('delete-confirm-modal');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999';

    const card = document.createElement('div');
    card.style.backgroundColor = '#1e1e24';
    card.style.border = '1px solid #ff4444';
    card.style.borderRadius = '8px';
    card.style.padding = '24px';
    card.style.maxWidth = '400px';
    card.style.width = '90%';
    card.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.8)';
    card.style.fontFamily = `'Space Grotesk', 'Segoe UI', system-ui, sans-serif`;
    card.style.color = '#eee';
    card.style.textAlign = 'center';

    card.innerHTML = `
        <h3 style="margin-top: 0; color: #ff4444; font-size: 18px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 12px; font-family: inherit;">DELETE MASTER TRACK?</h3>
        <p style="font-size: 13px; color: #ccc; line-height: 1.5; margin-bottom: 20px; font-family: inherit;">
            This track (<strong>${track.id.toUpperCase()}</strong>) contains pattern clips and beatmap objects. Deleting it will permanently remove all your work on this track.
        </p>
        <div style="display: flex; justify-content: center; gap: 12px;">
            <button id="modal-confirm-delete-btn" style="background-color: #ff4444; color: #fff; border: none; border-radius: 4px; padding: 8px 16px; font-size: 13px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; font-family: inherit;">Yes, Delete</button>
            <button id="modal-cancel-delete-btn" style="background-color: #333; color: #ccc; border: none; border-radius: 4px; padding: 8px 16px; font-size: 13px; cursor: pointer; transition: background-color 0.2s; font-family: inherit;">Cancel</button>
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const confirmBtn = card.querySelector('#modal-confirm-delete-btn');
    const cancelBtn = card.querySelector('#modal-cancel-delete-btn');

    confirmBtn.onclick = () => {
        onDelete();
        overlay.remove();
    };

    cancelBtn.onclick = () => {
        overlay.remove();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

export const cleanValue = (inputStr, maxVal, prevVal) => {
    const trimmed = inputStr.trim();
    if (trimmed === '') return 0;
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
        return typeof prevVal === 'number' ? prevVal : 0;
    }
    if (parsed > maxVal) {
        return maxVal;
    }
    if (parsed < 0) {
        return 0;
    }
    return parsed;
};

export function toggleDifficultyDropdown(track, triggerEl) {
    const existing = document.getElementById('difficulty-dropdown');
    if (existing) {
        const openedTrackId = existing.dataset.trackId;
        existing.remove();
        if (openedTrackId === track.id) {
            return;
        }
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'difficulty-dropdown';
    dropdown.dataset.trackId = track.id;
    dropdown.className = 'difficulty-dropdown';
    
    if (!track.difficulty) {
        track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
    }

    const rect = triggerEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    dropdown.style.zIndex = '99999';

    dropdown.innerHTML = `
        <div class="difficulty-dropdown-title" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>DIFFICULTY SETTINGS</span>
            <span id="diff-close-btn" style="cursor: pointer; font-size: 14px; color: #ff66aa; font-weight: bold; margin-left: auto; line-height: 1; padding: 2px;">✕</span>
        </div>
        <div class="difficulty-dropdown-row">
            <label>CS (0-10):</label>
            <input type="text" id="diff-cs" value="${track.difficulty.CS}" />
        </div>
        <div class="difficulty-dropdown-row">
            <label>AR (0-10):</label>
            <input type="text" id="diff-ar" value="${track.difficulty.AR}" />
        </div>
        <div class="difficulty-dropdown-row">
            <label>OD (0-10):</label>
            <input type="text" id="diff-od" value="${track.difficulty.OD}" />
        </div>
        <div class="difficulty-dropdown-row">
            <label>HP (0-10):</label>
            <input type="text" id="diff-hp" value="${track.difficulty.HP}" />
        </div>
        <div style="border-top: 1px solid #333; margin-top: 8px; padding-top: 8px; display: flex; justify-content: center;">
            <button id="diff-delete-btn" style="background-color: #f44336; color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; width: 100%; text-align: center; font-weight: bold; transition: background-color 0.2s;">Delete Track</button>
        </div>
    `;

    document.body.appendChild(dropdown);

    dropdown.onclick = (e) => e.stopPropagation();

    const csInput = dropdown.querySelector('#diff-cs');
    const arInput = dropdown.querySelector('#diff-ar');
    const odInput = dropdown.querySelector('#diff-od');
    const hpInput = dropdown.querySelector('#diff-hp');
    const closeBtn = dropdown.querySelector('#diff-close-btn');
    const deleteBtn = dropdown.querySelector('#diff-delete-btn');

    let isClosed = false;

    const handleInput = (inputEl, key) => {
        if (isClosed) return;
        let val = inputEl.value;

        // Remove any characters that aren't digits, dot, or minus sign
        val = val.replace(/[^\\d.-]/g, '');

        // Ensure there is at most one decimal point
        let parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
            parts = val.split('.');
        }

        // "if for example 24 is input, it will automatically add a decimal point 2.4"
        if (!val.includes('.')) {
            const parsedVal = parseFloat(val);
            if (!isNaN(parsedVal) && parsedVal > 10) {
                if (val.length >= 2) {
                    const withDot = val[0] + '.' + val.substring(1);
                    const parsedWithDot = parseFloat(withDot);
                    if (parsedWithDot <= 10) {
                        val = withDot;
                    } else {
                        val = "10";
                    }
                    parts = val.split('.');
                }
            }
        }

        // "there can only be 1 number after the decimal point."
        if (parts.length === 2 && parts[1].length > 1) {
            val = parts[0] + '.' + parts[1].substring(0, 1);
        }

        // Let's update the input box value
        inputEl.value = val;

        // Now, let's parse the actual numeric value for the internal difficulty setting
        let numVal = 0;
        if (val === '' || val === '-') {
            numVal = 0;
        } else if (val.endsWith('.')) {
            // "in case user tries to add the decimal them selves, internally the system assumes a 0 after the decimal, until user inputs a number. The system should not automatically fill the 0 for the user to see while the user is still typing in the field."
            numVal = parseFloat(val + '0');
        } else {
            numVal = parseFloat(val);
        }

        if (isNaN(numVal)) {
            numVal = track.difficulty[key] || 0;
        }

        // Clamp between 0 and 10
        if (numVal > 10) numVal = 10;
        if (numVal < 0) numVal = 0;

        // Save to track and sharedState
        track.difficulty[key] = numVal;
        
        const activeTrackId = getHighlightedTrackId();
        if (track.id === activeTrackId) {
            sharedState.lastMasterDifficulty = { ...track.difficulty };
        }

        // Re-draw playfield/canvas in real-time
        drawCanvas();
    };

    csInput.oninput = () => handleInput(csInput, 'CS');
    arInput.oninput = () => handleInput(arInput, 'AR');
    odInput.oninput = () => handleInput(odInput, 'OD');
    hpInput.oninput = () => handleInput(hpInput, 'HP');

    const saveChangesAndClose = () => {
        if (isClosed) return;
        isClosed = true;

        const prevDiff = { ...track.difficulty };

        track.difficulty.CS = cleanValue(csInput.value, 10, prevDiff.CS);
        track.difficulty.AR = cleanValue(arInput.value, 10, prevDiff.AR);
        track.difficulty.OD = cleanValue(odInput.value, 10, prevDiff.OD);
        track.difficulty.HP = cleanValue(hpInput.value, 10, prevDiff.HP);

        const activeTrackId = getHighlightedTrackId();
        if (track.id === activeTrackId) {
            sharedState.lastMasterDifficulty = { ...track.difficulty };
        }

        dropdown.remove();
        renderTracks();
    };

    closeBtn.onclick = (e) => {
        e.stopPropagation();
        saveChangesAndClose();
    };

    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (isClosed) return;
        isClosed = true;

        const hasClips = track.sourceAsset && track.sourceAsset.hitObjects && track.sourceAsset.hitObjects.length > 0;

        const performDeletion = () => {
            sharedState.tracks = sharedState.tracks.filter(t => t.id !== track.id);
            renderTracks();
        };

        dropdown.remove();
        document.removeEventListener('click', outsideClickListener);

        if (!hasClips) {
            performDeletion();
        } else {
            showDeleteConfirmationModal(track, performDeletion);
        }
    };

    const outsideClickListener = (e) => {
        if (isClosed) return;
        if (!dropdown.contains(e.target) && e.target !== triggerEl) {
            document.removeEventListener('click', outsideClickListener);
            saveChangesAndClose();
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', outsideClickListener);
    }, 0);
}
