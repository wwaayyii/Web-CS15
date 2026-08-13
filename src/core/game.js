/**
 * Web-CS15
 * src/core/game.js
 *
 * 游戏总控制器
 *
 * 负责：
 * - Three.js 初始化
 * - PointerLockControls
 * - Game Loop
 * - Player
 * - BOT / BotAI
 * - Map
 * - Round
 * - Economy
 * - Radio
 * - HUD / UI
 * - Audio / Effects
 * - Keyboard / Mouse 输入
 * - 系统之间的注册与连接
 */

import * as THREE from "three";

import {
    PointerLockControls
} from "three/addons/controls/PointerLockControls.js";


import {
    GAME_CONFIG,
    PLAYER_CONFIG,
    DEFAULT_SETTINGS,
    MATCH_SETUP_CONFIG,
    INPUT_CONFIG,
    TEAM,
    BOT_CONFIG,
    GAME_EVENT,
    SNIPER_SCOPE_CONFIG
} from "./config.js";


import {
    randomItem,
    gameEvents,
    RollingAverage
} from "./utils.js";


import {
    Player
} from "../player/player.js";


import {
    Bot
} from "../bot/bot.js";


import {
    BotAIManager
} from "../bot/botAI.js";


import {
    weaponSystem
} from "../weapons/weapon.js";

import {
    WeaponView
} from "../weapons/weaponView.js";

import {
    grenadeSystem
} from "../weapons/grenade.js";

import {
    droppedWeaponSystem
} from "../weapons/droppedWeapon.js";


import {
    audio
} from "../systems/audio.js";


import {
    radio
} from "../systems/radio.js";


import {
    round
} from "../systems/round.js";


import {
    economy
} from "../systems/economy.js";


import {
    map
} from "../world/map.js?v=20260808_2";


import {
    effects
} from "../world/effects.js";


import {
    hud
} from "../ui/hud.js";


import {
    ui
} from "../ui/ui.js";


// ============================================================
// Game
// ============================================================

export class Game {

    constructor() {

        // ====================================================
        // Three.js
        // ====================================================

        this.scene = null;

        this.camera = null;

        this.renderer = null;

        this.controls = null;


        // ====================================================
        // Sky Rendering V1
        // ====================================================

        this.skyDome = null;

        this.cloudGroup = null;


        this.clock =
            new THREE.Clock();


        // ====================================================
        // Game entities
        // ====================================================

        this.player = null;

        this.bots = [];

        this.botAIManager = null;

        this.weaponView = null;


        // ====================================================
        // Sniper Scope V1
        // ====================================================

        this.sniperScopeActive =
            false;


        this.sniperScopeLevel =
            0;


        this.sniperNormalFov =
            SNIPER_SCOPE_CONFIG
                .normalFov;


        // ====================================================
        // Sniper Shooting Feedback V1
        // ====================================================

        this.sniperShotFovKick =
            0;


        this.sniperShotRecoverySpeed =
            16;


        // ====================================================
        // Multi Map
        // ====================================================

        this.selectedMapName =
            "fy_iceworld_web";


        /*
         * 开始界面当前选择的地图。
         *
         * 点击地图按钮时只修改这个值，
         * 不立即 map.load()。
         */
        this.pendingMapName =
            "fy_iceworld_web";


        this.mapSelectButtons =
            [];


        // ====================================================
        // Match Setup
        // ====================================================

        this.selectedTeam =
            MATCH_SETUP_CONFIG.defaultTeam;


        this.selectedDifficulty =
            MATCH_SETUP_CONFIG.defaultDifficulty;


        this.selectedTeamSize =
            MATCH_SETUP_CONFIG.defaultTeamSize;


        // ====================================================
        // State
        // ====================================================

        this.initialized = false;

        this.running = false;

        this.paused = false;


        /*
         * Multi-Map V3:
         *
         * 页面打开时只加载地图预览，
         * CLICK TO PLAY 后才创建 BOT / 启动 Round。
         */
        this.gameplayStarted =
            false;


        // ====================================================
        // Keyboard
        // ====================================================

        this.keys =
            new Set();


        // ====================================================
        // Spectator
        // ====================================================

        /*
         * 玩家死亡后进入自由观察模式：
         *
         * W / A / S / D = 水平移动
         * Space = 上升
         * CapsLock = 下降
         * Shift = 加速
         */
        this.spectatorSpeed =
            12;


        this.spectatorFastMultiplier =
            2.2;


        /*
         * 玩家死亡后显示的 NEXT ROUND 按钮。
         *
         * game.js 动态生成，
         * 不要求修改 index.html。
         */
        this.spectatorNextRoundButton =
            null;


        // ====================================================
        // BOT names
        // ====================================================

        this.usedBotNames =
            new Set();


        // ====================================================
        // FPS
        // ====================================================

        this.fpsAverage =
            new RollingAverage(
                60
            );


        this.lastFPSUpdate =
            0;


        // ====================================================
        // Navigation Debug
        // ====================================================

        this.navigationDebugEnabled =
            false;


        this.navigationDebugButton =
            null;


        this._navigationDebugClickHandler =
            null;


        // ====================================================
        // Bound events
        // ====================================================

        this._boundAnimate =
            () =>
                this.animate();


        this._boundResize =
            () =>
                this.onResize();


        this._boundKeyDown =
            event =>
                this.onKeyDown(
                    event
                );


        this._boundKeyUp =
            event =>
                this.onKeyUp(
                    event
                );


        this._boundMouseDown =
            event =>
                this.onMouseDown(
                    event
                );


        this._boundMouseUp =
            event =>
                this.onMouseUp(
                    event
                );


        this._boundContextMenu =
            event =>
                event.preventDefault();
    }


    // ========================================================
    // Init
    // ========================================================

    async init() {

        if (
            this.initialized
        ) {
            return this;
        }


        // ====================================================
        // Renderer / Scene / Camera
        // ====================================================

        this.createRenderer();

        this.createScene();

        this.createCamera();

        this.createControls();

        this.createLights();

        this.createSkyEnvironment();


        // ====================================================
        // Systems requiring scene
        // ====================================================

        grenadeSystem.init({
            scene:
                this.scene
        });


        this.pendingMapName =
            this.getInitialSelectedMapName();


        this.readMatchSetupFromURL();


        /*
         * Multi-Map V6:
         *
         * 页面启动时直接加载 URL 里选择的地图。
         * 此时仍然不会创建 BOT，也不会启动 Round。
         */
        this.selectedMapName =
            this.pendingMapName;


        map.init({
            scene:
                this.scene,

            mapName:
                this.selectedMapName
        });


        console.log(
            "[Game] Initial map resolved",
            {
                url:
                    window.location.href,

                selectedMapName:
                    this.selectedMapName,

                mapCurrentMap:
                    map.currentMap,

                groupMapName:
                    map.group?.userData?.mapName,

                groupMapVersion:
                    map.group?.userData?.mapVersion
            }
        );


        effects.init({
            scene:
                this.scene,

            camera:
                this.camera,

            renderer:
                this.renderer
        });


        // ====================================================
        // Player
        // ====================================================

        this.createPlayer();

		// ====================================================
		// Dropped Weapon & Pickup System V1
		// ====================================================

		droppedWeaponSystem.init({
			game:
				this,

			scene:
				this.scene
		});

        // ====================================================
        // First Person Weapon
        // ====================================================

        this.weaponView =
            new WeaponView({
                camera:
                    this.camera,

                player:
                    this.player
            });


        this.weaponView.init();


        // ====================================================
        // Bot AI manager
        // ====================================================

        this.botAIManager =
            new BotAIManager({
                player:
                    this.player,

                collisionObjects:
                    map.getAICollisionObjects(),

                navigationGraph:
                    map.getNavigationGraph(),

                navigationMap:
                    map
            });


        /*
         * 开始界面阶段 AI 必须关闭。
         *
         * startGameplay() 才重新开启。
         */
        this.botAIManager
            .setEnabled(
                false
            );


        // ====================================================
        // Default BOTs
        //
        // Multi-Map V3:
        // 页面初始化阶段不创建 BOT。
        // CLICK TO PLAY 后由 startGameplay() 创建。
        // ====================================================


        // ====================================================
        // Round
        // ====================================================

        round.setPlayer(
            this.player
        );


        round.setBots(
            this.bots
        );


        round.botAIManager =
            this.botAIManager;


        round.map =
            map;


        // ====================================================
        // Economy
        // ====================================================

        economy.setRoundSystem(
            round
        );


        economy.setMap(
            map
        );


        // ====================================================
        // Radio
        // ====================================================

        radio.setPlayer(
            this.player
        );


        // ====================================================
        // HUD
        // ====================================================

        hud.setPlayer(
            this.player
        );


        hud.setRoundSystem(
            round
        );


        hud.setBots(
            this.bots
        );


        hud.init();


        // ====================================================
        // UI
        // ====================================================

        ui.setPlayer(
            this.player
        );


        ui.setControls(
            this.controls
        );


        ui.setAddBotHandler(
            team => {

                this.addBot(
                    team
                );
            }
        );


        ui.setClearBotsHandler(
            () => {

                this.clearBots();
            }
        );


        ui.init();


        // ====================================================
        // Navigation Debug UI
        // ====================================================

        this.bindNavigationDebugControl();


        // ====================================================
        // Audio
        // ====================================================

        this.bindAudioEvents();


        // ====================================================
        // Game Events
        // ====================================================

        this.bindGameEvents();


        // ====================================================
        // Spectator NEXT ROUND Button
        // ====================================================

        this.createSpectatorNextRoundButton();


        // ====================================================
        // Browser Input
        // ====================================================

        this.bindInput();


        // ====================================================
        // Initial Match
        //
        // Multi-Map V3:
        // 不在网页打开时启动回合。
        // CLICK TO PLAY 后再启动。
        // ====================================================


        this.initialized =
            true;


        this.start();


        console.log(
            `[${GAME_CONFIG.name}] initialized`
        );


        return this;
    }


