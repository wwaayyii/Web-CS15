/**
 * Web-CS15
 * src/weapons/weaponView.js
 *
 * 第一人称武器 ViewModel
 *
 * 功能：
 * - Deagle
 * - Glock
 * - USP
 * - AK47
 * - M4A1
 * - MP5
 * - AWP
 * - Scout
 * - Knife
 * - HE / Flash / Smoke
 *
 * 动画：
 * - Draw
 * - Idle
 * - Walk Bob
 * - Sprint Bob
 * - Weapon Sway
 * - Fire Recoil
 * - Reload
 * - Knife Slash
 *
 * 特效：
 * - Muzzle Flash
 * - Muzzle Light
 *
 * 依赖：
 * - Three.js
 * - gameEvents
 */

import * as THREE from "three";

import {
    gameEvents
} from "../core/utils.js";


// ============================================================
// WeaponView state
// ============================================================

export const WEAPON_VIEW_STATE = Object.freeze({
    IDLE: "idle",
    DRAW: "draw",
    FIRE: "fire",
    RELOAD: "reload",
    KNIFE: "knife"
});


// ============================================================
// Helpers
// ============================================================

function clamp01(value) {
    return Math.max(
        0,
        Math.min(
            1,
            value
        )
    );
}


function lerp(a, b, t) {
    return a + (b - a) * t;
}


function damp(
    current,
    target,
    speed,
    delta
) {

    const t =
        1 -
        Math.exp(
            -speed *
            delta
        );


    return lerp(
        current,
        target,
        t
    );
}


function smoothstep(t) {

    t = clamp01(t);

    return (
        t *
        t *
        (
            3 -
            2 * t
        )
    );
}


function createMaterial(
    color,
    {
        roughness = 0.45,
        metalness = 0.1,
        emissive = 0x000000,
        emissiveIntensity = 0
    } = {}
) {

    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity
    });
}


function createBox(
    size,
    material,
    position = null,
    rotation = null
) {

    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                size.x,
                size.y,
                size.z
            ),
            material
        );


    if (position) {

        mesh.position.copy(
            position
        );
    }


    if (rotation) {

        mesh.rotation.set(
            rotation.x || 0,
            rotation.y || 0,
            rotation.z || 0
        );
    }


    mesh.castShadow =
        false;

    mesh.receiveShadow =
        false;


    return mesh;
}


function createCylinder(
    radius,
    length,
    material,
    position = null,
    rotation = null,
    radialSegments = 10
) {

    const mesh =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                radius,
                radius,
                length,
                radialSegments
            ),
            material
        );


    if (position) {

        mesh.position.copy(
            position
        );
    }


    if (rotation) {

        mesh.rotation.set(
            rotation.x || 0,
            rotation.y || 0,
            rotation.z || 0
        );
    }


    return mesh;
}


// ============================================================
// WeaponView
// ============================================================

export class WeaponView {

    constructor({
        camera = null,
        player = null
    } = {}) {

        this.camera =
            camera;

        this.player =
            player;


        // ====================================================
        // Root
        // ====================================================

        this.root =
            new THREE.Group();

        this.root.name =
            "FIRST_PERSON_WEAPON_VIEW";


        this.weaponRoot =
            new THREE.Group();

        this.weaponRoot.name =
            "WEAPON_MODEL_ROOT";


        this.root.add(
            this.weaponRoot
        );


        // ====================================================
        // Current model
        // ====================================================

        this.currentWeapon =
            null;

        this.currentWeaponId =
            null;

        this.currentModel =
            null;


        // ====================================================
        // Muzzle
        // ====================================================

        this.muzzleAnchor =
            new THREE.Group();

        this.muzzleFlash =
            null;

        this.muzzleLight =
            null;

        this.muzzleFlashTime =
            0;


        // ====================================================
        // State
        // ====================================================

        this.state =
            WEAPON_VIEW_STATE.IDLE;

        this.stateTime =
            0;


        // ====================================================
        // Animation
        // ====================================================

        this.idleTime =
            0;

        this.walkTime =
            0;


        this.fireKick =
            0;

        this.fireSideKick =
            0;

        this.recoilRotation =
            new THREE.Vector3();


        this.reloadTime =
            0;

        this.reloadDuration =
            1;


        this.drawTime =
            0;

        this.drawDuration =
            0.36;


        this.knifeTime =
            0;

        this.knifeDuration =
            0.36;


        // ====================================================
        // Mouse sway
        // ====================================================

        this.mouseDelta =
            new THREE.Vector2();

        this.sway =
            new THREE.Vector2();


        // ====================================================
        // Defaults
        // ====================================================

        this.basePosition =
            new THREE.Vector3(
                0.36,
                -0.36,
                -0.68
            );


        this.baseRotation =
            new THREE.Euler(
                -0.02,
                -0.05,
                -0.02
            );


        this.weaponRoot.position
            .copy(
                this.basePosition
            );


        this.weaponRoot.rotation
            .copy(
                this.baseRotation
            );


        // ====================================================
        // Models
        // ====================================================

        this.modelCache =
            new Map();


        // ====================================================
        // Event handlers
        // ====================================================

        this._handlers = {};


        this._createEventHandlers();
    }


