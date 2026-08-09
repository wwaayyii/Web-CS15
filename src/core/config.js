/**
 * Web-CS15
 * src/core/config.js
 *
 * 全局游戏配置中心。
 *
 * 原则：
 * 1. 游戏平衡数字尽量集中在这里。
 * 2. 其他模块不要重复写 magic number。
 * 3. config.js 不依赖 Three.js，也不依赖其他游戏模块。
 * 4. 所有对象默认冻结，避免运行时被意外修改。
 *
 * 使用示例：
 *
 * import {
 *   GAME_CONFIG,
 *   PLAYER_CONFIG,
 *   BOT_CONFIG,
 *   WEAPON_CONFIG,
 *   ROUND_CONFIG
 * } from "./config.js";
 */

// ============================================================
// 基础辅助
// ============================================================

const freezeDeep = (object) => {
    if (!object || typeof object !== "object" || Object.isFrozen(object)) {
        return object;
    }

    Object.freeze(object);

    Object.values(object).forEach((value) => {
        if (
            value &&
            typeof value === "object" &&
            !Object.isFrozen(value)
        ) {
            freezeDeep(value);
        }
    });

    return object;
};


// ============================================================
// 游戏信息
// ============================================================

export const GAME_CONFIG = freezeDeep({
    name: "Web CS 1.5",
    version: "1.0.0",

    debug: false,

    targetFPS: 60,

    maxDeltaTime: 0.05,

    worldScale: 1,

    teamNames: {
        CT: "Counter-Terrorists",
        T: "Terrorists"
    },

    teamShortNames: {
        CT: "CT",
        T: "T"
    }
});


// ============================================================
// 队伍
// ============================================================

export const TEAM = freezeDeep({
    CT: "ct",
    T: "t"
});


// ============================================================
// 玩家配置
// ============================================================

export const PLAYER_CONFIG = freezeDeep({
    maxHP: 100,

    maxArmor: 100,

    startHP: 100,

    startArmor: 0,

    startMoney: 800,

    maxMoney: 16000,

    eyeHeight: 1.8,

    crouchEyeHeight: 1.15,

    radius: 0.45,

    height: 1.8,

    walkSpeed: 5.5,

    runSpeed: 8.0,

    crouchSpeed: 2.8,

    spectatorSpeed: 10,

    jumpForce: 6.3,

    gravity: 18,

    acceleration: 16,

    airAcceleration: 3,

    friction: 10,

    mouseSensitivity: 1,

    armorDamageAbsorption: 0.5,

    maxGrenades: {
        he: 1,
        flash: 2,
        smoke: 1
    }
});


// ============================================================
// BOT 基础配置
// ============================================================

