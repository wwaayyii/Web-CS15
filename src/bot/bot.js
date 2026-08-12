/**
 * Web-CS15
 * src/bot/bot.js
 *
 * BOT 实体
 *
 * 负责：
 * - BOT 基础数据
 * - Three.js 模型
 * - Hitbox
 * - HP / Armor
 * - Weapon Inventory
 * - Grenade Inventory
 * - Kills / Deaths
 * - Round Spawn / Reset
 * - 战绩继承
 * - Position / Eye Position / Aim Direction
 *
 * 不负责：
 * - 巡逻
 * - 寻敌
 * - 战斗决策
 * - Radio AI
 * - 寻路
 *
 * 以上逻辑全部放到 botAI.js
 */

import * as THREE from "three";

import {
    BOT_CONFIG,
    TEAM,
    ECONOMY_CONFIG,
    WEAPON_SLOT,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    nextID,
    gameEvents
} from "../core/utils.js";

import {
    WeaponInventory
} from "../weapons/weapon.js";

import {
    GrenadeInventory,
    GRENADE_TYPE
} from "../weapons/grenade.js";

import {
    createBotWeaponModel,
    disposeBotWeaponModel
} from "./botWeaponView.js";


// ============================================================
// BOT 命中区域
// ============================================================

export const BOT_HIT_ZONE = Object.freeze({
    HEAD: "head",
    CHEST: "chest",
    STOMACH: "stomach",
    LEFT_ARM: "arm",
    RIGHT_ARM: "arm",
    LEFT_LEG: "leg",
    RIGHT_LEG: "leg"
});


// ============================================================
// BOT
// ============================================================

export class Bot {

    constructor({
        name = null,
        team = TEAM.T,
        position = null,
        scene = null,

        kills = 0,
        deaths = 0,

        money = ECONOMY_CONFIG.startMoney,

        personality = "balanced",

        difficulty = BOT_CONFIG.shooting.difficulty
    } = {}) {

        this.id =
            nextID("bot");

        this.name =
            name ||
            `[BOT] BOT_${this.id}`;

        this.team =
            team;

        this.scene =
            scene;

        this.personality =
            personality;


        /*
         * 每个 BOT 保存自己的难度。
         * BotAI 可以优先读取 bot.difficulty。
         */
        this.difficulty =
            [
                "easy",
                "normal",
                "hard",
                "expert"
            ].includes(
                difficulty
            )
                ? difficulty
                : BOT_CONFIG.shooting.difficulty;


        // ====================================================
        // HP / Armor
        // ====================================================

        this.maxHP =
            BOT_CONFIG.maxHP;

        this.hp =
            BOT_CONFIG.maxHP;

        this.maxArmor =
            BOT_CONFIG.maxArmor;

        this.armor = 0;


        // ====================================================
        // 战绩
        //
        // 注意：
        // 这些数据不会在新回合清零。
        // ====================================================

        this.kills =
            Number(kills) || 0;

        this.deaths =
            Number(deaths) || 0;

        this.assists = 0;

        this.money =
            clamp(
                money,
                0,
                ECONOMY_CONFIG.maxMoney
            );


        // ====================================================
        // 状态
        // ====================================================

        this.isAlive = true;

        this.isDying = false;

        this.isCrouching = false;

        this.isReloading = false;

        this.isMoving = false;

        this.isGrounded = true;

        this.isBlind = false;

        this.blindTimeLeft = 0;

        this.controlsEnabled = true;


        // ====================================================
        // Movement
        // ====================================================

        this.velocity =
            new THREE.Vector3();

        this.moveDirection =
            new THREE.Vector3();

        this.speed =
            BOT_CONFIG.normalSpeed;

        this.radius =
            BOT_CONFIG.radius;


        // ====================================================
        // 方向
        //
        // 模型正面默认朝 -Z。
        // ====================================================

        this.forward =
            new THREE.Vector3(
                0,
                0,
                -1
            );

        this.aimDirection =
            new THREE.Vector3(
                0,
                0,
                -1
            );


        // ====================================================
        // Combat Data
        // ====================================================

        this.currentTarget = null;

        this.lastKnownEnemyPosition =
            null;

        this.lastDamageTime =
            -Infinity;

        this.lastAttacker =
            null;


        // ====================================================
        // Weapon
        // ====================================================

        this.inventory =
            new WeaponInventory({
                owner: this
            });


        // ====================================================
        // Grenades
        // ====================================================

        this.grenadeInventory =
            new GrenadeInventory({
                owner: this
            });


        // ====================================================
        // Round persistence
        // ====================================================

        this.savedRoundInventory =
            null;

        this.savedRoundGrenades =
            null;

        this.survivedLastRound =
            false;


        /*
         * BotAIManager 创建 AI 后会覆盖这个值。
         * 这里保留一个安全默认值，避免 Bot 反向依赖 botAI.js。
         */
        this.tacticalRole =
            "attack";


        // ====================================================
        // Three.js Model
        // ====================================================

        this.group =
            new THREE.Group();

        this.group.name =
            this.name;

        this.group.userData.owner =
            this;

        this.group.userData.isBot =
            true;


        // 模型材料
        this.materials = [];

        this.damageFlashTimer = null;

        this.bodyParts = {
            torso: null,
            stomach: null,
            head: null,
            leftArm: null,
            rightArm: null,
            leftLeg: null,
            rightLeg: null,
            visor: null,
            rifleHolder: null,
            weaponModel: null
        };


        // ====================================================
        // HP Bar
        // ====================================================

        this.hpBarGroup = null;
        this.hpFillMesh = null;
        this.hpFillMaterial = null;


        // ====================================================
        // 动画
        // ====================================================

        this.animationTime =
            Math.random() * 100;

        this.deathAnimationProgress = 0;


        // ====================================================
        // BOT Grenade Throw Animation V1
        // ====================================================

        this.isThrowingGrenade = false;

        this.grenadeThrowType = null;

        this.grenadeThrowTime = 0;

        this.grenadeThrowDuration = 0.82;

        this.grenadeThrowReleased = false;

        this.grenadeViewModel = null;

        this.grenadeThrowDirection =
            new THREE.Vector3(
                0,
                0,
                -1
            );


        // ====================================================
        // Create
        // ====================================================

        this.createModel();

        this.createHPBar();

        this.setupDefaultLoadout();

        this.syncWeaponModel();

        this.setupGrenadeLoadout({
            clearExisting:
                true
        });


        if (position) {

            this.setPosition(
                position
            );
        }


        if (this.scene) {

            this.scene.add(
                this.group
            );
        }
    }


