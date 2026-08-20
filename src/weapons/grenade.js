/**
 * Web-CS15
 * src/weapons/grenade.js
 *
 * 手雷系统
 *
 * 支持：
 * - HE Grenade
 * - Flashbang
 * - Smoke Grenade
 * - 玩家/BOT 共用
 * - 物理飞行
 * - 碰撞反弹
 * - 引信
 * - HE 范围伤害
 * - Flash 致盲事件
 * - Smoke 烟雾事件
 * - 自动发送 grenade:throw / grenade:explode 事件
 *
 * 不负责：
 * - Radio 文本/语音具体实现
 * - HUD
 * - 经济扣款
 */

import * as THREE from "three";

import {
    GRENADE_CONFIG,
    GAME_EVENT
} from "../core/config.js";

import {
    clamp,
    nextID,
    gameEvents
} from "../core/utils.js";


// ============================================================
// Grenade Type
// ============================================================

export const GRENADE_TYPE = Object.freeze({
    HE: "he",
    FLASH: "flash",
    SMOKE: "smoke"
});


// ============================================================
// 基础工具
// ============================================================

function getGrenadeConfig(type) {

    const config =
        GRENADE_CONFIG[type];

    if (!config) {

        throw new Error(
            `[Grenade] Unknown grenade type: ${type}`
        );
    }

    return config;
}


