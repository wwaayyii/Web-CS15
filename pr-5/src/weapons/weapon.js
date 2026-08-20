/**
 * Web-CS15
 * src/weapons/weapon.js
 *
 * 武器核心系统
 *
 * 职责：
 * - Weapon 实例
 * - 弹药
 * - 开火
 * - 射速
 * - Reload
 * - Raycast
 * - 命中 / 爆头
 * - 武器库存
 * - 武器切换
 *
 * 不负责：
 * - 枪械 3D 模型
 * - Audio 实现
 * - Effects 实现
 * - HUD DOM
 */

import * as THREE from "three";

import {
    WEAPON_CONFIG,
    WEAPON_SLOT,
    WEAPON_TYPE,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    randomRange,
    randomInt,
    gameEvents
} from "../core/utils.js";


// ============================================================
// 常量
// ============================================================

export const HIT_ZONE = Object.freeze({
    HEAD: "head",
    CHEST: "chest",
    STOMACH: "stomach",
    ARM: "arm",
    LEG: "leg",
    GENERIC: "generic"
});


export const HIT_MULTIPLIER = Object.freeze({
    [HIT_ZONE.HEAD]: 4.0,
    [HIT_ZONE.CHEST]: 1.0,
    [HIT_ZONE.STOMACH]: 1.25,
    [HIT_ZONE.ARM]: 0.9,
    [HIT_ZONE.LEG]: 0.75,
    [HIT_ZONE.GENERIC]: 1.0
});


// ============================================================
// 工具函数
// ============================================================

function getWeaponConfig(id) {

    const config =
        WEAPON_CONFIG[id];

    if (!config) {

        throw new Error(
            `[Weapon] Unknown weapon: ${id}`
        );
    }

    return config;
}


function cloneConfig(config) {

    return structuredClone
        ? structuredClone(config)
        : JSON.parse(
            JSON.stringify(config)
        );
}


/**
 * 从 Three.js Object3D 向父级查找游戏实体。
 *
 * BOT / Player 模型以后可以：
 *
 * mesh.userData.owner = bot;
 * mesh.userData.hitZone = "head";
 */
function findEntityOwner(object) {

    let current = object;

    while (current) {

        if (
            current.userData &&
            current.userData.owner
        ) {

            return current.userData.owner;
        }

        current = current.parent;
    }

    return null;
}


/**
 * 查找命中区域。
 */
function findHitZone(object) {

    let current = object;

    while (current) {

        if (
            current.userData &&
            current.userData.hitZone
        ) {

            return current.userData.hitZone;
        }

        current = current.parent;
    }

    return HIT_ZONE.GENERIC;
}


/**
 * 检查目标是否属于同队。
 */
function isFriendly(
    attacker,
    target
) {

    if (
        !attacker ||
        !target
    ) {
        return false;
    }

    if (
        attacker === target
    ) {
        return true;
    }

    return (
        attacker.team != null &&
        target.team != null &&
        attacker.team === target.team
    );
}


// ============================================================
// Weapon
// ============================================================

export class Weapon {

    constructor(
        weaponId,
        {
            owner = null
        } = {}
    ) {

        const config =
            getWeaponConfig(
                weaponId
            );

        this.config =
            cloneConfig(config);

        this.id =
            config.id;

        this.name =
            config.name;

        this.displayName =
            config.displayName;

        this.slot =
            config.slot;

        this.type =
            config.type;

        this.owner =
            owner;


        // ----------------------------------------------------
        // Ammo
        // ----------------------------------------------------

        this.clipAmmo =
            config.maxClip ?? 0;

        this.reserveAmmo =
            config.reserveAmmo ?? 0;


        // ----------------------------------------------------
        // 状态
        // ----------------------------------------------------

        this.isReloading =
            false;

        this.reloadTimeLeft =
            0;

        this.nextFireTime =
            0;

        this.triggerHeld =
            false;

        this.hasFiredThisTrigger =
            false;

        this.enabled =
            true;


        // ----------------------------------------------------
        // Player Sniper Scope State
        //
        // null = BOT / 非玩家 Scope 逻辑
        // 0    = 未开镜
        // 1/2  = 已开镜
        // ----------------------------------------------------

        this.scopeLevel =
            null;


        // ----------------------------------------------------
        // Recoil
        // ----------------------------------------------------

        this.currentRecoil =
            0;


        /*
         * Dynamic Crosshair / Continuous Fire Bloom
         *
         * currentRecoil 使用武器原始 vertical 数值，
         * 其恢复速度较快，不适合直接作为连续射击准心扩张量。
         *
         * recoilBloom 是独立的“连续射击累计值”：
         * - 每成功射击 +1
         * - 停火后逐渐恢复
         * - 同时参与真实 spread 与动态准心
         */
        this.recoilBloom =
            0;


        this.shotsFired =
            0;


        // ----------------------------------------------------
        // 统计
        // ----------------------------------------------------

        this.totalShots =
            0;

        this.totalHits =
            0;

        this.totalKills =
            0;
    }


    // ========================================================
    // Owner
    // ========================================================

    setOwner(owner) {

        this.owner = owner;

        return this;
    }


