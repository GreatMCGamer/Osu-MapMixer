import { sharedState, getHighlightedTrackId, getActiveDifficulty } from '../core/shared-state.js';
import { drawPlayhead } from './timeline.js';
import { drawCanvas } from '../ui/canvas.js';

/**
 * Calculates start and end times in milliseconds for a hit object, resolving slider/spinner durations
 */
export function getNoteTimes(note, track) {
    const startTime = note.originalTimeMs || 0;
    let endTime = startTime;
    if (note.type === 'slider' && note.sliderData && note.sliderData.durationBeats) {
        let activeMsPerBeat = 500;
        if (track && track.sourceAsset && track.sourceAsset.timingPoints) {
            for (const tp of track.sourceAsset.timingPoints) {
                if (tp.uninherited && tp.beat <= note.beat) {
                    activeMsPerBeat = tp.msPerBeat;
                }
            }
        }
        endTime = startTime + note.sliderData.durationBeats * activeMsPerBeat;
    } else if (note.type === 'spinner' && note.spinnerData && note.spinnerData.durationBeats) {
        let activeMsPerBeat = 500;
        if (track && track.sourceAsset && track.sourceAsset.timingPoints) {
            for (const tp of track.sourceAsset.timingPoints) {
                if (tp.uninherited && tp.beat <= note.beat) {
                    activeMsPerBeat = tp.msPerBeat;
                }
            }
        }
        endTime = startTime + note.spinnerData.durationBeats * activeMsPerBeat;
    }
    return { startTime, endTime };
}

/**
 * Returns a user-friendly display name for a loaded MP3 file based on available .osu metadata
 * @param {Object} file 
 * @returns {string} Display name
 */
export function getMp3DisplayName(file) {
    if (!sharedState.sourceAssets) return file.filename;
    
    const fileLower = file.filename.toLowerCase();
    
    // 1. Try to find a sourceAsset with exact matching AudioFilename AND matching packageContext
    let match = Object.values(sharedState.sourceAssets).find(asset => {
        return asset.audioFilename && 
               asset.audioFilename.toLowerCase() === fileLower && 
               asset.packageContext === file.packageContext;
    });

    // 2. Try to find any sourceAsset with matching AudioFilename (without packageContext matching)
    if (!match) {
        match = Object.values(sharedState.sourceAssets).find(asset => {
            return asset.audioFilename && asset.audioFilename.toLowerCase() === fileLower;
        });
    }

    // 3. Fallback: if no match, use the first available source asset
    if (!match) {
        const assets = Object.values(sharedState.sourceAssets);
        if (assets.length > 0) {
            match = assets[0];
        }
    }

    if (match && match.title && match.artist) {
        const titleStr = match.title !== "Unknown Title" ? match.title : "";
        const artistStr = match.artist !== "Unknown Artist" ? match.artist : "";
        if (titleStr || artistStr) {
            const label = artistStr && titleStr ? `${artistStr} - ${titleStr}` : (titleStr || artistStr);
            return `${label} (${file.filename})`;
        }
    }
    
    return file.filename;
}

/**
 * Calculates the maximum beat count among all parsed hit objects to determine the timeline scale.
 */
export function getMaxBeats() {
    let max = 100; // Baseline fallback
    if (sharedState.sourceAssets) {
        Object.values(sharedState.sourceAssets).forEach(asset => {
            if (asset.hitObjects && asset.hitObjects.length > 0) {
                asset.hitObjects.forEach(obj => {
                    let endBeat = obj.beat;
                    if (obj.type === 'spinner' && obj.spinnerData) {
                        endBeat = obj.spinnerData.endBeat;
                    } else if (obj.type === 'slider' && obj.sliderData) {
                        endBeat = obj.sliderData.endBeat || (obj.beat + 4);
                    }
                    if (endBeat > max) {
                        max = endBeat;
                    }
                });
            }
        });
    }
    return max + 10; // 10 beats of breathing space at the end
}

