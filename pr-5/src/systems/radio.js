/**
 * Web-CS15
 * src/systems/radio.js
 *
 * Radio 系统
 *
 * 负责：
 * - Z / X / C Radio 菜单
 * - 数字键选择
 * - 玩家 Radio
 * - BOT Radio
 * - Grenade 自动 Radio
 * - Radio HUD
 * - Radio 消息历史
 * - 防刷屏
 *
 * 不负责：
 * - TTS / Radio Beep 音频生成
 *   由 audio.js 负责
 */

import {
    RADIO_CONFIG,
    TEAM,
    GAME_EVENT
} from "../core/config.js";

import {
    Cooldown,
    randomRange,
    gameEvents
} from "../core/utils.js";


// ============================================================
// Radio group
// ============================================================

export const RADIO_GROUP = Object.freeze({
    Z: "z",
    X: "x",
    C: "c"
});


// ============================================================
// RadioSystem
// ============================================================

export class RadioSystem {

    constructor({
        player = null,

        menuElement = null,

        messageElement = null,

        historyElement = null
    } = {}) {

        this.player =
            player;


        // ====================================================
        // DOM
        // ====================================================

        this.menuElement =
            menuElement;

        this.messageElement =
            messageElement;

        this.historyElement =
            historyElement;


        // ====================================================
        // State
        // ====================================================

        this.enabled =
            RADIO_CONFIG.enabled;

        this.menuOpen =
            false;

        this.activeGroup =
            null;

        this.messageTimer =
            null;


        // ====================================================
        // Global spam protection
        // ====================================================

        this.globalCooldown =
            new Cooldown(
                RADIO_CONFIG
                    .globalCooldown
            );


        // ====================================================
        // History
        // ====================================================

        this.history = [];

        this.maxHistory = 20;


        // ====================================================
        // Event handlers
        // ====================================================

        this._boundRadioSend =
            data =>
                this._onRadioSend(
                    data
                );


        this._boundGrenadeThrow =
            data =>
                this._onGrenadeThrow(
                    data
                );


        this._boundRoundEnd =
            data =>
                this._onRoundEnd(
                    data
                );


        this._bindEvents();
    }


    // ========================================================
    // Init DOM
    // ========================================================

    initDOM({
        menuElement = null,
        messageElement = null,
        historyElement = null
    } = {}) {

        if (menuElement) {
            this.menuElement =
                menuElement;
        }


        if (messageElement) {
            this.messageElement =
                messageElement;
        }


        if (historyElement) {
            this.historyElement =
                historyElement;
        }


        this.renderMenu();

        return this;
    }


    // ========================================================
    // Events
    // ========================================================

    _bindEvents() {

        gameEvents.on(
            GAME_EVENT.RADIO_SEND,
            this._boundRadioSend
        );


        gameEvents.on(
            GAME_EVENT.GRENADE_THROW,
            this._boundGrenadeThrow
        );


        gameEvents.on(
            GAME_EVENT.ROUND_END,
            this._boundRoundEnd
        );
    }


    // ========================================================
    // Enable
    // ========================================================

    setEnabled(enabled) {

        this.enabled =
            Boolean(enabled);


        if (!this.enabled) {

            this.closeMenu();

            this.hideMessage();
        }
    }


    // ========================================================
    // Set player
    // ========================================================

    setPlayer(player) {

        this.player =
            player;
    }


    // ========================================================
    // Open menu
    // ========================================================

    openGroup(group) {

        if (!this.enabled) {
            return false;
        }


        if (
            !RADIO_CONFIG.groups[group]
        ) {

            return false;
        }


        this.activeGroup =
            group;

        this.menuOpen =
            true;


        this.renderMenu();

        this._showMenuElement();


        gameEvents.emit(
            "radio:menu-open",
            {
                group
            }
        );


        return true;
    }


    // ========================================================
    // Z / X / C
    // ========================================================

    openRadio1() {

        return this.openGroup(
            RADIO_GROUP.Z
        );
    }


    openRadio2() {

        return this.openGroup(
            RADIO_GROUP.X
        );
    }


    openRadio3() {

        return this.openGroup(
            RADIO_GROUP.C
        );
    }


    // ========================================================
    // Close
    // ========================================================

    closeMenu() {

        this.menuOpen =
            false;

        this.activeGroup =
            null;


        if (
            this.menuElement
        ) {

            this.menuElement.style.display =
                "none";
        }


        gameEvents.emit(
            "radio:menu-close"
        );
    }