    // ========================================================
    // Sniper Scope State
    // ========================================================

    setScopeLevel(
        level = null
    ) {

        if (
            level == null
        ) {

            this.scopeLevel =
                null;

            return this.scopeLevel;
        }


        this.scopeLevel =
            clamp(
                Math.floor(
                    Number(level) ||
                    0
                ),
                0,
                2
            );


        return this.scopeLevel;
    }


    // ========================================================
    // Ammo
    // ========================================================

    get maxClip() {

        return (
            this.config.maxClip ??
            0
        );
    }


    get ammo() {

        return {
            clip:
                this.clipAmmo,

            reserve:
                this.reserveAmmo
        };
    }


    get hasAmmo() {

        return (
            this.clipAmmo > 0
        );
    }


    get canReload() {

        if (this.isReloading) {
            return false;
        }

        if (
            this.maxClip <= 0
        ) {
            return false;
        }

        if (
            this.clipAmmo >=
            this.maxClip
        ) {
            return false;
        }

        if (
            this.reserveAmmo <= 0
        ) {
            return false;
        }

        return true;
    }


    addReserveAmmo(amount) {

        this.reserveAmmo +=
            Math.max(
                0,
                Math.floor(amount)
            );

        this._emitAmmoChanged();

        return this.reserveAmmo;
    }


    setAmmo(
        clip,
        reserve
    ) {

        this.clipAmmo =
            clamp(
                Math.floor(clip),
                0,
                this.maxClip
            );

        this.reserveAmmo =
            Math.max(
                0,
                Math.floor(reserve)
            );

        this._emitAmmoChanged();
    }


    refillAmmo() {

        this.clipAmmo =
            this.maxClip;

        this.reserveAmmo =
            this.config.reserveAmmo ??
            0;

        this._emitAmmoChanged();
    }


    // ========================================================
    // Reload
    // ========================================================

    reload() {

        if (!this.canReload) {

            return false;
        }

        this.isReloading =
            true;

        this.reloadTimeLeft =
            this.config.reloadTime ??
            2;

        gameEvents.emit(
            GAME_EVENT.WEAPON_RELOAD,
            {
                owner:
                    this.owner,

                weapon:
                    this,

                weaponId:
                    this.id
            }
        );

        return true;
    }


    cancelReload() {

        if (!this.isReloading) {
            return;
        }

        this.isReloading =
            false;

        this.reloadTimeLeft =
            0;
    }


    _finishReload() {

        const needed =
            this.maxClip -
            this.clipAmmo;

        const transfer =
            Math.min(
                needed,
                this.reserveAmmo
            );

        this.clipAmmo +=
            transfer;

        this.reserveAmmo -=
            transfer;

        this.isReloading =
            false;

        this.reloadTimeLeft =
            0;

        this._emitAmmoChanged();

        gameEvents.emit(
            "weapon:reload-complete",
            {
                owner:
                    this.owner,

                weapon:
                    this,

                weaponId:
                    this.id
            }
        );
    }


    // ========================================================
    // Trigger
    // ========================================================

    pressTrigger() {

        if (!this.triggerHeld) {

            this.hasFiredThisTrigger =
                false;
        }

        this.triggerHeld =
            true;
    }


    releaseTrigger() {

        this.triggerHeld =
            false;

        this.hasFiredThisTrigger =
            false;
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (
            this.isReloading
        ) {

            this.reloadTimeLeft -=
                delta;

            if (
                this.reloadTimeLeft <= 0
            ) {

                this._finishReload();
            }
        }


        const recovery =
            this.config.recoil
                ?.recovery ??
            5;

        this.currentRecoil =
            Math.max(
                0,
                this.currentRecoil -
                recovery *
                delta
            );


        /*
         * 连续射击 Bloom 恢复。
         *
         * recovery 原本各枪大约 4~10。
         * 这里取较温和速度，确保连射时能累计，
         * 停火后约 0.5~1 秒明显收回。
         */
        const bloomRecovery =
            Math.max(
                2.5,
                recovery *
                0.55
            );


        this.recoilBloom =
            Math.max(
                0,
                this.recoilBloom -
                bloomRecovery *
                delta
            );


        if (
            this.triggerHeld &&
            this.config.automatic
        ) {

            return true;
        }

        return false;
    }


    // ========================================================
    // 是否允许开火
    // ========================================================

    canFire(
        currentTime =
            performance.now() /
            1000
    ) {

        if (!this.enabled) {
            return false;
        }

        if (this.isReloading) {
            return false;
        }

        if (!this.hasAmmo) {
            return false;
        }

        if (
            currentTime <
            this.nextFireTime
        ) {
            return false;
        }

        if (
            !this.config.automatic &&
            this.hasFiredThisTrigger
        ) {

            return false;
        }

        return true;
    }


    // ========================================================
    // Fire
    // ========================================================

