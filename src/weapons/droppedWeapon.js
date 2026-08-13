/**
 * Web-CS15
 * src/weapons/droppedWeapon.js
 *
 * Dropped Weapon & Pickup System V1.4
 *
 * Features:
 * - G drops player's PRIMARY weapon
 * - BOT death drops its PRIMARY weapon
 * - Keeps clip / reserve ammo
 * - Player auto-pickup
 * - BOT auto-pickup when it has no primary
 * - Player only auto-picks a primary when the primary slot is empty
 * - Ground weapons are cleared automatically at every new round
 * - Short owner pickup lock prevents instant re-pickup
 *
 * Integration:
 *
 * game.js:
 *
 * import {
 *     droppedWeaponSystem
 * } from "../weapons/droppedWeapon.js";
 *
 * In Game.init(), after createPlayer():
 *
 * droppedWeaponSystem.init({
 *     game: this,
 *     scene: this.scene
 * });
 */

import * as THREE from "three";

import {
    WEAPON_SLOT,
    GAME_EVENT
} from "../core/config.js";

import {
    gameEvents
} from "../core/utils.js";

import {
    createWorldWeaponModel,
    disposeWorldWeaponModel
} from "./worldWeaponView.js";


const PICKUP_RADIUS =
    1.55;

const BOT_PICKUP_RADIUS =
    1.35;

const OWNER_LOCK_SECONDS =
    0.80;

/*
 * 丢枪位置必须略远于玩家自动拾取半径，
 * 否则玩家站着不动也会在冷却结束后重新捡回。
 */
const DROP_FORWARD =
    1.25;

const DROP_HEIGHT =
    0.12;

const DROP_START_HEIGHT =
    0.62;

const GRAVITY =
    12.5;

const PICKUP_HINT_RADIUS =
    3.4;


const DROP_PROFILE = Object.freeze({
    awp: {
        forwardSpeed: 2.0,
        upSpeed: 1.65,
        spin: 4.2
    },

    scout: {
        forwardSpeed: 2.35,
        upSpeed: 1.85,
        spin: 4.9
    },

    ak47: {
        forwardSpeed: 2.45,
        upSpeed: 1.95,
        spin: 5.2
    },

    m4a1: {
        forwardSpeed: 2.55,
        upSpeed: 2.0,
        spin: 5.4
    },

    mp5: {
        forwardSpeed: 2.8,
        upSpeed: 2.15,
        spin: 6.2
    },

    default: {
        forwardSpeed: 2.5,
        upSpeed: 2.0,
        spin: 5.5
    }
});


function nowSeconds() {

    return (
        performance.now() /
        1000
    );
}


function getEntityPosition(
    entity
) {

    if (
        entity?.getPosition
    ) {

        return entity
            .getPosition();
    }


    if (
        entity?.group
            ?.position
    ) {

        return entity.group
            .position
            .clone();
    }


    return null;
}


function getEntityForward(
    entity
) {

    /*
     * Player 使用 camera.getWorldDirection()，
     * 在 player.js 里封装为 getViewDirection()。
     *
     * 必须优先使用它，否则玩家转身后仍会按照
     * 世界坐标 -Z 丢枪，看起来就像丢到了身后。
     */
    if (
        entity?.getViewDirection
    ) {

        return entity
            .getViewDirection();
    }


    /*
     * BOT 使用自身朝向。
     */
    if (
        entity?.getForwardDirection
    ) {

        return entity
            .getForwardDirection();
    }


    if (
        entity?.getAimDirection
    ) {

        return entity
            .getAimDirection();
    }


    return new THREE.Vector3(
        0,
        0,
        -1
    );
}


export class DroppedWeapon {

