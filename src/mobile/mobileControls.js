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
        weaponCycle: 0
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const waitForGame = () => new Promise(resolve => {
        const check = () => {
            if (window.webCS15?.player && window.webCS15?.camera) {
                resolve(window.webCS15);
                return;
            }
            requestAnimationFrame(check);
        };
        check();
    });

    const injectCSS = () => {
        const style = document.createElement("style");
        style.id = "webcs-mobile-style";
        style.textContent = `
            html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                overflow: hidden;
                overscroll-behavior: none;
                touch-action: none;
                background: #000;
            }

            body.webcs-mobile .start-panel {
                width: min(96vw, 980px) !important;
                max-height: 92dvh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }

            body.webcs-mobile .start-menu-layout {
                gap: 12px !important;
            }

            body.webcs-mobile .how-to-play-panel {
                max-height: 76dvh;
                overflow-y: auto;
            }

            #mobile-controls {
                position: fixed;
                inset: 0;
                z-index: 9700;
                pointer-events: none;
                user-select: none;
                -webkit-user-select: none;
                touch-action: none;
                display: none;
            }

            #mobile-controls.active {
                display: block;
            }

            #mobile-look-zone {
                position: absolute;
                top: 0;
                right: 0;
                width: 58%;
                height: 100%;
                pointer-events: auto;
                touch-action: none;
            }

            .mobile-joystick {
                position: absolute;
                left: max(22px, env(safe-area-inset-left));
                bottom: max(24px, env(safe-area-inset-bottom));
                width: 142px;
                height: 142px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,.28);
                background: rgba(10,18,25,.32);
                box-shadow: inset 0 0 24px rgba(0,0,0,.35);
                pointer-events: auto;
                touch-action: none;
            }

            .mobile-stick {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 62px;
                height: 62px;
                margin: -31px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,.65);
                background: rgba(62,198,255,.38);
                box-shadow: 0 0 18px rgba(62,198,255,.28);
                transform: translate(0,0);
            }

            .mobile-actions {
                position: absolute;
                right: max(18px, env(safe-area-inset-right));
                bottom: max(18px, env(safe-area-inset-bottom));
                width: 238px;
                height: 190px;
                pointer-events: none;
            }

            .mobile-btn {
                position: absolute;
                min-width: 60px;
                height: 52px;
                padding: 0 10px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,.42);
                background: rgba(10,18,25,.62);
                color: #fff;
                font: 700 11px Arial, Helvetica, sans-serif;
                letter-spacing: .5px;
                box-shadow: 0 3px 14px rgba(0,0,0,.28);
                pointer-events: auto;
                touch-action: none;
            }

            .mobile-btn:active,
            .mobile-btn.active {
                background: rgba(38,119,162,.86);
                border-color: #66d4ff;
            }

            #mobile-fire { right: 0; bottom: 46px; width: 86px; height: 86px; border-radius: 50%; font-size: 13px; }
            #mobile-jump { right: 92px; bottom: 0; }
            #mobile-reload { right: 96px; bottom: 58px; }
            #mobile-crouch { right: 166px; bottom: 0; }
            #mobile-weapon { right: 166px; bottom: 58px; }
            #mobile-grenade { right: 96px; bottom: 116px; }
            #mobile-scope { right: 0; bottom: 140px; }

            #mobile-fullscreen {
                position: absolute;
                top: max(12px, env(safe-area-inset-top));
                right: max(12px, env(safe-area-inset-right));
                width: 48px;
                height: 34px;
                min-width: 48px;
                opacity: .76;
            }

            #mobile-rotate-overlay {
                position: fixed;
                inset: 0;
                z-index: 20000;
                display: none;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 14px;
                padding: 28px;
                background: #071018;
                color: white;
                text-align: center;
                font-family: Arial, Helvetica, sans-serif;
            }

            #mobile-rotate-overlay .rotate-icon {
                font-size: 58px;
                line-height: 1;
            }

            #mobile-rotate-overlay strong {
                font-size: 20px;
                letter-spacing: 2px;
            }

            #mobile-rotate-overlay span {
                color: #8ea4b2;
                font-size: 12px;
                letter-spacing: 1px;
            }

            @media (orientation: portrait) and (pointer: coarse) {
                #mobile-rotate-overlay { display: flex; }
            }

            @media (max-height: 520px) {
                .mobile-joystick { width: 124px; height: 124px; }
                .mobile-stick { width: 56px; height: 56px; margin: -28px; }
                .mobile-actions { transform: scale(.88); transform-origin: right bottom; }
                body.webcs-mobile .start-panel { max-height: 96dvh; }
            }
        `;
        document.head.appendChild(style);
    };

    const makeButton = (id, label) => {
        const button = document.createElement("button");
        button.id = id;
        button.type = "button";
        button.className = "mobile-btn";
        button.textContent = label;
        return button;
    };

    const createDOM = () => {
        document.body.classList.add("webcs-mobile");

        const rotate = document.createElement("div");
        rotate.id = "mobile-rotate-overlay";
        rotate.innerHTML = `
            <div class="rotate-icon">↻</div>
            <strong>ROTATE YOUR DEVICE</strong>
            <span>WEB CS 1.5 REQUIRES LANDSCAPE MODE</span>
        `;
        document.body.appendChild(rotate);

        const root = document.createElement("div");
        root.id = "mobile-controls";
        root.innerHTML = `
            <div id="mobile-look-zone" aria-label="Touch look area"></div>
            <div id="mobile-joystick" class="mobile-joystick">
                <div id="mobile-stick" class="mobile-stick"></div>
            </div>
            <div class="mobile-actions" id="mobile-actions"></div>
        `;

        const actions = root.querySelector("#mobile-actions");
        actions.append(
            makeButton("mobile-fire", "FIRE"),
            makeButton("mobile-jump", "JUMP"),
            makeButton("mobile-reload", "RELOAD"),
            makeButton("mobile-crouch", "CROUCH"),
            makeButton("mobile-weapon", "WEAPON"),
            makeButton("mobile-grenade", "GRENADE"),
            makeButton("mobile-scope", "SCOPE")
        );

        const fullscreen = makeButton("mobile-fullscreen", "FULL");
        root.appendChild(fullscreen);

        document.body.appendChild(root);
        return root;
    };

    const requestFullscreen = async () => {
        try {
            const target = document.documentElement;
            if (!document.fullscreenElement && target.requestFullscreen) {
                await target.requestFullscreen({ navigationUI: "hide" });
            }
        } catch (_) {}

        try {
            if (screen.orientation?.lock) {
                await screen.orientation.lock("landscape");
            }
        } catch (_) {}
    };

    const setGameplayUI = active => {
        state.enabled = Boolean(active);
        document.getElementById("mobile-controls")?.classList.toggle("active", state.enabled);
        if (!state.enabled) {
            state.game?.player?.setMovementInput?.({
                forward: false,
                backward: false,
                left: false,
                right: false,
                walk: false
            });
            state.game?.player?.stopFire?.();
        }
    };

    const bindJoystick = root => {
        const zone = root.querySelector("#mobile-joystick");
        const stick = root.querySelector("#mobile-stick");
        const radius = 48;

        const update = event => {
            const rect = zone.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = event.clientX - cx;
            let dy = event.clientY - cy;
            const len = Math.hypot(dx, dy);
            if (len > radius) {
                dx = dx / len * radius;
                dy = dy / len * radius;
            }

            stick.style.transform = `translate(${dx}px, ${dy}px)`;

            const nx = dx / radius;
            const ny = dy / radius;
            const dead = 0.23;

            state.game?.player?.setMovementInput?.({
                forward: ny < -dead,
                backward: ny > dead,
                left: nx < -dead,
                right: nx > dead,
                walk: false
            });
        };

        const reset = () => {
            state.joystickPointer = null;
            stick.style.transform = "translate(0,0)";
            state.game?.player?.setMovementInput?.({
                forward: false,
                backward: false,
                left: false,
                right: false,
                walk: false
            });
        };

        zone.addEventListener("pointerdown", event => {
            if (!state.enabled || state.joystickPointer !== null) return;
            state.joystickPointer = event.pointerId;
            zone.setPointerCapture?.(event.pointerId);
            update(event);
        });

        zone.addEventListener("pointermove", event => {
            if (event.pointerId !== state.joystickPointer) return;
            update(event);
        });

        zone.addEventListener("pointerup", event => {
            if (event.pointerId === state.joystickPointer) reset();
        });

        zone.addEventListener("pointercancel", event => {
            if (event.pointerId === state.joystickPointer) reset();
        });
    };

    const bindLook = root => {
        const zone = root.querySelector("#mobile-look-zone");
        const sensitivity = 0.0032;
        const maxPitch = Math.PI / 2 - 0.08;

        zone.addEventListener("pointerdown", event => {
            if (!state.enabled || state.lookPointer !== null) return;
            state.lookPointer = event.pointerId;
            state.lookX = event.clientX;
            state.lookY = event.clientY;
            zone.setPointerCapture?.(event.pointerId);
        });

        zone.addEventListener("pointermove", event => {
            if (!state.enabled || event.pointerId !== state.lookPointer) return;

            const dx = event.clientX - state.lookX;
            const dy = event.clientY - state.lookY;
            state.lookX = event.clientX;
            state.lookY = event.clientY;

            const camera = state.game?.camera;
            if (!camera) return;

            camera.rotation.order = "YXZ";
            camera.rotation.y -= dx * sensitivity;
            camera.rotation.x = clamp(camera.rotation.x - dy * sensitivity, -maxPitch, maxPitch);
        });

        const reset = event => {
            if (event.pointerId === state.lookPointer) state.lookPointer = null;
        };
        zone.addEventListener("pointerup", reset);
        zone.addEventListener("pointercancel", reset);
    };

    const pressBind = (element, onDown, onUp = null) => {
        element.addEventListener("pointerdown", event => {
            if (!state.enabled) return;
            event.preventDefault();
            event.stopPropagation();
            element.setPointerCapture?.(event.pointerId);
            element.classList.add("active");
            onDown?.(event);
        });

        const release = event => {
            event.preventDefault();
            event.stopPropagation();
            element.classList.remove("active");
            onUp?.(event);
        };

        element.addEventListener("pointerup", release);
        element.addEventListener("pointercancel", release);
    };

    const bindActions = root => {
        const game = () => state.game;

        pressBind(root.querySelector("#mobile-fire"), () => {
            const player = game()?.player;
            if (!player?.isAlive) return;

            if (player.grenadeMode) {
                if (player.beginGrenadePrime?.()) {
                    game()?.weaponView?.beginGrenadePrime?.();
                }
            } else {
                player.startFire?.();
            }
        }, () => {
            const player = game()?.player;
            if (player?.grenadeMode) {
                if (player.releaseGrenadePrime?.()) {
                    game()?.weaponView?.releaseGrenadeThrow?.();
                }
            } else {
                player?.stopFire?.();
            }
        });

        pressBind(root.querySelector("#mobile-jump"), () => game()?.player?.jump?.());

        pressBind(root.querySelector("#mobile-reload"), () => {
            game()?.exitSniperScope?.({ restoreWeaponView: true });
            game()?.player?.reload?.();
        });

        pressBind(root.querySelector("#mobile-crouch"), () => {
            const player = game()?.player;
            if (!player) return;
            player.setCrouching?.(!player.isCrouching);
        });

        pressBind(root.querySelector("#mobile-weapon"), () => {
            const player = game()?.player;
            if (!player) return;
            game()?.exitSniperScope?.({ restoreWeaponView: true });
            state.weaponCycle = (state.weaponCycle + 1) % 3;
            if (state.weaponCycle === 0) player.equipPrimary?.();
            if (state.weaponCycle === 1) player.equipSecondary?.();
            if (state.weaponCycle === 2) player.equipKnife?.();
        });

        pressBind(root.querySelector("#mobile-grenade"), () => {
            game()?.exitSniperScope?.({ restoreWeaponView: false });
            if (!game()?.weaponView?.isGrenadeBusy?.()) {
                game()?.player?.cycleGrenadeSlot?.();
            }
        });

        pressBind(root.querySelector("#mobile-scope"), () => game()?.toggleSniperScope?.());

        root.querySelector("#mobile-fullscreen")?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            requestFullscreen();
        });
    };

    const bindStart = () => {
        const startButton = document.getElementById("start-button");
        startButton?.addEventListener("click", () => {
            requestFullscreen();
            window.setTimeout(() => setGameplayUI(true), 120);
        }, { capture: true });

        window.addEventListener("pagehide", () => setGameplayUI(false));
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) setGameplayUI(false);
        });

        const sync = () => {
            const active = Boolean(state.game?.gameplayStarted && !state.game?.paused);
            if (active !== state.enabled) setGameplayUI(active);
            requestAnimationFrame(sync);
        };
        requestAnimationFrame(sync);
    };

    injectCSS();
    const root = createDOM();

    waitForGame().then(game => {
        state.game = game;
        bindJoystick(root);
        bindLook(root);
        bindActions(root);
        bindStart();
        console.log("[WEB-CS15] Mobile Controls V1 ready");
    });
}