    fire({
        origin,
        direction,
        targets = [],
        currentTime =
            performance.now() /
            1000,

        movementFactor = 0,

        crouching = false,

        crouchAccuracyMultiplier = 0.70,

        airborne = false,

        scopeLevel =
            this.scopeLevel,

        friendlyFire = false,

        raycaster = null
    } = {}) {

        if (
            !origin ||
            !direction
        ) {

            console.warn(
                "[Weapon] fire() requires origin and direction."
            );

            return {
                fired: false
            };
        }


        // ----------------------------------------------------
        // 空枪
        // ----------------------------------------------------

        if (
            this.clipAmmo <= 0
        ) {

            gameEvents.emit(
                "weapon:empty",
                {
                    owner:
                        this.owner,

                    weapon:
                        this
                }
            );

            return {
                fired: false,
                empty: true
            };
        }


        if (
            !this.canFire(
                currentTime
            )
        ) {

            return {
                fired: false
            };
        }


        // ----------------------------------------------------
        // 消耗弹药
        // ----------------------------------------------------

        this.clipAmmo--;

        this.totalShots++;

        this.shotsFired++;

        this.hasFiredThisTrigger =
            true;


        const fireRate =
            this.config.fireRate ??
            0.1;

        this.nextFireTime =
            currentTime +
            fireRate;


        // ----------------------------------------------------
        // Recoil
        // ----------------------------------------------------

        this.currentRecoil +=
            this.config.recoil
                ?.vertical ??
            0;


        /*
         * 每一发真实射击都会累计 Bloom。
         * 上限避免长时间扫射把准心撑得离谱。
         */
        this.recoilBloom =
            Math.min(
                8,
                this.recoilBloom +
                    1
            );


        this._emitAmmoChanged();


        // ----------------------------------------------------
        // 音频事件
        // ----------------------------------------------------

        gameEvents.emit(
            GAME_EVENT.WEAPON_FIRE,
            {
                owner:
                    this.owner,

                weapon:
                    this,

                weaponId:
                    this.id,

                origin:
                    origin.clone?.() ??
                    origin
            }
        );


        // ----------------------------------------------------
        // 散布
        // ----------------------------------------------------

        const shotDirection =
            this.applySpread(
                direction,
                {
                    movementFactor,
                    crouching,
                    crouchAccuracyMultiplier,
                    airborne,
                    scopeLevel
                }
            );


        // ----------------------------------------------------
        // Raycast
        // ----------------------------------------------------

        const result =
            this.performRaycast({
                origin,
                direction:
                    shotDirection,

                targets,

                friendlyFire,

                raycaster
            });


        return {
            fired: true,

            weapon:
                this,

            direction:
                shotDirection,

            ...result
        };
    }


    // ========================================================
    // Current Spread
    //
    // Dynamic Crosshair 与真实弹道共用这一套计算。
    // 这里只计算 spread 数值，不修改射击方向。
    // ========================================================

