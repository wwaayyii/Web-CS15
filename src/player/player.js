/**
 * Web-CS15
 * src/player/player.js
 *
 * 玩家系统
 *
 * 负责：
 * - HP / Armor
 * - Money
 * - 移动
 * - 跳跃
 * - 蹲下
 * - Walk / 静步
 * - 武器库存
 * - 开火
 * - Reload
 * - Grenade
 * - Damage / Death
 * - Round Spawn
 * - 生存保枪
 *
 * 不负责：
 * - DOM HUD
 * - BOT AI
 * - Round 胜负判断
 * - Audio 实现
 * - Effects 实现
 */

import * as THREE from "three";

import {
    PLAYER_CONFIG,
    ECONOMY_CONFIG,
    LOADOUT_CONFIG,
    TEAM,
    WEAPON_SLOT,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    gameEvents
} from "../core/utils.js";

import {
    WeaponInventory,
    weaponSystem
} from "../weapons/weapon.js";

import {
    GrenadeInventory,
    grenadeSystem,
    GRENADE_TYPE
} from "../weapons/grenade.js";


// ============================================================
// Player
// ============================================================

export class Player {

    constructor({
        camera = null,
        controls = null,
        scene = null,
        team = TEAM.CT,
        name = "PLAYER (You)"
    } = {}) {

        this.name = name;

        this.team = team;

        this.camera = camera;

        this.controls = controls;

        this.scene = scene;


        // ====================================================
        // Player Hitbox
        //
        // 第一人称玩家本身没有人物模型，
        // BOT / WeaponSystem 需要一个可以 Raycast 命中的对象。
        // ====================================================

        this.hitbox =
            new THREE.Mesh(
                new THREE.CapsuleGeometry(
                    0.42,
                    1.0,
                    4,
                    8
                ),
                new THREE.MeshBasicMaterial({
                    transparent:
                        true,

                    opacity:
                        0,

                    depthWrite:
                        false,

                    colorWrite:
                        false
                })
            );


        this.hitbox.name =
            "PLAYER_HITBOX";


        /*
         * 必须 visible = true。
         *
         * Three.js Raycaster 会忽略 visible=false 的对象。
         * colorWrite=false 已经保证画面看不到 Hitbox。
         */
        this.hitbox.visible =
            true;


        /*
         * WeaponSystem 会沿 Object3D parent
         * 查找 userData.owner。
         */
        this.hitbox.userData.owner =
            this;


        this.hitbox.userData.entity =
            this;


        this.hitbox.userData.isPlayer =
            true;


        this.hitbox.userData.hitZone =
            "chest";


        if (
            this.scene
        ) {

            this.scene.add(
                this.hitbox
            );
        }


        // ====================================================
        // 基础数据
        // ====================================================

        this.maxHP =
            PLAYER_CONFIG.maxHP;


        this.hp =
            PLAYER_CONFIG.startHP;


        this.maxArmor =
            PLAYER_CONFIG.maxArmor;


        this.armor =
            PLAYER_CONFIG.startArmor;


        this.money =
            PLAYER_CONFIG.startMoney;


        // ====================================================
        // 战绩
        // ====================================================

        this.kills = 0;

        this.deaths = 0;

        this.assists = 0;


        // ====================================================
        // 状态
        // ====================================================

        this.isAlive =
            true;


        this.isGrounded =
            true;


        this.isCrouching =
            false;


        this.isWalking =
            false;


        this.isMoving =
            false;


        this.isSpectating =
            false;


        this.controlsEnabled =
            true;


        // ====================================================
        // Sniper Scope V2
        // 0 = Normal
        // 1 = First Zoom
        // 2 = Second Zoom
        // ====================================================

        this.sniperScopeLevel =
            0;


        // ====================================================
        // Movement
        // ====================================================

        this.velocity =
            new THREE.Vector3();


        this.moveDirection =
            new THREE.Vector3();


        this.input = {
            forward: false,

            backward: false,

            left: false,

            right: false,

            jump: false,

            crouch: false,

            walk: false,

            fire: false
        };


        this.eyeHeight =
            PLAYER_CONFIG.eyeHeight;


        this.targetEyeHeight =
            PLAYER_CONFIG.eyeHeight;


        this.footstepTimer =
            0;


        /*
         * Crouch Accuracy V1
         *
         * 当具体武器没有单独配置 spread.crouch 时，
         * weapon.js 会使用这个倍率作为 fallback。
         *
         * 0.70 = 下蹲时基础散布约降低 30%。
         */
        this.crouchAccuracyMultiplier =
            0.70;


        // ====================================================
        // Weapon
        // ====================================================

        this.inventory =
            new WeaponInventory({
                owner:
                    this
            });


        // ====================================================
        // Grenade
        // ====================================================

        this.grenadeInventory =
            new GrenadeInventory({
                owner:
                    this
            });


        this.selectedGrenadeType =
            GRENADE_TYPE.HE;


        this.grenadeMode =
            false;

        this.grenadePrimeHeld =
            false;


        // ====================================================
        // Round Equipment Save
        // ====================================================

        this.savedRoundInventory =
            null;


        this.survivedLastRound =
            false;


        // ====================================================
        // 默认装备
        // ====================================================

        this.setupDefaultLoadout();


        /*
         * 初始化 Hitbox 位置。
         */
        this.updateHitbox();
    }