export const BOT_CONFIG = freezeDeep({
    maxHP: 100,

    maxArmor: 100,

    radius: 1.0,

    normalSpeed: 3.2,

    chaseSpeed: 4.0,

    retreatSpeed: 3.6,

    visionDistance: 55,

    combatDistance: 42,

    hearingDistance: {
        gunshot: 40,
        footsteps: 25,
        radio: 35,
        explosion: 55
    },

    fieldOfView: {
        patrol: 105,
        alert: 135,
        combat: 160
    },

    // ====================================================
	// BOT Shooting Difficulty
	//
	// reactionTime:
	//   发现敌人以后，需要多久才允许第一枪。
	//
	// accuracy:
	//   BOT 每次射击真正朝准目标的概率。
	//
	// aimError:
	//   未完全命中时增加的方向误差。
	// ====================================================

	reactionTime: {
		easy: 1.00,
		normal: 0.65,
		hard: 0.40,
		expert: 0.25
	},

	accuracy: {
		easy: 0.28,
		normal: 0.48,
		hard: 0.64,
		expert: 0.78
	},

	aimError: {
		easy: 0.18,
		normal: 0.11,
		hard: 0.070,
		expert: 0.040
	},


	// ====================================================
	// BOT Fire Control
	//
	// 不允许 BOT 无限按照枪械理论射速持续扫射。
	// ====================================================

	shooting: {

		/*
		 * 默认使用哪个难度。
		 *
		 * 后面可以再和 DEFAULT_SETTINGS.difficulty 接起来。
		 */
		difficulty: "normal",


		/*
		 * 每次开火判断之间至少间隔多少毫秒。
		 *
		 * 原来是 50ms，太激进。
		 */
		decisionInterval: 110,


		/*
		 * 每轮连续射击数量。
		 */
		burstMin: 1,
		burstMax: 4,


		/*
		 * 一轮射击完成以后暂停时间。
		 */
		burstPauseMin: 0.20,
		burstPauseMax: 0.45,


		/*
		 * BOT 刚刚看到敌人时，
		 * 给 reactionTime 加一点随机变化。
		 */
		reactionRandomMin: 0.00,
		reactionRandomMax: 0.25,


		/*
		 * 距离越远，额外增加误差。
		 */
		distanceErrorStart: 12,
		distanceErrorMax: 45,
		distanceErrorMultiplier: 0.75
	},

    patrol: {
        radius: 60,
        reachDistance: 1.5,
        repathMin: 2.0,
        repathMax: 5.0
    },

    separation: {
        minDistance: 2,
        strength: 0.5
    },

    obstacleAvoidance: {
        lookAhead: 1.3,
        sideAngle: 0.4,
        unstuckTime: 0.8
    },

    combat: {
        strafeChance: 0.75,

        crouchChance: 0.20,

        retreatHP: 28,

        chaseLowHPEnemyChance: 0.75,

        coverSearchDistance: 15,

        peekDurationMin: 0.35,

        peekDurationMax: 0.8,

        strafeChangeMin: 0.45,

        strafeChangeMax: 1.2
    },

    radio: {
        enabled: true,

        cooldownMin: 6000,

        cooldownMax: 10000,

        spottedChance: 0.35,

        backupChance: 0.35,

        combatChance: 0.20,

        killChance: 0.18,

        roundEndChance: 0.35,

        replyChance: 0.65
    },

    personalities: {
        aggressive: {
            aggression: 0.9,
            retreatThreshold: 18,
            radioMultiplier: 1.2,
            strafeMultiplier: 1.2
        },

        balanced: {
            aggression: 0.6,
            retreatThreshold: 28,
            radioMultiplier: 1.0,
            strafeMultiplier: 1.0
        },

        defensive: {
            aggression: 0.35,
            retreatThreshold: 42,
            radioMultiplier: 0.9,
            strafeMultiplier: 0.8
        },

        calm: {
            aggression: 0.5,
            retreatThreshold: 32,
            radioMultiplier: 0.55,
            strafeMultiplier: 0.9
        }
    },

    names: [
        "Maverick",
        "IceMan",
        "Viper",
        "Striker",
        "Ghost",
        "Phobos",
        "Raptor",
        "Hunter",
        "Shadow",
        "Alpha",
        "Bravo",
        "Cobra",
        "Slayer",
        "Titan",
        "Phoenix",
        "Reaper",
        "Cyclone",
        "Gunner",
        "Wolf",
        "Blitz"
    ]
});


// ============================================================
// BOT 状态
// ============================================================

export const BOT_STATE = freezeDeep({
    IDLE: "IDLE",

    PATROL: "PATROL",

    ALERT: "ALERT",

    SEARCH: "SEARCH",

    COMBAT: "COMBAT",

    RETREAT: "RETREAT",

    TAKE_COVER: "TAKE_COVER",

    RELOAD: "RELOAD",

    DEAD: "DEAD"
});


// ============================================================
// 武器槽
// ============================================================

export const WEAPON_SLOT = freezeDeep({
    PRIMARY: "primary",

    SECONDARY: "secondary",

    KNIFE: "knife",

    GRENADE: "grenade"
});


// ============================================================
// 武器类型
// ============================================================

export const WEAPON_TYPE = freezeDeep({
    PISTOL: "pistol",

    SMG: "smg",

    RIFLE: "rifle",

    SNIPER: "sniper",

    MACHINE_GUN: "machine_gun",

    KNIFE: "knife"
});


// ============================================================
// 武器配置
// ============================================================

