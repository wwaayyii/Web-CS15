/**
 * Web-CS15
 * src/ui/ui.js
 *
 * 非 HUD 界面系统
 *
 * 负责：
 * - Start / Pointer Lock Overlay
 * - Buy Menu
 * - Add Bot Menu
 * - Radio Menu 容器
 * - Pause / Menu 状态
 * - UI Button 事件
 *
 * 不负责：
 * - HP / Armor / Ammo HUD
 * - Round 胜负
 * - Weapon 射击
 * - Bot AI
 */

import {
    WEAPON_CONFIG,
    GRENADE_CONFIG,
    TEAM
} from "../core/config.js";

import {
    gameEvents
} from "../core/utils.js";

import {
    economy
} from "../systems/economy.js";

import {
    radio
} from "../systems/radio.js";


// ============================================================
// UISystem
// ============================================================

export class UISystem {

    constructor({
        player = null,
        controls = null,
        onAddBot = null,
        onClearBots = null,
        onMapSelect = null
    } = {}) {

        this.player =
            player;

        this.controls =
            controls;

        this.onAddBot =
            onAddBot;

        this.onClearBots =
            onClearBots;


        this.onMapSelect =
            onMapSelect;


        // ====================================================
        // DOM
        // ====================================================

        this.elements = {
            startOverlay: null,
            startButton: null,

            buyMenu: null,
            buyList: null,
            buyClose: null,
            buyTitle: null,

            botMenu: null,
            botList: null,
            botClose: null,

            radioMenu: null,
            radioMessage: null,
            radioHistory: null,

            pauseText: null,

            pauseOverlay: null,
            pauseResume: null,
            pauseRestartRound: null,
            pauseRestartMatch: null,
            pauseMainMenu: null,

            mapButtons: [],
            selectedMapLabel: null
        };


        // ====================================================
        // State
        // ====================================================

        this.initialized =
            false;

        this.buyMenuOpen =
            false;

        this.botMenuOpen =
            false;

        this.pointerLocked =
            false;

        this.pauseMenuOpen =
            false;

        this.gameplayStarted =
            false;


        /*
         * Pointer Lock Recovery
         *
         * ESC 是浏览器退出 Pointer Lock 的保留键。
         * 不能假设 ESC keydown 后立即 lock() 一定成功。
         */
        this.pointerLockResumePending =
            false;


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

        this.elements.startOverlay =
            root.getElementById(
                "start-overlay"
            );


        this.elements.startButton =
            root.getElementById(
                "start-button"
            );


        this.elements.buyMenu =
            root.getElementById(
                "buy-menu"
            );


        this.elements.buyList =
            root.getElementById(
                "buy-menu-list"
            );


        this.elements.buyClose =
            root.getElementById(
                "buy-menu-close"
            );


        this.elements.buyTitle =
            root.getElementById(
                "buy-menu-title"
            );


        this.elements.botMenu =
            root.getElementById(
                "add-bot-menu"
            );


        this.elements.botList =
            root.getElementById(
                "add-bot-list"
            );


        this.elements.botClose =
            root.getElementById(
                "add-bot-close"
            );


        this.elements.radioMenu =
            root.getElementById(
                "radio-menu"
            );


        this.elements.radioMessage =
            root.getElementById(
                "radio-message"
            );


        this.elements.radioHistory =
            root.getElementById(
                "radio-history"
            );


        this.elements.pauseText =
            root.getElementById(
                "pause-text"
            );


        this.elements.pauseOverlay =
            root.getElementById(
                "pause-overlay"
            );


        this.elements.pauseResume =
            root.getElementById(
                "pause-resume"
            );


        this.elements.pauseRestartRound =
            root.getElementById(
                "pause-restart-round"
            );


        this.elements.pauseRestartMatch =
            root.getElementById(
                "pause-restart-match"
            );


        this.elements.pauseMainMenu =
            root.getElementById(
                "pause-main-menu"
            );


        this.elements.mapButtons =
            [
                ...root.querySelectorAll(
                    "[data-map-name]"
                )
            ];


        this.elements.selectedMapLabel =
            root.getElementById(
                "selected-map-label"
            );


        this._bindDOMEvents();

        this._bindGameEvents();


        // ====================================================
        // Radio DOM
        // ====================================================

        radio.initDOM({
            menuElement:
                this.elements.radioMenu,

            messageElement:
                this.elements.radioMessage,

            historyElement:
                this.elements.radioHistory
        });


        this.renderBuyMenu();

        this.renderBotMenu();


        this.initialized =
            true;


        return this;
    }


