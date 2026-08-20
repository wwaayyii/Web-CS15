/**
 * Web-CS15
 * src/systems/economy.js
 *
 * 经济与购买系统
 *
 * 负责：
 * - 开局 $800
 * - 最大 $16000
 * - 回合胜利奖励
 * - 连败奖励
 * - 击杀奖励
 * - 武器购买
 * - 护甲购买
 * - 手雷购买
 * - BOT 自动购买
 * - Buy Time
 * - Buy Zone
 *
 * 不负责：
 * - Buy Menu DOM
 * - Round 胜负计算
 * - Weapon 射击逻辑
 */

import {
    ECONOMY_CONFIG,
    WEAPON_CONFIG,
    GRENADE_CONFIG,
    ROUND_CONFIG,
    TEAM,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    randomItem,
    weightedRandom,
    gameEvents
} from "../core/utils.js";

import {
    GRENADE_TYPE
} from "../weapons/grenade.js";


// ============================================================
// Purchase Result
// ============================================================

export const PURCHASE_RESULT = Object.freeze({
    SUCCESS: "SUCCESS",

    INVALID_BUYER: "INVALID_BUYER",

    DEAD: "DEAD",

    BUY_TIME_EXPIRED: "BUY_TIME_EXPIRED",

    NOT_IN_BUY_ZONE: "NOT_IN_BUY_ZONE",

    INVALID_ITEM: "INVALID_ITEM",

    TEAM_RESTRICTED: "TEAM_RESTRICTED",

    NOT_ENOUGH_MONEY: "NOT_ENOUGH_MONEY",

    ALREADY_OWNED: "ALREADY_OWNED",

    MAX_CARRY: "MAX_CARRY"
});


// ============================================================
// EconomySystem
// ============================================================

export class EconomySystem {

    constructor({
        roundSystem = null,
        map = null
    } = {}) {

        this.roundSystem =
            roundSystem;

        this.map =
            map;


        // ====================================================
        // Loss streak
        // ====================================================

        this.lossStreak = {
            [TEAM.CT]: 0,
            [TEAM.T]: 0
        };


        // ====================================================
        // Buy Time
        // ====================================================

        this.buyTimeLeft =
            ROUND_CONFIG.buyTime;

        this.buyTimeActive =
            false;


        // ====================================================
        // Settings
        // ====================================================

        this.enforceBuyZone =
            true;

        this.enforceBuyTime =
            true;


        // ====================================================
        // Event handlers
        // ====================================================

        this._onRoundFreeze =
            data => {

                this.beginBuyTime();
            };


        this._onRoundStart =
            data => {

                /*
                 * CS 风格：
                 * Buy Time 可以继续一段时间，
                 * 不一定 Round Start 就关闭。
                 *
                 * 所以这里不关闭。
                 */
            };


        this._onRoundEnd =
            data => {

                this.handleRoundResult(
                    data
                );
            };


        this._bindEvents();
    }


    // ========================================================
    // Bind
    // ========================================================

    _bindEvents() {

        gameEvents.on(
            GAME_EVENT.ROUND_FREEZE_START,
            this._onRoundFreeze
        );


        gameEvents.on(
            GAME_EVENT.ROUND_START,
            this._onRoundStart
        );


        gameEvents.on(
            GAME_EVENT.ROUND_END,
            this._onRoundEnd
        );
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (
            !this.buyTimeActive
        ) {
            return;
        }


        this.buyTimeLeft -=
            delta;


        if (
            this.buyTimeLeft <= 0
        ) {

            this.buyTimeLeft = 0;

            this.buyTimeActive =
                false;


            gameEvents.emit(
                "economy:buy-time-ended"
            );
        }


        gameEvents.emit(
            "economy:buy-time-update",
            {
                timeLeft:
                    this.buyTimeLeft,

                active:
                    this.buyTimeActive
            }
        );
    }


    // ========================================================
    // Buy Time
    // ========================================================

    beginBuyTime() {

        this.buyTimeLeft =
            ROUND_CONFIG.buyTime;

        this.buyTimeActive =
            true;


        gameEvents.emit(
            "economy:buy-time-start",
            {
                duration:
                    ROUND_CONFIG.buyTime
            }
        );
    }


