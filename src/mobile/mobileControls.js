// ============================================================
// WEB-CS15 Mobile Controls V2.1 - Integrated Compatibility
//
// Global fixes in this file also work on desktop:
// - structuredClone fallback for older Android browsers
// - Hide gameplay HUD while the Main Menu is visible
//
// Mobile-only code below keeps the existing V2 touch controls.
// ============================================================

// ============================================================
// structuredClone Compatibility
// ============================================================

if (
    typeof globalThis.structuredClone !==
    "function"
) {

    const cloneFallback =
        value => {

            if (
                value === null ||
                typeof value !==
                    "object"
            ) {
                return value;
            }


            if (
                Array.isArray(
                    value
                )
            ) {

                return value.map(
                    cloneFallback
                );
            }


            if (
                value instanceof Date
            ) {

                return new Date(
                    value.getTime()
                );
            }


            const copy = {};


            for (
                const [
                    key,
                    item
                ]
                of Object.entries(
                    value
                )
            ) {

                copy[key] =
                    cloneFallback(
                        item
                    );
            }


            return copy;
        };


    globalThis.structuredClone =
        cloneFallback;
}


// ============================================================
// Main Menu HUD Visibility - Desktop + Mobile
// ============================================================

const installMainMenuHUDFix =
    () => {

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "webcs-main-menu-hud-fix";


        style.textContent = `
            html.webcs-main-menu-open #hud-hp,
            html.webcs-main-menu-open #hud-armor,
            html.webcs-main-menu-open #hud-money,

            html.webcs-main-menu-open #hud-ammo-clip,
            html.webcs-main-menu-open #hud-ammo-reserve,
            html.webcs-main-menu-open #hud-weapon-name,

            html.webcs-main-menu-open #round-timer,
            html.webcs-main-menu-open #round-number,

            html.webcs-main-menu-open #team-a-score,
            html.webcs-main-menu-open #team-b-score,

            html.webcs-main-menu-open #freeze-hud,
            html.webcs-main-menu-open #spectate-hud,

            html.webcs-main-menu-open #kill-feed,
            html.webcs-main-menu-open #tab-scoreboard,

            html.webcs-main-menu-open #radio-message,
            html.webcs-main-menu-open #radio-history,
            html.webcs-main-menu-open #radio-menu,

            html.webcs-main-menu-open #hud-status,

            html.webcs-main-menu-open #crosshair,
            html.webcs-main-menu-open #hitmarker,
            html.webcs-main-menu-open #damage-indicator,

            html.webcs-main-menu-open #grenade-indicator,
            html.webcs-main-menu-open #weapon-pickup-hint,
            html.webcs-main-menu-open #sniper-scope,

            html.webcs-main-menu-open #fps-counter,
            html.webcs-main-menu-open #nav-debug-toggle,

            html.webcs-main-menu-open .top-hud,
            html.webcs-main-menu-open .bottom-left-hud,
            html.webcs-main-menu-open .bottom-right-hud {
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;


        document.head.appendChild(
            style
        );


        const sync =
            () => {

                const overlay =
                    document.getElementById(
                        "start-overlay"
                    );


                let menuOpen =
                    true;


                if (
                    overlay
                ) {

                    const overlayStyle =
                        getComputedStyle(
                            overlay
                        );


                    menuOpen =
                        overlayStyle.display !==
                            "none" &&
                        overlayStyle.visibility !==
                            "hidden" &&
                        Number(
                            overlayStyle.opacity ||
                            1
                        ) !==
                            0;
                }


                document.documentElement
                    .classList
                    .toggle(
                        "webcs-main-menu-open",
                        menuOpen
                    );
            };


        const bind =
            () => {

                const overlay =
                    document.getElementById(
                        "start-overlay"
                    );


                sync();


                if (
                    overlay
                ) {

                    const observer =
                        new MutationObserver(
                            sync
                        );


                    observer.observe(
                        overlay,
                        {
                            attributes:
                                true,

                            attributeFilter: [
                                "style",
                                "class",
                                "hidden"
                            ]
                        }
                    );
                }
            };


        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                bind,
                {
                    once:
                        true
                }
            );

        } else {

            bind();
        }
    };


installMainMenuHUDFix();


// ============================================================
// WEB-CS15 Mobile Controls V2
//
// Consolidated mobile support:
// - Mobile detection
// - Landscape rotate prompt
// - Mobile start-menu layout
// - Left/right menu scrolling
// - Hide gameplay HUD while start menu is open
// - Fullscreen / landscape lock (best effort)
// - Virtual joystick movement
// - Touch look
// - FIRE / JUMP / RELOAD / CROUCH
// - WEAPON / GRENADE / SCOPE
//
// Desktop input/gameplay logic is not modified.
// ============================================================

const MOBILE_QUERY = "(pointer: coarse), (hover: none)";

const isMobileDevice = () =>
    window.matchMedia?.(MOBILE_QUERY)?.matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

if (isMobileDevice()) {

    const state = {
        game: null,
        enabled: false,

        joystickPointer: null,
        lookPointer: null,

        lookX: 0,
        lookY: 0,

        weaponCycle: 0,

        menuOpen: true
    };


    // ========================================================
    // Helpers
    // ========================================================

    const clamp = (
        value,
        min,
        max
    ) =>
        Math.max(
            min,
            Math.min(
                max,
                value
            )
        );


    const waitForGame =
        () =>
            new Promise(
                resolve => {

                    const check =
                        () => {

                            if (
                                window.webCS15?.player &&
                                window.webCS15?.camera
                            ) {

                                resolve(
                                    window.webCS15
                                );

                                return;
                            }


                            requestAnimationFrame(
                                check
                            );
                        };


                    check();
                }
            );


    // ========================================================
    // CSS
    // ========================================================

    const injectCSS =
        () => {

            const style =
                document.createElement(
                    "style"
                );


            style.id =
                "webcs-mobile-style-v2";


            style.textContent = `

                /* =============================================
                   Base Mobile
                ============================================== */

                html.webcs-mobile-menu,
                html.webcs-mobile-menu body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    overflow: hidden;
                    overscroll-behavior: contain;
                    touch-action: pan-y;
                    background: #000;
                }


                html.webcs-mobile-game,
                html.webcs-mobile-game body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    overflow: hidden;
                    overscroll-behavior: none;
                    touch-action: none;
                    background: #000;
                }


                /* =============================================
                   Start Menu
                ============================================== */

                body.webcs-mobile #start-overlay {
                    position: fixed !important;

                    inset: 0 !important;

                    width: 100vw !important;
                    height: 100dvh !important;

                    max-width: none !important;
                    max-height: none !important;

                    padding: 0 !important;
                    margin: 0 !important;

                    overflow: hidden !important;
                }


                body.webcs-mobile .start-panel {
                    box-sizing: border-box !important;

                    width: min(
                        98vw,
                        1050px
                    ) !important;

                    height: calc(
                        100dvh - 10px
                    ) !important;

                    max-height: calc(
                        100dvh - 10px
                    ) !important;

                    margin:
                        5px auto !important;

                    padding:
                        8px 10px !important;

                    overflow:
                        hidden !important;
                }


                body.webcs-mobile .start-menu-layout {
                    display: grid !important;

                    grid-template-columns:
                        minmax(0, 1.6fr)
                        minmax(260px, .9fr)
                        !important;

                    gap:
                        10px !important;

                    width:
                        100% !important;

                    height:
                        100% !important;

                    min-height:
                        0 !important;

                    max-height:
                        100% !important;

                    align-items:
                        stretch !important;

                    overflow:
                        hidden !important;
                }


                body.webcs-mobile .start-menu-left,
                body.webcs-mobile .how-to-play-panel {
                    box-sizing:
                        border-box !important;

                    min-width:
                        0 !important;

                    min-height:
                        0 !important;

                    height:
                        100% !important;

                    max-height:
                        100% !important;

                    overflow-x:
                        hidden !important;

                    overflow-y:
                        auto !important;

                    overscroll-behavior-y:
                        contain !important;

                    -webkit-overflow-scrolling:
                        touch !important;

                    touch-action:
                        pan-y !important;

                    padding-bottom:
                        38px !important;
                }


                body.webcs-mobile .start-menu-left {
                    padding-right:
                        8px !important;
                }


                body.webcs-mobile .map-select-panel,
                body.webcs-mobile .setup-panel {
                    margin-top:
                        7px !important;

                    margin-bottom:
                        7px !important;

                    padding-top:
                        7px !important;

                    padding-bottom:
                        7px !important;
                }


                body.webcs-mobile .game-logo {
                    margin-top:
                        0 !important;

                    line-height:
                        1 !important;
                }


                body.webcs-mobile .game-subtitle {
                    margin-top:
                        4px !important;

                    margin-bottom:
                        6px !important;
                }


                body.webcs-mobile #start-button {
                    margin-bottom:
                        28px !important;
                }


                body.webcs-mobile .start-menu-left::-webkit-scrollbar,
                body.webcs-mobile .how-to-play-panel::-webkit-scrollbar {
                    width:
                        5px;
                }


                body.webcs-mobile .start-menu-left::-webkit-scrollbar-thumb,
                body.webcs-mobile .how-to-play-panel::-webkit-scrollbar-thumb {
                    background:
                        rgba(
                            62,
                            198,
                            255,
                            .45
                        );

                    border-radius:
                        5px;
                }


                /* =============================================
                   Hide gameplay HUD while Main Menu is visible
                ============================================== */

                html.webcs-mobile-menu .top-hud,

                html.webcs-mobile-menu .bottom-left-hud,

                html.webcs-mobile-menu .bottom-right-hud,

                html.webcs-mobile-menu .hud-status,

                html.webcs-mobile-menu .freeze-hud,

                html.webcs-mobile-menu .spectate-hud,

                html.webcs-mobile-menu .kill-feed,

                html.webcs-mobile-menu .radio-message,

                html.webcs-mobile-menu .radio-history,

                html.webcs-mobile-menu .scoreboard-overlay,

                html.webcs-mobile-menu #fps-counter,

                html.webcs-mobile-menu #nav-debug-toggle,

                html.webcs-mobile-menu #crosshair,

                html.webcs-mobile-menu #hitmarker,

                html.webcs-mobile-menu #damage-indicator {
                    display:
                        none !important;
                }


                /* =============================================
                   Mobile Controls
                ============================================== */

                #mobile-controls {
                    position:
                        fixed;

                    inset:
                        0;

                    z-index:
                        9700;

                    pointer-events:
                        none;

                    user-select:
                        none;

                    -webkit-user-select:
                        none;

                    touch-action:
                        none;

                    display:
                        none;
                }


                #mobile-controls.active {
                    display:
                        block;
                }


                #mobile-look-zone {
                    position:
                        absolute;

                    top:
                        0;

                    right:
                        0;

                    width:
                        58%;

                    height:
                        100%;

                    pointer-events:
                        auto;

                    touch-action:
                        none;
                }


                .mobile-joystick {
                    position:
                        absolute;

                    left:
                        max(
                            22px,
                            env(
                                safe-area-inset-left
                            )
                        );

                    bottom:
                        max(
                            24px,
                            env(
                                safe-area-inset-bottom
                            )
                        );

                    width:
                        142px;

                    height:
                        142px;

                    border-radius:
                        50%;

                    border:
                        2px solid
                        rgba(
                            255,
                            255,
                            255,
                            .28
                        );

                    background:
                        rgba(
                            10,
                            18,
                            25,
                            .32
                        );

                    box-shadow:
                        inset
                        0
                        0
                        24px
                        rgba(
                            0,
                            0,
                            0,
                            .35
                        );

                    pointer-events:
                        auto;

                    touch-action:
                        none;
                }


                .mobile-stick {
                    position:
                        absolute;

                    left:
                        50%;

                    top:
                        50%;

                    width:
                        62px;

                    height:
                        62px;

                    margin:
                        -31px;

                    border-radius:
                        50%;

                    border:
                        2px solid
                        rgba(
                            255,
                            255,
                            255,
                            .65
                        );

                    background:
                        rgba(
                            62,
                            198,
                            255,
                            .38
                        );

                    box-shadow:
                        0
                        0
                        18px
                        rgba(
                            62,
                            198,
                            255,
                            .28
                        );

                    transform:
                        translate(
                            0,
                            0
                        );
                }


                .mobile-actions {
                    position:
                        absolute;

                    right:
                        max(
                            18px,
                            env(
                                safe-area-inset-right
                            )
                        );

                    bottom:
                        max(
                            18px,
                            env(
                                safe-area-inset-bottom
                            )
                        );

                    width:
                        238px;

                    height:
                        190px;

                    pointer-events:
                        none;
                }


                .mobile-btn {
                    position:
                        absolute;

                    min-width:
                        60px;

                    height:
                        52px;

                    padding:
                        0 10px;

                    border-radius:
                        10px;

                    border:
                        1px solid
                        rgba(
                            255,
                            255,
                            255,
                            .42
                        );

                    background:
                        rgba(
                            10,
                            18,
                            25,
                            .62
                        );

                    color:
                        #fff;

                    font:
                        700 11px
                        Arial,
                        Helvetica,
                        sans-serif;

                    letter-spacing:
                        .5px;

                    box-shadow:
                        0
                        3px
                        14px
                        rgba(
                            0,
                            0,
                            0,
                            .28
                        );

                    pointer-events:
                        auto;

                    touch-action:
                        none;
                }


                .mobile-btn:active,
                .mobile-btn.active {
                    background:
                        rgba(
                            38,
                            119,
                            162,
                            .86
                        );

                    border-color:
                        #66d4ff;
                }


                #mobile-fire {
                    right:
                        0;

                    bottom:
                        46px;

                    width:
                        86px;

                    height:
                        86px;

                    border-radius:
                        50%;

                    font-size:
                        13px;
                }


                #mobile-jump {
                    right:
                        92px;

                    bottom:
                        0;
                }


                #mobile-reload {
                    right:
                        96px;

                    bottom:
                        58px;
                }


                #mobile-crouch {
                    right:
                        166px;

                    bottom:
                        0;
                }


                #mobile-weapon {
                    right:
                        166px;

                    bottom:
                        58px;
                }


                #mobile-grenade {
                    right:
                        96px;

                    bottom:
                        116px;
                }


                #mobile-scope {
                    right:
                        0;

                    bottom:
                        140px;
                }


                #mobile-fullscreen {
                    position:
                        absolute;

                    top:
                        max(
                            12px,
                            env(
                                safe-area-inset-top
                            )
                        );

                    right:
                        max(
                            12px,
                            env(
                                safe-area-inset-right
                            )
                        );

                    width:
                        48px;

                    height:
                        34px;

                    min-width:
                        48px;

                    opacity:
                        .76;
                }


                /* =============================================
                   Rotate Overlay
                ============================================== */

                #mobile-rotate-overlay {
                    position:
                        fixed;

                    inset:
                        0;

                    z-index:
                        20000;

                    display:
                        none;

                    align-items:
                        center;

                    justify-content:
                        center;

                    flex-direction:
                        column;

                    gap:
                        14px;

                    padding:
                        28px;

                    background:
                        #071018;

                    color:
                        white;

                    text-align:
                        center;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;
                }


                #mobile-rotate-overlay
                .rotate-icon {
                    font-size:
                        58px;

                    line-height:
                        1;
                }


                #mobile-rotate-overlay
                strong {
                    font-size:
                        20px;

                    letter-spacing:
                        2px;
                }


                #mobile-rotate-overlay
                span {
                    color:
                        #8ea4b2;

                    font-size:
                        12px;

                    letter-spacing:
                        1px;
                }


                @media
                    (orientation: portrait)
                    and
                    (pointer: coarse) {

                    #mobile-rotate-overlay {
                        display:
                            flex;
                    }
                }


                @media
                    (orientation: landscape)
                    and
                    (max-height: 520px) {

                    .mobile-joystick {
                        width:
                            124px;

                        height:
                            124px;
                    }


                    .mobile-stick {
                        width:
                            56px;

                        height:
                            56px;

                        margin:
                            -28px;
                    }


                    .mobile-actions {
                        transform:
                            scale(
                                .88
                            );

                        transform-origin:
                            right bottom;
                    }


                    body.webcs-mobile
                    .start-panel {
                        height:
                            calc(
                                100dvh - 6px
                            ) !important;

                        max-height:
                            calc(
                                100dvh - 6px
                            ) !important;

                        margin:
                            3px auto !important;

                        padding:
                            6px 8px !important;
                    }


                    body.webcs-mobile
                    .start-menu-layout {
                        gap:
                            8px !important;
                    }
                }
            `;


            document.head.appendChild(
                style
            );
        };


    // ========================================================
    // DOM
    // ========================================================

    const makeButton =
        (
            id,
            label
        ) => {

            const button =
                document.createElement(
                    "button"
                );


            button.id =
                id;


            button.type =
                "button";


            button.className =
                "mobile-btn";


            button.textContent =
                label;


            return button;
        };


    const createDOM =
        () => {

            document.body
                .classList
                .add(
                    "webcs-mobile"
                );


            const rotate =
                document.createElement(
                    "div"
                );


            rotate.id =
                "mobile-rotate-overlay";


            rotate.innerHTML =
                `
                <div class="rotate-icon">
                    ↻
                </div>

                <strong>
                    ROTATE YOUR DEVICE
                </strong>

                <span>
                    WEB CS 1.5 REQUIRES LANDSCAPE MODE
                </span>
                `;


            document.body.appendChild(
                rotate
            );


            const root =
                document.createElement(
                    "div"
                );


            root.id =
                "mobile-controls";


            root.innerHTML =
                `
                <div
                    id="mobile-look-zone"
                    aria-label="Touch look area"
                ></div>

                <div
                    id="mobile-joystick"
                    class="mobile-joystick"
                >
                    <div
                        id="mobile-stick"
                        class="mobile-stick"
                    ></div>
                </div>

                <div
                    class="mobile-actions"
                    id="mobile-actions"
                ></div>
                `;


            const actions =
                root.querySelector(
                    "#mobile-actions"
                );


            actions.append(
                makeButton(
                    "mobile-fire",
                    "FIRE"
                ),

                makeButton(
                    "mobile-jump",
                    "JUMP"
                ),

                makeButton(
                    "mobile-reload",
                    "RELOAD"
                ),

                makeButton(
                    "mobile-crouch",
                    "CROUCH"
                ),

                makeButton(
                    "mobile-weapon",
                    "WEAPON"
                ),

                makeButton(
                    "mobile-grenade",
                    "GRENADE"
                ),

                makeButton(
                    "mobile-scope",
                    "SCOPE"
                )
            );


            const fullscreen =
                makeButton(
                    "mobile-fullscreen",
                    "FULL"
                );


            root.appendChild(
                fullscreen
            );


            document.body.appendChild(
                root
            );


            return root;
        };


    // ========================================================
    // Fullscreen
    // ========================================================

    const requestFullscreen =
        async () => {

            try {

                const target =
                    document.documentElement;


                if (
                    !document.fullscreenElement &&
                    target.requestFullscreen
                ) {

                    await target
                        .requestFullscreen({
                            navigationUI:
                                "hide"
                        });
                }

            } catch (_) {
            }


            try {

                if (
                    screen.orientation
                        ?.lock
                ) {

                    await screen
                        .orientation
                        .lock(
                            "landscape"
                        );
                }

            } catch (_) {
            }
        };


    // ========================================================
    // Menu / HUD / Touch mode
    // ========================================================

    const isStartOverlayVisible =
        () => {

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
                style.display !==
                    "none" &&
                style.visibility !==
                    "hidden" &&
                Number(
                    style.opacity ||
                    1
                ) !==
                    0
            );
        };


    const syncMobileMode =
        () => {

            const game =
                state.game ||
                window.webCS15;


            const menuOpen =
                !game
                    ?.gameplayStarted ||
                isStartOverlayVisible();


            state.menuOpen =
                menuOpen;


            document
                .documentElement
                .classList
                .toggle(
                    "webcs-mobile-menu",
                    menuOpen
                );


            document
                .documentElement
                .classList
                .toggle(
                    "webcs-mobile-game",
                    !menuOpen
                );


            const active =
                Boolean(
                    game
                        ?.gameplayStarted &&
                    !game
                        ?.paused &&
                    !menuOpen
                );


            setGameplayUI(
                active
            );
        };


    // ========================================================
    // Gameplay UI
    // ========================================================

    const setGameplayUI =
        active => {

            active =
                Boolean(
                    active
                );


            if (
                state.enabled ===
                active
            ) {
                return;
            }


            state.enabled =
                active;


            document
                .getElementById(
                    "mobile-controls"
                )
                ?.classList
                .toggle(
                    "active",
                    state.enabled
                );


            if (
                !state.enabled
            ) {

                state.game
                    ?.player
                    ?.setMovementInput?.({
                        forward:
                            false,

                        backward:
                            false,

                        left:
                            false,

                        right:
                            false,

                        walk:
                            false
                    });


                state.game
                    ?.player
                    ?.stopFire?.();
            }
        };


    // ========================================================
    // Joystick
    // ========================================================

    const bindJoystick =
        root => {

            const zone =
                root.querySelector(
                    "#mobile-joystick"
                );


            const stick =
                root.querySelector(
                    "#mobile-stick"
                );


            const radius =
                48;


            const update =
                event => {

                    const rect =
                        zone
                            .getBoundingClientRect();


                    const cx =
                        rect.left +
                        rect.width /
                        2;


                    const cy =
                        rect.top +
                        rect.height /
                        2;


                    let dx =
                        event.clientX -
                        cx;


                    let dy =
                        event.clientY -
                        cy;


                    const len =
                        Math.hypot(
                            dx,
                            dy
                        );


                    if (
                        len >
                        radius
                    ) {

                        dx =
                            dx /
                            len *
                            radius;


                        dy =
                            dy /
                            len *
                            radius;
                    }


                    stick.style
                        .transform =
                            `translate(${dx}px, ${dy}px)`;


                    const nx =
                        dx /
                        radius;


                    const ny =
                        dy /
                        radius;


                    const dead =
                        0.23;


                    state.game
                        ?.player
                        ?.setMovementInput?.({
                            forward:
                                ny <
                                -dead,

                            backward:
                                ny >
                                dead,

                            left:
                                nx <
                                -dead,

                            right:
                                nx >
                                dead,

                            walk:
                                false
                        });
                };


            const reset =
                () => {

                    state.joystickPointer =
                        null;


                    stick.style
                        .transform =
                            "translate(0,0)";


                    state.game
                        ?.player
                        ?.setMovementInput?.({
                            forward:
                                false,

                            backward:
                                false,

                            left:
                                false,

                            right:
                                false,

                            walk:
                                false
                        });
                };


            zone.addEventListener(
                "pointerdown",
                event => {

                    if (
                        !state.enabled ||
                        state.joystickPointer !==
                            null
                    ) {
                        return;
                    }


                    state.joystickPointer =
                        event.pointerId;


                    zone.setPointerCapture?.(
                        event.pointerId
                    );


                    update(
                        event
                    );
                }
            );


            zone.addEventListener(
                "pointermove",
                event => {

                    if (
                        event.pointerId !==
                        state.joystickPointer
                    ) {
                        return;
                    }


                    update(
                        event
                    );
                }
            );


            zone.addEventListener(
                "pointerup",
                event => {

                    if (
                        event.pointerId ===
                        state.joystickPointer
                    ) {

                        reset();
                    }
                }
            );


            zone.addEventListener(
                "pointercancel",
                event => {

                    if (
                        event.pointerId ===
                        state.joystickPointer
                    ) {

                        reset();
                    }
                }
            );
        };


    // ========================================================
    // Look
    // ========================================================

    const bindLook =
        root => {

            const zone =
                root.querySelector(
                    "#mobile-look-zone"
                );


            const sensitivity =
                0.0032;


            const maxPitch =
                Math.PI /
                2 -
                0.08;


            zone.addEventListener(
                "pointerdown",
                event => {

                    if (
                        !state.enabled ||
                        state.lookPointer !==
                            null
                    ) {
                        return;
                    }


                    state.lookPointer =
                        event.pointerId;


                    state.lookX =
                        event.clientX;


                    state.lookY =
                        event.clientY;


                    zone.setPointerCapture?.(
                        event.pointerId
                    );
                }
            );


            zone.addEventListener(
                "pointermove",
                event => {

                    if (
                        !state.enabled ||
                        event.pointerId !==
                            state.lookPointer
                    ) {
                        return;
                    }


                    const dx =
                        event.clientX -
                        state.lookX;


                    const dy =
                        event.clientY -
                        state.lookY;


                    state.lookX =
                        event.clientX;


                    state.lookY =
                        event.clientY;


                    const camera =
                        state.game
                            ?.camera;


                    if (!camera) {
                        return;
                    }


                    camera.rotation
                        .order =
                            "YXZ";


                    camera.rotation
                        .y -=
                            dx *
                            sensitivity;


                    camera.rotation
                        .x =
                            clamp(
                                camera
                                    .rotation
                                    .x -
                                    dy *
                                    sensitivity,

                                -maxPitch,

                                maxPitch
                            );
                }
            );


            const reset =
                event => {

                    if (
                        event.pointerId ===
                        state.lookPointer
                    ) {

                        state.lookPointer =
                            null;
                    }
                };


            zone.addEventListener(
                "pointerup",
                reset
            );


            zone.addEventListener(
                "pointercancel",
                reset
            );
        };


    // ========================================================
    // Action button helper
    // ========================================================

    const pressBind =
        (
            element,
            onDown,
            onUp =
                null
        ) => {

            if (!element) {
                return;
            }


            element.addEventListener(
                "pointerdown",
                event => {

                    if (
                        !state.enabled
                    ) {
                        return;
                    }


                    event.preventDefault();

                    event.stopPropagation();


                    element
                        .setPointerCapture?.(
                            event.pointerId
                        );


                    element
                        .classList
                        .add(
                            "active"
                        );


                    onDown?.(
                        event
                    );
                }
            );


            const release =
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    element
                        .classList
                        .remove(
                            "active"
                        );


                    onUp?.(
                        event
                    );
                };


            element.addEventListener(
                "pointerup",
                release
            );


            element.addEventListener(
                "pointercancel",
                release
            );
        };


    // ========================================================
    // Actions
    // ========================================================

    const bindActions =
        root => {

            const game =
                () =>
                    state.game;


            // ------------------------------------------------
            // FIRE
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-fire"
                ),

                () => {

                    const player =
                        game()
                            ?.player;


                    if (
                        !player
                            ?.isAlive
                    ) {
                        return;
                    }


                    if (
                        player
                            .grenadeMode
                    ) {

                        if (
                            player
                                .beginGrenadePrime?.()
                        ) {

                            game()
                                ?.weaponView
                                ?.beginGrenadePrime?.();
                        }

                    } else {

                        player
                            .startFire?.();
                    }
                },

                () => {

                    const player =
                        game()
                            ?.player;


                    if (
                        player
                            ?.grenadeMode
                    ) {

                        if (
                            player
                                .releaseGrenadePrime?.()
                        ) {

                            game()
                                ?.weaponView
                                ?.releaseGrenadeThrow?.();
                        }

                    } else {

                        player
                            ?.stopFire?.();
                    }
                }
            );


            // ------------------------------------------------
            // JUMP
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-jump"
                ),

                () =>
                    game()
                        ?.player
                        ?.jump?.()
            );


            // ------------------------------------------------
            // RELOAD
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-reload"
                ),

                () => {

                    game()
                        ?.exitSniperScope?.({
                            restoreWeaponView:
                                true
                        });


                    game()
                        ?.player
                        ?.reload?.();
                }
            );


            // ------------------------------------------------
            // CROUCH
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-crouch"
                ),

                () => {

                    const player =
                        game()
                            ?.player;


                    if (!player) {
                        return;
                    }


                    player
                        .setCrouching?.(
                            !player
                                .isCrouching
                        );
                }
            );


            // ------------------------------------------------
            // WEAPON
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-weapon"
                ),

                () => {

                    const player =
                        game()
                            ?.player;


                    if (!player) {
                        return;
                    }


                    game()
                        ?.exitSniperScope?.({
                            restoreWeaponView:
                                true
                        });


                    state.weaponCycle =
                        (
                            state.weaponCycle +
                            1
                        ) %
                        3;


                    if (
                        state.weaponCycle ===
                        0
                    ) {

                        player
                            .equipPrimary?.();
                    }


                    if (
                        state.weaponCycle ===
                        1
                    ) {

                        player
                            .equipSecondary?.();
                    }


                    if (
                        state.weaponCycle ===
                        2
                    ) {

                        player
                            .equipKnife?.();
                    }
                }
            );


            // ------------------------------------------------
            // GRENADE
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-grenade"
                ),

                () => {

                    game()
                        ?.exitSniperScope?.({
                            restoreWeaponView:
                                false
                        });


                    if (
                        !game()
                            ?.weaponView
                            ?.isGrenadeBusy?.()
                    ) {

                        game()
                            ?.player
                            ?.cycleGrenadeSlot?.();
                    }
                }
            );


            // ------------------------------------------------
            // SCOPE
            // ------------------------------------------------

            pressBind(
                root.querySelector(
                    "#mobile-scope"
                ),

                () =>
                    game()
                        ?.toggleSniperScope?.()
            );


            // ------------------------------------------------
            // Fullscreen
            // ------------------------------------------------

            root
                .querySelector(
                    "#mobile-fullscreen"
                )
                ?.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        requestFullscreen();
                    }
                );
        };


    // ========================================================
    // Start / lifecycle
    // ========================================================

    const bindStart =
        () => {

            const startButton =
                document.getElementById(
                    "start-button"
                );


            startButton
                ?.addEventListener(
                    "click",
                    () => {

                        requestFullscreen();


                        window.setTimeout(
                            syncMobileMode,
                            120
                        );
                    },
                    {
                        capture:
                            true
                    }
                );


            window.addEventListener(
                "pagehide",
                () =>
                    setGameplayUI(
                        false
                    )
            );


            document.addEventListener(
                "visibilitychange",
                () => {

                    if (
                        document.hidden
                    ) {

                        setGameplayUI(
                            false
                        );
                    }
                }
            );


            const tick =
                () => {

                    syncMobileMode();


                    requestAnimationFrame(
                        tick
                    );
                };


            requestAnimationFrame(
                tick
            );
        };


    // ========================================================
    // Bootstrap
    // ========================================================

    injectCSS();


    const root =
        createDOM();


    waitForGame()
        .then(
            game => {

                state.game =
                    game;


                syncMobileMode();


                bindJoystick(
                    root
                );


                bindLook(
                    root
                );


                bindActions(
                    root
                );


                bindStart();


                console.log(
                    "[WEB-CS15] Mobile Controls V2 ready"
                );
            }
        );
}
