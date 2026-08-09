/**
 * Web-CS15
 * src/bot/botAI.js
 *
 * BOT AI 系统
 *
 * 功能：
 * - Patrol
 * - Alert
 * - Combat
 * - Retreat
 * - Reload
 * - Enemy detection
 * - Hearing
 * - Aim
 * - Shooting
 * - Grenade
 * - Radio
 *
 * 新增：
 * - 前方障碍检测
 * - 左右绕障
 * - 绕行方向保持
 * - 墙角卡住检测
 * - 自动脱困
 * - 巡逻点避开建筑物
 */

import * as THREE from "three";

import {
    BOT_CONFIG,
    BOT_STATE,
    TEAM,
    RADIO_CONFIG,
    GAME_EVENT
} from "../core/config.js";

import {
    StateMachine,
    RandomCooldown,
    Cooldown,
    randomRange,
    randomItem,
    chance,
    clamp,
    gameEvents
} from "../core/utils.js";

import {
    weaponSystem
} from "../weapons/weapon.js";

import {
    grenadeSystem,
    GRENADE_TYPE
} from "../weapons/grenade.js";


// ============================================================
// BOT Tactical Roles - V1
// ============================================================

export const BOT_TACTICAL_ROLE =
    Object.freeze({
        ATTACK:
            "attack",

        SUPPORT:
            "support",

        HOLD:
            "hold"
    });


// ============================================================
// BotAI
// ============================================================

export class BotAI {

    constructor({
        bot,
        player = null,
        bots = [],
        collisionObjects = [],
        navigationGraph = null,
        navigationMap = null,
        tacticalManager = null,
        tacticalRole = BOT_TACTICAL_ROLE.ATTACK
    } = {}) {

        if (!bot) {
            throw new Error(
                "[BotAI] bot is required."
            );
        }


        this.bot = bot;

        this.player = player;

        this.bots = bots;

        this.collisionObjects =
            collisionObjects || [];


        // ====================================================
        // Waypoint Graph + A*
        // ====================================================

        this.navigationGraph =
            navigationGraph;


        this.navigationMap =
            navigationMap;


        this.navigationPath = [];

        this.navigationPathIndex = 0;

        this.navigationTarget =
            null;


        /*
         * 路径失败后短暂等待，
         * 避免每帧重复 A*。
         */
        this.navigationRetryTimer = 0;


        this.navigationDebugSyncTimer = 0;


        // ====================================================
        // Navigation V4
        //
        // 防止 BOT 在两个巡逻 Waypoint 之间反复往返。
        // ====================================================

        this.currentPatrolGoalNodeId =
            null;


        this.recentPatrolGoalNodeIds =
            [];


        /*
         * 路径开始时 BOT 的位置。
         * 用于第一个 Waypoint 的“已越过节点”判断。
         */
        this.navigationPathStartPosition =
            this.bot
                .getPosition()
                .clone();


        /*
         * Waypoint 不要求踩到中心。
         */
        this.navigationWaypointReachDistance =
            1.55;


        /*
         * 最多向前跳过几个可直达节点。
         * 值太大可能切角过猛。
         */
        this.navigationLookAheadSteps =
            3;


        // ====================================================
        // Tactical V1
        // ====================================================

        this.tacticalManager =
            tacticalManager;


        this.tacticalRole =
            tacticalRole;


        /*
         * 支援行为不能每帧重新选择，
         * 否则 BOT 会在 Patrol / Support 之间抖动。
         */
        this.supportTargetBot =
            null;

        this.supportPosition =
            null;

        this.supportTimer =
            0;

        this.supportDecisionCooldown =
            0;


        /*
         * HOLD BOT 到达一个巡逻区域后，
         * 会短暂停留，而不是不停穿越整张地图。
         */
        this.holdPositionTimer =
            0;


        /*
         * ATTACK / SUPPORT / HOLD 的巡逻距离倾向。
         */
        this.tacticalPatrolRanges = {
            [BOT_TACTICAL_ROLE.ATTACK]: {
                min:
                    18,
                max:
                    Infinity
            },

            [BOT_TACTICAL_ROLE.SUPPORT]: {
                min:
                    12,
                max:
                    42
            },

            [BOT_TACTICAL_ROLE.HOLD]: {
                min:
                    7,
                max:
                    28
            }
        };


        // ====================================================
        // State
        // ====================================================

        this.state =
            new StateMachine(
                BOT_STATE.PATROL
            );


        // ====================================================
        // Target
        // ====================================================

        this.target = null;

        this.lastVisibleTarget = null;

        this.lastKnownPosition = null;

        this.timeSinceEnemySeen =
            Infinity;


        // ====================================================
        // Patrol
        // ====================================================

        this.patrolPoint =
            new THREE.Vector3();


        // ====================================================
        // Combat
        // ====================================================

        this.strafeDirection =
            chance(0.5)
                ? 1
                : -1;


        this.strafeTimer =
            randomRange(
                BOT_CONFIG.combat
                    .strafeChangeMin,

                BOT_CONFIG.combat
                    .strafeChangeMax
            );


        this.combatTime = 0;

        this.enemySpottedRadioSent =
            false;


        // ====================================================
        // Aim
        // ====================================================

        this.aimDirection =
            new THREE.Vector3(
                0,
                0,
                -1
            );


        this.desiredAimDirection =
            new THREE.Vector3(
                0,
                0,
                -1
            );


        // ====================================================
        // Vision
        // ====================================================

        this.visionRaycaster =
            new THREE.Raycaster();


        // ====================================================
        // Obstacle avoidance
        // ====================================================

        this.obstacleRaycaster =
            new THREE.Raycaster();


        /*
         * BOT 当前选择绕障碍物的方向：
         *
         * -1 = 左
         *  1 = 右
         */
        this.avoidSide =
            chance(0.5)
                ? 1
                : -1;


        /*
         * 保持绕行方向一段时间。
         *
         * 如果每帧都重新判断左右，
         * BOT 会在箱子前左右抖动。
         */
        this.avoidSideTimer = 0;


        /*
         * 最近实际位置。
         *
         * 用来判断：
         * AI 明明一直想移动，
         * BOT 实际上有没有移动。
         */
        this.lastObservedPosition =
            this.bot
                .getPosition()
                .clone();


        this.stuckTimer = 0;


        /*
         * 大约 0.65 秒没有明显移动，
         * 开始脱困。
         */
        this.stuckThreshold =
            0.65;


        /*
         * 每帧实际移动距离小于这个值，
         * 认为可能被墙挡住。
         */
        this.stuckDistanceThreshold =
            0.055;


        /*
         * BOT 被卡住以后，
         * 临时前往这个位置。
         */
        this.escapePoint = null;

        this.escapeTimer = 0;


        /*
         * 当前实际 AI 想移动的方向。
         */
        this.currentMoveDirection =
            new THREE.Vector3();


        // ====================================================
        // Navigation V2 / Anti-loop
        // ====================================================

        /*
         * 连续卡住次数。
         * 如果短时间内连续脱困仍失败，
         * PATROL 会放弃当前巡逻点重新选点。
         */
        this.navigationStuckCount = 0;

        this.navigationStuckWindow = 0;


        /*
         * 记录上一条逃生方向。
         * 新的逃生方向会尽量避免重复选择完全相同方向。
         */
        this.lastEscapeDirection =
            new THREE.Vector3();


        /*
         * 逃生阶段记录实际位移。
         */
        this.escapeLastPosition =
            this.bot
                .getPosition()
                .clone();

        this.escapeNoProgressTimer = 0;


        // ====================================================
        // Radio
        // ====================================================

        this.radioCooldown =
            new RandomCooldown(
                BOT_CONFIG.radio
                    .cooldownMin,

                BOT_CONFIG.radio
                    .cooldownMax
            );


        this.spottedRadioCooldown =
            new Cooldown(
                12000
            );


        this.backupRadioCooldown =
            new Cooldown(
                15000
            );


        // ====================================================
        // Grenade
        // ====================================================

        this.grenadeDecisionCooldown =
            new Cooldown(
                8000
            );


		// ====================================================
		// Shooting
		// ====================================================

		/*
		 * Fire Decision Cooldown
		 *
		 * 根据 bot.difficulty 使用不同射击决策间隔：
		 * EASY   = 更慢
		 * NORMAL = 当前标准
		 * HARD   = 略快
		 */
		const initialDifficultyProfile =
			this.getDifficultyProfile();


		this.fireDecisionCooldown =
			new Cooldown(
				initialDifficultyProfile
					.decisionInterval
			);


		/*
		 * BOT 进入战斗以后不能立即开枪。
		 *
		 * reactionTimer:
		 * 当前还需要等待多少秒。
		 */
		this.reactionTimer = 0;


		/*
		 * 当前 Burst 已经射出的子弹数。
		 */
		this.burstShots = 0;


		/*
		 * 当前这一轮最多射几枪。
		 */
		const initialBurstRange =
			this.getDifficultyProfile();


		this.burstLimit =
			Math.floor(
				randomRange(
					initialBurstRange
						.burstMin,

					initialBurstRange
						.burstMax +
						1
				)
			);


		/*
		 * Burst 之间的暂停。
		 */
		this.burstPauseTimer = 0;


        // ====================================================
        // Alert
        // ====================================================

        this.alertPosition = null;

        this.alertTimer = 0;


        // ====================================================
        // Initial Patrol Point
        // ====================================================

        this.pickRandomPatrolPoint();


        // ====================================================
        // Events
        // ====================================================

        this._bindEvents();
    }


    // ========================================================
    // BOT Shooting Difficulty
    // ========================================================

    getShootingDifficulty() {

        /*
         * Main Menu V2 会把难度写入 bot.difficulty。
         *
         * 优先使用 BOT 自己的难度，
         * 只有旧版 BOT 没有 difficulty 时
         * 才 fallback 到全局默认值。
         */
        const difficulty =
            this.bot
                ?.difficulty ||
            BOT_CONFIG.shooting
                ?.difficulty ||
            "normal";


        if (
            difficulty === "easy" ||
            difficulty === "normal" ||
            difficulty === "hard" ||
            difficulty === "expert"
        ) {

            return difficulty;
        }


        return "normal";
    }


    // ========================================================
    // Difficulty Profile
    //
    // 只影响：
    // - 射击决策间隔
    // - Burst 长度
    // - Burst Pause
    // - 移动速度
    //
    // accuracy / reactionTime / aimError
    // 继续直接使用 config.js 中已有配置。
    // ========================================================

    getDifficultyProfile() {

        const difficulty =
            this.getShootingDifficulty();


        switch (
            difficulty
        ) {

            case "easy":

                return {
                    decisionInterval:
                        155,

                    burstMin:
                        1,

                    burstMax:
                        2,

                    burstPauseMin:
                        0.38,

                    burstPauseMax:
                        0.68,

                    movementMultiplier:
                        0.88
                };


            case "hard":

                return {
                    decisionInterval:
                        90,

                    burstMin:
                        2,

                    burstMax:
                        5,

                    burstPauseMin:
                        0.16,

                    burstPauseMax:
                        0.34,

                    movementMultiplier:
                        1.08
                };


            case "expert":

                return {
                    decisionInterval:
                        78,

                    burstMin:
                        2,

                    burstMax:
                        6,

                    burstPauseMin:
                        0.12,

                    burstPauseMax:
                        0.28,

                    movementMultiplier:
                        1.12
                };


            case "normal":
            default:

                return {
                    decisionInterval:
                        BOT_CONFIG.shooting
                            ?.decisionInterval ??
                        110,

                    burstMin:
                        BOT_CONFIG.shooting
                            ?.burstMin ??
                        1,

                    burstMax:
                        BOT_CONFIG.shooting
                            ?.burstMax ??
                        4,

                    burstPauseMin:
                        BOT_CONFIG.shooting
                            ?.burstPauseMin ??
                        0.20,

                    burstPauseMax:
                        BOT_CONFIG.shooting
                            ?.burstPauseMax ??
                        0.45,

                    movementMultiplier:
                        1.0
                };
        }
    }