    endBuyTime() {

        this.buyTimeLeft = 0;

        this.buyTimeActive =
            false;


        gameEvents.emit(
            "economy:buy-time-ended"
        );
    }


    // ========================================================
    // Round Rewards
    // ========================================================

    handleRoundResult(
        data = {}
    ) {

        const winner =
            data.winner;


        if (
            winner === "draw" ||
            winner === "DRAW" ||
            !winner
        ) {

            this.rewardAll(
                ECONOMY_CONFIG
                    .roundRewards
                    .draw
            );


            /*
             * Draw 不改变 streak。
             */
            return;
        }


        const winningTeam =
            winner === TEAM.CT ||
            winner === "ct" ||
            winner === "CT"
                ? TEAM.CT
                : TEAM.T;


        const losingTeam =
            winningTeam === TEAM.CT
                ? TEAM.T
                : TEAM.CT;


        // ----------------------------------------------------
        // 胜方 streak 清零
        // ----------------------------------------------------

        this.lossStreak[
            winningTeam
        ] = 0;


        // ----------------------------------------------------
        // 败方 streak +1
        // ----------------------------------------------------

        this.lossStreak[
            losingTeam
        ]++;


        // ----------------------------------------------------
        // 胜方奖励
        // ----------------------------------------------------

        this.rewardTeam(
            winningTeam,
            ECONOMY_CONFIG
                .roundRewards
                .win
        );


        // ----------------------------------------------------
        // 败方奖励
        // ----------------------------------------------------

        const lossReward =
            this.calculateLossReward(
                losingTeam
            );


        this.rewardTeam(
            losingTeam,
            lossReward
        );


        gameEvents.emit(
            "economy:round-reward",
            {
                winner:
                    winningTeam,

                loser:
                    losingTeam,

                winnerReward:
                    ECONOMY_CONFIG
                        .roundRewards
                        .win,

                loserReward:
                    lossReward,

                lossStreak: {
                    ...this.lossStreak
                }
            }
        );
    }


    // ========================================================
    // Loss Bonus
    // ========================================================

    calculateLossReward(team) {

        const streak =
            Math.max(
                1,
                this.lossStreak[
                    team
                ] || 1
            );


        const {
            lossBase,
            lossIncrement,
            lossMax
        } =
            ECONOMY_CONFIG
                .roundRewards;


        return Math.min(
            lossMax,
            lossBase +
            (
                streak - 1
            ) *
            lossIncrement
        );
    }


    // ========================================================
    // Reward team
    // ========================================================

    rewardTeam(
        team,
        amount
    ) {

        const entities =
            this.getAllEntities();


        for (
            const entity
            of entities
        ) {

            if (
                entity.team !==
                team
            ) {
                continue;
            }


            if (
                typeof entity.addMoney ===
                "function"
            ) {

                entity.addMoney(
                    amount
                );
            }
        }
    }


    rewardAll(amount) {

        const entities =
            this.getAllEntities();


        for (
            const entity
            of entities
        ) {

            entity.addMoney?.(
                amount
            );
        }
    }


    // ========================================================
    // Entity registry
    //
    // 优先使用 roundSystem。
    // ========================================================

    getAllEntities() {

        const entities = [];


        if (
            this.roundSystem
                ?.player
        ) {

            entities.push(
                this.roundSystem.player
            );
        }


        if (
            Array.isArray(
                this.roundSystem
                    ?.bots
            )
        ) {

            entities.push(
                ...this.roundSystem.bots
            );
        }


        return entities;
    }


    // ========================================================
    // Buy validation
    // ========================================================