    getCurrentSpread({
        movementFactor = 0,
        crouching = false,
        crouchAccuracyMultiplier = 0.70,
        airborne = false,
        scopeLevel =
            this.scopeLevel
    } = {}) {

        const spreadConfig =
            this.config.spread ??
            {};


        // ----------------------------------------------------
        // Sniper Accuracy V1
        //
        // 只在 scopeLevel != null 时启用。
        // Player 会同步 0 / 1 / 2；
        // BOT 默认 null，继续沿用原本散布。
        // ----------------------------------------------------

        const sniperAccuracy =
            this.config
                .sniperAccuracy;


        if (
            sniperAccuracy &&
            scopeLevel != null
        ) {

            const scoped =
                Number(scopeLevel) >
                0;


            const sniperSpread =
                scoped
                    ? sniperAccuracy
                        .scoped
                    : sniperAccuracy
                        .unscoped;


            if (sniperSpread) {

                let spread =
                    Number(
                        sniperSpread
                            .stand
                    ) || 0;


                // ------------------------------------------------
                // Airborne
                // ------------------------------------------------

                if (
                    airborne
                ) {

                    spread =
                        Number(
                            sniperSpread
                                .air
                        ) ||
                        spread;


                // ------------------------------------------------
                // Movement
                //
                // 先判断移动，再判断 crouch。
                //
                // 这样“蹲着移动”也不会得到静止蹲射精度。
                // ------------------------------------------------

                } else if (
                    movementFactor >
                    0
                ) {

                    const moveSpread =
                        Number(
                            sniperSpread
                                .move
                        ) ||
                        spread;


                    const standReference =
                        crouching
                            ? (
                                Number(
                                    sniperSpread
                                        .crouch
                                ) ||
                                spread
                            )
                            : spread;


                    spread =
                        standReference +
                        (
                            moveSpread -
                            standReference
                        ) *
                        clamp(
                            Number(
                                movementFactor
                            ) || 0,
                            0,
                            1
                        );


                // ------------------------------------------------
                // Crouch Static
                // ------------------------------------------------

                } else if (
                    crouching
                ) {

                    spread =
                        Number(
                            sniperSpread
                                .crouch
                        ) ||
                        spread;
                }


                /*
                 * 关键修复：
                 *
                 * 狙击枪开镜弹道不再叠加 recoilBloom。
                 *
                 * 原代码 fire() 会先 recoilBloom + 1，
                 * 再计算当前这一发 spread，
                 * 导致第一发即使 Scope 中心压在 BOT 身上，
                 * 也可能因为 bloom 随机偏离。
                 *
                 * 现在：
                 * - 当前子弹只由姿态 / 移动状态决定
                 * - 开枪后的“重量感”交给 game.js 的视觉反馈
                 * - 不再用当前这一发的 recoil 把子弹随机推离准心
                 */
                return Math.max(
                    0,
                    spread
                );
            }
        }


        /*
         * 兼容两种配置命名：
         *
         * 1) stand / move / crouch / air
         * 2) base / movement / airborne
         */
        const standSpread =
            Number(
                spreadConfig.stand ??
                spreadConfig.base ??
                0
            ) || 0;


        let spread =
            standSpread;


        // ----------------------------------------------------
        // Airborne
        // ----------------------------------------------------

        if (airborne) {

            spread =
                Number(
                    spreadConfig.air ??
                    spreadConfig.airborne ??
                    spreadConfig.jump ??
                    standSpread
                ) || standSpread;

        // ----------------------------------------------------
        // Crouch
        // ----------------------------------------------------

        } else if (crouching) {

            if (
                spreadConfig.crouch != null
            ) {

                spread =
                    Number(
                        spreadConfig.crouch
                    ) || 0;

            } else {

                spread *=
                    clamp(
                        Number(
                            crouchAccuracyMultiplier
                        ) || 0.70,
                        0.45,
                        1
                    );
            }

        // ----------------------------------------------------
        // Movement
        // ----------------------------------------------------

        } else if (
            movementFactor > 0
        ) {

            const moveSpread =
                Number(
                    spreadConfig.move ??
                    spreadConfig.movement ??
                    standSpread
                ) || standSpread;


            spread +=
                (
                    moveSpread -
                    standSpread
                ) *
                clamp(
                    Number(
                        movementFactor
                    ) || 0,
                    0,
                    1
                );
        }


        // ----------------------------------------------------
        // Recoil spread
        // ----------------------------------------------------

        /*
         * Continuous Fire Bloom
         *
         * config.js 当前没有 recoil.spread，
         * 因此使用 vertical recoil 推导一个温和的
         * 连射散布增量。
         *
         * 例如 AK vertical=0.080：
         * 每 1 bloom 大约增加 0.0048 spread。
         */
        const configuredRecoilSpread =
            Number(
                this.config.recoil
                    ?.spread
            );


        const recoilSpreadPerBloom =
            Number.isFinite(
                configuredRecoilSpread
            )
                ? configuredRecoilSpread
                : (
                    Number(
                        this.config.recoil
                            ?.vertical ??
                        0
                    ) *
                    0.060
                );


        spread +=
            Math.max(
                0,
                Number(
                    this.recoilBloom
                ) || 0
            ) *
            recoilSpreadPerBloom;


        return Math.max(
            0,
            spread
        );
    }


    // ========================================================
    // Spread
    //
    // 只负责把 spread 应用到真实射击方向。
    // ========================================================

    applySpread(
        baseDirection,
        {
            movementFactor = 0,
            crouching = false,
            crouchAccuracyMultiplier = 0.70,
            airborne = false,
            scopeLevel =
                this.scopeLevel
        } = {}
    ) {

        if (!baseDirection) {

            return new THREE.Vector3(
                0,
                0,
                -1
            );
        }


        const spread =
            this.getCurrentSpread({
                movementFactor,
                crouching,
                crouchAccuracyMultiplier,
                airborne,
                scopeLevel
            });


        const direction =
            baseDirection
                .clone()
                .normalize();


        if (
            spread <= 0
        ) {

            return direction;
        }


        // ----------------------------------------------------
        // 建立垂直于射线的两个轴
        // ----------------------------------------------------

        const worldUp =
            new THREE.Vector3(
                0,
                1,
                0
            );


        let right =
            new THREE.Vector3()
                .crossVectors(
                    direction,
                    worldUp
                );


        if (
            right.lengthSq() <
            0.0001
        ) {

            right.set(
                1,
                0,
                0
            );
        }


        right.normalize();


        const up =
            new THREE.Vector3()
                .crossVectors(
                    right,
                    direction
                )
                .normalize();


        // ----------------------------------------------------
        // 保留项目原有的随机散布方式
        // ----------------------------------------------------

        const horizontal =
            randomRange(
                -spread,
                spread
            );


        const vertical =
            randomRange(
                -spread,
                spread
            );


        direction
            .addScaledVector(
                right,
                horizontal
            )
            .addScaledVector(
                up,
                vertical
            )
            .normalize();


        return direction;
    }


    // ========================================================
    // Raycast
    // ========================================================