    // ========================================================
    // Movement Difficulty
    // ========================================================

    getDifficultyMovementSpeed(
        baseSpeed
    ) {

        const speed =
            Number(
                baseSpeed
            );


        if (
            !Number.isFinite(
                speed
            )
        ) {

            return 0;
        }


        const profile =
            this.getDifficultyProfile();


        return (
            speed *
            profile
                .movementMultiplier
        );
    }


    // ========================================================
    // Reset Reaction
    //
    // BOT 第一次看到敌人时调用。
    // ========================================================

    resetReactionTimer() {

    	const difficulty =
    		this.getShootingDifficulty();


    	const baseReaction =
    		BOT_CONFIG
    			.reactionTime[
    				difficulty
    			] ??
    		0.65;


    	const randomExtra =
    		randomRange(
    			BOT_CONFIG.shooting
    				?.reactionRandomMin ??
    				0,

    			BOT_CONFIG.shooting
    				?.reactionRandomMax ??
    				0.25
    		);


    	this.reactionTimer =
    		baseReaction +
    		randomExtra;
    }


    // ========================================================
    // Reset Burst
    // ========================================================

    resetFireBurst() {

        const profile =
            this.getDifficultyProfile();


        this.burstShots =
            0;


        this.burstLimit =
            Math.floor(
                randomRange(
                    profile
                        .burstMin,

                    profile
                        .burstMax +
                        1
                )
            );


        this.burstPauseTimer =
            randomRange(
                profile
                    .burstPauseMin,

                profile
                    .burstPauseMax
            );
    }


    // ========================================================
    // Events
    // ========================================================

    _bindEvents() {

        // ----------------------------------------------------
        // 听到敌人枪声
        // ----------------------------------------------------

        this._onWeaponFire =
            data => {

                const shooter =
                    data.owner;


                if (
                    !shooter ||
                    shooter === this.bot
                ) {
                    return;
                }


                if (
                    shooter.team ===
                    this.bot.team
                ) {
                    return;
                }


                const origin =
                    data.origin;


                if (!origin) {
                    return;
                }


                const distance =
                    this.bot
                        .getPosition()
                        .distanceTo(
                            origin
                        );


                if (
                    distance <=
                    BOT_CONFIG
                        .hearingDistance
                        .gunshot
                ) {

                    this.hearGunfire(
                        origin
                    );
                }
            };


        gameEvents.on(
            GAME_EVENT.WEAPON_FIRE,
            this._onWeaponFire
        );


        // ----------------------------------------------------
        // 被攻击
        // ----------------------------------------------------

        this._onBotDamage =
            data => {

                if (
                    data.bot !==
                    this.bot
                ) {
                    return;
                }


                if (
                    data.attacker &&
                    data.attacker.team !==
                    this.bot.team
                ) {

                    this.lastKnownPosition =
                        this._getEntityPosition(
                            data.attacker
                        );


                    /*
                     * 统一通过 enterCombat() 进入战斗，
                     * 确保反应时间和 Burst 状态正确初始化。
                     */
                    this.enterCombat(
                        data.attacker
                    );
                }
            };


        gameEvents.on(
            GAME_EVENT.BOT_DAMAGE,
            this._onBotDamage
        );
    }


    // ========================================================
    // Main Update
    // ========================================================

    update(delta) {

        if (
            !this.bot.isAlive
        ) {

            this.bot.updateDeathAnimation(
                delta
            );

            return;
        }


        if (
            this.bot.isBlind
        ) {

            this.updateBlindState(
                delta
            );

            return;
        }


        this.state.update(
            delta
        );


        this.timeSinceEnemySeen +=
            delta;


        this.navigationRetryTimer =
            Math.max(
                0,
                this.navigationRetryTimer -
                delta
            );


        this.navigationDebugSyncTimer =
            Math.max(
                0,
                this.navigationDebugSyncTimer -
                delta
            );


        this.supportDecisionCooldown =
            Math.max(
                0,
                this.supportDecisionCooldown -
                delta
            );


        if (
            this.supportTimer >
            0
        ) {

            this.supportTimer =
                Math.max(
                    0,
                    this.supportTimer -
                    delta
                );


            if (
                this.supportTimer <=
                0
            ) {

                this.clearSupportTarget();
            }
        }


        this.holdPositionTimer =
            Math.max(
                0,
                this.holdPositionTimer -
                delta
            );


        switch (
            this.state.state
        ) {

            case BOT_STATE.PATROL:

                this.updatePatrol(
                    delta
                );

                break;


            case BOT_STATE.ALERT:

                this.updateAlert(
                    delta
                );

                break;


            case BOT_STATE.COMBAT:

                this.updateCombat(
                    delta
                );

                break;


            case BOT_STATE.RETREAT:

                this.updateRetreat(
                    delta
                );

                break;


            case BOT_STATE.RELOAD:

                this.updateReload(
                    delta
                );

                break;


            default:

                this.state.setState(
                    BOT_STATE.PATROL
                );

                break;
        }


        this.updateAim(
            delta
        );
    }


    // ========================================================
    // Blind
    // ========================================================

    updateBlindState(delta) {

        this.bot.stopMoving();

        this.target = null;


        this.bot.setCrouching(
            false
        );


        this.resetStuckDetection();


        if (
            chance(
                delta * 0.8
            )
        ) {

            const randomTarget =
                this.bot
                    .getPosition()
                    .clone()
                    .add(
                        new THREE.Vector3(
                            randomRange(
                                -10,
                                10
                            ),
                            0,
                            randomRange(
                                -10,
                                10
                            )
                        )
                    );


            this.bot.facePositionSmooth(
                randomTarget,
                delta,
                2
            );
        }
    }


    // ========================================================
    // Patrol - Waypoint Graph + A*
    // ========================================================

    updatePatrol(delta) {

        const enemy =
            this.findBestVisibleEnemy();


        if (enemy) {

            this.enterCombat(
                enemy
            );

            return;
        }


        // ====================================================
        // Tactical Support Decision
        //
        // 附近队友正在交战时：
        // SUPPORT 最积极，
        // ATTACK 有一定概率支援，
        // HOLD 只有近距离才会离开防守区。
        // ====================================================

        if (
            this.supportDecisionCooldown <=
            0
        ) {

            this.supportDecisionCooldown =
                randomRange(
                    0.65,
                    1.15
                );


            const supportRequest =
                this.findSupportRequest();


            if (
                supportRequest
            ) {

                this.beginSupport(
                    supportRequest.bot,
                    supportRequest.position
                );
            }
        }


        /*
         * 当前有支援任务：
         * 优先前往队友交战区域。
         */
        if (
            this.supportPosition &&
            this.supportTimer >
            0
        ) {

            const supportDistance =
                this.bot
                    .getPosition()
                    .distanceTo(
                        this.supportPosition
                    );


            if (
                supportDistance >
                3.5
            ) {

                if (
                    this.navigationGraph
                ) {

                    if (
                        this.shouldRebuildNavigationPath(
                            this.supportPosition,
                            2.5
                        ) &&
                        this.navigationRetryTimer <=
                            0
                    ) {

                        if (
                            !this.buildPathTo(
                                this.supportPosition
                            )
                        ) {

                            this.navigationRetryTimer =
                                0.45;
                        }
                    }


                    const followingSupport =
                        this.followNavigationPath(
                            delta,
                            BOT_CONFIG.normalSpeed,
                            this.supportPosition
                        );


                    if (
                        followingSupport
                    ) {

                        return;
                    }
                }
            }


            /*
             * 已经到达支援区域：
             * 清除支援任务并恢复普通 Tactical Patrol。
             */
            this.clearSupportTarget();
        }


        // ====================================================
        // HOLD role
        //
        // 到达一个合适区域后短暂停留观察，
        // 防止所有 BOT 都一直跑动。
        // ====================================================

        if (
            this.tacticalRole ===
                BOT_TACTICAL_ROLE.HOLD &&
            this.holdPositionTimer >
                0
        ) {

            this.bot.stopMoving();

            this.resetStuckDetection(
                false
            );

            return;
        }


        /*
         * 没有可用导航图时，
         * 保留旧版直线 + moveSmart() 作为 fallback。
         */
        if (
            !this.navigationGraph
        ) {

            this.updatePatrolFallback(
                delta
            );

            return;
        }


        /*
         * 没有路径：
         * 选择新的 Tactical Patrol Waypoint，并计算 A*。
         */
        if (
            this.navigationPath.length ===
                0 &&
            this.navigationRetryTimer <=
                0
        ) {

            this.pickRandomPatrolPoint();


            if (
                !this.buildPathTo(
                    this.patrolPoint
                )
            ) {

                this.navigationRetryTimer =
                    0.45;
            }
        }


        const following =
            this.followNavigationPath(
                delta,
                BOT_CONFIG.normalSpeed,
                this.patrolPoint
            );


        if (
            following
        ) {

            return;
        }


        // ====================================================
        // Arrived at Tactical Goal
        // ====================================================

        this.clearNavigationPath(
            false
        );


        if (
            this.tacticalRole ===
                BOT_TACTICAL_ROLE.HOLD
        ) {

            this.holdPositionTimer =
                randomRange(
                    2.0,
                    4.5
                );
        }


        this.pickRandomPatrolPoint();
    }


    // ========================================================
    // Patrol fallback
    // ========================================================

    updatePatrolFallback(delta) {

        const position =
            this.bot.getPosition();


        const direction =
            this.patrolPoint
                .clone()
                .sub(
                    position
                );


        direction.y = 0;


        if (
            direction.length() <
            BOT_CONFIG
                .patrol
                .reachDistance
        ) {

            this.pickRandomPatrolPoint();

            this.resetStuckDetection();

            return;
        }


        direction.normalize();


        const actualDirection =
            this.moveSmart(
                direction,
                delta,
                BOT_CONFIG.normalSpeed
            );


        if (actualDirection) {

            const lookAt =
                position
                    .clone()
                    .addScaledVector(
                        actualDirection,
                        5
                    );


            this.bot.facePositionSmooth(
                lookAt,
                delta,
                6
            );
        }
    }


    // ========================================================
    // Alert - Waypoint Graph + A*
    // ========================================================

    updateAlert(delta) {

        const enemy =
            this.findBestVisibleEnemy();


        if (enemy) {

            this.enterCombat(
                enemy
            );

            return;
        }


        this.alertTimer -=
            delta;


        if (
            !this.alertPosition ||
            this.alertTimer <= 0
        ) {

            this.clearNavigationPath();


            this.state.setState(
                BOT_STATE.PATROL
            );


            this.pickRandomPatrolPoint();

            this.resetStuckDetection();

            return;
        }


        /*
         * 有导航图时优先走 A*。
         */
        if (
            this.navigationGraph
        ) {

            if (
                this.shouldRebuildNavigationPath(
                    this.alertPosition,
                    1.5
                ) &&
                this.navigationRetryTimer <=
                    0
            ) {

                if (
                    !this.buildPathTo(
                        this.alertPosition
                    )
                ) {

                    this.navigationRetryTimer =
                        0.35;
                }
            }


            const following =
                this.followNavigationPath(
                    delta,
                    BOT_CONFIG.normalSpeed,
                    this.alertPosition
                );


            if (
                following
            ) {

                return;
            }
        }


        /*
         * 路径结束后，如果最后目标就在附近，
         * Alert 停下来观察。
         */
        const position =
            this.bot.getPosition();


        const direction =
            this.alertPosition
                .clone()
                .sub(
                    position
                );


        direction.y = 0;


        if (
            direction.length() <
            2
        ) {

            this.bot.stopMoving();

            this.resetStuckDetection();

            return;
        }


        /*
         * A* 不可用/无法建路时 fallback。
         */
        direction.normalize();


        const actualDirection =
            this.moveSmart(
                direction,
                delta,
                BOT_CONFIG.normalSpeed
            );


        if (actualDirection) {

            const lookAt =
                position
                    .clone()
                    .addScaledVector(
                        actualDirection,
                        5
                    );


            this.bot.facePositionSmooth(
                lookAt,
                delta,
                7
            );
        }
    }