    canBuy(
        buyer,
        itemPrice = 0
    ) {

        if (!buyer) {

            return {
                ok: false,
                result:
                    PURCHASE_RESULT
                        .INVALID_BUYER
            };
        }


        if (
            buyer.isAlive === false
        ) {

            return {
                ok: false,
                result:
                    PURCHASE_RESULT
                        .DEAD
            };
        }


        if (
            this.enforceBuyTime &&
            !this.buyTimeActive
        ) {

            return {
                ok: false,
                result:
                    PURCHASE_RESULT
                        .BUY_TIME_EXPIRED
            };
        }


        if (
            this.enforceBuyZone &&
            !this.isInBuyZone(
                buyer
            )
        ) {

            return {
                ok: false,
                result:
                    PURCHASE_RESULT
                        .NOT_IN_BUY_ZONE
            };
        }


        if (
            !buyer.canAfford?.(
                itemPrice
            )
        ) {

            return {
                ok: false,
                result:
                    PURCHASE_RESULT
                        .NOT_ENOUGH_MONEY
            };
        }


        return {
            ok: true,
            result:
                PURCHASE_RESULT.SUCCESS
        };
    }


    // ========================================================
    // Buy Zone
    // ========================================================

    isInBuyZone(buyer) {

        if (
            !this.enforceBuyZone
        ) {
            return true;
        }


        if (!buyer) {
            return false;
        }


        /*
         * 优先使用 map.js。
         */
        if (
            this.map &&
            typeof this.map
                .isInBuyZone ===
                "function"
        ) {

            return this.map
                .isInBuyZone(
                    buyer
                );
        }


        /*
         * 如果 Map 尚未实现，
         * 暂时允许购买，
         * 防止整个 Buy Menu 无法测试。
         */
        return true;
    }

	// ========================================================
	// Ammo Purchase
	//
	// 当前快捷键设计：
	//
	// , = Secondary / Pistol Ammo
	// . = Primary Ammo
	//
	// 按一次购买一个 Ammo Pack。
	// ========================================================

	buySecondaryAmmo(buyer) {

		if (!buyer) {

			return this._purchaseFailed(
				buyer,
				"secondary_ammo",
				PURCHASE_RESULT.INVALID_BUYER
			);
		}


		const weapon =
			buyer.inventory
				?.secondaryWeapon;


		if (!weapon) {

			return this._purchaseFailed(
				buyer,
				"secondary_ammo",
				PURCHASE_RESULT.INVALID_ITEM
			);
		}


		return this.buyAmmoForWeapon(
			buyer,
			weapon,
			{
				itemId:
					"secondary_ammo",

				defaultPrice:
					30,

				defaultAmount:
					this._getDefaultAmmoPack(
						weapon,
						"secondary"
					)
			}
		);
	}


	// ========================================================
	// Primary Ammo
	// ========================================================

	buyPrimaryAmmo(buyer) {

		if (!buyer) {

			return this._purchaseFailed(
				buyer,
				"primary_ammo",
				PURCHASE_RESULT.INVALID_BUYER
			);
		}


		const weapon =
			buyer.inventory
				?.primaryWeapon;


		if (!weapon) {

			return this._purchaseFailed(
				buyer,
				"primary_ammo",
				PURCHASE_RESULT.INVALID_ITEM
			);
		}


		return this.buyAmmoForWeapon(
			buyer,
			weapon,
			{
				itemId:
					"primary_ammo",

				defaultPrice:
					60,

				defaultAmount:
					this._getDefaultAmmoPack(
						weapon,
						"primary"
					)
			}
		);
	}


	// ========================================================
	// Generic weapon ammo purchase
	// ========================================================