    // ========================================================
    // 默认装备
    // ========================================================

    setupDefaultLoadout() {

        this.inventory.clear({
            keepKnife: false
        });


        // Knife
        this.inventory.addWeapon(
            "knife"
        );


        // 默认手枪：跟随阵营
        this.inventory.addWeapon(
            this.team === TEAM.T
                ? "glock"
                : "usp",
            {
                equip: true
            }
        );
    }



    // ========================================================
    // BOT Grenade Loadout V1
    //
    // ATTACK   -> HE + FLASH
    // SUPPORT  -> FLASH + SMOKE
    // HOLD     -> HE + SMOKE
    // ========================================================

    setupGrenadeLoadout({
        clearExisting = true
    } = {}) {

        if (
            !this.grenadeInventory
        ) {

            return false;
        }


        if (
            clearExisting
        ) {

            this.grenadeInventory
                .clear();
        }


        const role =
            this.tacticalRole ||
            "attack";


        if (
            role ===
            "support"
        ) {

            this.addGrenade(
                GRENADE_TYPE.FLASH,
                1
            );


            this.addGrenade(
                GRENADE_TYPE.SMOKE,
                1
            );

        } else if (
            role ===
            "hold"
        ) {

            this.addGrenade(
                GRENADE_TYPE.HE,
                1
            );


            this.addGrenade(
                GRENADE_TYPE.SMOKE,
                1
            );

        } else {

            this.addGrenade(
                GRENADE_TYPE.HE,
                1
            );


            this.addGrenade(
                GRENADE_TYPE.FLASH,
                1
            );
        }


        gameEvents.emit(
            "bot:grenade-loadout",
            {
                bot:
                    this,

                role,

                grenades:
                    this.grenadeInventory
                        .serialize()
            }
        );


        return true;
    }


    setTacticalRole(
        role,
        {
            refreshGrenades = false
        } = {}
    ) {

        const normalized =
            (
                role === "support" ||
                role === "hold"
            )
                ? role
                : "attack";


        this.tacticalRole =
            normalized;


        if (
            this.group
        ) {

            this.group.userData
                .tacticalRole =
                normalized;
        }


        if (
            refreshGrenades
        ) {

            this.setupGrenadeLoadout({
                clearExisting:
                    true
            });
        }


        return this.tacticalRole;
    }


    // ========================================================
    // 创建 BOT 模型
    // ========================================================

