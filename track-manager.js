import { sharedState } from './shared-state.js';

export function renderTracks() {
    const container = document.getElementById('tracks-container');
    container.innerHTML = '';

    // Create Tracks Manager Element
    const tracksManager = document.createElement('div');
    tracksManager.className = 'tracks-manager';
    
    // Create Master Track Container
    const masterTracksContainer = document.createElement('div');
    masterTracksContainer.className = 'master-tracks-container';
    
    // Create Normal Track Container
    const normalTracksContainer = document.createElement('div');
    normalTracksContainer.className = 'normal-tracks-container';
    
    // Add Master Track Button
    const addBtn = document.createElement('div');
    addBtn.className = 'track-icon add-master-icon';
    addBtn.innerText = '+';
    addBtn.onclick = addMasterTrack;
    tracksManager.appendChild(addBtn);
    
    // Add Master Tracks to Master Tracks Container
    sharedState.tracks
        .filter(track => track.type === 'master')
        .forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = `track ${track.type}`;
            trackEl.id = track.id;

            const removeBtn = document.createElement('span');
            removeBtn.className = 'track-icon remove-master-icon';
            removeBtn.innerText = '-';
            removeBtn.onclick = () => removeMasterTrack(track.id);
            trackEl.appendChild(removeBtn);
            
            masterTracksContainer.appendChild(trackEl);
        });
    
    // Add Normal Tracks to Normal Tracks Container
    sharedState.tracks
        .filter(track => track.type === 'normal')
        .forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = `track ${track.type}`;
            trackEl.id = track.id;
            
            normalTracksContainer.appendChild(trackEl);
        });
    
    // Append containers to tracks manager
    tracksManager.appendChild(masterTracksContainer);
    tracksManager.appendChild(normalTracksContainer);
    
    // Append tracks manager to main container
    container.appendChild(tracksManager);
}

export function addNormalTrack(trackData) {
    sharedState.tracks.push({ id: `normal-${Date.now()}`, type: 'normal', ...trackData });
    renderTracks();
}

function addMasterTrack() {
    const newId = `master-${sharedState.tracks.length + 1}`;
    sharedState.tracks.push({ id: newId, type: 'master' });
    renderTracks();
}

function removeMasterTrack(id) {
    if (sharedState.tracks.length > 1) {
        sharedState.tracks = sharedState.tracks.filter(t => t.id !== id);
        renderTracks();
    }
}