	buyAmmoForWeapon(
		buyer,
		weapon,
		{
			itemId = "ammo",
			defaultPrice = 50,
			defaultAmount = 30
		} = {}
	) {

		if (
			!buyer ||
			!weapon
		) {

			return this._purchaseFailed(
				buyer,
				itemId,
				PURCHASE_RESULT.INVALID_ITEM
			);
		}


		/*
		 * Knife 等无限弹药武器不可以买弹。
		 */
		if (
			weapon.reserveAmmo ===
			Infinity
		) {

			return this._purchaseFailed(
				buyer,
				itemId,
				PURCHASE_RESULT.ALREADY_OWNED
			);
		}


		// ----------------------------------------------------
		// 尽量读取 weapon.js/config.js 中自己的配置
		//
		// 如果目前配置里还没有 ammoPrice/ammoBuyAmount，
		// 自动使用 fallback。
		// ----------------------------------------------------

		const price =
			Number(
				weapon.config
					?.ammoPrice ??
				weapon.config
					?.ammoBuyPrice ??
				defaultPrice
			);


		const amount =
			Math.max(
				1,
				Math.floor(
					Number(
						weapon.config
							?.ammoBuyAmount ??
						weapon.config
							?.ammoPack ??
						defaultAmount
					)
				)
			);


		const maxReserve =
			Number(
				weapon.config
					?.maxReserveAmmo ??
				weapon.config
					?.reserveAmmo ??
				weapon.config
					?.maxAmmo ??
				Infinity
			);


		// ----------------------------------------------------
		// 已满
		// ----------------------------------------------------

		if (
			Number.isFinite(
				maxReserve
			) &&
			weapon.reserveAmmo >=
			maxReserve
		) {

			return this._purchaseFailed(
				buyer,
				itemId,
				PURCHASE_RESULT.MAX_CARRY
			);
		}


		// ----------------------------------------------------
		// Buy Zone + Buy Time + Money
		// ----------------------------------------------------

		const validation =
			this.canBuy(
				buyer,
				price
			);


		if (
			!validation.ok
		) {

			return this._purchaseFailed(
				buyer,
				itemId,
				validation.result
			);
		}


		if (
			!buyer.spendMoney(
				price
			)
		) {

			return this._purchaseFailed(
				buyer,
				itemId,
				PURCHASE_RESULT.NOT_ENOUGH_MONEY
			);
		}


		const oldReserve =
			Number(
				weapon.reserveAmmo ||
				0
			);


		weapon.reserveAmmo =
			Number.isFinite(
				maxReserve
			)
				? Math.min(
					maxReserve,
					oldReserve +
					amount
				)
				: oldReserve +
					amount;


		const added =
			weapon.reserveAmmo -
			oldReserve;


		/*
		 * 万一实际上没有加到子弹，
		 * 退钱。
		 */
		if (
			added <= 0
		) {

			buyer.addMoney?.(
				price
			);


			return this._purchaseFailed(
				buyer,
				itemId,
				PURCHASE_RESULT.MAX_CARRY
			);
		}


		// ----------------------------------------------------
		// HUD Ammo
		// ----------------------------------------------------

		gameEvents.emit(
			"weapon:ammo-changed",
			{
				owner:
					buyer,

				weapon,

				weaponId:
					weapon.id,

				clip:
					weapon.clipAmmo,

				reserve:
					weapon.reserveAmmo
			}
		);


		return this._purchaseSuccess(
			buyer,
			itemId,
			price,
			{
				weapon,

				ammoAdded:
					added,

				reserveAmmo:
					weapon.reserveAmmo
			}
		);
	}


	// ========================================================
	// 默认购买弹药数量
	// ========================================================

	_getDefaultAmmoPack(
		weapon,
		type
	) {

		/*
		 * 如果 config 中存在 magazineSize，
		 * 默认一次买一弹匣。
		 */
		const magazineSize =
			Number(
				weapon.config
					?.magazineSize ??
				weapon.config
					?.clipSize ??
				weapon.config
					?.maxClip ??
				0
			);


		if (
			magazineSize >
			0
		) {

			return magazineSize;
		}


		/*
		 * fallback
		 */
		if (
			type ===
			"secondary"
		) {

			return 12;
		}


		return 30;
	}
    // ========================================================
    // Weapon Purchase
    // ========================================================

