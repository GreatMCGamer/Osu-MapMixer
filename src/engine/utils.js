/**
 * Shared UI Utilities
 * Contains functions that are used across multiple modules to avoid circular imports
 */

/**
 * Displays the global spinner block along with customized progression notifications
 * @param {string} message 
 */
export function showLoader(message) {
    const loaderOverlay = document.getElementById('loaderOverlay');
    const loaderText = document.getElementById('loaderText');
    if (loaderOverlay && loaderText) {
        loaderText.textContent = message;
        loaderOverlay.style.display = 'flex';
    }
}

/**
 * Hides the global progress block
 */
export function hideLoader() {
    const loaderOverlay = document.getElementById('loaderOverlay');
    if (loaderOverlay) {
        loaderOverlay.style.display = 'none';
    }
}

/**
 * Spawns localized temporary sliding notification alerts for success, warnings, or errors
 * @param {string} message 
 * @param {string} type 
 */
export function showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto delete toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease-out reverse forwards";
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}