    // ========================================================
    // Renderer
    // ========================================================

    createRenderer() {

        this.renderer =
            new THREE.WebGLRenderer({
                antialias:
                    true
            });


        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );


        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );


        this.renderer.shadowMap.enabled =
            true;


        this.renderer.shadowMap.type =
            THREE.PCFSoftShadowMap;


        this.renderer.outputColorSpace =
            THREE.SRGBColorSpace;


        document.body.appendChild(
            this.renderer.domElement
        );


        this.renderer.domElement.id =
            "game-canvas";
    }


    // ========================================================
    // Scene
    // ========================================================

    createScene() {

        this.scene =
            new THREE.Scene();


        this.scene.background =
            new THREE.Color(
                0x8fd0ff
            );


        /*
         * Map Rendering V1:
         * 柔和蓝白雾，让地图边界与天空自然融合。
         */
        this.scene.fog =
            new THREE.Fog(
                0xcdeeff,
                82,
                190
            );
    }


    // ========================================================
    // Camera
    // ========================================================

    createCamera() {

        this.camera =
            new THREE.PerspectiveCamera(
                75,

                window.innerWidth /
                window.innerHeight,

                0.1,

                1000
            );


        this.camera.position.set(
            0,
            PLAYER_CONFIG.eyeHeight,
            -45
        );


        this.scene.add(
            this.camera
        );
    }


    // ========================================================
    // Pointer Lock
    // ========================================================

    createControls() {

        this.controls =
            new PointerLockControls(
                this.camera,
                document.body
            );


        this.controls.addEventListener(
            "lock",
            async () => {

                /*
                 * 浏览器 AudioContext
                 * 通常需要用户交互后 resume。
                 */
                await audio.resume();


                gameEvents.emit(
                    "game:pointer-lock",
                    {
                        locked:
                            true
                    }
                );
            }
        );


        this.controls.addEventListener(
            "unlock",
            () => {

                this.player
                    ?.stopFire();


                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                gameEvents.emit(
                    "game:pointer-lock",
                    {
                        locked:
                            false
                    }
                );
            }
        );
    }


    // ========================================================
    // Lighting
    // ========================================================

    createLights() {

        const ambient =
            new THREE.HemisphereLight(
                0xeaf8ff,
                0x7d8f9f,
                1.45
            );


        this.scene.add(
            ambient
        );


        const sun =
            new THREE.DirectionalLight(
                0xfff4de,
                1.45
            );


        sun.position.set(
            42,
            68,
            -36
        );


        sun.castShadow =
            true;


        sun.shadow.mapSize.set(
            2048,
            2048
        );


        sun.shadow.camera.left =
            -80;


        sun.shadow.camera.right =
            80;


        sun.shadow.camera.top =
            80;


        sun.shadow.camera.bottom =
            -80;


        this.scene.add(
            sun
        );
    }



    // ========================================================
    // Sky Environment V1
    //
    // Procedural blue sky + white clouds.
    // Pure Three.js / CanvasTexture, no external assets.
    // ========================================================

    createSkyEnvironment() {

        this.disposeSkyEnvironment();


        // ----------------------------------------------------
        // Sky dome
        // ----------------------------------------------------

        const skyGeometry =
            new THREE.SphereGeometry(
                430,
                32,
                18
            );


        const skyMaterial =
            new THREE.ShaderMaterial({
                side:
                    THREE.BackSide,

                depthWrite:
                    false,

                uniforms: {
                    topColor: {
                        value:
                            new THREE.Color(
                                0x4b9fe3
                            )
                    },

                    horizonColor: {
                        value:
                            new THREE.Color(
                                0xe5f7ff
                            )
                    },

                    exponent: {
                        value:
                            0.72
                    }
                },

                vertexShader: `
                    varying vec3 vWorldPosition;

                    void main() {
                        vec4 worldPosition =
                            modelMatrix *
                            vec4(position, 1.0);

                        vWorldPosition =
                            worldPosition.xyz;

                        gl_Position =
                            projectionMatrix *
                            modelViewMatrix *
                            vec4(position, 1.0);
                    }
                `,

                fragmentShader: `
                    uniform vec3 topColor;
                    uniform vec3 horizonColor;
                    uniform float exponent;

                    varying vec3 vWorldPosition;

                    void main() {
                        vec3 direction =
                            normalize(vWorldPosition);

                        float h =
                            clamp(
                                direction.y * 0.5 + 0.5,
                                0.0,
                                1.0
                            );

                        h =
                            pow(
                                h,
                                exponent
                            );

                        vec3 color =
                            mix(
                                horizonColor,
                                topColor,
                                h
                            );

                        gl_FragColor =
                            vec4(color, 1.0);
                    }
                `
            });


        this.skyDome =
            new THREE.Mesh(
                skyGeometry,
                skyMaterial
            );


        this.skyDome.name =
            "SKY_DOME";


        this.skyDome.frustumCulled =
            false;


        this.skyDome.userData
            .ignoreHitbox =
            true;


        this.scene.add(
            this.skyDome
        );


        // ----------------------------------------------------
        // Clouds
        // ----------------------------------------------------

        this.cloudGroup =
            new THREE.Group();


        this.cloudGroup.name =
            "SKY_CLOUDS";


        const cloudTexture =
            this.createCloudTexture();


        const cloudMaterial =
            new THREE.MeshBasicMaterial({
                map:
                    cloudTexture,

                transparent:
                    true,

                opacity:
                    0.82,

                depthWrite:
                    false,

                side:
                    THREE.DoubleSide,

                blending:
                    THREE.NormalBlending
            });


        const cloudPositions = [
            [-125, 64, -155, 48, 18, 0.18],
            [-70, 78, -185, 64, 23, -0.10],
            [5, 68, -172, 45, 17, 0.07],
            [78, 82, -165, 62, 22, -0.14],
            [145, 66, -125, 50, 19, 0.10],
            [-165, 72, -72, 58, 21, -0.08],
            [158, 84, -30, 68, 24, 0.08],
            [-170, 65, 45, 46, 17, -0.12],
            [165, 70, 62, 54, 20, 0.11],
            [-120, 86, 135, 70, 25, -0.16],
            [-35, 70, 170, 48, 18, 0.08],
            [48, 82, 178, 65, 23, -0.09],
            [132, 68, 140, 50, 19, 0.16]
        ];


        for (
            const [
                x,
                y,
                z,
                width,
                height,
                rotationZ
            ]
            of cloudPositions
        ) {

            const cloud =
                new THREE.Mesh(
                    new THREE.PlaneGeometry(
                        width,
                        height
                    ),
                    cloudMaterial
                );


            cloud.position.set(
                x,
                y,
                z
            );


            cloud.rotation.x =
                -Math.PI / 2 +
                0.12;


            cloud.rotation.z =
                rotationZ;


            cloud.userData.ignoreHitbox =
                true;


            this.cloudGroup.add(
                cloud
            );
        }


        this.scene.add(
            this.cloudGroup
        );
    }


    createCloudTexture() {

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            256;

        canvas.height =
            128;


        const context =
            canvas.getContext(
                "2d"
            );


        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        const circles = [
            [62, 76, 34],
            [93, 59, 42],
            [128, 68, 48],
            [164, 59, 38],
            [193, 78, 31],
            [120, 88, 60]
        ];


        for (
            const [
                x,
                y,
                radius
            ]
            of circles
        ) {

            const gradient =
                context.createRadialGradient(
                    x,
                    y,
                    radius * 0.18,
                    x,
                    y,
                    radius
                );


            gradient.addColorStop(
                0,
                "rgba(255,255,255,0.98)"
            );


            gradient.addColorStop(
                0.58,
                "rgba(255,255,255,0.88)"
            );


            gradient.addColorStop(
                1,
                "rgba(255,255,255,0)"
            );


            context.fillStyle =
                gradient;


            context.beginPath();

            context.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );

            context.fill();
        }


        const texture =
            new THREE.CanvasTexture(
                canvas
            );


        texture.colorSpace =
            THREE.SRGBColorSpace;


        texture.needsUpdate =
            true;


        return texture;
    }


    disposeSkyEnvironment() {

        if (
            this.skyDome
        ) {

            this.skyDome.geometry
                ?.dispose?.();

            this.skyDome.material
                ?.dispose?.();

            this.skyDome.removeFromParent();

            this.skyDome =
                null;
        }


        if (
            this.cloudGroup
        ) {

            const disposedMaterials =
                new Set();


            this.cloudGroup.traverse(
                object => {

                    object.geometry
                        ?.dispose?.();


                    const material =
                        object.material;


                    if (
                        material &&
                        !disposedMaterials.has(
                            material
                        )
                    ) {

                        material.map
                            ?.dispose?.();

                        material.dispose?.();

                        disposedMaterials.add(
                            material
                        );
                    }
                }
            );


            this.cloudGroup
                .removeFromParent();


            this.cloudGroup =
                null;
        }
    }


    // ========================================================
    // Player
    // ========================================================

    createPlayer() {

        this.player =
            new Player({
                camera:
                    this.camera,

                controls:
                    this.controls,

                scene:
                    this.scene,

                team:
                    this.selectedTeam,

                name:
                    "PLAYER (You)"
            });


        map.registerEntity(
            this.player
        );
    }


    // ========================================================
    // Default Bots
    // ========================================================

    createDefaultBots() {

        const teamSize =
            Math.max(
                MATCH_SETUP_CONFIG.minTeamSize,
                Math.min(
                    MATCH_SETUP_CONFIG.maxTeamSize,
                    Number(
                        this.selectedTeamSize
                    ) ||
                    MATCH_SETUP_CONFIG.defaultTeamSize
                )
            );


        const ctBotCount =
            Math.max(
                0,
                teamSize -
                (
                    this.player?.team === TEAM.CT
                        ? 1
                        : 0
                )
            );


        const tBotCount =
            Math.max(
                0,
                teamSize -
                (
                    this.player?.team === TEAM.T
                        ? 1
                        : 0
                )
            );


        for (
            let i = 0;
            i < ctBotCount;
            i++
        ) {

            this.addBot(
                TEAM.CT,
                {
                    announce:
                        false
                }
            );
        }


        for (
            let i = 0;
            i < tBotCount;
            i++
        ) {

            this.addBot(
                TEAM.T,
                {
                    announce:
                        false
                }
            );
        }


        hud.setBots(
            this.bots
        );


        console.log(
            "[Game] Match roster created",
            {
                playerTeam:
                    this.player?.team,

                teamSize,

                ctBots:
                    ctBotCount,

                tBots:
                    tBotCount,

                difficulty:
                    this.selectedDifficulty
            }
        );
    }


    // ========================================================
    // Add Bot
    // ========================================================

    addBot(
        team = TEAM.T,
        {
            name = null,
            personality = null,
            announce = true
        } = {}
    ) {

        const botName =
            name ||
            this.getUniqueBotName();


        const botPersonality =
            personality ||
            randomItem(
                Object.keys(
                    BOT_CONFIG
                        .personalities
                )
            ) ||
            "balanced";


        const position =
            map.getSpawnPosition(
                team
            );


        const bot =
            new Bot({
                name:
                    `[BOT] ${botName}`,

                team,

                position,

                scene:
                    this.scene,

                personality:
                    botPersonality,

                difficulty:
                    this.selectedDifficulty
            });


        this.bots.push(
            bot
        );


        map.registerEntity(
            bot
        );


        this.botAIManager
            ?.addBot(
                bot
            );


        round.setBots(
            this.bots
        );


        hud.setBots(
            this.bots
        );


        if (
            announce
        ) {

            gameEvents.emit(
                "game:bot-added",
                {
                    bot,
                    team
                }
            );
        }


        return bot;
    }


    // ========================================================
    // Unique Bot Name
    // ========================================================

    getUniqueBotName() {

        const available =
            BOT_CONFIG.names.filter(
                name =>
                    !this.usedBotNames
                        .has(
                            name
                        )
            );


        let name;


        if (
            available.length >
            0
        ) {

            name =
                randomItem(
                    available
                );

        } else {

            name =
                `Soldier${this.usedBotNames.size + 1}`;
        }


        this.usedBotNames.add(
            name
        );


        return name;
    }


    // ========================================================
    // Remove Bot
    // ========================================================

    removeBot(bot) {

        if (
            !bot
        ) {
            return;
        }


        map.unregisterEntity(
            bot
        );


        this.botAIManager
            ?.removeBot(
                bot
            );


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


        bot.destroy();


        round.setBots(
            this.bots
        );


        hud.setBots(
            this.bots
        );


        round.checkWinCondition();
    }


    // ========================================================
    // Clear Bots
    // ========================================================

    clearBots() {

        const bots =
            [
                ...this.bots
            ];


        for (
            const bot
            of bots
        ) {

            this.removeBot(
                bot
            );
        }


        this.usedBotNames.clear();


        hud.refreshScoreboard();


        gameEvents.emit(
            "game:bots-cleared"
        );
    }


    // ========================================================
    // Match Setup
    // ========================================================

    readMatchSetupFromURL() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const team =
            params.get(
                "team"
            );


        this.selectedTeam =
            team === TEAM.T
                ? TEAM.T
                : TEAM.CT;


        const difficulty =
            params.get(
                "difficulty"
            );


        this.selectedDifficulty =
            MATCH_SETUP_CONFIG
                .allowedDifficulties
                .includes(
                    difficulty
                )
                ? difficulty
                : MATCH_SETUP_CONFIG
                    .defaultDifficulty;


        const requestedSize =
            Number(
                params.get(
                    "teamSize"
                )
            );


        this.selectedTeamSize =
            Number.isFinite(
                requestedSize
            )
                ? Math.max(
                    MATCH_SETUP_CONFIG.minTeamSize,
                    Math.min(
                        MATCH_SETUP_CONFIG.maxTeamSize,
                        Math.round(
                            requestedSize
                        )
                    )
                )
                : MATCH_SETUP_CONFIG
                    .defaultTeamSize;


        window.__WEB_CS_MATCH_SETUP__ =
            {
                team:
                    this.selectedTeam,

                difficulty:
                    this.selectedDifficulty,

                teamSize:
                    this.selectedTeamSize
            };


        return window
            .__WEB_CS_MATCH_SETUP__;
    }


    applySelectedTeam() {

        if (
            !this.player
        ) {

            return false;
        }


        this.player.setTeam(
            this.selectedTeam
        );


        ui.setPlayer(
            this.player
        );


        ui.renderBuyMenu();


        hud.refreshAll();


        return true;
    }


    // ========================================================
    // Multi Map V1
    // ========================================================

    getDirectSelectedMapName() {

        const supported =
            new Set([
                "fy_iceworld_web",
                "aim_arena_web"
            ]);


        const params =
            new URLSearchParams(
                window.location.search
            );


        const urlMap =
            params.get(
                "map"
            );


        if (
            supported.has(
                urlMap
            )
        ) {

            return urlMap;
        }


        const globalSelected =
            window.__WEB_CS_SELECTED_MAP__;


        if (
            supported.has(
                globalSelected
            )
        ) {

            return globalSelected;
        }


        return "fy_iceworld_web";
    }


    getInitialSelectedMapName() {

        return this.getDirectSelectedMapName();
    }


    bindMapSelectionUI() {

        /*
         * Multi-Map V5:
         *
         * 地图按钮事件由 index.html 的 Direct DOM
         * fallback 负责，不在这里重复绑定。
         */
        this.updateMapSelectionUI();
    }


    selectMap(
        mapName
    ) {

        /*
         * Multi-Map V6:
         *
         * 地图选择由 index.html 通过 URL 参数 + reload 处理。
         * Game 不再在运行中热切换地图。
         */
        if (
            mapName !==
                "fy_iceworld_web" &&
            mapName !==
                "aim_arena_web"
        ) {

            return false;
        }


        return (
            map.currentMap ===
            mapName
        );
    }


    updateMapSelectionUI() {

        const mapName =
            this.getDirectSelectedMapName();


        this.pendingMapName =
            mapName;


        this.selectedMapName =
            mapName;


        window.__WEB_CS_SELECTED_MAP__ =
            mapName;


        const buttons =
            [
                ...document.querySelectorAll(
                    "[data-map-name]"
                )
            ];


        for (
            const button
            of buttons
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
        }


        const label =
            document.getElementById(
                "selected-map-label"
            );


        if (
            label
        ) {

            label.textContent =
                mapName ===
                    "aim_arena_web"
                    ? "AIM ARENA"
                    : "ICEWORLD";
        }
    }


    switchMap(
        mapName
    ) {

        /*
         * Multi-Map V3:
         * 开始界面的地图切换统一走 selectMap()。
         */
        if (
            !this.gameplayStarted
        ) {

            return this.selectMap(
                mapName
            );
        }


        console.warn(
            "[Game] Runtime map switching is disabled in Multi-Map V3."
        );


        return false;
    }


    // ========================================================
    // Start Gameplay
    //
    // 页面打开时没有 BOT / 没有 Round。
    // CLICK TO PLAY 后只执行一次。
    // ========================================================

    startGameplay() {

        if (
            this.gameplayStarted
        ) {

            return true;
        }


        try {

            /*
             * CLICK TO PLAY 前再次读取菜单设置。
             */
            this.readMatchSetupFromURL();


            this.applySelectedTeam();


            /*
             * 页面初始化时地图已经按照 URL 参数加载。
             */
            this.pendingMapName =
                this.getDirectSelectedMapName();


            this.selectedMapName =
                this.pendingMapName;


            // ------------------------------------------------
            // Navigation must match selected map
            // ------------------------------------------------

            this.botAIManager
                ?.setCollisionObjects(
                    map.getAICollisionObjects()
                );


            this.botAIManager
                ?.setNavigation(
                    map.getNavigationGraph(),
                    map
                );


            // ------------------------------------------------
            // Create BOTs only after CLICK TO PLAY
            // ------------------------------------------------

            if (
                this.bots.length ===
                0
            ) {

                this.createDefaultBots();
            }


            round.setBots(
                this.bots
            );


            hud.setBots(
                this.bots
            );


            round.map =
                map;


            economy.setMap(
                map
            );


            /*
             * 正式比赛开始前才开启 BOT AI。
             */
            this.botAIManager
                ?.setEnabled(
                    true
                );


            // ------------------------------------------------
            // Start real match
            // ------------------------------------------------

            round.startMatch({
                resetScore:
                    true,

                resetPlayer:
                    true,

                resetBots:
                    true
            });


            this.gameplayStarted =
                true;


            gameEvents.emit(
                "game:gameplay-started",
                {
                    mapName:
                        this.selectedMapName,

                    botCount:
                        this.bots.length,

                    playerTeam:
                        this.selectedTeam,

                    difficulty:
                        this.selectedDifficulty,

                    teamSize:
                        this.selectedTeamSize
                }
            );


            console.log(
                `[Game] Gameplay started on ${this.selectedMapName} with ${this.bots.length} BOTs`
            );


            return true;

        } catch (
            error
        ) {

            console.error(
                "[Game] Failed to start gameplay:",
                error
            );


            const errorBox =
                document.getElementById(
                    "game-error"
                );


            if (
                errorBox
            ) {

                errorBox.style.display =
                    "block";


                errorBox.textContent =
                    `Game start failed: ${error.message}`;
            }


            return false;
        }
    }


    // ========================================================
    // Audio Events
    // ========================================================

    bindAudioEvents() {

        gameEvents.on(
            "player:footstep",
            data => {

                if (
                    data.player !==
                    this.player
                ) {
                    return;
                }


                audio.playFootstep({
                    sprinting:
                        data.sprinting,

                    crouching:
                        data.crouching
                });
            }
        );


        gameEvents.on(
            "weapon:empty",
            data => {

                if (
                    data.owner ===
                    this.player
                ) {

                    audio.playEmptyClick();
                }
            }
        );


        /*
         * Reload Sound V2
         *
         * 由 WeaponView 在换弹动画不同阶段发送：
         * - mag-release
         * - mag-out
         * - mag-in
         * - action
         *
         * 只处理玩家自己的第一人称换弹声音。
         */
        gameEvents.on(
            "weapon:reload-stage",
            data => {
				/*
				console.log(
					"[ReloadDebug][Game] reload-stage:",
					data?.stage,
					data?.weaponId
				);
				
				console.log(
            "[ReloadDebug][AudioState]",
            {
                initialized:
                    audio.initialized,

                contextState:
                    audio.context?.state,

                masterVolume:
                    audio.masterVolume,

                weaponVolume:
                    audio.weaponVolume
            }
        );
		*/
				
                if (
                    data?.owner &&
                    data.owner !==
                    this.player
                ) {

                    return;
                }


                audio.playReloadStage(
                    data?.stage ||
                    "start",

                    data?.weaponId ||
                    "default"
                );
            }
        );


        gameEvents.on(
            "economy:purchase",
            data => {

                if (
                    data.buyer ===
                    this.player
                ) {

                    audio.playUIClick();
                }
            }
        );
    }


    // ========================================================
    // Game Events
    // ========================================================

    bindGameEvents() {

        // ----------------------------------------------------
        // Start Request -> Apply Selected Map
        // ----------------------------------------------------

        gameEvents.on(
            "ui:start-request",
            () => {

                /*
                 * CLICK TO PLAY:
                 * 这时才创建 BOT 并启动 Round。
                 */
                this.startGameplay();
            }
        );


        // ----------------------------------------------------
        // Pause Menu V2
        // ----------------------------------------------------

        gameEvents.on(
            "ui:pause-request",
            () => {

                if (
                    !this.gameplayStarted
                ) {

                    return;
                }


                this.keys.clear();

                this.player
                    ?.stopFire?.();


                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.setPaused(
                    true
                );
            }
        );


        gameEvents.on(
            "ui:resume-request",
            () => {

                if (
                    !this.gameplayStarted
                ) {

                    return;
                }


                this.keys.clear();

                this.setPaused(
                    false
                );
            }
        );


        gameEvents.on(
            "ui:restart-round-request",
            () => {

                if (
                    !this.gameplayStarted
                ) {

                    return;
                }


                this.keys.clear();

                this.player
                    ?.stopFire?.();

                this.setPaused(
                    false
                );


                round.startNextRound();


                ui.hidePauseMenu();


                window.setTimeout(
                    () => {

                        ui.requestGameFocus();

                    },
                    0
                );
            }
        );


        gameEvents.on(
            "ui:restart-match-request",
            () => {

                if (
                    !this.gameplayStarted
                ) {

                    return;
                }


                this.keys.clear();

                this.player
                    ?.stopFire?.();

                this.setPaused(
                    false
                );


                round.startMatch({
                    resetScore:
                        true,

                    resetPlayer:
                        true,

                    resetBots:
                        true
                });


                ui.hidePauseMenu();


                window.setTimeout(
                    () => {

                        ui.requestGameFocus();

                    },
                    0
                );
            }
        );


        gameEvents.on(
            "ui:main-menu-request",
            () => {

                /*
                 * 当前地图由 URL 管理。
                 * reload 可彻底清掉旧 Round / BOT / Economy 状态，
                 * 并重新回到 Main Menu V2。
                 */
                window.location.reload();
            }
        );


        // ----------------------------------------------------
        // Freeze Start → BOT Auto Buy
        // ----------------------------------------------------

        gameEvents.on(
            GAME_EVENT.ROUND_FREEZE_START,
            () => {

                window.setTimeout(
                    () => {

                        economy.autoBuyBots();

                    },
                    100
                );
            }
        );


        // ----------------------------------------------------
        // Player Death
        // ----------------------------------------------------

        gameEvents.on(
            GAME_EVENT.PLAYER_DEATH,
            () => {

                /*
                 * 死亡以后：
                 *
                 * 1. 停止射击
                 * 2. 隐藏第一人称枪
                 * 3. 进入自由观察
                 * 4. 清空旧移动按键
                 * 5. 显示 NEXT ROUND
                 */
                this.player
                    ?.stopFire?.();


                this.exitSniperScope({
                    restoreWeaponView:
                        false
                });


                this.weaponView
                    ?.setVisible?.(
                        false
                    );


                this.player
                    ?.enterSpectatorMode?.();


                this.keys.clear();


                this.showSpectatorNextRoundButton();
            }
        );


        // ----------------------------------------------------
        // Player Spawn / Next Round
        // ----------------------------------------------------

        gameEvents.on(
            GAME_EVENT.PLAYER_SPAWN,
            data => {

                if (
                    data?.player &&
                    data.player !==
                    this.player
                ) {
                    return;
                }


                this.keys.clear();


                /*
                 * 新一局隐藏按钮。
                 */
                this.hideSpectatorNextRoundButton();


                this.player
                    ?.exitSpectatorMode?.();


                this.exitSniperScope({
                    restoreWeaponView:
                        false
                });


                /*
                 * 恢复第一人称枪。
                 */
                this.weaponView
                    ?.setVisible?.(
                        true
                    );
            }
        );


        // ----------------------------------------------------
        // Sniper Scope Auto Exit
        // ----------------------------------------------------

        gameEvents.on(
            "weapon:equip",
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                if (
                    this.sniperScopeActive
                ) {

                    this.exitSniperScope({
                        restoreWeaponView:
                            true
                    });
                }
            }
        );


        gameEvents.on(
            GAME_EVENT.WEAPON_RELOAD,
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });
            }
        );


        gameEvents.on(
            "grenade:selected",
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.exitSniperScope({
                    restoreWeaponView:
                        false
                });
            }
        );


        // ----------------------------------------------------
        // Sniper Shooting Feedback V1
        // ----------------------------------------------------

        gameEvents.on(
            GAME_EVENT.WEAPON_FIRE,
            data => {

                if (
                    data?.owner !==
                    this.player ||
                    !this.sniperScopeActive
                ) {

                    return;
                }


                const weapon =
                    data.weapon;


                if (
                    !weapon ||
                    weapon.config
                        ?.scope !==
                        true
                ) {

                    return;
                }


                this.triggerSniperShotFeedback(
                    weapon
                );
            }
        );


        // ----------------------------------------------------
        // BOT Footstep
        // ----------------------------------------------------

        gameEvents.on(
            "bot:footstep",
            data => {

                if (
                    !data.bot ||
                    !this.player
                ) {
                    return;
                }


                const distance =
                    data.bot
                        .getPosition()
                        .distanceTo(
                            this.player
                                .getPosition()
                        );


                audio.playBotFootstep(
                    distance
                );
            }
        );
    }


    // ========================================================
    // Input
    // ========================================================

    bindInput() {

        window.addEventListener(
            "resize",
            this._boundResize
        );


        document.addEventListener(
            "keydown",
            this._boundKeyDown
        );


        document.addEventListener(
            "keyup",
            this._boundKeyUp
        );


        document.addEventListener(
            "mousedown",
            this._boundMouseDown
        );


        document.addEventListener(
            "mouseup",
            this._boundMouseUp
        );


        document.addEventListener(
            "contextmenu",
            this._boundContextMenu
        );
    }


    // ========================================================
    // Key Down
    // ========================================================

    onKeyDown(event) {

        if (
            event.repeat &&
            event.code !==
            INPUT_CONFIG.scoreboard
        ) {
            return;
        }


        // ====================================================
        // Navigation Debug
        //
        // F3 永远优先于 UI 输入。
        // Debug 只控制显示，不会关闭 A*。
        // ====================================================

        if (
            event.code ===
            "F3"
        ) {

            event.preventDefault();

            this.toggleNavigationDebug();

            return;
        }


        // ====================================================
        // Scoreboard
        // ====================================================

        if (
            event.code ===
            INPUT_CONFIG.scoreboard
        ) {

            event.preventDefault();

            hud.showScoreboard();

            return;
        }


        // ====================================================
        // UI / Radio
        // ====================================================

        if (
            ui.handleKeyDown(
                event
            )
        ) {

            event.preventDefault();

            return;
        }


        /*
         * 注意：
         *
         * 即使玩家死亡，
         * WASD 也必须进入 this.keys。
         *
         * 否则 Spectator 无法移动。
         */
        this.keys.add(
            event.code
        );


        // ====================================================
        // Spectator
        // ====================================================

        if (
            !this.player ||
            !this.player.isAlive
        ) {

            this.handleSpectatorKey(
                event
            );


            return;
        }


        // ====================================================
        // Normal Player
        // ====================================================

        switch (
            event.code
        ) {

            case INPUT_CONFIG.jump:

                event.preventDefault();

                this.player.jump();

                break;


            case INPUT_CONFIG.crouch:

                this.player.setCrouching(
                    true
                );

                break;


            case INPUT_CONFIG.reload:

                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.player.reload();

                break;


            case INPUT_CONFIG.weaponPrimary:

                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.player.equipPrimary();

                break;


            case INPUT_CONFIG.weaponSecondary:

                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.player.equipSecondary();

                break;


            case INPUT_CONFIG.knife:

                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.player.equipKnife();

                break;


            case INPUT_CONFIG.lastWeapon:

                this.exitSniperScope({
                    restoreWeaponView:
                        true
                });


                this.player.switchLastWeapon();

                break;


            // =================================================
            // Grenade First Person V1
            //
            // 4 = Grenade Slot / cycle HE -> Flash -> Smoke
            // Left Mouse = hold to prime, release to throw
            // =================================================

            case INPUT_CONFIG.grenadeSlot:

                event.preventDefault();


                this.exitSniperScope({
                    restoreWeaponView:
                        false
                });


                if (
                    !this.weaponView
                        ?.isGrenadeBusy?.()
                ) {

                    this.player
                        .cycleGrenadeSlot();
                }


                break;


            default:

                break;
        }
    }


    // ========================================================
    // Navigation Debug Control
    //
    // UI button + F3 共用同一个开关。
    // OFF 只隐藏 Debug Graph / Path；
    // A* 与 BOT Navigation 始终继续工作。
    // ========================================================

    bindNavigationDebugControl() {

        const button =
            document.getElementById(
                "nav-debug-toggle"
            );


        this.navigationDebugButton =
            button;


        this.navigationDebugEnabled =
            false;


        map.setNavigationDebug(
            false
        );


        if (!button) {

            console.warn(
                "[Game] Navigation debug button not found."
            );

            return;
        }


        this._navigationDebugClickHandler =
            event => {

                event.preventDefault();

                event.stopPropagation();

                this.toggleNavigationDebug();
            };


        button.addEventListener(
            "click",
            this._navigationDebugClickHandler
        );


        this.updateNavigationDebugButton();
    }


    toggleNavigationDebug() {

        this.navigationDebugEnabled =
            !this.navigationDebugEnabled;


        map.setNavigationDebug(
            this.navigationDebugEnabled
        );


        /*
         * 打开 Debug 后立即要求所有 AI
         * 把当前路径同步到地图显示层。
         */
        if (
            this.navigationDebugEnabled
        ) {

            for (
                const ai
                of this.botAIManager
                    ?.aiControllers
                    ?.values?.() ||
                    []
            ) {

                ai.syncNavigationDebug?.();
            }
        }


        this.updateNavigationDebugButton();


        console.log(
            `[Navigation Debug] ${
                this.navigationDebugEnabled
                    ? "ON"
                    : "OFF"
            }`
        );


        return this.navigationDebugEnabled;
    }


    updateNavigationDebugButton() {

        const button =
            this.navigationDebugButton;


        if (!button) {
            return;
        }


        button.textContent =
            this.navigationDebugEnabled
                ? "NAV DEBUG: ON"
                : "NAV DEBUG: OFF";


        button.dataset.enabled =
            this.navigationDebugEnabled
                ? "true"
                : "false";


        button.style.borderColor =
            this.navigationDebugEnabled
                ? "rgba(80, 255, 120, 0.95)"
                : "rgba(255, 255, 255, 0.28)";


        button.style.color =
            this.navigationDebugEnabled
                ? "#56ff7a"
                : "#d8dde3";


        button.style.background =
            this.navigationDebugEnabled
                ? "rgba(20, 70, 32, 0.86)"
                : "rgba(10, 14, 18, 0.68)";
    }


    // ========================================================
    // Spectator NEXT ROUND Button
    // ========================================================

    createSpectatorNextRoundButton() {

        if (
            this.spectatorNextRoundButton
        ) {
            return;
        }


        const button =
            document.createElement(
                "button"
            );


        button.id =
            "spectator-next-round-button";


        button.type =
            "button";


        button.innerHTML =
            `
            <span
                style="
                    display:block;
                    font-size:17px;
                "
            >
                NEXT ROUND
            </span>

            <span
                style="
                    display:block;
                    font-size:11px;
                    margin-top:3px;
                    opacity:.72;
                "
            >
                Press Esc to release mouse, then click
            </span>
            `;


        /*
         * 默认隐藏。
         */
        button.style.display =
            "none";


        button.style.position =
            "fixed";


        button.style.left =
            "50%";


        button.style.bottom =
            "72px";


        button.style.transform =
            "translateX(-50%)";


        button.style.zIndex =
            "10000";


        button.style.minWidth =
            "220px";


        button.style.padding =
            "11px 24px 9px";


        button.style.border =
            "1px solid rgba(255, 190, 60, 0.95)";


        button.style.borderRadius =
            "3px";


        button.style.background =
            "rgba(12, 14, 16, 0.88)";


        button.style.color =
            "#ffd15c";


        button.style.fontFamily =
            "Arial, Helvetica, sans-serif";


        button.style.fontWeight =
            "700";


        button.style.letterSpacing =
            "1px";


        button.style.cursor =
            "pointer";


        button.style.userSelect =
            "none";


        button.style.boxShadow =
            "0 0 14px rgba(255, 170, 40, 0.32)";


        button.style.backdropFilter =
            "blur(2px)";


        // ----------------------------------------------------
        // Hover
        // ----------------------------------------------------

        button.addEventListener(
            "mouseenter",
            () => {

                button.style.background =
                    "rgba(95, 68, 14, 0.94)";


                button.style.color =
                    "#ffffff";
            }
        );


        button.addEventListener(
            "mouseleave",
            () => {

                button.style.background =
                    "rgba(12, 14, 16, 0.88)";


                button.style.color =
                    "#ffd15c";
            }
        );


        // ----------------------------------------------------
        // Click
        // ----------------------------------------------------

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();


                /*
                 * 只有死亡状态才能使用。
                 */
                if (
                    !this.player ||
                    this.player.isAlive
                ) {

                    this.hideSpectatorNextRoundButton();

                    return;
                }


                this.forceNextRoundFromSpectator();
            }
        );


        document.body.appendChild(
            button
        );


        this.spectatorNextRoundButton =
            button;
    }


    // ========================================================
    // Show NEXT ROUND
    // ========================================================

    showSpectatorNextRoundButton() {

        if (
            !this.spectatorNextRoundButton
        ) {

            this.createSpectatorNextRoundButton();
        }


        if (
            this.spectatorNextRoundButton
        ) {

            this.spectatorNextRoundButton
                .style.display =
                "block";
        }
    }


    // ========================================================
    // Hide NEXT ROUND
    // ========================================================

    hideSpectatorNextRoundButton() {

        if (
            this.spectatorNextRoundButton
        ) {

            this.spectatorNextRoundButton
                .style.display =
                "none";
        }
    }


    // ========================================================
    // Force Next Round From Spectator
    // ========================================================

    forceNextRoundFromSpectator() {

        if (
            !this.player ||
            this.player.isAlive
        ) {

            return false;
        }


        this.hideSpectatorNextRoundButton();


        this.keys.clear();


        this.player
            ?.stopFire?.();


        /*
         * 兼容不同 round.js 版本。
         */
        if (
            typeof round.forceNextRound ===
            "function"
        ) {

            round.forceNextRound();

            return true;
        }


        if (
            typeof round.forceEnd ===
            "function"
        ) {

            round.forceEnd();

            return true;
        }


        if (
            typeof round.endRound ===
            "function"
        ) {

            round.endRound({
                reason:
                    "spectator-skip"
            });


            return true;
        }


        console.warn(
            "[Game] Round system has no force-next-round API."
        );


        return false;
    }
	    // ========================================================
    // Spectator Key
    // ========================================================

    handleSpectatorKey(event) {

        /*
         * Spectator 移动不在 keydown 中直接执行。
         *
         * updateSpectatorMovement()
         * 每帧读取 this.keys。
         */

        if (
            event.code ===
                INPUT_CONFIG.jump ||
            event.code ===
                INPUT_CONFIG.crouch
        ) {

            event.preventDefault();
        }
    }


    // ========================================================
    // Key Up
    // ========================================================

    onKeyUp(event) {

        this.keys.delete(
            event.code
        );


        if (
            event.code ===
            INPUT_CONFIG.scoreboard
        ) {

            event.preventDefault();

            hud.hideScoreboard();

            return;
        }


        if (
            event.code ===
            INPUT_CONFIG.crouch
        ) {

            this.player
                ?.setCrouching(
                    false
                );
        }
    }


    // ========================================================
    // Mouse Down
    // ========================================================

    onMouseDown(event) {

        if (
            !this.controls
                ?.isLocked
        ) {
            return;
        }


        /*
         * Spectator 禁止开枪。
         */
        if (
            !this.player
                ?.isAlive
        ) {
            return;
        }


        if (
            event.button ===
            2
        ) {

            event.preventDefault();


            this.toggleSniperScope();

            return;
        }


        if (
            event.button ===
            0
        ) {

            if (
                this.player.grenadeMode
            ) {

                if (
                    this.player
                        .beginGrenadePrime()
                ) {

                    this.weaponView
                        ?.beginGrenadePrime?.();
                }

            } else {

                this.player.startFire();
            }
        }
    }


    // ========================================================
    // Mouse Up
    // ========================================================

    onMouseUp(event) {

        if (
            event.button ===
            0
        ) {

            if (
                this.player
                    ?.grenadeMode
            ) {

                if (
                    this.player
                        .releaseGrenadePrime()
                ) {

                    this.weaponView
                        ?.releaseGrenadeThrow?.();
                }

            } else {

                this.player
                    ?.stopFire();
            }
        }
    }


    // ========================================================
    // Sniper Scope V2
    //
    // Right Mouse:
    // 0 -> 1 -> 2 -> 0
    // ========================================================

    getCurrentScopeWeapon() {

        const weapon =
            this.player
                ?.inventory
                ?.currentWeapon;


        if (
            !weapon ||
            weapon.config
                ?.scope !==
                true
        ) {

            return null;
        }


        return weapon;
    }


    canEnterSniperScope() {

        if (
            !SNIPER_SCOPE_CONFIG
                .enabled ||
            !this.player
                ?.isAlive ||
            !this.player
                ?.controlsEnabled ||
            this.player
                ?.grenadeMode ||
            this.player
                ?.isSpectating
        ) {

            return false;
        }


        const weapon =
            this.getCurrentScopeWeapon();


        if (
            !weapon ||
            weapon.isReloading
        ) {

            return false;
        }


        return true;
    }


    getScopeFov(
        level
    ) {

        if (
            level >=
            2
        ) {

            return (
                SNIPER_SCOPE_CONFIG
                    .zoomLevel2Fov ??
                14
            );
        }


        if (
            level >=
            1
        ) {

            return (
                SNIPER_SCOPE_CONFIG
                    .zoomLevel1Fov ??
                SNIPER_SCOPE_CONFIG
                    .zoomFov ??
                28
            );
        }


        return (
            this.sniperNormalFov ||
            SNIPER_SCOPE_CONFIG
                .normalFov
        );
    }


    setSniperScopeLevel(
        level,
        {
            restoreWeaponView = true
        } = {}
    ) {

        level =
            Math.max(
                0,
                Math.min(
                    2,
                    Math.floor(
                        Number(level) ||
                        0
                    )
                )
            );


        if (
            level >
            0 &&
            !this.canEnterSniperScope()
        ) {

            return false;
        }


        if (
            !this.camera
        ) {

            return false;
        }


        const previousLevel =
            this.sniperScopeLevel;


        if (
            previousLevel ===
            0 &&
            level >
            0
        ) {

            this.sniperNormalFov =
                Number(
                    this.camera.fov
                ) ||
                SNIPER_SCOPE_CONFIG
                    .normalFov;
        }


        this.sniperScopeLevel =
            level;


        this.sniperScopeActive =
            level >
            0;


        /*
         * 切换倍率 / 退出 Scope 时，
         * 清掉上一发残留的 FOV kick。
         */
        this.sniperShotFovKick =
            0;


        this.player
            ?.setSniperScopeLevel?.(
                level
            );


        if (
            level >
            0
        ) {

            this.camera.fov =
                this.getScopeFov(
                    level
                );


            this.camera
                .updateProjectionMatrix();


            this.weaponView
                ?.setVisible?.(
                    false
                );


            hud.setSniperScope?.(
                true
            );

        } else {

            this.camera.fov =
                Number(
                    this.sniperNormalFov
                ) ||
                SNIPER_SCOPE_CONFIG
                    .normalFov;


            this.camera
                .updateProjectionMatrix();


            hud.setSniperScope?.(
                false
            );


            if (
                restoreWeaponView &&
                this.player
                    ?.isAlive &&
                !this.player
                    ?.isSpectating
            ) {

                this.weaponView
                    ?.setVisible?.(
                        true
                    );
            }
        }


        if (
            previousLevel !==
            level
        ) {

            gameEvents.emit(
                "player:scope-changed",
                {
                    player:
                        this.player,

                    active:
                        level > 0,

                    level,

                    previousLevel,

                    weapon:
                        this.player
                            ?.inventory
                            ?.currentWeapon ??
                        null,

                    fov:
                        this.camera.fov
                }
            );
        }


        return true;
    }


    enterSniperScope(
        level = 1
    ) {

        return this.setSniperScopeLevel(
            level,
            {
                restoreWeaponView:
                    false
            }
        );
    }


    exitSniperScope({
        restoreWeaponView = true
    } = {}) {

        const wasActive =
            this.sniperScopeLevel >
            0;


        this.setSniperScopeLevel(
            0,
            {
                restoreWeaponView
            }
        );


        return wasActive;
    }


    toggleSniperScope() {

        if (
            this.sniperScopeLevel ===
            0
        ) {

            return this.enterSniperScope(
                1
            );
        }


        if (
            this.sniperScopeLevel ===
            1
        ) {

            return this.enterSniperScope(
                2
            );
        }


        this.exitSniperScope({
            restoreWeaponView:
                true
        });


        return true;
    }


    // ========================================================
    // Sniper Shooting Feedback V1
    // ========================================================

    triggerSniperShotFeedback(
        weapon
    ) {

        if (
            !this.sniperScopeActive ||
            !weapon
        ) {

            return false;
        }


        const feedbackConfig =
            SNIPER_SCOPE_CONFIG
                .shotFeedback
                ?.[
                    weapon.id
                ];


        const fovKick =
            Number(
                feedbackConfig
                    ?.fovKick
            ) ||
            (
                weapon.id ===
                    "awp"
                    ? 1.35
                    : 0.65
            );


        const recoverySpeed =
            Number(
                feedbackConfig
                    ?.recoverySpeed
            ) ||
            (
                weapon.id ===
                    "awp"
                    ? 13.5
                    : 18
            );


        /*
         * AWP 比 Scout 的镜头冲击明显更强。
         *
         * 这里故意只做“开枪后的视觉冲击”，
         * 不修改刚刚那一发 Raycast 方向。
         */
        this.sniperShotFovKick =
            Math.max(
                this.sniperShotFovKick,
                fovKick
            );


        this.sniperShotRecoverySpeed =
            recoverySpeed;


        return true;
    }


    updateSniperShotFeedback(
        delta
    ) {

        if (
            !this.camera
        ) {

            return;
        }


        if (
            !this.sniperScopeActive ||
            this.sniperScopeLevel <=
            0
        ) {

            this.sniperShotFovKick =
                0;


            return;
        }


        const baseFov =
            this.getScopeFov(
                this.sniperScopeLevel
            );


        if (
            this.sniperShotFovKick >
            0.0001
        ) {

            this.sniperShotFovKick =
                Math.max(
                    0,
                    this.sniperShotFovKick -
                    this.sniperShotRecoverySpeed *
                    delta
                );
        }


        const targetFov =
            baseFov +
            this.sniperShotFovKick;


        if (
            Math.abs(
                this.camera.fov -
                targetFov
            ) >
            0.0001
        ) {

            this.camera.fov =
                targetFov;


            this.camera
                .updateProjectionMatrix();
        }
    }


    // ========================================================
    // Player Movement Input
    // ========================================================

    updatePlayerInput() {

        if (
            !this.player ||
            !this.player.isAlive
        ) {

            return;
        }


        this.player.setMovementInput({
            forward:
                this.keys.has(
                    INPUT_CONFIG.moveForward
                ),

            backward:
                this.keys.has(
                    INPUT_CONFIG.moveBackward
                ),

            left:
                this.keys.has(
                    INPUT_CONFIG.moveLeft
                ),

            right:
                this.keys.has(
                    INPUT_CONFIG.moveRight
                ),

            walk:
                this.keys.has(
                    INPUT_CONFIG.walk
                )
        });
    }


    // ========================================================
    // Spectator Free Movement
    //
    // W / A / S / D
    // Space = Up
    // CapsLock = Down
    // Shift = Fast
    // ========================================================

    updateSpectatorMovement(delta) {

        if (
            !this.player ||
            this.player.isAlive ||
            !this.controls?.isLocked
        ) {

            return;
        }


        let forward =
            0;


        let right =
            0;


        let vertical =
            0;


        // ----------------------------------------------------
        // W
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.moveForward
            )
        ) {

            forward +=
                1;
        }


        // ----------------------------------------------------
        // S
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.moveBackward
            )
        ) {

            forward -=
                1;
        }


        // ----------------------------------------------------
        // D
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.moveRight
            )
        ) {

            right +=
                1;
        }


        // ----------------------------------------------------
        // A
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.moveLeft
            )
        ) {

            right -=
                1;
        }


        // ----------------------------------------------------
        // Space = Up
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.jump
            )
        ) {

            vertical +=
                1;
        }


        // ----------------------------------------------------
        // CapsLock = Down
        // ----------------------------------------------------

        if (
            this.keys.has(
                INPUT_CONFIG.crouch
            )
        ) {

            vertical -=
                1;
        }


        // ----------------------------------------------------
        // Speed
        // ----------------------------------------------------

        let speed =
            this.spectatorSpeed;


        if (
            this.keys.has(
                INPUT_CONFIG.walk
            )
        ) {

            speed *=
                this.spectatorFastMultiplier;
        }


        // ----------------------------------------------------
        // Diagonal Normalize
        // ----------------------------------------------------

        const horizontalLength =
            Math.hypot(
                forward,
                right
            );


        if (
            horizontalLength >
            1
        ) {

            forward /=
                horizontalLength;


            right /=
                horizontalLength;
        }


        // ----------------------------------------------------
        // Horizontal
        // ----------------------------------------------------

        this.controls.moveForward(
            forward *
            speed *
            delta
        );


        this.controls.moveRight(
            right *
            speed *
            delta
        );


        // ----------------------------------------------------
        // Vertical
        // ----------------------------------------------------

        const object =
            this.controls
                .getObject?.() ||
            this.camera;


        if (
            object?.position
        ) {

            object.position.y +=
                vertical *
                speed *
                delta;
        }
    }


    // ========================================================
    // Player Collision
    // ========================================================

    resolvePlayerCollision() {

        if (
            !this.player ||
            !this.player.isAlive
        ) {

            return;
        }


        const original =
            this.player.getPosition();


        const corrected =
            map.resolvePositionCollision(
                original,
                PLAYER_CONFIG.radius
            );


        corrected.y =
            original.y;


        this.player.setPosition(
            corrected
        );
    }


    // ========================================================
    // Bot Collision
    // ========================================================

    resolveBotCollisions() {

        for (
            const bot
            of this.bots
        ) {

            if (
                !bot.isAlive
            ) {
                continue;
            }


            const original =
                bot.getPosition();


            const corrected =
                map.resolvePositionCollision(
                    original,
                    bot.radius
                );


            corrected.y =
                original.y;


            bot.setPosition(
                corrected
            );
        }
    }


    // ========================================================
    // Bot Separation
    // ========================================================

    resolveBotSeparation() {

        for (
            let i = 0;
            i < this.bots.length;
            i++
        ) {

            const a =
                this.bots[
                    i
                ];


            if (
                !a.isAlive
            ) {
                continue;
            }


            for (
                let j = i + 1;
                j < this.bots.length;
                j++
            ) {

                const b =
                    this.bots[
                        j
                    ];


                if (
                    !b.isAlive
                ) {
                    continue;
                }


                const delta =
                    a.group.position
                        .clone()
                        .sub(
                            b.group.position
                        );


                delta.y =
                    0;


                const distance =
                    delta.length();


                const minimum =
                    BOT_CONFIG
                        .separation
                        .minDistance;


                if (
                    distance <=
                        0.001 ||
                    distance >=
                        minimum
                ) {

                    continue;
                }


                const push =
                    (
                        minimum -
                        distance
                    ) *
                    0.5;


                delta.normalize();


                a.group.position
                    .addScaledVector(
                        delta,
                        push
                    );


                b.group.position
                    .addScaledVector(
                        delta,
                        -push
                    );
            }
        }
    }


    // ========================================================
    // Bots Update
    // ========================================================

    updateBots(delta) {

        /*
         * AI 决策。
         */
        this.botAIManager
            ?.update(
                delta
            );


        /*
         * BOT 动画 / HP Bar。
         */
        for (
            const bot
            of this.bots
        ) {

            bot.update(
                delta,
                {
                    camera:
                        this.camera
                }
            );
        }


        this.resolveBotCollisions();


        this.resolveBotSeparation();
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        /*
         * 开始菜单阶段只渲染地图预览。
         *
         * 不更新 Player 战斗、
         * 不更新 BOT、
         * 不更新 Round / Economy。
         */
        if (
            !this.gameplayStarted
        ) {

            effects.update(
                delta
            );


            return;
        }


        const playerAlive =
            Boolean(
                this.player
                    ?.isAlive
            );


        // ====================================================
        // Player
        // ====================================================

        if (
            playerAlive
        ) {

            /*
             * 正常玩家输入。
             */
            this.updatePlayerInput();


            this.player
                ?.update(
                    delta
                );


            this.player
                ?.updateFire();


            /*
             * 玩家活着：
             * 普通状态显示第一人称武器；
             * Scope Level 1 / 2 时持续隐藏。
             */
            this.weaponView
                ?.setVisible?.(
                    !this.sniperScopeActive
                );


            this.weaponView
                ?.update(
                    delta
                );


            this.updateSniperShotFeedback(
                delta
            );


            this.resolvePlayerCollision();

        } else {

            // =================================================
            // Spectator
            // =================================================

            /*
             * 死亡以后停止射击。
             */
            this.player
                ?.stopFire?.();


            /*
             * 死亡以后隐藏枪。
             */
            this.weaponView
                ?.setVisible?.(
                    false
                );


            /*
             * 死亡后使用自由观察移动。
             */
            this.updateSpectatorMovement(
                delta
            );
        }


        // ====================================================
        // Bots
        //
        // 即使玩家死亡，
        // BOT 仍然继续战斗。
        // ====================================================

        this.updateBots(
            delta
        );


        // ====================================================
        // Grenades
        // ====================================================

        grenadeSystem.update(
            delta
        );


        // ====================================================
        // Effects
        // ====================================================

        effects.update(
            delta
        );


        // ====================================================
        // Economy
        // ====================================================

        economy.update(
            delta
        );


        // ====================================================
        // Round
        // ====================================================

        round.update(
            delta
        );
    }


    // ========================================================
    // Render
    // ========================================================

    render() {

        if (
            !this.renderer ||
            !this.scene ||
            !this.camera
        ) {

            return;
        }


        this.renderer.render(
            this.scene,
            this.camera
        );
    }


    // ========================================================
    // Main Loop
    // ========================================================

    animate() {

        if (
            !this.running
        ) {

            return;
        }


        requestAnimationFrame(
            this._boundAnimate
        );


        let delta =
            this.clock.getDelta();


        /*
         * 防止切到后台以后回来时
         * delta 突然特别大。
         */
        delta =
            Math.min(
                delta,
                GAME_CONFIG.maxDeltaTime
            );


        if (
            !this.paused
        ) {

            this.update(
                delta
            );
        }


        this.render();


        this.updateFPS(
            delta
        );
    }
	    // ========================================================
    // FPS
    // ========================================================

    updateFPS(delta) {

        if (
            delta <=
            0
        ) {

            return;
        }


        const fps =
            1 /
            delta;


        this.fpsAverage.push(
            fps
        );


        const now =
            performance.now();


        if (
            now -
            this.lastFPSUpdate >
            500
        ) {

            this.lastFPSUpdate =
                now;


            const element =
                document.getElementById(
                    "fps-counter"
                );


            if (
                element
            ) {

                element.textContent =
                    `FPS ${Math.round(
                        this.fpsAverage
                            .average
                    )}`;
            }
        }
    }


    // ========================================================
    // Start
    // ========================================================

    start() {

        if (
            this.running
        ) {

            return;
        }


        this.running =
            true;


        this.clock.start();


        this.animate();
    }


    // ========================================================
    // Stop
    // ========================================================

    stop() {

        this.running =
            false;


        this.clock.stop();


        this.player
            ?.stopFire();


        this.exitSniperScope({
            restoreWeaponView:
                false
        });
    }


    // ========================================================
    // Pause
    // ========================================================

    setPaused(paused) {

        this.paused =
            Boolean(
                paused
            );


        if (
            this.paused
        ) {

            this.exitSniperScope({
                restoreWeaponView:
                    true
            });
        }


        const roundState =
            round.getState?.().state;


        const roundAllowsControl =
            roundState === "LIVE";


        this.player
            ?.setControlsEnabled(
                !this.paused &&
                roundAllowsControl
            );


        this.botAIManager
            ?.setEnabled(
                !this.paused &&
                roundAllowsControl
            );


        gameEvents.emit(
            "game:pause",
            {
                paused:
                    this.paused
            }
        );
    }


    // ========================================================
    // Resize
    // ========================================================

    onResize() {

        if (
            !this.camera ||
            !this.renderer
        ) {

            return;
        }


        this.camera.aspect =
            window.innerWidth /
            window.innerHeight;


        this.camera
            .updateProjectionMatrix();


        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );


        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            initialized:
                this.initialized,

            running:
                this.running,

            paused:
                this.paused,

            selectedMap:
                this.selectedMapName,

            pendingMap:
                this.pendingMapName,

            gameplayStarted:
                this.gameplayStarted,

            player:
                this.player
                    ?.getState() ??
                null,

            bots:
                this.bots.map(
                    bot =>
                        bot.getState()
                ),

            round:
                round.getState(),

            economy:
                economy.getState(),

            map:
                map.getState(),

            navigationDebug:
                this.navigationDebugEnabled,

            sniperScope:
                {
                    active:
                        this.sniperScopeActive,

                    level:
                        this.sniperScopeLevel,

                    fov:
                        this.camera
                            ?.fov ??
                        null,

                    shotFovKick:
                        this.sniperShotFovKick
                },

            radio:
                radio.getState()
        };
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.stop();


        window.removeEventListener(
            "resize",
            this._boundResize
        );


        document.removeEventListener(
            "keydown",
            this._boundKeyDown
        );


        document.removeEventListener(
            "keyup",
            this._boundKeyUp
        );


        document.removeEventListener(
            "mousedown",
            this._boundMouseDown
        );


        document.removeEventListener(
            "mouseup",
            this._boundMouseUp
        );


        document.removeEventListener(
            "contextmenu",
            this._boundContextMenu
        );


        if (
            this.navigationDebugButton &&
            this._navigationDebugClickHandler
        ) {

            this.navigationDebugButton
                .removeEventListener(
                    "click",
                    this._navigationDebugClickHandler
                );
        }


        this.navigationDebugButton =
            null;


        this._navigationDebugClickHandler =
            null;


        // ====================================================
        // Bots
        // ====================================================

        const bots =
            [
                ...this.bots
            ];


        for (
            const bot
            of bots
        ) {

            this.removeBot(
                bot
            );
        }


        // ====================================================
        // Systems
        // ====================================================

        this.botAIManager
            ?.destroy();


        ui.destroy();

        hud.destroy();

        radio.destroy();

        economy.destroy();

        round.destroy();

        effects.destroy();

        map.destroy();

        grenadeSystem.destroy();

        audio.destroy();


        // ====================================================
        // Player
        // ====================================================

        if (
            this.player
        ) {

            map.unregisterEntity(
                this.player
            );


            this.player.destroy();


            this.player =
                null;
        }


        // ====================================================
        // Spectator Button
        // ====================================================

        if (
            this.spectatorNextRoundButton
        ) {

            this.spectatorNextRoundButton
                .remove();


            this.spectatorNextRoundButton =
                null;
        }


        // ====================================================
        // Weapon View
        // ====================================================

        this.weaponView
            ?.destroy();


        this.weaponView =
            null;


        this.disposeSkyEnvironment();


        // ====================================================
        // Renderer
        // ====================================================

        this.renderer
            ?.dispose();


        this.renderer
            ?.domElement
            ?.remove();


        this.renderer =
            null;


        this.camera =
            null;


        this.scene =
            null;


        this.controls =
            null;


        this.gameplayStarted =
            false;


        this.initialized =
            false;
    }
}


// ============================================================
// Global Game Instance
// ============================================================

export const game =
    new Game();


// ============================================================
// Bootstrap
// ============================================================

async function bootstrap() {

    try {

        await game.init();


        /*
         * 浏览器 Console 调试：
         *
         * webCS15.getState()
         *
         * webCS15.addBot("t")
         *
         * round.forceEnd()
         */
        window.webCS15 =
            game;


        if (
            GAME_CONFIG.debug
        ) {

            console.log(
                "[Web-CS15] Debug instance:",
                game
            );
        }

    } catch (
        error
    ) {

        console.error(
            "[Web-CS15] Failed to initialize:",
            error
        );


        const errorBox =
            document.getElementById(
                "game-error"
            );


        if (
            errorBox
        ) {

            errorBox.style.display =
                "block";


            errorBox.textContent =
                `Game initialization failed: ${error.message}`;
        }
    }
}


// ============================================================
// Auto Start
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        bootstrap,
        {
            once:
                true
        }
    );

} else {

    bootstrap();
}


export default game;