    performRaycast({
        origin,
        direction,
        targets,
        friendlyFire = false,
        raycaster = null
    }) {

        const caster =
            raycaster ||
            new THREE.Raycaster();


        const maxRange =
            this.config.range ??
            100;


        caster.set(
            origin,
            direction
        );


        caster.far =
            maxRange;


        const intersections =
            caster.intersectObjects(
                targets,
                true
            );


        if (
            intersections.length === 0
        ) {

            return {
                hit: false
            };
        }


        // ----------------------------------------------------
        // 遍历命中结果
        //
        // 自己的模型跳过。
        // ----------------------------------------------------

        for (
            const hit
            of intersections
        ) {

            const entity =
                findEntityOwner(
                    hit.object
                );


            if (
                entity &&
                entity ===
                this.owner
            ) {

                continue;
            }


            // ------------------------------------------------
            // 世界碰撞
            // ------------------------------------------------

            if (!entity) {

                this._emitWorldImpact(
                    hit
                );


                return {
                    hit: true,

                    hitWorld: true,

                    intersection:
                        hit,

                    point:
                        hit.point
                };
            }


            // ------------------------------------------------
            // 队友
            // ------------------------------------------------

            if (
                isFriendly(
                    this.owner,
                    entity
                ) &&
                !friendlyFire
            ) {

                /*
                 * CS 风格：
                 * 队友仍然会挡住子弹，
                 * 但关闭 FF 时不造成伤害。
                 */

                return {
                    hit: true,

                    friendly:
                        true,

                    target:
                        entity,

                    intersection:
                        hit
                };
            }


            // ------------------------------------------------
            // 实体命中
            // ------------------------------------------------

            return this._damageEntity(
                entity,
                hit
            );
        }


        return {
            hit: false
        };
    }


    // ========================================================
    // 世界命中
    // ========================================================

    _emitWorldImpact(hit) {

        if (
            !hit ||
            !hit.point
        ) {
            return;
        }


        let normal =
            new THREE.Vector3(
                0,
                1,
                0
            );


        if (
            hit.face &&
            hit.face.normal
        ) {

            normal =
                hit.face.normal
                    .clone();


            /*
             * face.normal 是物体本地坐标，
             * 转成世界坐标。
             */
            if (
                hit.object &&
                hit.object.matrixWorld
            ) {

                const normalMatrix =
                    new THREE.Matrix3()
                        .getNormalMatrix(
                            hit.object.matrixWorld
                        );


                normal.applyMatrix3(
                    normalMatrix
                );

                normal.normalize();
            }
        }


        // ----------------------------------------------------
        // Surface Impact V2
        //
        // Raycast may hit a child mesh. Walk upward until a
        // map object carrying userData.surfaceType is found.
        // Unknown / legacy objects safely fall back to concrete.
        // ----------------------------------------------------

        let surfaceType =
            "concrete";


        let surfaceObject =
            hit.object;


        while (
            surfaceObject
        ) {

            const candidate =
                surfaceObject.userData
                    ?.surfaceType;


            if (
                candidate
            ) {

                surfaceType =
                    candidate;

                break;
            }


            surfaceObject =
                surfaceObject.parent;
        }


        gameEvents.emit(
            "weapon:impact",
            {
                owner:
                    this.owner,

                weapon:
                    this,

                point:
                    hit.point.clone(),

                normal,

                object:
                    hit.object,

                surfaceObject:
                    surfaceObject ||
                    hit.object,

                surfaceType
            }
        );
    }


    // ========================================================
    // Damage
    // ========================================================

    _damageEntity(
        target,
        hit
    ) {

        const distance =
            hit.distance ??
            0;


        const hitZone =
            findHitZone(
                hit.object
            );


        const damageResult =
            this.calculateDamage({
                distance,
                hitZone,
                target
            });


        let result = null;


        /*
         * 我们约定：
         *
         * Player / Bot 后面实现：
         *
         * takeDamage({
         *   amount,
         *   armorPenetration,
         *   attacker,
         *   weapon,
         *   hitZone
         * })
         *
         * 返回：
         *
         * {
         *   damage,
         *   killed,
         *   hp
         * }
         */
        if (
            typeof target.takeDamage ===
            "function"
        ) {

            result =
                target.takeDamage({
                    amount:
                        damageResult.damage,

                    armorPenetration:
                        damageResult
                            .armorPenetration,

                    attacker:
                        this.owner,

                    weapon:
                        this,

                    hitZone,

                    point:
                        hit.point?.clone()
                });
        }


        const actualDamage =
            result?.damage ??
            damageResult.damage;


        const killed =
            Boolean(
                result?.killed ||
                result?.dead
            );


        this.totalHits++;


        if (killed) {
            this.totalKills++;
        }


        gameEvents.emit(
            "weapon:hit",
            {
                owner:
                    this.owner,

                attacker:
                    this.owner,

                target,

                weapon:
                    this,

                weaponId:
                    this.id,

                damage:
                    actualDamage,

                hitZone,

                headshot:
                    hitZone ===
                    HIT_ZONE.HEAD,

                kill:
                    killed,

                point:
                    hit.point?.clone(),

                distance
            }
        );


        return {
            hit: true,

            hitWorld: false,

            target,

            damage:
                actualDamage,

            hitZone,

            headshot:
                hitZone ===
                HIT_ZONE.HEAD,

            killed,

            intersection:
                hit
        };
    }


    // ========================================================
    // Damage Calculation
    // ========================================================