export const WEAPON_CONFIG = freezeDeep({

    // --------------------------------------------------------
    // AK-47
    // --------------------------------------------------------

    ak47: {
        id: "ak47",

        name: "AK-47",

        displayName: "AK-47 Kalashnikov",

        slot: WEAPON_SLOT.PRIMARY,

        type: WEAPON_TYPE.RIFLE,

        team: TEAM.T,

        price: 2700,

        killReward: 300,

        damage: 38,

        armorPenetration: 0.77,

        maxClip: 30,

        reserveAmmo: 90,

        fireRate: 0.10,

        automatic: true,

        reloadTime: 2.45,

        drawTime: 0.85,

        recoil: {
            vertical: 0.080,
            horizontal: 0.035,
            recovery: 7.5
        },

        spread: {
            stand: 0.010,
            move: 0.045,
            crouch: 0.006,
            air: 0.12
        },

        range: 100,

        rangeModifier: 0.98,

        movementSpeed: 0.91,

        botBurst: {
            min: 2,
            max: 5
        }
    },


    // --------------------------------------------------------
    // M4A1
    // --------------------------------------------------------

    m4a1: {
        id: "m4a1",

        name: "M4A1",

        displayName: "M4A1 Carbine",

        slot: WEAPON_SLOT.PRIMARY,

        type: WEAPON_TYPE.RIFLE,

        team: TEAM.CT,

        price: 3100,

        killReward: 300,

        damage: 34,

        armorPenetration: 0.82,

        maxClip: 30,

        reserveAmmo: 90,

        fireRate: 0.09,

        automatic: true,

        reloadTime: 2.35,

        drawTime: 0.80,

        recoil: {
            vertical: 0.055,
            horizontal: 0.026,
            recovery: 8.5
        },

        spread: {
            stand: 0.008,
            move: 0.037,
            crouch: 0.005,
            air: 0.11
        },

        range: 100,

        rangeModifier: 0.97,

        movementSpeed: 0.92,

        botBurst: {
            min: 3,
            max: 6
        }
    },


    // --------------------------------------------------------
    // AWP
    // --------------------------------------------------------

    awp: {
        id: "awp",

        name: "AWP",

        displayName: "AWP Sniper Rifle",

        slot: WEAPON_SLOT.PRIMARY,

        type: WEAPON_TYPE.SNIPER,

        team: null,

        price: 4750,

        killReward: 100,

        damage: 115,

        armorPenetration: 0.97,

        maxClip: 10,

        reserveAmmo: 30,

        fireRate: 1.45,

        automatic: false,

        reloadTime: 2.9,

        drawTime: 1.1,

        recoil: {
            vertical: 0.25,
            horizontal: 0.02,
            recovery: 4
        },

        spread: {
            stand: 0.002,
            move: 0.10,
            crouch: 0.001,
            air: 0.22
        },

        range: 160,

        rangeModifier: 0.99,

        movementSpeed: 0.78,

        scope: true,

        botBurst: {
            min: 1,
            max: 1
        }
    },


    // --------------------------------------------------------
    // Desert Eagle
    // --------------------------------------------------------

    deagle: {
        id: "deagle",

        name: "Desert Eagle",

        displayName: "Desert Eagle .50 AE",

        slot: WEAPON_SLOT.SECONDARY,

        type: WEAPON_TYPE.PISTOL,

        team: null,

        price: 650,

        killReward: 300,

        damage: 55,

        armorPenetration: 0.84,

        maxClip: 7,

        reserveAmmo: 35,

        fireRate: 0.23,

        automatic: false,

        reloadTime: 2.2,

        drawTime: 0.65,

        recoil: {
            vertical: 0.12,
            horizontal: 0.04,
            recovery: 5
        },

        spread: {
            stand: 0.010,
            move: 0.04,
            crouch: 0.006,
            air: 0.12
        },

        range: 85,

        rangeModifier: 0.95,

        movementSpeed: 0.97,

        botBurst: {
            min: 1,
            max: 2
        }
    },


    // --------------------------------------------------------
    // USP
    // --------------------------------------------------------

    usp: {
        id: "usp",

        name: "USP",

        displayName: "USP .45 Tactical",

        slot: WEAPON_SLOT.SECONDARY,

        type: WEAPON_TYPE.PISTOL,

        team: TEAM.CT,

        price: 500,

        killReward: 300,

        damage: 34,

        armorPenetration: 0.50,

        maxClip: 12,

        reserveAmmo: 100,

        fireRate: 0.16,

        automatic: false,

        reloadTime: 2.1,

        drawTime: 0.6,

        recoil: {
            vertical: 0.055,
            horizontal: 0.025,
            recovery: 7
        },

        spread: {
            stand: 0.009,
            move: 0.032,
            crouch: 0.005,
            air: 0.095
        },

        range: 75,

        rangeModifier: 0.91,

        movementSpeed: 1,

        botBurst: {
            min: 1,
            max: 3
        }
    },


    // --------------------------------------------------------
    // Glock
    // --------------------------------------------------------

    glock: {
        id: "glock",

        name: "Glock 18",

        displayName: "Glock 18",

        slot: WEAPON_SLOT.SECONDARY,

        type: WEAPON_TYPE.PISTOL,

        team: TEAM.T,

        price: 400,

        killReward: 300,

        damage: 25,

        armorPenetration: 0.47,

        maxClip: 20,

        reserveAmmo: 120,

        fireRate: 0.15,

        automatic: false,

        reloadTime: 2.1,

        drawTime: 0.6,

        recoil: {
            vertical: 0.045,
            horizontal: 0.022,
            recovery: 7.5
        },

        spread: {
            stand: 0.010,
            move: 0.036,
            crouch: 0.006,
            air: 0.10
        },

        range: 70,

        rangeModifier: 0.90,

        movementSpeed: 1,

        botBurst: {
            min: 2,
            max: 4
        }
    },


    // --------------------------------------------------------
    // MP5
    // --------------------------------------------------------

    mp5: {
        id: "mp5",

        name: "MP5",

        displayName: "MP5 Navy",

        slot: WEAPON_SLOT.PRIMARY,

        type: WEAPON_TYPE.SMG,

        team: null,

        price: 1500,

        killReward: 600,

        damage: 26,

        armorPenetration: 0.53,

        maxClip: 30,

        reserveAmmo: 120,

        fireRate: 0.075,

        automatic: true,

        reloadTime: 2.6,

        drawTime: 0.75,

        recoil: {
            vertical: 0.032,
            horizontal: 0.025,
            recovery: 10
        },

        spread: {
            stand: 0.013,
            move: 0.028,
            crouch: 0.009,
            air: 0.09
        },

        range: 75,

        rangeModifier: 0.84,

        movementSpeed: 0.98,

        botBurst: {
            min: 4,
            max: 9
        }
    },


    // --------------------------------------------------------
    // Scout
    // --------------------------------------------------------

    scout: {
        id: "scout",

        name: "Scout",

        displayName: "Schmidt Scout",

        slot: WEAPON_SLOT.PRIMARY,

        type: WEAPON_TYPE.SNIPER,

        team: null,

        price: 2750,

        killReward: 300,

        damage: 74,

        armorPenetration: 0.85,

        maxClip: 10,

        reserveAmmo: 90,

        fireRate: 1.15,

        automatic: false,

        reloadTime: 2.0,

        drawTime: 0.85,

        recoil: {
            vertical: 0.13,
            horizontal: 0.015,
            recovery: 6
        },

        spread: {
            stand: 0.003,
            move: 0.042,
            crouch: 0.002,
            air: 0.13
        },

        range: 140,

        rangeModifier: 0.98,

        movementSpeed: 0.95,

        scope: true,

        botBurst: {
            min: 1,
            max: 1
        }
    },


    // --------------------------------------------------------
    // Knife
    // --------------------------------------------------------

    knife: {
        id: "knife",

        name: "Knife",

        displayName: "Knife",

        slot: WEAPON_SLOT.KNIFE,

        type: WEAPON_TYPE.KNIFE,

        team: null,

        price: 0,

        damage: 55,

        heavyDamage: 90,

        range: 2.1,

        fireRate: 0.45,

        automatic: false,

        movementSpeed: 1.05
    }
});