    // ========================================================
    // 默认装备
    // ========================================================

    setupDefaultLoadout() {

        const loadout =
            this.team ===
            TEAM.T
                ? LOADOUT_CONFIG.T
                : LOADOUT_CONFIG.CT;


        this.inventory.clear({
            keepKnife:
                false
        });


        if (
            loadout.knife
        ) {

            this.inventory.addWeapon(
                loadout.knife
            );
        }


        if (
            loadout.secondary
        ) {

            this.inventory.addWeapon(
                loadout.secondary,
                {
                    equip:
                        true
                }
            );
        }


        if (
            loadout.primary
        ) {

            this.inventory.addWeapon(
                loadout.primary,
                {
                    equip:
                        true
                }
            );
        }
    }


    // ========================================================
    // Controls / Camera / Scene
    // ========================================================

    setControls(
        controls
    ) {

        this.controls =
            controls;


        this.updateHitbox();


        return this;
    }


    setCamera(
        camera
    ) {

        this.camera =
            camera;


        return this;
    }


    setScene(
        scene
    ) {

        /*
         * 如果 Hitbox 已经挂在旧 Scene，
         * 先摘掉。
         */
        if (
            this.hitbox
                ?.parent &&
            this.hitbox.parent !==
                scene
        ) {

            this.hitbox.parent.remove(
                this.hitbox
            );
        }


        this.scene =
            scene;


        if (
            this.scene &&
            this.hitbox &&
            this.hitbox.parent !==
                this.scene
        ) {

            this.scene.add(
                this.hitbox
            );
        }


        return this;
    }


    // ========================================================
    // 玩家真正的控制对象
    //
    // 这个对象负责：
    // - Position
    // - Movement
    // - Eye Height
    //
    // 注意：
    // 不能返回 Hitbox。
    // ========================================================

    getControlObject() {

        if (
            this.controls &&
            typeof this.controls
                .getObject ===
                "function"
        ) {

            return this.controls
                .getObject();
        }


        return (
            this.camera ||
            null
        );
    }


    // ========================================================
    // Position
    // ========================================================

    getPosition() {

        const object =
            this.getControlObject();


        if (
            object?.position
        ) {

            return object
                .position
                .clone();
        }


        return new THREE.Vector3();
    }


    setPosition(
        x,
        y,
        z
    ) {

        const object =
            this.getControlObject();


        if (!object) {
            return;
        }


        if (
            x?.isVector3
        ) {

            object.position.copy(
                x
            );


            this.updateHitbox();


            return;
        }


        object.position.set(
            x,
            y,
            z
        );


        this.updateHitbox();
    }


    // ========================================================
    // Eye Position
    // ========================================================

    getEyePosition() {

        if (
            this.camera
        ) {

            const position =
                new THREE.Vector3();


            this.camera.getWorldPosition(
                position
            );


            return position;
        }


        return this
            .getPosition()
            .add(
                new THREE.Vector3(
                    0,
                    this.eyeHeight,
                    0
                )
            );
    }


    // ========================================================
    // View Direction
    // ========================================================

    getViewDirection() {

        const direction =
            new THREE.Vector3(
                0,
                0,
                -1
            );


        if (
            this.camera
        ) {

            this.camera
                .getWorldDirection(
                    direction
                );
        }


        return direction
            .normalize();
    }


    // ========================================================
    // Chest Position
    //
    // BOT AI 会使用。
    // ========================================================

    getChestPosition() {

        if (
            this.hitbox
        ) {

            const position =
                new THREE.Vector3();


            this.hitbox
                .getWorldPosition(
                    position
                );


            return position;
        }


        const position =
            this.getPosition();


        position.y =
            Math.max(
                0.9,
                position.y -
                    0.55
            );


        return position;
    }


    // ========================================================
    // Input
    // ========================================================