    // ========================================================
    // Toggle
    // ========================================================

    toggleGroup(group) {

        if (
            this.menuOpen &&
            this.activeGroup ===
            group
        ) {

            this.closeMenu();

            return false;
        }


        return this.openGroup(
            group
        );
    }


    // ========================================================
    // Input
    //
    // game.js 可以先把 keyboard event
    // 交给这里。
    //
    // 返回 true = Radio 已经消费这个输入。
    // ========================================================

    handleKeyDown(event) {

        if (
            !this.enabled ||
            !event
        ) {

            return false;
        }


        const code =
            event.code;


        // ----------------------------------------------------
        // Z / X / C
        // ----------------------------------------------------

        if (
            !this.menuOpen
        ) {

            if (
                code ===
                RADIO_CONFIG.keys
                    .group1
            ) {

                this.openRadio1();

                return true;
            }


            if (
                code ===
                RADIO_CONFIG.keys
                    .group2
            ) {

                this.openRadio2();

                return true;
            }


            if (
                code ===
                RADIO_CONFIG.keys
                    .group3
            ) {

                this.openRadio3();

                return true;
            }


            return false;
        }


        // ----------------------------------------------------
        // Menu 已开启
        // ----------------------------------------------------

        if (
            code === "Escape" ||
            code === "Digit0"
        ) {

            this.closeMenu();

            return true;
        }


        const digitMatch =
            code.match(
                /^Digit([1-9])$/
            );


        if (
            digitMatch
        ) {

            const number =
                Number(
                    digitMatch[1]
                );


            this.selectCommand(
                number - 1
            );


            return true;
        }


        return false;
    }


    // ========================================================
    // Select command
    // ========================================================

    selectCommand(index) {

        if (
            !this.menuOpen ||
            !this.activeGroup
        ) {

            return false;
        }


        const group =
            RADIO_CONFIG.groups[
                this.activeGroup
            ];


        if (
            !group ||
            index < 0 ||
            index >=
                group.commands.length
        ) {

            this.closeMenu();

            return false;
        }


        const command =
            group.commands[index];


        this.closeMenu();


        return this.sendPlayerRadio(
            command
        );
    }


    // ========================================================
    // Player Radio
    // ========================================================

    sendPlayerRadio(command) {

        if (
            !this.enabled ||
            !this.player ||
            !command
        ) {

            return false;
        }


        if (
            !this.globalCooldown
                .tryTrigger()
        ) {

            return false;
        }


        gameEvents.emit(
            GAME_EVENT.RADIO_SEND,
            {
                speaker:
                    this.player,

                owner:
                    this.player,

                text:
                    command,

                command,

                team:
                    this.player.team,

                source:
                    "player",

                event:
                    "manual"
            }
        );


        return true;
    }


    // ========================================================
    // System/BOT helper
    // ========================================================

    send({
        speaker,
        command,
        text = null,
        source = "system",
        event = null,
        team = null,
        playVoice = true,
        playStartBeep = true,
        playEndBeep = true
    } = {}) {

        const message =
            text ||
            command;


        if (!message) {
            return false;
        }


        gameEvents.emit(
            GAME_EVENT.RADIO_SEND,
            {
                speaker,

                owner:
                    speaker,

                command:
                    message,

                text:
                    message,

                team:
                    team ||
                    speaker?.team ||
                    null,

                source,

                event,

                playVoice,

                playStartBeep,

                playEndBeep
            }
        );


        return true;
    }


    // ========================================================
    // Radio send event
    // ========================================================

    _onRadioSend(data = {}) {

        if (!this.enabled) {
            return;
        }


        const command =
            data.command ||
            data.text;


        if (!command) {
            return;
        }


        const speaker =
            data.speaker ||
            data.owner;


        const speakerName =
            this._getSpeakerName(
                speaker,
                data.source
            );


        const team =
            data.team ||
            speaker?.team ||
            null;


        const color =
            this._getTeamColor(
                team,
                data.source
            );


        // ----------------------------------------------------
        // HUD
        // ----------------------------------------------------

        this.showMessage({
            speaker:
                speakerName,

            command,

            color
        });


        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        this.addHistory({
            speaker:
                speakerName,

            command,

            team,

            color,

            source:
                data.source,

            event:
                data.event
        });


        // ----------------------------------------------------
        // Audio
        //
        // audio.js 已监听 radio:voice
        // ----------------------------------------------------

        if (
            data.playVoice !==
            false
        ) {

            gameEvents.emit(
                "radio:voice",
                {
                    text:
                        command,

                    speaker,

                    source:
                        data.source,

                    cancelPrevious:
                        data.cancelPrevious ??
                        true,

                    playStartBeep:
                        data.playStartBeep ??
                        true,

                    playEndBeep:
                        data.playEndBeep ??
                        true
                }
            );
        }


        gameEvents.emit(
            "radio:message",
            {
                speaker,
                speakerName,
                command,
                team,
                color,
                source:
                    data.source,
                event:
                    data.event
            }
        );
    }