    buyWeapon(
        buyer,
        weaponId,
        {
            autoEquip = true
        } = {}
    ) {

        const config =
            WEAPON_CONFIG[
                weaponId
            ];


        if (!config) {

            return this._purchaseFailed(
                buyer,
                weaponId,
                PURCHASE_RESULT
                    .INVALID_ITEM
            );
        }


        // ----------------------------------------------------
        // Team restriction
        // ----------------------------------------------------

        if (
            config.team &&
            config.team !==
            buyer?.team
        ) {

            return this._purchaseFailed(
                buyer,
                weaponId,
                PURCHASE_RESULT
                    .TEAM_RESTRICTED
            );
        }


        const validation =
            this.canBuy(
                buyer,
                config.price
            );


        if (!validation.ok) {

            return this._purchaseFailed(
                buyer,
                weaponId,
                validation.result
            );
        }


        // ----------------------------------------------------
        // 已拥有同一把枪：
        //
        // 这里选择补满弹药，
        // 但仍收一次价格。
        // ----------------------------------------------------

        const existing =
            buyer.inventory
                ?.getWeapon?.(
                    weaponId
                );


        if (existing) {

            buyer.spendMoney(
                config.price
            );


            existing.refillAmmo();


            if (autoEquip) {

                buyer.inventory.equip(
                    weaponId
                );
            }


            return this._purchaseSuccess(
                buyer,
                weaponId,
                config.price,
                {
                    weapon:
                        existing,

                    refilled:
                        true
                }
            );
        }


        // ----------------------------------------------------
        // Spend
        // ----------------------------------------------------

        if (
            !buyer.spendMoney(
                config.price
            )
        ) {

            return this._purchaseFailed(
                buyer,
                weaponId,
                PURCHASE_RESULT
                    .NOT_ENOUGH_MONEY
            );
        }


        // ----------------------------------------------------
        // Give weapon
        // ----------------------------------------------------

        const weapon =
            buyer.giveWeapon?.(
                weaponId,
                {
                    equip:
                        autoEquip
                }
            );


        if (!weapon) {

            /*
             * 极少发生：
             * 如果给予武器失败，
             * 把钱退回。
             */
            buyer.addMoney?.(
                config.price
            );


            return this._purchaseFailed(
                buyer,
                weaponId,
                PURCHASE_RESULT
                    .INVALID_ITEM
            );
        }


        return this._purchaseSuccess(
            buyer,
            weaponId,
            config.price,
            {
                weapon
            }
        );
    }


    // ========================================================
    // Armor Purchase
    // ========================================================

    buyArmor(
        buyer,
        {
            helmet = false
        } = {}
    ) {

        const item =
            helmet
                ? ECONOMY_CONFIG
                    .items
                    .kevlarHelmet
                : ECONOMY_CONFIG
                    .items
                    .kevlar;


        const itemId =
            helmet
                ? "kevlar_helmet"
                : "kevlar";


        if (
            buyer?.armor >=
            item.armor
        ) {

            return this._purchaseFailed(
                buyer,
                itemId,
                PURCHASE_RESULT
                    .ALREADY_OWNED
            );
        }


        const validation =
            this.canBuy(
                buyer,
                item.price
            );


        if (!validation.ok) {

            return this._purchaseFailed(
                buyer,
                itemId,
                validation.result
            );
        }


        if (
            !buyer.spendMoney(
                item.price
            )
        ) {

            return this._purchaseFailed(
                buyer,
                itemId,
                PURCHASE_RESULT
                    .NOT_ENOUGH_MONEY
            );
        }


        if (
            typeof buyer.giveArmor ===
            "function"
        ) {

            buyer.giveArmor(
                item.armor
            );

        } else if (
            typeof buyer.setArmor ===
            "function"
        ) {

            buyer.setArmor(
                item.armor
            );
        }


        /*
         * helmet 属性先预留。
         */
        if (helmet) {

            buyer.hasHelmet =
                true;
        }


        return this._purchaseSuccess(
            buyer,
            itemId,
            item.price,
            {
                armor:
                    item.armor,

                helmet
            }
        );
    }


    // ========================================================
    // Grenade Purchase
    // ========================================================