    setInput(
        key,
        value
    ) {

        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    this.input,
                    key
                )
        ) {

            this.input[
                key
            ] =
                Boolean(
                    value
                );
        }
    }


    setMovementInput({
        forward,
        backward,
        left,
        right,
        walk
    } = {}) {

        if (
            forward !==
            undefined
        ) {

            this.input.forward =
                Boolean(
                    forward
                );
        }


        if (
            backward !==
            undefined
        ) {

            this.input.backward =
                Boolean(
                    backward
                );
        }


        if (
            left !==
            undefined
        ) {

            this.input.left =
                Boolean(
                    left
                );
        }


        if (
            right !==
            undefined
        ) {

            this.input.right =
                Boolean(
                    right
                );
        }


        if (
            walk !==
            undefined
        ) {

            this.input.walk =
                Boolean(
                    walk
                );
        }
    }


    // ========================================================
    // Update
    // ========================================================

    update(
        delta
    ) {

        /*
         * 武器即使玩家死亡也需要更新，
         * 例如 Reload timer 等。
         */
        this.inventory.update(
            delta
        );


        if (
            !this.isAlive
        ) {

            this.updateHitbox();

            return;
        }


        if (
            this.controlsEnabled
        ) {

            this.updateMovement(
                delta
            );


            this.updateEyeHeight(
                delta
            );


            this.updateFootsteps(
                delta
            );
        }


        /*
         * 每帧最后同步 Hitbox，
         * 确保枪械 Raycast 使用当前位置。
         */
        this.updateHitbox();
    }


    // ========================================================
    // Movement
    // ========================================================

    updateMovement(
        delta
    ) {

        const object =
            this.getControlObject();


        if (!object) {
            return;
        }


        let forward =
            0;


        let strafe =
            0;


        if (
            this.input.forward
        ) {

            forward +=
                1;
        }


        if (
            this.input.backward
        ) {

            forward -=
                1;
        }


        if (
            this.input.right
        ) {

            strafe +=
                1;
        }


        if (
            this.input.left
        ) {

            strafe -=
                1;
        }


        this.moveDirection.set(
            strafe,
            0,
            -forward
        );


        if (
            this.moveDirection
                .lengthSq() >
            1
        ) {

            this.moveDirection
                .normalize();
        }


        this.isMoving =
            this.moveDirection
                .lengthSq() >
            0.001;


        // ====================================================
        // Walk / 静步
        // ====================================================

        /*
         * Web Control V2:
         * Shift 不再是 Sprint，而是 CS 风格静步。
         *
         * 为了避免依赖 config.js 新增参数，这里直接基于
         * 当前正常移动速度计算 55% 的静步速度。
         */
        this.isWalking =
            this.input.walk &&
            this.isMoving;


        let speed =
            PLAYER_CONFIG
                .walkSpeed;


        if (
            this.isCrouching
        ) {

            speed =
                PLAYER_CONFIG
                    .crouchSpeed;

        } else if (
            this.isWalking
        ) {

            speed *=
                0.55;
        }


        // ====================================================
        // 武器重量影响
        // ====================================================

        const currentWeapon =
            this.inventory
                .currentWeapon;


        if (
            currentWeapon
                ?.config
                ?.movementSpeed !=
            null
        ) {

            speed *=
                currentWeapon
                    .config
                    .movementSpeed;
        }


        // ====================================================
        // PointerLock Controls
        // ====================================================

        if (
            this.controls &&
            typeof this.controls
                .moveForward ===
                "function" &&
            typeof this.controls
                .moveRight ===
                "function"
        ) {

            this.controls.moveForward(
                forward *
                speed *
                delta
            );


            this.controls.moveRight(
                strafe *
                speed *
                delta
            );

        } else {

            const movement =
                this.moveDirection
                    .clone()
                    .multiplyScalar(
                        speed *
                        delta
                    );


            movement.applyQuaternion(
                object.quaternion
            );


            movement.y =
                0;


            object.position.add(
                movement
            );
        }


        // ====================================================
        // Gravity
        // ====================================================

        this.velocity.y -=
            PLAYER_CONFIG.gravity *
            delta;


        object.position.y +=
            this.velocity.y *
            delta;


        // ====================================================
        // 简易地面
        // ====================================================

        const groundY =
            this.eyeHeight;


        if (
            object.position.y <=
            groundY
        ) {

            object.position.y =
                groundY;


            this.velocity.y =
                0;


            this.isGrounded =
                true;

        } else {

            this.isGrounded =
                false;
        }
    }


    // ========================================================
    // Movement Factor
    // ========================================================

    get movementFactor() {

        if (
            !this.isMoving
        ) {

            return 0;
        }


        if (
            this.isCrouching
        ) {

            return 0.25;
        }


        if (
            this.isWalking
        ) {

            return 0.35;
        }


        return 0.6;
    }


    // ========================================================
    // Jump
    // ========================================================

    jump() {

        if (
            !this.isAlive ||
            !this.controlsEnabled
        ) {

            return false;
        }


        if (
            !this.isGrounded
        ) {

            return false;
        }


        if (
            this.isCrouching
        ) {

            return false;
        }


        this.velocity.y =
            PLAYER_CONFIG
                .jumpForce;


        this.isGrounded =
            false;


        gameEvents.emit(
            "player:jump",
            {
                player:
                    this
            }
        );


        return true;
    }


    // ========================================================
    // Crouch
    // ========================================================

    setCrouching(
        enabled
    ) {

        if (
            !this.isAlive
        ) {
            return;
        }


        this.isCrouching =
            Boolean(
                enabled
            );


        this.targetEyeHeight =
            this.isCrouching
                ? PLAYER_CONFIG
                    .crouchEyeHeight
                : PLAYER_CONFIG
                    .eyeHeight;


        if (
            this.isCrouching
        ) {

            this.isWalking =
                false;
        }


        gameEvents.emit(
            "player:crouch",
            {
                player:
                    this,

                crouching:
                    this.isCrouching,

                accuracyMultiplier:
                    this.isCrouching
                        ? this.crouchAccuracyMultiplier
                        : 1
            }
        );
    }


    toggleCrouch() {

        this.setCrouching(
            !this.isCrouching
        );
    }


    updateEyeHeight(
        delta
    ) {

        const object =
            this.getControlObject();


        if (!object) {
            return;
        }


        this.eyeHeight +=
            (
                this.targetEyeHeight -
                this.eyeHeight
            ) *
            Math.min(
                1,
                delta *
                    12
            );


        /*
         * 当前工程中 PointerLock Object
         * 的 Y 就是视点高度。
         */
        if (
            this.isGrounded
        ) {

            object.position.y =
                this.eyeHeight;
        }
    }


    // ========================================================
    // Footsteps
    // ========================================================

    updateFootsteps(
        delta
    ) {

        if (
            !this.isMoving ||
            !this.isGrounded
        ) {

            this.footstepTimer =
                0;

            return;
        }


        /*
         * Shift 静步不产生脚步事件。
         * 以后 BOT 如果监听 player:footstep，
         * 也自然无法通过脚步声发现静步玩家。
         */
        if (
            this.isWalking
        ) {

            this.footstepTimer =
                0;

            return;
        }


        let interval =
            0.48;


        if (
            this.isCrouching
        ) {

            interval =
                0.72;
        }


        this.footstepTimer +=
            delta;


        if (
            this.footstepTimer >=
            interval
        ) {

            this.footstepTimer =
                0;


            gameEvents.emit(
                "player:footstep",
                {
                    player:
                        this,

                    position:
                        this.getPosition(),

                    walking:
                        this.isWalking,

                    sprinting:
                        false,

                    crouching:
                        this.isCrouching
                }
            );
        }
    }


    // ========================================================
    // Sniper Scope V2
    // ========================================================

    setSniperScopeLevel(
        level = 0
    ) {

        this.sniperScopeLevel =
            clamp(
                Math.floor(
                    Number(level) ||
                    0
                ),
                0,
                2
            );


        this.inventory
            .currentWeapon
            ?.setScopeLevel?.(
                this.sniperScopeLevel
            );


        return this.sniperScopeLevel;
    }


    getSniperScopeLevel() {

        return this.sniperScopeLevel;
    }


    // ========================================================
    // Shooting
    // ========================================================

    shoot() {

        if (
            !this.isAlive ||
            !this.controlsEnabled
        ) {

            return {
                fired:
                    false
            };
        }


        const weapon =
            this.inventory
                .currentWeapon;


        if (!weapon) {

            return {
                fired:
                    false
            };
        }


        const origin =
            this.getEyePosition();


        const direction =
            this.getViewDirection();


        const result =
            weaponSystem.fire(
                weapon,
                {
                    origin,

                    direction,

                    movementFactor:
                        this.movementFactor,

                    crouching:
                        this.isCrouching,

                    crouchAccuracyMultiplier:
                        this.crouchAccuracyMultiplier,

                    airborne:
                        !this.isGrounded,

                    scopeLevel:
                        this.sniperScopeLevel
                }
            );


        /*
         * 空枪自动 Reload。
         */
        if (
            result.empty &&
            weapon.reserveAmmo >
            0
        ) {

            weapon.reload();
        }


        return result;
    }


    // ========================================================
    // Trigger Hold
    // ========================================================

    startFire() {

		/*
		 * 手雷模式下绝对不能开枪。
		 *
		 * 左键由 game.js 转交给
		 * beginGrenadePrime()。
		 */
		if (
			!this.isAlive ||
			!this.controlsEnabled ||
			this.grenadeMode
		) {
			return;
		}


		this.input.fire =
			true;


		const weapon =
			this.inventory
				.currentWeapon;


		weapon
			?.pressTrigger();


		/*
		 * 第一发立即打。
		 */
		this.shoot();
	}


	stopFire() {

		/*
		 * stopFire 只负责停止枪械射击。
		 *
		 * 重要：
		 * 这里绝对不能修改：
		 *
		 * this.grenadeMode
		 * this.grenadePrimeHeld
		 *
		 * 因为 beginGrenadePrime()
		 * 本身会调用 stopFire()，
		 * 用于确保切换到手雷时枪械停止射击。
		 */
		this.input.fire =
			false;


		this.inventory
			.currentWeapon
			?.releaseTrigger();
	}


    // ========================================================
    // 自动武器持续射击
    // ========================================================

    updateFire() {

        if (
            !this.input.fire ||
            !this.isAlive
        ) {
            return;
        }


        const weapon =
            this.inventory
                .currentWeapon;


        if (
            !weapon ||
            !weapon.config
                .automatic
        ) {
            return;
        }


        this.shoot();
    }


    // ========================================================
    // Reload
    // ========================================================

    reload() {

        if (
            !this.isAlive
        ) {

            return false;
        }


        return this.inventory
            .reload();
    }


    // ========================================================
    // Weapon Switch
    // ========================================================

    equipPrimary() {

        this.exitGrenadeMode({
            restoreWeapon: false
        });


        this.setSniperScopeLevel(
            0
        );


        return this.inventory
            .equipSlot(
                WEAPON_SLOT.PRIMARY
            );
    }


    equipSecondary() {

        this.exitGrenadeMode({
            restoreWeapon: false
        });


        this.setSniperScopeLevel(
            0
        );


        return this.inventory
            .equipSlot(
                WEAPON_SLOT.SECONDARY
            );
    }


    equipKnife() {

        this.exitGrenadeMode({
            restoreWeapon: false
        });


        this.setSniperScopeLevel(
            0
        );


        return this.inventory
            .equipSlot(
                WEAPON_SLOT.KNIFE
            );
    }


    switchLastWeapon() {

        this.exitGrenadeMode({
            restoreWeapon: false
        });


        this.setSniperScopeLevel(
            0
        );


        return this.inventory
            .switchLastWeapon();
    }


    // ========================================================
    // Buy / Give Weapon
    // ========================================================

    giveWeapon(
        weaponId,
        {
            equip = true
        } = {}
    ) {

        return this.inventory
            .addWeapon(
                weaponId,
                {
                    equip
                }
            );
    }


    // ========================================================
    // Grenade First Person V1
    // ========================================================

    addGrenade(
        type,
        amount = 1
    ) {

        return this.grenadeInventory
            .add(
                type,
                amount
            );
    }


    getAvailableGrenadeTypes() {

        return [
            GRENADE_TYPE.HE,
            GRENADE_TYPE.FLASH,
            GRENADE_TYPE.SMOKE
        ].filter(
            type =>
                this.grenadeInventory
                    .has(type)
        );
    }


    selectGrenade(
        type,
        {
            equipView = true
        } = {}
    ) {

        if (
            !Object.values(
                GRENADE_TYPE
            ).includes(type) ||
            !this.grenadeInventory
                .has(type)
        ) {
            return false;
        }


        this.selectedGrenadeType =
            type;


        if (equipView) {

            this.grenadeMode = true;
        }


        gameEvents.emit(
            "grenade:selected",
            {
                owner: this,
                type,
                equipped:
                    this.grenadeMode
            }
        );


        return true;
    }


    cycleGrenadeSlot() {

        if (
            !this.isAlive ||
            !this.controlsEnabled ||
            this.grenadePrimeHeld
        ) {
            return false;
        }


        const available =
            this.getAvailableGrenadeTypes();


        if (available.length === 0) {

            this.exitGrenadeMode({
                restoreWeapon: true
            });

            return false;
        }


        let nextType =
            available[0];


        if (this.grenadeMode) {

            const index =
                available.indexOf(
                    this.selectedGrenadeType
                );


            if (index >= 0) {

                nextType =
                    available[
                        (index + 1) %
                        available.length
                    ];
            }
        }


        return this.selectGrenade(
            nextType,
            {
                equipView: true
            }
        );
    }


    exitGrenadeMode({
        restoreWeapon = true
    } = {}) {

        this.grenadeMode = false;

        this.grenadePrimeHeld = false;


        if (restoreWeapon) {

            gameEvents.emit(
                "grenade:holster",
                {
                    owner: this,
                    type:
                        this.selectedGrenadeType
                }
            );
        }


        return true;
    }


    beginGrenadePrime() {

        if (
            !this.isAlive ||
            !this.controlsEnabled ||
            !this.grenadeMode ||
            !this.grenadeInventory
                .has(
                    this.selectedGrenadeType
                )
        ) {
            return false;
        }


        this.stopFire();

        this.grenadePrimeHeld = true;


        gameEvents.emit(
            "grenade:prime",
            {
                owner: this,
                type:
                    this.selectedGrenadeType
            }
        );


        return true;
    }


    releaseGrenadePrime() {

        if (
            !this.grenadeMode ||
            !this.grenadePrimeHeld
        ) {
            return false;
        }


        this.grenadePrimeHeld = false;


        gameEvents.emit(
            "grenade:release",
            {
                owner: this,
                type:
                    this.selectedGrenadeType
            }
        );


        return true;
    }


    commitGrenadeThrow(
        type =
            this.selectedGrenadeType,
        strength = 1
    ) {

        if (
            !this.isAlive ||
            !this.controlsEnabled ||
            !this.grenadeInventory
                .has(type)
        ) {
            return null;
        }


        const grenade =
            grenadeSystem
                .throwFromInventory({
                    inventory:
                        this.grenadeInventory,

                    type,

                    owner:
                        this,

                    origin:
                        this.getEyePosition(),

                    direction:
                        this.getViewDirection(),

                    strength
                });


        if (grenade) {

            const available =
                this.getAvailableGrenadeTypes();


            if (
                !this.grenadeInventory
                    .has(type) &&
                available.length > 0
            ) {

                this.selectedGrenadeType =
                    available[0];
            }
        }


        return grenade;
    }


    /*
     * Legacy API:
     * old code may still call throwGrenade().
     */
    throwGrenade(
        type =
            this.selectedGrenadeType,
        strength = 1
    ) {

        return this.commitGrenadeThrow(
            type,
            strength
        );
    }


    // ========================================================
    // Money
    // ========================================================

    setMoney(
        amount
    ) {

        this.money =
            clamp(
                Math.floor(
                    amount
                ),
                0,
                ECONOMY_CONFIG
                    .maxMoney
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


        return this.money;
    }


    addMoney(
        amount
    ) {

        return this.setMoney(
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
                Math.floor(
                    amount
                )
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


        gameEvents.emit(
            "player:armor-changed",
            {
                player:
                    this,

                armor:
                    this.armor
            }
        );
    }


    giveArmor(
        amount =
            PLAYER_CONFIG.maxArmor
    ) {

        this.setArmor(
            amount
        );
    }


    // ========================================================
    // Damage
    //
    // 与 weapon.js / grenade.js 接口匹配。
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
            amount <= 0
        ) {

            return {
                damage:
                    0,

                killed:
                    false,

                hp:
                    this.hp
            };
        }


        let damage =
            Math.max(
                0,
                amount
            );


        let armorDamage =
            0;


        // ====================================================
        // Armor Calculation
        // ====================================================

        if (
            this.armor >
            0
        ) {

            const penetration =
                clamp(
                    armorPenetration,
                    0,
                    1
                );


            /*
             * penetration 越高，
             * Armor 阻挡越少。
             */
            const blockRatio =
                (
                    1 -
                    penetration
                ) *
                PLAYER_CONFIG
                    .armorDamageAbsorption;


            const blockedDamage =
                damage *
                blockRatio;


            armorDamage =
                Math.min(
                    this.armor,
                    blockedDamage
                );


            this.armor -=
                armorDamage;


            damage -=
                armorDamage;


            this.armor =
                Math.max(
                    0,
                    this.armor
                );
        }


        damage =
            Math.max(
                0,
                damage
            );


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


        // ====================================================
        // Damage Event
        // ====================================================

        gameEvents.emit(
            GAME_EVENT.PLAYER_DAMAGE,
            {
                player:
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


        gameEvents.emit(
            "player:armor-changed",
            {
                player:
                    this,

                armor:
                    this.armor
            }
        );


        let killed =
            false;


        if (
            this.hp <=
            0
        ) {

            killed =
                true;


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
    // Death
    // ========================================================

    die({
        attacker = null,

        weapon = null,

        grenade = null,

        hitZone = null
    } = {}) {

        if (
            !this.isAlive
        ) {
            return;
        }


        this.isAlive =
            false;


        this.hp =
            0;


        this.deaths++;


        this.isMoving =
            false;


        this.isWalking =
            false;


        this.input.fire =
            false;


        this.setSniperScopeLevel(
            0
        );


        this.inventory
            .currentWeapon
            ?.releaseTrigger();


        this.survivedLastRound =
            false;


        if (
            this.hitbox
        ) {

            this.hitbox.visible =
                false;
        }


        gameEvents.emit(
            GAME_EVENT.PLAYER_DEATH,
            {
                player:
                    this,

                victim:
                    this,

                attacker,

                weapon,

                grenade,

                hitZone
            }
        );
    }


    // ========================================================
    // Register Kill
    // ========================================================

    registerKill({
        target = null,

        weapon = null,

        grenade = null,

        reward = null
    } = {}) {

        this.kills++;


        if (
            reward !=
            null
        ) {

            this.addMoney(
                reward
            );
        }


        gameEvents.emit(
            "player:kill",
            {
                player:
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
    // Team
    // ========================================================

    setTeam(
        team
    ) {

        if (
            team !==
                TEAM.CT &&
            team !==
                TEAM.T
        ) {

            return false;
        }


        if (
            this.team ===
            team
        ) {

            return true;
        }


        this.team =
            team;


        this.setupDefaultLoadout();


        gameEvents.emit(
            "player:team-changed",
            {
                player:
                    this,

                team:
                    this.team
            }
        );


        return true;
    }

	// ========================================================
	// Prepare For Round End
	//
	// 回合结束时由 round.js 调用。
	//
	// 生存：保存当前武器。
	// 死亡：清除保枪数据。
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

		} else {

			this.savedRoundInventory =
				null;
		}


		/*
		 * 回合结束后停止持续射击。
		 */
		this.stopFire?.();


		return this.savedRoundInventory;
	}
    // ========================================================
    // Round Inventory Save
    // ========================================================

    saveRoundInventory() {

        if (
            !this.isAlive
        ) {

            this.savedRoundInventory =
                null;


            this.survivedLastRound =
                false;


            return null;
        }


        this.savedRoundInventory =
            this.inventory
                .serialize();


        this.survivedLastRound =
            true;


        return this
            .savedRoundInventory;
    }


    clearSavedRoundInventory() {

        this.savedRoundInventory =
            null;


        this.survivedLastRound =
            false;
    }


    // ========================================================
    // Spawn / New Round
    // ========================================================

    spawn({
        position = null,

        preserveWeapons = true,

        resetArmor = false
    } = {}) {

        this.isAlive =
            true;


        this.isSpectating =
            false;


        this.controlsEnabled =
            true;


        this.hp =
            this.maxHP;


        if (
            resetArmor
        ) {

            this.armor =
                0;
        }


        this.velocity.set(
            0,
            0,
            0
        );


        this.isGrounded =
            true;


        this.isCrouching =
            false;


        this.isWalking =
            false;


        this.isMoving =
            false;


        this.grenadeMode =
            false;

        this.grenadePrimeHeld =
            false;


        this.setSniperScopeLevel(
            0
        );


        this.eyeHeight =
            PLAYER_CONFIG
                .eyeHeight;


        this.targetEyeHeight =
            PLAYER_CONFIG
                .eyeHeight;


        // ====================================================
        // Equipment
        // ====================================================

        if (
            preserveWeapons &&
            this.savedRoundInventory
        ) {

            this.inventory.restore(
                this.savedRoundInventory
            );

        } else {

            this.setupDefaultLoadout();
        }


        // ====================================================
        // Position
        // ====================================================

        if (
            position
        ) {

            if (
                position.isVector3
            ) {

                /*
                 * 地图 Spawn 点的 Y 通常表示地面高度，
                 * 当前地图一般返回 y = 0。
                 *
                 * Player 的 PointerLock 控制对象 Y
                 * 表示第一人称视点高度，因此不能直接
                 * 把地图 Spawn Vector3 原样复制进去。
                 *
                 * 否则 Freeze Time 期间视角会贴近地面，
                 * 等解冻后 updateEyeHeight() 才突然升高。
                 */
                this.setPosition(
                    position.x,

                    PLAYER_CONFIG
                        .eyeHeight,

                    position.z
                );

            } else {

                this.setPosition(
                    position.x ??
                        0,

                    position.y ??
                        PLAYER_CONFIG
                            .eyeHeight,

                    position.z ??
                        0
                );
            }
        }


        /*
         * 一定要在玩家出生位置更新完成后
         * 再同步 Hitbox。
         */
        if (
            this.hitbox
        ) {

            this.hitbox.visible =
                true;


            this.updateHitbox();
        }


        gameEvents.emit(
            GAME_EVENT.PLAYER_SPAWN,
            {
                player:
                    this,

                position:
                    this.getPosition(),

                hp:
                    this.hp,

                armor:
                    this.armor
            }
        );


        return this;
    }
	
	// ========================================================
	// Full Reset
	//
	// 新比赛才调用。
	// ========================================================

	resetMatch() {

		this.kills =
			0;


		this.deaths =
			0;


		this.assists =
			0;


		this.money =
			ECONOMY_CONFIG
				.startMoney;


		this.hp =
			this.maxHP;


		this.armor =
			0;


		this.isAlive =
			true;


		this.isSpectating =
			false;


		this.controlsEnabled =
			true;


		this.isMoving =
			false;


		this.isWalking =
			false;


		this.isCrouching =
			false;


		this.savedRoundInventory =
			null;


		this.survivedLastRound =
			false;


		this.velocity.set(
			0,
			0,
			0
		);


		this.input.fire =
			false;



		this.grenadeMode =
			false;


		this.grenadePrimeHeld =
			false;
		

		this.setSniperScopeLevel(
			0
		);
this.grenadeInventory
			.clear();


		this.setupDefaultLoadout();


		/*
		 * 新比赛重新启用玩家 Hitbox。
		 */
		if (
			this.hitbox
		) {

			this.hitbox.visible =
				true;


			this.updateHitbox();
		}


		gameEvents.emit(
			"player:reset",
			{
				player:
					this
			}
		);
	}

    // ========================================================
    // Spectator
    // ========================================================

    setSpectating(
        enabled
    ) {

        this.isSpectating =
            Boolean(
                enabled
            );


        this.controlsEnabled =
            !this.isSpectating &&
            this.isAlive;


        if (
            this.hitbox
        ) {

            this.hitbox.visible =
                this.isAlive &&
                !this.isSpectating;
        }


        gameEvents.emit(
            "player:spectating",
            {
                player:
                    this,

                spectating:
                    this.isSpectating
            }
        );
    }


    // ========================================================
    // Controls Enabled
    // ========================================================

    setControlsEnabled(
        enabled
    ) {

        this.controlsEnabled =
            Boolean(
                enabled
            );


        if (
            !this.controlsEnabled
        ) {

            this.stopFire();


            this.input.forward =
                false;


            this.input.backward =
                false;


            this.input.left =
                false;


            this.input.right =
                false;


            this.input.walk =
                false;


            this.input.crouch =
                false;


            this.isMoving =
                false;


            this.isWalking =
                false;


            this.setCrouching(
                false
            );
        }
    }


    // ========================================================
    // Round Survival
    // ========================================================

    markRoundSurvived() {

        if (
            !this.isAlive
        ) {

            this.survivedLastRound =
                false;

            return;
        }


        this.survivedLastRound =
            true;


        this.saveRoundInventory();
    }


    markRoundLost() {

        this.survivedLastRound =
            false;
    }


    // ========================================================
    // Reset Stats
    // ========================================================

    resetStats() {

        this.kills =
            0;


        this.deaths =
            0;


        this.assists =
            0;
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            name:
                this.name,

            team:
                this.team,

            hp:
                this.hp,

            maxHP:
                this.maxHP,

            armor:
                this.armor,

            maxArmor:
                this.maxArmor,

            money:
                this.money,

            kills:
                this.kills,

            deaths:
                this.deaths,

            alive:
                this.isAlive,

            crouching:
                this.isCrouching,

            walking:
                this.isWalking,

            /*
             * 兼容旧 HUD / 调试代码。
             * Web Control V2 已取消 Sprint。
             */
            sprinting:
                false,

            grounded:
                this.isGrounded,

            position:
                this.getPosition(),

            weapon:
                this.inventory
                    .currentWeapon
                    ?.getState() ??
                null,

            grenades:
                this.grenadeInventory
                    .serialize(),

            grenadeMode:
                this.grenadeMode,

            selectedGrenade:
                this.selectedGrenadeType,

            sniperScopeLevel:
                this.sniperScopeLevel
        };
    }


    // ========================================================
    // Player Hitbox
    // ========================================================

    updateHitbox() {

        if (
            !this.hitbox
        ) {
            return;
        }


        const playerObject =
            this.getControlObject();


        if (
            !playerObject
        ) {
            return;
        }


        const position =
            new THREE.Vector3();


        /*
         * 使用真实世界坐标，
         * 避免 Camera / Controls 存在父节点时坐标错误。
         */
        if (
            typeof playerObject
                .getWorldPosition ===
                "function"
        ) {

            playerObject.getWorldPosition(
                position
            );

        } else if (
            playerObject.position
        ) {

            position.copy(
                playerObject.position
            );

        } else {

            return;
        }


        /*
         * 当前 PointerLock Object 的 Y
         * 本身就是 Eye Height。
         *
         * 例如站立：
         *
         * eye    = 1.8
         * center = 0.9
         */
        const bodyCenterY =
            Math.max(
                0.9,
                position.y -
                    0.9
            );


        this.hitbox.position.set(
            position.x,
            bodyCenterY,
            position.z
        );


        /*
         * 下蹲时稍微降低 Hitbox。
         */
        if (
            this.isCrouching
        ) {

            this.hitbox.position.y -=
                0.18;


            this.hitbox.scale.y =
                0.76;

        } else {

            this.hitbox.scale.y =
                1;
        }


        this.hitbox.visible =
            Boolean(
                this.isAlive &&
                !this.isSpectating
            );


        /*
         * Raycaster 使用 matrixWorld，
         * 所以这里马上刷新。
         */
        this.hitbox.updateMatrixWorld(
            true
        );
    }


    // ========================================================
    // Weapon / Grenade registration object
    //
    // map.js registerEntity(player)
    // 会取得这个对象。
    // ========================================================

    getObject3D() {

        return this.hitbox;
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.stopFire();


        this.inventory.clear({
            keepKnife:
                false
        });


        this.grenadeInventory
            .clear();


        /*
         * 即使 map.js 没来得及 unregister，
         * 这里也主动清理一次。
         */
        if (
            this.hitbox
        ) {

            weaponSystem.unregisterTarget(
                this.hitbox
            );


            /*
             * grenade.js 如果有这个 API，
             * 同样注销。
             */
            grenadeSystem
                .unregisterEntityObject?.(
                    this.hitbox
                );
        }


        if (
            this.hitbox
        ) {

            if (
                this.hitbox.parent
            ) {

                this.hitbox.parent.remove(
                    this.hitbox
                );
            }


            this.hitbox.geometry
                ?.dispose?.();


            this.hitbox.material
                ?.dispose?.();


            this.hitbox =
                null;
        }


        this.camera =
            null;


        this.controls =
            null;


        this.scene =
            null;
    }
}


// ============================================================
// 玩家脚步事件
// ============================================================

gameEvents.on(
    "player:footstep",
    () => {

        /*
         * Audio System 自己监听。
         * Player 不直接依赖 Audio。
         */
    }
);


// ============================================================
// 武器击杀 -> 玩家战绩
// ============================================================

gameEvents.on(
    "weapon:hit",
    (data = {}) => {

        const attacker =
            data.attacker;


        if (
            !data.kill ||
            !(attacker instanceof Player)
        ) {

            return;
        }


        let reward =
            data.weapon
                ?.config
                ?.killReward;


        if (
            reward ==
            null
        ) {

            reward =
                ECONOMY_CONFIG
                    .defaultKillReward ??
                300;
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
// Grenade kill -> 玩家战绩
// ============================================================

gameEvents.on(
    "grenade:damage",
    (data = {}) => {

        /*
         * grenade.js 如果之后提供 killed 字段，
         * 可以在这里统一处理。
         */
        if (
            !data.killed
        ) {
            return;
        }


        const attacker =
            data.owner ||
            data.attacker;


        if (
            !(attacker instanceof Player)
        ) {
            return;
        }


        attacker.registerKill({
            target:
                data.target,

            grenade:
                data.grenade,

            reward:
                ECONOMY_CONFIG
                    .grenadeKillReward ??
                300
        });
    }
);


// ============================================================
// Default Export
// ============================================================

export default Player;