    constructor({
        weaponId,
        clipAmmo = 0,
        reserveAmmo = 0,
        position,
        rotationY = 0,
        droppedBy = null,
        scene = null,
        throwDirection = null
    } = {}) {

        this.weaponId =
            weaponId;

        this.clipAmmo =
            Math.max(
                0,
                Math.floor(
                    Number(
                        clipAmmo
                    ) || 0
                )
            );

        this.reserveAmmo =
            Math.max(
                0,
                Math.floor(
                    Number(
                        reserveAmmo
                    ) || 0
                )
            );


        this.droppedBy =
            droppedBy;

        this.createdAt =
            nowSeconds();

        this.ownerLockedUntil =
            this.createdAt +
            OWNER_LOCK_SECONDS;


        /*
         * 自己丢出的枪必须先离开拾取范围一次，
         * 才允许自己重新捡回。
         *
         * 这样即使玩家原地不动，也不会在计时结束后
         * 自动把刚丢出去的枪吸回来。
         */
        this.ownerHasExitedPickupRadius =
            false;


        this.scene =
            scene;


        const profile =
            DROP_PROFILE[
                weaponId
            ] ||
            DROP_PROFILE.default;


        this.groundY =
            (
                position?.y ??
                0
            ) +
            DROP_HEIGHT;


        this.velocity =
            new THREE.Vector3();


        const direction =
            throwDirection
                ?.clone?.() ||
            new THREE.Vector3(
                0,
                0,
                -1
            );


        direction.y =
            0;


        if (
            direction.lengthSq() >
            0.0001
        ) {

            direction.normalize();

        } else {

            direction.set(
                0,
                0,
                -1
            );
        }


        this.velocity
            .copy(
                direction
            )
            .multiplyScalar(
                profile.forwardSpeed
            );


        this.velocity.y =
            profile.upSpeed;


        this.angularVelocity =
            new THREE.Vector3(
                profile.spin * 0.55,
                profile.spin,
                profile.spin * 0.42
            );


        this.isResting =
            false;


        this.model =
            createWorldWeaponModel(
                weaponId
            );


        this.model.position.copy(
            position ||
            new THREE.Vector3()
        );


        this.model.position.y +=
            DROP_START_HEIGHT;


        this.model.rotation.y =
            rotationY;


        this.model.userData
            .droppedWeapon =
            this;


        this.scene?.add(
            this.model
        );
    }


    update(
        delta
    ) {

        if (
            !this.model ||
            this.isResting
        ) {

            return;
        }


        this.velocity.y -=
            GRAVITY *
            delta;


        this.model.position
            .addScaledVector(
                this.velocity,
                delta
            );


        this.model.rotation.x +=
            this.angularVelocity.x *
            delta;


        this.model.rotation.y +=
            this.angularVelocity.y *
            delta;


        this.model.rotation.z +=
            this.angularVelocity.z *
            delta;


        if (
            this.model.position.y <=
            this.groundY
        ) {

            this.model.position.y =
                this.groundY;


            /*
             * 第一版只做一次轻微落地缓冲，
             * 然后稳定停止，避免枪在地上无限弹跳。
             */
            this.model.rotation.x =
                0;


            this.model.rotation.z =
                0;


            this.velocity.set(
                0,
                0,
                0
            );


            this.angularVelocity.set(
                0,
                0,
                0
            );


            this.isResting =
                true;
        }
    }


    getPosition() {

        return this.model
            .position
            .clone();
    }


    canPickup(
        entity
    ) {

        if (
            !entity ||
            !entity.isAlive
        ) {

            return false;
        }


        if (
            entity ===
            this.droppedBy
        ) {

            if (
                nowSeconds() <
                this.ownerLockedUntil
            ) {

                return false;
            }


            if (
                !this.ownerHasExitedPickupRadius
            ) {

                const entityPosition =
                    getEntityPosition(
                        entity
                    );


                if (
                    entityPosition
                ) {

                    /*
                     * Player 的 getPosition().y 是眼睛高度，
                     * 这里仅比较水平 XZ 距离，不受高度影响。
                     */
                    const dx =
                        this.model.position.x -
                        entityPosition.x;

                    const dz =
                        this.model.position.z -
                        entityPosition.z;


                    const distance =
                        Math.hypot(
                            dx,
                            dz
                        );


                    if (
                        distance <=
                        PICKUP_RADIUS +
                        0.20
                    ) {

                        return false;
                    }


                    this.ownerHasExitedPickupRadius =
                        true;
                }
            }
        }


        return true;
    }


    destroy() {

        if (
            this.model?.parent
        ) {

            this.model.parent
                .remove(
                    this.model
                );
        }


        disposeWorldWeaponModel(
            this.model
        );


        this.model =
            null;

        this.scene =
            null;
    }
}