/**
 * 从 Object3D 向父级寻找 owner
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


// ============================================================
// Grenade
// ============================================================

export class Grenade {

    constructor(
        type,
        {
            owner = null,
            scene = null,
            collisionObjects = [],
            entityObjects = []
        } = {}
    ) {

        this.id =
            nextID("grenade");

        this.type =
            type;

        this.config =
            getGrenadeConfig(type);

        this.owner =
            owner;

        this.scene =
            scene;

        this.collisionObjects =
            collisionObjects;

        this.entityObjects =
            entityObjects;


        // ----------------------------------------------------
        // 状态
        // ----------------------------------------------------

        this.active =
            false;

        this.exploded =
            false;

        this.age =
            0;

        this.fuseTime =
            this.config.fuseTime ??
            2;

        this.velocity =
            new THREE.Vector3();

        this.lastPosition =
            new THREE.Vector3();

        this.raycaster =
            new THREE.Raycaster();


        // ----------------------------------------------------
        // Mesh
        // ----------------------------------------------------

        this.mesh =
            this._createMesh();
    }


    // ========================================================
    // Mesh
    // ========================================================

    _createMesh() {

        let color =
            0x2e8b57;

        if (
            this.type ===
            GRENADE_TYPE.FLASH
        ) {
            color = 0xcccccc;
        }

        if (
            this.type ===
            GRENADE_TYPE.SMOKE
        ) {
            color = 0x667766;
        }


        const geometry =
            new THREE.SphereGeometry(
                0.18,
                12,
                12
            );


        const material =
            new THREE.MeshStandardMaterial({
                color,
                metalness: 0.45,
                roughness: 0.55
            });


        const mesh =
            new THREE.Mesh(
                geometry,
                material
            );


        mesh.castShadow =
            true;

        mesh.receiveShadow =
            true;

        mesh.userData.grenade =
            this;


        return mesh;
    }


    // ========================================================
    // Throw
    // ========================================================

    throw({
        origin,
        direction,
        strength = 1
    } = {}) {

        if (
            this.active ||
            this.exploded
        ) {
            return false;
        }


        if (
            !origin ||
            !direction
        ) {

            console.warn(
                "[Grenade] throw() requires origin and direction."
            );

            return false;
        }


        const throwSpeed =
            this.config.throwSpeed ??
            22;


        const verticalBoost =
            this.config.verticalBoost ??
            6;


        strength =
            clamp(
                strength,
                0.15,
                1
            );


        const dir =
            direction
                .clone()
                .normalize();


        this.mesh.position
            .copy(origin)
            .add(
                dir
                    .clone()
                    .multiplyScalar(
                        0.8
                    )
            );


        this.velocity
            .copy(dir)
            .multiplyScalar(
                throwSpeed *
                strength
            );


        this.velocity.y +=
            verticalBoost *
            strength;


        this.lastPosition.copy(
            this.mesh.position
        );


        if (
            this.scene &&
            !this.mesh.parent
        ) {

            this.scene.add(
                this.mesh
            );
        }


        this.active =
            true;

        this.age =
            0;


        // ----------------------------------------------------
        // 自动通知 Radio 系统
        // ----------------------------------------------------

        gameEvents.emit(
            GAME_EVENT.GRENADE_THROW,
            {
                grenade:
                    this,

                grenadeId:
                    this.id,

                type:
                    this.type,

                owner:
                    this.owner,

                position:
                    this.mesh.position.clone(),

                radioCallout:
                    this.config.radioCallout ||
                    "Fire in the hole!"
            }
        );


        return true;
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (
            !this.active ||
            this.exploded
        ) {
            return;
        }


        this.age += delta;


        // ----------------------------------------------------
        // Physics
        // ----------------------------------------------------

        const gravity =
            this.config.gravity ??
            16;


        this.velocity.y -=
            gravity *
            delta;


        this.lastPosition.copy(
            this.mesh.position
        );


        const movement =
            this.velocity
                .clone()
                .multiplyScalar(
                    delta
                );


        const distance =
            movement.length();


        if (
            distance > 0.0001
        ) {

            const direction =
                movement
                    .clone()
                    .normalize();


            this.raycaster.set(
                this.mesh.position,
                direction
            );


            this.raycaster.far =
                distance +
                0.25;


            const hits =
                this.raycaster
                    .intersectObjects(
                        this.collisionObjects,
                        true
                    );


            if (
                hits.length > 0
            ) {

                this._handleCollision(
                    hits[0],
                    delta
                );

            } else {

                this.mesh.position.add(
                    movement
                );
            }
        }


        // ----------------------------------------------------
        // 简单旋转
        // ----------------------------------------------------

        this.mesh.rotation.x +=
            delta * 8;

        this.mesh.rotation.z +=
            delta * 5;


        // ----------------------------------------------------
        // Fuse
        // ----------------------------------------------------

        if (
            this.age >=
            this.fuseTime
        ) {

            this.explode();
        }
    }


    // ========================================================
    // Collision
    // ========================================================

    _handleCollision(
        hit,
        delta
    ) {

        const normal =
            this._getWorldNormal(
                hit
            );


        if (!normal) {

            this.mesh.position.copy(
                this.lastPosition
            );

            return;
        }


        this.mesh.position
            .copy(hit.point)
            .add(
                normal
                    .clone()
                    .multiplyScalar(
                        0.2
                    )
            );


        // ----------------------------------------------------
        // Reflection
        // ----------------------------------------------------

        const reflected =
            this.velocity
                .clone()
                .reflect(
                    normal
                );


        const bounce =
            this.config.bounce ??
            0.45;


        this.velocity
            .copy(reflected)
            .multiplyScalar(
                bounce
            );


        // ----------------------------------------------------
        // 地面碰撞降低水平速度
        // ----------------------------------------------------

        if (
            normal.y > 0.6
        ) {

            this.velocity.x *=
                0.78;

            this.velocity.z *=
                0.78;


            if (
                Math.abs(
                    this.velocity.y
                ) < 1.5
            ) {

                this.velocity.y =
                    0;
            }
        }


        // ----------------------------------------------------
        // 防止无限微小弹跳
        // ----------------------------------------------------

        if (
            this.velocity.lengthSq() <
            0.08
        ) {

            this.velocity.set(
                0,
                0,
                0
            );
        }
    }


    _getWorldNormal(hit) {

        if (
            !hit?.face?.normal
        ) {
            return null;
        }


        const normal =
            hit.face.normal
                .clone();


        if (
            hit.object &&
            hit.object.matrixWorld
        ) {

            const normalMatrix =
                new THREE.Matrix3()
                    .getNormalMatrix(
                        hit.object
                            .matrixWorld
                    );


            normal.applyMatrix3(
                normalMatrix
            );
        }


        return normal.normalize();
    }


    // ========================================================
    // Explode
    // ========================================================

    explode() {

        if (
            this.exploded
        ) {
            return;
        }


        this.exploded =
            true;

        this.active =
            false;


        const position =
            this.mesh.position
                .clone();


        // ----------------------------------------------------
        // 类型逻辑
        // ----------------------------------------------------

        switch (this.type) {

            case GRENADE_TYPE.HE:

                this._explodeHE(
                    position
                );

                break;


            case GRENADE_TYPE.FLASH:

                this._explodeFlash(
                    position
                );

                break;


            case GRENADE_TYPE.SMOKE:

                this._explodeSmoke(
                    position
                );

                break;
        }


        // ----------------------------------------------------
        // 通用 explosion event
        // ----------------------------------------------------

        gameEvents.emit(
            GAME_EVENT.GRENADE_EXPLODE,
            {
                grenade:
                    this,

                grenadeId:
                    this.id,

                type:
                    this.type,

                owner:
                    this.owner,

                position,

                visualRadius:
                    this.type ===
                    GRENADE_TYPE.HE
                        ? 3.5
                        : 2
            }
        );


        this.destroy();
    }


    // ========================================================
    // HE
    // ========================================================

    _explodeHE(
        position
    ) {

        const radius =
            this.config.radius ??
            12;


        const maxDamage =
            this.config.maxDamage ??
            100;


        const entities =
            this._collectEntities();


        for (
            const entity
            of entities
        ) {

            if (
                !entity ||
                entity.isAlive === false
            ) {
                continue;
            }


            const entityPosition =
                this._getEntityPosition(
                    entity
                );


            if (!entityPosition) {
                continue;
            }


            const distance =
                entityPosition
                    .distanceTo(
                        position
                    );


            if (
                distance >
                radius
            ) {
                continue;
            }


            // ------------------------------------------------
            // 伤害随距离衰减
            // ------------------------------------------------

            const normalized =
                clamp(
                    1 -
                    distance /
                    radius,
                    0,
                    1
                );


            let damage =
                maxDamage *
                normalized;


            // ------------------------------------------------
            // 玩家自己受伤限制
            // ------------------------------------------------

            if (
                entity ===
                this.owner &&
                this.config.playerSelfDamage != null
            ) {

                damage =
                    Math.min(
                        damage,
                        this.config
                            .playerSelfDamage
                    );
            }


            damage =
                Math.max(
                    0,
                    damage
                );


            if (
                damage <= 0
            ) {
                continue;
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
                            0.5,

                        attacker:
                            this.owner,

                        grenade:
                            this,

                        weapon:
                            null,

                        hitZone:
                            "generic",

                        point:
                            position.clone()
                    });
            }


            const killed =
                Boolean(
                    result?.killed ||
                    result?.dead
                );


            gameEvents.emit(
                "grenade:damage",
                {
                    grenade:
                        this,

                    owner:
                        this.owner,

                    target:
                        entity,

                    damage:
                        result?.damage ??
                        damage,

                    killed,

                    distance,

                    position:
                        position.clone()
                }
            );


            if (killed) {

                gameEvents.emit(
                    "grenade:kill",
                    {
                        grenade:
                            this,

                        owner:
                            this.owner,

                        target:
                            entity,

                        type:
                            this.type
                    }
                );
            }
        }
    }


    // ========================================================
    // Flash V1 Helpers
    // ========================================================

    _getEntityEyePosition(
        entity
    ) {

        if (!entity) {
            return null;
        }


        if (
            typeof entity.getEyePosition ===
            "function"
        ) {

            const eye =
                entity.getEyePosition();


            if (
                eye?.isVector3
            ) {

                return eye.clone();
            }
        }


        const position =
            this._getEntityPosition(
                entity
            );


        if (!position) {
            return null;
        }


        position.y +=
            1.35;


        return position;
    }


    _getEntityViewDirection(
        entity
    ) {

        if (!entity) {
            return null;
        }


        let direction =
            null;


        if (
            typeof entity.getViewDirection ===
            "function"
        ) {

            direction =
                entity.getViewDirection();

        } else if (
            typeof entity.getAimDirection ===
            "function"
        ) {

            direction =
                entity.getAimDirection();

        } else if (
            typeof entity.getForwardDirection ===
            "function"
        ) {

            direction =
                entity.getForwardDirection();
        }


        if (
            !direction?.isVector3 ||
            direction.lengthSq() <
                0.0001
        ) {

            return null;
        }


        return direction
            .clone()
            .normalize();
    }


    _hasFlashLineOfSight(
        flashPosition,
        entityEyePosition
    ) {

        if (
            !flashPosition ||
            !entityEyePosition
        ) {

            return false;
        }


        if (
            !this.collisionObjects ||
            this.collisionObjects.length ===
                0
        ) {

            return true;
        }


        const direction =
            entityEyePosition
                .clone()
                .sub(
                    flashPosition
                );


        const distance =
            direction.length();


        if (
            distance <=
            0.05
        ) {

            return true;
        }


        direction.normalize();


        this.raycaster.set(
            flashPosition,
            direction
        );


        this.raycaster.near =
            0.05;


        /*
         * 稍微缩短射线，避免目标紧贴墙时
         * 把目标后面的墙误判成遮挡。
         */
        this.raycaster.far =
            Math.max(
                0.05,
                distance -
                    0.20
            );


        const hits =
            this.raycaster
                .intersectObjects(
                    this.collisionObjects,
                    true
                );


        return (
            hits.length ===
            0
        );
    }


    _getFlashFacingFactor(
        entity,
        entityEyePosition,
        flashPosition
    ) {

        const viewDirection =
            this._getEntityViewDirection(
                entity
            );


        if (!viewDirection) {

            /*
             * 没有朝向信息时不让 Flash 完全失效。
             */
            return {
                dot: 0,
                factor: 0.55
            };
        }


        const toFlash =
            flashPosition
                .clone()
                .sub(
                    entityEyePosition
                );


        if (
            toFlash.lengthSq() <
            0.0001
        ) {

            return {
                dot: 1,
                factor: 1
            };
        }


        toFlash.normalize();


        const dot =
            clamp(
                viewDirection.dot(
                    toFlash
                ),
                -1,
                1
            );


        /*
         * 正对 Flash：接近 100%
         * 侧面：约 55%
         * 完全背对：仍保留约 22% 的短暂闪白
         */
        const normalizedFacing =
            clamp(
                (
                    dot +
                    0.35
                ) /
                1.35,
                0,
                1
            );


        const factor =
            0.22 +
            normalizedFacing *
                0.78;


        return {
            dot,
            factor
        };
    }


    // ========================================================
    // Flash
    // ========================================================

    _explodeFlash(
        position
    ) {

        const radius =
            this.config.radius ??
            18;


        const maxBlindTime =
            this.config.maxBlindTime ??
            4.5;


        const entities =
            this._collectEntities();


        for (
            const entity
            of entities
        ) {

            if (
                !entity ||
                entity.isAlive ===
                    false
            ) {

                continue;
            }


            const eyePosition =
                this._getEntityEyePosition(
                    entity
                );


            if (!eyePosition) {
                continue;
            }


            const distance =
                eyePosition
                    .distanceTo(
                        position
                    );


            if (
                distance >
                radius
            ) {

                continue;
            }


            // ------------------------------------------------
            // Wall / obstacle occlusion
            // ------------------------------------------------

            const visible =
                this._hasFlashLineOfSight(
                    position,
                    eyePosition
                );


            if (!visible) {

                gameEvents.emit(
                    "grenade:flash-blocked",
                    {
                        grenade:
                            this,

                        owner:
                            this.owner,

                        target:
                            entity,

                        position:
                            position.clone(),

                        distance
                    }
                );


                continue;
            }


            // ------------------------------------------------
            // Distance falloff
            // ------------------------------------------------

            const distanceStrength =
                clamp(
                    1 -
                    distance /
                        radius,
                    0,
                    1
                );


            if (
                distanceStrength <=
                0
            ) {

                continue;
            }


            // ------------------------------------------------
            // Facing
            // ------------------------------------------------

            const facing =
                this._getFlashFacingFactor(
                    entity,
                    eyePosition,
                    position
                );


            const strength =
                clamp(
                    distanceStrength *
                    facing.factor,
                    0,
                    1
                );


            /*
             * 视觉强度和致盲时间不完全线性：
             * 中等强度的 Flash 仍然应该有短暂影响。
             */
            const blindTime =
                maxBlindTime *
                Math.pow(
                    strength,
                    0.78
                );


            if (
                blindTime <
                0.10
            ) {

                continue;
            }


            gameEvents.emit(
                "grenade:flash",
                {
                    grenade:
                        this,

                    owner:
                        this.owner,

                    target:
                        entity,

                    position:
                        position.clone(),

                    distance,

                    distanceStrength,

                    facingDot:
                        facing.dot,

                    facingFactor:
                        facing.factor,

                    occluded:
                        false,

                    strength,

                    duration:
                        blindTime
                }
            );
        }
    }


    // ========================================================
    // Smoke
    // ========================================================

    _explodeSmoke(
        position
    ) {

        const radius =
            this.config.radius ??
            8;


        const duration =
            this.config.smokeDuration ??
            15;


        const buildTime =
            1.0;


        const fadeTime =
            2.0;


        gameEvents.emit(
            "grenade:smoke",
            {
                grenade:
                    this,

                owner:
                    this.owner,

                position:
                    position.clone(),

                radius,

                duration,

                buildTime,

                fadeTime
            }
        );


        /*
         * Grenade 会在 explode() 后立即销毁，
         * 所以持续存在的烟雾逻辑区交给 grenadeSystem 管理。
         */
        grenadeSystem.createSmokeZone({
            position:
                position.clone(),

            radius,

            duration,

            buildTime,

            fadeTime,

            owner:
                this.owner
        });
    }


    // ========================================================
    // Entities
    // ========================================================

    _collectEntities() {

        const entities =
            new Set();


        for (
            const object
            of this.entityObjects
        ) {

            if (!object) {
                continue;
            }


            const owner =
                findEntityOwner(
                    object
                );


            if (owner) {

                entities.add(
                    owner
                );
            }
        }


        /*
         * 某些情况下 entityObjects
         * 可能直接传 Player/Bot，
         * 而不是 Object3D。
         */
        for (
            const object
            of this.entityObjects
        ) {

            if (
                object &&
                !object.isObject3D &&
                (
                    object.position ||
                    object.group ||
                    object.getPosition
                )
            ) {

                entities.add(
                    object
                );
            }
        }


        return [
            ...entities
        ];
    }


    _getEntityPosition(
        entity
    ) {

        if (!entity) {
            return null;
        }


        if (
            typeof entity.getPosition ===
            "function"
        ) {

            const pos =
                entity.getPosition();

            if (
                pos?.isVector3
            ) {

                return pos.clone();
            }
        }


        if (
            entity.position?.isVector3
        ) {

            return entity.position.clone();
        }


        if (
            entity.group
                ?.position
                ?.isVector3
        ) {

            return entity.group
                .position
                .clone();
        }


        if (
            entity.object3D
                ?.position
                ?.isVector3
        ) {

            return entity.object3D
                .position
                .clone();
        }


        return null;
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        if (
            this.mesh?.parent
        ) {

            this.mesh.parent.remove(
                this.mesh
            );
        }


        this.mesh?.geometry
            ?.dispose?.();


        if (
            Array.isArray(
                this.mesh?.material
            )
        ) {

            this.mesh.material.forEach(
                material =>
                    material.dispose?.()
            );

        } else {

            this.mesh?.material
                ?.dispose?.();
        }


        gameEvents.emit(
            "grenade:removed",
            {
                grenade:
                    this,

                grenadeId:
                    this.id
            }
        );
    }
}


