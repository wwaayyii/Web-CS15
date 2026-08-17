// WEB-CS15 Mobile Menu Fix V2
// Root cause fix: mobileControls.js sets touch-action:none on html/body,
// which blocks native scrolling in the start menu.

const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

if (isTouchDevice) {
    const style = document.createElement("style");
    style.id = "webcs-mobile-menu-fix-v2";

    style.textContent = `
        html.webcs-menu-touch,
        html.webcs-menu-touch body {
            touch-action: pan-y !important;
            overscroll-behavior: contain !important;
        }

        html.webcs-game-touch,
        html.webcs-game-touch body {
            touch-action: none !important;
            overscroll-behavior: none !important;
        }

        @media (orientation: landscape) {
            #start-overlay {
                position: fixed !important;
                inset: 0 !important;
                width: 100vw !important;
                height: 100dvh !important;
                max-height: 100dvh !important;
                overflow: hidden !important;
                padding: 0 !important;
            }

            .start-panel {
                box-sizing: border-box !important;
                width: min(98vw, 1050px) !important;
                height: calc(100dvh - 10px) !important;
                max-height: calc(100dvh - 10px) !important;
                margin: 5px auto !important;
                padding: 8px 10px !important;
                overflow: hidden !important;
            }

            .start-menu-layout {
                display: grid !important;
                grid-template-columns:
                    minmax(0, 1.6fr)
                    minmax(280px, .9fr) !important;
                gap: 10px !important;
                height: 100% !important;
                min-height: 0 !important;
                overflow: hidden !important;
            }

            .start-menu-left,
            .how-to-play-panel {
                box-sizing: border-box !important;
                min-width: 0 !important;
                min-height: 0 !important;
                height: 100% !important;
                max-height: 100% !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
                overscroll-behavior-y: contain !important;
                touch-action: pan-y !important;
                pointer-events: auto !important;
                padding-bottom: 42px !important;
            }

            .start-menu-left {
                padding-right: 8px !important;
            }

            .map-select-panel,
            .setup-panel {
                margin-top: 7px !important;
                margin-bottom: 7px !important;
                padding-top: 7px !important;
                padding-bottom: 7px !important;
            }

            #start-button {
                margin-bottom: 26px !important;
            }
        }
    `;

    document.head.appendChild(style);

    const updateTouchMode = () => {
        const game = window.webCS15;
        const overlay = document.getElementById("start-overlay");

        const overlayVisible =
            overlay &&
            getComputedStyle(overlay).display !== "none" &&
            getComputedStyle(overlay).visibility !== "hidden";

        const menuMode =
            !game?.gameplayStarted ||
            overlayVisible;

        document.documentElement.classList.toggle(
            "webcs-menu-touch",
            menuMode
        );

        document.documentElement.classList.toggle(
            "webcs-game-touch",
            !menuMode
        );
    };

    updateTouchMode();

    window.setInterval(
        updateTouchMode,
        200
    );
}