    // ========================================================
    // Navigation helpers
    // ========================================================

    findReachableNavigationNode(
        position
    ) {

        if (
            !this.navigationGraph ||
            !position
        ) {

            return null;
        }


        const nodes =
            this.navigationGraph
                .getNodes();


        let best =
            null;


        let bestDistance =
            Infinity;


        for (
            const node
            of nodes
        ) {

            const distance =
                node.position
                    .distanceToSquared(
                        position
                    );


            if (
                distance >=
                bestDistance
            ) {

                continue;
            }


            /*
             * 起点/终点与 Waypoint 之间也必须能直达。
             * 这样不会因为“最近节点在墙另一边”而选错。
             */
            if (
                this.navigationMap &&
                typeof this.navigationMap
                    .hasClearNavigationLine ===
                    "function" &&
                !this.navigationMap
                    .hasClearNavigationLine(
                        position,
                        node.position,
                        Math.max(
                            0.45,
                            Number(
                                this.bot.radius
                            ) || 0.45
                        )
                    )
            ) {

                continue;
            }


            best =
                node;


            bestDistance =
                distance;
        }


        /*
         * 极端情况下没有可直达节点，
         * fallback 到纯最近节点。
         */
        return (
            best ||
            this.navigationGraph
                .findNearestNode(
                    position
                )
        );
    }


    buildPathTo(
        targetPosition
    ) {

        if (
            !this.navigationGraph ||
            !targetPosition
        ) {

            this.clearNavigationPath();

            return false;
        }


        const currentPosition =
            this.bot
                .getPosition();


        const startNode =
            this.findReachableNavigationNode(
                currentPosition
            );


        const goalNode =
            this.findReachableNavigationNode(
                targetPosition
            );


        if (
            !startNode ||
            !goalNode
        ) {

            this.clearNavigationPath();

            return false;
        }


        const path =
            this.navigationGraph
                .findPathByNodeIds(
                    startNode.id,
                    goalNode.id
                );


        if (
            !path ||
            path.length === 0
        ) {

            this.clearNavigationPath();

            return false;
        }


        /*
         * 如果第一个 Waypoint 就在脚下，
         * 直接从下一节点开始。
         */
        let startIndex =
            0;


        if (
            currentPosition
                .distanceToSquared(
                    path[0]
                ) <
            1.2 * 1.2
        ) {

            startIndex =
                1;
        }


        this.navigationPath =
            path;


        this.navigationPathIndex =
            Math.min(
                startIndex,
                path.length
            );


        this.navigationTarget =
            targetPosition.clone();


        this.navigationPathStartPosition
            .copy(
                currentPosition
            );


        this.navigationRetryTimer =
            0;


        this.syncNavigationDebug(
            true
        );


        return true;
    }


    shouldRebuildNavigationPath(
        targetPosition,
        threshold = 2
    ) {

        if (
            !targetPosition
        ) {

            return false;
        }


        if (
            this.navigationPath.length ===
            0
        ) {

            return true;
        }


        if (
            !this.navigationTarget
        ) {

            return true;
        }


        return (
            this.navigationTarget
                .distanceToSquared(
                    targetPosition
                )
            >
            threshold *
            threshold
        );
    }


    followNavigationPath(
        delta,
        speed,
        finalTarget = null
    ) {

        if (
            !this.navigationGraph
        ) {

            return false;
        }


        const position =
            this.bot
                .getPosition();


        // ====================================================
        // Navigation V4 - Waypoint arrival / passed detection
        // ====================================================

        while (
            this.navigationPathIndex <
            this.navigationPath.length
        ) {

            const waypoint =
                this.navigationPath[
                    this.navigationPathIndex
                ];


            const toWaypoint =
                waypoint
                    .clone()
                    .sub(
                        position
                    );


            toWaypoint.y = 0;


            const distance =
                toWaypoint.length();


            let reached =
                distance <=
                this.navigationWaypointReachDistance;


            // ------------------------------------------------
            // Passed Detection
            //
            // BOT 即使从 Waypoint 旁边擦过去，
            // 只要已经越过该节点，也算完成。
            // 防止走过头以后突然 180° 掉头。
            // ------------------------------------------------

            if (
                !reached
            ) {

                const previousPoint =
                    this.navigationPathIndex >
                    0
                        ? this.navigationPath[
                            this.navigationPathIndex -
                            1
                        ]
                        : this.navigationPathStartPosition;


                if (
                    previousPoint
                ) {

                    const segmentDirection =
                        waypoint
                            .clone()
                            .sub(
                                previousPoint
                            );


                    segmentDirection.y =
                        0;


                    const passedVector =
                        position
                            .clone()
                            .sub(
                                waypoint
                            );


                    passedVector.y =
                        0;


                    if (
                        segmentDirection
                            .lengthSq() >
                            0.001 &&
                        passedVector.dot(
                            segmentDirection
                        ) >
                            0.15
                    ) {

                        reached =
                            true;
                    }
                }
            }


            if (
                !reached
            ) {

                break;
            }


            this.navigationPathIndex++;


            this.navigationStuckCount =
                0;


            this.syncNavigationDebug();
        }


        // ====================================================
        // Path Look Ahead / Smoothing
        //
        // 如果 BOT 可以直接走到后面的 Waypoint，
        // 就跳过中间节点。
        //
        // P1 -> P2 -> P3
        //
        // 若当前位置可直达 P3：
        //
        // P1 --------> P3
        // ====================================================

        if (
            this.navigationMap &&
            typeof this.navigationMap
                .hasClearNavigationLine ===
                "function" &&
            this.navigationPathIndex <
                this.navigationPath.length -
                1
        ) {

            const maxLookAheadIndex =
                Math.min(
                    this.navigationPath.length -
                        1,

                    this.navigationPathIndex +
                        this.navigationLookAheadSteps
                );


            for (
                let index =
                    maxLookAheadIndex;

                index >
                    this.navigationPathIndex;

                index--
            ) {

                const candidate =
                    this.navigationPath[
                        index
                    ];


                if (
                    this.navigationMap
                        .hasClearNavigationLine(
                            position,
                            candidate,
                            0.58
                        )
                ) {

                    this.navigationPathIndex =
                        index;


                    this.syncNavigationDebug();

                    break;
                }
            }
        }


        // ====================================================
        // Movement target
        // ====================================================

        let moveTarget =
            null;


        if (
            this.navigationPathIndex <
            this.navigationPath.length
        ) {

            moveTarget =
                this.navigationPath[
                    this.navigationPathIndex
                ];

        } else if (
            finalTarget
        ) {

            moveTarget =
                finalTarget;
        }


        if (
            !moveTarget
        ) {

            this.syncNavigationDebug();

            return false;
        }


        const direction =
            moveTarget
                .clone()
                .sub(
                    position
                );


        direction.y = 0;


        const distance =
            direction.length();


        /*
         * 最终真实目标不要求踩到中心。
         */
        if (
            this.navigationPathIndex >=
                this.navigationPath.length &&
            distance <
                1.75
        ) {

            this.bot.stopMoving();

            this.syncNavigationDebug();

            return false;
        }


        if (
            distance <
            0.001
        ) {

            return true;
        }


        direction.normalize();


        /*
         * A* / Path Smoothing 负责全局方向。
         * moveSmart() 继续处理箱子、墙角和 Escape。
         */
        const actualDirection =
            this.moveSmart(
                direction,
                delta,
                speed
            );


        if (
            actualDirection
        ) {

            const lookAt =
                position
                    .clone()
                    .addScaledVector(
                        actualDirection,
                        5
                    );


            this.bot.facePositionSmooth(
                lookAt,
                delta,
                6
            );
        }


        this.syncNavigationDebug();


        return true;
    }


    clearNavigationPath(
        clearTarget = true
    ) {

        this.navigationPath = [];

        this.navigationPathIndex = 0;


        if (
            this.bot
        ) {

            this.navigationPathStartPosition
                .copy(
                    this.bot.getPosition()
                );
        }


        if (
            clearTarget
        ) {

            this.navigationTarget =
                null;
        }


        this.syncNavigationDebug(
            true
        );
    }


    syncNavigationDebug(
        force = false
    ) {

        if (
            !this.navigationMap ||
            typeof this.navigationMap
                .updateBotNavigationDebug !==
                "function"
        ) {

            return;
        }


        /*
         * Debug 关闭时不做任何每帧绘制工作。
         */
        if (
            !this.navigationMap
                .navigationDebugEnabled
        ) {

            this.navigationMap
                .clearBotNavigationDebug?.(
                    this.bot
                );

            return;
        }


        /*
         * BOT 每帧都在移动，但 Debug Path 不需要 60 FPS 重建。
         * 约 8 FPS 更新一次已经足够观察路线。
         */
        if (
            !force &&
            this.navigationDebugSyncTimer >
                0
        ) {

            return;
        }


        this.navigationDebugSyncTimer =
            0.12;


        this.navigationMap
            .updateBotNavigationDebug(
                this.bot,
                this.navigationPath,
                this.navigationPathIndex,
                this.navigationTarget
            );
    }


    // ========================================================
    // Combat
    // ========================================================

    updateCombat(delta) {

        this.combatTime +=
            delta;
		/*
		 * BOT Reaction Time
		 */
		if (
			this.reactionTimer > 0
		) {

			this.reactionTimer =
				Math.max(
					0,
					this.reactionTimer -
					delta
				);
		}


		/*
		 * Burst Pause
		 */
		if (
			this.burstPauseTimer > 0
		) {

			this.burstPauseTimer =
				Math.max(
					0,
					this.burstPauseTimer -
					delta
				);
		}

        if (
            !this.target ||
            !this._isEntityAlive(
                this.target
            )
        ) {

            this.leaveCombat();

            return;
        }


        const targetPosition =
            this._getEntityPosition(
                this.target
            );


        if (!targetPosition) {

            this.leaveCombat();

            return;
        }


        const visible =
            this.hasLineOfSightTo(
                this.target
            );


        if (visible) {

            this.timeSinceEnemySeen =
                0;


            this.lastKnownPosition =
                targetPosition.clone();


            this.lastVisibleTarget =
                this.target;

        } else {

            /*
             * 看不到敌人超过 3 秒：
             *
             * 去最后看到敌人的位置搜索。
             */
            if (
                this.timeSinceEnemySeen >
                3
            ) {

                this.alertPosition =
                    this.lastKnownPosition
                        ?.clone() ||
                    targetPosition.clone();


                this.alertTimer =
                    4;


                this.state.setState(
                    BOT_STATE.ALERT
                );


                this.target = null;

                return;
            }
        }


        if (
            this.shouldRetreat()
        ) {

            this.enterRetreat();

            return;
        }


        /*
         * 战斗状态保持面对敌人。
         *
         * 即使身体绕墙移动，
         * 枪依然尽量朝敌人。
         */
        this.bot.facePositionSmooth(
            targetPosition,
            delta,
            10
        );


        this.updateTargetAim(
            targetPosition
        );	


        const distance =
            this.bot
                .getPosition()
                .distanceTo(
                    targetPosition
                );


        this.updateCombatMovement(
            delta,
            targetPosition,
            distance
        );


        this.tryThrowGrenade(
            targetPosition,
            distance
        );


        /*
		 * 再做一次实时射击视线判断。
		 *
		 * BOT 已经进入 Combat 后，
		 * 不依赖上一阶段的旧 visible 状态。
		 */
		const canShoot =
			this.hasLineOfSightTo(
				this.target
			);


		if (canShoot) {

			this.tryFire(
				distance
			);
		}
    }


