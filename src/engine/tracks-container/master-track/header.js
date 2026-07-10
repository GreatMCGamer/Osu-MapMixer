import { sharedState } from '../../../core/shared-state.js';
import { toggleDifficultyDropdown } from '../track-ui.js';
import { renderTracks } from '../track-manager.js';

export function createMasterHeader(track, index, selectTrack, isHighlighted) {
    // Header Section
    const headerEl = document.createElement('div');
    headerEl.className = 'track-header';
    headerEl.style.cursor = 'pointer';
    headerEl.onclick = () => {
        selectTrack();
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
        setTimeout(() => {
            const newTrackEl = document.getElementById(track.id);
            if (newTrackEl) {
                const newOptionsBtn = newTrackEl.querySelector('.options-master-icon');
                if (newOptionsBtn) {
                    toggleDifficultyDropdown(track, newOptionsBtn);
                }
            }
        }, 0);
    };
    headerEl.appendChild(optionsBtn);

    const titleSpan = document.createElement('span');
    titleSpan.innerText = track.name || 'Master';
    titleSpan.style.fontFamily = "'Space Grotesk', system-ui, sans-serif";
    titleSpan.style.letterSpacing = "0.5px";
    titleSpan.title = "Double click to rename";
    
    // Double click to rename
    titleSpan.ondblclick = (e) => {
        e.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = track.name || 'Master';
        input.style.fontFamily = "'Space Grotesk', system-ui, sans-serif";
        input.style.fontSize = '11px';
        input.style.fontWeight = '600';
        input.style.color = '#fff';
        input.style.background = '#222';
        input.style.border = '1px solid #ff66aa';
        input.style.borderRadius = '3px';
        input.style.padding = '1px 4px';
        input.style.width = '100px';
        input.style.outline = 'none';
        
        input.onclick = (e) => e.stopPropagation();
        input.ondblclick = (e) => e.stopPropagation();
        
        let isSaved = false;
        const saveName = () => {
            if (isSaved) return;
            isSaved = true;
            const val = input.value.trim();
            track.name = val || 'Master';
            track.difficultyName = val || 'Master';
            renderTracks();
        };
        
        input.onblur = saveName;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveName();
            } else if (e.key === 'Escape') {
                isSaved = true; // prevent double trigger
                renderTracks();
            }
        };
        
        headerEl.replaceChild(input, titleSpan);
        input.focus();
        input.select();
    };
    
    headerEl.appendChild(titleSpan);

    const numberBadge = document.createElement('span');
    numberBadge.className = 'info-bubble';
    numberBadge.innerText = `${index}`;
    numberBadge.style.marginLeft = '8px';
    numberBadge.style.backgroundColor = 'rgba(255, 102, 170, 0.15)';
    numberBadge.style.color = '#ff66aa';
    numberBadge.style.borderColor = 'rgba(255, 102, 170, 0.3)';
    headerEl.appendChild(numberBadge);

    // Highlight star icon
    const starSpan = document.createElement('span');
    starSpan.className = 'track-highlight-star';
    starSpan.innerText = isHighlighted ? '★' : '☆';
    starSpan.style.marginLeft = 'auto';
    starSpan.style.fontSize = '12px';
    starSpan.style.color = isHighlighted ? '#ff66aa' : '#555';
    headerEl.appendChild(starSpan);

    return headerEl;
}