export class DroppedWeaponSystem {

    constructor() {

        this.game =
            null;

        this.scene =
            null;

        this.items =
            [];


        this.initialized =
            false;

        this.lastFrameTime =
            0;

        this._raf =
            null;


        this._boundKeyDown =
            event =>
                this.onKeyDown(
                    event
                );


        this._boundFrame =
            time =>
                this.frame(
                    time
                );
    }


    init({
        game,
        scene
    } = {}) {

        if (
            this.initialized
        ) {

            this.game =
                game ||
                this.game;

            this.scene =
                scene ||
                this.scene;

            return this;
        }


        this.game =
            game;

        this.scene =
            scene;


        document.addEventListener(
            "keydown",
            this._boundKeyDown
        );


        /*
         * BOT death -> drop primary.
         */
        gameEvents.on(
            GAME_EVENT.BOT_DEATH,
            data => {

                const bot =
                    data?.bot ||
                    data?.victim;


                if (!bot) {
                    return;
                }


                this.dropPrimary(
                    bot,
                    {
                        autoEquipFallback:
                            false
                    }
                );
            }
        );


        /*
         * Round/match restart: remove old ground weapons.
         * These UI events occur before the new round is built.
         */
        gameEvents.on(
            "ui:restart-round-request",
            () =>
                this.clear()
        );


        gameEvents.on(
            "ui:restart-match-request",
            () =>
                this.clear()
        );


        /*
         * Normal round transition:
         *
         * round.js emits ROUND_FREEZE_START when a new round
         * has been created and players/BOTs are entering freeze
         * time. Ground weapons from the previous round must be
         * removed here, otherwise they survive into the next round.
         */
        gameEvents.on(
            GAME_EVENT.ROUND_FREEZE_START,
            () =>
                this.clear()
        );


        /*
         * Extra fallback for future round-flow changes.
         * Calling clear() twice is safe because the item list
         * is already empty after the first call.
         */
        gameEvents.on(
            GAME_EVENT.ROUND_START,
            () =>
                this.clear()
        );


        this.initialized =
            true;


        this.lastFrameTime =
            performance.now();


        this._raf =
            requestAnimationFrame(
                this._boundFrame
            );


        return this;
    }


    frame(
        time
    ) {

        const delta =
            Math.min(
                0.1,
                Math.max(
                    0,
                    (
                        time -
                        this.lastFrameTime
                    ) /
                    1000
                )
            );


        this.lastFrameTime =
            time;


        if (
            this.game
                ?.gameplayStarted &&
            !this.game
                ?.paused
        ) {

            this.update(
                delta
            );
        }


        this._raf =
            requestAnimationFrame(
                this._boundFrame
            );
    }


    onKeyDown(
        event
    ) {

        if (
            event.code !==
                "KeyG" ||
            event.repeat
        ) {

            return;
        }


        const game =
            this.game;


        const player =
            game?.player;


        if (
            !game
                ?.gameplayStarted ||
            game?.paused ||
            !player
                ?.isAlive
        ) {

            return;
        }


        /*
         * Only accept G while the game owns the mouse.
         * Prevents typing G in menus from dropping a weapon.
         */
        if (
            game.controls &&
            !game.controls.isLocked
        ) {

            return;
        }


        event.preventDefault();


        game.exitSniperScope?.({
            restoreWeaponView:
                true
        });


        this.dropPrimary(
            player,
            {
                autoEquipFallback:
                    true
            }
        );
    }


    getDropPosition(
        entity
    ) {

        const position =
            getEntityPosition(
                entity
            ) ||
            new THREE.Vector3();


        /*
         * Player.getPosition() 返回的是 PointerLock 控制对象位置，
         * 当前项目里这个 Y 实际是“眼睛高度”，不是脚底高度。
         *
         * BOT.getPosition() 则是脚底 / 地面基准。
         *
         * 因此：
         * - Player: 减去当前 eyeHeight
         * - BOT: 保持原 Y
         *
         * 这样玩家按 G 后武器不会悬在视线高度。
         */
        if (
            Number.isFinite(
                Number(
                    entity?.eyeHeight
                )
            ) &&
            entity?.camera
        ) {

            position.y -=
                Number(
                    entity.eyeHeight
                );
        }


        const forward =
            getEntityForward(
                entity
            );


        forward.y =
            0;


        if (
            forward.lengthSq() >
            0.0001
        ) {

            forward.normalize();


            position.addScaledVector(
                forward,
                DROP_FORWARD
            );
        }


        return position;
    }