    // ========================================================
    // Combat Movement
    // ========================================================

    updateCombatMovement(
        delta,
        targetPosition,
        distance
    ) {

        const currentPosition =
            this.bot.getPosition();


        // ----------------------------------------------------
        // 敌人比较远 → 追击
        // ----------------------------------------------------

        if (
            distance >
            BOT_CONFIG
                .combatDistance *
            0.75
        ) {

            const chaseDirection =
                targetPosition
                    .clone()
                    .sub(
                        currentPosition
                    );


            chaseDirection.y = 0;


            if (
                chaseDirection.lengthSq() >
                0.0001
            ) {

                chaseDirection.normalize();


                this.moveSmart(
                    chaseDirection,
                    delta,
                    BOT_CONFIG.chaseSpeed
                );
            }


            return;
        }


        // ----------------------------------------------------
        // Strafe
        // ----------------------------------------------------

        this.strafeTimer -=
            delta;


        if (
            this.strafeTimer <= 0
        ) {

            this.strafeDirection *=
                -1;


            this.strafeTimer =
                randomRange(
                    BOT_CONFIG
                        .combat
                        .strafeChangeMin,

                    BOT_CONFIG
                        .combat
                        .strafeChangeMax
                );
        }


        const toTarget =
            targetPosition
                .clone()
                .sub(
                    currentPosition
                );


        toTarget.y = 0;


        if (
            toTarget.lengthSq() >
            0.0001
        ) {

            toTarget.normalize();
        }


        const right =
            new THREE.Vector3(
                -toTarget.z,
                0,
                toTarget.x
            );


        const strafe =
            right.multiplyScalar(
                this.strafeDirection
            );


        if (
            chance(
                BOT_CONFIG
                    .combat
                    .strafeChance *
                delta *
                3
            )
        ) {

            this.moveSmart(
                strafe,
                delta,
                BOT_CONFIG.normalSpeed
            );

        } else {

            this.bot.stopMoving();

            this.resetStuckDetection(
                false
            );
        }


        // ----------------------------------------------------
        // Crouch
        // ----------------------------------------------------

        if (
            chance(
                BOT_CONFIG
                    .combat
                    .crouchChance *
                delta
            )
        ) {

            this.bot.setCrouching(
                true
            );

        } else if (
            chance(
                delta * 0.8
            )
        ) {

            this.bot.setCrouching(
                false
            );
        }
    }


    // ========================================================
    // Smart Movement - Navigation V2
    //
    // 普通移动：
    // desired direction -> 多角度局部避障 -> bot.move()
    //
    // 脱困移动：
    // 锁定 escapePoint 方向，不再每帧交给普通绕障重新改向，
    // 避免 BOT 围着同一个障碍物原地打转。
    // ========================================================

    moveSmart(
        desiredDirection,
        delta,
        speed
    ) {

        if (
            !desiredDirection ||
            !this.bot ||
            !this.bot.isAlive
        ) {

            return null;
        }


        /*
         * Difficulty Movement Speed
         *
         * 统一在 moveSmart() 中处理，
         * 因此 Patrol / A* / Chase / Retreat /
         * Combat Strafe / Escape 都会一起生效。
         */
        speed =
            this.getDifficultyMovementSpeed(
                speed
            );


        let direction =
            desiredDirection.clone();

        direction.y = 0;


        if (
            direction.lengthSq() <
            0.0001
        ) {

            this.bot.stopMoving();

            return null;
        }


        direction.normalize();


        const currentPosition =
            this.bot
                .getPosition();


        // ----------------------------------------------------
        // 更新卡住检测
        // ----------------------------------------------------

        this.updateStuckDetection(
            delta,
            currentPosition
        );


        // ----------------------------------------------------
        // Escape Mode
        //
        // 逃生时最重要的是“坚持走出去”，
        // 所以这里不再调用普通 applyObstacleAvoidance()。
        // ----------------------------------------------------

        if (
            this.escapePoint &&
            this.escapeTimer > 0
        ) {

            const escapeDirection =
                this.escapePoint
                    .clone()
                    .sub(
                        currentPosition
                    );


            escapeDirection.y = 0;


            const escapeDistance =
                escapeDirection.length();


            if (
                escapeDistance <
                0.7
            ) {

                this.clearEscapeState();

            } else {

                escapeDirection.normalize();


                // --------------------------------------------
                // 检查逃生方向前面是否又被堵死
                // --------------------------------------------

                const origin =
                    currentPosition.clone();

                origin.y +=
                    0.85;


                const botRadius =
                    Math.max(
                        0.35,
                        Number(
                            this.bot.radius
                        ) || 0.45
                    );


                const clearance =
                    this.getObstacleClearance(
                        origin,
                        escapeDirection,
                        1.2 + botRadius
                    );


                /*
                 * 当前 escapePoint 路径也被完全堵住：
                 * 立即重新计算，不等 escapeTimer 到期。
                 */
                if (
                    clearance <
                    botRadius * 0.85
                ) {

                    this.createEscapePoint(
                        true
                    );

                    return null;
                }


                // --------------------------------------------
                // Escape progress
                // --------------------------------------------

                const escapeMoved =
                    currentPosition
                        .distanceTo(
                            this.escapeLastPosition
                        );


                if (
                    escapeMoved <
                    0.02
                ) {

                    this.escapeNoProgressTimer +=
                        delta;

                } else {

                    this.escapeNoProgressTimer =
                        Math.max(
                            0,
                            this.escapeNoProgressTimer -
                            delta * 4
                        );
                }


                this.escapeLastPosition.copy(
                    currentPosition
                );


                /*
                 * 逃生模式本身也超过约 0.45 秒没有进展，
                 * 立即换一个明显不同的方向。
                 */
                if (
                    this.escapeNoProgressTimer >
                    0.45
                ) {

                    this.escapeNoProgressTimer = 0;

                    this.createEscapePoint(
                        true
                    );

                    return null;
                }


                direction.copy(
                    escapeDirection
                );


                this.escapeTimer -=
                    delta;


                this.currentMoveDirection
                    .copy(
                        direction
                    );


                this.bot.move(
                    direction,
                    delta,
                    speed
                );


                return direction;
            }
        }


        // ----------------------------------------------------
        // Normal navigation
        // ----------------------------------------------------

        direction =
            this.applyObstacleAvoidance(
                direction,
                delta
            );


        this.currentMoveDirection
            .copy(
                direction
            );


        this.bot.move(
            direction,
            delta,
            speed
        );


        return direction;
    }


    // ========================================================
    // Clear Escape State
    // ========================================================

    clearEscapeState() {

        this.escapePoint =
            null;

        this.escapeTimer =
            0;

        this.escapeNoProgressTimer =
            0;


        if (
            this.bot
        ) {

            this.escapeLastPosition
                .copy(
                    this.bot.getPosition()
                );
        }
    }


    // ========================================================
    // Obstacle Avoidance - Navigation V2
    //
    // 不再只测试固定 ±55°。
    // 每一侧同时测试约 32° / 52° / 72°，
    // 选择“空间较大 + 还能保持前进”的方向。
    // ========================================================

    applyObstacleAvoidance(
        desiredDirection,
        delta
    ) {

        if (
            !this.collisionObjects ||
            this.collisionObjects.length === 0
        ) {

            return desiredDirection;
        }


        const origin =
            this.bot
                .getPosition()
                .clone();


        origin.y +=
            0.85;


        const forward =
            desiredDirection
                .clone();

        forward.y = 0;


        if (
            forward.lengthSq() <
            0.0001
        ) {

            return desiredDirection;
        }


        forward.normalize();


        const right =
            new THREE.Vector3(
                -forward.z,
                0,
                forward.x
            );


        const botRadius =
            Math.max(
                0.35,
                Number(
                    this.bot.radius
                ) || 0.45
            );


        const forwardDistance =
            2.0 +
            botRadius;


        // ----------------------------------------------------
        // 三条前向射线
        // ----------------------------------------------------

        const centerClearance =
            this.getObstacleClearance(
                origin,
                forward,
                forwardDistance
            );


        const leftOrigin =
            origin
                .clone()
                .addScaledVector(
                    right,
                    -botRadius * 0.72
                );


        const rightOrigin =
            origin
                .clone()
                .addScaledVector(
                    right,
                    botRadius * 0.72
                );


        const leftFrontClearance =
            this.getObstacleClearance(
                leftOrigin,
                forward,
                forwardDistance
            );


        const rightFrontClearance =
            this.getObstacleClearance(
                rightOrigin,
                forward,
                forwardDistance
            );


        const frontClearance =
            Math.min(
                centerClearance,
                leftFrontClearance,
                rightFrontClearance
            );


        // ----------------------------------------------------
        // 前方畅通
        // ----------------------------------------------------

        if (
            frontClearance >=
            forwardDistance * 0.92
        ) {

            this.avoidSideTimer =
                Math.max(
                    0,
                    this.avoidSideTimer -
                    delta
                );


            return desiredDirection;
        }


        // ----------------------------------------------------
        // 多角度绕障候选
        // ----------------------------------------------------

        const probeDistance =
            4.0 +
            botRadius;


        const angles = [
            Math.PI * 0.18,   // ~32°
            Math.PI * 0.29,   // ~52°
            Math.PI * 0.40    // ~72°
        ];


        const testSide =
            side => {

                let bestDirection =
                    null;

                let bestClearance =
                    -Infinity;

                let bestScore =
                    -Infinity;


                for (
                    const angle
                    of angles
                ) {

                    const direction =
                        forward
                            .clone()
                            .applyAxisAngle(
                                new THREE.Vector3(
                                    0,
                                    1,
                                    0
                                ),
                                angle *
                                side
                            )
                            .normalize();


                    const clearance =
                        this.getObstacleClearance(
                            origin,
                            direction,
                            probeDistance
                        );


                    /*
                     * direction.dot(forward) 越大，
                     * 说明这个方向在绕墙的同时仍然向目标前进。
                     */
                    const progress =
                        Math.max(
                            0,
                            direction.dot(
                                forward
                            )
                        );


                    const score =
                        clearance +
                        progress * 0.85;


                    if (
                        score >
                        bestScore
                    ) {

                        bestScore =
                            score;

                        bestClearance =
                            clearance;

                        bestDirection =
                            direction;
                    }
                }


                return {
                    direction:
                        bestDirection,

                    clearance:
                        bestClearance,

                    score:
                        bestScore
                };
            };


        const left =
            testSide(
                1
            );


        const rightResult =
            testSide(
                -1
            );


        // ----------------------------------------------------
        // 如果已经选择过一侧，短时间内坚持同侧。
        //
        // 这是防止左右每帧切换的关键。
        // ----------------------------------------------------

        if (
            this.avoidSideTimer >
            0
        ) {

            this.avoidSideTimer -=
                delta;


            const locked =
                this.avoidSide < 0
                    ? left
                    : rightResult;


            if (
                locked.direction &&
                locked.clearance >
                botRadius * 1.20
            ) {

                return locked.direction;
            }
        }


        // ----------------------------------------------------
        // 选择更有空间的一侧
        // ----------------------------------------------------

        const chooseLeft =
            left.score >
            rightResult.score +
            0.12;


        const chooseRight =
            rightResult.score >
            left.score +
            0.12;


        if (
            chooseLeft
        ) {

            this.avoidSide =
                -1;

            this.avoidSideTimer =
                1.05;

            return (
                left.direction ||
                desiredDirection
            );
        }


        if (
            chooseRight
        ) {

            this.avoidSide =
                1;

            this.avoidSideTimer =
                1.05;

            return (
                rightResult.direction ||
                desiredDirection
            );
        }


        /*
         * 两边差不多时不要随机。
         * 继续保持上一次绕行侧。
         */
        this.avoidSideTimer =
            0.85;


        if (
            this.avoidSide < 0
        ) {

            return (
                left.direction ||
                rightResult.direction ||
                desiredDirection
            );
        }


        return (
            rightResult.direction ||
            left.direction ||
            desiredDirection
        );
    }


