// WEB-CS15 Mobile HUD/Menu Fix V1
// Hides gameplay HUD elements while the start menu is visible on mobile.

const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

if (isTouchDevice) {
    const style = document.createElement("style");
    style.id = "webcs-mobile-hud-menu-fix";
    style.textContent = `
        html.webcs-mobile-menu-open .top-hud,
        html.webcs-mobile-menu-open .bottom-left-hud,
        html.webcs-mobile-menu-open .bottom-right-hud,
        html.webcs-mobile-menu-open .hud-status,
        html.webcs-mobile-menu-open .freeze-hud,
        html.webcs-mobile-menu-open .spectate-hud,
        html.webcs-mobile-menu-open .kill-feed,
        html.webcs-mobile-menu-open .radio-message,
        html.webcs-mobile-menu-open .radio-history,
        html.webcs-mobile-menu-open .scoreboard-overlay,
        html.webcs-mobile-menu-open #fps-counter,
        html.webcs-mobile-menu-open #nav-debug-toggle,
        html.webcs-mobile-menu-open #crosshair,
        html.webcs-mobile-menu-open #hitmarker,
        html.webcs-mobile-menu-open #damage-indicator {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    const syncMenuState = () => {
        const overlay = document.getElementById("start-overlay");
        const overlayVisible =
            Boolean(overlay) &&
            getComputedStyle(overlay).display !== "none" &&
            getComputedStyle(overlay).visibility !== "hidden" &&
            Number(getComputedStyle(overlay).opacity || 1) !== 0;

        const game = window.webCS15;
        const menuOpen =
            !game?.gameplayStarted ||
            overlayVisible;

        document.documentElement.classList.toggle(
            "webcs-mobile-menu-open",
            menuOpen
        );
    };

    syncMenuState();

    const observer = new MutationObserver(syncMenuState);
    const overlay = document.getElementById("start-overlay");
    if (overlay) {
        observer.observe(overlay, {
            attributes: true,
            attributeFilter: ["style", "class", "hidden"]
        });
    }

    window.setInterval(syncMenuState, 250);
}
