/**
 * Web-CS15
 * src/systems/round.js
 *
 * 回合系统
 *
 * 负责：
 * - Freeze Time
 * - Round Timer
 * - CT / T 胜负判断
 * - Draw
 * - Score
 * - 自动下一局
 * - 玩家保枪
 * - BOT 保枪
 * - BOT 战绩继承
 *
 * 不负责：
 * - HUD DOM
 * - Audio
 * - Radio
 * - Economy 具体算法
 */

import * as THREE from "three";

import {
    ROUND_CONFIG,
    ECONOMY_CONFIG,
    MAP_CONFIG,
    TEAM,
    GAME_EVENT
} from "../core/config.js";

import {
    GameTimer,
    randomRange,
    gameEvents
} from "../core/utils.js";


// ============================================================
// Round State
// ============================================================

export const ROUND_STATE = Object.freeze({
    IDLE: "IDLE",
    FREEZE: "FREEZE",
    LIVE: "LIVE",
    ENDING: "ENDING",
    FINISHED: "FINISHED"
});


// ============================================================
// Round Result
// ============================================================

export const ROUND_RESULT = Object.freeze({
    CT_WIN: "ct",
    T_WIN: "t",
    DRAW: "draw"
});


// ============================================================
// RoundSystem
// ============================================================

export class RoundSystem {

    constructor({
        player = null,
        bots = [],
        botAIManager = null,
        map = null
    } = {}) {

        this.player =
            player;

        this.bots =
            bots;

        this.botAIManager =
            botAIManager;

        this.map =
            map;


        // ====================================================
        // 状态
        // ====================================================

        this.state =
            ROUND_STATE.IDLE;

        this.roundNumber = 0;

        this.isRoundOver =
            false;


        // ====================================================
        // Score
        // ====================================================

        this.score = {
            ct: 0,
            t: 0
        };


        // ====================================================
        // Timers
        // ====================================================

        this.freezeTimer =
            new GameTimer(
                ROUND_CONFIG.freezeTime
            );


        this.roundTimer =
            new GameTimer(
                ROUND_CONFIG.roundTime
            );


        this.endTimer =
            new GameTimer(
                ROUND_CONFIG.roundEndDelay
            );


        // ====================================================
        // Result
        // ====================================================

        this.lastResult =
            null;

        this.lastReason =
            null;


        // ====================================================
        // Persistent Bot Profiles
        //
        // 如果未来选择销毁 Bot 再重建，
        // 这里仍可保存战绩。
        // ====================================================

        this.botProfiles =
            new Map();


        // ====================================================
        // Spawn cache
        // ====================================================

        this.lastPlayerSpawn =
            null;


        // ====================================================
        // Event hooks
        // ====================================================

        this._boundPlayerDeath =
            data => {

                if (
                    data.player ===
                    this.player
                ) {

                    this.checkWinCondition();
                }
            };


        this._boundBotDeath =
            data => {

                if (
                    this.bots.includes(
                        data.bot
                    )
                ) {

                    this.checkWinCondition();
                }
            };


        this._bindEvents();
    }


    // ========================================================
    // Event bindings
    // ========================================================

    _bindEvents() {

        gameEvents.on(
            GAME_EVENT.PLAYER_DEATH,
            this._boundPlayerDeath
        );


        gameEvents.on(
            GAME_EVENT.BOT_DEATH,
            this._boundBotDeath
        );
    }


    // ========================================================
    // Set player
    // ========================================================

    setPlayer(player) {

        this.player =
            player;


        if (
            this.botAIManager
        ) {

            this.botAIManager
                .setPlayer(
                    player
                );
        }
    }


    // ========================================================
    // Bots
    // ========================================================

    setBots(bots) {

        this.bots =
            bots || [];
    }


    addBot(bot) {

        if (!bot) {
            return;
        }


        if (
            !this.bots.includes(
                bot
            )
        ) {

            this.bots.push(
                bot
            );
        }
    }


    removeBot(bot) {

        const index =
            this.bots.indexOf(
                bot
            );


        if (
            index !== -1
        ) {

            this.bots.splice(
                index,
                1
            );
        }
    }


    // ========================================================
    // Match start
    // ========================================================

    startMatch({
        resetScore = true,
        resetPlayer = true,
        resetBots = true
    } = {}) {

        if (resetScore) {

            this.score.ct = 0;
            this.score.t = 0;

            this.roundNumber = 0;
        }


        if (
            resetPlayer &&
            this.player
        ) {

            this.player.resetMatch();
        }


        if (resetBots) {

            for (
                const bot
                of this.bots
            ) {

                bot.resetMatch();
            }
        }


        this.lastResult = null;
        this.lastReason = null;


        gameEvents.emit(
            "match:start",
            {
                score: {
                    ...this.score
                }
            }
        );


        this.startNextRound();
    }