    // ========================================================
    // Obstacle Clearance
    // ========================================================

    getObstacleClearance(
        origin,
        direction,
        maxDistance
    ) {

        if (
            !origin ||
            !direction ||
            maxDistance <= 0
        ) {

            return 0;
        }


        this.obstacleRaycaster.set(
            origin,
            direction
        );


        this.obstacleRaycaster.near =
            0.02;


        this.obstacleRaycaster.far =
            maxDistance;


        const hits =
            this.obstacleRaycaster
                .intersectObjects(
                    this.collisionObjects,
                    true
                );


        if (
            hits.length === 0
        ) {

            return maxDistance;
        }


        return Math.min(
            maxDistance,
            Math.max(
                0,
                hits[0].distance
            )
        );
    }


    // ========================================================
    // Stuck Detection - Navigation V2
    // ========================================================

    updateStuckDetection(
        delta,
        currentPosition
    ) {

        if (!currentPosition) {
            return;
        }


        // ----------------------------------------------------
        // 连续卡住计数窗口
        // ----------------------------------------------------

        if (
            this.navigationStuckWindow >
            0
        ) {

            this.navigationStuckWindow -=
                delta;


            if (
                this.navigationStuckWindow <=
                0
            ) {

                this.navigationStuckCount =
                    0;
            }
        }


        const movedDistance =
            currentPosition
                .distanceTo(
                    this.lastObservedPosition
                );


        if (
            movedDistance <
            this.stuckDistanceThreshold
        ) {

            this.stuckTimer +=
                delta;

        } else {

            this.stuckTimer =
                Math.max(
                    0,
                    this.stuckTimer -
                    delta * 4
                );
        }


        this.lastObservedPosition
            .copy(
                currentPosition
            );


        if (
            this.stuckTimer <
            this.stuckThreshold
        ) {

            return;
        }


        this.stuckTimer = 0;


        this.navigationStuckCount++;

        this.navigationStuckWindow =
            3.5;


        // ----------------------------------------------------
        // 连续三次在同一区域卡住：
        // 不要继续围着同一个 PatrolPoint 打转。
        // ----------------------------------------------------

        if (
            this.navigationStuckCount >=
            3
        ) {

            this.navigationStuckCount =
                0;


            this.clearEscapeState();


            /*
             * 强制换绕行侧。
             */
            this.avoidSide *=
                -1;

            this.avoidSideTimer =
                0;


            if (
                this.state.is(
                    BOT_STATE.PATROL
                )
            ) {

                this.clearNavigationPath();

                this.pickRandomPatrolPoint();

                return;
            }


            if (
                this.state.is(
                    BOT_STATE.ALERT
                )
            ) {

                /*
                 * ALERT 目标如果导致 BOT 连续卡住，
                 * 直接恢复巡逻，避免在墙后一个点无限绕。
                 */
                this.alertPosition =
                    null;

                this.alertTimer =
                    0;

                this.clearNavigationPath();

                this.state.setState(
                    BOT_STATE.PATROL
                );

                this.pickRandomPatrolPoint();

                return;
            }
        }


        this.createEscapePoint();
    }


    // ========================================================
    // Reset stuck state
    // ========================================================

    resetStuckDetection(
        resetPosition = true
    ) {

        this.stuckTimer =
            0;


        if (
            resetPosition &&
            this.bot
        ) {

            this.lastObservedPosition
                .copy(
                    this.bot.getPosition()
                );
        }
    }


    // ========================================================
    // Create Escape Point - Navigation V2
    //
    // 不再只做“左右 + 后退”。
    // 从多个方向探测真实可用空间，选择最宽的逃生方向。
    //
    // forceDifferent=true 时：
    // 会额外惩罚与上一条逃生方向太接近的候选，
    // 防止连续选择同一方向形成循环。
    // ========================================================

    createEscapePoint(
        forceDifferent = false
    ) {

        const position =
            this.bot
                .getPosition();


        let forward =
            this.currentMoveDirection
                .clone();


        if (
            forward.lengthSq() <
            0.001
        ) {

            forward =
                this.bot
                    .getForwardDirection()
                    .clone();
        }


        forward.y = 0;


        if (
            forward.lengthSq() <
            0.001
        ) {

            forward.set(
                0,
                0,
                -1
            );
        }


        forward.normalize();


        const origin =
            position.clone();

        origin.y +=
            0.85;


        /*
         * 候选角度：
         *
         * ±60°  = 斜向绕开
         * ±90°  = 纯横移
         * ±125° = 横移 + 后退
         * 180°  = 直接后退
         */
        const candidateAngles = [
            Math.PI * 0.33,
            -Math.PI * 0.33,

            Math.PI * 0.50,
            -Math.PI * 0.50,

            Math.PI * 0.69,
            -Math.PI * 0.69,

            Math.PI
        ];


        let bestDirection =
            null;

        let bestClearance =
            0;

        let bestScore =
            -Infinity;


        for (
            const angle
            of candidateAngles
        ) {

            const direction =
                forward
                    .clone()
                    .applyAxisAngle(
                        new THREE.Vector3(
                            0,
                            1,
                            0
                        ),
                        angle
                    )
                    .normalize();


            const clearance =
                this.getObstacleClearance(
                    origin,
                    direction,
                    5.5
                );


            if (
                clearance <
                1.1
            ) {

                continue;
            }


            let score =
                clearance;


            /*
             * 轻微偏好侧向/斜向，
             * 不要每次都纯后退。
             */
            const forwardDot =
                direction.dot(
                    forward
                );


            if (
                forwardDot >
                -0.35
            ) {

                score +=
                    0.30;
            }


            /*
             * 强制换方向时，
             * 如果候选和上一条 escape direction 太接近，
             * 大幅降分。
             */
            if (
                forceDifferent &&
                this.lastEscapeDirection
                    .lengthSq() >
                    0.01
            ) {

                const sameDirection =
                    direction.dot(
                        this.lastEscapeDirection
                    );


                if (
                    sameDirection >
                    0.72
                ) {

                    score -=
                        3.0;
                }
            }


            const travelDistance =
                Math.min(
                    4.2,
                    Math.max(
                        1.4,
                        clearance -
                        0.55
                    )
                );


            const candidatePoint =
                position
                    .clone()
                    .addScaledVector(
                        direction,
                        travelDistance
                    );


            if (
                this.isPositionInsideObstacle(
                    candidatePoint,
                    0.60
                )
            ) {

                continue;
            }


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;

                bestClearance =
                    clearance;

                bestDirection =
                    direction;
            }
        }


        // ----------------------------------------------------
        // 实在没有合适方向：
        // 直接反转之前绕行侧，做一个短距离侧后方移动。
        // ----------------------------------------------------

        if (!bestDirection) {

            this.avoidSide *=
                -1;


            bestDirection =
                forward
                    .clone()
                    .applyAxisAngle(
                        new THREE.Vector3(
                            0,
                            1,
                            0
                        ),
                        this.avoidSide *
                        Math.PI *
                        0.62
                    )
                    .normalize();


            bestClearance =
                2.2;
        }


        const escapeDistance =
            Math.min(
                4.0,
                Math.max(
                    1.6,
                    bestClearance -
                    0.45
                )
            );


        const escapePoint =
            position
                .clone()
                .addScaledVector(
                    bestDirection,
                    escapeDistance
                );


        this.escapePoint =
            escapePoint;


        this.escapeTimer =
            1.65;


        this.escapeNoProgressTimer =
            0;


        this.escapeLastPosition.copy(
            position
        );


        this.lastEscapeDirection.copy(
            bestDirection
        );


        /*
         * 根据逃生方向相对 forward 的左右侧，
         * 更新 avoidSide，让脱困后的绕行方向保持一致。
         */
        const crossY =
            forward.x *
            bestDirection.z -
            forward.z *
            bestDirection.x;


        if (
            Math.abs(
                crossY
            ) >
            0.05
        ) {

            this.avoidSide =
                crossY > 0
                    ? -1
                    : 1;
        }


        this.avoidSideTimer =
            1.15;


        this.bot.setCrouching(
            false
        );


