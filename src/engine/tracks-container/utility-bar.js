import { sharedState } from '../../core/shared-state.js';
import { getMp3DisplayName, sliceActiveTrack, pushSelectionToMaster } from '../track-utils/index.js';
import { renderTracks, addMasterTrack } from './track-manager.js';

export function createUtilityBar() {
    const utilityBar = document.createElement('div');
    utilityBar.className = 'tracks-controls-bar';

    // Add Master Track Button
    const addBtn = document.createElement('div');
    addBtn.className = 'track-icon add-master-icon';
    addBtn.innerText = '+';
    addBtn.onclick = () => {
        addMasterTrack();
    };
    utilityBar.appendChild(addBtn);

    // Add Scissor / Slice Button
    const scissorBtn = document.createElement('div');
    scissorBtn.className = 'track-icon scissor-icon';
    scissorBtn.innerText = '✂';
    scissorBtn.title = 'Slice Clip (Splits highlighted selection or slices at playhead position)';
    scissorBtn.onclick = () => {
        sliceActiveTrack();
        renderTracks();
        import('../../ui/canvas.js').then(m => m.drawCanvas());
    };
    utilityBar.appendChild(scissorBtn);

    // Add Push / Up Arrow Button
    const pushBtn = document.createElement('div');
    pushBtn.className = 'track-icon push-icon';
    pushBtn.innerText = '↑';
    pushBtn.title = 'Push Selection (Moves Highlighted objects to the last active Master as a new clip)';
    pushBtn.onclick = () => {
        pushSelectionToMaster();
        renderTracks();
        import('../../ui/canvas.js').then(m => m.drawCanvas());
    };
    utilityBar.appendChild(pushBtn);

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
                // Reset selectedTimingSourceAssetId so it auto-recalculates for the new file
                sharedState.selectedTimingSourceAssetId = null;
                // Trigger timeline update
                renderTracks();
            }
        };
    }
    mp3DropdownContainer.appendChild(select);
    utilityBar.appendChild(mp3DropdownContainer);

    // Create Timing Points Dropdown next to MP3 Dropdown
    const timingDropdownContainer = document.createElement('div');
    timingDropdownContainer.className = 'mp3-dropdown-container timing-dropdown-container';

    const timingLabel = document.createElement('span');
    timingLabel.className = 'mp3-dropdown-label timing-dropdown-label';
    timingLabel.innerText = 'Timing Source:';
    timingDropdownContainer.appendChild(timingLabel);

    const timingSelect = document.createElement('select');
    timingSelect.className = 'mp3-select timing-select';

    // Populate timing options based on matching .osu difficulties
    if (sharedState.selectedMp3 && sharedState.sourceAssets) {
        const fileLower = sharedState.selectedMp3.filename.toLowerCase();
        const packageContext = sharedState.selectedMp3.packageContext;
        const matchingAssets = Object.values(sharedState.sourceAssets).filter(asset => {
            const hasAudioMatch = asset.audioFilename && asset.audioFilename.toLowerCase() === fileLower;
            if (!hasAudioMatch) return false;
            
            if (packageContext) {
                return asset.packageContext === packageContext;
            } else {
                return !asset.packageContext;
            }
        });

        if (matchingAssets.length === 0) {
            const noTimingOpt = document.createElement('option');
            noTimingOpt.value = '';
            noTimingOpt.innerText = 'No matching .osu file';
            timingSelect.appendChild(noTimingOpt);
            timingSelect.disabled = true;
        } else {
            // Validate and default selection
            const hasValidSelection = matchingAssets.some(asset => asset.assetId === sharedState.selectedTimingSourceAssetId);
            if (!hasValidSelection) {
                sharedState.selectedTimingSourceAssetId = matchingAssets[0].assetId;
            }

            matchingAssets.forEach(asset => {
                const opt = document.createElement('option');
                opt.value = asset.assetId;
                opt.innerText = asset.difficultyName || 'Unknown Difficulty';
                if (asset.assetId === sharedState.selectedTimingSourceAssetId) {
                    opt.selected = true;
                }
                timingSelect.appendChild(opt);
            });

            timingSelect.onchange = (e) => {
                sharedState.selectedTimingSourceAssetId = e.target.value;
                console.log("[Timing] Selected timing source asset ID:", sharedState.selectedTimingSourceAssetId);
                renderTracks();
            };
        }
    } else {
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.innerText = 'No audio selected';
        timingSelect.appendChild(placeholderOpt);
        timingSelect.disabled = true;
    }

    timingDropdownContainer.appendChild(timingSelect);
    utilityBar.appendChild(timingDropdownContainer);

    // Create Beat Divider Dropdown
    const dividerDropdownContainer = document.createElement('div');
    dividerDropdownContainer.className = 'mp3-dropdown-container beat-divider-container';

    const dividerLabel = document.createElement('span');
    dividerLabel.className = 'mp3-dropdown-label beat-divider-label';
    dividerLabel.innerText = 'Beat Snap:';
    dividerDropdownContainer.appendChild(dividerLabel);

    const dividerSelect = document.createElement('select');
    dividerSelect.className = 'mp3-select beat-divider-select';
    
    const divisions = [
        { value: 1, text: '1/1' },
        { value: 2, text: '1/2' },
        { value: 3, text: '1/3' },
        { value: 4, text: '1/4' },
        { value: 6, text: '1/6' },
        { value: 8, text: '1/8' },
        { value: 12, text: '1/12' },
        { value: 16, text: '1/16' }
    ];

    if (sharedState.beatDivider === undefined) {
        sharedState.beatDivider = 4;
    }

    divisions.forEach(div => {
        const opt = document.createElement('option');
        opt.value = div.value;
        opt.innerText = div.text;
        if (sharedState.beatDivider === div.value) {
            opt.selected = true;
        }
        dividerSelect.appendChild(opt);
    });

    dividerSelect.onchange = (e) => {
        sharedState.beatDivider = parseInt(e.target.value, 10);
        console.log("[BeatSnap] Selected beat divider:", sharedState.beatDivider);
    };

    dividerDropdownContainer.appendChild(dividerSelect);
    utilityBar.appendChild(dividerDropdownContainer);

    return utilityBar;
}
