// WEB-CS15 Mobile Menu Fix V3
// Uses manual pointer-drag scrolling for the left menu column.

const isTouchDevice =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

if (isTouchDevice) {
    const style = document.createElement("style");
    style.id = "webcs-mobile-menu-fix-v3";
    style.textContent = `
        @media (orientation: landscape) {
            html,
            body {
                width: 100%;
                height: 100%;
                overflow: hidden !important;
            }

            #start-overlay {
                position: fixed !important;
                inset: 0 !important;
                width: 100vw !important;
                height: 100dvh !important;
                overflow: hidden !important;
                padding: 0 !important;
            }

            .start-panel {
                box-sizing: border-box !important;
                width: min(98vw, 1050px) !important;
                height: calc(100dvh - 8px) !important;
                max-height: calc(100dvh - 8px) !important;
                margin: 4px auto !important;
                padding: 8px 10px !important;
                overflow: hidden !important;
            }

            .start-menu-layout {
                display: grid !important;
                grid-template-columns: minmax(0, 1.6fr) minmax(280px, .9fr) !important;
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
                padding-bottom: 44px !important;
            }

            .start-menu-left {
                touch-action: none !important;
                cursor: grab;
            }

            .start-menu-left.webcs-dragging {
                cursor: grabbing;
            }

            .map-select-panel,
            .setup-panel {
                margin-top: 7px !important;
                margin-bottom: 7px !important;
                padding-top: 7px !important;
                padding-bottom: 7px !important;
            }

            #start-button {
                margin-bottom: 28px !important;
            }
        }
    `;
    document.head.appendChild(style);

    const bindForcedScroll = () => {
        const panel = document.querySelector(".start-menu-left");
        if (!panel || panel.dataset.webcsForcedScroll === "1") return;

        panel.dataset.webcsForcedScroll = "1";

        let pointerId = null;
        let lastY = 0;
        let startY = 0;
        let dragging = false;

        panel.addEventListener("pointerdown", event => {
            if (event.pointerType === "mouse") return;

            pointerId = event.pointerId;
            lastY = event.clientY;
            startY = event.clientY;
            dragging = false;

            panel.setPointerCapture?.(pointerId);
        }, { passive: false });

        panel.addEventListener("pointermove", event => {
            if (event.pointerId !== pointerId) return;

            const dy = event.clientY - lastY;
            const total = Math.abs(event.clientY - startY);

            if (total > 5) {
                dragging = true;
                panel.classList.add("webcs-dragging");
                event.preventDefault();
                panel.scrollTop -= dy;
            }

            lastY = event.clientY;
        }, { passive: false });

        const endDrag = event => {
            if (event.pointerId !== pointerId) return;

            if (dragging) {
                event.preventDefault();
            }

            pointerId = null;
            dragging = false;
            panel.classList.remove("webcs-dragging");
        };

        panel.addEventListener("pointerup", endDrag, { passive: false });
        panel.addEventListener("pointercancel", endDrag, { passive: false });

        panel.addEventListener("wheel", event => {
            panel.scrollTop += event.deltaY;
        }, { passive: true });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindForcedScroll, { once: true });
    } else {
        bindForcedScroll();
    }
}