        gameEvents.emit(
            "bot:stuck",
            {
                bot:
                    this.bot,

                escapePoint:
                    escapePoint.clone(),

                navigationV2:
                    true
            }
        );
    }


    // ========================================================
    // Position vs obstacle
    //
    // 用于巡逻点和 EscapePoint 过滤。
    // ========================================================

    isPositionInsideObstacle(
        position,
        radius = 0.5
    ) {

        if (
            !position ||
            !this.collisionObjects
        ) {

            return false;
        }


        for (
            const object
            of this.collisionObjects
        ) {

            if (!object) {
                continue;
            }


            const box =
                new THREE.Box3()
                    .setFromObject(
                        object
                    );


            /*
             * 只关心水平方向。
             *
             * BOT 的移动目前基本是平面移动。
             */
            if (
                position.x >=
                    box.min.x -
                    radius &&

                position.x <=
                    box.max.x +
                    radius &&

                position.z >=
                    box.min.z -
                    radius &&

                position.z <=
                    box.max.z +
                    radius
            ) {

                return true;
            }
        }


        return false;
    }


    // ========================================================
    // Aim
    // ========================================================

    // ========================================================
	// Target Aim
	// ========================================================

	updateTargetAim(
		targetPosition
	) {

		const origin =
			this.bot
				.getEyePosition();


		let aimPoint;


		/*
		 * 如果当前目标提供胸口位置，
		 * 优先直接瞄准胸口 Hitbox。
		 */
		if (
			this.target &&
			typeof this.target
				.getChestPosition ===
				"function"
		) {

			aimPoint =
				this.target
					.getChestPosition();

		} else {

			aimPoint =
				targetPosition
					.clone();


			/*
			 * 没有 chestPosition 时，
			 * 默认抬高到胸口附近。
			 */
			aimPoint.y +=
				1.0;
		}


		this.desiredAimDirection
			.copy(
				aimPoint
					.clone()
					.sub(
						origin
					)
					.normalize()
			);
	}


    updateAim(delta) {

        const smoothing =
            Math.min(
                1,
                delta * 10
            );


        this.aimDirection.lerp(
            this.desiredAimDirection,
            smoothing
        );


        if (
            this.aimDirection.lengthSq() >
            0.0001
        ) {

            this.aimDirection.normalize();
        }


        this.bot.setAimDirection(
            this.aimDirection
        );
    }


	// ========================================================
	// Shooting
	// ========================================================

	tryFire(distance) {

		const weapon =
			this.bot
				.inventory
				.currentWeapon;


		if (!weapon) {
			return;
		}


		// ====================================================
		// Reaction Time
		//
		// BOT 看见敌人以后不能马上射击。
		// ====================================================

		if (
			this.reactionTimer >
			0
		) {

			return;
		}


		// ====================================================
		// Burst Pause
		// ====================================================

		if (
			this.burstPauseTimer >
			0
		) {

			return;
		}


		// ====================================================
		// Knife
		// ====================================================

		if (
			weapon.id ===
			"knife" &&
			distance > 2.3
		) {

			if (
				typeof this.bot
					.equipPrimary ===
				"function"
			) {

				const equipped =
					this.bot
						.equipPrimary();


				if (equipped) {
					return;
				}
			}


			if (
				typeof this.bot
					.equipSecondary ===
				"function"
			) {

				this.bot
					.equipSecondary();

				return;
			}
		}


		// ====================================================
		// Empty / Reload
		// ====================================================

		if (
			weapon.clipAmmo <= 0
		) {

			weapon.releaseTrigger?.();


			if (
				weapon.reserveAmmo >
				0
			) {

				weapon.reload();


				this.state.setState(
					BOT_STATE.RELOAD
				);
			}


			return;
		}


		// ====================================================
		// Fire Decision Cooldown
		// ====================================================

		if (
			!this
				.fireDecisionCooldown
				.tryTrigger()
		) {

			return;
		}


		// ====================================================
		// Burst limit
		// ====================================================

		if (
			this.burstShots >=
			this.burstLimit
		) {

			this.resetFireBurst();

			return;
		}


		// ====================================================
		// Origin
		// ====================================================

		const origin =
			this.bot
				.getEyePosition();


		let direction =
			this.bot
				.getAimDirection()
				.clone();


		if (
			direction.lengthSq() <
			0.0001
		) {

			return;
		}


		direction.normalize();


		// ====================================================
		// Difficulty
		// ====================================================

		const difficulty =
			this.getShootingDifficulty();


		const accuracy =
			BOT_CONFIG
				.accuracy[
					difficulty
				] ??
			0.48;


		const baseAimError =
			BOT_CONFIG
				.aimError[
					difficulty
				] ??
			0.11;


		// ====================================================
		// Distance Error
		//
		// 距离越远越不准。
		// ====================================================

		const errorStart =
			BOT_CONFIG.shooting
				?.distanceErrorStart ??
			12;


		const errorMaxDistance =
			BOT_CONFIG.shooting
				?.distanceErrorMax ??
			45;


		const distanceFactor =
			clamp(
				(
					distance -
					errorStart
				)
				/
				(
					errorMaxDistance -
					errorStart
				),
				0,
				1
			);


		let aimError =
			baseAimError *
			(
				1 +
				distanceFactor *
				(
					BOT_CONFIG.shooting
						?.distanceErrorMultiplier ??
					0.75
				)
			);


		// ====================================================
		// Accuracy roll
		//
		// 命中 accuracy 概率时只是小幅偏移，
		// miss 时产生明显偏移。
		// ====================================================

		const accurateShot =
			chance(
				accuracy
			);


		if (
			accurateShot
		) {

			/*
			 * 即使“命中枪”也不要数学级精准。
			 */
			aimError *=
				0.30;

		} else {

			/*
			 * Miss shot。
			 */
			aimError *=
				randomRange(
					1.0,
					1.8
				);
		}


		// ====================================================
		// Apply Aim Error
		//
		// x = 左右
		// y = 上下
		//
		// 不修改 z，避免完全反向射击。
		// ====================================================

		direction.x +=
			randomRange(
				-aimError,
				aimError
			);


		direction.y +=
			randomRange(
				-aimError * 0.70,
				aimError * 0.70
			);


		direction.normalize();


		// ====================================================
		// Trigger
		// ====================================================

		weapon.pressTrigger?.();


		const result =
			weaponSystem.fire(
				weapon,
				{
					origin,

					direction,

					/*
					 * BOT移动时进一步降低枪械精度。
					 */
					movementFactor:
						this.bot.isMoving
							? 0.45
							: 0,

					crouching:
						this.bot
							.isCrouching,

					airborne:
						false
				}
			);


		// ====================================================
		// Trigger release
		// ====================================================

		weapon.releaseTrigger?.();


		// ====================================================
		// Successful shot
		//
		// 只有真正 fired 才计入 Burst。
		// ====================================================

		if (
			result?.fired
		) {

			this.burstShots++;


			/*
			 * 一轮射击结束。
			 */
			if (
				this.burstShots >=
				this.burstLimit
			) {

				this.resetFireBurst();
			}
		}


		return result;
	}


    // ========================================================
    // Reload
    // ========================================================

    updateReload(delta) {

        const weapon =
            this.bot
                .inventory
                .currentWeapon;


        if (!weapon) {

            this.state.setState(
                BOT_STATE.PATROL
            );

            return;
        }


        this.bot.stopMoving();

        this.resetStuckDetection(
            false
        );


        if (
            !weapon.isReloading
        ) {

            if (
                this.target &&
                this._isEntityAlive(
                    this.target
                )
            ) {

                this.state.setState(
                    BOT_STATE.COMBAT
                );

            } else {

                this.state.setState(
                    BOT_STATE.PATROL
                );
            }
        }
    }


    // ========================================================
    // Retreat
    // ========================================================

    shouldRetreat() {

        const personality =
            BOT_CONFIG
                .personalities[
                    this.bot.personality
                ] ||
            BOT_CONFIG
                .personalities
                .balanced;


        return (
            this.bot.hp <
            personality
                .retreatThreshold
        );
    }


    enterRetreat() {

        this.state.setState(
            BOT_STATE.RETREAT
        );


        this.sendRadio(
            "Need backup!",
            {
                event:
                    "backup"
            }
        );
    }


    updateRetreat(delta) {

        if (
            !this.target ||
            !this._isEntityAlive(
                this.target
            )
        ) {

            this.state.setState(
                BOT_STATE.PATROL
            );

            return;
        }


        const enemyPosition =
            this._getEntityPosition(
                this.target
            );


        if (!enemyPosition) {

            this.state.setState(
                BOT_STATE.PATROL
            );

            return;
        }


        const position =
            this.bot
                .getPosition();


        const retreatDirection =
            position
                .clone()
                .sub(
                    enemyPosition
                );


        retreatDirection.y = 0;


        if (
            retreatDirection.lengthSq() >
            0.0001
        ) {

            retreatDirection.normalize();


            this.moveSmart(
                retreatDirection,
                delta,
                BOT_CONFIG.retreatSpeed
            );
        }


        this.bot.facePositionSmooth(
            enemyPosition,
            delta
        );


        const distance =
            position.distanceTo(
                enemyPosition
            );


        if (
            distance >
            30
        ) {

            this.state.setState(
                BOT_STATE.COMBAT
            );
        }
    }


    // ========================================================
    // Grenade AI
    // ========================================================

    tryThrowGrenade(
        targetPosition,
        distance
    ) {

        if (
            distance < 8 ||
            distance > 28
        ) {
            return;
        }


        if (
            !this.bot
                .grenadeInventory
                .has(
                    GRENADE_TYPE.HE
                )
        ) {
            return;
        }


        if (
            !this
                .grenadeDecisionCooldown
                .tryTrigger()
        ) {
            return;
        }


        if (
            !chance(
                0.22
            )
        ) {
            return;
        }


        const origin =
            this.bot
                .getEyePosition();


        const direction =
            targetPosition
                .clone()
                .add(
                    new THREE.Vector3(
                        0,
                        1.2,
                        0
                    )
                )
                .sub(
                    origin
                )
                .normalize();


        grenadeSystem
            .throwFromInventory({
                inventory:
                    this.bot
                        .grenadeInventory,

                type:
                    GRENADE_TYPE.HE,

                owner:
                    this.bot,

                origin,

                direction,

                strength:
                    randomRange(
                        0.85,
                        1
                    )
            });
    }


    // ========================================================
    // Find Enemy
    // ========================================================

    findBestVisibleEnemy() {

        const candidates =
            this.getEnemyEntities();


        let best = null;

        let bestDistance =
            Infinity;


        for (
            const entity
            of candidates
        ) {

            if (
                !this._isEntityAlive(
                    entity
                )
            ) {
                continue;
            }


            const targetPosition =
                this._getEntityPosition(
                    entity
                );


            if (!targetPosition) {
                continue;
            }


            const distance =
                this.bot
                    .getPosition()
                    .distanceTo(
                        targetPosition
                    );


            if (
                distance >
                BOT_CONFIG
                    .visionDistance
            ) {
                continue;
            }


            if (
                !this.isInsideFOV(
                    entity
                )
            ) {
                continue;
            }


            if (
                !this.hasLineOfSightTo(
                    entity
                )
            ) {
                continue;
            }


            if (
                distance <
                bestDistance
            ) {

                best =
                    entity;


                bestDistance =
                    distance;
            }
        }


        return best;
    }


    // ========================================================
    // Enemy List
    // ========================================================

    getEnemyEntities() {

        const enemies = [];


        if (
            this.player &&
            this.player.isAlive &&
            this.player.team !==
            this.bot.team
        ) {

            enemies.push(
                this.player
            );
        }


        for (
            const otherBot
            of this.bots
        ) {

            if (
                !otherBot ||
                otherBot ===
                this.bot
            ) {
                continue;
            }


            if (
                otherBot.team ===
                this.bot.team
            ) {
                continue;
            }


            if (
                !otherBot.isAlive
            ) {
                continue;
            }


            enemies.push(
                otherBot
            );
        }


        return enemies;
    }


    // ========================================================
    // FOV
    // ========================================================

    isInsideFOV(entity) {

        const targetPosition =
            this._getEntityPosition(
                entity
            );


        if (!targetPosition) {
            return false;
        }


        const origin =
            this.bot
                .getEyePosition();


        const direction =
            targetPosition
                .clone()
                .sub(
                    origin
                )
                .normalize();


        const forward =
            this.bot
                .getForwardDirection();


        const angle =
            forward.angleTo(
                direction
            );


        const fovDegrees =
            this.state.is(
                BOT_STATE.COMBAT
            )
                ? BOT_CONFIG
                    .fieldOfView
                    .combat

                : BOT_CONFIG
                    .fieldOfView
                    .patrol;


        const halfFov =
            THREE
                .MathUtils
                .degToRad(
                    fovDegrees / 2
                );


        return (
            angle <=
            halfFov
        );
    }


    // ========================================================
    // Line Of Sight
    // ========================================================

    hasLineOfSightTo(entity) {

    const targetPosition =
        this._getEntityAimPosition(
            entity
        );


    if (!targetPosition) {
        return false;
    }


    const origin =
        this.bot
            .getEyePosition();


    const direction =
        targetPosition
            .clone()
            .sub(
                origin
            );


    const distance =
        direction.length();


    if (
        distance <=
        0.01
    ) {

        return true;
    }


    direction.normalize();


    /*
     * 这里不要把目标模型加入 Raycaster。
     *
     * BOT 判断“能不能看到敌人”真正需要检查的是：
     *
     * BOT -------- 墙 -------- Enemy
     *
     * 中间有没有地图障碍物。
     *
     * 不要求射线一定命中 Enemy Mesh，
     * 因为 Player 和 BOT 模型结构并不完全相同。
     */

    this.visionRaycaster.set(
        origin,
        direction
    );


    this.visionRaycaster.near =
        0.05;


    /*
     * 稍微缩短一点。
     *
     * 避免目标自己贴着墙时，
     * 墙面被误认为挡住目标。
     */
    this.visionRaycaster.far =
        Math.max(
            0,
            distance - 0.35
        );


    const hits =
        this.visionRaycaster
            .intersectObjects(
                this.collisionObjects,
                true
            );


    /*
     * 没有地图物体挡住
     * = 视线清晰
     */
    return (
        hits.length === 0
    );
}


	// ========================================================
	// Enter Combat
	// ========================================================

	enterCombat(enemy) {

		if (!enemy) {
			return;
		}


        /*
         * 近距离战斗使用原来的 Combat movement，
         * 不让旧 Patrol/Alert A* 路径继续影响移动。
         */
        this.clearNavigationPath();


		/*
		 * 进入本函数之前是否已经处于 COMBAT。
		 *
		 * 用于判断：
		 * - 是否需要重新设置 Reaction Time
		 * - 是否需要发送 Enemy Spotted Radio
		 */
		const wasCombat =
			this.state.is(
				BOT_STATE.COMBAT
			);


		/*
		 * 是否属于一个“新的战斗目标”。
		 *
		 * 情况包括：
		 * 1. 之前不是 COMBAT
		 * 2. 当前目标发生变化
		 */
		const newEnemy =
			!wasCombat ||
			this.target !== enemy;


		// ====================================================
		// Target
		// ====================================================

        this.clearSupportTarget();


		this.target =
			enemy;


		this.bot.currentTarget =
			enemy;


		this.lastKnownPosition =
			this._getEntityPosition(
				enemy
			);


		// ====================================================
		// Reaction / Burst
		//
		// 第一次看到敌人，或者换目标时，
		// BOT不能立即开枪。
		// ====================================================

		if (
			newEnemy
		) {

			this.resetReactionTimer();


			this.burstShots =
				0;


			this.burstPauseTimer =
				0;
		}


		// ====================================================
		// Combat State
		// ====================================================

		this.combatTime =
			0;


		this.timeSinceEnemySeen =
			0;


		this.state.setState(
			BOT_STATE.COMBAT
		);


		// ====================================================
		// Navigation
		// ====================================================

		this.resetStuckDetection();


		// ====================================================
		// Radio
		//
		// 只有从非 COMBAT 状态进入战斗时才广播。
		// ====================================================

		if (
			!wasCombat
		) {

			this.enemySpottedRadioSent =
				false;


			this.tryEnemySpottedRadio();
		}
	}


    // ========================================================
    // Leave Combat
    // ========================================================

    leaveCombat() {

        this.clearNavigationPath();


        this.target = null;


        this.bot.currentTarget =
            null;


        this.bot.setCrouching(
            false
        );


        this.bot.stopMoving();


        this.resetStuckDetection();


        if (
            this.lastKnownPosition
        ) {

            this.alertPosition =
                this.lastKnownPosition
                    .clone();


            this.alertTimer =
                3;


            this.state.setState(
                BOT_STATE.ALERT
            );

        } else {

            this.state.setState(
                BOT_STATE.PATROL
            );
        }
    }


    // ========================================================
    // Tactical V1 - Team Support
    // ========================================================

    findSupportRequest() {

        if (
            !this.bots ||
            this.bots.length ===
                0
        ) {

            return null;
        }


        const myPosition =
            this.bot
                .getPosition();


        let best =
            null;

        let bestDistance =
            Infinity;


        for (
            const teammate
            of this.bots
        ) {

            if (
                !teammate ||
                teammate ===
                    this.bot ||
                !teammate.isAlive ||
                teammate.team !==
                    this.bot.team
            ) {

                continue;
            }


            /*
             * enterCombat() 会给 bot.currentTarget 赋值。
             * 这可以作为“队友正在交战”的轻量信号。
             */
            if (
                !teammate.currentTarget
            ) {

                continue;
            }


            const teammatePosition =
                teammate
                    .getPosition();


            const distance =
                myPosition
                    .distanceTo(
                        teammatePosition
                    );


            // --------------------------------------------
            // 不同角色的支援半径
            // --------------------------------------------

            let maxDistance =
                24;


            if (
                this.tacticalRole ===
                BOT_TACTICAL_ROLE.SUPPORT
            ) {

                maxDistance =
                    36;

            } else if (
                this.tacticalRole ===
                    BOT_TACTICAL_ROLE.ATTACK
            ) {

                maxDistance =
                    28;

            } else {

                maxDistance =
                    17;
            }


            if (
                distance >
                    maxDistance ||
                distance >=
                    bestDistance
            ) {

                continue;
            }


            /*
             * 不是所有 ATTACK / HOLD 都响应，
             * 防止一名队友交战就把整队吸过去。
             */
            if (
                this.tacticalRole ===
                    BOT_TACTICAL_ROLE.ATTACK &&
                !chance(
                    0.45
                )
            ) {

                continue;
            }


            if (
                this.tacticalRole ===
                    BOT_TACTICAL_ROLE.HOLD &&
                !chance(
                    0.22
                )
            ) {

                continue;
            }


            best = {
                bot:
                    teammate,

                position:
                    teammatePosition.clone(),

                distance
            };


            bestDistance =
                distance;
        }


        return best;
    }


    beginSupport(
        teammate,
        position
    ) {

        if (
            !teammate ||
            !position
        ) {

            return false;
        }


        /*
         * Manager 会限制同一名队友能吸引多少支援 BOT。
         */
        if (
            this.tacticalManager &&
            typeof this.tacticalManager
                .canSupportBot ===
                "function" &&
            !this.tacticalManager
                .canSupportBot(
                    this.bot,
                    teammate
                )
        ) {

            return false;
        }


        this.supportTargetBot =
            teammate;


        this.supportPosition =
            position.clone();


        /*
         * 给支援点一点横向扰动，
         * 避免两个 SUPPORT BOT 完全跑到同一个坐标。
         */
        this.supportPosition.x +=
            randomRange(
                -2.2,
                2.2
            );


        this.supportPosition.z +=
            randomRange(
                -2.2,
                2.2
            );


        this.supportTimer =
            randomRange(
                4.5,
                7.0
            );


        this.clearNavigationPath();


        return true;
    }


    clearSupportTarget() {

        this.supportTargetBot =
            null;


        this.supportPosition =
            null;


        this.supportTimer =
            0;
    }


    // ========================================================
    // Tactical V1 - Patrol scoring
    // ========================================================

    scoreTacticalPatrolNode(
        node,
        currentPosition,
        reservedGoalIds
    ) {

        const distance =
            node.position
                .distanceTo(
                    currentPosition
                );


        const range =
            this.tacticalPatrolRanges[
                this.tacticalRole
            ] ||
            this.tacticalPatrolRanges[
                BOT_TACTICAL_ROLE.ATTACK
            ];


        if (
            distance <
                range.min ||
            distance >
                range.max
        ) {

            return -Infinity;
        }


        let score =
            distance;


        // ----------------------------------------------------
        // 其他队友已占用相同目标：
        // 大幅降分，但不是绝对禁止，
        // 防止地图候选点过少时完全无路可选。
        // ----------------------------------------------------

        if (
            reservedGoalIds.has(
                node.id
            )
        ) {

            score -=
                45;
        }


        // ----------------------------------------------------
        // 最近走过的目标降分
        // ----------------------------------------------------

        if (
            this.recentPatrolGoalNodeIds
                .includes(
                    node.id
                )
        ) {

            score -=
                35;
        }


        // ----------------------------------------------------
        // ATTACK
        //
        // CT 出生在负 Z，T 出生在正 Z。
        // 攻击角色倾向向敌方半场推进。
        // ----------------------------------------------------

        if (
            this.tacticalRole ===
            BOT_TACTICAL_ROLE.ATTACK
        ) {

            const attackProgress =
                this.bot.team ===
                    TEAM.CT
                    ? node.position.z
                    : -node.position.z;


            score +=
                attackProgress *
                0.65;
        }


        // ----------------------------------------------------
        // SUPPORT
        //
        // 更偏向中距离节点，
        // 避免永远冲到地图最远端。
        // ----------------------------------------------------

        if (
            this.tacticalRole ===
            BOT_TACTICAL_ROLE.SUPPORT
        ) {

            score -=
                Math.abs(
                    distance -
                    24
                ) *
                0.45;
        }


        // ----------------------------------------------------
        // HOLD
        //
        // 偏向己方半场，并且不需要走太远。
        // ----------------------------------------------------

        if (
            this.tacticalRole ===
            BOT_TACTICAL_ROLE.HOLD
        ) {

            const ownSideBias =
                this.bot.team ===
                    TEAM.CT
                    ? -node.position.z
                    : node.position.z;


            score +=
                ownSideBias *
                0.55;


            score -=
                distance *
                0.25;
        }


        score +=
            randomRange(
                -2.5,
                2.5
            );


        return score;
    }


    // ========================================================
    // Hear Gunfire
    // ========================================================

    hearGunfire(position) {

        if (
            !position ||
            this.state.is(
                BOT_STATE.COMBAT
            )
        ) {
            return;
        }


        this.clearNavigationPath();


        this.alertPosition =
            position.clone();


        this.alertTimer =
            5;


        this.state.setState(
            BOT_STATE.ALERT
        );


        this.resetStuckDetection();
    }


    // ========================================================
    // Patrol Point
    //
    // 有 Navigation Graph 时：
    // 直接选择一个较远 Waypoint 作为巡逻目标，
    // 确保目标一定属于可寻路网络。
    //
    // 无 Graph 时：
    // 保留旧随机坐标 fallback。
    // ========================================================

    pickRandomPatrolPoint() {

        const current =
            this.bot
                .getPosition();


        // ====================================================
        // Tactical V1 + Navigation V4
        // ====================================================

        if (
            this.navigationGraph
        ) {

            const nodes =
                this.navigationGraph
                    .getNodes();


            const nearestNode =
                this.navigationGraph
                    .findNearestNode(
                        current
                    );


            const reservedGoalIds =
                this.tacticalManager &&
                typeof this.tacticalManager
                    .getReservedPatrolGoalNodeIds ===
                    "function"
                    ? this.tacticalManager
                        .getReservedPatrolGoalNodeIds(
                            this.bot.team,
                            this.bot
                        )
                    : new Set();


            const scored =
                [];


            for (
                const node
                of nodes
            ) {

                if (
                    nearestNode &&
                    node.id ===
                        nearestNode.id
                ) {

                    continue;
                }


                const score =
                    this.scoreTacticalPatrolNode(
                        node,
                        current,
                        reservedGoalIds
                    );


                if (
                    !Number.isFinite(
                        score
                    )
                ) {

                    continue;
                }


                scored.push({
                    node,
                    score
                });
            }


            /*
             * 如果角色限制太严格，
             * fallback 到旧 V4 逻辑可用的较远节点。
             */
            if (
                scored.length ===
                0
            ) {

                for (
                    const node
                    of nodes
                ) {

                    if (
                        nearestNode &&
                        node.id ===
                            nearestNode.id
                    ) {

                        continue;
                    }


                    const distanceSquared =
                        node.position
                            .distanceToSquared(
                                current
                            );


                    if (
                        distanceSquared <
                        8 * 8
                    ) {

                        continue;
                    }


                    let score =
                        Math.sqrt(
                            distanceSquared
                        );


                    if (
                        reservedGoalIds.has(
                            node.id
                        )
                    ) {

                        score -=
                            30;
                    }


                    scored.push({
                        node,
                        score
                    });
                }
            }


            if (
                scored.length >
                0
            ) {

                scored.sort(
                    (
                        a,
                        b
                    ) =>
                        b.score -
                        a.score
                );


                /*
                 * 从得分最高的前几个节点随机，
                 * 既有战术倾向，又不会每次完全相同。
                 */
                const poolSize =
                    Math.min(
                        scored.length,
                        this.tacticalRole ===
                            BOT_TACTICAL_ROLE.HOLD
                            ? 4
                            : 6
                    );


                const selectedEntry =
                    randomItem(
                        scored.slice(
                            0,
                            poolSize
                        )
                    );


                const selected =
                    selectedEntry
                        ?.node;


                if (
                    selected
                ) {

                    this.currentPatrolGoalNodeId =
                        selected.id;


                    this.recentPatrolGoalNodeIds
                        .push(
                            selected.id
                        );


                    while (
                        this.recentPatrolGoalNodeIds
                            .length >
                        4
                    ) {

                        this.recentPatrolGoalNodeIds
                            .shift();
                    }


                    this.patrolPoint
                        .copy(
                            selected.position
                        );


                    return;
                }
            }
        }


        // ====================================================
        // Fallback - old random walkable target
        // ====================================================

        const radius =
            BOT_CONFIG
                .patrol
                .radius;


        for (
            let i = 0;
            i < 25;
            i++
        ) {

            const candidate =
                current
                    .clone();


            candidate.x +=
                randomRange(
                    -radius / 2,
                    radius / 2
                );


            candidate.z +=
                randomRange(
                    -radius / 2,
                    radius / 2
                );


            candidate.y = 0;


            if (
                this.isPositionInsideObstacle(
                    candidate,
                    0.75
                )
            ) {

                continue;
            }


            if (
                candidate
                    .distanceToSquared(
                        current
                    ) <
                16
            ) {

                continue;
            }


            this.patrolPoint.copy(
                candidate
            );


            return;
        }


        const forward =
            this.bot
                .getForwardDirection();


        this.patrolPoint
            .copy(
                current
            )
            .addScaledVector(
                forward,
                5
            );
    }


    // ========================================================
    // Radio
    // ========================================================

    canUseRadio() {

        if (
            !BOT_CONFIG
                .radio
                .enabled
        ) {
            return false;
        }


        return this
            .radioCooldown
            .ready();
    }


    sendRadio(
        command,
        {
            force = false,
            event = null
        } = {}
    ) {

        if (
            !this.bot.isAlive
        ) {
            return false;
        }


        if (
            !force &&
            !this.radioCooldown
                .ready()
        ) {

            return false;
        }


        if (!force) {

            this.radioCooldown
                .trigger();
        }


        gameEvents.emit(
            GAME_EVENT.RADIO_SEND,
            {
                speaker:
                    this.bot,

                owner:
                    this.bot,

                text:
                    command,

                command,

                team:
                    this.bot.team,

                source:
                    "bot",

                event
            }
        );


        return true;
    }


    // ========================================================
    // Enemy Spotted
    // ========================================================

    tryEnemySpottedRadio() {

        if (
            !this
                .spottedRadioCooldown
                .ready()
        ) {
            return;
        }


        if (
            !chance(
                BOT_CONFIG
                    .radio
                    .spottedChance
            )
        ) {
            return;
        }


        const message =
            randomItem(
                RADIO_CONFIG
                    .botEvents
                    .enemySpotted
            );


        if (
            this.sendRadio(
                message,
                {
                    event:
                        "enemy-spotted"
                }
            )
        ) {

            this
                .spottedRadioCooldown
                .trigger();
        }
    }


    // ========================================================
    // Player Radio Response
    // ========================================================

    respondToRadio({
        sender,
        command
    } = {}) {

        if (
            !this.bot.isAlive
        ) {
            return false;
        }


        if (
            sender?.team &&
            sender.team !==
            this.bot.team
        ) {
            return false;
        }


        if (
            !chance(
                BOT_CONFIG
                    .radio
                    .replyChance
            )
        ) {
            return false;
        }


        let responsePool =
            RADIO_CONFIG
                .botEvents
                .acknowledge;


        if (
            /fall back|negative/i
                .test(
                    command || ""
                )
        ) {

            responsePool =
                RADIO_CONFIG
                    .botEvents
                    .negative;
        }


        const response =
            randomItem(
                responsePool
            );


        return this.sendRadio(
            response,
            {
                event:
                    "reply"
            }
        );
    }


    // ========================================================
    // Entity Helpers
    // ========================================================

    _getEntityPosition(entity) {

        if (!entity) {
            return null;
        }


        if (
            typeof entity
                .getPosition ===
            "function"
        ) {

            return entity
                .getPosition();
        }


        if (
            entity.group
                ?.position
                ?.isVector3
        ) {

            return entity
                .group
                .position
                .clone();
        }


        if (
            entity.position
                ?.isVector3
        ) {

            return entity
                .position
                .clone();
        }


        return null;
    }


    _getEntityAimPosition(entity) {

        if (!entity) {
            return null;
        }


        if (
            typeof entity
                .getChestPosition ===
            "function"
        ) {

            return entity
                .getChestPosition();
        }


        if (
            typeof entity
                .getEyePosition ===
            "function"
        ) {

            return entity
                .getEyePosition();
        }


        const position =
            this._getEntityPosition(
                entity
            );


        if (position) {

            position.y +=
                1.3;
        }


        return position;
    }


    _isEntityAlive(entity) {

        if (!entity) {
            return false;
        }


        if (
            entity.isAlive != null
        ) {

            return Boolean(
                entity.isAlive
            );
        }


        return (
            entity.hp == null ||
            entity.hp > 0
        );
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.navigationMap
            ?.clearBotNavigationDebug?.(
                this.bot
            );


        if (
            this._onWeaponFire
        ) {

            gameEvents.off(
                GAME_EVENT.WEAPON_FIRE,
                this._onWeaponFire
            );
        }


        if (
            this._onBotDamage
        ) {

            gameEvents.off(
                GAME_EVENT.BOT_DAMAGE,
                this._onBotDamage
            );
        }


        this.bot = null;

        this.player = null;

        this.target = null;

        this.bots = [];

        this.collisionObjects = [];

        this.navigationPath = [];

        this.navigationGraph = null;

        this.navigationMap = null;

        this.escapePoint = null;
    }
}