// ============================================================
// Grenade Inventory
// ============================================================

export class GrenadeInventory {

    constructor({
        owner = null
    } = {}) {

        this.owner =
            owner;


        this.counts = {
            [GRENADE_TYPE.HE]: 0,
            [GRENADE_TYPE.FLASH]: 0,
            [GRENADE_TYPE.SMOKE]: 0
        };
    }


    // ========================================================
    // Count
    // ========================================================

    getCount(type) {

        return (
            this.counts[type] ??
            0
        );
    }


    has(type) {

        return (
            this.getCount(type) >
            0
        );
    }


    // ========================================================
    // Add
    // ========================================================

    add(
        type,
        amount = 1
    ) {

        const config =
            getGrenadeConfig(
                type
            );


        const maxCarry =
            config.maxCarry ??
            1;


        const current =
            this.getCount(
                type
            );


        const next =
            clamp(
                current +
                Math.max(
                    0,
                    Math.floor(amount)
                ),
                0,
                maxCarry
            );


        this.counts[type] =
            next;


        gameEvents.emit(
            "grenade:inventory-changed",
            {
                owner:
                    this.owner,

                type,

                count:
                    next
            }
        );


        return (
            next >
            current
        );
    }


    // ========================================================
    // Remove
    // ========================================================

    remove(
        type,
        amount = 1
    ) {

        const current =
            this.getCount(
                type
            );


        if (
            current <= 0
        ) {
            return false;
        }


        const next =
            Math.max(
                0,
                current -
                Math.max(
                    1,
                    Math.floor(amount)
                )
            );


        this.counts[type] =
            next;


        gameEvents.emit(
            "grenade:inventory-changed",
            {
                owner:
                    this.owner,

                type,

                count:
                    next
            }
        );


        return true;
    }