    // ========================================================
	// Start Next Round
	// ========================================================

	startNextRound() {

		/*
		 * 先清理上一回合计时状态。
		 */
		this.endTimer.reset();

		this.roundTimer.reset();

		this.freezeTimer.reset();


		// ====================================================
		// Round number
		// ====================================================

		this.roundNumber++;


		this.isRoundOver =
			false;


		this.lastResult =
			null;


		this.lastReason =
			null;


		// ====================================================
		// State
		// ====================================================

		this.state =
			ROUND_STATE.FREEZE;


		console.log(
			`[Round] Starting round ${this.roundNumber}`
		);


		// ====================================================
		// Spawn
		// ====================================================

		this.spawnPlayer();

		this.spawnBots();


		// ====================================================
		// Freeze timer
		// ====================================================

		this.freezeTimer.start(
			ROUND_CONFIG.freezeTime
		);


		// ====================================================
		// Freeze controls
		// ====================================================

		this.setCharactersFrozen(
			true
		);


		if (
			this.botAIManager
		) {

			this.botAIManager
				.setEnabled(
					false
				);
		}


		// ====================================================
		// Events
		// ====================================================

		gameEvents.emit(
			GAME_EVENT.ROUND_FREEZE_START,
			{
				round:
					this.roundNumber,

				duration:
					ROUND_CONFIG.freezeTime,

				score: {
					...this.score
				}
			}
		);


		gameEvents.emit(
			GAME_EVENT.SCORE_CHANGED,
			{
				ct:
					this.score.ct,

				t:
					this.score.t,

				round:
					this.roundNumber
			}
		);


		console.log(
			`[Round] Round ${this.roundNumber} freeze started`
		);
	}


    // ========================================================
    // Freeze complete
    // ========================================================

    beginLiveRound() {

        if (
            this.state !==
            ROUND_STATE.FREEZE
        ) {

            return;
        }


        this.state =
            ROUND_STATE.LIVE;


        this.roundTimer.start(
            ROUND_CONFIG.roundTime
        );


        this.setCharactersFrozen(
            false
        );


        if (
            this.botAIManager
        ) {

            this.botAIManager
                .setEnabled(
                    true
                );
        }


        gameEvents.emit(
            GAME_EVENT.ROUND_START,
            {
                round:
                    this.roundNumber,

                time:
                    ROUND_CONFIG.roundTime,

                score: {
                    ...this.score
                }
            }
        );
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        switch (
            this.state
        ) {

            case ROUND_STATE.FREEZE:

                this.updateFreeze(
                    delta
                );

                break;


            case ROUND_STATE.LIVE:

                this.updateLive(
                    delta
                );

                break;


            case ROUND_STATE.ENDING:

                this.updateEnding(
                    delta
                );

                break;
        }
    }


    // ========================================================
    // Freeze update
    // ========================================================

    updateFreeze(delta) {

        const finished =
            this.freezeTimer
                .update(
                    delta
                );


        gameEvents.emit(
            "round:timer-update",
            {
                phase:
                    "freeze",

                timeLeft:
                    this.freezeTimer
                        .timeLeft
            }
        );


        if (finished) {

            this.beginLiveRound();
        }
    }


    // ========================================================
    // Live update
    // ========================================================

    updateLive(delta) {

        if (
            this.isRoundOver
        ) {
            return;
        }


        const finished =
            this.roundTimer
                .update(
                    delta
                );


        gameEvents.emit(
            "round:timer-update",
            {
                phase:
                    "round",

                timeLeft:
                    this.roundTimer
                        .timeLeft
            }
        );


        // ----------------------------------------------------
        // Time out
        // ----------------------------------------------------

        if (finished) {

            this.endRound(
                ROUND_RESULT.DRAW,
                "Time Out"
            );

            return;
        }


        /*
         * 保险：
         * 即使某些死亡事件漏掉，
         * 每帧仍然检查一次。
         */
        this.checkWinCondition();
    }


    // ========================================================
    // Ending update
    // ========================================================

	// ========================================================
	// Ending update
	//
	// 回合结束后等待 roundEndDelay 秒，
	// 然后自动进入下一回合。
	// ========================================================

