import { sharedState } from '../core/shared-state.js';

const cache = new Map();
let lastZoom = null;

/**
 * Retrieves a cached clip DOM element if it exists and zoom hasn't changed.
 * @param {string} clipId
 * @returns {HTMLElement|null}
 */
export function getCachedClip(clipId) {
    const currentZoom = sharedState.zoom || 1.0;
    if (lastZoom !== currentZoom) {
        cache.clear();
        lastZoom = currentZoom;
        return null;
    }
    return cache.get(clipId) || null;
}

/**
 * Caches a clip DOM element.
 * @param {string} clipId
 * @param {HTMLElement} element
 */
export function setCachedClip(clipId, element) {
    const currentZoom = sharedState.zoom || 1.0;
    if (lastZoom !== currentZoom) {
        cache.clear();
        lastZoom = currentZoom;
    }
    cache.set(clipId, element);
}

/**
 * Force-clears the clip cache.
 */
export function clearClipCache() {
    cache.clear();
}