    calculateDamage({
        distance = 0,
        hitZone =
            HIT_ZONE.GENERIC,
        target = null
    } = {}) {

        const baseDamage =
            this.config.damage ??
            0;


        const multiplier =
            HIT_MULTIPLIER[
                hitZone
            ] ??
            1;


        // ----------------------------------------------------
        // 距离衰减
        //
        // CS 风格：
        //
        // damage *
        // rangeModifier^(distance / 10)
        // ----------------------------------------------------

        const rangeModifier =
            this.config.rangeModifier ??
            1;


        const distanceMultiplier =
            Math.pow(
                rangeModifier,
                distance / 10
            );


        let damage =
            baseDamage *
            multiplier *
            distanceMultiplier;


        damage =
            Math.max(
                1,
                damage
            );


        return {
            damage,

            baseDamage,

            multiplier,

            distanceMultiplier,

            armorPenetration:
                this.config
                    .armorPenetration ??
                0,

            hitZone
        };
    }


    // ========================================================
    // Weapon info
    // ========================================================

    getState() {

        return {
            id:
                this.id,

            name:
                this.name,

            slot:
                this.slot,

            clipAmmo:
                this.clipAmmo,

            reserveAmmo:
                this.reserveAmmo,

            maxClip:
                this.maxClip,

            reloading:
                this.isReloading,

            reloadTimeLeft:
                this.reloadTimeLeft,

            currentRecoil:
                this.currentRecoil,

            recoilBloom:
                this.recoilBloom,

            scopeLevel:
                this.scopeLevel,

            currentSpread:
                this.getCurrentSpread()
        };
    }


    // ========================================================
    // Ammo event
    // ========================================================

    _emitAmmoChanged() {

        gameEvents.emit(
            "weapon:ammo-changed",
            {
                owner:
                    this.owner,

                weapon:
                    this,

                weaponId:
                    this.id,

                clip:
                    this.clipAmmo,

                reserve:
                    this.reserveAmmo,

                maxClip:
                    this.maxClip
            }
        );
    }
}


// ============================================================
// Knife
// ============================================================

export class KnifeWeapon extends Weapon {

    constructor(
        weaponId = "knife",
        options = {}
    ) {

        super(
            weaponId,
            options
        );

        this.clipAmmo =
            Infinity;

        this.reserveAmmo =
            Infinity;
    }


    get hasAmmo() {
        return true;
    }


    get canReload() {
        return false;
    }


    reload() {
        return false;
    }


    fire({
        origin,
        direction,
        targets = [],
        currentTime =
            performance.now() /
            1000,

        secondary = false,

        friendlyFire = false,

        raycaster = null
    } = {}) {

        if (
            currentTime <
            this.nextFireTime
        ) {

            return {
                fired: false
            };
        }


        const caster =
            raycaster ||
            new THREE.Raycaster();


        caster.set(
            origin,
            direction
        );


        caster.far =
            this.config.range ??
            2.1;


        const hits =
            caster.intersectObjects(
                targets,
                true
            );


        const damage =
            secondary
                ? (
                    this.config
                        .heavyDamage ??
                    90
                )
                : (
                    this.config
                        .damage ??
                    55
                );


        this.nextFireTime =
            currentTime +
            (
                this.config.fireRate ??
                0.45
            );


        gameEvents.emit(
            GAME_EVENT.WEAPON_FIRE,
            {
                owner:
                    this.owner,

                weapon:
                    this,

                weaponId:
                    this.id,

                melee:
                    true
            }
        );


        for (
            const hit
            of hits
        ) {

            const entity =
                findEntityOwner(
                    hit.object
                );


            if (!entity) {
                continue;
            }


            if (
                entity ===
                this.owner
            ) {
                continue;
            }


            if (
                isFriendly(
                    this.owner,
                    entity
                ) &&
                !friendlyFire
            ) {

                return {
                    fired: true,
                    hit: true,
                    friendly: true
                };
            }


            let result = null;


            if (
                typeof entity.takeDamage ===
                "function"
            ) {

                result =
                    entity.takeDamage({
                        amount:
                            damage,

                        armorPenetration:
                            1,

                        attacker:
                            this.owner,

                        weapon:
                            this,

                        hitZone:
                            HIT_ZONE.GENERIC,

                        point:
                            hit.point.clone()
                    });
            }


            const killed =
                Boolean(
                    result?.killed ||
                    result?.dead
                );


            gameEvents.emit(
                "weapon:hit",
                {
                    attacker:
                        this.owner,

                    target:
                        entity,

                    weapon:
                        this,

                    damage:
                        result?.damage ??
                        damage,

                    kill:
                        killed,

                    melee:
                        true,

                    point:
                        hit.point.clone()
                }
            );


            return {
                fired: true,

                hit: true,

                target:
                    entity,

                damage:
                    result?.damage ??
                    damage,

                killed
            };
        }


        return {
            fired: true,
            hit: false
        };
    }
}


// ============================================================
// Weapon Factory
// ============================================================

export function createWeapon(
    weaponId,
    options = {}
) {

    const config =
        getWeaponConfig(
            weaponId
        );


    if (
        config.type ===
        WEAPON_TYPE.KNIFE
    ) {

        return new KnifeWeapon(
            weaponId,
            options
        );
    }


    return new Weapon(
        weaponId,
        options
    );
}