	updateEnding(delta) {

		/*
		 * ENDING 状态下必须持续推进结束计时器。
		 */
		this.endTimer.update(
			delta
		);


		/*
		 * 不只判断 update() 当帧返回值。
		 *
		 * GameTimer.finished 一旦完成就会保持 true，
		 * 因此即使某一帧因为其它逻辑没有正确处理，
		 * 下一帧依然可以进入下一局。
		 */
		if (
			!this.endTimer.finished
		) {

			return;
		}


		/*
		 * 如果关闭自动下一局，
		 * 停留在当前结果界面。
		 */
		if (
			!ROUND_CONFIG
				.automaticNextRound
		) {

			return;
		}


		/*
		 * 防止重复 startNextRound()。
		 *
		 * 先切换状态，
		 * startNextRound() 随后会设置为 FREEZE。
		 */
		this.state =
			ROUND_STATE.FINISHED;


		console.log(
			`[Round] Round ${this.roundNumber} finished -> starting next round`
		);


		this.startNextRound();
	}


    // ========================================================
    // Win Condition
    // ========================================================

    checkWinCondition() {

        if (
            this.state !==
                ROUND_STATE.LIVE ||
            this.isRoundOver
        ) {

            return;
        }


        const aliveCT =
            this.getAliveCount(
                TEAM.CT
            );


        const aliveT =
            this.getAliveCount(
                TEAM.T
            );


        // ----------------------------------------------------
        // 两边都死
        // ----------------------------------------------------

        if (
            aliveCT === 0 &&
            aliveT === 0
        ) {

            this.endRound(
                ROUND_RESULT.DRAW,
                "All Players Eliminated"
            );

            return;
        }


        // ----------------------------------------------------
        // CT dead
        // ----------------------------------------------------

        if (
            aliveCT === 0 &&
            aliveT > 0
        ) {

            this.endRound(
                ROUND_RESULT.T_WIN,
                "Counter-Terrorists Eliminated"
            );

            return;
        }


        // ----------------------------------------------------
        // T dead
        // ----------------------------------------------------

        if (
            aliveT === 0 &&
            aliveCT > 0
        ) {

            /*
             * 防止没有任何 T BOT 的时候
             * 开局瞬间判 CT 胜。
             */
            const hasT =
                this.hasTeamMembers(
                    TEAM.T
                );


            if (hasT) {

                this.endRound(
                    ROUND_RESULT.CT_WIN,
                    "Terrorists Eliminated"
                );
            }
        }
    }


    // ========================================================
	// End Round
	// ========================================================

	endRound(
		result,
		reason = ""
	) {

		/*
		 * 防止同一回合重复结束。
		 *
		 * 例如最后两个 BOT 在极短时间内同时死亡，
		 * 可能连续触发 BOT_DEATH。
		 */
		if (
			this.isRoundOver
		) {

			return false;
		}


		// ====================================================
		// Mark round ended
		// ====================================================

		this.isRoundOver =
			true;


		this.state =
			ROUND_STATE.ENDING;


		this.lastResult =
			result;


		this.lastReason =
			reason;


		// ====================================================
		// Stop live timer
		// ====================================================

		this.roundTimer.stop();


		/*
		 * 非常重要：
		 *
		 * 进入 ENDING 后立即启动下一局倒计时。
		 *
		 * 不要放到所有 event emit 之后。
		 */
		this.endTimer.start(
			ROUND_CONFIG.roundEndDelay
		);


		console.log(
			`[Round] Round ${this.roundNumber} ended`,
			{
				result,
				reason,
				nextRoundIn:
					ROUND_CONFIG.roundEndDelay
			}
		);


		// ====================================================
		// Save equipment / round state
		// ====================================================

		this.saveRoundState();


		// ====================================================
		// Score
		// ====================================================

		switch (
			result
		) {

			case ROUND_RESULT.CT_WIN:

				this.score.ct++;

				break;


			case ROUND_RESULT.T_WIN:

				this.score.t++;

				break;


			case ROUND_RESULT.DRAW:
			default:

				break;
		}


		// ====================================================
		// Round Money
		//
		// 注意：
		// 你目前 economy.js 也会监听 ROUND_END 发钱。
		//
		// 如果已经完全使用 economy.js，
		// 建议把下面这一段删除，避免双倍奖励。
		// ====================================================

		/*
		this.applyRoundMoney(
			result
		);
		*/


		// ====================================================
		// Freeze everyone
		// ====================================================

		this.setCharactersFrozen(
			true
		);


		if (
			this.botAIManager
		) {

			this.botAIManager
				.setEnabled(
					false
				);
		}


		// ====================================================
		// Round End Event
		// ====================================================

		gameEvents.emit(
			GAME_EVENT.ROUND_END,
			{
				round:
					this.roundNumber,

				winner:
					result,

				reason,

				score: {
					...this.score
				},

				ctAlive:
					this.getAliveCount(
						TEAM.CT
					),

				tAlive:
					this.getAliveCount(
						TEAM.T
					),

				nextRoundDelay:
					ROUND_CONFIG
						.roundEndDelay
			}
		);


		// ====================================================
		// Score Event
		// ====================================================

		gameEvents.emit(
			GAME_EVENT.SCORE_CHANGED,
			{
				ct:
					this.score.ct,

				t:
					this.score.t
			}
		);


		return true;
	}