export function renderTracks() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    container.innerHTML = '';

    const maxBeats = getMaxBeats();

    // Create Tracks Manager Element
    const tracksManager = document.createElement('div');
    tracksManager.className = 'tracks-manager';
    
    // Create Controls Bar (on the same line as the + sign)
    const controlsBar = document.createElement('div');
    controlsBar.className = 'tracks-controls-bar';

    // Add Master Track Button
    const addBtn = document.createElement('div');
    addBtn.className = 'track-icon add-master-icon';
    addBtn.innerText = '+';
    addBtn.onclick = addMasterTrack;
    controlsBar.appendChild(addBtn);

    // Dropdown for selecting main MP3 file
    const mp3DropdownContainer = document.createElement('div');
    mp3DropdownContainer.className = 'mp3-dropdown-container';

    const dropdownLabel = document.createElement('span');
    dropdownLabel.className = 'mp3-dropdown-label';
    dropdownLabel.innerText = 'Main Audio:';
    mp3DropdownContainer.appendChild(dropdownLabel);

    const select = document.createElement('select');
    select.className = 'mp3-select';
    
    // Fallback if no MP3 loaded
    if (!sharedState.mp3Files || sharedState.mp3Files.length === 0) {
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.innerText = 'No audio loaded';
        select.appendChild(placeholderOpt);
        select.disabled = true;
    } else {
        // Automatically select first MP3 if none is selected yet
        if (!sharedState.selectedMp3) {
            sharedState.selectedMp3 = sharedState.mp3Files[0];
            const durationMs = sharedState.selectedMp3.duration * 1000;
            sharedState.playbackSpeed = 1 / durationMs;
        }

        sharedState.mp3Files.forEach(file => {
            const opt = document.createElement('option');
            const fileId = file.id || file.filename;
            opt.value = fileId;
            opt.innerText = getMp3DisplayName(file);
            const selectedId = sharedState.selectedMp3 ? (sharedState.selectedMp3.id || sharedState.selectedMp3.filename) : null;
            if (selectedId === fileId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            const fileId = e.target.value;
            const found = sharedState.mp3Files.find(f => (f.id || f.filename) === fileId);
            if (found) {
                sharedState.selectedMp3 = found;
                const durationMs = found.duration * 1000;
                sharedState.playbackSpeed = 1 / durationMs;
                console.log("[Audio] Selected main audio ID:", fileId, "Duration:", found.duration);
                // Trigger timeline update
                renderTracks();
            }
        };
    }
    mp3DropdownContainer.appendChild(select);
    controlsBar.appendChild(mp3DropdownContainer);
    tracksManager.appendChild(controlsBar);
    
    // Create Master Track Container
    const masterTracksContainer = document.createElement('div');
    masterTracksContainer.className = 'master-tracks-container';
    
    // Create Normal Track Container
    const normalTracksContainer = document.createElement('div');
    normalTracksContainer.className = 'normal-tracks-container';
    
    // Add Master Tracks to Master Tracks Container
    const highlightedId = getHighlightedTrackId();

    sharedState.tracks
        .filter(track => track.type === 'master')
        .forEach(track => {
            const isHighlighted = (track.id === highlightedId);
            const trackEl = document.createElement('div');
            trackEl.className = `track ${track.type}${isHighlighted ? ' highlighted' : ''}`;
            trackEl.id = track.id;

            // Header Section
            const headerEl = document.createElement('div');
            headerEl.className = 'track-header';
            headerEl.style.cursor = 'pointer';
            headerEl.onclick = () => {
                sharedState.highlightedTrackId = track.id;
                // Silently inherit difficulty settings from the selected master track
                if (!track.difficulty) {
                    track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
                }
                sharedState.lastMasterDifficulty = { ...track.difficulty };
                renderTracks();
            };

            // Three dot options box for difficulty settings
            const optionsBtn = document.createElement('span');
            optionsBtn.className = 'track-icon options-master-icon';
            optionsBtn.innerText = '•••';
            optionsBtn.style.marginRight = '8px';
            optionsBtn.style.padding = '1px 4px';
            optionsBtn.style.borderRadius = '3px';
            optionsBtn.style.backgroundColor = '#1a1a1a';
            optionsBtn.style.color = '#ff66aa';
            optionsBtn.style.fontSize = '9px';
            optionsBtn.style.cursor = 'pointer';
            optionsBtn.style.border = '1px solid #ff66aa';
            optionsBtn.style.display = 'inline-flex';
            optionsBtn.style.alignItems = 'center';
            optionsBtn.style.justifyContent = 'center';
            optionsBtn.style.verticalAlign = 'middle';
            optionsBtn.onclick = (e) => {
                e.stopPropagation();
                sharedState.highlightedTrackId = track.id;
                if (!track.difficulty) {
                    track.difficulty = { CS: 4.5, AR: 9, OD: 8, HP: 4 };
                }
                sharedState.lastMasterDifficulty = { ...track.difficulty };
                renderTracks();
                
                // Open the difficulty settings dropdown at the newly rendered optionsBtn
                const newTrackEl = document.getElementById(track.id);
                if (newTrackEl) {
                    const newOptionsBtn = newTrackEl.querySelector('.options-master-icon');
                    if (newOptionsBtn) {
                        toggleDifficultyDropdown(track, newOptionsBtn);
                    }
                }
            };
            headerEl.appendChild(optionsBtn);

            const titleSpan = document.createElement('span');
            titleSpan.innerText = track.id.toUpperCase();
            headerEl.appendChild(titleSpan);

            // Highlight star icon
            const starSpan = document.createElement('span');
            starSpan.className = 'track-highlight-star';
            starSpan.innerText = isHighlighted ? '★' : '☆';
            starSpan.style.marginLeft = 'auto';
            starSpan.style.fontSize = '12px';
            starSpan.style.color = isHighlighted ? '#ff66aa' : '#555';
            headerEl.appendChild(starSpan);

            trackEl.appendChild(headerEl);

            // Timeline Lane Section
            const laneEl = document.createElement('div');
            laneEl.className = 'track-lane';

            // Add inner scrollable content wrapper
            const contentEl = document.createElement('div');
            contentEl.className = 'track-timeline-content';
            contentEl.style.width = `${(sharedState.zoom || 1.0) * 100}%`;
            laneEl.appendChild(contentEl);

            trackEl.appendChild(laneEl);
            
            masterTracksContainer.appendChild(trackEl);
        });
    
    // Add Normal Tracks to Normal Tracks Container
    sharedState.tracks
        .filter(track => track.type === 'normal')
        .forEach(track => {
            const isHighlighted = (track.id === highlightedId);
            const trackEl = document.createElement('div');
            trackEl.className = `track ${track.type}${isHighlighted ? ' highlighted' : ''}`;
            trackEl.id = track.id;

            // Header Section
            const headerEl = document.createElement('div');
            headerEl.className = 'track-header';
            headerEl.style.cursor = 'pointer';
            headerEl.onclick = () => {
                sharedState.highlightedTrackId = track.id;
                renderTracks();
            };

            const titleSpan = document.createElement('span');
            titleSpan.innerText = track.name || "Normal Track";
            headerEl.appendChild(titleSpan);

            // Highlight star icon
            const starSpan = document.createElement('span');
            starSpan.className = 'track-highlight-star';
            starSpan.innerText = isHighlighted ? '★' : '☆';
            starSpan.style.marginLeft = 'auto';
            starSpan.style.fontSize = '12px';
            starSpan.style.color = isHighlighted ? '#ff66aa' : '#555';
            headerEl.appendChild(starSpan);

            trackEl.appendChild(headerEl);

            // Timeline Lane Section
            const laneEl = document.createElement('div');
            laneEl.className = 'track-lane';

            // Add inner scrollable content wrapper
            const contentEl = document.createElement('div');
            contentEl.className = 'track-timeline-content';
            contentEl.style.width = `${(sharedState.zoom || 1.0) * 100}%`;

            // Render Clips and static hit objects if we have sourceAsset
            const asset = track.sourceAsset;
            if (asset && asset.hitObjects && asset.hitObjects.length > 0) {
                const minTimeMs = asset.hitObjects[0].originalTimeMs || 0;
                let maxTimeMs = minTimeMs;
                
                asset.hitObjects.forEach(obj => {
                    const times = getNoteTimes(obj, track);
                    if (times.endTime > maxTimeMs) {
                        maxTimeMs = times.endTime;
                    }
                });

                const totalDurationMs = sharedState.selectedMp3 ? sharedState.selectedMp3.duration * 1000 : 180000;
                const trackRangeMs = maxTimeMs - minTimeMs || 1000;
                const leftPct = (minTimeMs / totalDurationMs) * 100;
                const widthPct = (trackRangeMs / totalDurationMs) * 100;

                // Create full difficulty clip
                const clipEl = document.createElement('div');
                clipEl.className = 'timeline-clip';
                clipEl.style.left = `${leftPct}%`;
                clipEl.style.width = `${widthPct}%`;

                // Add individual note dots/indicators inside the clip
                asset.hitObjects.forEach(note => {
                    const times = getNoteTimes(note, track);
                    const noteLeftPct = ((times.startTime - minTimeMs) / trackRangeMs) * 100;
                    const noteEl = document.createElement('div');
                    noteEl.className = `timeline-note ${note.type}`;
                    noteEl.style.left = `${noteLeftPct}%`;

                    if (times.endTime > times.startTime) {
                        const noteWidthPct = ((times.endTime - times.startTime) / trackRangeMs) * 100;
                        noteEl.style.width = `${noteWidthPct}%`;
                    }

                    clipEl.appendChild(noteEl);
                });

                contentEl.appendChild(clipEl);
            }
            laneEl.appendChild(contentEl);
            trackEl.appendChild(laneEl);
            
            normalTracksContainer.appendChild(trackEl);
        });
    
    // Append containers to tracks manager
    tracksManager.appendChild(masterTracksContainer);
    tracksManager.appendChild(normalTracksContainer);
    
    // Append tracks manager to main container
    container.appendChild(tracksManager);

    // Actively render playhead in correct positions across all lanes
    drawPlayhead();
    drawCanvas();
}

export function addNormalTrack(trackData) {
    sharedState.tracks.push({ id: `normal-${Date.now()}`, type: 'normal', ...trackData });
    renderTracks();
}

function addMasterTrack() {
    const newId = `master-${sharedState.tracks.length + 1}`;
    sharedState.tracks.push({ 
        id: newId, 
        type: 'master',
        difficulty: { CS: 4.5, AR: 9, OD: 8, HP: 4 }
    });
    renderTracks();
}

function showDeleteConfirmationModal(track, onDelete) {
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

const cleanValue = (inputStr, maxVal, prevVal) => {
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

function toggleDifficultyDropdown(track, triggerEl) {
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
        val = val.replace(/[^\d.-]/g, '');

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