// ============================================================
// 默认装备
// ============================================================

export const LOADOUT_CONFIG = freezeDeep({
    CT: {
        primary: null,

        secondary: "usp",

        knife: "knife"
    },

    T: {
        primary: null,

        secondary: "glock",

        knife: "knife"
    }
});


// ============================================================
// 手雷配置
// ============================================================

export const GRENADE_CONFIG = freezeDeep({
    he: {
        id: "he",

        name: "HE Grenade",

        price: 300,

        maxCarry: 1,

        fuseTime: 2.0,

        throwSpeed: 22,

        verticalBoost: 6,

        gravity: 16,

        radius: 12,

        maxDamage: 100,

        playerSelfDamage: 40,

        bounce: 0.45,

        radioCallout: "Fire in the hole!"
    },

    flash: {
        id: "flash",

        name: "Flashbang",

        price: 200,

        maxCarry: 2,

        fuseTime: 1.7,

        throwSpeed: 22,

        verticalBoost: 6,

        gravity: 16,

        radius: 18,

        maxBlindTime: 4.5,

        bounce: 0.48,

        radioCallout: "Fire in the hole!"
    },

    smoke: {
        id: "smoke",

        name: "Smoke Grenade",

        price: 300,

        maxCarry: 1,

        fuseTime: 2.5,

        throwSpeed: 21,

        verticalBoost: 5.8,

        gravity: 16,

        radius: 8,

        smokeDuration: 15,

        bounce: 0.42,

        radioCallout: "Fire in the hole!"
    }
});


