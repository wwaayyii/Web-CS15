// WEB-CS15 Mobile Menu Fix V1
const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

if (isTouchDevice) {
    const style = document.createElement("style");
    style.id = "webcs-mobile-menu-fix-v1";
    style.textContent = `
        @media (orientation: landscape) and (pointer: coarse),
               (orientation: landscape) and (hover: none) {

            html, body {
                width: 100%;
                height: 100%;
                overflow: hidden !important;
            }

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
                height: calc(100dvh - 12px) !important;
                max-height: calc(100dvh - 12px) !important;
                margin: 6px auto !important;
                padding: 10px 12px !important;
                overflow: hidden !important;
            }

            .start-menu-layout {
                display: grid !important;
                grid-template-columns: minmax(0, 1.6fr) minmax(280px, .9fr) !important;
                gap: 12px !important;
                height: 100% !important;
                max-height: 100% !important;
                min-height: 0 !important;
                align-items: stretch !important;
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
                overscroll-behavior: contain !important;
                -webkit-overflow-scrolling: touch !important;
                touch-action: pan-y !important;
                padding-bottom: 28px !important;
            }

            .start-menu-left {
                padding-left: 2px !important;
                padding-right: 8px !important;
            }

            .map-select-panel,
            .setup-panel {
                margin-top: 8px !important;
                margin-bottom: 8px !important;
                padding-top: 8px !important;
                padding-bottom: 8px !important;
            }

            .game-logo {
                margin-top: 0 !important;
                line-height: 1 !important;
            }

            .game-subtitle {
                margin-top: 4px !important;
                margin-bottom: 6px !important;
            }

            #start-button {
                margin-bottom: 18px !important;
            }

            .start-menu-left::-webkit-scrollbar,
            .how-to-play-panel::-webkit-scrollbar {
                width: 5px;
            }

            .start-menu-left::-webkit-scrollbar-thumb,
            .how-to-play-panel::-webkit-scrollbar-thumb {
                background: rgba(62, 198, 255, .45);
                border-radius: 5px;
            }
        }

        @media (orientation: landscape) and (max-height: 480px) {
            .start-panel {
                height: calc(100dvh - 6px) !important;
                max-height: calc(100dvh - 6px) !important;
                margin: 3px auto !important;
                padding: 6px 8px !important;
            }

            .start-menu-layout {
                gap: 8px !important;
            }

            .map-select-panel,
            .setup-panel {
                margin-top: 5px !important;
                margin-bottom: 5px !important;
                padding: 6px 8px !important;
            }
        }
    `;
    document.head.appendChild(style);
}