    // ========================================================
    // Set refs
    // ========================================================

    setPlayer(player) {

        this.player =
            player;

        radio.setPlayer(
            player
        );


        if (
            this.initialized
        ) {

            this.renderBuyMenu();
        }
    }


    setControls(controls) {

        this.controls =
            controls;
    }


    setAddBotHandler(handler) {

        this.onAddBot =
            handler;
    }


    setClearBotsHandler(handler) {

        this.onClearBots =
            handler;
    }


    setMapSelectHandler(handler) {

        this.onMapSelect =
            handler;
    }


    // ========================================================
    // Handlers
    // ========================================================

    _createHandlers() {

        this.handlers.pointerLock =
            () => {

                this.pointerLocked =
                    Boolean(
                        document.pointerLockElement
                    );


                // ============================================
                // Pointer Lock restored
                // ============================================

                if (
                    this.pointerLocked
                ) {

                    this.pointerLockResumePending =
                        false;


                    this.hideStartOverlay();


                    /*
                     * Pause Menu 只有在 Pointer Lock
                     * 真正恢复成功以后才允许消失。
                     */
                    if (
                        this.pauseMenuOpen
                    ) {

                        this.hidePauseMenu();


                        gameEvents.emit(
                            "ui:resume-request"
                        );
                    }


                    return;
                }


                // ============================================
                // Pointer Lock lost
                // ============================================

                /*
                 * Buy / BOT / Radio 菜单主动释放鼠标，
                 * 这是正常行为，不弹 Pause Menu。
                 */
                if (
                    this.buyMenuOpen ||
                    this.botMenuOpen ||
                    radio.menuOpen
                ) {

                    return;
                }


                /*
                 * 游戏尚未开始：
                 * 显示 Main Menu。
                 */
                if (
                    !this.gameplayStarted
                ) {

                    this.showStartOverlay();

                    return;
                }


                /*
                 * 游戏已经开始，而 Pointer Lock 突然丢失：
                 * 通常就是玩家按了浏览器 ESC。
                 *
                 * 第一时间打开 Pause Menu，
                 * 不再依赖 ESC keydown 是否能被页面收到。
                 */
                if (
                    !this.pauseMenuOpen
                ) {

                    this.openPauseMenu({
                        releasePointer:
                            false
                    });
                }
            };

        this.handlers.buySuccess =
            data => {

                if (
                    data.buyer !==
                    this.player
                ) {
                    return;
                }


                this.showMenuStatus(
                    `Purchased ${data.itemId}`
                );
            };


        this.handlers.buyFailed =
            data => {

                if (
                    data.buyer !==
                    this.player
                ) {
                    return;
                }


                this.showMenuStatus(
                    this._getBuyErrorText(
                        data.result
                    )
                );
            };


        this.handlers.roundStart =
            () => {

                /*
                 * Freeze Time 结束进入 LIVE 时，
                 * 不主动关闭购买菜单。
                 *
                 * Buy Time 由 economy.js 独立计时，
                 * 玩家可以在 LIVE 开始后继续完成购买。
                 */
            };


        this.handlers.buyTimeEnded =
            () => {

                /*
                 * Buy Time 真正结束以后，
                 * 如果购买菜单仍然打开：
                 *
                 * 1. 自动关闭购买菜单
                 * 2. 自动把鼠标重新锁回游戏
                 *
                 * 不影响 BOT Menu / Radio Menu。
                 */
                if (
                    !this.buyMenuOpen
                ) {

                    return;
                }


                this.closeBuyMenu({
                    returnToGame:
                        true
                });
            };


        this.handlers.gameplayStarted =
            () => {

                this.gameplayStarted =
                    true;

                this.hideStartOverlay();
            };


        this.handlers.returnedToMenu =
            () => {

                this.gameplayStarted =
                    false;

                this.hidePauseMenu();

                this.showStartOverlay();
            };


        this.handlers.playerDeath =
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.closeAllMenus();
            };
    }


    // ========================================================
    // DOM events
    // ========================================================

    _bindDOMEvents() {

        // ----------------------------------------------------
        // Start button
        // ----------------------------------------------------

        this.elements.startButton
            ?.addEventListener(
                "click",
                async () => {

                    gameEvents.emit(
                        "ui:start-request"
                    );


                    if (
                        this.controls &&
                        typeof this.controls.lock ===
                            "function"
                    ) {

                        this.controls.lock();

                    } else {

                        document.body
                            .requestPointerLock
                            ?.();
                    }
                }
            );


        // ----------------------------------------------------
        // Map Select
        //
        // 地图按钮属于 Start UI，
        // 统一由 ui.js 负责 DOM click。
        // ----------------------------------------------------

        for (
            const button
            of this.elements.mapButtons
        ) {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    const mapName =
                        button.dataset
                            .mapName;


                    if (!mapName) {
                        return;
                    }


                    /*
                     * 先立即更新 UI，
                     * 确保用户点击后有视觉反馈。
                     */
                    this.setSelectedMapUI(
                        mapName
                    );


                    /*
                     * 再通知 game.js 真正切换地图。
                     */
                    this.onMapSelect?.(
                        mapName
                    );
                }
            );
        }


        // ----------------------------------------------------
        // Buy close
        // ----------------------------------------------------

        this.elements.buyClose
            ?.addEventListener(
                "click",
                () => {

                    this.closeBuyMenu();
                }
            );


        // ----------------------------------------------------
        // Bot close
        // ----------------------------------------------------

        this.elements.botClose
            ?.addEventListener(
                "click",
                () => {

                    this.closeBotMenu();
                }
            );


        this.elements.pauseResume
            ?.addEventListener(
                "click",
                () => {

                    this.resumeFromPause();
                }
            );


        this.elements.pauseRestartRound
            ?.addEventListener(
                "click",
                () => {

                    gameEvents.emit(
                        "ui:restart-round-request"
                    );
                }
            );


        this.elements.pauseRestartMatch
            ?.addEventListener(
                "click",
                () => {

                    gameEvents.emit(
                        "ui:restart-match-request"
                    );
                }
            );


        this.elements.pauseMainMenu
            ?.addEventListener(
                "click",
                () => {

                    gameEvents.emit(
                        "ui:main-menu-request"
                    );
                }
            );


        document.addEventListener(
            "pointerlockchange",
            this.handlers.pointerLock
        );
    }


    // ========================================================
    // Game events
    // ========================================================

    _bindGameEvents() {

        gameEvents.on(
            "ui:buy-success",
            this.handlers.buySuccess
        );


        gameEvents.on(
            "ui:buy-failed",
            this.handlers.buyFailed
        );


        gameEvents.on(
            "round:start",
            this.handlers.roundStart
        );


        gameEvents.on(
            "economy:buy-time-ended",
            this.handlers.buyTimeEnded
        );


        gameEvents.on(
            "game:gameplay-started",
            this.handlers.gameplayStarted
        );


        gameEvents.on(
            "game:returned-to-menu",
            this.handlers.returnedToMenu
        );


        gameEvents.on(
            "player:death",
            this.handlers.playerDeath
        );
    }


    // ========================================================
    // Keyboard handling
    //
    // game.js 可优先交给 UI。
    //
    // true = 已消费
    // ========================================================

    handleKeyDown(event) {

		if (!event) {
			return false;
		}


		const code =
			event.code;


		// ========================================================
		// BOT 菜单专用快捷键
		//
		// 菜单开启时：
		// 1 = CT
		// 2 = T
		//
		// 必须放在普通武器切换逻辑之前。
		// ========================================================

		if (
			this.botMenuOpen
		) {

			if (
				code === "Digit1" ||
				code === "Numpad1"
			) {

				this.onAddBot?.(
					TEAM.CT
				);

				return true;
			}


			if (
				code === "Digit2" ||
				code === "Numpad2"
			) {

				this.onAddBot?.(
					TEAM.T
				);

				return true;
			}


			if (
				code === "Escape"
			) {

				this.closeBotMenu();

				return true;
			}
		}


		// ========================================================
		// Buy Ammo
		//
		// ,  = 手枪 / Secondary Ammo
		// .  = 主武器 / Primary Ammo
		// ========================================================

		if (
			code === "Comma"
		) {

			if (
				!this.player ||
				this.player.isAlive === false
			) {

				return true;
			}


			economy.buySecondaryAmmo(
				this.player
			);


			return true;
		}


		if (
			code === "Period"
		) {

			if (
				!this.player ||
				this.player.isAlive === false
			) {

				return true;
			}


			economy.buyPrimaryAmmo(
				this.player
			);


			return true;
		}


		// ========================================================
		// ESC
		// ========================================================

		if (
			code === "Escape"
		) {

			if (
				this.buyMenuOpen ||
				this.botMenuOpen ||
				radio.menuOpen
			) {

				/*
				 * ESC 先关闭当前菜单。
				 *
				 * 然后尝试恢复 Pointer Lock。
				 * 如果 Chrome 因 ESC 安全策略拒绝，
				 * requestGameFocusWithFallback()
				 * 会自动显示 Pause Menu，
				 * 不会留下“无菜单 + 无法控制”的死状态。
				 */
				this.closeAllMenus({
					returnToGame:
						false
				});


				this.requestGameFocusWithFallback();


				return true;
			}


			if (
				this.pauseMenuOpen
			) {

				/*
				 * ESC 可以尝试 Resume，
				 * 但 Pause Menu 不会立即隐藏。
				 *
				 * 只有 pointerlockchange 确认锁定成功，
				 * Pause Menu 才真正消失。
				 */
				this.resumeFromPause();

				return true;
			}


			/*
			 * Pointer Lock 状态下的第一次 ESC
			 * 很可能被浏览器优先消费。
			 *
			 * 真正的 Pause 打开由 pointerlockchange
			 * 负责，这里只作为 fallback。
			 */
			if (
				this.gameplayStarted &&
				!document.pointerLockElement
			) {

				this.openPauseMenu({
					releasePointer:
						false
				});

				return true;
			}


			return false;
		}


		// ========================================================
		// Buy Menu
		// ========================================================

		if (
			code === "KeyB"
		) {

			this.toggleBuyMenu();

			return true;
		}


		// ========================================================
		// Add Bot Menu
		// ========================================================

		if (
			code === "Equal"
		) {

			this.toggleBotMenu();

			return true;
		}


		// ========================================================
		// Clear Bots
		// ========================================================

		if (
			code === "Minus"
		) {

			this.onClearBots?.();

			return true;
		}


		// ========================================================
		// Radio
		// ========================================================

		if (
			radio.handleKeyDown(
				event
			)
		) {

			return true;
		}


		return false;
	}


    // ========================================================
    // Map Select UI
    // ========================================================

    setSelectedMapUI(
        mapName
    ) {

        for (
            const button
            of this.elements.mapButtons
        ) {

            const selected =
                button.dataset
                    .mapName ===
                mapName;


            button.dataset.selected =
                selected
                    ? "true"
                    : "false";


            button.classList.toggle(
                "map-select-button-active",
                selected
            );


            button.setAttribute(
                "aria-pressed",
                selected
                    ? "true"
                    : "false"
            );
        }


        if (
            this.elements
                .selectedMapLabel
        ) {

            this.elements.selectedMapLabel.textContent =
                mapName === "aim_arena_web"
                    ? "AIM ARENA"
                    : mapName === "de_sandstorm"
                        ? "DE SANDSTORM"
                        : "ICEWORLD";
        }
    }


    // ========================================================
    // Start Overlay
    // ========================================================

    showStartOverlay() {

        if (
            !this.elements
                .startOverlay
        ) {
            return;
        }


        /*
         * 如果某个菜单正在打开，
         * 不显示大遮罩。
         */
        if (
            this.buyMenuOpen ||
            this.botMenuOpen
        ) {
            return;
        }


        this.elements
            .startOverlay
            .style.display =
            "flex";


        this._setPauseText(
            "CLICK TO PLAY"
        );
    }


    hideStartOverlay() {

        if (
            this.elements
                .startOverlay
        ) {

            this.elements
                .startOverlay
                .style.display =
                "none";
        }


        this._setPauseText(
            ""
        );
    }


    _setPauseText(text) {

        if (
            this.elements.pauseText
        ) {

            this.elements
                .pauseText
                .textContent =
                text || "";
        }
    }


    // ========================================================
    // Pause Menu V2
    // ========================================================

    openPauseMenu({
        releasePointer = true
    } = {}) {

        if (
            !this.gameplayStarted ||
            this.pauseMenuOpen
        ) {

            return false;
        }


        this.closeAllMenus({
            returnToGame:
                false
        });


        this.pauseMenuOpen =
            true;


        this.pointerLockResumePending =
            false;


        if (
            this.elements.pauseOverlay
        ) {

            this.elements
                .pauseOverlay
                .style.display =
                "flex";
        }


        this.hideStartOverlay();


        gameEvents.emit(
            "ui:pause-request"
        );


        if (
            releasePointer &&
            document.pointerLockElement
        ) {

            document.exitPointerLock?.();
        }


        return true;
    }


    hidePauseMenu() {

        this.pauseMenuOpen =
            false;


        this.pointerLockResumePending =
            false;


        if (
            this.elements.pauseOverlay
        ) {

            this.elements
                .pauseOverlay
                .style.display =
                "none";
        }
    }


    resumeFromPause() {

        if (
            !this.pauseMenuOpen
        ) {

            return false;
        }


        /*
         * 重要：
         *
         * 不要先 hidePauseMenu()。
         *
         * Chrome 有可能拒绝由 ESC 触发的
         * requestPointerLock()。
         *
         * 菜单保持显示，
         * 等 pointerlockchange 真正确认锁定成功后
         * 再自动隐藏。
         */
        this.pointerLockResumePending =
            true;


        this.requestGameFocus();


        return true;
    }


    // ========================================================
    // Pointer Lock Recovery
    // ========================================================

    requestGameFocusWithFallback() {

        if (
            !this.gameplayStarted ||
            !this.player?.isAlive
        ) {

            return false;
        }


        this.pointerLockResumePending =
            true;


        this.requestGameFocus();


        /*
         * ESC 触发 requestPointerLock()
         * 某些 Chrome 版本会直接拒绝，
         * 而且不一定抛出异常。
         *
         * 稍后检查真实状态。
         */
        window.setTimeout(
            () => {

                if (
                    document.pointerLockElement
                ) {

                    this.pointerLockResumePending =
                        false;

                    return;
                }


                this.pointerLockResumePending =
                    false;


                /*
                 * 没锁成功就显示 Pause Menu，
                 * 让玩家点击 RESUME GAME。
                 */
                if (
                    this.gameplayStarted &&
                    !this.pauseMenuOpen
                ) {

                    this.openPauseMenu({
                        releasePointer:
                            false
                    });
                }

            },
            120
        );


        return true;
    }


    // ========================================================
    // Buy Menu
    // ========================================================

    openBuyMenu() {

		if (
			!this.player ||
			this.player.isAlive === false
		) {

			return false;
		}


		/*
		 * 切换菜单时不要重新锁鼠标。
		 */
		this.closeBotMenu({
			returnToGame: false
		});

		radio.closeMenu();


		/*
		 * 每次打开购买菜单都按当前玩家阵营重新生成。
		 */
		this.renderBuyMenu();


		this.buyMenuOpen =
			true;


		if (
			this.elements.buyMenu
		) {

			this.elements
				.buyMenu
				.style.display =
				"block";
		}


		this._unlockPointerForMenu();


		gameEvents.emit(
			"ui:buy-menu-open"
		);


		return true;
	}


    closeBuyMenu({
		returnToGame = true
	} = {}) {

		const wasOpen =
			this.buyMenuOpen;

		this.buyMenuOpen =
			false;


		if (
			this.elements.buyMenu
		) {

			this.elements
				.buyMenu
				.style.display =
				"none";
		}


		gameEvents.emit(
			"ui:buy-menu-close"
		);


		/*
		 * 关闭购买菜单后重新进入第一人称控制。
		 *
		 * setTimeout 是为了让当前鼠标 click
		 * 先结束，否则浏览器有时不会立即接受 lock()。
		 */
		if (
			wasOpen &&
			returnToGame &&
			!this.botMenuOpen &&
			!radio.menuOpen &&
			this.player?.isAlive
		) {

			window.setTimeout(
				() => {

					this.requestGameFocus();

				},
				0
			);
		}
	}


    toggleBuyMenu() {

        if (
            this.buyMenuOpen
        ) {

            this.closeBuyMenu();

            return false;
        }


        return this.openBuyMenu();
    }


    // ========================================================
    // Buy Menu Render
    // ========================================================

    renderBuyMenu() {

        const container =
            this.elements.buyList;


        if (!container) {
            return;
        }


        const playerTeam =
            this.player?.team ||
            TEAM.CT;


        const teamLabel =
            playerTeam === TEAM.T
                ? "TERRORIST"
                : "COUNTER-TERRORIST";


        if (
            this.elements.buyTitle
        ) {

            this.elements
                .buyTitle
                .textContent =
                `${teamLabel} BUY MENU`;
        }


        const weaponEntries =
            Object.values(
                WEAPON_CONFIG
            )
            .filter(
                item =>
                    item.price != null &&
                    item.price > 0 &&
                    (
                        !item.team ||
                        item.team ===
                            playerTeam
                    )
            );


        const primary =
            weaponEntries.filter(
                item =>
                    item.slot ===
                    "primary"
            );


        const secondary =
            weaponEntries.filter(
                item =>
                    item.slot ===
                    "secondary"
            );


        const renderWeaponList =
            entries =>
                entries
                    .map(
                        item => `
                        <button
                            class="buy-item"
                            data-buy-id="${this._escapeHTML(
                                item.id
                            )}"
                        >
                            <span class="buy-item-name">
                                ${this._escapeHTML(
                                    item.name
                                )}
                            </span>

                            <span class="buy-item-team">
                                ${
                                    item.team
                                        ? teamLabel
                                        : "ALL"
                                }
                            </span>

                            <span class="buy-item-price">
                                $${item.price}
                            </span>
                        </button>
                        `
                    )
                    .join("");


        const grenadeHTML =
            Object.values(
                GRENADE_CONFIG
            )
                .map(
                    item => `
                    <button
                        class="buy-item"
                        data-buy-id="${this._escapeHTML(
                            item.id
                        )}"
                    >
                        <span class="buy-item-name">
                            ${this._escapeHTML(
                                item.name
                            )}
                        </span>

                        <span class="buy-item-team">
                            GRENADE
                        </span>

                        <span class="buy-item-price">
                            $${item.price}
                        </span>
                    </button>
                    `
                )
                .join("");


        container.innerHTML =
            `
            <div class="buy-team-banner ${
                playerTeam === TEAM.T
                    ? "buy-team-t"
                    : "buy-team-ct"
            }">
                ${teamLabel}
            </div>

            <div class="buy-section">
                <div class="buy-section-title">
                    PRIMARY
                </div>

                ${renderWeaponList(
                    primary
                )}
            </div>

            <div class="buy-section">
                <div class="buy-section-title">
                    SECONDARY
                </div>

                ${renderWeaponList(
                    secondary
                )}
            </div>

            <div class="buy-section">
                <div class="buy-section-title">
                    AMMUNITION
                </div>

                <button
                    class="buy-item"
                    data-buy-action="secondary-ammo"
                >
                    <span class="buy-item-name">
                        Secondary Ammo
                    </span>

                    <span class="buy-item-team">
                        ,
                    </span>

                    <span class="buy-item-price">
                        $30+
                    </span>
                </button>

                <button
                    class="buy-item"
                    data-buy-action="primary-ammo"
                >
                    <span class="buy-item-name">
                        Primary Ammo
                    </span>

                    <span class="buy-item-team">
                        .
                    </span>

                    <span class="buy-item-price">
                        $60+
                    </span>
                </button>
            </div>

            <div class="buy-section">
                <div class="buy-section-title">
                    EQUIPMENT
                </div>

                <button
                    class="buy-item"
                    data-buy-id="armor"
                >
                    <span class="buy-item-name">
                        Kevlar
                    </span>

                    <span class="buy-item-team">
                        ALL
                    </span>

                    <span class="buy-item-price">
                        $650
                    </span>
                </button>

                <button
                    class="buy-item"
                    data-buy-id="helmet"
                >
                    <span class="buy-item-name">
                        Kevlar + Helmet
                    </span>

                    <span class="buy-item-team">
                        ALL
                    </span>

                    <span class="buy-item-price">
                        $1000
                    </span>
                </button>
            </div>

            <div class="buy-section">
                <div class="buy-section-title">
                    GRENADES
                </div>

                ${grenadeHTML}
            </div>

            <div
                id="buy-menu-status"
                class="buy-menu-status"
            ></div>
            `;


        container
            .querySelectorAll(
                "[data-buy-id]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.purchaseItem(
                                button.dataset
                                    .buyId
                            );
                        }
                    );
                }
            );


        container
            .querySelector(
                "[data-buy-action='secondary-ammo']"
            )
            ?.addEventListener(
                "click",
                () => {

                    economy.buySecondaryAmmo(
                        this.player
                    );
                }
            );


        container
            .querySelector(
                "[data-buy-action='primary-ammo']"
            )
            ?.addEventListener(
                "click",
                () => {

                    economy.buyPrimaryAmmo(
                        this.player
                    );
                }
            );
    }


    // ========================================================
    // Purchase
    // ========================================================

    purchaseItem(itemId) {

        if (
            !this.player ||
            !itemId
        ) {
            return null;
        }


        return economy.buy(
            this.player,
            itemId
        );
    }


    // ========================================================
    // Menu Status
    // ========================================================

    showMenuStatus(
        text,
        duration = 1200
    ) {

        const element =
            document.getElementById(
                "buy-menu-status"
            );


        if (!element) {
            return;
        }


        element.textContent =
            text || "";


        window.setTimeout(
            () => {

                if (
                    element.textContent ===
                    text
                ) {

                    element.textContent =
                        "";
                }

            },
            duration
        );
    }


    // ========================================================
    // Bot Menu
    // ========================================================

    openBotMenu() {

		this.closeBuyMenu({
			returnToGame: false
		});

		radio.closeMenu();


		this.botMenuOpen =
			true;


		if (
			this.elements.botMenu
		) {

			this.elements
				.botMenu
				.style.display =
				"block";
		}


		this._unlockPointerForMenu();


		gameEvents.emit(
			"ui:bot-menu-open"
		);


		return true;
	}


    closeBotMenu({
		returnToGame = true
	} = {}) {

		const wasOpen =
			this.botMenuOpen;

		this.botMenuOpen =
			false;


		if (
			this.elements.botMenu
		) {

			this.elements
				.botMenu
				.style.display =
				"none";
		}


		gameEvents.emit(
			"ui:bot-menu-close"
		);


		if (
			wasOpen &&
			returnToGame &&
			!this.buyMenuOpen &&
			!radio.menuOpen &&
			this.player?.isAlive
		) {

			window.setTimeout(
				() => {

					this.requestGameFocus();

				},
				0
			);
		}
	}


    toggleBotMenu() {

        if (
            this.botMenuOpen
        ) {

            this.closeBotMenu();

            return false;
        }


        return this.openBotMenu();
    }


    // ========================================================
    // Render Bot Menu
    // ========================================================

    renderBotMenu() {

		const container =
			this.elements.botList;


		if (!container) {
			return;
		}


		container.innerHTML =
			`
			<button
				class="bot-menu-item"
				data-bot-team="ct"
			>
				<span class="bot-menu-key">
					1.
				</span>

				Add Counter-Terrorist BOT
			</button>


			<button
				class="bot-menu-item"
				data-bot-team="t"
			>
				<span class="bot-menu-key">
					2.
				</span>

				Add Terrorist BOT
			</button>


			<button
				class="bot-menu-item"
				data-bot-action="clear"
			>
				Clear All BOTs
			</button>
			`;


		const teamButtons =
			container.querySelectorAll(
				"[data-bot-team]"
			);


		teamButtons.forEach(
			button => {

				button.addEventListener(
					"click",
					() => {

						const team =
							button.dataset
								.botTeam === "ct"
								? TEAM.CT
								: TEAM.T;


						this.onAddBot?.(
							team
						);
					}
				);
			}
		);


		container
			.querySelector(
				"[data-bot-action='clear']"
			)
			?.addEventListener(
				"click",
				() => {

					this.onClearBots?.();
				}
			);
	}


    // ========================================================
    // Close All
    // ========================================================

    closeAllMenus({
		returnToGame = true
	} = {}) {

		const hadMenuOpen =
			this.buyMenuOpen ||
			this.botMenuOpen ||
			radio.menuOpen;


		/*
		 * 这里关闭单个菜单时，
		 * 先禁止它们各自重新锁鼠标，
		 * 最后统一处理一次。
		 */
		this.closeBuyMenu({
			returnToGame: false
		});


		this.closeBotMenu({
			returnToGame: false
		});


		radio.closeMenu();


		if (
			hadMenuOpen &&
			returnToGame &&
			this.player?.isAlive
		) {

			window.setTimeout(
				() => {

					this.requestGameFocus();

				},
				0
			);
		}
	}


    // ========================================================
    // Menu state
    // ========================================================

    get anyMenuOpen() {

        return (
            this.buyMenuOpen ||
            this.botMenuOpen ||
            this.pauseMenuOpen ||
            radio.menuOpen
        );
    }


    // ========================================================
    // Pointer Lock
    // ========================================================

    _unlockPointerForMenu() {

        if (
            document.pointerLockElement
        ) {

            document.exitPointerLock?.();
        }
    }


    requestGameFocus() {

        /*
         * Buy / BOT / Radio 菜单打开时不能锁鼠标。
         *
         * Pause Menu 是例外：
         * RESUME GAME 本身就需要在 Pause Menu
         * 仍显示时请求 Pointer Lock。
         */
        if (
            this.buyMenuOpen ||
            this.botMenuOpen ||
            radio.menuOpen
        ) {

            return false;
        }


        if (
            this.controls &&
            typeof this.controls.lock ===
                "function"
        ) {

            this.controls.lock();

        } else {

            document.body
                .requestPointerLock
                ?.();
        }


        return true;
    }


    // ========================================================
    // Purchase errors
    // ========================================================

    _getBuyErrorText(reason) {

        switch (reason) {

            case "NOT_ENOUGH_MONEY":
                return "Not enough money";


            case "BUY_TIME_EXPIRED":
                return "Buy time expired";


            case "NOT_IN_BUY_ZONE":
                return "You are not in a buy zone";


            case "TEAM_RESTRICTED":
                return "Not available for your team";


            case "MAX_CARRY":
                return "Maximum carry reached";


            case "ALREADY_OWNED":
                return "Already owned";


            case "DEAD":
                return "You cannot buy while dead";


            default:
                return "Purchase failed";
        }
    }


    // ========================================================
    // Escape HTML
    // ========================================================

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

        document.removeEventListener(
            "pointerlockchange",
            this.handlers.pointerLock
        );


        gameEvents.off(
            "ui:buy-success",
            this.handlers.buySuccess
        );


        gameEvents.off(
            "ui:buy-failed",
            this.handlers.buyFailed
        );


        gameEvents.off(
            "round:start",
            this.handlers.roundStart
        );


        gameEvents.off(
            "economy:buy-time-ended",
            this.handlers.buyTimeEnded
        );


        gameEvents.off(
            "game:gameplay-started",
            this.handlers.gameplayStarted
        );


        gameEvents.off(
            "game:returned-to-menu",
            this.handlers.returnedToMenu
        );


        gameEvents.off(
            "player:death",
            this.handlers.playerDeath
        );


        this.player = null;

        this.controls = null;

        this.onAddBot = null;

        this.onClearBots = null;

        this.onMapSelect = null;

        this.elements.mapButtons = [];

        this.elements.selectedMapLabel = null;

        this.initialized =
            false;
    }
}


// ============================================================
// 单例
// ============================================================

export const ui =
    new UISystem();

export default ui;