// ============================================================
// Round
// ============================================================

export const ROUND_CONFIG = freezeDeep({
    freezeTime: 3,

    roundTime: 180,

    roundEndDelay: 3,

    buyTime: 30,

    restartDelay: 3,

    maxRounds: 30,

    halfTimeRound: 15,

    winRounds: 16,

    overtimeEnabled: false,

    spawnProtectionTime: 0,

    automaticNextRound: true
});


// ============================================================
// 经济系统
// ============================================================

export const ECONOMY_CONFIG = freezeDeep({
    startMoney: 800,

    maxMoney: 16000,

    killRewards: {
        standard: 300,

        sniper: 100,

        smg: 600,

        knife: 1500,

        grenade: 300
    },

    roundRewards: {
        win: 3250,

        lossBase: 1400,

        lossIncrement: 500,

        lossMax: 3400,

        draw: 1500
    },

    items: {
        kevlar: {
            price: 650,

            armor: 100
        },

        kevlarHelmet: {
            price: 1000,

            armor: 100
        }
    }
});


// ============================================================
// Radio
// ============================================================

export const RADIO_CONFIG = freezeDeep({
    enabled: true,

    keys: {
        group1: "KeyZ",

        group2: "KeyX",

        group3: "KeyC"
    },

    displayTime: 2600,

    globalCooldown: 350,

    botCooldownMin: 6000,

    botCooldownMax: 10000,

    responseDelayMin: 450,

    responseDelayMax: 1600,

    replyChance: 0.65,

    radioRange: 50,

    useTextToSpeech: true,

    voice: {
        language: "en-US",

        rate: 1.05,

        pitch: 0.82,

        volume: 0.85
    },

    colors: {
        CT: "#55aaff",

        T: "#ff5555",

        system: "#d6b94c",

        announcer: "#ffdd44"
    },

    groups: {
        z: {
            title: "RADIO 1",

            commands: [
                "Cover me!",
                "You take the point.",
                "Hold this position!",
                "Regroup team.",
                "Follow me.",
                "Taking fire, need assistance!"
            ]
        },

        x: {
            title: "RADIO 2",

            commands: [
                "Go go go!",
                "Team, fall back!",
                "Stick together team.",
                "Get in position and wait for my go.",
                "Storm the front!",
                "Report in, team."
            ]
        },

        c: {
            title: "RADIO 3",

            commands: [
                "Affirmative.",
                "Enemy spotted.",
                "Need backup.",
                "Sector clear.",
                "I'm in position.",
                "Reporting in."
            ]
        }
    },

    botEvents: {
        enemySpotted: [
            "Enemy spotted!",
            "Contact!",
            "Enemy in sight!"
        ],

        backup: [
            "Need backup!",
            "Taking fire, need assistance!"
        ],

        attack: [
            "Go go go!",
            "Storm the front!"
        ],

        defensive: [
            "Hold this position!",
            "Stick together team."
        ],

        grenade: [
            "Fire in the hole!"
        ],

        clear: [
            "Sector clear.",
            "Area secure."
        ],

        acknowledge: [
            "Affirmative.",
            "Roger that.",
            "Copy that."
        ],

        negative: [
            "Negative."
        ],

        report: [
            "Reporting in.",
            "I'm in position."
        ]
    }
});


