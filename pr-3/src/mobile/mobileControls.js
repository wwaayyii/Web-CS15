import { ui } from "../ui/ui.js";

// ============================================================
// WEB-CS15 Mobile Controls V3.3
//
// Mobile input now reuses the desktop game input path:
// - Joystick -> game.keys (W/A/S/D)
// - FIRE -> Player fire API
// - Touch look -> camera quaternion
//
// Also includes:
// - structuredClone fallback
// - Mobile landscape menu
// - Main-menu HUD hiding
// - Fullscreen attempt
// - Jump / Reload / Crouch / Weapon / Grenade / Scope
// ============================================================


// ============================================================
// Compatibility
// ============================================================

if (
    typeof globalThis.structuredClone !==
    "function"
) {
    const cloneFallback = value => {
        if (
            value === null ||
            typeof value !== "object"
        ) {
            return value;
        }

        if (
            Array.isArray(value)
        ) {
            return value.map(cloneFallback);
        }

        if (
            value instanceof Date
        ) {
            return new Date(value.getTime());
        }

        const copy = {};

        for (
            const [key, item]
            of Object.entries(value)
        ) {
            copy[key] =
                cloneFallback(item);
        }

        return copy;
    };

    globalThis.structuredClone =
        cloneFallback;
}


// ============================================================
// Global main-menu HUD handling
// Works on desktop + mobile because this file loads before game.js.
// ============================================================

const GAMEPLAY_HUD_SELECTORS = [
    ".top-hud",
    ".bottom-left-hud",
    ".bottom-right-hud",
    "#fps-counter",
    "#nav-debug-toggle",
    "#freeze-hud",
    "#spectate-hud",
    "#kill-feed",
    "#radio-message",
    "#radio-history",
    "#radio-menu",
    "#tab-scoreboard",
    "#hud-status",
    "#crosshair",
    "#hitmarker",
    "#damage-indicator",
    "#grenade-indicator",
    "#weapon-pickup-hint",
    "#sniper-scope"
];


function setGlobalGameplayHUDVisible(
    visible
) {
    for (
        const selector
        of GAMEPLAY_HUD_SELECTORS
    ) {
        const elements =
            document.querySelectorAll(
                selector
            );

        for (
            const element
            of elements
        ) {
            element.style.visibility =
                visible
                    ? ""
                    : "hidden";

            element.style.pointerEvents =
                visible
                    ? ""
                    : "none";
        }
    }
}


function isStartMenuVisible() {
    const overlay =
        document.getElementById(
            "start-overlay"
        );

    if (!overlay) {
        return false;
    }

    const style =
        getComputedStyle(
            overlay
        );

    return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) !== 0
    );
}


function syncGlobalHUD() {
    const game =
        window.webCS15;

    const menuOpen =
        !game?.gameplayStarted ||
        isStartMenuVisible();

    setGlobalGameplayHUDVisible(
        !menuOpen
    );
}


// ============================================================
// Mobile detection
// ============================================================

const isMobileDevice = () =>
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window ||
    window.matchMedia?.(
        "(pointer: coarse)"
    )?.matches;