    // ========================================================
    // Reset
    // ========================================================

    clear() {

        this.counts[
            GRENADE_TYPE.HE
        ] = 0;

        this.counts[
            GRENADE_TYPE.FLASH
        ] = 0;

        this.counts[
            GRENADE_TYPE.SMOKE
        ] = 0;


        gameEvents.emit(
            "grenade:inventory-reset",
            {
                owner:
                    this.owner
            }
        );
    }


    // ========================================================
    // Serialize
    // ========================================================

    serialize() {

        return {
            ...this.counts
        };
    }


    restore(data) {

        if (!data) {
            return;
        }


        for (
            const type
            of Object.values(
                GRENADE_TYPE
            )
        ) {

            const config =
                getGrenadeConfig(
                    type
                );


            this.counts[type] =
                clamp(
                    Number(
                        data[type] ??
                        0
                    ),
                    0,
                    config.maxCarry ??
                    1
                );
        }
    }
}


// ============================================================
// GrenadeSystem
// ============================================================

export class GrenadeSystem {

    constructor() {

        this.scene = null;

        this.activeGrenades = [];

        this.collisionObjects =
            new Set();

        this.entityObjects =
            new Set();


        // Smoke Grenade V1
        this.smokeZones = [];

        this.smokeZoneId = 0;
    }