    createModel() {

        const isCT =
            this.team === TEAM.CT;


        // ----------------------------------------------------
        // 材料
        // ----------------------------------------------------

        // ====================================================
        // Team Visual Colors
        //
        // CT：高饱和亮蓝 + 深蓝
        // T ：高饱和红橙 + 深红
        //
        // 目的：
        // - 中远距离也能快速分辨阵营
        // - 避免和 Iceworld 的蓝灰色建筑混在一起
        // - 保留主色 / 副色层次，不做纯色塑料人
        // ====================================================

        const armorColor =
            isCT
                ? 0x176fd1
                : 0xdf4c32;


        const secondaryColor =
            isCT
                ? 0x123f78
                : 0x7d271f;


        const visorColor =
            isCT
                ? 0x42d9ff
                : 0xffb23f;


        const mainMaterial =
            new THREE.MeshStandardMaterial({
                color:
                    armorColor,

                roughness: 0.45
            });


        const secondaryMaterial =
            new THREE.MeshStandardMaterial({
                color:
                    secondaryColor,

                roughness: 0.4
            });


        const visorMaterial =
            new THREE.MeshStandardMaterial({
                color:
                    visorColor,

                emissive:
                    visorColor,

                emissiveIntensity:
                    0.55
            });


        const gunMaterial =
            new THREE.MeshStandardMaterial({
                color:
                    0x111111,

                roughness:
                    0.25,

                metalness:
                    0.4
            });


        this.materials.push(
            mainMaterial,
            secondaryMaterial
        );


        // ====================================================
        // Torso
        // ====================================================

        const torso =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.82,
                    0.95,
                    0.50
                ),
                mainMaterial
            );


        torso.position.y =
            1.35;


        this._setupHitbox(
            torso,
            BOT_HIT_ZONE.CHEST
        );


        this.bodyParts.torso =
            torso;


        this.group.add(
            torso
        );


        // ====================================================
        // Stomach
        // ====================================================

        const stomach =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.70,
                    0.45,
                    0.44
                ),
                secondaryMaterial
            );


        stomach.position.set(
            0,
            -0.68,
            0
        );


        this._setupHitbox(
            stomach,
            BOT_HIT_ZONE.STOMACH
        );


        this.bodyParts.stomach =
            stomach;


        torso.add(
            stomach
        );


        // ====================================================
        // Head
        // ====================================================

        const head =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.46,
                    0.46,
                    0.46
                ),
                secondaryMaterial
            );


        head.position.set(
            0,
            0.74,
            0
        );


        this._setupHitbox(
            head,
            BOT_HIT_ZONE.HEAD
        );


        this.bodyParts.head =
            head;


        torso.add(
            head
        );


        // ====================================================
        // Visor
        // ====================================================

        const visor =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.34,
                    0.11,
                    0.06
                ),
                visorMaterial
            );


        /*
         * 模型正面是 -Z
         */
        visor.position.set(
            0,
            0.05,
            -0.245
        );


        visor.userData.owner =
            this;

        visor.userData.hitZone =
            BOT_HIT_ZONE.HEAD;


        this.bodyParts.visor =
            visor;


        head.add(
            visor
        );


        // ====================================================
        // Left Arm
        // ====================================================

        const leftArm =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.20,
                    0.68,
                    0.20
                ),
                secondaryMaterial
            );


        leftArm.position.set(
            -0.50,
            0.10,
            -0.05
        );


        leftArm.rotation.x =
            -1.30;


        leftArm.rotation.z =
            -0.20;


        this._setupHitbox(
            leftArm,
            BOT_HIT_ZONE.LEFT_ARM
        );


        this.bodyParts.leftArm =
            leftArm;


        torso.add(
            leftArm
        );


        // ====================================================
        // Right Arm
        // ====================================================

        const rightArm =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.20,
                    0.68,
                    0.20
                ),
                secondaryMaterial
            );


        rightArm.position.set(
            0.50,
            0.10,
            -0.05
        );


        rightArm.rotation.x =
            -1.30;


        rightArm.rotation.z =
            0.20;


        this._setupHitbox(
            rightArm,
            BOT_HIT_ZONE.RIGHT_ARM
        );


        this.bodyParts.rightArm =
            rightArm;


        torso.add(
            rightArm
        );


        // ====================================================
        // Left Leg
        // ====================================================

        const leftLeg =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.27,
                    0.82,
                    0.28
                ),
                mainMaterial
            );


        leftLeg.position.set(
            -0.24,
            -1.10,
            0
        );


        this._setupHitbox(
            leftLeg,
            BOT_HIT_ZONE.LEFT_LEG
        );


        this.bodyParts.leftLeg =
            leftLeg;


        torso.add(
            leftLeg
        );


        // ====================================================
        // Right Leg
        // ====================================================

        const rightLeg =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.27,
                    0.82,
                    0.28
                ),
                mainMaterial
            );


        rightLeg.position.set(
            0.24,
            -1.10,
            0
        );


        this._setupHitbox(
            rightLeg,
            BOT_HIT_ZONE.RIGHT_LEG
        );


        this.bodyParts.rightLeg =
            rightLeg;


        torso.add(
            rightLeg
        );


        // ====================================================
        // Weapon Holder
        //
        // BOT Weapon Model V1:
        // 实际枪模由 botWeaponView.js 根据当前武器创建。
        // ====================================================

        const rifleHolder =
            new THREE.Group();


        rifleHolder.name =
            "BOT_WEAPON_HOLDER";


        rifleHolder.position.set(
            0.12,
            0.06,
            -0.46
        );


        this.bodyParts.rifleHolder =
            rifleHolder;


        torso.add(
            rifleHolder
        );


        // ====================================================
        // Grenade Holder
        // ====================================================

        const grenadeHolder =
            new THREE.Group();


        grenadeHolder.name =
            "BOT_GRENADE_HOLDER";


        grenadeHolder.position.set(
            0.50,
            0.06,
            -0.20
        );


        grenadeHolder.visible =
            false;


        this.bodyParts.grenadeHolder =
            grenadeHolder;


        torso.add(
            grenadeHolder
        );


        // ====================================================
        // Shadows
        // ====================================================

        this.group.traverse(
            object => {

                if (
                    object.isMesh
                ) {

                    object.castShadow =
                        true;

                    object.receiveShadow =
                        true;
                }
            }
        );
    }


    // ========================================================
    // Hitbox 设置
    // ========================================================

    _setupHitbox(
        mesh,
        hitZone
    ) {

        mesh.userData.owner =
            this;

        mesh.userData.hitZone =
            hitZone;

        mesh.userData.isBotHitbox =
            true;
    }


    // ========================================================
    // HP Bar
    // ========================================================

    createHPBar() {

        this.hpBarGroup =
            new THREE.Group();


        this.hpBarGroup.position.set(
            0,
            2.65,
            0
        );


        // 背景
        const bgGeometry =
            new THREE.PlaneGeometry(
                1.6,
                0.20
            );


        const bgMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0x000000,

                side:
                    THREE.DoubleSide,

                transparent:
                    true,

                opacity:
                    0.88,

                depthWrite:
                    false
            });


        const background =
            new THREE.Mesh(
                bgGeometry,
                bgMaterial
            );


        this.hpBarGroup.add(
            background
        );


        // HP
        const fillGeometry =
            new THREE.PlaneGeometry(
                1.5,
                0.15
            );


        /*
         * 将几何原点移到左边，
         * scale.x 后血条从左向右缩短。
         */
        fillGeometry.translate(
            0.75,
            0,
            0
        );


        /*
         * 血条始终使用阵营色：
         *
         * CT = 蓝
         * T  = 红
         *
         * HP 下降只改变长度和明暗，
         * 不再把 T 的中血量改成黄色，
         * 避免破坏阵营识别。
         */
        const color =
            this.team === TEAM.CT
                ? 0x28a9ff
                : 0xff493d;


        this.hpFillMaterial =
            new THREE.MeshBasicMaterial({
                color,

                side:
                    THREE.DoubleSide,

                depthWrite:
                    false
            });


        this.hpFillMesh =
            new THREE.Mesh(
                fillGeometry,
                this.hpFillMaterial
            );


        this.hpFillMesh.position.set(
            -0.75,
            0,
            0.01
        );


        this.hpBarGroup.add(
            this.hpFillMesh
        );


        this.group.add(
            this.hpBarGroup
        );
    }


    // ========================================================
    // HP UI
    // ========================================================

    updateHPBar() {

        if (
            !this.hpFillMesh
        ) {
            return;
        }


        const percent =
            clamp(
                this.hp /
                this.maxHP,
                0,
                1
            );


        this.hpFillMesh.scale.x =
            percent;


        // ====================================================
        // Team-consistent HP bar color
        //
        // 不再使用黄血条。
        // 同一阵营从满血到残血始终保持同一色系。
        // ====================================================

        if (
            this.team === TEAM.CT
        ) {

            if (
                percent <
                0.35
            ) {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0x0b5ca8
                    );

            } else if (
                percent <
                0.65
            ) {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0x1684d9
                    );

            } else {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0x28a9ff
                    );
            }

        } else {

            if (
                percent <
                0.35
            ) {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0xa81f1f
                    );

            } else if (
                percent <
                0.65
            ) {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0xd8322d
                    );

            } else {

                this.hpFillMaterial
                    .color
                    .setHex(
                        0xff493d
                    );
            }
        }
    }


    // ========================================================
    // Billboard HP
    // ========================================================

    faceHPBarToCamera(
        camera
    ) {

        if (
            !camera ||
            !this.hpBarGroup
        ) {
            return;
        }


        const cameraPosition =
            new THREE.Vector3();


        camera.getWorldPosition(
            cameraPosition
        );


        this.hpBarGroup.lookAt(
            cameraPosition
        );
    }


    // ========================================================
    // Position
    // ========================================================

    getPosition() {

        return this.group
            .position
            .clone();
    }


    setPosition(
        x,
        y,
        z
    ) {

        if (
            x?.isVector3
        ) {

            this.group.position.copy(
                x
            );

            return;
        }


        this.group.position.set(
            x,
            y,
            z
        );
    }


    // ========================================================
    // Eye Position
    // ========================================================

    getEyePosition() {

        const position =
            this.group.position
                .clone();


        position.y +=
            this.isCrouching
                ? 1.35
                : 1.75;


        return position;
    }


    // ========================================================
    // Chest Position
    // ========================================================

    getChestPosition() {

        return this.group
            .position
            .clone()
            .add(
                new THREE.Vector3(
                    0,
                    1.3,
                    0
                )
            );
    }


    // ========================================================
    // Forward
    // ========================================================

    getForwardDirection() {

        return new THREE.Vector3(
            0,
            0,
            -1
        )
            .applyQuaternion(
                this.group.quaternion
            )
            .normalize();
    }


    // ========================================================
    // Aim Direction
    // ========================================================

    getAimDirection() {

        return this.aimDirection
            .clone()
            .normalize();
    }


    setAimDirection(direction) {

        if (!direction) {
            return;
        }


        this.aimDirection
            .copy(direction)
            .normalize();
    }


    // ========================================================
    // 面向目标
    //
    // 重点：
    // Three.js lookAt 默认认为 +Z 朝向目标，
    // 但我们的 BOT 模型正面是 -Z。
    //
    // 所以这里自己计算 Y Rotation，
    // 避免 BOT 背对目标。
    // ========================================================

    facePosition(
        targetPosition
    ) {

        if (!targetPosition) {
            return;
        }


        const dx =
            targetPosition.x -
            this.group.position.x;


        const dz =
            targetPosition.z -
            this.group.position.z;


        if (
            Math.abs(dx) <
            0.0001 &&
            Math.abs(dz) <
            0.0001
        ) {
            return;
        }


        /*
         * 模型正面是 -Z。
         */
        const angle =
            Math.atan2(
                -dx,
                -dz
            );


        this.group.rotation.y =
            angle;


        this.forward.copy(
            this.getForwardDirection()
        );
    }


    // ========================================================
    // 平滑面对目标
    // ========================================================

    facePositionSmooth(
        targetPosition,
        delta,
        turnSpeed = 7
    ) {

        if (!targetPosition) {
            return;
        }


        const dx =
            targetPosition.x -
            this.group.position.x;


        const dz =
            targetPosition.z -
            this.group.position.z;


        if (
            Math.abs(dx) <
            0.0001 &&
            Math.abs(dz) <
            0.0001
        ) {
            return;
        }


        const targetAngle =
            Math.atan2(
                -dx,
                -dz
            );


        let diff =
            targetAngle -
            this.group.rotation.y;


        while (
            diff >
            Math.PI
        ) {

            diff -=
                Math.PI * 2;
        }


        while (
            diff <
            -Math.PI
        ) {

            diff +=
                Math.PI * 2;
        }


        this.group.rotation.y +=
            diff *
            Math.min(
                1,
                delta *
                turnSpeed
            );


        this.forward.copy(
            this.getForwardDirection()
        );
    }


    // ========================================================
    // Movement
    //
    // botAI.js 决定 direction，
    // Bot 只执行移动。
    // ========================================================

    move(
        direction,
        delta,
        speed =
            this.speed
    ) {

        if (
            !this.isAlive ||
            !this.controlsEnabled
        ) {
            return;
        }


        if (!direction) {
            return;
        }


        const movement =
            direction
                .clone();


        movement.y = 0;


        if (
            movement.lengthSq() <
            0.0001
        ) {

            this.isMoving =
                false;

            return;
        }


        movement.normalize();


        this.moveDirection.copy(
            movement
        );


        this.group.position.addScaledVector(
            movement,
            speed *
            delta
        );


        this.isMoving =
            true;
    }


    stopMoving() {

        this.isMoving =
            false;

        this.moveDirection.set(
            0,
            0,
            0
        );
    }


    // ========================================================
    // Crouch
    // ========================================================

    setCrouching(enabled) {

        this.isCrouching =
            Boolean(enabled);


        const torso =
            this.bodyParts.torso;


        if (!torso) {
            return;
        }


        /*
         * 简单蹲下：
         * 整个 torso 下移。
         */
        torso.position.y =
            this.isCrouching
                ? 0.95
                : 1.35;
    }


    // ========================================================
    // Update
    // ========================================================

    update(
        delta,
        {
            camera = null
        } = {}
    ) {

        this.inventory.update(
            delta
        );


        /*
         * BotAI / Buy system 可能直接调用 inventory.equip()，
         * 因此每帧做一次轻量 ID 检查，只有武器真正变化才重建模型。
         */
        this.syncWeaponModel();


        if (
            this.isBlind
        ) {

            this.blindTimeLeft -=
                delta;


            if (
                this.blindTimeLeft <= 0
            ) {

                this.isBlind =
                    false;

                this.blindTimeLeft =
                    0;
            }
        }


        if (
            camera
        ) {

            this.faceHPBarToCamera(
                camera
            );
        }


        if (
            this.isAlive
        ) {

            if (
                this.isThrowingGrenade
            ) {

                this.stopMoving();

            } else {

                this.updateWalkAnimation(
                    delta
                );
            }
        }
    }


    // ========================================================
    // 行走动画
    // ========================================================

    updateWalkAnimation(
        delta
    ) {

        if (
            !this.bodyParts.leftLeg ||
            !this.bodyParts.rightLeg
        ) {
            return;
        }


        if (
            !this.isMoving
        ) {

            this.bodyParts.leftLeg
                .rotation.x *=
                0.75;


            this.bodyParts.rightLeg
                .rotation.x *=
                0.75;


            return;
        }


        this.animationTime +=
            delta * 10;


        const swing =
            Math.sin(
                this.animationTime
            ) *
            0.48;


        this.bodyParts.leftLeg
            .rotation.x =
            swing;


        this.bodyParts.rightLeg
            .rotation.x =
            -swing;
    }


    // ========================================================
    // BOT Grenade Throw Animation V1
    // ========================================================

    createGrenadeViewModel(type) {

        const holder =
            this.bodyParts.grenadeHolder;


        if (!holder) {
            return null;
        }


        while (
            holder.children.length > 0
        ) {

            const child =
                holder.children[0];


            holder.remove(child);


            child.geometry
                ?.dispose?.();


            if (
                Array.isArray(
                    child.material
                )
            ) {

                child.material.forEach(
                    material =>
                        material?.dispose?.()
                );

            } else {

                child.material
                    ?.dispose?.();
            }
        }


        let geometry = null;

        let color =
            0x394331;


        if (
            type ===
            GRENADE_TYPE.FLASH
        ) {

            geometry =
                new THREE.CylinderGeometry(
                    0.10,
                    0.10,
                    0.30,
                    10
                );


            geometry.rotateX(
                Math.PI / 2
            );


            color =
                0xbfc2c3;

        } else if (
            type ===
            GRENADE_TYPE.SMOKE
        ) {

            geometry =
                new THREE.CylinderGeometry(
                    0.11,
                    0.11,
                    0.34,
                    10
                );


            geometry.rotateX(
                Math.PI / 2
            );


            color =
                0x4f5c4b;

        } else {

            geometry =
                new THREE.SphereGeometry(
                    0.13,
                    10,
                    8
                );
        }


        const material =
            new THREE.MeshStandardMaterial({
                color,

                roughness:
                    0.55,

                metalness:
                    type ===
                        GRENADE_TYPE.FLASH
                        ? 0.45
                        : 0.15
            });


        const mesh =
            new THREE.Mesh(
                geometry,
                material
            );


        mesh.userData.ignoreHitbox =
            true;


        holder.add(mesh);


        this.grenadeViewModel =
            mesh;


        return mesh;
    }


    beginGrenadeThrowAnimation(
        type,
        direction
    ) {

        if (
            this.isThrowingGrenade ||
            !this.isAlive
        ) {
            return false;
        }


        this.isThrowingGrenade =
            true;

        this.grenadeThrowType =
            type;

        this.grenadeThrowTime =
            0;

        this.grenadeThrowReleased =
            false;


        if (
            direction?.isVector3 &&
            direction.lengthSq() >
                0.0001
        ) {

            this.grenadeThrowDirection
                .copy(direction)
                .normalize();
        }


        this.inventory
            .currentWeapon
            ?.releaseTrigger?.();


        this.stopMoving();

        this.setCrouching(false);

        this.createGrenadeViewModel(type);


        if (
            this.bodyParts.grenadeHolder
        ) {

            this.bodyParts
                .grenadeHolder
                .visible =
                true;
        }


        if (
            this.bodyParts.rifleHolder
        ) {

            this.bodyParts
                .rifleHolder
                .visible =
                false;
        }


        return true;
    }


    getGrenadeReleasePosition() {

        const holder =
            this.bodyParts.grenadeHolder;


        if (!holder) {

            return this.getEyePosition();
        }


        const position =
            new THREE.Vector3();


        holder.getWorldPosition(
            position
        );


        position.addScaledVector(
            this.grenadeThrowDirection,
            0.28
        );


        position.y +=
            0.08;


        return position;
    }


    updateGrenadeThrowAnimation(delta) {

        if (
            !this.isThrowingGrenade
        ) {

            return {
                active: false,
                releaseNow: false
            };
        }


        this.grenadeThrowTime +=
            delta;


        const t =
            clamp(
                this.grenadeThrowTime /
                this.grenadeThrowDuration,
                0,
                1
            );


        const rightArm =
            this.bodyParts.rightArm;


        const leftArm =
            this.bodyParts.leftArm;


        const holder =
            this.bodyParts.grenadeHolder;


        if (
            rightArm &&
            leftArm
        ) {

            if (
                t < 0.34
            ) {

                const p =
                    t / 0.34;


                rightArm.rotation.x =
                    -1.30 -
                    p * 0.72;


                rightArm.rotation.z =
                    0.20 +
                    p * 0.18;


                leftArm.rotation.x =
                    -1.30 +
                    p * 0.18;


                if (holder) {

                    holder.position.z =
                        -0.20 +
                        p * 0.14;


                    holder.position.y =
                        0.06 +
                        p * 0.10;
                }

            } else if (
                t < 0.68
            ) {

                const p =
                    (
                        t - 0.34
                    ) /
                    0.34;


                rightArm.rotation.x =
                    -2.02 +
                    p * 1.88;


                rightArm.rotation.z =
                    0.38 -
                    p * 0.22;


                leftArm.rotation.x =
                    -1.12 -
                    p * 0.18;


                if (holder) {

                    holder.position.z =
                        -0.06 -
                        p * 0.42;


                    holder.position.y =
                        0.16 +
                        p * 0.04;
                }

            } else {

                const p =
                    (
                        t - 0.68
                    ) /
                    0.32;


                rightArm.rotation.x =
                    0.10 -
                    p * 1.40;


                rightArm.rotation.z =
                    0.16 +
                    p * 0.04;


                leftArm.rotation.x =
                    -1.30;


                if (holder) {

                    holder.position.z =
                        -0.48 +
                        p * 0.28;


                    holder.position.y =
                        0.20 -
                        p * 0.14;
                }
            }
        }


        let releaseNow =
            false;


        if (
            !this.grenadeThrowReleased &&
            t >= 0.58
        ) {

            this.grenadeThrowReleased =
                true;


            releaseNow =
                true;


            if (holder) {

                holder.visible =
                    false;
            }
        }


        if (
            t >= 1
        ) {

            this.finishGrenadeThrowAnimation();
        }


        return {
            active:
                this.isThrowingGrenade,

            releaseNow
        };
    }


    finishGrenadeThrowAnimation() {

        this.isThrowingGrenade =
            false;

        this.grenadeThrowType =
            null;

        this.grenadeThrowTime =
            0;

        this.grenadeThrowReleased =
            false;


        const holder =
            this.bodyParts.grenadeHolder;


        if (holder) {

            holder.visible =
                false;


            holder.position.set(
                0.50,
                0.06,
                -0.20
            );
        }


        this.syncWeaponModel();


        if (
            this.bodyParts.rifleHolder
        ) {

            this.bodyParts
                .rifleHolder
                .visible =
                true;
        }


        if (
            this.bodyParts.rightArm
        ) {

            this.bodyParts
                .rightArm
                .rotation.x =
                -1.30;


            this.bodyParts
                .rightArm
                .rotation.z =
                0.20;
        }


        if (
            this.bodyParts.leftArm
        ) {

            this.bodyParts
                .leftArm
                .rotation.x =
                -1.30;


            this.bodyParts
                .leftArm
                .rotation.z =
                -0.20;
        }
    }


    // ========================================================
    // Blind
    // ========================================================

    applyFlash(
        duration
    ) {

        if (!this.isAlive) {
            return;
        }


        this.isBlind =
            true;


        this.blindTimeLeft =
            Math.max(
                this.blindTimeLeft,
                duration
            );


        gameEvents.emit(
            "bot:blinded",
            {
                bot:
                    this,

                duration:
                    this.blindTimeLeft
            }
        );
    }


    // ========================================================
    // Armor
    // ========================================================

    setArmor(
        amount
    ) {

        this.armor =
            clamp(
                amount,
                0,
                this.maxArmor
            );
    }


    giveArmor(
        amount =
            BOT_CONFIG.maxArmor
    ) {

        this.setArmor(
            amount
        );
    }


    // ========================================================
    // Money
    // ========================================================

    setMoney(
        value
    ) {

        this.money =
            clamp(
                Math.floor(value),
                0,
                ECONOMY_CONFIG.maxMoney
            );


        gameEvents.emit(
            GAME_EVENT.MONEY_CHANGED,
            {
                owner:
                    this,

                money:
                    this.money
            }
        );
    }


    addMoney(
        amount
    ) {

        this.setMoney(
            this.money +
            amount
        );
    }


    spendMoney(
        amount
    ) {

        amount =
            Math.max(
                0,
                Math.floor(amount)
            );


        if (
            this.money <
            amount
        ) {

            return false;
        }


        this.setMoney(
            this.money -
            amount
        );


        return true;
    }


    canAfford(
        amount
    ) {

        return (
            this.money >=
            amount
        );
    }


    // ========================================================
    // BOT Weapon Model V1
    // ========================================================

    clearWeaponModel() {

        const holder =
            this.bodyParts
                .rifleHolder;


        const model =
            this.bodyParts
                .weaponModel;


        if (
            holder &&
            model &&
            model.parent ===
                holder
        ) {

            holder.remove(
                model
            );
        }


        disposeBotWeaponModel(
            model
        );


        this.bodyParts.weaponModel =
            null;
    }


    syncWeaponModel(
        weapon =
            this.inventory
                ?.currentWeapon
    ) {

        const holder =
            this.bodyParts
                .rifleHolder;


        if (!holder) {

            return null;
        }


        const weaponId =
            weapon?.id;


        if (!weaponId) {

            this.clearWeaponModel();

            return null;
        }


        if (
            this.bodyParts
                .weaponModel
                ?.userData
                ?.weaponId ===
            weaponId
        ) {

            return this.bodyParts
                .weaponModel;
        }


        this.clearWeaponModel();


        const model =
            createBotWeaponModel(
                weaponId
            );


        holder.add(
            model
        );


        this.bodyParts.weaponModel =
            model;


        /*
         * 手雷动画期间仍保持隐藏。
         */
        holder.visible =
            !this.isThrowingGrenade;


        return model;
    }


    // ========================================================
    // Weapon
    // ========================================================

    giveWeapon(
        weaponId,
        {
            equip = true
        } = {}
    ) {

        const weapon =
            this.inventory
                .addWeapon(
                    weaponId,
                    {
                        equip
                    }
                );


        if (equip) {

            this.syncWeaponModel();
        }


        return weapon;
    }


    equipPrimary() {

        const result =
            this.inventory
                .equipSlot(
                    WEAPON_SLOT.PRIMARY
                );


        this.syncWeaponModel();


        return result;
    }


    equipSecondary() {

        const result =
            this.inventory
                .equipSlot(
                    WEAPON_SLOT.SECONDARY
                );


        this.syncWeaponModel();


        return result;
    }


    equipKnife() {

        const result =
            this.inventory
                .equipSlot(
                    WEAPON_SLOT.KNIFE
                );


        this.syncWeaponModel();


        return result;
    }


    reload() {

        return this.inventory
            .reload();
    }


    // ========================================================
    // Grenade
    // ========================================================

    addGrenade(
        type =
            GRENADE_TYPE.HE,
        amount = 1
    ) {

        return this.grenadeInventory
            .add(
                type,
                amount
            );
    }


    // ========================================================
    // Damage
    //
    // 接口与 Player.takeDamage() 一致。
    // ========================================================

    takeDamage({
        amount = 0,
        armorPenetration = 0,
        attacker = null,
        weapon = null,
        grenade = null,
        hitZone = "generic",
        point = null
    } = {}) {

        if (
            !this.isAlive ||
            this.isDying ||
            amount <= 0
        ) {

            return {
                damage: 0,
                killed: false,
                hp: this.hp
            };
        }


        let damage =
            Math.max(
                0,
                amount
            );


        let armorDamage = 0;


        // ====================================================
        // Armor
        // ====================================================

        if (
            this.armor > 0
        ) {

            const penetration =
                clamp(
                    armorPenetration,
                    0,
                    1
                );


            const blockRatio =
                (
                    1 -
                    penetration
                ) *
                0.5;


            const blocked =
                damage *
                blockRatio;


            armorDamage =
                Math.min(
                    blocked,
                    this.armor
                );


            this.armor -=
                armorDamage;


            damage -=
                armorDamage;
        }


        const oldHP =
            this.hp;


        this.hp -=
            damage;


        this.hp =
            Math.max(
                0,
                this.hp
            );


        const actualDamage =
            oldHP -
            this.hp;


        this.lastDamageTime =
            performance.now();


        this.lastAttacker =
            attacker;


        // ====================================================
        // Flash Model
        // ====================================================

        this.flashDamageMaterial();


        this.updateHPBar();


        // ====================================================
        // Event
        // ====================================================

        gameEvents.emit(
            GAME_EVENT.BOT_DAMAGE,
            {
                bot:
                    this,

                target:
                    this,

                attacker,

                weapon,

                grenade,

                hitZone,

                damage:
                    actualDamage,

                armorDamage,

                hp:
                    this.hp,

                armor:
                    this.armor,

                point
            }
        );


        // ====================================================
        // Death
        // ====================================================

        let killed = false;


        if (
            this.hp <= 0
        ) {

            killed = true;


            this.die({
                attacker,
                weapon,
                grenade,
                hitZone
            });
        }


        return {
            damage:
                actualDamage,

            armorDamage,

            killed,

            dead:
                killed,

            hp:
                this.hp,

            armor:
                this.armor
        };
    }


    // ========================================================
    // Damage Flash
    // ========================================================

    flashDamageMaterial() {

        /*
         * 受伤闪烁保持阵营色系：
         *
         * CT = 浅亮蓝
         * T  = 亮橙红
         *
         * 不再整个人变成纯白。
         */
        const flashColor =
            this.team === TEAM.CT
                ? 0x66ccff
                : 0xff8066;


        for (
            const material
            of this.materials
        ) {

            /*
             * 第一次进入闪烁时才保存原颜色。
             *
             * 防止短时间连续中弹时，
             * 把“闪烁颜色”覆盖成新的 oldColor。
             */
            if (
                material.userData
                    .damageFlashActive !==
                true
            ) {

                material.userData
                    .oldColor =
                    material.color
                        .getHex();
            }


            material.userData
                .damageFlashActive =
                true;


            material.color.setHex(
                flashColor
            );
        }


        /*
         * 连续中弹时重新计时，
         * 防止多个 timeout 互相覆盖。
         */
        if (
            this.damageFlashTimer
        ) {

            window.clearTimeout(
                this.damageFlashTimer
            );
        }


        this.damageFlashTimer =
            window.setTimeout(
                () => {

                    /*
                     * 即使 BOT 已经死亡，也恢复原阵营颜色。
                     *
                     * 旧版本这里会在死亡时直接 return，
                     * 导致尸体可能永久保持白色。
                     */
                    for (
                        const material
                        of this.materials
                    ) {

                        const old =
                            material.userData
                                .oldColor;


                        if (
                            old != null
                        ) {

                            material.color.setHex(
                                old
                            );
                        }


                        material.userData
                            .damageFlashActive =
                            false;
                    }


                    this.damageFlashTimer =
                        null;

                },
                70
            );
    }


    // ========================================================
    // Death
    // ========================================================

    die({
        attacker = null,
        weapon = null,
        grenade = null,
        hitZone = null
    } = {}) {

        if (
            !this.isAlive ||
            this.isDying
        ) {

            return;
        }


        this.isAlive =
            false;

        this.isDying =
            true;

        this.hp = 0;

        this.deaths++;


        this.stopMoving();


        this.finishGrenadeThrowAnimation();


        this.currentTarget =
            null;


        this.inventory
            .currentWeapon
            ?.releaseTrigger();


        this.survivedLastRound =
            false;


        if (
            this.hpBarGroup
        ) {

            this.hpBarGroup.visible =
                false;
        }


        gameEvents.emit(
            GAME_EVENT.BOT_DEATH,
            {
                bot:
                    this,

                victim:
                    this,

                attacker,

                weapon,

                grenade,

                hitZone
            }
        );


        this.startDeathAnimation();
    }


    // ========================================================
    // 简易死亡动画
    // ========================================================

    startDeathAnimation() {

        this.deathAnimationProgress =
            0;
    }


    updateDeathAnimation(
        delta
    ) {

        if (
            !this.isDying
        ) {
            return;
        }


        this.deathAnimationProgress +=
            delta * 2.5;


        const progress =
            clamp(
                this.deathAnimationProgress,
                0,
                1
            );


        this.group.rotation.x =
            progress *
            Math.PI /
            2;


        if (
            progress >= 1
        ) {

            /*
             * 不自动删除 BOT 对象。
             *
             * Round system 决定什么时候清尸体。
             */
        }
    }


    // ========================================================
    // Kill
    // ========================================================

    registerKill({
        target = null,
        weapon = null,
        grenade = null,
        reward = null
    } = {}) {

        this.kills++;


        if (
            reward != null
        ) {

            this.addMoney(
                reward
            );
        }


        gameEvents.emit(
            "bot:kill",
            {
                bot:
                    this,

                attacker:
                    this,

                target,

                weapon,

                grenade,

                kills:
                    this.kills
            }
        );
    }


    // ========================================================
    // Round Persistence
    // ========================================================

    prepareForRoundEnd() {

        this.survivedLastRound =
            this.isAlive;


        if (
            this.isAlive
        ) {

            this.savedRoundInventory =
                this.inventory
                    .serialize();


            this.savedRoundGrenades =
                this.grenadeInventory
                    .serialize();

        } else {

            this.savedRoundInventory =
                null;


            this.savedRoundGrenades =
                null;
        }
    }


    // ========================================================
    // New Round Spawn
    //
    // 重点：
    // kills / deaths 不会被重置。
    // ========================================================

    spawn({
        position = null,
        preserveWeapons = true,
        resetArmor = false
    } = {}) {

        this.isAlive =
            true;

        this.isDying =
            false;

        this.hp =
            this.maxHP;


        if (
            resetArmor
        ) {

            this.armor = 0;
        }


        this.velocity.set(
            0,
            0,
            0
        );


        this.moveDirection.set(
            0,
            0,
            0
        );


        this.isMoving =
            false;

        this.isCrouching =
            false;

        this.isBlind =
            false;

        this.blindTimeLeft =
            0;

        this.currentTarget =
            null;


        this.finishGrenadeThrowAnimation();


        this.lastKnownEnemyPosition =
            null;

        this.lastAttacker =
            null;


        // ====================================================
        // 恢复模型
        // ====================================================

        this.group.rotation.set(
            0,
            0,
            0
        );


        if (
            this.bodyParts.torso
        ) {

            this.bodyParts.torso
                .position.y =
                1.35;
        }


        if (
            this.bodyParts.leftLeg
        ) {

            this.bodyParts.leftLeg
                .rotation.x =
                0;
        }


        if (
            this.bodyParts.rightLeg
        ) {

            this.bodyParts.rightLeg
                .rotation.x =
                0;
        }


        if (
            this.hpBarGroup
        ) {

            this.hpBarGroup.visible =
                true;
        }


        this.updateHPBar();


        // ====================================================
        // 生存保枪 / 保留剩余手雷
        // ====================================================

        const preserveRoundLoadout =
            Boolean(
                preserveWeapons &&
                this.survivedLastRound
            );


        if (
            preserveRoundLoadout &&
            this.savedRoundInventory
        ) {

            this.inventory.restore(
                this.savedRoundInventory
            );

        } else {

            this.setupDefaultLoadout();
        }


        if (
            preserveRoundLoadout &&
            this.savedRoundGrenades
        ) {

            this.grenadeInventory
                .restore(
                    this.savedRoundGrenades
                );

        } else {

            /*
             * 上一回合死亡 / 新比赛：
             * 根据 Tactical Role 发放新的手雷组合。
             */
            this.setupGrenadeLoadout({
                clearExisting:
                    true
            });
        }


        // ====================================================
        // Position
        // ====================================================

        if (
            position
        ) {

            this.setPosition(
                position
            );
        }


        gameEvents.emit(
            GAME_EVENT.BOT_SPAWN,
            {
                bot:
                    this,

                position:
                    this.getPosition(),

                kills:
                    this.kills,

                deaths:
                    this.deaths
            }
        );
    }


    // ========================================================
    // Match Reset
    //
    // 只有新比赛才清战绩。
    // ========================================================

    resetMatch() {

        this.kills = 0;

        this.deaths = 0;

        this.assists = 0;

        this.money =
            ECONOMY_CONFIG.startMoney;


        this.savedRoundInventory =
            null;

        this.savedRoundGrenades =
            null;

        this.survivedLastRound =
            false;


        this.grenadeInventory.clear();


        this.setupDefaultLoadout();

        this.setupGrenadeLoadout({
            clearExisting:
                true
        });


        this.spawn({
            preserveWeapons:
                false,

            resetArmor:
                true
        });
    }


    // ========================================================
    // Serialize Persistent Profile
    //
    // Round.js 可以保存这些数据，
    // 即使完全重建 Bot 实例，也能继承战绩。
    // ========================================================

    serializeProfile() {

        return {
            name:
                this.name,

            team:
                this.team,

            personality:
                this.personality,

            tacticalRole:
                this.tacticalRole,

            kills:
                this.kills,

            deaths:
                this.deaths,

            assists:
                this.assists,

            money:
                this.money,

            armor:
                this.armor,

            inventory:
                this.inventory
                    .serialize(),

            grenades:
                this.grenadeInventory
                    .serialize(),

            throwingGrenade:
                this.isThrowingGrenade,

            grenadeThrowType:
                this.grenadeThrowType
        };
    }


    // ========================================================
    // Restore Persistent Profile
    // ========================================================

    restoreProfile(
        profile
    ) {

        if (!profile) {
            return;
        }


        if (
            profile.name
        ) {

            this.name =
                profile.name;

            this.group.name =
                this.name;
        }


        if (
            profile.team
        ) {

            this.team =
                profile.team;
        }


        if (
            profile.personality
        ) {

            this.personality =
                profile.personality;
        }


        if (
            profile.tacticalRole
        ) {

            this.setTacticalRole(
                profile.tacticalRole
            );
        }


        this.kills =
            Number(
                profile.kills ??
                this.kills
            );


        this.deaths =
            Number(
                profile.deaths ??
                this.deaths
            );


        this.assists =
            Number(
                profile.assists ??
                this.assists
            );


        this.setMoney(
            profile.money ??
            this.money
        );


        this.setArmor(
            profile.armor ??
            this.armor
        );


        if (
            profile.inventory
        ) {

            this.inventory.restore(
                profile.inventory
            );
        }


        if (
            profile.grenades
        ) {

            this.grenadeInventory
                .restore(
                    profile.grenades
                );
        }
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            id:
                this.id,

            name:
                this.name,

            team:
                this.team,

            personality:
                this.personality,

            tacticalRole:
                this.tacticalRole,

            hp:
                this.hp,

            maxHP:
                this.maxHP,

            armor:
                this.armor,

            money:
                this.money,

            kills:
                this.kills,

            deaths:
                this.deaths,

            assists:
                this.assists,

            alive:
                this.isAlive,

            crouching:
                this.isCrouching,

            blind:
                this.isBlind,

            position:
                this.getPosition(),

            direction:
                this.getForwardDirection(),

            weapon:
                this.inventory
                    .currentWeapon
                    ?.getState() ??
                null,

            grenades:
                this.grenadeInventory
                    .serialize()
        };
    }


    // ========================================================
    // Destroy Model
    // ========================================================

    destroy() {

        if (
            this.damageFlashTimer
        ) {

            window.clearTimeout(
                this.damageFlashTimer
            );

            this.damageFlashTimer =
                null;
        }



        this.inventory.clear({
            keepKnife:
                false
        });


        this.grenadeInventory.clear();


        if (
            this.group.parent
        ) {

            this.group.parent.remove(
                this.group
            );
        }


        this.group.traverse(
            object => {

                if (
                    object.geometry
                ) {

                    object.geometry
                        .dispose?.();
                }


                if (
                    object.material
                ) {

                    if (
                        Array.isArray(
                            object.material
                        )
                    ) {

                        object.material
                            .forEach(
                                material =>
                                    material
                                        .dispose?.()
                            );

                    } else {

                        object.material
                            .dispose?.();
                    }
                }
            }
        );


        this.scene = null;

        this.currentTarget = null;
    }
}