    // ========================================================
    // Grenade -> Fire in the hole
    // ========================================================

    _onGrenadeThrow(data = {}) {

        if (!this.enabled) {
            return;
        }


        const owner =
            data.owner;


        if (!owner) {
            return;
        }


        const command =
            data.radioCallout ||
            "Fire in the hole!";


        /*
         * grenade:throw 不能再次 emit grenade:throw。
         * 这里只 emit radio:send。
         */


        gameEvents.emit(
            GAME_EVENT.RADIO_SEND,
            {
                speaker:
                    owner,

                owner,

                command,

                text:
                    command,

                team:
                    owner.team,

                source:
                    owner === this.player
                        ? "player-auto"
                        : "bot",

                event:
                    "grenade",

                playVoice:
                    true,

                playStartBeep:
                    true,

                playEndBeep:
                    true
            }
        );
    }


    // ========================================================
    // Round End
    //
    // 注意：
    // audio.js 已经监听 round:end 并播放
    // Counter-Terrorists win 等系统播报。
    //
    // 所以这里默认只负责 HUD，
    // 不再重复 TTS。
    // ========================================================

    _onRoundEnd(data = {}) {

        if (!this.enabled) {
            return;
        }


        let text = null;

        let color =
            RADIO_CONFIG.colors
                .announcer;


        switch (
            data.winner
        ) {

            case TEAM.CT:
            case "CT":
            case "ct":

                text =
                    "Counter-Terrorists win!";

                color =
                    RADIO_CONFIG.colors
                        .CT;

                break;


            case TEAM.T:
            case "T":
            case "t":

                text =
                    "Terrorists win!";

                color =
                    RADIO_CONFIG.colors
                        .T;

                break;


            case "draw":
            case "DRAW":

                text =
                    "Round draw!";

                break;


            default:

                if (
                    data.text
                ) {

                    text =
                        data.text;
                }
        }


        if (!text) {
            return;
        }


        this.showMessage({
            speaker:
                "ANNOUNCER",

            command:
                text,

            color
        });


        this.addHistory({
            speaker:
                "ANNOUNCER",

            command:
                text,

            team:
                null,

            color,

            source:
                "announcer",

            event:
                "round-end"
        });
    }


    // ========================================================
    // HUD Message
    // ========================================================

    showMessage({
        speaker,
        command,
        color =
            RADIO_CONFIG.colors.system
    } = {}) {

        if (
            !this.messageElement
        ) {
            return;
        }


        this.messageElement.innerHTML =
            `
            <span
                style="color:${color}"
            >
                (RADIO) ${this._escapeHTML(
                    speaker
                )}:
            </span>
            ${this._escapeHTML(
                command
            )}
            `;


        this.messageElement.style.display =
            "block";


        if (
            this.messageTimer
        ) {

            clearTimeout(
                this.messageTimer
            );
        }


        this.messageTimer =
            window.setTimeout(
                () => {

                    this.hideMessage();

                },
                RADIO_CONFIG
                    .displayTime
            );
    }


    hideMessage() {

        if (
            this.messageElement
        ) {

            this.messageElement.style.display =
                "none";
        }


        if (
            this.messageTimer
        ) {

            clearTimeout(
                this.messageTimer
            );

            this.messageTimer =
                null;
        }
    }


    // ========================================================
    // History
    // ========================================================

    addHistory(entry) {

        const record = {
            ...entry,

            time:
                performance.now()
        };


        this.history.push(
            record
        );


        while (
            this.history.length >
            this.maxHistory
        ) {

            this.history.shift();
        }


        this.renderHistory();
    }


    clearHistory() {

        this.history.length =
            0;


        this.renderHistory();
    }


