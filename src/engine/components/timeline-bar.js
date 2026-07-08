import { sharedState } from '../../core/shared-state.js';
import { getBestTimeInterval, formatTimestamp, getTimingAndBeatLines } from '../track-utils.js';

export function createTimelineBar() {
    const timelineBar = document.createElement('div');
    timelineBar.className = 'track timeline-bar-track';
    
    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'track-header';
    
    const timelineIcon = document.createElement('span');
    timelineIcon.innerText = '⏱';
    timelineIcon.style.marginRight = '6px';
    timelineIcon.style.fontSize = '12px';
    timelineHeader.appendChild(timelineIcon);
    
    const timelineTitle = document.createElement('span');
    timelineTitle.innerText = 'TIMELINE';
    timelineHeader.appendChild(timelineTitle);
    
    timelineBar.appendChild(timelineHeader);
    
    const timelineLane = document.createElement('div');
    timelineLane.className = 'track-lane';
    
    const timelineContent = document.createElement('div');
    timelineContent.className = 'track-timeline-content';
    timelineContent.style.width = `${(sharedState.zoom || 1.0) * 100}%`;
    
    const totalDuration = sharedState.selectedMp3 ? sharedState.selectedMp3.duration : 180.0;
    const totalDurationMs = totalDuration * 1000;
    const zoom = sharedState.zoom || 1.0;

    const timingAsset = (sharedState.sourceAssets && sharedState.selectedTimingSourceAssetId) 
        ? sharedState.sourceAssets[sharedState.selectedTimingSourceAssetId] 
        : null;

    // Render timeline ticks strictly based on TIME (absolute seconds)
    const visibleDuration = totalDuration / zoom;
    const interval = getBestTimeInterval(visibleDuration);
    
    const minorInterval = interval / 5;
    const startTick = 0;
    const endTick = totalDuration;
    
    for (let time = startTick; time <= endTick; time += minorInterval) {
        const isMajor = Math.abs((time % interval) / interval) < 0.05 || Math.abs(((time % interval) / interval) - 1) < 0.05;
        const pct = (time / totalDuration) * 100;
        
        const tickEl = document.createElement('div');
        tickEl.style.position = 'absolute';
        tickEl.style.left = `${pct}%`;
        tickEl.style.top = isMajor ? '0' : '18px';
        tickEl.style.bottom = '0';
        tickEl.style.width = '1px';
        tickEl.style.borderLeft = isMajor ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)';
        tickEl.style.pointerEvents = 'none';
        
        if (isMajor) {
            const labelEl = document.createElement('div');
            labelEl.innerText = formatTimestamp(time);
            labelEl.style.position = 'absolute';
            labelEl.style.left = '4px';
            labelEl.style.top = '3px';
            labelEl.style.fontSize = '9px';
            labelEl.style.color = '#ff66aa';
            labelEl.style.fontWeight = '500';
            labelEl.style.fontFamily = `'JetBrains Mono', monospace, sans-serif`;
            labelEl.style.whiteSpace = 'nowrap';
            tickEl.appendChild(labelEl);
        }
        
        timelineContent.appendChild(tickEl);
    }

    // Draw red timing lines directly on the timeline track lane if timingAsset exists
    if (timingAsset) {
        const { redLines } = getTimingAndBeatLines(timingAsset, totalDurationMs);
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

            const labelEl = document.createElement('span');
            labelEl.className = 'timing-line-label';
            labelEl.innerText = rl.label;
            lineEl.appendChild(labelEl);

            timelineContent.appendChild(lineEl);
        });
    }
    
    timelineLane.appendChild(timelineContent);
    timelineBar.appendChild(timelineLane);
    
    return timelineBar;
}