    buyGrenade(
        buyer,
        type
    ) {

        const config =
            GRENADE_CONFIG[
                type
            ];


        if (!config) {

            return this._purchaseFailed(
                buyer,
                type,
                PURCHASE_RESULT
                    .INVALID_ITEM
            );
        }


        const inventory =
            buyer
                ?.grenadeInventory;


        if (!inventory) {

            return this._purchaseFailed(
                buyer,
                type,
                PURCHASE_RESULT
                    .INVALID_BUYER
            );
        }


        const count =
            inventory.getCount(
                type
            );


        if (
            count >=
            config.maxCarry
        ) {

            return this._purchaseFailed(
                buyer,
                type,
                PURCHASE_RESULT
                    .MAX_CARRY
            );
        }


        const validation =
            this.canBuy(
                buyer,
                config.price
            );


        if (!validation.ok) {

            return this._purchaseFailed(
                buyer,
                type,
                validation.result
            );
        }


        if (
            !buyer.spendMoney(
                config.price
            )
        ) {

            return this._purchaseFailed(
                buyer,
                type,
                PURCHASE_RESULT
                    .NOT_ENOUGH_MONEY
            );
        }


        inventory.add(
            type,
            1
        );


        return this._purchaseSuccess(
            buyer,
            type,
            config.price,
            {
                grenade:
                    type,

                count:
                    inventory.getCount(
                        type
                    )
            }
        );
    }


    // ========================================================
    // Generic Buy
    //
    // UI 可以只调用这一处。
    // ========================================================

    buy(
        buyer,
        itemId
    ) {

        if (
            WEAPON_CONFIG[
                itemId
            ]
        ) {

            return this.buyWeapon(
                buyer,
                itemId
            );
        }


        if (
            GRENADE_CONFIG[
                itemId
            ]
        ) {

            return this.buyGrenade(
                buyer,
                itemId
            );
        }


        switch (
            itemId
        ) {

            case "armor":
            case "kevlar":

                return this.buyArmor(
                    buyer,
                    {
                        helmet:
                            false
                    }
                );


            case "helmet":
            case "kevlar_helmet":

                return this.buyArmor(
                    buyer,
                    {
                        helmet:
                            true
                    }
                );
        }


        return this._purchaseFailed(
            buyer,
            itemId,
            PURCHASE_RESULT
                .INVALID_ITEM
        );
    }


    // ========================================================
    // BOT Auto Buy
    // ========================================================

    autoBuyBot(bot) {

        if (
            !bot ||
            bot.isAlive === false
        ) {

            return false;
        }


        /*
         * BOT 买东西时仍然遵守：
         * - money
         * - team restriction
         *
         * 但如果以后地图 Buy Zone
         * 位置存在小误差，
         * 可以在调用前临时关闭 enforceBuyZone。
         */


        // ====================================================
        // Armor
        // ====================================================

        if (
            bot.armor < 60 &&
            bot.money >= 650
        ) {

            this.buyArmor(
                bot
            );
        }


        // ====================================================
        // Primary Weapon
        // ====================================================

        if (
            !bot.inventory
                .primaryWeapon
        ) {

            const weaponId =
                this.chooseBotWeapon(
                    bot
                );


            if (weaponId) {

                this.buyWeapon(
                    bot,
                    weaponId
                );
            }
        }


        // ====================================================
        // HE
        // ====================================================

        if (
            !bot.grenadeInventory
                .has(
                    GRENADE_TYPE.HE
                ) &&
            bot.money >=
                GRENADE_CONFIG.he
                    .price
        ) {

            this.buyGrenade(
                bot,
                GRENADE_TYPE.HE
            );
        }


        // ====================================================
        // Flash
        // ====================================================

        if (
            bot.money >
                2500 &&
            bot.grenadeInventory
                .getCount(
                    GRENADE_TYPE.FLASH
                ) <
                GRENADE_CONFIG.flash
                    .maxCarry
        ) {

            this.buyGrenade(
                bot,
                GRENADE_TYPE.FLASH
            );
        }


        return true;
    }


    // ========================================================
    // BOT Weapon Choice
    // ========================================================