    // ========================================================
    // Force End
    // ========================================================

    forceEnd(
        result =
            ROUND_RESULT.DRAW
    ) {

        return this.endRound(
            result,
            "Round Force Ended"
        );
    }


    // ========================================================
    // Round Persistence
    // ========================================================

    saveRoundState() {

		// ====================================================
		// Player
		// ====================================================

		if (
			this.player
		) {

			/*
			 * 新接口优先。
			 */
			if (
				typeof this.player
					.prepareForRoundEnd ===
					"function"
			) {

				this.player
					.prepareForRoundEnd();

			} else if (
				typeof this.player
					.saveRoundInventory ===
					"function"
			) {

				/*
				 * 向旧版 player.js 兼容。
				 */
				this.player
					.saveRoundInventory();
			}
		}


		// ====================================================
		// BOT Profiles
		// ====================================================

		this.botProfiles.clear();


		for (
			const bot
			of this.bots
		) {

			if (!bot) {
				continue;
			}


			if (
				typeof bot
					.prepareForRoundEnd ===
					"function"
			) {

				bot.prepareForRoundEnd();
			}


			/*
			 * BOT Profile 也做安全判断。
			 */
			if (
				typeof bot
					.serializeProfile ===
					"function"
			) {

				this.botProfiles.set(
					bot.id,
					bot.serializeProfile()
				);
			}
		}
	}


    // ========================================================
    // Player Spawn
    // ========================================================

    spawnPlayer() {

        if (
            !this.player
        ) {
            return;
        }


        const position =
            this.getSpawnPosition(
                this.player.team
            );


        this.lastPlayerSpawn =
            position.clone();


        this.player.spawn({
            position,

            preserveWeapons:
                true,

            resetArmor:
                false
        });
    }


    // ========================================================
    // BOT Spawn
    // ========================================================

    spawnBots() {

        for (
            const bot
            of this.bots
        ) {

            const position =
                this.getSpawnPosition(
                    bot.team
                );


            bot.spawn({
                position,

                preserveWeapons:
                    true,

                resetArmor:
                    false
            });
        }
    }


    // ========================================================
    // Spawn Position
    // ========================================================

    getSpawnPosition(team) {

        /*
         * 优先使用 map.js 提供的接口。
         */
        if (
            this.map &&
            typeof this.map
                .getSpawnPosition ===
                "function"
        ) {

            const position =
                this.map
                    .getSpawnPosition(
                        team
                    );


            if (
                position?.isVector3
            ) {

                return position;
            }
        }


        // ====================================================
        // fallback
        // ====================================================

        const spawn =
            team === TEAM.T
                ? MAP_CONFIG.spawn.T
                : MAP_CONFIG.spawn.CT;


        const x =
            randomRange(
                spawn.xMin,
                spawn.xMax
            );


        const z =
            randomRange(
                spawn.zMin,
                spawn.zMax
            );


        /*
         * Player 的位置 Y 使用 eyeHeight，
         * Bot group 则本来应该是 y=0。
         *
         * Player.spawn() 会接受这里的 Vector3。
         *
         * 为了兼容两者，
         * Player 自己会调整视点，
         * BOT 则只使用 y=0。
         */
        return new THREE.Vector3(
            x,
            0,
            z
        );
    }


    // ========================================================
    // Alive Count
    // ========================================================

    getAliveCount(team) {

        let count = 0;


        if (
            this.player &&
            this.player.team ===
                team &&
            this.player.isAlive
        ) {

            count++;
        }


        for (
            const bot
            of this.bots
        ) {

            if (
                bot.team ===
                    team &&
                bot.isAlive
            ) {

                count++;
            }
        }


        return count;
    }


    // ========================================================
    // Team Members
    // ========================================================

    hasTeamMembers(team) {

        if (
            this.player &&
            this.player.team ===
                team
        ) {

            return true;
        }


        return this.bots.some(
            bot =>
                bot.team ===
                team
        );
    }