if (isMobileDevice()) {

    const state = {
        game: null,
        enabled: false,

        joystickTouchId: null,
        lookTouchId: null,

        crouching: false,
        weaponIndex: 0,

        joystickForward: 0,
        joystickRight: 0,

        lookStartX: 0,
        lookStartY: 0,
        lookMoved: false,

        lastTapTime: 0,
        lastTapX: 0,
        lastTapY: 0,

        lookFireHeld: false,
        grenadeFireHeld: false,

        spectator: false,
        lastFrameTime: performance.now()
    };


    // ========================================================
    // CSS
    // ========================================================

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "webcs-mobile-controls-v3";

    style.textContent = `
        html,
        body {
            overscroll-behavior: none;
        }

        body.webcs-mobile {
            touch-action: manipulation;
        }

        body.webcs-mobile #start-overlay {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            overflow: hidden !important;
        }

        body.webcs-mobile .start-panel {
            box-sizing: border-box !important;
            width: min(98vw, 1050px) !important;
            height: calc(100dvh - 8px) !important;
            max-height: calc(100dvh - 8px) !important;
            margin: 4px auto !important;
            padding: 8px 10px !important;
            overflow: hidden !important;
        }

        body.webcs-mobile .start-menu-layout {
            display: grid !important;
            grid-template-columns:
                minmax(0, 1.6fr)
                minmax(260px, .9fr)
                !important;
            gap: 10px !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
        }

        body.webcs-mobile .start-menu-left,
        body.webcs-mobile .how-to-play-panel {
            min-height: 0 !important;
            height: 100% !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            touch-action: pan-y !important;
            overscroll-behavior-y: contain !important;
            padding-bottom: 38px !important;
        }


        /* =============================================
           Mobile BUY menu sizing
        ============================================== */

        body.webcs-mobile #buy-menu {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            right: auto !important;
            bottom: auto !important;
            box-sizing: border-box !important;
            width: min(720px, 92vw) !important;
            max-width: 92vw !important;
            max-height: 88dvh !important;
            overflow: hidden !important;
            transform: translate(-50%, -50%) !important;
            transform-origin: center center !important;
        }

        body.webcs-mobile #buy-menu-list {
            box-sizing: border-box !important;
            max-height: calc(88dvh - 54px) !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            touch-action: pan-y !important;
        }

        body.webcs-mobile #buy-menu button {
            min-height: 36px !important;
            padding: 6px 9px !important;
            font-size: 12px !important;
        }

        body.webcs-mobile #buy-menu-close {
            position: relative !important;
            z-index: 4 !important;
            flex: 0 0 auto !important;
            pointer-events: auto !important;
            touch-action: manipulation !important;
        }

        #mobile-controls {
            position: fixed;
            inset: 0;
            z-index: 15000;
            display: none;
            pointer-events: none;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
        }

        #mobile-controls.active {
            display: block;
        }

        #mobile-look-zone {
            position: absolute;
            top: 0;
            right: 0;
            width: 62%;
            height: 100%;
            z-index: 10;
            pointer-events: auto;
            touch-action: none;
            background: transparent;
        }

        #mobile-joystick {
            position: absolute;
            left: max(30px, env(safe-area-inset-left));
            bottom: max(30px, env(safe-area-inset-bottom));
            width: 142px;
            height: 142px;
            z-index: 40;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,.32);
            background: rgba(14,24,34,.28);
            box-shadow: inset 0 0 24px rgba(0,0,0,.32);
            pointer-events: auto;
            touch-action: none;
        }

        #mobile-stick {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 64px;
            height: 64px;
            margin-left: -32px;
            margin-top: -32px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,.75);
            background: rgba(66,183,239,.48);
            transform: translate(0, 0);
            pointer-events: none;
        }

        #mobile-actions {
            position: absolute;
            right: max(14px, env(safe-area-inset-right));
            bottom: max(14px, env(safe-area-inset-bottom));
            width: 300px;
            height: 205px;
            z-index: 50;
            pointer-events: none;
        }

        .mobile-btn {
            position: absolute;
            z-index: 60;
            min-width: 72px;
            height: 58px;
            border: 2px solid rgba(255,255,255,.35);
            border-radius: 12px;
            background: rgba(20,31,42,.74);
            color: white;
            font: 700 13px Arial, sans-serif;
            pointer-events: auto;
            touch-action: none;
            -webkit-tap-highlight-color: transparent;
        }

        .mobile-btn.active {
            background: rgba(39,130,178,.94);
            border-color: #78dbff;
        }

        #mobile-fire {
            right: 0;
            bottom: 38px;
            width: 100px;
            height: 100px;
            border-radius: 50%;
        }

        #mobile-scope {
            right: 0;
            bottom: 142px;
        }

        #mobile-reload {
            right: 0;
            bottom: 76px;
        }

        #mobile-jump {
            right: 0;
            bottom: 10px;
        }

        #mobile-grenade {
            right: 82px;
            bottom: 142px;
        }

        #mobile-weapon {
            right: 82px;
            bottom: 76px;
        }

        #mobile-crouch {
            right: 82px;
            bottom: 10px;
        }

        #mobile-buy {
            right: 164px;
            bottom: 76px;
        }

        #mobile-controls.spectator #mobile-actions {
            display: none !important;
        }

        #mobile-fullscreen {
            position: absolute;
            top: max(10px, env(safe-area-inset-top));
            right: max(10px, env(safe-area-inset-right));
            z-index: 80;
            width: 68px;
            height: 48px;
            border-radius: 10px;
            border: 2px solid rgba(255,255,255,.35);
            background: rgba(20,31,42,.72);
            color: #fff;
            font: 700 13px Arial, sans-serif;
            pointer-events: auto;
            touch-action: none;
        }

        #mobile-rotate-overlay {
            position: fixed;
            inset: 0;
            z-index: 30000;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 14px;
            background: #071018;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        }

        #mobile-rotate-overlay strong {
            font-size: 20px;
            letter-spacing: 2px;
        }

        #mobile-rotate-overlay span {
            color: #91a4af;
            font-size: 12px;
        }

        @media (orientation: portrait) {
            #mobile-rotate-overlay {
                display: flex;
            }
        }

        @media (orientation: landscape) and (max-height: 520px) {
            #mobile-joystick {
                width: 126px;
                height: 126px;
            }

            #mobile-stick {
                width: 58px;
                height: 58px;
                margin-left: -29px;
                margin-top: -29px;
            }

            #mobile-actions {
                transform: scale(.90);
                transform-origin: right bottom;
            }

        }
    `;

    document.head.appendChild(
        style
    );


    // ========================================================
    // DOM
    // ========================================================

    document.body.classList.add(
        "webcs-mobile"
    );


    const rotateOverlay =
        document.createElement(
            "div"
        );

    rotateOverlay.id =
        "mobile-rotate-overlay";

    rotateOverlay.innerHTML = `
        <div style="font-size:56px">↻</div>
        <strong>ROTATE YOUR DEVICE</strong>
        <span>LANDSCAPE MODE REQUIRED</span>
    `;

    document.body.appendChild(
        rotateOverlay
    );


    const root =
        document.createElement(
            "div"
        );

    root.id =
        "mobile-controls";

    root.innerHTML = `
        <div id="mobile-look-zone"></div>

        <div id="mobile-joystick">
            <div id="mobile-stick"></div>
        </div>

        <div id="mobile-actions">
            <button class="mobile-btn" id="mobile-scope">SCOPE</button>
            <button class="mobile-btn" id="mobile-reload">RELOAD</button>
            <button class="mobile-btn" id="mobile-jump">JUMP</button>
            <button class="mobile-btn" id="mobile-grenade">GRENADE</button>
            <button class="mobile-btn" id="mobile-weapon">WEAPON</button>
            <button class="mobile-btn" id="mobile-crouch">CROUCH</button>
            <button class="mobile-btn" id="mobile-buy">BUY</button>
        </div>

        <button id="mobile-fullscreen">FULL</button>
    `;

    document.body.appendChild(
        root
    );


    // ========================================================
    // Helpers
    // ========================================================

    const getGame =
        () =>
            state.game ||
            window.webCS15;


    const findTouch =
        (
            touchList,
            identifier
        ) => {
            for (
                const touch
                of touchList
            ) {
                if (
                    touch.identifier ===
                    identifier
                ) {
                    return touch;
                }
            }

            return null;
        };


    const clearMovementKeys =
        () => {
            const game =
                getGame();

            if (!game?.keys) {
                return;
            }

            game.keys.delete("KeyW");
            game.keys.delete("KeyS");
            game.keys.delete("KeyA");
            game.keys.delete("KeyD");
        };


    const setMovementKeys =
        ({
            forward = false,
            backward = false,
            left = false,
            right = false
        } = {}) => {
            const game =
                getGame();

            if (!game?.keys) {
                return;
            }

            const apply =
                (
                    code,
                    active
                ) => {
                    if (active) {
                        game.keys.add(code);
                    } else {
                        game.keys.delete(code);
                    }
                };

            apply("KeyW", forward);
            apply("KeyS", backward);
            apply("KeyA", left);
            apply("KeyD", right);
        };


    const stopAllTouchActions =
        () => {
            clearMovementKeys();

            state.joystickForward =
                0;

            state.joystickRight =
                0;

            getGame()
                ?.player
                ?.stopFire?.();

            state.lookFireHeld =
                false;

            state.grenadeFireHeld =
                false;
        };


    // ========================================================
    // Fullscreen
    // ========================================================

    const requestFullscreen =
        async () => {
            try {
                if (
                    !document.fullscreenElement &&
                    document.documentElement
                        .requestFullscreen
                ) {
                    await document
                        .documentElement
                        .requestFullscreen({
                            navigationUI:
                                "hide"
                        });
                }
            } catch (_) {
            }

            try {
                await screen
                    .orientation
                    ?.lock?.(
                        "landscape"
                    );
            } catch (_) {
            }
        };


    const isAnyUIMenuOpen =
        () => {
            if (
                typeof ui?.anyMenuOpen ===
                "function"
            ) {
                try {
                    return Boolean(
                        ui.anyMenuOpen()
                    );
                } catch (_) {
                    return false;
                }
            }

            return Boolean(
                ui?.anyMenuOpen
            );
        };


    // ========================================================
    // Joystick -> existing game.keys
    // ========================================================

    const joystick =
        document.getElementById(
            "mobile-joystick"
        );

    const stick =
        document.getElementById(
            "mobile-stick"
        );


    const updateJoystick =
        touch => {
            if (!touch) {
                return;
            }

            const rect =
                joystick
                    .getBoundingClientRect();

            const centerX =
                rect.left +
                rect.width / 2;

            const centerY =
                rect.top +
                rect.height / 2;

            const maxRadius =
                rect.width * 0.34;

            let dx =
                touch.clientX -
                centerX;

            let dy =
                touch.clientY -
                centerY;

            const distance =
                Math.hypot(
                    dx,
                    dy
                );

            if (
                distance >
                maxRadius
            ) {
                dx =
                    dx /
                    distance *
                    maxRadius;

                dy =
                    dy /
                    distance *
                    maxRadius;
            }

            stick.style.transform =
                `translate(${dx}px, ${dy}px)`;

            const x =
                dx /
                maxRadius;

            const y =
                dy /
                maxRadius;

            const deadZone =
                0.24;

            state.joystickForward =
                y < -deadZone
                    ? 1
                    : y > deadZone
                        ? -1
                        : 0;

            state.joystickRight =
                x > deadZone
                    ? 1
                    : x < -deadZone
                        ? -1
                        : 0;

            const game =
                getGame();

            if (
                game?.player?.isAlive
            ) {
                setMovementKeys({
                    forward:
                        state.joystickForward > 0,

                    backward:
                        state.joystickForward < 0,

                    left:
                        state.joystickRight < 0,

                    right:
                        state.joystickRight > 0
                });
            } else {
                clearMovementKeys();
            }
        };


    const resetJoystick =
        () => {
            state.joystickTouchId =
                null;

            state.joystickForward =
                0;

            state.joystickRight =
                0;

            stick.style.transform =
                "translate(0, 0)";

            clearMovementKeys();
        };


    joystick.addEventListener(
        "touchstart",
        event => {
            event.preventDefault();
            event.stopPropagation();

            if (
                !state.controlsVisible ||
                state.joystickTouchId !==
                    null
            ) {
                return;
            }

            const touch =
                event.changedTouches[0];

            if (!touch) {
                return;
            }

            state.joystickTouchId =
                touch.identifier;

            updateJoystick(
                touch
            );
        },
        {
            passive:
                false
        }
    );


    joystick.addEventListener(
        "touchmove",
        event => {
            event.preventDefault();
            event.stopPropagation();

            const touch =
                findTouch(
                    event.touches,
                    state.joystickTouchId
                );

            if (!touch) {
                return;
            }

            updateJoystick(
                touch
            );
        },
        {
            passive:
                false
        }
    );


    const endJoystick =
        event => {
            event.preventDefault();
            event.stopPropagation();

            const touch =
                findTouch(
                    event.changedTouches,
                    state.joystickTouchId
                );

            if (touch) {
                resetJoystick();
            }
        };


    joystick.addEventListener(
        "touchend",
        endJoystick,
        {
            passive:
                false
        }
    );

    joystick.addEventListener(
        "touchcancel",
        endJoystick,
        {
            passive:
                false
        }
    );


    // ========================================================
    // Touch Look + Double Tap Fire
    //
    // Drag = look
    // First tap = arm double tap
    // Second quick tap + hold = fire
    // While holding second tap, drag still aims
    // Release = stop fire
    // ========================================================

    const lookZone =
        document.getElementById(
            "mobile-look-zone"
        );

    let lastLookX =
        0;

    let lastLookY =
        0;


    const beginLookFire =
        () => {
            const game =
                getGame();

            const player =
                game?.player;

            if (
                !player?.isAlive
            ) {
                return false;
            }

            if (
                player.grenadeMode
            ) {
                if (
                    player
                        .beginGrenadePrime?.()
                ) {
                    game
                        ?.weaponView
                        ?.beginGrenadePrime?.();

                    state.grenadeFireHeld =
                        true;

                    state.lookFireHeld =
                        true;

                    return true;
                }

                return false;
            }

            player.startFire?.();

            state.lookFireHeld =
                true;

            return true;
        };


    const endLookFire =
        () => {
            const game =
                getGame();

            const player =
                game?.player;

            if (
                state.grenadeFireHeld &&
                player?.grenadeMode
            ) {
                if (
                    player
                        .releaseGrenadePrime?.()
                ) {
                    game
                        ?.weaponView
                        ?.releaseGrenadeThrow?.();
                }
            } else {
                player
                    ?.stopFire?.();
            }

            state.lookFireHeld =
                false;

            state.grenadeFireHeld =
                false;
        };


    lookZone.addEventListener(
        "touchstart",
        event => {
            event.preventDefault();
            event.stopPropagation();

            if (
                !state.controlsVisible ||
                state.lookTouchId !==
                    null
            ) {
                return;
            }

            const touch =
                event.changedTouches[0];

            if (!touch) {
                return;
            }

            state.lookTouchId =
                touch.identifier;

            state.lookStartX =
                touch.clientX;

            state.lookStartY =
                touch.clientY;

            lastLookX =
                touch.clientX;

            lastLookY =
                touch.clientY;

            state.lookMoved =
                false;

            const now =
                performance.now();

            const timeSinceTap =
                now -
                state.lastTapTime;

            const tapDistance =
                Math.hypot(
                    touch.clientX -
                        state.lastTapX,

                    touch.clientY -
                        state.lastTapY
                );

            const isDoubleTap =
                !state.spectator &&
                timeSinceTap > 0 &&
                timeSinceTap <= 330 &&
                tapDistance <= 72;

            if (
                isDoubleTap
            ) {
                beginLookFire();

                state.lastTapTime =
                    0;
            }
        },
        {
            passive:
                false
        }
    );


    lookZone.addEventListener(
        "touchmove",
        event => {
            event.preventDefault();
            event.stopPropagation();

            const touch =
                findTouch(
                    event.touches,
                    state.lookTouchId
                );

            if (!touch) {
                return;
            }

            const game =
                getGame();

            const camera =
                game?.camera;

            if (!camera) {
                return;
            }

            const dx =
                touch.clientX -
                lastLookX;

            const dy =
                touch.clientY -
                lastLookY;

            const totalMovement =
                Math.hypot(
                    touch.clientX -
                        state.lookStartX,

                    touch.clientY -
                        state.lookStartY
                );

            if (
                totalMovement > 6
            ) {
                state.lookMoved =
                    true;
            }

            lastLookX =
                touch.clientX;

            lastLookY =
                touch.clientY;

            const sensitivity =
                0.0030;

            camera.rotation.order =
                "YXZ";

            camera.rotation.y -=
                dx *
                sensitivity;

            camera.rotation.x -=
                dy *
                sensitivity;

            const limit =
                Math.PI / 2 -
                0.06;

            camera.rotation.x =
                Math.max(
                    -limit,
                    Math.min(
                        limit,
                        camera.rotation.x
                    )
                );
        },
        {
            passive:
                false
        }
    );


    const endLook =
        event => {
            event.preventDefault();
            event.stopPropagation();

            const touch =
                findTouch(
                    event.changedTouches,
                    state.lookTouchId
                );

            if (!touch) {
                return;
            }

            if (
                state.lookFireHeld
            ) {
                endLookFire();

            } else if (
                !state.lookMoved &&
                !state.spectator
            ) {
                state.lastTapTime =
                    performance.now();

                state.lastTapX =
                    touch.clientX;

                state.lastTapY =
                    touch.clientY;
            }

            state.lookTouchId =
                null;

            state.lookMoved =
                false;
        };


    lookZone.addEventListener(
        "touchend",
        endLook,
        {
            passive:
                false
        }
    );


    lookZone.addEventListener(
        "touchcancel",
        event => {
            event.preventDefault();
            event.stopPropagation();

            if (
                state.lookFireHeld
            ) {
                endLookFire();
            }

            state.lookTouchId =
                null;

            state.lookMoved =
                false;
        },
        {
            passive:
                false
        }
    );


    // ========================================================
    // Block synthetic mouse events from mobile controls
    // ========================================================

    root.addEventListener(
        "mousedown",
        event => {
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );

    root.addEventListener(
        "mouseup",
        event => {
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );

    root.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();
        },
        true
    );


    // ========================================================
    // Button helper
    // ========================================================

    const bindTouchButton =
        (
            id,
            onStart,
            onEnd = null
        ) => {
            const button =
                document.getElementById(
                    id
                );

            if (!button) {
                return;
            }

            button.addEventListener(
                "touchstart",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    if (
                        !state.controlsVisible ||
                        state.spectator
                    ) {
                        return;
                    }

                    button.classList.add(
                        "active"
                    );

                    onStart?.();
                },
                {
                    passive:
                        false
                }
            );

            const end =
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    button.classList.remove(
                        "active"
                    );

                    onEnd?.();
                };

            button.addEventListener(
                "touchend",
                end,
                {
                    passive:
                        false
                }
            );

            button.addEventListener(
                "touchcancel",
                end,
                {
                    passive:
                        false
                }
            );
        };


    // ========================================================
    // Jump
    // ========================================================

    bindTouchButton(
        "mobile-jump",

        () => {
            getGame()
                ?.player
                ?.jump?.();
        }
    );


    // ========================================================
    // Reload
    // ========================================================

    bindTouchButton(
        "mobile-reload",

        () => {
            const game =
                getGame();

            game
                ?.exitSniperScope?.({
                    restoreWeaponView:
                        true
                });

            game
                ?.player
                ?.reload?.();
        }
    );


    // ========================================================
    // Crouch toggle
    // ========================================================

    bindTouchButton(
        "mobile-crouch",

        () => {
            const player =
                getGame()
                    ?.player;

            if (!player) {
                return;
            }

            state.crouching =
                !state.crouching;

            player
                .setCrouching?.(
                    state.crouching
                );
        }
    );


    // ========================================================
    // Weapon
    // ========================================================

    bindTouchButton(
        "mobile-weapon",

        () => {
            const game =
                getGame();

            const player =
                game?.player;

            if (!player) {
                return;
            }

            game
                ?.exitSniperScope?.({
                    restoreWeaponView:
                        true
                });

            state.weaponIndex =
                (
                    state.weaponIndex +
                    1
                ) %
                3;

            if (
                state.weaponIndex ===
                0
            ) {
                player
                    .equipPrimary?.();
            } else if (
                state.weaponIndex ===
                1
            ) {
                player
                    .equipSecondary?.();
            } else {
                player
                    .equipKnife?.();
            }
        }
    );


    // ========================================================
    // Grenade
    // ========================================================

    bindTouchButton(
        "mobile-grenade",

        () => {
            const game =
                getGame();

            game
                ?.exitSniperScope?.({
                    restoreWeaponView:
                        false
                });

            if (
                !game
                    ?.weaponView
                    ?.isGrenadeBusy?.()
            ) {
                game
                    ?.player
                    ?.cycleGrenadeSlot?.();
            }
        }
    );


    // ========================================================
    // Scope
    // ========================================================

    bindTouchButton(
        "mobile-scope",

        () => {
            getGame()
                ?.toggleSniperScope?.();
        }
    );


    // ========================================================
    // Buy
    // ========================================================

    bindTouchButton(
        "mobile-buy",

        () => {
            const game =
                getGame();

            if (
                !game
                    ?.player
                    ?.isAlive
            ) {
                return;
            }

            ui
                ?.toggleBuyMenu
                ?.();
        }
    );


    // ========================================================
    // Fullscreen
    // ========================================================

    const fullscreenButton =
        document.getElementById(
            "mobile-fullscreen"
        );

    fullscreenButton
        ?.addEventListener(
            "touchstart",
            event => {
                event.preventDefault();
                event.stopPropagation();

                requestFullscreen();
            },
            {
                passive:
                    false
            }
        );


    // ========================================================
    // Start button
    // ========================================================

    const startButton =
        document.getElementById(
            "start-button"
        );

    startButton
        ?.addEventListener(
            "touchend",
            () => {
                requestFullscreen();
            },
            {
                passive:
                    true
            }
        );


    // ========================================================
    // Game lifecycle
    // ========================================================

    const waitForGame =
        () =>
            new Promise(
                resolve => {
                    const tick =
                        () => {
                            if (
                                window
                                    .webCS15
                                    ?.player &&
                                window
                                    .webCS15
                                    ?.camera
                            ) {
                                resolve(
                                    window
                                        .webCS15
                                );

                                return;
                            }

                            requestAnimationFrame(
                                tick
                            );
                        };

                    tick();
                }
            );


    waitForGame()
        .then(
            game => {
                state.game =
                    game;

                console.log(
                    "[WEB-CS15] Mobile Controls V3.3 ready"
                );
            }
        );


    // ========================================================
    // Continuous mode synchronization + mobile spectator move
    // ========================================================

    const updateSpectatorMovement =
        delta => {
            const game =
                getGame();

            if (
                !state.spectator ||
                !state.controlsVisible ||
                !game ||
                game.player?.isAlive
            ) {
                return;
            }

            const controls =
                game.controls;

            if (!controls) {
                return;
            }

            const speed =
                Number(
                    game.spectatorSpeed
                ) ||
                12;

            if (
                typeof controls.moveForward ===
                "function"
            ) {
                controls.moveForward(
                    state.joystickForward *
                    speed *
                    delta
                );
            }

            if (
                typeof controls.moveRight ===
                "function"
            ) {
                controls.moveRight(
                    state.joystickRight *
                    speed *
                    delta
                );
            }
        };


    const syncMode =
        now => {
            const game =
                getGame();

            const delta =
                Math.min(
                    (
                        now -
                        state.lastFrameTime
                    ) /
                    1000,

                    0.05
                );

            state.lastFrameTime =
                now;

            const menuOpen =
                !game
                    ?.gameplayStarted ||
                isStartMenuVisible();

            syncGlobalHUD();

            const uiMenuOpen =
                isAnyUIMenuOpen();

            const controlsVisible =
                Boolean(
                    game
                        ?.gameplayStarted &&
                    !game
                        ?.paused &&
                    !menuOpen &&
                    !uiMenuOpen
                );

            const spectator =
                Boolean(
                    game
                        ?.gameplayStarted &&
                    game
                        ?.player &&
                    !game
                        ?.player
                        ?.isAlive
                );

            state.controlsVisible =
                controlsVisible;

            state.spectator =
                spectator;

            root.classList.toggle(
                "active",
                controlsVisible
            );

            root.classList.toggle(
                "spectator",
                spectator
            );

            if (
                !controlsVisible
            ) {
                clearMovementKeys();
                state.joystickForward = 0;
                state.joystickRight = 0;
            }

            if (
                spectator
            ) {
                getGame()
                    ?.player
                    ?.stopFire?.();
            }

            updateSpectatorMovement(
                delta
            );

            requestAnimationFrame(
                syncMode
            );
        };

    requestAnimationFrame(
        syncMode
    );


    window.addEventListener(
        "pagehide",
        stopAllTouchActions
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.hidden
            ) {
                stopAllTouchActions();
            }
        }
    );
}


// ============================================================
// Desktop/mobile global HUD sync
// ============================================================

const globalHudLoop =
    () => {
        syncGlobalHUD();

        requestAnimationFrame(
            globalHudLoop
        );
    };

requestAnimationFrame(
    globalHudLoop
);