// ============================================================
// 回合结束语音
// ============================================================

export const ANNOUNCER_CONFIG = freezeDeep({
    CT_WIN: "Counter-Terrorists win!",

    T_WIN: "Terrorists win!",

    DRAW: "Round draw!",

    ROUND_START: "Go go go!"
});


// ============================================================
// HUD
// ============================================================

export const HUD_CONFIG = freezeDeep({
    crosshair: {
        size: 14,

        thickness: 2,

        gap: 3,

        dynamic: true
    },

    hitmarker: {
        duration: 80,

        killDuration: 150
    },

    killFeed: {
        duration: 3000,

        maxEntries: 6
    },

    radioMessage: {
        duration: 2600
    },

    scoreboard: {
        key: "Tab"
    },

    money: {
        prefix: "$ "
    },

    colors: {
        hp: "#55aaff",

        armor: "#55aaff",

        ammo: "#00ff78",

        money: "#55ff55",

        CT: "#55aaff",

        T: "#ff5555",

        warning: "#ff3333",

        roundTimer: "#ffdd44"
    }
});


// ============================================================
// Audio
// ============================================================

export const AUDIO_CONFIG = freezeDeep({
    masterVolume: 0.8,

    weaponVolume: 0.7,

    footstepVolume: 0.45,

    explosionVolume: 0.85,

    radioVolume: 0.7,

    uiVolume: 0.5,

    maxBotFootstepDistance: 35,

    footstepInterval: {
        walk: 0.48,

        run: 0.34,

        crouch: 0.72
    },

    radio: {
        beepFrequency: 850,

        beepDuration: 0.055,

        endBeepFrequency: 650,

        endBeepDuration: 0.045
    }
});


// ============================================================
// 地图
// ============================================================

export const MAP_CONFIG = freezeDeep({
    defaultMap: "fy_iceworld_web",

    size: {
        width: 120,

        depth: 120
    },

    floorY: 0,

    borderHeight: 8,

    borderThickness: 4,

    worldBounds: {
        minX: -58,

        maxX: 58,

        minZ: -58,

        maxZ: 58
    },

    spawn: {
        CT: {
            xMin: -25,

            xMax: 25,

            zMin: -52,

            zMax: -40
        },

        T: {
            xMin: -25,

            xMax: 25,

            zMin: 40,

            zMax: 52
        }
    },

    buyZones: {
        CT: {
            minX: -60,

            maxX: 60,

            minZ: -60,

            maxZ: -35
        },

        T: {
            minX: -60,

            maxX: 60,

            minZ: 35,

            maxZ: 60
        }
    },

    fog: {
        enabled: true,

        near: 10,

        far: 160
    }
});


// ============================================================
// 视觉
// ============================================================

export const GRAPHICS_CONFIG = freezeDeep({
    antialias: true,

    shadows: true,

    pixelRatioLimit: 2,

    camera: {
        fov: 75,

        near: 0.1,

        far: 1000
    },

    lighting: {
        ambientIntensity: 0.7,

        directionalIntensity: 0.8
    },

    effects: {
        bulletHoleLifetime: 3000,

        muzzleFlashDuration: 40,

        explosionDuration: 300,

        damageFlashDuration: 80
    }
});


// ============================================================
// 输入
// ============================================================

export const INPUT_CONFIG = freezeDeep({
    moveForward: "KeyW",

    moveBackward: "KeyS",

    moveLeft: "KeyA",

    moveRight: "KeyD",

    jump: "Space",

    crouch: "ControlLeft",

    sprint: "ShiftLeft",

    reload: "KeyR",

    grenade: "KeyG",

    buy: "KeyB",

    weaponPrimary: "Digit1",

    weaponSecondary: "Digit2",

    knife: "Digit3",

    lastWeapon: "KeyQ",

    scoreboard: "Tab",

    addBotMenu: "Equal",

    clearBots: "Minus",

    radio1: "KeyZ",

    radio2: "KeyX",

    radio3: "KeyC"
});