// ============================================================
// WeaponInventory
//
// 玩家与 BOT 都可以使用。
// ============================================================

export class WeaponInventory {

    constructor({
        owner = null
    } = {}) {

        this.owner =
            owner;


        this.weapons =
            new Map();


        this.slots = {
            [WEAPON_SLOT.PRIMARY]:
                null,

            [WEAPON_SLOT.SECONDARY]:
                null,

            [WEAPON_SLOT.KNIFE]:
                null
        };


        this.currentWeaponId =
            null;

        this.lastWeaponId =
            null;
    }


    // ========================================================
    // Add
    // ========================================================

    addWeapon(
        weaponId,
        {
            equip = false,
            refill = true
        } = {}
    ) {

        const config =
            getWeaponConfig(
                weaponId
            );


        // ----------------------------------------------------
        // 已经拥有
        // ----------------------------------------------------

        if (
            this.weapons.has(
                weaponId
            )
        ) {

            const weapon =
                this.weapons.get(
                    weaponId
                );


            if (refill) {
                weapon.refillAmmo();
            }


            if (equip) {
                this.equip(
                    weaponId
                );
            }


            return weapon;
        }


        // ----------------------------------------------------
        // 如果槽位有旧枪
        // ----------------------------------------------------

        const oldWeaponId =
            this.slots[
                config.slot
            ];


        if (oldWeaponId) {

            this.removeWeapon(
                oldWeaponId
            );
        }


        const weapon =
            createWeapon(
                weaponId,
                {
                    owner:
                        this.owner
                }
            );


        this.weapons.set(
            weaponId,
            weapon
        );


        this.slots[
            config.slot
        ] =
            weaponId;


        gameEvents.emit(
            "weapon:pickup",
            {
                owner:
                    this.owner,

                weapon,

                weaponId
            }
        );


        if (
            equip ||
            !this.currentWeaponId
        ) {

            this.equip(
                weaponId
            );
        }


        return weapon;
    }


    // ========================================================
    // Remove
    // ========================================================

    removeWeapon(
        weaponId
    ) {

        const weapon =
            this.weapons.get(
                weaponId
            );


        if (!weapon) {
            return null;
        }


        weapon.cancelReload();


        this.weapons.delete(
            weaponId
        );


        if (
            this.slots[
                weapon.slot
            ] ===
            weaponId
        ) {

            this.slots[
                weapon.slot
            ] =
                null;
        }


        if (
            this.currentWeaponId ===
            weaponId
        ) {

            this.currentWeaponId =
                null;
        }


        if (
            this.lastWeaponId ===
            weaponId
        ) {

            this.lastWeaponId =
                null;
        }


        gameEvents.emit(
            "weapon:drop",
            {
                owner:
                    this.owner,

                weapon,

                weaponId
            }
        );


        return weapon;
    }


    // ========================================================
    // Equip
    // ========================================================

    equip(
        weaponId
    ) {

        const weapon =
            this.weapons.get(
                weaponId
            );


        if (!weapon) {
            return false;
        }


        if (
            this.currentWeaponId ===
            weaponId
        ) {

            return true;
        }


        const previous =
            this.currentWeapon;


        if (previous) {

            previous.releaseTrigger();

            previous.cancelReload();

            this.lastWeaponId =
                previous.id;
        }


        this.currentWeaponId =
            weaponId;


        gameEvents.emit(
            "weapon:equip",
            {
                owner:
                    this.owner,

                weapon,

                previousWeapon:
                    previous
            }
        );


        weapon._emitAmmoChanged();


        return true;
    }


    // ========================================================
    // Slot
    // ========================================================

    equipSlot(slot) {

        const weaponId =
            this.slots[
                slot
            ];


        if (!weaponId) {
            return false;
        }


        return this.equip(
            weaponId
        );
    }


    equipPrimary() {

        return this.equipSlot(
            WEAPON_SLOT.PRIMARY
        );
    }


    equipSecondary() {

        return this.equipSlot(
            WEAPON_SLOT.SECONDARY
        );
    }


    equipKnife() {

        return this.equipSlot(
            WEAPON_SLOT.KNIFE
        );
    }


    // ========================================================
    // Q 切上一把
    // ========================================================

    switchLastWeapon() {

        if (
            !this.lastWeaponId
        ) {
            return false;
        }


        const target =
            this.lastWeaponId;


        return this.equip(
            target
        );
    }


    // ========================================================
    // Reload
    // ========================================================

    reload() {

        if (!this.currentWeapon) {
            return false;
        }


        return this.currentWeapon
            .reload();
    }


    // ========================================================
    // Trigger
    // ========================================================

    pressTrigger() {

        this.currentWeapon
            ?.pressTrigger();
    }


    releaseTrigger() {

        this.currentWeapon
            ?.releaseTrigger();
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        for (
            const weapon
            of this.weapons.values()
        ) {

            weapon.update(
                delta
            );
        }
    }


    // ========================================================
    // Getters
    // ========================================================

    get currentWeapon() {

        if (
            !this.currentWeaponId
        ) {
            return null;
        }


        return (
            this.weapons.get(
                this.currentWeaponId
            ) ||
            null
        );
    }