    spawnFromWeapon(
        weapon,
        {
            entity = null,
            position = null
        } = {}
    ) {

        if (
            !weapon ||
            weapon.slot !==
                WEAPON_SLOT.PRIMARY
        ) {

            return null;
        }


        const dropPosition =
            position?.clone?.() ||
            this.getDropPosition(
                entity
            );


        const throwDirection =
            getEntityForward(
                entity
            );


        const item =
            new DroppedWeapon({
                weaponId:
                    weapon.id,

                clipAmmo:
                    weapon.clipAmmo,

                reserveAmmo:
                    weapon.reserveAmmo,

                position:
                    dropPosition,

                rotationY:
                    entity?.group
                        ?.rotation
                        ?.y ||
                    0,

                droppedBy:
                    entity,

                scene:
                    this.scene,

                throwDirection
            });


        this.items.push(
            item
        );


        gameEvents.emit(
            "weapon:world-drop",
            {
                owner:
                    entity,

                droppedWeapon:
                    item,

                weaponId:
                    item.weaponId,

                clipAmmo:
                    item.clipAmmo,

                reserveAmmo:
                    item.reserveAmmo
            }
        );


        return item;
    }


    dropPrimary(
        entity,
        {
            autoEquipFallback = true
        } = {}
    ) {

        const inventory =
            entity?.inventory;


        const weapon =
            inventory
                ?.primaryWeapon;


        if (
            !inventory ||
            !weapon
        ) {

            return null;
        }


        /*
         * Create the world copy BEFORE removing from inventory,
         * so current ammo is preserved exactly.
         */
        const item =
            this.spawnFromWeapon(
                weapon,
                {
                    entity
                }
            );


        inventory.removeWeapon(
            weapon.id
        );


        if (
            autoEquipFallback
        ) {

            if (
                !inventory
                    .equipSecondary()
            ) {

                inventory
                    .equipKnife();
            }
        }


        entity.syncWeaponModel?.();


        return item;
    }


    pickup(
        item,
        entity
    ) {

        if (
            !item ||
            !entity ||
            !item.canPickup(
                entity
            )
        ) {

            return false;
        }


        const inventory =
            entity.inventory;


        if (!inventory) {

            return false;
        }


        /*
         * V1 only handles primary weapons.
         */
        const existing =
            inventory.primaryWeapon;


        /*
         * If this exact weapon is already held, do not repeatedly
         * exchange it while standing on the drop.
         */
        if (
            existing?.id ===
                item.weaponId
        ) {

            return false;
        }


        /*
         * V1.2:
         *
         * 不再允许“踩到枪就自动换掉当前主武器”。
         * 只要主武器槽里还有枪，就拒绝拾取。
         *
         * 玩家必须先按 G 主动丢掉当前主武器；
         * BOT 则仍然只在没有主武器时拾取。
         */
        if (existing) {

            return false;
        }


        const weapon =
            inventory.addWeapon(
                item.weaponId,
                {
                    equip:
                        true,

                    /*
                     * Important:
                     * do not refill ammo on pickup.
                     */
                    refill:
                        false
                }
            );


        if (!weapon) {

            return false;
        }


        weapon.setAmmo(
            item.clipAmmo,
            item.reserveAmmo
        );


        entity.syncWeaponModel?.();


        const index =
            this.items.indexOf(
                item
            );


        if (
            index !== -1
        ) {

            this.items.splice(
                index,
                1
            );
        }


        item.destroy();


        gameEvents.emit(
            "weapon:world-pickup",
            {
                owner:
                    entity,

                weapon,

                weaponId:
                    weapon.id
            }
        );


        return true;
    }