// ============================================================
// BotAIManager
// ============================================================

export class BotAIManager {

    constructor({
        player = null,
        collisionObjects = [],
        navigationGraph = null,
        navigationMap = null
    } = {}) {

        this.player =
            player;


        this.collisionObjects =
            collisionObjects || [];


        this.navigationGraph =
            navigationGraph;


        this.navigationMap =
            navigationMap;


        this.bots = [];


        this.aiControllers =
            new Map();


        this.enabled =
            true;


        // ====================================================
        // Tactical V1
        //
        // 五人队推荐分布：
        // ATTACK / SUPPORT / ATTACK / HOLD / SUPPORT
        // ====================================================

        this.tacticalRolePattern = [
            BOT_TACTICAL_ROLE.ATTACK,
            BOT_TACTICAL_ROLE.SUPPORT,
            BOT_TACTICAL_ROLE.ATTACK,
            BOT_TACTICAL_ROLE.HOLD,
            BOT_TACTICAL_ROLE.SUPPORT
        ];


        // ====================================================
        // Radio Reply
        // ====================================================

        this._onRadioSend =
            data => {

                /*
                 * BOT 发出的 Radio
                 * 不让其他 BOT 再回复，
                 * 防止无限机器人聊天。
                 */
                if (
                    data.source ===
                    "bot"
                ) {
                    return;
                }


                const sender =
                    data.speaker ||
                    data.owner;


                const command =
                    data.command ||
                    data.text;


                for (
                    const ai
                    of this
                        .aiControllers
                        .values()
                ) {

                    if (
                        ai.bot.team !==
                        sender?.team
                    ) {
                        continue;
                    }


                    if (
                        chance(
                            0.45
                        )
                    ) {

                        ai.respondToRadio({
                            sender,
                            command
                        });
                    }
                }
            };


        gameEvents.on(
            GAME_EVENT.RADIO_SEND,
            this._onRadioSend
        );
    }


