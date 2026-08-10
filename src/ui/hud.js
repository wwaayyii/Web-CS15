/**
 * Web-CS15
 * src/ui/hud.js
 *
 * HUD 系统
 *
 * 负责：
 * - HP / Armor
 * - Money
 * - Ammo
 * - Weapon name
 * - Round timer
 * - CT / T score
 * - Kill feed
 * - Freeze time
 * - Spectator
 * - Scoreboard
 *
 * 不负责：
 * - Buy Menu
 * - Radio Menu 本身
 * - 游戏逻辑
 */

import {
    HUD_CONFIG,
    TEAM,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    formatTime,
    gameEvents
} from "../core/utils.js";


// ============================================================
// HUDSystem
// ============================================================

export class HUDSystem {

    constructor({
        player = null,
        roundSystem = null,
        bots = []
    } = {}) {

        this.player =
            player;

        this.roundSystem =
            roundSystem;

        this.bots =
            bots;


        // ====================================================
        // DOM references
        // ====================================================

        this.elements = {
            hp: null,
            armor: null,
            money: null,

            ammoClip: null,
            ammoReserve: null,
            weaponName: null,

            timer: null,

            ctScore: null,
            tScore: null,

            roundNumber: null,

            freeze: null,
            freezeText: null,

            killFeed: null,

            spectator: null,

            scoreboard: null,
            scoreboardCT: null,
            scoreboardT: null,

            radioMessage: null,

            statusText: null,

            crosshair: null,

            grenadeIndicator: null,

            flashOverlay: null
        };


        // ====================================================
        // State
        // ====================================================

        this.initialized =
            false;

        this.scoreboardVisible =
            false;

        this.killFeedEntries =
            [];


        // ====================================================
        // Dynamic Crosshair V2
        // ====================================================

        this.crosshairFrameId =
            null;


        this.crosshairVisualGap =
            0;


        this.crosshairTargetGap =
            0;


        this.crosshairLastTime =
            performance.now();


        // ====================================================
        // Flashbang V1
        // ====================================================

        this.flashFadeTimer =
            null;

        this.flashHideTimer =
            null;

        this.flashEndTime =
            0;


        // ====================================================
        // Bound handlers
        // ====================================================

        this.handlers = {};


        this._createHandlers();
    }


    // ========================================================
    // Init
    // ========================================================

    init({
        root = document
    } = {}) {

        this.elements.hp =
            root.getElementById(
                "hud-hp"
            );


        this.elements.armor =
            root.getElementById(
                "hud-armor"
            );


        this.elements.money =
            root.getElementById(
                "hud-money"
            );


        this.elements.ammoClip =
            root.getElementById(
                "hud-ammo-clip"
            );


        this.elements.ammoReserve =
            root.getElementById(
                "hud-ammo-reserve"
            );


        this.elements.weaponName =
            root.getElementById(
                "hud-weapon-name"
            );


        this.elements.timer =
            root.getElementById(
                "round-timer"
            );


        this.elements.ctScore =
            root.getElementById(
                "team-a-score"
            );


        this.elements.tScore =
            root.getElementById(
                "team-b-score"
            );


        this.elements.roundNumber =
            root.getElementById(
                "round-number"
            );


        this.elements.freeze =
            root.getElementById(
                "freeze-hud"
            );


        this.elements.freezeText =
            root.getElementById(
                "freeze-timer-text"
            );


        this.elements.killFeed =
            root.getElementById(
                "kill-feed"
            );


        this.elements.spectator =
            root.getElementById(
                "spectate-hud"
            );


        this.elements.scoreboard =
            root.getElementById(
                "tab-scoreboard"
            );


        this.elements.scoreboardCT =
            root.getElementById(
                "sb-ct-tbody"
            );


        this.elements.scoreboardT =
            root.getElementById(
                "sb-t-tbody"
            );


        this.elements.radioMessage =
            root.getElementById(
                "radio-message"
            );


        this.elements.statusText =
            root.getElementById(
                "hud-status"
            );


        this.elements.crosshair =
            root.getElementById(
                "crosshair"
            );


        this.createGrenadeIndicator(
            root
        );


        this.createFlashOverlay(
            root
        );


        this._bindEvents();


        this.initialized =
            true;


        this.refreshAll();


        this.startDynamicCrosshair();


        return this;
    }


    // ========================================================
    // References
    // ========================================================

    setPlayer(player) {

        this.player =
            player;


        this.refreshPlayer();
    }


    setRoundSystem(roundSystem) {

        this.roundSystem =
            roundSystem;


        this.refreshRound();
    }


    setBots(bots) {

        this.bots =
            bots || [];


        this.refreshScoreboard();
    }


    // ========================================================
    // Event handlers
    // ========================================================

    _createHandlers() {

        // ----------------------------------------------------
        // Player spawn
        // ----------------------------------------------------

        this.handlers.playerSpawn =
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.hideSpectator();

                this.refreshPlayer();

                this.refreshWeapon();


                this.updateCrosshairCrouch(
                    false
                );
            };


        // ----------------------------------------------------
        // Player damage
        // ----------------------------------------------------