    update(
        delta = 0.016
    ) {

        for (
            const item
            of this.items
        ) {

            item.update(
                delta
            );
        }


        const player =
            this.game?.player;


        this.updatePlayerPickupHint(
            player
        );


        if (
            this.items.length ===
            0
        ) {

            return;
        }


        if (
            player?.isAlive
        ) {

            /*
             * CS-style V1.2:
             *
             * 玩家已经拿着主武器时，不自动交换地上的枪。
             *
             * 想拿 BOT 掉落的枪：
             * 1. 先走到地面枪附近看清楚
             * 2. 按 G 丢掉自己的主武器
             * 3. Inventory 主武器槽为空
             * 4. 系统才允许自动拾取地面枪
             */
            this.tryPickupNearest(
                player,
                PICKUP_RADIUS,
                {
                    requireEmptyPrimary:
                        true
                }
            );
        }


        /*
         * BOT V1:
         * only pick up a dropped primary when the BOT currently
         * has no primary. No weapon-value comparison yet.
         */
        for (
            const bot
            of this.game?.bots ||
            []
        ) {

            if (
                !bot?.isAlive ||
                bot.inventory
                    ?.primaryWeapon
            ) {

                continue;
            }


            this.tryPickupNearest(
                bot,
                BOT_PICKUP_RADIUS,
                {
                    requireEmptyPrimary:
                        true
                }
            );
        }
    }


    updatePlayerPickupHint(
        player
    ) {

        if (
            !player?.isAlive ||
            this.items.length ===
                0
        ) {

            gameEvents.emit(
                "weapon:pickup-hint",
                {
                    owner:
                        player,

                    visible:
                        false
                }
            );


            return;
        }


        const position =
            getEntityPosition(
                player
            );


        if (!position) {

            return;
        }


        let best =
            null;

        let bestDistance =
            Infinity;


        for (
            const item
            of this.items
        ) {

            const itemPosition =
                item.getPosition();


            const distance =
                Math.hypot(
                    itemPosition.x -
                        position.x,

                    itemPosition.z -
                        position.z
                );


            if (
                distance <=
                    PICKUP_HINT_RADIUS &&
                distance <
                    bestDistance
            ) {

                best =
                    item;

                bestDistance =
                    distance;
            }
        }


        if (!best) {

            gameEvents.emit(
                "weapon:pickup-hint",
                {
                    owner:
                        player,

                    visible:
                        false
                }
            );


            return;
        }


        gameEvents.emit(
            "weapon:pickup-hint",
            {
                owner:
                    player,

                visible:
                    true,

                weaponId:
                    best.weaponId,

                clipAmmo:
                    best.clipAmmo,

                reserveAmmo:
                    best.reserveAmmo,

                distance:
                    bestDistance,

                hasPrimary:
                    Boolean(
                        player.inventory
                            ?.primaryWeapon
                    )
            }
        );
    }


    tryPickupNearest(
        entity,
        radius,
        {
            requireEmptyPrimary = false
        } = {}
    ) {

        if (
            requireEmptyPrimary &&
            entity.inventory
                ?.primaryWeapon
        ) {

            return false;
        }


        const position =
            getEntityPosition(
                entity
            );


        if (!position) {

            return false;
        }


        let best =
            null;

        let bestDistance =
            Infinity;


        for (
            const item
            of this.items
        ) {

            if (
                !item.canPickup(
                    entity
                )
            ) {

                continue;
            }


            const itemPosition =
                item.getPosition();


            const dx =
                itemPosition.x -
                position.x;

            const dz =
                itemPosition.z -
                position.z;


            const distance =
                Math.hypot(
                    dx,
                    dz
                );


            if (
                distance <=
                    radius &&
                distance <
                    bestDistance
            ) {

                best =
                    item;

                bestDistance =
                    distance;
            }
        }


        if (!best) {

            return false;
        }


        return this.pickup(
            best,
            entity
        );
    }


    clear() {

        for (
            const item
            of this.items
        ) {

            item.destroy();
        }


        this.items.length =
            0;


        gameEvents.emit(
            "weapon:pickup-hint",
            {
                owner:
                    this.game?.player,

                visible:
                    false
            }
        );
    }
}


export const droppedWeaponSystem =
    new DroppedWeaponSystem();