    // ========================================================
    // Init
    // ========================================================

    init({
        scene
    } = {}) {

        if (!scene) {

            throw new Error(
                "[GrenadeSystem] scene is required."
            );
        }


        this.scene =
            scene;


        return this;
    }


    // ========================================================
    // Collision Registry
    // ========================================================

    registerCollisionObject(
        object
    ) {

        if (!object) {
            return;
        }


        this.collisionObjects.add(
            object
        );
    }


    unregisterCollisionObject(
        object
    ) {

        this.collisionObjects.delete(
            object
        );
    }


    // ========================================================
    // Entity Registry
    // ========================================================

    registerEntityObject(
        object
    ) {

        if (!object) {
            return;
        }


        this.entityObjects.add(
            object
        );
    }


    unregisterEntityObject(
        object
    ) {

        this.entityObjects.delete(
            object
        );
    }


    // ========================================================
    // Throw
    // ========================================================

    throwGrenade({
        type,
        owner,
        origin,
        direction,
        strength = 1
    } = {}) {

        if (!this.scene) {

            console.warn(
                "[GrenadeSystem] Not initialized."
            );

            return null;
        }


        const grenade =
            new Grenade(
                type,
                {
                    owner,

                    scene:
                        this.scene,

                    collisionObjects:
                        [
                            ...this
                                .collisionObjects
                        ],

                    entityObjects:
                        [
                            ...this
                                .entityObjects
                        ]
                }
            );


        const success =
            grenade.throw({
                origin,
                direction,
                strength
            });


        if (!success) {

            grenade.destroy();

            return null;
        }


        this.activeGrenades.push(
            grenade
        );


        return grenade;
    }