    // ========================================================
    // Add BOT
    // ========================================================

    addBot(bot) {

        if (!bot) {
            return null;
        }


        if (
            this.aiControllers.has(
                bot
            )
        ) {

            return this
                .aiControllers
                .get(
                    bot
                );
        }


        const sameTeamCount =
            this.bots.filter(
                existing =>
                    existing?.team ===
                    bot.team
            ).length;


        const tacticalRole =
            this.tacticalRolePattern[
                sameTeamCount %
                this.tacticalRolePattern
                    .length
            ];


        this.bots.push(
            bot
        );


        const ai =
            new BotAI({
                bot,

                player:
                    this.player,

                bots:
                    this.bots,

                collisionObjects:
                    this.collisionObjects,

                navigationGraph:
                    this.navigationGraph,

                navigationMap:
                    this.navigationMap,

                tacticalManager:
                    this,

                tacticalRole
            });


        this.aiControllers.set(
            bot,
            ai
        );


        bot.tacticalRole =
            tacticalRole;


        if (
            bot.group
        ) {

            bot.group.userData
                .tacticalRole =
                tacticalRole;
        }


        gameEvents.emit(
            "bot:tactical-role",
            {
                bot,

                role:
                    tacticalRole,

                difficulty:
                    bot.difficulty ||
                    BOT_CONFIG.shooting
                        ?.difficulty ||
                    "normal"
            }
        );


        return ai;
    }


    // ========================================================
    // Tactical V1 - Reserved Patrol Goals
    //
    // BOT 选巡逻点时查询同队其他 BOT 当前的目标节点，
    // 用于降低全队选择同一个 Waypoint 的概率。
    // ========================================================

    getReservedPatrolGoalNodeIds(
        team,
        excludeBot = null
    ) {

        const ids =
            new Set();


        for (
            const ai
            of this.aiControllers
                .values()
        ) {

            if (
                !ai.bot ||
                ai.bot ===
                    excludeBot ||
                ai.bot.team !==
                    team ||
                !ai.bot.isAlive
            ) {

                continue;
            }


            if (
                ai.currentPatrolGoalNodeId
            ) {

                ids.add(
                    ai.currentPatrolGoalNodeId
                );
            }
        }


        return ids;
    }


    // ========================================================
    // Tactical V1 - Support limit
    //
    // 同一个交战队友最多吸引 2 个支援 BOT。
    // ========================================================

    canSupportBot(
        requesterBot,
        targetBot
    ) {

        if (
            !requesterBot ||
            !targetBot
        ) {

            return false;
        }


        let supporters =
            0;


        for (
            const ai
            of this.aiControllers
                .values()
        ) {

            if (
                ai.bot ===
                    requesterBot
            ) {

                continue;
            }


            if (
                ai.supportTargetBot ===
                    targetBot &&
                ai.supportTimer >
                    0
            ) {

                supporters++;
            }
        }


        return (
            supporters <
            2
        );
    }


    // ========================================================
    // Difficulty Debug
    // ========================================================

    getDifficultySummary() {

        const summary = {
            easy:
                0,

            normal:
                0,

            hard:
                0,

            expert:
                0
        };


        for (
            const bot
            of this.bots
        ) {

            const difficulty =
                bot?.difficulty ||
                "normal";


            if (
                summary[
                    difficulty
                ] != null
            ) {

                summary[
                    difficulty
                ]++;
            }
        }


        return summary;
    }


    // ========================================================
    // Remove BOT
    // ========================================================

    removeBot(bot) {

        const ai =
            this.aiControllers
                .get(
                    bot
                );


        if (ai) {

            ai.destroy();


            this.aiControllers.delete(
                bot
            );
        }


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
    // Set Player
    // ========================================================

    setPlayer(player) {

        this.player =
            player;


        for (
            const ai
            of this
                .aiControllers
                .values()
        ) {

            ai.player =
                player;
        }
    }


    // ========================================================
    // Set Collision Objects
    // ========================================================

    setCollisionObjects(
        objects
    ) {

        this.collisionObjects =
            objects || [];


        for (
            const ai
            of this
                .aiControllers
                .values()
        ) {

            ai.collisionObjects =
                this.collisionObjects;
        }
    }


    // ========================================================
    // Set Navigation
    // ========================================================

    setNavigation(
        navigationGraph,
        navigationMap = this.navigationMap
    ) {

        this.navigationGraph =
            navigationGraph || null;


        this.navigationMap =
            navigationMap || null;


        for (
            const ai
            of this
                .aiControllers
                .values()
        ) {

            ai.navigationGraph =
                this.navigationGraph;


            ai.navigationMap =
                this.navigationMap;


            ai.clearNavigationPath();
        }
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (!this.enabled) {
            return;
        }


        for (
            const ai
            of this
                .aiControllers
                .values()
        ) {

            ai.update(
                delta
            );
        }
    }


    // ========================================================
    // Enabled
    // ========================================================

    setEnabled(enabled) {

        this.enabled =
            Boolean(
                enabled
            );
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        for (
            const ai
            of this
                .aiControllers
                .values()
        ) {

            ai.destroy();
        }


        this.aiControllers.clear();


        this.bots.length =
            0;


        gameEvents.off(
            GAME_EVENT.RADIO_SEND,
            this._onRadioSend
        );


        this.navigationGraph =
            null;

        this.navigationMap =
            null;
    }
}


// ============================================================
// Default Export
// ============================================================

export default BotAI;