    get primaryWeapon() {

        const id =
            this.slots[
                WEAPON_SLOT.PRIMARY
            ];


        return (
            id
                ? this.weapons.get(id)
                : null
        );
    }


    get secondaryWeapon() {

        const id =
            this.slots[
                WEAPON_SLOT.SECONDARY
            ];


        return (
            id
                ? this.weapons.get(id)
                : null
        );
    }


    get knife() {

        const id =
            this.slots[
                WEAPON_SLOT.KNIFE
            ];


        return (
            id
                ? this.weapons.get(id)
                : null
        );
    }


    hasWeapon(
        weaponId
    ) {

        return this.weapons.has(
            weaponId
        );
    }


    getWeapon(
        weaponId
    ) {

        return (
            this.weapons.get(
                weaponId
            ) ||
            null
        );
    }


    // ========================================================
    // Owner
    // ========================================================

    setOwner(owner) {

        this.owner =
            owner;


        for (
            const weapon
            of this.weapons.values()
        ) {

            weapon.setOwner(
                owner
            );
        }
    }


    // ========================================================
    // Round Reset
    // ========================================================

    resetAmmo() {

        for (
            const weapon
            of this.weapons.values()
        ) {

            weapon.refillAmmo();
        }
    }


    clear({
        keepKnife = true
    } = {}) {

        const ids =
            [
                ...this.weapons.keys()
            ];


        for (
            const id
            of ids
        ) {

            const weapon =
                this.weapons.get(id);


            if (
                keepKnife &&
                weapon?.slot ===
                WEAPON_SLOT.KNIFE
            ) {

                continue;
            }


            this.removeWeapon(
                id
            );
        }


        if (
            keepKnife &&
            this.knife
        ) {

            this.equipKnife();
        }
    }


    // ========================================================
    // 战绩继承辅助
    //
    // Round.js 可以保存装备状态。
    // ========================================================

    serialize() {

        const weaponData = [];


        for (
            const weapon
            of this.weapons.values()
        ) {

            weaponData.push({
                id:
                    weapon.id,

                clipAmmo:
                    weapon.clipAmmo,

                reserveAmmo:
                    weapon.reserveAmmo
            });
        }


        return {
            currentWeaponId:
                this.currentWeaponId,

            lastWeaponId:
                this.lastWeaponId,

            weapons:
                weaponData
        };
    }


    restore(data) {

        if (
            !data ||
            !Array.isArray(
                data.weapons
            )
        ) {
            return;
        }


        this.clear({
            keepKnife:
                false
        });


        for (
            const item
            of data.weapons
        ) {

            if (
                !WEAPON_CONFIG[
                    item.id
                ]
            ) {
                continue;
            }


            const weapon =
                this.addWeapon(
                    item.id
                );


            weapon.setAmmo(
                item.clipAmmo,
                item.reserveAmmo
            );
        }


        if (
            data.currentWeaponId &&
            this.hasWeapon(
                data.currentWeaponId
            )
        ) {

            this.equip(
                data.currentWeaponId
            );
        }


        this.lastWeaponId =
            data.lastWeaponId &&
            this.hasWeapon(
                data.lastWeaponId
            )
                ? data.lastWeaponId
                : null;
    }
}


// ============================================================
// WeaponSystem
//
// 主要负责共享 Raycaster 与 Target Registry。
// ============================================================

export class WeaponSystem {

    constructor() {

        this.raycaster =
            new THREE.Raycaster();


        /*
         * 可被枪械射线检测的对象。
         *
         * map.js：
         * registerTarget(wall)
         *
         * bot.js：
         * registerTarget(bot.group)
         */
        this.targets =
            new Set();


        this.friendlyFire =
            false;
    }


    // ========================================================
    // Target Registry
    // ========================================================

    registerTarget(object) {

        if (!object) {
            return;
        }


        this.targets.add(
            object
        );
    }


    unregisterTarget(object) {

        this.targets.delete(
            object
        );
    }


    clearTargets() {

        this.targets.clear();
    }


    getTargets() {

        return [
            ...this.targets
        ];
    }


    // ========================================================
    // Fire
    // ========================================================

    fire(
        weapon,
        {
            origin,
            direction,

            movementFactor = 0,

            crouching = false,

            crouchAccuracyMultiplier = 0.70,

            airborne = false,

            scopeLevel = null,

            currentTime =
                performance.now() /
                1000
        } = {}
    ) {

        if (!weapon) {

            return {
                fired: false
            };
        }


        return weapon.fire({
            origin,
            direction,

            targets:
                this.getTargets(),

            movementFactor,

            crouching,

            crouchAccuracyMultiplier,

            airborne,

            scopeLevel,

            friendlyFire:
                this.friendlyFire,

            currentTime,

            raycaster:
                this.raycaster
        });
    }


    // ========================================================
    // Friendly Fire
    // ========================================================

    setFriendlyFire(
        enabled
    ) {

        this.friendlyFire =
            Boolean(enabled);
    }
}


// ============================================================
// 全局 Weapon System
// ============================================================

export const weaponSystem =
    new WeaponSystem();


// ============================================================
// 默认导出
// ============================================================

export default weaponSystem;