    renderHistory() {

        if (
            !this.historyElement
        ) {
            return;
        }


        const recent =
            this.history.slice(
                -6
            );


        this.historyElement.innerHTML =
            recent
                .map(
                    entry => {

                        return `
                        <div class="radio-history-item">
                            <span
                                style="color:${entry.color}"
                            >
                                (RADIO)
                                ${this._escapeHTML(
                                    entry.speaker
                                )}:
                            </span>

                            <span>
                                ${this._escapeHTML(
                                    entry.command
                                )}
                            </span>
                        </div>
                        `;
                    }
                )
                .join("");
    }


    // ========================================================
    // Menu Render
    // ========================================================

    renderMenu() {

        if (
            !this.menuElement ||
            !this.activeGroup
        ) {
            return;
        }


        const group =
            RADIO_CONFIG.groups[
                this.activeGroup
            ];


        if (!group) {
            return;
        }


        const commandHTML =
            group.commands
                .map(
                    (
                        command,
                        index
                    ) => {

                        return `
                        <div
                            class="radio-menu-item"
                            data-radio-index="${index}"
                        >
                            <span class="radio-number">
                                ${index + 1}.
                            </span>

                            <span>
                                ${this._escapeHTML(
                                    command
                                )}
                            </span>
                        </div>
                        `;
                    }
                )
                .join("");


        this.menuElement.innerHTML =
            `
            <div class="radio-menu-title">
                ${this._escapeHTML(
                    group.title
                )}
            </div>

            <div class="radio-menu-list">
                ${commandHTML}
            </div>

            <div class="radio-menu-close">
                0. Exit
            </div>
            `;


        /*
         * 鼠标也可以点击。
         */
        const items =
            this.menuElement
                .querySelectorAll(
                    "[data-radio-index]"
                );


        items.forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                element.dataset
                                    .radioIndex
                            );


                        this.selectCommand(
                            index
                        );
                    }
                );
            }
        );
    }


    _showMenuElement() {

        if (
            !this.menuElement
        ) {
            return;
        }


        this.menuElement.style.display =
            "block";
    }


    // ========================================================
    // Speaker Name
    // ========================================================

    _getSpeakerName(
        speaker,
        source
    ) {

        if (
            source ===
            "announcer"
        ) {

            return "ANNOUNCER";
        }


        if (
            source ===
            "system"
        ) {

            return "SYSTEM";
        }


        if (
            speaker?.name
        ) {

            /*
             * 玩家名称可以是
             * PLAYER (You)
             */
            return speaker.name;
        }


        if (
            source ===
            "player" ||
            source ===
            "player-auto"
        ) {

            return "PLAYER";
        }


        return "UNKNOWN";
    }


    // ========================================================
    // Team color
    // ========================================================

    _getTeamColor(
        team,
        source
    ) {

        if (
            source ===
            "announcer"
        ) {

            return RADIO_CONFIG
                .colors
                .announcer;
        }


        if (
            source ===
            "system"
        ) {

            return RADIO_CONFIG
                .colors
                .system;
        }


        if (
            team === TEAM.CT ||
            team === "ct" ||
            team === "CT"
        ) {

            return RADIO_CONFIG
                .colors
                .CT;
        }


        if (
            team === TEAM.T ||
            team === "t" ||
            team === "T"
        ) {

            return RADIO_CONFIG
                .colors
                .T;
        }


        return RADIO_CONFIG
            .colors
            .system;
    }


    // ========================================================
    // HTML Escape
    // ========================================================

    _escapeHTML(value) {

        const text =
            String(
                value ?? ""
            );


        return text
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
    // State
    // ========================================================

    getState() {

        return {
            enabled:
                this.enabled,

            menuOpen:
                this.menuOpen,

            activeGroup:
                this.activeGroup,

            history:
                [
                    ...this.history
                ]
        };
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.closeMenu();

        this.hideMessage();


        gameEvents.off(
            GAME_EVENT.RADIO_SEND,
            this._boundRadioSend
        );


        gameEvents.off(
            GAME_EVENT.GRENADE_THROW,
            this._boundGrenadeThrow
        );


        gameEvents.off(
            GAME_EVENT.ROUND_END,
            this._boundRoundEnd
        );


        this.history.length =
            0;

        this.player = null;

        this.menuElement = null;

        this.messageElement = null;

        this.historyElement = null;
    }
}


// ============================================================
// 默认单例
//
// game.js 初始化之后调用：
//
// radio.setPlayer(player);
// radio.initDOM(...);
// ============================================================

export const radio =
    new RadioSystem();

export default radio;