    // ========================================================
    // Init
    // ========================================================

    init({
        camera = this.camera,
        player = this.player
    } = {}) {

        if (!camera) {

            throw new Error(
                "[WeaponView] camera is required."
            );
        }


        this.camera =
            camera;

        this.player =
            player;


        if (
            !this.root.parent
        ) {

            this.camera.add(
                this.root
            );
        }


        this.createMuzzleFlash();

        this.bindEvents();

        this.bindMouseSway();


        if (
            this.player
                ?.inventory
                ?.currentWeapon
        ) {

            this.setWeapon(
                this.player
                    .inventory
                    .currentWeapon
            );
        }


        return this;
    }


    // ========================================================
    // Events
    // ========================================================

    _createEventHandlers() {

        this._handlers.weaponEquip =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.setWeapon(
                    data.weapon
                );
            };


        this._handlers.weaponFire =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.onFire(
                    data.weapon
                );
            };


        this._handlers.weaponReload =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.onReload(
                    data.weapon
                );
            };


        this._handlers.weaponReloadComplete =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.state =
                    WEAPON_VIEW_STATE.IDLE;

                this.stateTime =
                    0;
            };


        this._handlers.weaponEmpty =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.fireKick =
                    Math.max(
                        this.fireKick,
                        0.05
                    );
            };
    }


    bindEvents() {

        gameEvents.on(
            "weapon:equip",
            this._handlers.weaponEquip
        );


        gameEvents.on(
            "weapon:fire",
            this._handlers.weaponFire
        );


        gameEvents.on(
            "weapon:reload",
            this._handlers.weaponReload
        );


        gameEvents.on(
            "weapon:reload-complete",
            this._handlers.weaponReloadComplete
        );


        gameEvents.on(
            "weapon:empty",
            this._handlers.weaponEmpty
        );
    }


    bindMouseSway() {

        this._mouseMoveHandler =
            event => {

                if (
                    document.pointerLockElement ==
                    null
                ) {
                    return;
                }


                this.mouseDelta.x +=
                    event.movementX || 0;

                this.mouseDelta.y +=
                    event.movementY || 0;
            };


        document.addEventListener(
            "mousemove",
            this._mouseMoveHandler
        );
    }


    // ========================================================
    // Weapon Selection
    // ========================================================

    setWeapon(weapon) {

        if (!weapon) {
            return;
        }


        const weaponId =
            weapon.id;


        if (
            this.currentWeaponId ===
            weaponId
        ) {

            this.currentWeapon =
                weapon;

            return;
        }


        this.currentWeapon =
            weapon;

        this.currentWeaponId =
            weaponId;


        this.clearWeaponModel();


        let model =
            this.modelCache.get(
                weaponId
            );


        if (!model) {

            model =
                this.createWeaponModel(
                    weaponId
                );


            this.modelCache.set(
                weaponId,
                model
            );
        }


        this.currentModel =
            model;


        this.weaponRoot.add(
            this.currentModel
        );


        this.applyWeaponTransform(
            weaponId
        );


        this.attachMuzzleAnchor(
            weaponId
        );


        this.playDraw();
    }


    clearWeaponModel() {

        if (
            this.currentModel &&
            this.currentModel.parent ===
            this.weaponRoot
        ) {

            this.weaponRoot.remove(
                this.currentModel
            );
        }


        this.currentModel =
            null;
    }


    // ========================================================
    // Model Factory
    // ========================================================

    createWeaponModel(weaponId) {

        switch (
            weaponId
        ) {

            case "deagle":
                return this.createDeagle();


            case "glock":
                return this.createGlock();


            case "usp":
                return this.createUSP();


            case "ak47":
                return this.createAK47();


            case "m4a1":
                return this.createM4A1();


            case "mp5":
                return this.createMP5();


            case "awp":
                return this.createAWP();


            case "scout":
                return this.createScout();


            case "knife":
                return this.createKnife();


            case "he":
            case "flash":
            case "smoke":
                return this.createGrenade(
                    weaponId
                );


            default:
                return this.createGenericGun(
                    weaponId
                );
        }
    }


    // ========================================================
    // Materials
    // ========================================================

    createCommonMaterials() {

        return {
            black:
                createMaterial(
                    0x121416,
                    {
                        roughness: 0.35,
                        metalness: 0.45
                    }
                ),

            dark:
                createMaterial(
                    0x25282c,
                    {
                        roughness: 0.4,
                        metalness: 0.25
                    }
                ),

            steel:
                createMaterial(
                    0x676c70,
                    {
                        roughness: 0.3,
                        metalness: 0.65
                    }
                ),

            wood:
                createMaterial(
                    0x6a3c1d,
                    {
                        roughness: 0.75,
                        metalness: 0
                    }
                ),

            brown:
                createMaterial(
                    0x4d321e,
                    {
                        roughness: 0.8
                    }
                ),

            green:
                createMaterial(
                    0x394331,
                    {
                        roughness: 0.75
                    }
                ),

            light:
                createMaterial(
                    0xb4b7b3,
                    {
                        roughness: 0.25,
                        metalness: 0.55
                    }
                )
        };
    }


    // ========================================================
    // Generic Gun
    // ========================================================

    createGenericGun() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.18,
                    0.75
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0,
                    -0.3
                )
            )
        );


        return group;
    }


    // ========================================================
    // Deagle
    // ========================================================

    createDeagle() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        // slide
        group.add(
            createBox(
                new THREE.Vector3(
                    0.16,
                    0.18,
                    0.58
                ),
                mat.steel,
                new THREE.Vector3(
                    0,
                    0.06,
                    -0.23
                )
            )
        );


        // barrel
        group.add(
            createCylinder(
                0.047,
                0.62,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.04,
                    -0.33
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // frame
        group.add(
            createBox(
                new THREE.Vector3(
                    0.14,
                    0.16,
                    0.34
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    -0.08,
                    -0.08
                )
            )
        );


        // grip
        const grip =
            createBox(
                new THREE.Vector3(
                    0.14,
                    0.34,
                    0.17
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.27,
                    0.02
                )
            );


        grip.rotation.x =
            -0.18;


        group.add(
            grip
        );


        // trigger guard
        group.add(
            createBox(
                new THREE.Vector3(
                    0.11,
                    0.08,
                    0.16
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    -0.14,
                    -0.16
                )
            )
        );


        return group;
    }


    // ========================================================
    // Glock
    // ========================================================

    createGlock() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        group.add(
            createBox(
                new THREE.Vector3(
                    0.14,
                    0.14,
                    0.53
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.05,
                    -0.22
                )
            )
        );


        group.add(
            createBox(
                new THREE.Vector3(
                    0.13,
                    0.13,
                    0.30
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.07,
                    -0.07
                )
            )
        );


        const grip =
            createBox(
                new THREE.Vector3(
                    0.13,
                    0.31,
                    0.15
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.26,
                    0.03
                )
            );


        grip.rotation.x =
            -0.15;


        group.add(
            grip
        );


        return group;
    }


    // ========================================================
    // USP
    // ========================================================

    createUSP() {

        const group =
            this.createGlock();


        const mat =
            this.createCommonMaterials();


        const suppressor =
            createCylinder(
                0.052,
                0.34,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.05,
                    -0.61
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            );


        group.add(
            suppressor
        );


        return group;
    }


    // ========================================================
    // AK47
    // ========================================================

    createAK47() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        // receiver
        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.20,
                    0.68
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0,
                    -0.26
                )
            )
        );


        // top cover
        group.add(
            createBox(
                new THREE.Vector3(
                    0.16,
                    0.08,
                    0.50
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0.13,
                    -0.22
                )
            )
        );


        // barrel
        group.add(
            createCylinder(
                0.035,
                0.80,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.06,
                    -0.87
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // gas tube
        group.add(
            createCylinder(
                0.027,
                0.53,
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.13,
                    -0.71
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // handguard
        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.18,
                    0.40
                ),
                mat.wood,
                new THREE.Vector3(
                    0,
                    -0.03,
                    -0.61
                )
            )
        );


        // stock
        const stock =
            createBox(
                new THREE.Vector3(
                    0.17,
                    0.23,
                    0.53
                ),
                mat.wood,
                new THREE.Vector3(
                    0,
                    -0.02,
                    0.40
                )
            );


        stock.rotation.x =
            0.08;


        group.add(
            stock
        );


        // grip
        const grip =
            createBox(
                new THREE.Vector3(
                    0.14,
                    0.33,
                    0.16
                ),
                mat.wood,
                new THREE.Vector3(
                    0,
                    -0.30,
                    0.03
                )
            );


        grip.rotation.x =
            -0.25;


        group.add(
            grip
        );


        // curved magazine
        const mag =
            createBox(
                new THREE.Vector3(
                    0.14,
                    0.38,
                    0.18
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.30,
                    -0.22
                )
            );


        mag.rotation.x =
            0.18;


        group.add(
            mag
        );


        // front sight
        group.add(
            createBox(
                new THREE.Vector3(
                    0.04,
                    0.13,
                    0.06
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0.16,
                    -1.15
                )
            )
        );


        return group;
    }


    // ========================================================
    // M4A1
    // ========================================================

    createM4A1() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        // receiver
        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.20,
                    0.60
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0,
                    -0.20
                )
            )
        );


        // top rail
        group.add(
            createBox(
                new THREE.Vector3(
                    0.12,
                    0.06,
                    0.50
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0.13,
                    -0.22
                )
            )
        );


        // barrel
        group.add(
            createCylinder(
                0.030,
                0.86,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.06,
                    -0.91
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // handguard
        group.add(
            createBox(
                new THREE.Vector3(
                    0.17,
                    0.18,
                    0.48
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0,
                    -0.61
                )
            )
        );


        // suppressor-like tip
        group.add(
            createCylinder(
                0.040,
                0.30,
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.06,
                    -1.47
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // stock
        group.add(
            createBox(
                new THREE.Vector3(
                    0.15,
                    0.20,
                    0.48
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.02,
                    0.37
                )
            )
        );


        // grip
        const grip =
            createBox(
                new THREE.Vector3(
                    0.12,
                    0.32,
                    0.15
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.29,
                    0.02
                )
            );


        grip.rotation.x =
            -0.20;


        group.add(
            grip
        );


        // mag
        group.add(
            createBox(
                new THREE.Vector3(
                    0.12,
                    0.34,
                    0.16
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    -0.29,
                    -0.20
                )
            )
        );


        return group;
    }


    // ========================================================
    // MP5
    // ========================================================

    createMP5() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.19,
                    0.56
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0,
                    -0.25
                )
            )
        );


        group.add(
            createCylinder(
                0.030,
                0.52,
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.05,
                    -0.74
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        group.add(
            createBox(
                new THREE.Vector3(
                    0.16,
                    0.16,
                    0.34
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    -0.02,
                    -0.55
                )
            )
        );


        const grip =
            createBox(
                new THREE.Vector3(
                    0.12,
                    0.30,
                    0.14
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.27,
                    -0.02
                )
            );


        grip.rotation.x =
            -0.18;


        group.add(
            grip
        );


        const mag =
            createBox(
                new THREE.Vector3(
                    0.10,
                    0.31,
                    0.14
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.29,
                    -0.23
                )
            );


        mag.rotation.x =
            0.08;


        group.add(
            mag
        );


        return group;
    }


    // ========================================================
    // AWP
    // ========================================================

    createAWP() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        // body
        group.add(
            createBox(
                new THREE.Vector3(
                    0.18,
                    0.19,
                    0.70
                ),
                mat.green,
                new THREE.Vector3(
                    0,
                    0,
                    -0.25
                )
            )
        );


        // long barrel
        group.add(
            createCylinder(
                0.028,
                1.25,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.06,
                    -1.20
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                )
            )
        );


        // scope tube
        group.add(
            createCylinder(
                0.075,
                0.58,
                mat.black,
                new THREE.Vector3(
                    0,
                    0.23,
                    -0.24
                ),
                new THREE.Vector3(
                    Math.PI / 2,
                    0,
                    0
                ),
                12
            )
        );


        // scope mounts
        group.add(
            createBox(
                new THREE.Vector3(
                    0.08,
                    0.12,
                    0.08
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.14,
                    -0.10
                )
            )
        );


        group.add(
            createBox(
                new THREE.Vector3(
                    0.08,
                    0.12,
                    0.08
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0.14,
                    -0.36
                )
            )
        );


        // stock
        group.add(
            createBox(
                new THREE.Vector3(
                    0.19,
                    0.28,
                    0.62
                ),
                mat.green,
                new THREE.Vector3(
                    0,
                    -0.03,
                    0.45
                )
            )
        );


        // grip
        const grip =
            createBox(
                new THREE.Vector3(
                    0.13,
                    0.31,
                    0.16
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.30,
                    0.03
                )
            );


        grip.rotation.x =
            -0.18;


        group.add(
            grip
        );


        return group;
    }


    // ========================================================
    // Scout
    // ========================================================

    createScout() {

        const group =
            this.createAWP();


        group.scale.set(
            0.92,
            0.92,
            0.92
        );


        return group;
    }


    // ========================================================
    // Knife
    // ========================================================

    createKnife() {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        // handle
        const handle =
            createBox(
                new THREE.Vector3(
                    0.11,
                    0.14,
                    0.42
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.02,
                    -0.06
                )
            );


        group.add(
            handle
        );


        // guard
        group.add(
            createBox(
                new THREE.Vector3(
                    0.28,
                    0.05,
                    0.08
                ),
                mat.dark,
                new THREE.Vector3(
                    0,
                    0,
                    -0.29
                )
            )
        );


        // blade
        const blade =
            new THREE.Mesh(
                new THREE.BufferGeometry(),
                mat.light
            );


        const vertices =
            new Float32Array([
                -0.055, -0.025, -0.31,
                 0.055, -0.025, -0.31,
                 0.030,  0.025, -0.95,

                -0.055, -0.025, -0.31,
                 0.030,  0.025, -0.95,
                -0.020,  0.025, -0.78,

                 0.055, -0.025, -0.31,
                 0.020, -0.025, -0.78,
                 0.030,  0.025, -0.95
            ]);


        blade.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                vertices,
                3
            )
        );


        blade.geometry.computeVertexNormals();


        group.add(
            blade
        );


        group.rotation.z =
            -0.12;


        return group;
    }


    // ========================================================
    // Grenade
    // ========================================================

    createGrenade(type) {

        const group =
            new THREE.Group();


        const mat =
            this.createCommonMaterials();


        let bodyMaterial =
            mat.green;


        if (
            type === "flash"
        ) {

            bodyMaterial =
                mat.light;
        }


        if (
            type === "smoke"
        ) {

            bodyMaterial =
                mat.dark;
        }


        const body =
            new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.12,
                    0.14,
                    0.32,
                    10
                ),
                bodyMaterial
            );


        body.rotation.x =
            Math.PI / 2;


        body.position.z =
            -0.18;


        group.add(
            body
        );


        group.add(
            createBox(
                new THREE.Vector3(
                    0.12,
                    0.07,
                    0.10
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0.08,
                    -0.03
                )
            )
        );


        return group;
    }


    // ========================================================
    // Weapon Transforms
    // ========================================================

    applyWeaponTransform(
        weaponId
    ) {

        this.basePosition.set(
            0.34,
            -0.34,
            -0.72
        );


        this.baseRotation.set(
            -0.02,
            -0.05,
            -0.02
        );


        let scale = 1;


        switch (
            weaponId
        ) {

            case "deagle":

                this.basePosition.set(
                    0.33,
                    -0.34,
                    -0.63
                );

                scale =
                    1.05;

                break;


            case "glock":
            case "usp":

                this.basePosition.set(
                    0.32,
                    -0.34,
                    -0.62
                );

                break;


            case "ak47":

                this.basePosition.set(
                    0.34,
                    -0.36,
                    -0.78
                );

                scale =
                    0.92;

                break;


            case "m4a1":

                this.basePosition.set(
                    0.34,
                    -0.36,
                    -0.80
                );

                scale =
                    0.93;

                break;


            case "mp5":

                this.basePosition.set(
                    0.33,
                    -0.36,
                    -0.72
                );

                scale =
                    0.96;

                break;


            case "awp":
            case "scout":

                this.basePosition.set(
                    0.35,
                    -0.37,
                    -0.87
                );

                scale =
                    0.86;

                break;


            case "knife":

                this.basePosition.set(
                    0.39,
                    -0.39,
                    -0.54
                );

                this.baseRotation.set(
                    -0.10,
                    -0.15,
                    -0.22
                );

                scale =
                    1.15;

                break;


            case "he":
            case "flash":
            case "smoke":

                this.basePosition.set(
                    0.34,
                    -0.38,
                    -0.48
                );

                scale =
                    1.15;

                break;
        }


        this.weaponRoot.scale.setScalar(
            scale
        );


        this.weaponRoot.position
            .copy(
                this.basePosition
            );


        this.weaponRoot.rotation
            .copy(
                this.baseRotation
            );
    }


    // ========================================================
    // Muzzle position
    // ========================================================

    attachMuzzleAnchor(
        weaponId
    ) {

        if (
            this.muzzleAnchor.parent
        ) {

            this.muzzleAnchor.parent.remove(
                this.muzzleAnchor
            );
        }


        if (
            !this.currentModel
        ) {
            return;
        }


        this.currentModel.add(
            this.muzzleAnchor
        );


        this.muzzleAnchor.position.set(
            0,
            0.05,
            -0.85
        );


        switch (
            weaponId
        ) {

            case "deagle":

                this.muzzleAnchor.position.z =
                    -0.57;

                break;


            case "glock":

                this.muzzleAnchor.position.z =
                    -0.52;

                break;


            case "usp":

                this.muzzleAnchor.position.z =
                    -0.82;

                break;


            case "ak47":

                this.muzzleAnchor.position.z =
                    -1.29;

                break;


            case "m4a1":

                this.muzzleAnchor.position.z =
                    -1.62;

                break;


            case "mp5":

                this.muzzleAnchor.position.z =
                    -1.03;

                break;


            case "awp":
            case "scout":

                this.muzzleAnchor.position.z =
                    -1.83;

                break;


            case "knife":

                this.muzzleAnchor.position.z =
                    -0.8;

                break;
        }
    }


    // ========================================================
    // Muzzle Flash
    // ========================================================

    createMuzzleFlash() {

        const geometry =
            new THREE.PlaneGeometry(
                0.23,
                0.23
            );


        const material =
            new THREE.MeshBasicMaterial({
                color:
                    0xffe36b,

                transparent:
                    true,

                opacity:
                    0,

                depthWrite:
                    false,

                side:
                    THREE.DoubleSide,

                blending:
                    THREE.AdditiveBlending
            });


        this.muzzleFlash =
            new THREE.Mesh(
                geometry,
                material
            );


        this.muzzleFlash.rotation.z =
            Math.random() *
            Math.PI;


        this.muzzleAnchor.add(
            this.muzzleFlash
        );


        this.muzzleLight =
            new THREE.PointLight(
                0xffb13b,
                0,
                3.5
            );


        this.muzzleAnchor.add(
            this.muzzleLight
        );
    }


    triggerMuzzleFlash() {

        if (
            !this.muzzleFlash
        ) {
            return;
        }


        this.muzzleFlashTime =
            0.055;


        this.muzzleFlash.material.opacity =
            1;


        this.muzzleFlash.rotation.z =
            Math.random() *
            Math.PI;


        const scale =
            0.7 +
            Math.random() *
            0.7;


        this.muzzleFlash.scale.setScalar(
            scale
        );


        this.muzzleLight.intensity =
            2.5;
    }


    // ========================================================
    // Draw
    // ========================================================

    playDraw() {

        this.state =
            WEAPON_VIEW_STATE.DRAW;

        this.stateTime =
            0;

        this.drawTime =
            0;
    }


    // ========================================================
    // Fire
    // ========================================================

    onFire(weapon) {

        if (!weapon) {
            return;
        }


        if (
            weapon.id ===
            "knife"
        ) {

            this.state =
                WEAPON_VIEW_STATE.KNIFE;

            this.knifeTime =
                0;

            return;
        }


        this.state =
            WEAPON_VIEW_STATE.FIRE;

        this.stateTime =
            0;


        let kick =
            0.055;


        let rotation =
            0.035;


        switch (
            weapon.id
        ) {

            case "deagle":

                kick =
                    0.115;

                rotation =
                    0.085;

                break;


            case "ak47":

                kick =
                    0.085;

                rotation =
                    0.060;

                break;


            case "m4a1":

                kick =
                    0.060;

                rotation =
                    0.045;

                break;


            case "awp":

                kick =
                    0.18;

                rotation =
                    0.11;

                break;


            case "mp5":

                kick =
                    0.038;

                rotation =
                    0.025;

                break;
        }


        this.fireKick =
            Math.min(
                0.28,
                this.fireKick +
                kick
            );


        this.fireSideKick +=
            (
                Math.random() -
                0.5
            ) *
            kick *
            0.65;


        this.recoilRotation.x +=
            rotation;


        this.recoilRotation.z +=
            (
                Math.random() -
                0.5
            ) *
            rotation *
            0.5;


        this.triggerMuzzleFlash();
    }


    // ========================================================
    // Reload
    // ========================================================

    onReload(weapon) {

        if (!weapon) {
            return;
        }


        this.state =
            WEAPON_VIEW_STATE.RELOAD;

        this.stateTime =
            0;

        this.reloadTime =
            0;

        this.reloadDuration =
            Math.max(
                0.4,
                weapon.config
                    ?.reloadTime ??
                2
            );
    }


    // ========================================================
    // Knife animation
    // ========================================================

    updateKnifeAnimation(
        delta
    ) {

        this.knifeTime +=
            delta;


        const t =
            clamp01(
                this.knifeTime /
                this.knifeDuration
            );


        let swing;


        if (
            t <
            0.45
        ) {

            swing =
                smoothstep(
                    t / 0.45
                );

        } else {

            swing =
                1 -
                smoothstep(
                    (
                        t -
                        0.45
                    ) /
                    0.55
                );
        }


        this.weaponRoot.rotation.y +=
            swing *
            0.72;


        this.weaponRoot.rotation.z +=
            swing *
            0.48;


        this.weaponRoot.position.x -=
            swing *
            0.22;


        this.weaponRoot.position.z -=
            swing *
            0.08;


        if (
            t >= 1
        ) {

            this.state =
                WEAPON_VIEW_STATE.IDLE;
        }
    }


    // ========================================================
    // Draw animation
    // ========================================================

    updateDrawAnimation(
        delta
    ) {

        this.drawTime +=
            delta;


        const t =
            clamp01(
                this.drawTime /
                this.drawDuration
            );


        const eased =
            smoothstep(t);


        this.weaponRoot.position.y -=
            (
                1 -
                eased
            ) *
            0.45;


        this.weaponRoot.position.x +=
            (
                1 -
                eased
            ) *
            0.15;


        this.weaponRoot.rotation.z +=
            (
                1 -
                eased
            ) *
            0.35;


        if (
            t >= 1
        ) {

            this.state =
                WEAPON_VIEW_STATE.IDLE;
        }
    }


    // ========================================================
    // Reload animation
    // ========================================================

    updateReloadAnimation(
        delta
    ) {

        this.reloadTime +=
            delta;


        const t =
            clamp01(
                this.reloadTime /
                this.reloadDuration
            );


        const wave =
            Math.sin(
                t *
                Math.PI
            );


        this.weaponRoot.position.y -=
            wave *
            0.28;


        this.weaponRoot.position.x +=
            wave *
            0.10;


        this.weaponRoot.rotation.z +=
            wave *
            0.55;


        this.weaponRoot.rotation.x +=
            wave *
            0.18;


        if (
            t >= 1
        ) {

            this.state =
                WEAPON_VIEW_STATE.IDLE;
        }
    }


    // ========================================================
    // Movement Bob
    // ========================================================

    updateBob(
        delta
    ) {

        const player =
            this.player;


        let speedFactor = 0;


        if (
            player?.isMoving
        ) {

            speedFactor =
                player.isSprinting
                    ? 1
                    : player.isCrouching
                        ? 0.32
                        : 0.60;
        }


        if (
            speedFactor >
            0
        ) {

            this.walkTime +=
                delta *
                (
                    player?.isSprinting
                        ? 11
                        : 8
                );

        } else {

            this.walkTime +=
                delta *
                2;
        }


        const amplitudeX =
            0.016 *
            speedFactor;


        const amplitudeY =
            0.020 *
            speedFactor;


        const bobX =
            Math.sin(
                this.walkTime
            ) *
            amplitudeX;


        const bobY =
            Math.abs(
                Math.cos(
                    this.walkTime
                )
            ) *
            amplitudeY;


        this.weaponRoot.position.x +=
            bobX;


        this.weaponRoot.position.y -=
            bobY;


        this.weaponRoot.rotation.z +=
            bobX *
            0.7;


        this.weaponRoot.rotation.x +=
            bobY *
            0.5;
    }


    // ========================================================
    // Idle
    // ========================================================

    updateIdle(
        delta
    ) {

        this.idleTime +=
            delta;


        const breathe =
            Math.sin(
                this.idleTime *
                1.6
            );


        this.weaponRoot.position.y +=
            breathe *
            0.0025;


        this.weaponRoot.rotation.x +=
            breathe *
            0.0015;
    }


    // ========================================================
    // Mouse Sway
    // ========================================================

    updateSway(
        delta
    ) {

        const sensitivity =
            0.00055;


        this.sway.x +=
            this.mouseDelta.x *
            sensitivity;


        this.sway.y +=
            this.mouseDelta.y *
            sensitivity;


        this.sway.x =
            THREE.MathUtils.clamp(
                this.sway.x,
                -0.075,
                0.075
            );


        this.sway.y =
            THREE.MathUtils.clamp(
                this.sway.y,
                -0.060,
                0.060
            );


        this.mouseDelta.multiplyScalar(
            0.35
        );


        this.sway.x =
            damp(
                this.sway.x,
                0,
                11,
                delta
            );


        this.sway.y =
            damp(
                this.sway.y,
                0,
                11,
                delta
            );


        this.weaponRoot.position.x -=
            this.sway.x *
            0.42;


        this.weaponRoot.position.y +=
            this.sway.y *
            0.35;


        this.weaponRoot.rotation.y -=
            this.sway.x *
            0.70;


        this.weaponRoot.rotation.x -=
            this.sway.y *
            0.55;
    }


    // ========================================================
    // Recoil recovery
    // ========================================================

    updateRecoil(
        delta
    ) {

        this.fireKick =
            damp(
                this.fireKick,
                0,
                14,
                delta
            );


        this.fireSideKick =
            damp(
                this.fireSideKick,
                0,
                12,
                delta
            );


        this.recoilRotation.x =
            damp(
                this.recoilRotation.x,
                0,
                15,
                delta
            );


        this.recoilRotation.z =
            damp(
                this.recoilRotation.z,
                0,
                12,
                delta
            );


        this.weaponRoot.position.z +=
            this.fireKick;


        this.weaponRoot.position.x +=
            this.fireSideKick;


        this.weaponRoot.rotation.x -=
            this.recoilRotation.x;


        this.weaponRoot.rotation.z +=
            this.recoilRotation.z;
    }


    // ========================================================
    // Flash update
    // ========================================================

    updateMuzzleFlash(
        delta
    ) {

        if (
            this.muzzleFlashTime <=
            0
        ) {

            if (
                this.muzzleFlash
            ) {

                this.muzzleFlash.material.opacity =
                    0;
            }


            if (
                this.muzzleLight
            ) {

                this.muzzleLight.intensity =
                    0;
            }


            return;
        }


        this.muzzleFlashTime -=
            delta;


        const t =
            clamp01(
                this.muzzleFlashTime /
                0.055
            );


        this.muzzleFlash.material.opacity =
            t;


        this.muzzleLight.intensity =
            2.5 *
            t;
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (
            !this.currentModel
        ) {
            return;
        }


        this.stateTime +=
            delta;


        // ----------------------------------------------------
        // Reset to base
        // ----------------------------------------------------

        this.weaponRoot.position
            .copy(
                this.basePosition
            );


        this.weaponRoot.rotation
            .copy(
                this.baseRotation
            );


        // ----------------------------------------------------
        // Common movement
        // ----------------------------------------------------

        this.updateIdle(
            delta
        );


        this.updateBob(
            delta
        );


        this.updateSway(
            delta
        );


        this.updateRecoil(
            delta
        );


        // ----------------------------------------------------
        // State animation
        // ----------------------------------------------------

        switch (
            this.state
        ) {

            case WEAPON_VIEW_STATE.DRAW:

                this.updateDrawAnimation(
                    delta
                );

                break;


            case WEAPON_VIEW_STATE.RELOAD:

                this.updateReloadAnimation(
                    delta
                );

                break;


            case WEAPON_VIEW_STATE.KNIFE:

                this.updateKnifeAnimation(
                    delta
                );

                break;
        }


        // ----------------------------------------------------
        // Muzzle flash
        // ----------------------------------------------------

        this.updateMuzzleFlash(
            delta
        );
    }


    // ========================================================
    // Visibility
    // ========================================================

    setVisible(visible) {

        this.root.visible =
            Boolean(visible);
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        gameEvents.off(
            "weapon:equip",
            this._handlers.weaponEquip
        );


        gameEvents.off(
            "weapon:fire",
            this._handlers.weaponFire
        );


        gameEvents.off(
            "weapon:reload",
            this._handlers.weaponReload
        );


        gameEvents.off(
            "weapon:reload-complete",
            this._handlers.weaponReloadComplete
        );


        gameEvents.off(
            "weapon:empty",
            this._handlers.weaponEmpty
        );


        if (
            this._mouseMoveHandler
        ) {

            document.removeEventListener(
                "mousemove",
                this._mouseMoveHandler
            );
        }


        if (
            this.root.parent
        ) {

            this.root.parent.remove(
                this.root
            );
        }


        for (
            const model
            of this.modelCache.values()
        ) {

            model.traverse(
                object => {

                    object.geometry
                        ?.dispose?.();


                    if (
                        Array.isArray(
                            object.material
                        )
                    ) {

                        object.material
                            .forEach(
                                material =>
                                    material
                                        ?.dispose?.()
                            );

                    } else {

                        object.material
                            ?.dispose?.();
                    }
                }
            );
        }


        this.modelCache.clear();


        this.currentModel =
            null;

        this.currentWeapon =
            null;

        this.currentWeaponId =
            null;

        this.camera =
            null;

        this.player =
            null;
    }
}


// ============================================================
// Export
// ============================================================

export default WeaponView;