    // ========================================================
    // 使用库存投雷
    // ========================================================

    throwFromInventory({
        inventory,
        type,
        owner,
        origin,
        direction,
        strength = 1
    } = {}) {

        if (!inventory) {
            return null;
        }


        if (
            !inventory.has(type)
        ) {

            return null;
        }


        const grenade =
            this.throwGrenade({
                type,
                owner,
                origin,
                direction,
                strength
            });


        if (!grenade) {

            return null;
        }


        inventory.remove(
            type,
            1
        );


        return grenade;
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        this.updateSmokeZones(
            delta
        );


        for (
            let i =
                this.activeGrenades.length - 1;
            i >= 0;
            i--
        ) {

            const grenade =
                this.activeGrenades[i];


            grenade.update(
                delta
            );


            if (
                grenade.exploded
            ) {

                this.activeGrenades.splice(
                    i,
                    1
                );
            }
        }
    }



    // ========================================================
    // Smoke Zone V1
    // ========================================================

    createSmokeZone({
        position,
        radius = 8,
        duration = 15,
        buildTime = 1.0,
        fadeTime = 2.0,
        owner = null
    } = {}) {

        if (
            !position?.isVector3
        ) {

            return null;
        }


        const zone = {
            id:
                `smoke_${++this.smokeZoneId}`,

            position:
                position.clone(),

            radius:
                Math.max(
                    0.5,
                    Number(radius) || 8
                ),

            duration:
                Math.max(
                    0.5,
                    Number(duration) || 15
                ),

            buildTime:
                Math.max(
                    0.05,
                    Number(buildTime) || 1.0
                ),

            fadeTime:
                Math.max(
                    0.1,
                    Number(fadeTime) || 2.0
                ),

            age:
                0,

            density:
                0,

            owner
        };


        this.smokeZones.push(
            zone
        );


        return zone;
    }