    // ========================================================
    // Get Alive Entities
    // ========================================================

    getAliveEntities(team) {

        const entities = [];


        if (
            this.player &&
            this.player.team ===
                team &&
            this.player.isAlive
        ) {

            entities.push(
                this.player
            );
        }


        for (
            const bot
            of this.bots
        ) {

            if (
                bot.team ===
                    team &&
                bot.isAlive
            ) {

                entities.push(
                    bot
                );
            }
        }


        return entities;
    }


    // ========================================================
    // Freeze characters
    // ========================================================

    setCharactersFrozen(
        frozen
    ) {

        if (
            this.player
        ) {

            this.player
                .setControlsEnabled(
                    !frozen
                );
        }


        for (
            const bot
            of this.bots
        ) {

            bot.controlsEnabled =
                !frozen;


            if (frozen) {

                bot.stopMoving();

                bot.inventory
                    .currentWeapon
                    ?.releaseTrigger();
            }
        }
    }


    // ========================================================
    // Basic Economy
    //
    // economy.js 后面会替换这一块。
    // ========================================================

    applyRoundMoney(result) {

        if (
            result ===
            ROUND_RESULT.DRAW
        ) {

            this.rewardTeam(
                TEAM.CT,
                ECONOMY_CONFIG
                    .roundRewards
                    .draw
            );


            this.rewardTeam(
                TEAM.T,
                ECONOMY_CONFIG
                    .roundRewards
                    .draw
            );


            return;
        }


        const winner =
            result ===
            ROUND_RESULT.CT_WIN
                ? TEAM.CT
                : TEAM.T;


        const loser =
            winner === TEAM.CT
                ? TEAM.T
                : TEAM.CT;


        this.rewardTeam(
            winner,
            ECONOMY_CONFIG
                .roundRewards
                .win
        );


        this.rewardTeam(
            loser,
            ECONOMY_CONFIG
                .roundRewards
                .lossBase
        );
    }


    // ========================================================
    // Reward Team
    // ========================================================

    rewardTeam(
        team,
        amount
    ) {

        if (
            this.player &&
            this.player.team ===
                team
        ) {

            this.player.addMoney(
                amount
            );
        }


        for (
            const bot
            of this.bots
        ) {

            if (
                bot.team ===
                team
            ) {

                bot.addMoney(
                    amount
                );
            }
        }
    }


    // ========================================================
    // Score setters
    // ========================================================

    setScore(
        ct,
        t
    ) {

        this.score.ct =
            Math.max(
                0,
                Math.floor(ct)
            );


        this.score.t =
            Math.max(
                0,
                Math.floor(t)
            );


        gameEvents.emit(
            GAME_EVENT.SCORE_CHANGED,
            {
                ct:
                    this.score.ct,

                t:
                    this.score.t
            }
        );
    }


    // ========================================================
    // Reset score
    // ========================================================

    resetScore() {

        this.setScore(
            0,
            0
        );
    }


    // ========================================================
    // Time
    // ========================================================

    get timeLeft() {

        switch (
            this.state
        ) {

            case ROUND_STATE.FREEZE:

                return this.freezeTimer
                    .timeLeft;


            case ROUND_STATE.LIVE:

                return this.roundTimer
                    .timeLeft;


            case ROUND_STATE.ENDING:

                return this.endTimer
                    .timeLeft;


            default:

                return 0;
        }
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            state:
                this.state,

            roundNumber:
                this.roundNumber,

            score: {
                ...this.score
            },

            timeLeft:
                this.timeLeft,

            isRoundOver:
                this.isRoundOver,

            lastResult:
                this.lastResult,

            lastReason:
                this.lastReason,

            alive: {
                ct:
                    this.getAliveCount(
                        TEAM.CT
                    ),

                t:
                    this.getAliveCount(
                        TEAM.T
                    )
            }
        };
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        gameEvents.off(
            GAME_EVENT.PLAYER_DEATH,
            this._boundPlayerDeath
        );


        gameEvents.off(
            GAME_EVENT.BOT_DEATH,
            this._boundBotDeath
        );


        this.freezeTimer.stop();

        this.roundTimer.stop();

        this.endTimer.stop();


        this.botProfiles.clear();


        this.player = null;

        this.bots = [];

        this.botAIManager = null;

        this.map = null;


        this.state =
            ROUND_STATE.FINISHED;
    }
}


// ============================================================
// 默认单例
//
// 注意：
// 因为 player/bots 在 game.js 创建之后才存在，
// 所以 game.js 需要再 set。
// ============================================================

export const round =
    new RoundSystem();

export default round;