    chooseBotWeapon(bot) {

        const team =
            bot.team;


        const affordable =
            Object.values(
                WEAPON_CONFIG
            )
            .filter(
                weapon => {

                    if (
                        weapon.price == null ||
                        weapon.price <= 0
                    ) {
                        return false;
                    }


                    /*
                     * 不让这里选手枪/刀。
                     */
                    if (
                        weapon.slot !==
                        "primary"
                    ) {
                        return false;
                    }


                    if (
                        weapon.team &&
                        weapon.team !==
                        team
                    ) {

                        return false;
                    }


                    return (
                        bot.money >=
                        weapon.price
                    );
                }
            );


        if (
            affordable.length === 0
        ) {

            return null;
        }


        /*
         * 用简单权重，
         * 优先经典主战枪。
         */
        const options =
            affordable.map(
                weapon => {

                    let weight = 1;


                    switch (
                        weapon.id
                    ) {

                        case "ak47":
                        case "m4a1":

                            weight = 8;

                            break;


                        case "awp":

                            weight = 3;

                            break;


                        case "mp5":

                            weight = 4;

                            break;


                        case "scout":

                            weight = 2;

                            break;
                    }


                    /*
                     * 激进 BOT 少用 AWP。
                     */
                    if (
                        bot.personality ===
                            "aggressive" &&
                        weapon.id ===
                            "awp"
                    ) {

                        weight *=
                            0.35;
                    }


                    /*
                     * defensive BOT
                     * 更喜欢 AWP。
                     */
                    if (
                        bot.personality ===
                            "defensive" &&
                        weapon.id ===
                            "awp"
                    ) {

                        weight *=
                            2;
                    }


                    return {
                        value:
                            weapon.id,

                        weight
                    };
                }
            );


        return weightedRandom(
            options
        );
    }


    // ========================================================
    // Auto Buy Whole Team
    // ========================================================

    autoBuyBots() {

        if (
            !this.roundSystem
        ) {
            return;
        }


        for (
            const bot
            of this.roundSystem.bots
        ) {

            this.autoBuyBot(
                bot
            );
        }
    }


    // ========================================================
    // Purchase success
    // ========================================================

    _purchaseSuccess(
        buyer,
        itemId,
        price,
        extra = {}
    ) {

        const result = {
            ok: true,

            result:
                PURCHASE_RESULT.SUCCESS,

            buyer,

            itemId,

            price,

            money:
                buyer?.money,

            ...extra
        };


        gameEvents.emit(
            "economy:purchase",
            result
        );


        gameEvents.emit(
            "ui:buy-success",
            result
        );


        return result;
    }


    // ========================================================
    // Purchase failure
    // ========================================================

    _purchaseFailed(
        buyer,
        itemId,
        reason
    ) {

        const result = {
            ok: false,

            result:
                reason,

            buyer,

            itemId,

            money:
                buyer?.money
        };


        gameEvents.emit(
            "economy:purchase-failed",
            result
        );


        gameEvents.emit(
            "ui:buy-failed",
            result
        );


        return result;
    }


    // ========================================================
    // Set Round System
    // ========================================================

    setRoundSystem(
        roundSystem
    ) {

        this.roundSystem =
            roundSystem;

        return this;
    }


    setMap(map) {

        this.map =
            map;

        return this;
    }


    // ========================================================
    // Settings
    // ========================================================

    setEnforceBuyZone(
        enabled
    ) {

        this.enforceBuyZone =
            Boolean(enabled);
    }


    setEnforceBuyTime(
        enabled
    ) {

        this.enforceBuyTime =
            Boolean(enabled);
    }


    // ========================================================
    // Reset Match
    // ========================================================

    resetMatch() {

        this.lossStreak[
            TEAM.CT
        ] = 0;


        this.lossStreak[
            TEAM.T
        ] = 0;


        this.buyTimeLeft =
            ROUND_CONFIG.buyTime;

        this.buyTimeActive =
            false;


        gameEvents.emit(
            "economy:reset"
        );
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            buyTimeActive:
                this.buyTimeActive,

            buyTimeLeft:
                this.buyTimeLeft,

            lossStreak: {
                ...this.lossStreak
            }
        };
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        gameEvents.off(
            GAME_EVENT.ROUND_FREEZE_START,
            this._onRoundFreeze
        );


        gameEvents.off(
            GAME_EVENT.ROUND_START,
            this._onRoundStart
        );


        gameEvents.off(
            GAME_EVENT.ROUND_END,
            this._onRoundEnd
        );


        this.roundSystem = null;

        this.map = null;
    }
}


// ============================================================
// 全局单例
// ============================================================

export const economy =
    new EconomySystem();

export default economy;