    updateSmokeZones(
        delta
    ) {

        for (
            let i =
                this.smokeZones.length - 1;
            i >= 0;
            i--
        ) {

            const zone =
                this.smokeZones[i];


            zone.age +=
                delta;


            const build =
                clamp(
                    zone.age /
                        zone.buildTime,
                    0,
                    1
                );


            const fadeStart =
                Math.max(
                    zone.buildTime,
                    zone.duration -
                        zone.fadeTime
                );


            let fade =
                1;


            if (
                zone.age >
                fadeStart
            ) {

                fade =
                    1 -
                    clamp(
                        (
                            zone.age -
                                fadeStart
                        ) /
                        Math.max(
                            0.001,
                            zone.duration -
                                fadeStart
                        ),
                        0,
                        1
                    );
            }


            zone.density =
                clamp(
                    build *
                        fade,
                    0,
                    1
                );


            if (
                zone.age >=
                zone.duration
            ) {

                this.smokeZones.splice(
                    i,
                    1
                );
            }
        }
    }


    clearSmokeZones() {

        this.smokeZones.length =
            0;
    }


    _getSegmentSphereIntersectionLength(
        start,
        end,
        center,
        radius
    ) {

        const segment =
            end
                .clone()
                .sub(
                    start
                );


        const length =
            segment.length();


        if (
            length <=
            0.0001
        ) {

            return 0;
        }


        const direction =
            segment
                .clone()
                .divideScalar(
                    length
                );


        const m =
            start
                .clone()
                .sub(
                    center
                );


        const b =
            m.dot(
                direction
            );


        const c =
            m.dot(
                m
            ) -
            radius *
                radius;


        if (
            c >
                0 &&
            b >
                0
        ) {

            return 0;
        }


        const discriminant =
            b *
                b -
            c;


        if (
            discriminant <
            0
        ) {

            return 0;
        }


        const root =
            Math.sqrt(
                discriminant
            );


        const t0 =
            clamp(
                -b -
                    root,
                0,
                length
            );


        const t1 =
            clamp(
                -b +
                    root,
                0,
                length
            );


        return Math.max(
            0,
            t1 -
                t0
        );
    }