// ============================================================
// Weapon Kill -> BOT 战绩
// ============================================================

gameEvents.on(
    "weapon:hit",
    (data = {}) => {

        if (
            !data.kill
        ) {
            return;
        }


        const attacker =
            data.attacker;


        if (
            !(attacker instanceof Bot)
        ) {

            return;
        }


        let reward =
            data.weapon?.config
                ?.killReward;


        if (
            reward == null
        ) {

            reward =
                ECONOMY_CONFIG
                    .killRewards
                    .standard;
        }


        attacker.registerKill({
            target:
                data.target,

            weapon:
                data.weapon,

            reward
        });
    }
);


// ============================================================
// Grenade Kill -> BOT 战绩
// ============================================================

gameEvents.on(
    "grenade:kill",
    (data = {}) => {

        const owner =
            data.owner;


        if (
            !(owner instanceof Bot)
        ) {
            return;
        }


        owner.registerKill({
            target:
                data.target,

            grenade:
                data.grenade,

            reward:
                ECONOMY_CONFIG
                    .killRewards
                    .grenade
        });
    }
);


// ============================================================
// Flash -> BOT
// ============================================================

gameEvents.on(
    "grenade:flash",
    (data = {}) => {

        if (
            !(data.target instanceof Bot)
        ) {
            return;
        }


        data.target.applyFlash(
            data.duration ??
            0
        );
    }
);


// ============================================================
// 默认导出
// ============================================================

export default Bot;