        this.handlers.playerDamage =
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.updateHP(
                    data.hp
                );


                this.updateArmor(
                    data.armor
                );
            };


        // ----------------------------------------------------
        // Player death
        // ----------------------------------------------------

        this.handlers.playerDeath =
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.updateHP(
                    0
                );


                this.showSpectator();
            };


        // ----------------------------------------------------
        // Armor
        // ----------------------------------------------------

        this.handlers.armorChanged =
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.updateArmor(
                    data.armor
                );
            };


        // ----------------------------------------------------
        // Money
        // ----------------------------------------------------

        this.handlers.moneyChanged =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.updateMoney(
                    data.money
                );
            };


        // ----------------------------------------------------
        // Ammo
        // ----------------------------------------------------

        this.handlers.ammoChanged =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.updateAmmo(
                    data.clip,
                    data.reserve
                );


                this.updateWeaponName(
                    data.weapon?.name ||
                    data.weaponId
                );
            };


        // ----------------------------------------------------
        // Equip
        // ----------------------------------------------------

        this.handlers.weaponEquip =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.updateWeaponName(
                    data.weapon
                        ?.name ||
                    ""
                );


                this.updateAmmo(
                    data.weapon
                        ?.clipAmmo ??
                        0,

                    data.weapon
                        ?.reserveAmmo ??
                        0
                );
            };


        // ----------------------------------------------------
        // Crouch / Crosshair
        // ----------------------------------------------------

        this.handlers.playerCrouch =
            data => {

                if (
                    data.player !==
                    this.player
                ) {

                    return;
                }


                this.updateCrosshairCrouch(
                    Boolean(
                        data.crouching
                    )
                );
            };


        // ----------------------------------------------------
        // Round freeze
        // ----------------------------------------------------

        this.handlers.freezeStart =
            data => {

                this.showFreeze();

                this.updateFreezeText(
                    data.duration
                );


                this.updateRoundNumber(
                    data.round
                );


                if (
                    data.score
                ) {

                    this.updateScore(
                        data.score.ct,
                        data.score.t
                    );
                }
            };


        // ----------------------------------------------------
        // Round start
        // ----------------------------------------------------

        this.handlers.roundStart =
            data => {

                this.hideFreeze();


                this.updateRoundNumber(
                    data.round
                );


                if (
                    data.score
                ) {

                    this.updateScore(
                        data.score.ct,
                        data.score.t
                    );
                }
            };


        // ----------------------------------------------------
        // Round end
        // ----------------------------------------------------

        this.handlers.roundEnd =
            data => {

                if (
                    data.score
                ) {

                    this.updateScore(
                        data.score.ct,
                        data.score.t
                    );
                }


                const winnerText =
                    this._getWinnerText(
                        data.winner
                    );


                this.setStatusText(
                    winnerText
                );


                window.setTimeout(
                    () => {

                        this.setStatusText(
                            ""
                        );

                    },
                    2500
                );


                this.refreshScoreboard();
            };


        // ----------------------------------------------------
        // Round timer
        // ----------------------------------------------------

        this.handlers.timerUpdate =
            data => {

                if (
                    data.phase ===
                    "round"
                ) {

                    this.updateTimer(
                        data.timeLeft
                    );

                } else if (
                    data.phase ===
                    "freeze"
                ) {

                    this.updateFreezeText(
                        data.timeLeft
                    );
                }
            };


        // ----------------------------------------------------
        // Score
        // ----------------------------------------------------

        this.handlers.scoreChanged =
            data => {

                this.updateScore(
                    data.ct,
                    data.t
                );


                this.refreshScoreboard();
            };


        // ----------------------------------------------------
        // Player kill
        // ----------------------------------------------------

        this.handlers.playerKill =
            data => {

                if (
                    data.player ===
                    this.player
                ) {

                    this.refreshScoreboard();
                }
            };


        // ----------------------------------------------------
        // Bot kill
        // ----------------------------------------------------

        this.handlers.botKill =
            () => {

                this.refreshScoreboard();
            };


        // ----------------------------------------------------
        // Bot death
        // ----------------------------------------------------

        this.handlers.botDeath =
            data => {

                this.addKillFeedFromDeath(
                    data
                );


                this.refreshScoreboard();
            };


        // ----------------------------------------------------
        // Player death feed
        // ----------------------------------------------------

        this.handlers.playerDeathFeed =
            data => {

                this.addKillFeedFromDeath(
                    data
                );


                this.refreshScoreboard();
            };


        // ----------------------------------------------------
        // Grenade kill
        // ----------------------------------------------------

        this.handlers.grenadeKill =
            data => {

                this.addKillFeed({
                    attacker:
                        data.owner,

                    victim:
                        data.target,

                    weapon:
                        "HE",

                    headshot:
                        false
                });
            };


        // ----------------------------------------------------
        // Radio
        // ----------------------------------------------------

        this.handlers.radioMessage =
            data => {

                /*
                 * radio.js 本身已经更新主要 Radio HUD。
                 * HUD这里只保留接口，不重复显示。
                 */
            };


        // ----------------------------------------------------
        // Grenade Select / Inventory
        // ----------------------------------------------------

        this.handlers.grenadeSelected =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.updateGrenadeIndicator(
                    data.type
                );
            };


        this.handlers.grenadeInventoryChanged =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.updateGrenadeIndicator();
            };


        // ----------------------------------------------------
        // Flashbang V1
        // ----------------------------------------------------

        this.handlers.grenadeFlash =
            data => {

                if (
                    data.target !==
                    this.player
                ) {
                    return;
                }


                this.showFlashEffect({
                    strength:
                        data.strength,

                    duration:
                        data.duration
                });
            };


        // ----------------------------------------------------
        // Buy
        // ----------------------------------------------------

        this.handlers.buySuccess =
            data => {

                if (
                    data.buyer !==
                    this.player
                ) {
                    return;
                }


                this.updateMoney(
                    this.player.money
                );


                this.refreshWeapon();
            };


        this.handlers.buyFailed =
            data => {

                if (
                    data.buyer !==
                    this.player
                ) {
                    return;
                }


                this.showTemporaryStatus(
                    this._getPurchaseFailureText(
                        data.result
                    ),
                    1200
                );
            };
    }


    // ========================================================
    // Bind Events
    // ========================================================

    _bindEvents() {

        gameEvents.on(
            GAME_EVENT.PLAYER_SPAWN,
            this.handlers.playerSpawn
        );


        gameEvents.on(
            GAME_EVENT.PLAYER_DAMAGE,
            this.handlers.playerDamage
        );


        gameEvents.on(
            GAME_EVENT.PLAYER_DEATH,
            this.handlers.playerDeath
        );


        gameEvents.on(
            "player:armor-changed",
            this.handlers.armorChanged
        );


        gameEvents.on(
            GAME_EVENT.MONEY_CHANGED,
            this.handlers.moneyChanged
        );


        gameEvents.on(
            "weapon:ammo-changed",
            this.handlers.ammoChanged
        );


        gameEvents.on(
            "weapon:equip",
            this.handlers.weaponEquip
        );


        gameEvents.on(
            "player:crouch",
            this.handlers.playerCrouch
        );


        gameEvents.on(
            GAME_EVENT.ROUND_FREEZE_START,
            this.handlers.freezeStart
        );


        gameEvents.on(
            GAME_EVENT.ROUND_START,
            this.handlers.roundStart
        );


        gameEvents.on(
            GAME_EVENT.ROUND_END,
            this.handlers.roundEnd
        );


        gameEvents.on(
            "round:timer-update",
            this.handlers.timerUpdate
        );


        gameEvents.on(
            GAME_EVENT.SCORE_CHANGED,
            this.handlers.scoreChanged
        );


        gameEvents.on(
            GAME_EVENT.PLAYER_KILL,
            this.handlers.playerKill
        );


        gameEvents.on(
            "bot:kill",
            this.handlers.botKill
        );


        gameEvents.on(
            GAME_EVENT.BOT_DEATH,
            this.handlers.botDeath
        );


        gameEvents.on(
            GAME_EVENT.PLAYER_DEATH,
            this.handlers.playerDeathFeed
        );


        gameEvents.on(
            "grenade:kill",
            this.handlers.grenadeKill
        );


        gameEvents.on(
            "radio:message",
            this.handlers.radioMessage
        );


        gameEvents.on(
            "grenade:selected",
            this.handlers.grenadeSelected
        );


        gameEvents.on(
            "grenade:inventory-changed",
            this.handlers.grenadeInventoryChanged
        );


        gameEvents.on(
            "grenade:flash",
            this.handlers.grenadeFlash
        );


        gameEvents.on(
            "ui:buy-success",
            this.handlers.buySuccess
        );


        gameEvents.on(
            "ui:buy-failed",
            this.handlers.buyFailed
        );
    }


    // ========================================================
    // Refresh all
    // ========================================================

    refreshAll() {

        this.refreshPlayer();

        this.refreshWeapon();

        this.refreshRound();

        this.refreshScoreboard();

        this.updateGrenadeIndicator();
    }


    // ========================================================
    // Player
    // ========================================================

    refreshPlayer() {

        if (!this.player) {
            return;
        }


        this.updateHP(
            this.player.hp
        );


        this.updateArmor(
            this.player.armor
        );


        this.updateMoney(
            this.player.money
        );


        this.updateCrosshairCrouch(
            Boolean(
                this.player.isCrouching
            )
        );
    }


    // ========================================================
    // Dynamic Crosshair V2
    // ========================================================

    updateCrosshairCrouch(
        crouching
    ) {

        const element =
            this.elements.crosshair;


        if (!element) {
            return;
        }


        element.classList.toggle(
            "crosshair-crouched",
            Boolean(
                crouching
            )
        );


        element.dataset.stance =
            crouching
                ? "crouch"
                : "stand";
    }


    startDynamicCrosshair() {

        if (
            this.crosshairFrameId
        ) {

            return;
        }


        this.crosshairLastTime =
            performance.now();


        const tick =
            now => {

                this.crosshairFrameId =
                    window.requestAnimationFrame(
                        tick
                    );


                const delta =
                    Math.min(
                        0.05,
                        Math.max(
                            0,
                            (
                                now -
                                this.crosshairLastTime
                            ) /
                            1000
                        )
                    );


                this.crosshairLastTime =
                    now;


                this.updateDynamicCrosshair(
                    delta
                );
            };


        this.crosshairFrameId =
            window.requestAnimationFrame(
                tick
            );
    }


    stopDynamicCrosshair() {

        if (
            !this.crosshairFrameId
        ) {

            return;
        }


        window.cancelAnimationFrame(
            this.crosshairFrameId
        );


        this.crosshairFrameId =
            null;
    }


    updateDynamicCrosshair(
        delta = 0.016
    ) {

        const element =
            this.elements.crosshair;


        const player =
            this.player;


        if (
            !element ||
            !player
        ) {

            return;
        }


        const weapon =
            player.inventory
                ?.currentWeapon;


        if (!weapon) {

            element.style.setProperty(
                "--crosshair-gap",
                "3px"
            );


            return;
        }


        const crouching =
            Boolean(
                player.isCrouching
            );


        const airborne =
            !player.isGrounded;


        const movementFactor =
            Number(
                player.movementFactor ??
                0
            );


        const spread =
            typeof weapon.getCurrentSpread ===
                "function"
                ? weapon.getCurrentSpread({
                    movementFactor,
                    crouching,
                    crouchAccuracyMultiplier:
                        player
                            .crouchAccuracyMultiplier ??
                        0.70,
                    airborne
                })
                : 0;


        /*
         * 把真实 spread 映射到屏幕准心间距。
         *
         * 典型值：
         * crouch 0.005  -> 小
         * stand  0.008  -> 基础
         * move   0.03+  -> 明显变大
         * air    0.10+  -> 最大
         *
         * recoil 已经包含在 getCurrentSpread() 中。
         */
        let targetGap =
            2.2 +
            spread *
                155;


        if (
            player.isWalking
        ) {

            /*
             * Shift 静步视觉再收一点，
             * 但真实 spread 仍然以 weapon.js 为准。
             */
            targetGap *=
                0.92;
        }


        targetGap =
            clamp(
                targetGap,
                2.2,
                18
            );


        this.crosshairTargetGap =
            targetGap;


        /*
         * 扩张稍快，回收稍慢，
         * 更接近 FPS 动态准心手感。
         */
        const expanding =
            this.crosshairTargetGap >
            this.crosshairVisualGap;


        const response =
            expanding
                ? 18
                : 10;


        this.crosshairVisualGap +=
            (
                this.crosshairTargetGap -
                this.crosshairVisualGap
            ) *
            Math.min(
                1,
                delta *
                    response
            );


        element.style.setProperty(
            "--crosshair-gap",
            `${this.crosshairVisualGap.toFixed(
                2
            )}px`
        );


        element.dataset.dynamicState =
            airborne
                ? "air"
                : crouching
                    ? "crouch"
                    : player.isWalking
                        ? "walk"
                        : player.isMoving
                            ? "move"
                            : "stand";
    }


    // ========================================================
    // Grenade Select V1
    // ========================================================

    createGrenadeIndicator(
        root = document
    ) {

        let element =
            root.getElementById(
                "grenade-selected-indicator"
            );


        if (!element) {

            element =
                document.createElement(
                    "div"
                );


            element.id =
                "grenade-selected-indicator";


            element.style.position =
                "fixed";

            element.style.right =
                "24px";

            element.style.bottom =
                "112px";

            element.style.zIndex =
                "120";

            element.style.padding =
                "5px 9px";

            element.style.border =
                "1px solid rgba(255,255,255,.20)";

            element.style.background =
                "rgba(8,12,16,.58)";

            element.style.color =
                "#e8edf2";

            element.style.fontFamily =
                "Arial, Helvetica, sans-serif";

            element.style.fontSize =
                "12px";

            element.style.fontWeight =
                "700";

            element.style.letterSpacing =
                ".7px";

            element.style.pointerEvents =
                "none";

            element.style.userSelect =
                "none";


            document.body.appendChild(
                element
            );
        }


        this.elements.grenadeIndicator =
            element;


        this.updateGrenadeIndicator();
    }


    updateGrenadeIndicator(
        forcedType = null
    ) {

        const element =
            this.elements
                .grenadeIndicator;


        if (
            !element ||
            !this.player
        ) {

            return;
        }


        const type =
            forcedType ||
            this.player
                .selectedGrenadeType ||
            "he";


        const names = {
            he:
                "HE",

            flash:
                "FLASH",

            smoke:
                "SMOKE"
        };


        const count =
            this.player
                .grenadeInventory
                ?.getCount?.(
                    type
                ) ??
            0;


        element.textContent =
            `GRENADE: ${
                names[type] ||
                String(type).toUpperCase()
            }  x${count}`;


        element.dataset.type =
            type;


        element.dataset.empty =
            count <= 0
                ? "true"
                : "false";


        element.style.opacity =
            count <= 0
                ? "0.55"
                : "1";
    }


    // ========================================================
    // Flashbang V1
    // ========================================================

    createFlashOverlay(
        root = document
    ) {

        let overlay =
            root.getElementById(
                "flashbang-overlay"
            );


        if (!overlay) {

            overlay =
                document.createElement(
                    "div"
                );


            overlay.id =
                "flashbang-overlay";


            overlay.style.position =
                "fixed";

            overlay.style.inset =
                "0";

            overlay.style.zIndex =
                "9998";

            overlay.style.background =
                "#ffffff";

            overlay.style.opacity =
                "0";

            overlay.style.pointerEvents =
                "none";

            overlay.style.display =
                "block";

            overlay.style.transition =
                "none";

            overlay.style.willChange =
                "opacity";


            document.body.appendChild(
                overlay
            );
        }


        this.elements.flashOverlay =
            overlay;
    }


    showFlashEffect({
        strength = 0,
        duration = 0
    } = {}) {

        const overlay =
            this.elements
                .flashOverlay;


        if (!overlay) {
            return;
        }


        strength =
            clamp(
                Number(strength) ||
                    0,
                0,
                1
            );


        duration =
            Math.max(
                0.12,
                Number(duration) ||
                    0
            );


        if (
            strength <=
            0.02
        ) {

            return;
        }


        if (
            this.flashFadeTimer
        ) {

            window.clearTimeout(
                this.flashFadeTimer
            );

            this.flashFadeTimer =
                null;
        }


        if (
            this.flashHideTimer
        ) {

            window.clearTimeout(
                this.flashHideTimer
            );

            this.flashHideTimer =
                null;
        }


        const now =
            performance.now();


        this.flashEndTime =
            Math.max(
                this.flashEndTime,
                now +
                    duration *
                    1000
            );


        /*
         * 正对近距离时几乎全白；
         * 背对或远距离时只做轻度闪白。
         */
        const peakOpacity =
            clamp(
                0.18 +
                    strength *
                    0.92,
                0.18,
                1
            );


        overlay.style.transition =
            "none";


        overlay.style.opacity =
            String(
                peakOpacity
            );


        /*
         * 保持一小段强白，再开始渐隐。
         */
        const holdMs =
            Math.min(
                850,
                100 +
                    strength *
                    700
            );


        this.flashFadeTimer =
            window.setTimeout(
                () => {

                    const remaining =
                        Math.max(
                            120,
                            this.flashEndTime -
                                performance.now()
                        );


                    overlay.style.transition =
                        `opacity ${remaining}ms ease-out`;


                    overlay.style.opacity =
                        "0";


                    this.flashFadeTimer =
                        null;


                    this.flashHideTimer =
                        window.setTimeout(
                            () => {

                                overlay.style.transition =
                                    "none";

                                overlay.style.opacity =
                                    "0";

                                this.flashHideTimer =
                                    null;

                            },
                            remaining +
                                40
                        );

                },
                holdMs
            );
    }


    // ========================================================
    // Weapon
    // ========================================================

    refreshWeapon() {

        if (!this.player) {
            return;
        }


        const weapon =
            this.player.inventory
                ?.currentWeapon;


        if (!weapon) {

            this.updateWeaponName(
                ""
            );


            this.updateAmmo(
                0,
                0
            );


            return;
        }


        this.updateWeaponName(
            weapon.name
        );


        this.updateAmmo(
            weapon.clipAmmo,
            weapon.reserveAmmo
        );
    }


    // ========================================================
    // Round
    // ========================================================

    refreshRound() {

        if (
            !this.roundSystem
        ) {
            return;
        }


        const state =
            this.roundSystem
                .getState();


        this.updateScore(
            state.score.ct,
            state.score.t
        );


        this.updateRoundNumber(
            state.roundNumber
        );


        this.updateTimer(
            state.timeLeft
        );
    }


    // ========================================================
    // HP
    // ========================================================

    updateHP(value) {

        const element =
            this.elements.hp;


        if (!element) {
            return;
        }


        const hp =
            Math.max(
                0,
                Math.ceil(
                    Number(value) || 0
                )
            );


        element.textContent =
            `${hp}`;


        if (
            hp <= 25
        ) {

            element.dataset.state =
                "critical";

        } else if (
            hp <= 50
        ) {

            element.dataset.state =
                "warning";

        } else {

            element.dataset.state =
                "normal";
        }
    }


    // ========================================================
    // Armor
    // ========================================================

    updateArmor(value) {

        const element =
            this.elements.armor;


        if (!element) {
            return;
        }


        const armor =
            Math.max(
                0,
                Math.ceil(
                    Number(value) || 0
                )
            );


        element.textContent =
            `${armor}`;
    }


    // ========================================================
    // Money
    // ========================================================

    updateMoney(value) {

        const element =
            this.elements.money;


        if (!element) {
            return;
        }


        const money =
            Math.max(
                0,
                Math.floor(
                    Number(value) || 0
                )
            );


        element.textContent =
            `${HUD_CONFIG.money.prefix}${money}`;
    }


    // ========================================================
    // Ammo
    // ========================================================

    updateAmmo(
        clip,
        reserve
    ) {

        const clipElement =
            this.elements.ammoClip;


        const reserveElement =
            this.elements.ammoReserve;


        if (clipElement) {

            if (
                clip === Infinity
            ) {

                clipElement.textContent =
                    "--";

            } else {

                clipElement.textContent =
                    String(
                        Math.max(
                            0,
                            Math.floor(
                                Number(clip) ||
                                0
                            )
                        )
                    );
            }
        }


        if (reserveElement) {

            if (
                reserve === Infinity
            ) {

                reserveElement.textContent =
                    "--";

            } else {

                reserveElement.textContent =
                    String(
                        Math.max(
                            0,
                            Math.floor(
                                Number(reserve) ||
                                0
                            )
                        )
                    );
            }
        }
    }


    // ========================================================
    // Weapon name
    // ========================================================

    updateWeaponName(name) {

        const element =
            this.elements.weaponName;


        if (!element) {
            return;
        }


        element.textContent =
            name || "";
    }


    // ========================================================
    // Timer
    // ========================================================

    updateTimer(seconds) {

        const element =
            this.elements.timer;


        if (!element) {
            return;
        }


        const value =
            Math.max(
                0,
                Number(seconds) || 0
            );


        element.textContent =
            formatTime(
                value
            );


        if (
            value <= 15
        ) {

            element.dataset.state =
                "danger";

        } else if (
            value <= 30
        ) {

            element.dataset.state =
                "warning";

        } else {

            element.dataset.state =
                "normal";
        }
    }


    // ========================================================
    // Score
    // ========================================================

    updateScore(
        ct,
        t
    ) {

        if (
            this.elements.ctScore
        ) {

            this.elements
                .ctScore
                .textContent =
                `CT ${Math.max(
                    0,
                    ct || 0
                )}`;
        }


        if (
            this.elements.tScore
        ) {

            this.elements
                .tScore
                .textContent =
                `T ${Math.max(
                    0,
                    t || 0
                )}`;
        }
    }


    // ========================================================
    // Round number
    // ========================================================

    updateRoundNumber(value) {

        const element =
            this.elements.roundNumber;


        if (!element) {
            return;
        }


        element.textContent =
            `Round ${Math.max(
                0,
                Math.floor(
                    Number(value) || 0
                )
            )}`;
    }


    // ========================================================
    // Freeze
    // ========================================================

    showFreeze() {

        if (
            this.elements.freeze
        ) {

            this.elements
                .freeze
                .style.display =
                "block";
        }
    }


    hideFreeze() {

        if (
            this.elements.freeze
        ) {

            this.elements
                .freeze
                .style.display =
                "none";
        }
    }


    updateFreezeText(
        seconds
    ) {

        const element =
            this.elements.freezeText;


        if (!element) {
            return;
        }


        const value =
            Math.max(
                0,
                Math.ceil(
                    Number(seconds) || 0
                )
            );


        if (
            value <= 0
        ) {

            element.textContent =
                "GO! GO! GO!";

            return;
        }


        element.textContent =
            `FREEZE TIME: ${value}s`;
    }


    // ========================================================
    // Spectator
    // ========================================================

    showSpectator() {

        if (
            this.elements.spectator
        ) {

            this.elements
                .spectator
                .style.display =
                "flex";
        }
    }


    hideSpectator() {

        if (
            this.elements.spectator
        ) {

            this.elements
                .spectator
                .style.display =
                "none";
        }
    }


    // ========================================================
    // Status
    // ========================================================

    setStatusText(text) {

        if (
            !this.elements.statusText
        ) {
            return;
        }


        this.elements
            .statusText
            .textContent =
            text || "";
    }


    showTemporaryStatus(
        text,
        duration = 1000
    ) {

        this.setStatusText(
            text
        );


        window.setTimeout(
            () => {

                if (
                    this.elements
                        .statusText
                        ?.textContent ===
                    text
                ) {

                    this.setStatusText(
                        ""
                    );
                }

            },
            duration
        );
    }


    // ========================================================
    // Kill feed
    // ========================================================

    addKillFeed({
        attacker,
        victim,
        weapon = "",
        headshot = false
    } = {}) {

        if (
            !this.elements.killFeed
        ) {
            return;
        }


        const attackerName =
            this._getEntityName(
                attacker
            );


        const victimName =
            this._getEntityName(
                victim
            );


        const attackerColor =
            this._getEntityColor(
                attacker
            );


        const victimColor =
            this._getEntityColor(
                victim
            );


        const attackerIsPlayer =
            attacker ===
            this.player;


        const victimIsPlayer =
            victim ===
            this.player;


        const entry =
            document.createElement(
                "div"
            );


        entry.className =
            "kill-feed-entry";


        if (
            attackerIsPlayer
        ) {

            entry.classList.add(
                "kill-feed-entry-player-kill"
            );
        }


        if (
            victimIsPlayer
        ) {

            entry.classList.add(
                "kill-feed-entry-player-death"
            );
        }


        if (
            headshot
        ) {

            entry.classList.add(
                "kill-feed-entry-headshot"
            );
        }


        entry.innerHTML =
            `
            <span
                class="kill-feed-name"
                style="color:${attackerColor}"
            >
                ${this._escapeHTML(
                    attackerName
                )}
            </span>

            <span class="kill-feed-weapon">
                [${this._escapeHTML(
                    weapon || "?"
                )}]
            </span>

            ${
                headshot
                    ? `
                    <span
                        class="kill-feed-headshot"
                        title="Headshot"
                    >
                        HEADSHOT
                    </span>
                    `
                    : ""
            }

            <span
                class="kill-feed-name"
                style="color:${victimColor}"
            >
                ${this._escapeHTML(
                    victimName
                )}
            </span>
            `;


        this.elements
            .killFeed
            .appendChild(
                entry
            );


        this.killFeedEntries.push(
            entry
        );


        while (
            this.killFeedEntries.length >
            HUD_CONFIG.killFeed
                .maxEntries
        ) {

            const oldest =
                this.killFeedEntries
                    .shift();


            oldest?.remove();
        }


        window.setTimeout(
            () => {

                entry.style.opacity =
                    "0";


                entry.style.transform =
                    "translateX(20px)";


                window.setTimeout(
                    () => {

                        entry.remove();


                        const index =
                            this.killFeedEntries
                                .indexOf(
                                    entry
                                );


                        if (
                            index !== -1
                        ) {

                            this.killFeedEntries
                                .splice(
                                    index,
                                    1
                                );
                        }

                    },
                    250
                );

            },
            HUD_CONFIG.killFeed
                .duration
        );
    }


    // ========================================================
    // Death -> feed
    // ========================================================

    addKillFeedFromDeath(
        data = {}
    ) {

        let attacker =
            data.attacker;


        const victim =
            data.victim ||
            data.bot ||
            data.player;


        if (
            !victim
        ) {
            return;
        }


        let weaponName =
            data.weapon?.name ||
            data.weapon?.id ||
            "";


        if (
            data.grenade
        ) {

            weaponName =
                "HE";
        }


        if (
            !attacker
        ) {

            attacker =
                {
                    name:
                        "WORLD",

                    team:
                        null
                };
        }


        this.addKillFeed({
            attacker,

            victim,

            weapon:
                weaponName,

            headshot:
                Boolean(
                    data.headshot ||
                    data.hitZone ===
                        "head"
                )
        });
    }


    // ========================================================
    // Scoreboard
    // ========================================================

    showScoreboard() {

        this.scoreboardVisible =
            true;


        if (
            this.elements.scoreboard
        ) {

            this.elements
                .scoreboard
                .style.display =
                "block";
        }


        this.refreshScoreboard();
    }


    hideScoreboard() {

        this.scoreboardVisible =
            false;


        if (
            this.elements.scoreboard
        ) {

            this.elements
                .scoreboard
                .style.display =
                "none";
        }
    }


    toggleScoreboard() {

        if (
            this.scoreboardVisible
        ) {

            this.hideScoreboard();

        } else {

            this.showScoreboard();
        }
    }


    // ========================================================
    // Scoreboard refresh
    // ========================================================

    refreshScoreboard() {

        const ctBody =
            this.elements.scoreboardCT;


        const tBody =
            this.elements.scoreboardT;


        if (
            !ctBody ||
            !tBody
        ) {
            return;
        }


        ctBody.innerHTML = "";

        tBody.innerHTML = "";


        // ----------------------------------------------------
        // Player
        // ----------------------------------------------------

        if (
            this.player
        ) {

            const row =
                this._createScoreRow(
                    this.player,
                    true
                );


            if (
                this.player.team ===
                TEAM.CT
            ) {

                ctBody.appendChild(
                    row
                );

            } else {

                tBody.appendChild(
                    row
                );
            }
        }


        // ----------------------------------------------------
        // Bots
        // ----------------------------------------------------

        for (
            const bot
            of this.bots
        ) {

            const row =
                this._createScoreRow(
                    bot,
                    false
                );


            if (
                bot.team ===
                TEAM.CT
            ) {

                ctBody.appendChild(
                    row
                );

            } else {

                tBody.appendChild(
                    row
                );
            }
        }
    }


    _createScoreRow(
        entity,
        isPlayer
    ) {

        const row =
            document.createElement(
                "tr"
            );


        if (isPlayer) {

            row.classList.add(
                "is-me"
            );
        }


        const alive =
            entity.isAlive !==
            false;


        row.innerHTML =
            `
            <td>
                ${this._escapeHTML(
                    entity.name || "UNKNOWN"
                )}
            </td>

            <td>
                ${Number(
                    entity.kills || 0
                )}
            </td>

            <td>
                ${Number(
                    entity.deaths || 0
                )}
            </td>

            <td>
                ${Number(
                    entity.money || 0
                )}
            </td>

            <td>
                <span
                    class="${
                        alive
                            ? "status-alive"
                            : "status-dead"
                    }"
                >
                    ${
                        alive
                            ? "Alive"
                            : "Dead"
                    }
                </span>
            </td>
            `;


        return row;
    }


    // ========================================================
    // Helpers
    // ========================================================

    _getEntityName(entity) {

        if (!entity) {
            return "UNKNOWN";
        }


        return (
            entity.name ||
            "UNKNOWN"
        );
    }


    _getEntityColor(entity) {

        if (
            entity?.team ===
            TEAM.CT
        ) {

            return HUD_CONFIG
                .colors
                .CT;
        }


        if (
            entity?.team ===
            TEAM.T
        ) {

            return HUD_CONFIG
                .colors
                .T;
        }


        return "#dddddd";
    }


    _getWinnerText(winner) {

        if (
            winner === TEAM.CT ||
            winner === "ct" ||
            winner === "CT"
        ) {

            return "Counter-Terrorists Win!";
        }


        if (
            winner === TEAM.T ||
            winner === "t" ||
            winner === "T"
        ) {

            return "Terrorists Win!";
        }


        return "Round Draw!";
    }


    _getPurchaseFailureText(reason) {

        switch (reason) {

            case "NOT_ENOUGH_MONEY":

                return "Not enough money";


            case "BUY_TIME_EXPIRED":

                return "Buy time expired";


            case "NOT_IN_BUY_ZONE":

                return "You are not in a buy zone";


            case "TEAM_RESTRICTED":

                return "Weapon not available for your team";


            case "MAX_CARRY":

                return "You cannot carry any more";


            case "ALREADY_OWNED":

                return "You already own this item";


            default:

                return "Purchase failed";
        }
    }


    _escapeHTML(value) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        gameEvents.off(
            GAME_EVENT.PLAYER_SPAWN,
            this.handlers.playerSpawn
        );


        gameEvents.off(
            GAME_EVENT.PLAYER_DAMAGE,
            this.handlers.playerDamage
        );


        gameEvents.off(
            GAME_EVENT.PLAYER_DEATH,
            this.handlers.playerDeath
        );


        gameEvents.off(
            GAME_EVENT.PLAYER_DEATH,
            this.handlers.playerDeathFeed
        );


        gameEvents.off(
            "player:armor-changed",
            this.handlers.armorChanged
        );


        gameEvents.off(
            GAME_EVENT.MONEY_CHANGED,
            this.handlers.moneyChanged
        );


        gameEvents.off(
            "weapon:ammo-changed",
            this.handlers.ammoChanged
        );


        gameEvents.off(
            "weapon:equip",
            this.handlers.weaponEquip
        );


        gameEvents.off(
            "player:crouch",
            this.handlers.playerCrouch
        );


        gameEvents.off(
            GAME_EVENT.ROUND_FREEZE_START,
            this.handlers.freezeStart
        );


        gameEvents.off(
            GAME_EVENT.ROUND_START,
            this.handlers.roundStart
        );


        gameEvents.off(
            GAME_EVENT.ROUND_END,
            this.handlers.roundEnd
        );


        gameEvents.off(
            "round:timer-update",
            this.handlers.timerUpdate
        );


        gameEvents.off(
            GAME_EVENT.SCORE_CHANGED,
            this.handlers.scoreChanged
        );


        gameEvents.off(
            GAME_EVENT.PLAYER_KILL,
            this.handlers.playerKill
        );


        gameEvents.off(
            "bot:kill",
            this.handlers.botKill
        );


        gameEvents.off(
            GAME_EVENT.BOT_DEATH,
            this.handlers.botDeath
        );


        gameEvents.off(
            "grenade:kill",
            this.handlers.grenadeKill
        );


        gameEvents.off(
            "radio:message",
            this.handlers.radioMessage
        );


        gameEvents.off(
            "grenade:selected",
            this.handlers.grenadeSelected
        );


        gameEvents.off(
            "grenade:inventory-changed",
            this.handlers.grenadeInventoryChanged
        );


        gameEvents.off(
            "grenade:flash",
            this.handlers.grenadeFlash
        );


        gameEvents.off(
            "ui:buy-success",
            this.handlers.buySuccess
        );


        gameEvents.off(
            "ui:buy-failed",
            this.handlers.buyFailed
        );


        if (
            this.flashFadeTimer
        ) {

            window.clearTimeout(
                this.flashFadeTimer
            );

            this.flashFadeTimer =
                null;
        }


        if (
            this.flashHideTimer
        ) {

            window.clearTimeout(
                this.flashHideTimer
            );

            this.flashHideTimer =
                null;
        }


        this.elements
            .grenadeIndicator
            ?.remove?.();


        this.elements
            .flashOverlay
            ?.remove?.();


        this.elements.grenadeIndicator =
            null;

        this.elements.flashOverlay =
            null;


        this.stopDynamicCrosshair();


        for (
            const entry
            of this.killFeedEntries
        ) {

            entry.remove?.();
        }


        this.killFeedEntries.length =
            0;


        this.player = null;

        this.roundSystem = null;

        this.bots = [];

        this.initialized =
            false;
    }
}


// ============================================================
// 单例
// ============================================================

export const hud =
    new HUDSystem();

export default hud;