    getSmokeObscuration(
        start,
        end
    ) {

        if (
            !start?.isVector3 ||
            !end?.isVector3
        ) {

            return {
                blocked:
                    false,

                obscuration:
                    0,

                insideLength:
                    0,

                zone:
                    null
            };
        }


        let bestZone =
            null;

        let bestObscuration =
            0;

        let bestInsideLength =
            0;


        for (
            const zone
            of this.smokeZones
        ) {

            /*
             * 刚起烟 / 快散完时不当成完整烟墙。
             */
            if (
                zone.density <
                0.22
            ) {

                continue;
            }


            const effectiveRadius =
                zone.radius *
                (
                    0.72 +
                    zone.density *
                        0.28
                );


            const insideLength =
                this._getSegmentSphereIntersectionLength(
                    start,
                    end,
                    zone.position,
                    effectiveRadius
                );


            if (
                insideLength <=
                0
            ) {

                continue;
            }


            const obscuration =
                insideLength *
                zone.density;


            if (
                obscuration >
                bestObscuration
            ) {

                bestZone =
                    zone;

                bestObscuration =
                    obscuration;

                bestInsideLength =
                    insideLength;
            }
        }


        return {
            blocked:
                bestObscuration >=
                1.55,

            obscuration:
                bestObscuration,

            insideLength:
                bestInsideLength,

            zone:
                bestZone
        };
    }


    isLineBlockedBySmoke(
        start,
        end
    ) {

        return this
            .getSmokeObscuration(
                start,
                end
            )
            .blocked;
    }


    isPointInsideSmoke(
        position,
        {
            densityThreshold = 0.35,
            radiusScale = 1
        } = {}
    ) {

        if (
            !position?.isVector3
        ) {

            return false;
        }


        for (
            const zone
            of this.smokeZones
        ) {

            if (
                zone.density <
                densityThreshold
            ) {

                continue;
            }


            const effectiveRadius =
                zone.radius *
                clamp(
                    radiusScale,
                    0.25,
                    1.25
                );


            if (
                position.distanceToSquared(
                    zone.position
                ) <=
                effectiveRadius *
                    effectiveRadius
            ) {

                return true;
            }
        }


        return false;
    }


    getBlockingSmokeZone(
        start,
        end
    ) {

        const result =
            this.getSmokeObscuration(
                start,
                end
            );


        return result.blocked
            ? result.zone
            : null;
    }


    // ========================================================
    // Clear
    // ========================================================

    clearActiveGrenades() {

        for (
            const grenade
            of this.activeGrenades
        ) {

            grenade.destroy();
        }


        this.activeGrenades.length =
            0;
    }


    clearRegistries() {

        this.collisionObjects.clear();

        this.entityObjects.clear();
    }


    destroy() {

        this.clearActiveGrenades();

        this.clearSmokeZones();

        this.clearRegistries();

        this.scene = null;
    }
}


// ============================================================
// 全局单例
// ============================================================

export const grenadeSystem =
    new GrenadeSystem();


// ============================================================
// 默认导出
// ============================================================

export default grenadeSystem;