// ============================================================
// 难度
// ============================================================

export const DIFFICULTY_CONFIG = freezeDeep({
    easy: {
        reactionMultiplier: 1.5,

        accuracyMultiplier: 0.7,

        movementMultiplier: 0.85,

        radioMultiplier: 0.8
    },

    normal: {
        reactionMultiplier: 1,

        accuracyMultiplier: 1,

        movementMultiplier: 1,

        radioMultiplier: 1
    },

    hard: {
        reactionMultiplier: 0.75,

        accuracyMultiplier: 1.15,

        movementMultiplier: 1.08,

        radioMultiplier: 1.05
    },

    expert: {
        reactionMultiplier: 0.5,

        accuracyMultiplier: 1.30,

        movementMultiplier: 1.15,

        radioMultiplier: 1.1
    }
});


// ============================================================
// Main Menu / Match Setup
// ============================================================

export const MATCH_SETUP_CONFIG = freezeDeep({
    defaultTeam: TEAM.CT,

    defaultDifficulty: "normal",

    defaultTeamSize: 5,

    minTeamSize: 2,

    maxTeamSize: 10,

    allowedDifficulties: [
        "easy",
        "normal",
        "hard"
    ]
});


// ============================================================
// 默认游戏设置
// ============================================================

export const DEFAULT_SETTINGS = freezeDeep({
    difficulty: "normal",

    botCount: {
        CT: 5,

        T: 5
    },

    friendlyFire: false,

    autoReload: true,

    autoWeaponSwitch: true,

    radioEnabled: true,

    botRadioEnabled: true,

    textToSpeechEnabled: true,

    shadowsEnabled: true
});


// ============================================================
// 事件名称
//
// 后面 game.js / radio.js / round.js 可以统一使用这些事件名。
// 避免直接到处写字符串。
// ============================================================

export const GAME_EVENT = freezeDeep({
    PLAYER_SPAWN: "player:spawn",

    PLAYER_DAMAGE: "player:damage",

    PLAYER_DEATH: "player:death",

    PLAYER_KILL: "player:kill",

    BOT_SPAWN: "bot:spawn",

    BOT_DAMAGE: "bot:damage",

    BOT_DEATH: "bot:death",

    BOT_ENEMY_SPOTTED: "bot:enemy-spotted",

    BOT_NEED_BACKUP: "bot:need-backup",

    WEAPON_FIRE: "weapon:fire",

    WEAPON_RELOAD: "weapon:reload",

    GRENADE_THROW: "grenade:throw",

    GRENADE_EXPLODE: "grenade:explode",

    RADIO_SEND: "radio:send",

    ROUND_FREEZE_START: "round:freeze-start",

    ROUND_START: "round:start",

    ROUND_END: "round:end",

    SCORE_CHANGED: "score:changed",

    MONEY_CHANGED: "money:changed"
});


// ============================================================
// 默认导出
//
// 如果某些模块想一次拿完整配置，可以：
//
// import CONFIG from "../core/config.js";
//
// CONFIG.PLAYER...
// ============================================================

const CONFIG = freezeDeep({
    GAME: GAME_CONFIG,

    TEAM,

    PLAYER: PLAYER_CONFIG,

    BOT: BOT_CONFIG,

    BOT_STATE,

    WEAPON_SLOT,

    WEAPON_TYPE,

    WEAPONS: WEAPON_CONFIG,

    LOADOUT: LOADOUT_CONFIG,

    GRENADE: GRENADE_CONFIG,

    ROUND: ROUND_CONFIG,

    ECONOMY: ECONOMY_CONFIG,

    RADIO: RADIO_CONFIG,

    ANNOUNCER: ANNOUNCER_CONFIG,

    HUD: HUD_CONFIG,

    AUDIO: AUDIO_CONFIG,

    MAP: MAP_CONFIG,

    GRAPHICS: GRAPHICS_CONFIG,

    INPUT: INPUT_CONFIG,

    DIFFICULTY: DIFFICULTY_CONFIG,

    SETTINGS: DEFAULT_SETTINGS,

    EVENT: GAME_EVENT
});

export default CONFIG;