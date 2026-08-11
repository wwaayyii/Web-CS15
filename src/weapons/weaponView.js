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
    KNIFE: "knife",

    GRENADE_DRAW: "grenade_draw",
    GRENADE_PRIME: "grenade_prime",
    GRENADE_THROW: "grenade_throw",
    GRENADE_RECOVER: "grenade_recover"
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
        // Muzzle Smoke V1
        // ====================================================

        this.muzzleSmokeParticles =
            [];


        this.muzzleSmokeMaterial =
            null;


        this.muzzleSmokeGeometry =
            null;


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


        // ====================================================
        // Weapon Feedback V2
        //
        // Visual-only recoil impulse.
        // Does NOT affect camera, raycast, damage or spread.
        // ====================================================

        this.visualKickVelocity =
            0;

        this.visualLiftVelocity =
            0;

        this.visualRollVelocity =
            0;


        this.reloadTime =
            0;


        this.reloadDuration =
            1;


        // Reload Animation V2
        this.reloadMagazine =
            null;

        this.reloadEjectedMagazine =
            null;

        this.reloadMagazineBasePosition =
            new THREE.Vector3();

        this.reloadMagazineBaseRotation =
            new THREE.Euler();

        this.reloadMagazineBaseScale =
            new THREE.Vector3(
                1,
                1,
                1
            );


        // Reload Sound V2 stage guards
        this.reloadSoundStages =
            {
                magRelease: false,
                magOut: false,
                magIn: false,
                action: false
            };


        this.drawTime =
            0;

        this.drawDuration =
            0.36;


        this.knifeTime =
            0;

        this.knifeDuration =
            0.36;


        // ====================================================
        // Grenade First Person V1
        // ====================================================

        this.grenadeMode = false;

        this.currentGrenadeType = null;

        this.grenadePrimeHeld = false;

        this.grenadeThrowCommitted = false;

        this.grenadeTime = 0;

        this.grenadeDrawDuration = 0.28;

        this.grenadeThrowDuration = 0.46;

        this.grenadeRecoverDuration = 0.24;


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

        this.createMuzzleSmokeResources();

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


                this.resetReloadMagazine();

                this.clearReloadEjectedMagazine();

                this.reloadMagazine =
                    null;

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


        this._handlers.grenadeSelected =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.setGrenade(
                    data.type
                );
            };


        this._handlers.grenadeHolster =
            data => {

                if (
                    data.owner !==
                    this.player
                ) {
                    return;
                }


                this.restoreCurrentWeaponView();
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


        gameEvents.on(
            "grenade:selected",
            this._handlers.grenadeSelected
        );


        gameEvents.on(
            "grenade:holster",
            this._handlers.grenadeHolster
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


        this.grenadeMode = false;

        this.currentGrenadeType = null;

        this.grenadePrimeHeld = false;

        this.grenadeThrowCommitted = false;


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


        this.clearReloadEjectedMagazine();

        this.reloadMagazine =
            null;


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



    // ========================================================
    // Grenade First Person V1
    // ========================================================

    setGrenade(type) {

        if (
            ![
                "he",
                "flash",
                "smoke"
            ].includes(type)
        ) {
            return false;
        }


        this.clearReloadEjectedMagazine();

        this.reloadMagazine = null;

        this.grenadeMode = true;

        this.currentGrenadeType = type;

        this.currentWeapon = null;

        this.currentWeaponId = type;


        this.clearWeaponModel();


        let model =
            this.modelCache.get(
                `grenade:${type}`
            );


        if (!model) {

            model =
                this.createGrenade(type);


            this.modelCache.set(
                `grenade:${type}`,
                model
            );
        }


        this.currentModel = model;

        this.currentModel.visible = true;

        this.weaponRoot.add(
            this.currentModel
        );


        this.applyWeaponTransform(type);


        this.grenadePrimeHeld = false;

        this.grenadeThrowCommitted = false;

        this.grenadeTime = 0;

        this.state =
            WEAPON_VIEW_STATE.GRENADE_DRAW;


        return true;
    }


    restoreCurrentWeaponView() {

        this.grenadeMode = false;

        this.currentGrenadeType = null;

        this.grenadePrimeHeld = false;

        this.grenadeThrowCommitted = false;


        const weapon =
            this.player
                ?.inventory
                ?.currentWeapon;


        if (weapon) {

            this.currentWeaponId = null;

            this.setWeapon(weapon);
        }


        return true;
    }


    beginGrenadePrime() {

        if (
            !this.grenadeMode ||
            !this.currentGrenadeType ||
            this.state ===
                WEAPON_VIEW_STATE.GRENADE_THROW ||
            this.state ===
                WEAPON_VIEW_STATE.GRENADE_RECOVER
        ) {
            return false;
        }


        this.grenadePrimeHeld = true;

        this.grenadeTime = 0;

        this.state =
            WEAPON_VIEW_STATE.GRENADE_PRIME;


        return true;
    }


    releaseGrenadeThrow() {

        if (
            !this.grenadeMode ||
            !this.grenadePrimeHeld ||
            this.state !==
                WEAPON_VIEW_STATE.GRENADE_PRIME
        ) {
            return false;
        }


        this.grenadePrimeHeld = false;

        this.grenadeThrowCommitted = false;

        this.grenadeTime = 0;

        this.state =
            WEAPON_VIEW_STATE.GRENADE_THROW;


        return true;
    }


    isGrenadeBusy() {

        return (
            this.state ===
                WEAPON_VIEW_STATE.GRENADE_PRIME ||
            this.state ===
                WEAPON_VIEW_STATE.GRENADE_THROW ||
            this.state ===
                WEAPON_VIEW_STATE.GRENADE_RECOVER
        );
    }


    updateGrenadeAnimation(delta) {

        this.grenadeTime += delta;


        if (
            this.state ===
            WEAPON_VIEW_STATE.GRENADE_DRAW
        ) {

            const t =
                smoothstep(
                    clamp01(
                        this.grenadeTime /
                        this.grenadeDrawDuration
                    )
                );


            this.weaponRoot.position.y -=
                (1 - t) * 0.42;

            this.weaponRoot.position.x +=
                (1 - t) * 0.16;

            this.weaponRoot.rotation.z +=
                (1 - t) * 0.36;


            if (t >= 1) {

                this.state =
                    WEAPON_VIEW_STATE.IDLE;

                this.grenadeTime = 0;
            }


            return;
        }


        if (
            this.state ===
            WEAPON_VIEW_STATE.GRENADE_PRIME
        ) {

            const t =
                smoothstep(
                    clamp01(
                        this.grenadeTime /
                        0.16
                    )
                );


            this.weaponRoot.position.x -=
                t * 0.10;

            this.weaponRoot.position.y +=
                t * 0.055;

            this.weaponRoot.position.z +=
                t * 0.10;

            this.weaponRoot.rotation.x -=
                t * 0.18;

            this.weaponRoot.rotation.z -=
                t * 0.22;


            return;
        }


        if (
            this.state ===
            WEAPON_VIEW_STATE.GRENADE_THROW
        ) {

            const rawT =
                clamp01(
                    this.grenadeTime /
                    this.grenadeThrowDuration
                );


            if (rawT < 0.38) {

                const back =
                    smoothstep(
                        rawT / 0.38
                    );


                this.weaponRoot.position.x -=
                    back * 0.18;

                this.weaponRoot.position.y -=
                    back * 0.05;

                this.weaponRoot.position.z +=
                    back * 0.15;

                this.weaponRoot.rotation.x -=
                    back * 0.30;

                this.weaponRoot.rotation.z -=
                    back * 0.34;

            } else {

                const forward =
                    smoothstep(
                        (rawT - 0.38) /
                        0.62
                    );


                this.weaponRoot.position.x -=
                    0.18;

                this.weaponRoot.position.x +=
                    forward * 0.28;

                this.weaponRoot.position.y +=
                    forward * 0.13;

                this.weaponRoot.position.z -=
                    forward * 0.48;

                this.weaponRoot.rotation.x +=
                    forward * 0.72;

                this.weaponRoot.rotation.z +=
                    forward * 0.48;
            }


            if (
                rawT >= 0.60 &&
                !this.grenadeThrowCommitted
            ) {

                this.grenadeThrowCommitted = true;


                const thrown =
                    this.player
                        ?.commitGrenadeThrow?.(
                            this.currentGrenadeType,
                            1
                        );


                if (
                    thrown &&
                    this.currentModel
                ) {

                    this.currentModel.visible =
                        false;
                }
            }


            if (rawT >= 1) {

                this.state =
                    WEAPON_VIEW_STATE.GRENADE_RECOVER;

                this.grenadeTime = 0;
            }


            return;
        }


        if (
            this.state ===
            WEAPON_VIEW_STATE.GRENADE_RECOVER
        ) {

            const t =
                smoothstep(
                    clamp01(
                        this.grenadeTime /
                        this.grenadeRecoverDuration
                    )
                );


            this.weaponRoot.position.y -=
                t * 0.38;


            if (t >= 1) {

                if (this.currentModel) {

                    this.currentModel.visible =
                        true;
                }


                this.player
                    ?.exitGrenadeMode?.({
                        restoreWeapon: true
                    });


                this.grenadeTime = 0;
            }
        }
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


        // detachable magazine (Reload Animation V2)
        const magazine =
            createBox(
                new THREE.Vector3(
                    0.085,
                    0.23,
                    0.10
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.28,
                    0.02
                )
            );

        magazine.name =
            "WEAPON_MAGAZINE";

        magazine.userData.weaponMagazine =
            true;

        group.add(
            magazine
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


        // detachable magazine (Reload Animation V2)
        const magazine =
            createBox(
                new THREE.Vector3(
                    0.085,
                    0.23,
                    0.10
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    -0.28,
                    0.02
                )
            );

        magazine.name =
            "WEAPON_MAGAZINE";

        magazine.userData.weaponMagazine =
            true;

        group.add(
            magazine
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

        mag.name =
            "WEAPON_MAGAZINE";

        mag.userData.weaponMagazine =
            true;


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


        // magazine
        const mag =
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
            );

        mag.name =
            "WEAPON_MAGAZINE";

        mag.userData.weaponMagazine =
            true;

        group.add(
            mag
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

        mag.name =
            "WEAPON_MAGAZINE";

        mag.userData.weaponMagazine =
            true;


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


        if (type === "he") {

            const body =
                new THREE.Mesh(
                    new THREE.SphereGeometry(
                        0.15,
                        12,
                        10
                    ),
                    mat.green
                );


            body.scale.set(
                0.92,
                1.10,
                0.92
            );


            body.position.z =
                -0.16;


            group.add(body);


            group.add(
                createBox(
                    new THREE.Vector3(
                        0.11,
                        0.065,
                        0.10
                    ),
                    mat.black,
                    new THREE.Vector3(
                        0,
                        0.15,
                        -0.15
                    )
                )
            );

        } else if (type === "flash") {

            group.add(
                createCylinder(
                    0.115,
                    0.34,
                    mat.light,
                    new THREE.Vector3(
                        0,
                        0,
                        -0.17
                    ),
                    new THREE.Vector3(
                        Math.PI / 2,
                        0,
                        0
                    ),
                    12
                )
            );


            group.add(
                createCylinder(
                    0.122,
                    0.035,
                    mat.black,
                    new THREE.Vector3(
                        0,
                        0,
                        -0.02
                    ),
                    new THREE.Vector3(
                        Math.PI / 2,
                        0,
                        0
                    ),
                    12
                )
            );


            group.add(
                createCylinder(
                    0.122,
                    0.035,
                    mat.black,
                    new THREE.Vector3(
                        0,
                        0,
                        -0.32
                    ),
                    new THREE.Vector3(
                        Math.PI / 2,
                        0,
                        0
                    ),
                    12
                )
            );

        } else {

            group.add(
                createCylinder(
                    0.135,
                    0.38,
                    mat.dark,
                    new THREE.Vector3(
                        0,
                        0,
                        -0.18
                    ),
                    new THREE.Vector3(
                        Math.PI / 2,
                        0,
                        0
                    ),
                    12
                )
            );


            group.add(
                createBox(
                    new THREE.Vector3(
                        0.16,
                        0.045,
                        0.10
                    ),
                    mat.green,
                    new THREE.Vector3(
                        0,
                        0.02,
                        -0.17
                    )
                )
            );
        }


        group.add(
            createBox(
                new THREE.Vector3(
                    0.105,
                    0.055,
                    0.10
                ),
                mat.black,
                new THREE.Vector3(
                    0,
                    0.10,
                    -0.02
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

				this.basePosition.set(
					0.34,
					-0.38,
					-0.48
				);

				scale =
					1.15;

				break;


			case "flash":

				this.basePosition.set(
					0.35,
					-0.39,
					-0.53
				);

				scale =
					0.88;

				break;


			case "smoke":

				this.basePosition.set(
					0.35,
					-0.40,
					-0.55
				);

				scale =
					0.82;

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
    // Muzzle Flash V2
    // ========================================================

    createMuzzleFlash() {

        const group =
            new THREE.Group();


        group.name =
            "MUZZLE_FLASH_V2";


        // ----------------------------------------------------
        // Outer flash
        // ----------------------------------------------------

        const outerGeometry =
            new THREE.PlaneGeometry(
                0.30,
                0.30
            );


        const outerMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0xffa62b,

                transparent:
                    true,

                opacity:
                    0,

                depthWrite:
                    false,

                depthTest:
                    false,

                side:
                    THREE.DoubleSide,

                blending:
                    THREE.AdditiveBlending
            });


        const outer =
            new THREE.Mesh(
                outerGeometry,
                outerMaterial
            );


        outer.name =
            "MUZZLE_FLASH_OUTER";


        group.add(
            outer
        );


        // ----------------------------------------------------
        // Bright core
        // ----------------------------------------------------

        const coreGeometry =
            new THREE.PlaneGeometry(
                0.16,
                0.16
            );


        const coreMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0xfff3a0,

                transparent:
                    true,

                opacity:
                    0,

                depthWrite:
                    false,

                depthTest:
                    false,

                side:
                    THREE.DoubleSide,

                blending:
                    THREE.AdditiveBlending
            });


        const core =
            new THREE.Mesh(
                coreGeometry,
                coreMaterial
            );


        core.position.z =
            -0.012;


        core.name =
            "MUZZLE_FLASH_CORE";


        group.add(
            core
        );


        this.muzzleFlash =
            group;


        this.muzzleFlash.userData.outer =
            outer;


        this.muzzleFlash.userData.core =
            core;


        this.muzzleAnchor.add(
            this.muzzleFlash
        );


        // ----------------------------------------------------
        // Point light
        // ----------------------------------------------------

        this.muzzleLight =
            new THREE.PointLight(
                0xffb13b,
                0,
                4.6
            );


        this.muzzleLight.decay =
            2;


        this.muzzleAnchor.add(
            this.muzzleLight
        );
    }


    // ========================================================
    // Muzzle Smoke Resources V1
    // ========================================================

    createMuzzleSmokeResources() {

        this.muzzleSmokeGeometry =
            new THREE.PlaneGeometry(
                0.18,
                0.18
            );


        this.muzzleSmokeMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0x8b8b8b,

                transparent:
                    true,

                opacity:
                    0.18,

                depthWrite:
                    false,

                side:
                    THREE.DoubleSide
            });
    }


    getMuzzleProfile(
        weaponId =
            this.currentWeaponId
    ) {

        switch (
            weaponId
        ) {

            case "usp":

                return {
                    flashScale:
                        0.58,

                    light:
                        0.75,

                    smokeChance:
                        0.18
                };


            case "mp5":

                return {
                    flashScale:
                        0.72,

                    light:
                        1.35,

                    smokeChance:
                        0.34
                };


            case "glock":

                return {
                    flashScale:
                        0.82,

                    light:
                        1.65,

                    smokeChance:
                        0.28
                };


            case "m4a1":

                return {
                    flashScale:
                        0.92,

                    light:
                        2.10,

                    smokeChance:
                        0.42
                };


            case "ak47":

                return {
                    flashScale:
                        1.12,

                    light:
                        2.85,

                    smokeChance:
                        0.60
                };


            case "deagle":

                return {
                    flashScale:
                        1.22,

                    light:
                        3.10,

                    smokeChance:
                        0.48
                };


            case "awp":

                return {
                    flashScale:
                        1.42,

                    light:
                        3.65,

                    smokeChance:
                        0.72
                };


            case "scout":

                return {
                    flashScale:
                        1.10,

                    light:
                        2.55,

                    smokeChance:
                        0.52
                };


            default:

                return {
                    flashScale:
                        0.88,

                    light:
                        1.90,

                    smokeChance:
                        0.35
                };
        }
    }


    triggerMuzzleFlash() {

        if (
            !this.muzzleFlash
        ) {
            return;
        }


        const profile =
            this.getMuzzleProfile();


        this.muzzleFlashTime =
            0.050;


        const outer =
            this.muzzleFlash
                .userData
                .outer;


        const core =
            this.muzzleFlash
                .userData
                .core;


        if (
            outer
        ) {

            outer.material.opacity =
                1;


            outer.rotation.z =
                Math.random() *
                Math.PI;


            const outerScale =
                profile.flashScale *
                (
                    0.82 +
                    Math.random() *
                    0.42
                );


            outer.scale.set(
                outerScale,
                outerScale *
                    (
                        0.88 +
                        Math.random() *
                        0.22
                    ),
                1
            );
        }


        if (
            core
        ) {

            core.material.opacity =
                1;


            core.rotation.z =
                Math.random() *
                Math.PI;


            const coreScale =
                profile.flashScale *
                (
                    0.72 +
                    Math.random() *
                    0.20
                );


            core.scale.setScalar(
                coreScale
            );
        }


        if (
            this.muzzleLight
        ) {

            this.muzzleLight.intensity =
                profile.light;


            this.muzzleLight.distance =
                3.4 +
                profile.flashScale *
                1.2;
        }


        if (
            Math.random() <
            profile.smokeChance
        ) {

            this.spawnMuzzleSmoke(
                profile
            );
        }
    }


    // ========================================================
    // Muzzle Smoke V1
    // ========================================================

    spawnMuzzleSmoke(
        profile
    ) {

        if (
            !this.muzzleSmokeGeometry ||
            !this.muzzleSmokeMaterial ||
            !this.muzzleAnchor
        ) {

            return;
        }


        /*
         * 为每个粒子 clone material，
         * 这样 opacity 可以独立变化。
         */
        const material =
            this.muzzleSmokeMaterial
                .clone();


        const particle =
            new THREE.Mesh(
                this.muzzleSmokeGeometry,
                material
            );


        particle.position.set(
            (
                Math.random() -
                0.5
            ) *
                0.035,

            0.015 +
                Math.random() *
                0.025,

            -0.025
        );


        const scale =
            profile.flashScale *
            (
                0.55 +
                Math.random() *
                0.35
            );


        particle.scale.setScalar(
            scale
        );


        particle.rotation.z =
            Math.random() *
            Math.PI;


        this.muzzleAnchor.add(
            particle
        );


        this.muzzleSmokeParticles.push({
            mesh:
                particle,

            life:
                0.42 +
                Math.random() *
                0.18,

            age:
                0,

            rise:
                0.11 +
                Math.random() *
                0.08,

            drift:
                (
                    Math.random() -
                    0.5
                ) *
                0.06,

            spin:
                (
                    Math.random() -
                    0.5
                ) *
                1.4
        });


        /*
         * 防止极端连射积累太多粒子。
         */
        while (
            this.muzzleSmokeParticles.length >
            14
        ) {

            const oldest =
                this.muzzleSmokeParticles
                    .shift();


            oldest?.mesh
                ?.parent
                ?.remove(
                    oldest.mesh
                );


            oldest?.mesh
                ?.material
                ?.dispose?.();
        }
    }


    updateMuzzleSmoke(
        delta
    ) {

        for (
            let index =
                this.muzzleSmokeParticles
                    .length -
                    1;

            index >=
                0;

            index--
        ) {

            const particle =
                this.muzzleSmokeParticles[
                    index
                ];


            particle.age +=
                delta;


            const t =
                clamp01(
                    particle.age /
                    particle.life
                );


            particle.mesh.position.y +=
                particle.rise *
                delta;


            particle.mesh.position.x +=
                particle.drift *
                delta;


            particle.mesh.position.z -=
                0.035 *
                delta;


            particle.mesh.rotation.z +=
                particle.spin *
                delta;


            const grow =
                1 +
                delta *
                1.25;


            particle.mesh.scale
                .multiplyScalar(
                    grow
                );


            particle.mesh.material.opacity =
                (
                    1 -
                    t
                ) *
                0.16;


            if (
                t >=
                1
            ) {

                particle.mesh
                    .parent
                    ?.remove(
                        particle.mesh
                    );


                particle.mesh
                    .material
                    ?.dispose?.();


                this.muzzleSmokeParticles
                    .splice(
                        index,
                        1
                    );
            }
        }
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

            const outer =
                this.muzzleFlash
                    ?.userData
                    ?.outer;


            const core =
                this.muzzleFlash
                    ?.userData
                    ?.core;


            if (
                outer
            ) {

                outer.material.opacity =
                    0;
            }


            if (
                core
            ) {

                core.material.opacity =
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
                0.050
            );


        const outer =
            this.muzzleFlash
                ?.userData
                ?.outer;


        const core =
            this.muzzleFlash
                ?.userData
                ?.core;


        if (
            outer
        ) {

            outer.material.opacity =
                t *
                0.92;
        }


        if (
            core
        ) {

            core.material.opacity =
                Math.min(
                    1,
                    t *
                    1.25
                );
        }


        if (
            this.muzzleLight
        ) {

            this.muzzleLight.intensity *=
                Math.max(
                    0,
                    1 -
                    delta *
                    24
                );
        }
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


        /*
         * Weapon Feedback V2:
         * add a short, sharp viewmodel impulse.
         *
         * fireKick/recoilRotation above provide the existing
         * sustained recoil. These velocities add the immediate
         * "snap" that makes each shot easier to feel.
         */
        this.visualKickVelocity =
            Math.min(
                0.22,
                this.visualKickVelocity +
                    kick *
                    1.35
            );


        this.visualLiftVelocity =
            Math.min(
                0.16,
                this.visualLiftVelocity +
                    rotation *
                    1.10
            );


        this.visualRollVelocity +=
            (
                Math.random() -
                0.5
            ) *
            rotation *
            0.55;


        this.visualRollVelocity =
            THREE.MathUtils.clamp(
                this.visualRollVelocity,
                -0.08,
                0.08
            );


        this.triggerMuzzleFlash();
    }


    // ========================================================
    // Reload
    // ========================================================

    getReloadProfile(
        weaponId =
            this.currentWeaponId
    ) {

        switch (weaponId) {

            case "deagle":
            case "glock":
            case "usp":
                return {
                    drop: 0.28,
                    side: 0.08,
                    roll: 0.42,
                    pitch: 0.18,
                    magDrop: 0.34,
                    magSide: 0.025
                };

            case "awp":
            case "scout":
                return {
                    drop: 0.24,
                    side: 0.13,
                    roll: 0.34,
                    pitch: 0.24,
                    magDrop: 0.22,
                    magSide: 0.02
                };

            case "mp5":
                return {
                    drop: 0.27,
                    side: 0.10,
                    roll: 0.48,
                    pitch: 0.17,
                    magDrop: 0.38,
                    magSide: 0.03
                };

            default:
                return {
                    drop: 0.30,
                    side: 0.11,
                    roll: 0.52,
                    pitch: 0.20,
                    magDrop: 0.40,
                    magSide: 0.035
                };
        }
    }


    findReloadMagazine() {

        let magazine =
            null;

        this.currentModel
            ?.traverse(
                object => {

                    if (
                        !magazine &&
                        object.userData
                            ?.weaponMagazine
                    ) {
                        magazine =
                            object;
                    }
                }
            );

        return magazine;
    }


    resetReloadMagazine() {

        if (
            !this.reloadMagazine
        ) {
            return;
        }

        this.reloadMagazine.position
            .copy(
                this.reloadMagazineBasePosition
            );

        this.reloadMagazine.rotation
            .copy(
                this.reloadMagazineBaseRotation
            );

        this.reloadMagazine.scale
            .copy(
                this.reloadMagazineBaseScale
            );

        this.reloadMagazine.visible =
            true;
    }


    clearReloadEjectedMagazine() {

        if (
            !this.reloadEjectedMagazine
        ) {
            return;
        }


        if (
            this.reloadEjectedMagazine.parent
        ) {

            this.reloadEjectedMagazine.parent.remove(
                this.reloadEjectedMagazine
            );
        }


        this.reloadEjectedMagazine =
            null;
    }


    createReloadEjectedMagazine() {

        this.clearReloadEjectedMagazine();


        if (
            !this.reloadMagazine
        ) {
            return;
        }


        const clone =
            this.reloadMagazine.clone(
                true
            );


        clone.name =
            "RELOAD_EJECTED_MAGAZINE";


        /*
         * Clone 与原弹匣共享 Geometry/Material。
         * 只作为短暂动画对象，不单独 dispose 共享资源。
         */
        clone.position
            .copy(
                this.reloadMagazine.position
            );


        clone.rotation
            .copy(
                this.reloadMagazine.rotation
            );


        clone.scale
            .copy(
                this.reloadMagazine.scale
            );


        /*
         * 放到 currentModel 中，保持和枪械相同的局部坐标，
         * 但它从此与原弹匣是两个独立对象。
         */
        this.currentModel.add(
            clone
        );


        this.reloadEjectedMagazine =
            clone;
    }


    emitReloadSoundStage(
        stage
    ) {

        console.log(
            "[ReloadDebug][WeaponView] emit stage:",
            stage,
            "weapon=",
            this.currentWeaponId,
            "t=",
            (
                this.reloadTime /
                Math.max(
                    0.001,
                    this.reloadDuration
                )
            ).toFixed(
                3
            )
        );


        gameEvents.emit(
            "weapon:reload-stage",
            {
                owner:
                    this.player,

                weapon:
                    this.currentWeapon,

                weaponId:
                    this.currentWeaponId,

                stage
            }
        );
    }


    onReload(weapon) {

        if (!weapon) {
            return;
        }

        console.log(
            "[ReloadDebug][WeaponView] onReload:",
            weapon.id,
            "duration=",
            weapon.config?.reloadTime
        );


        this.state =
            WEAPON_VIEW_STATE.RELOAD;

        this.stateTime =
            0;

        this.reloadTime =
            0;


        /*
         * Reload Sound V2
         * 每一次新的换弹动作都重新允许各阶段声音触发。
         */
        this.reloadSoundStages.magRelease =
            false;

        this.reloadSoundStages.magOut =
            false;

        this.reloadSoundStages.magIn =
            false;

        this.reloadSoundStages.action =
            false;


        this.reloadDuration =
            Math.max(
                0.4,
                weapon.config
                    ?.reloadTime ??
                2
            );


        this.reloadMagazine =
            this.findReloadMagazine();


        if (
            this.reloadMagazine
        ) {

            this.reloadMagazineBasePosition
                .copy(
                    this.reloadMagazine.position
                );

            this.reloadMagazineBaseRotation
                .copy(
                    this.reloadMagazine.rotation
                );

            this.reloadMagazineBaseScale
                .copy(
                    this.reloadMagazine.scale
                );


            this.createReloadEjectedMagazine();
        }
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


        const profile =
            this.getReloadProfile();


        // ----------------------------------------------------
        // Reload Sound V2
        // ----------------------------------------------------

        if (
            t >= 0.18 &&
            !this.reloadSoundStages.magRelease
        ) {

            this.reloadSoundStages.magRelease =
                true;

            this.emitReloadSoundStage(
                "mag-release"
            );
        }


        if (
            t >= 0.46 &&
            !this.reloadSoundStages.magOut
        ) {

            this.reloadSoundStages.magOut =
                true;

            this.emitReloadSoundStage(
                "mag-out"
            );
        }


        if (
            t >= 0.54 &&
            !this.reloadSoundStages.magIn
        ) {

            this.reloadSoundStages.magIn =
                true;

            this.emitReloadSoundStage(
                "mag-in"
            );
        }


        if (
            t >= 0.90 &&
            !this.reloadSoundStages.action
        ) {

            this.reloadSoundStages.action =
                true;

            this.emitReloadSoundStage(
                "action"
            );
        }


        /*
         * Reload Animation V2.1
         *
         * 0.00 - 0.18 : 枪身压低并转向
         * 0.18 - 0.46 : 旧弹匣明显退出
         * 0.46 - 0.54 : 换新弹匣
         * 0.54 - 0.78 : 新弹匣从下方插入
         * 0.78 - 1.00 : 枪身回到 ready
         */
        let pose =
            0;


        if (
            t <
            0.18
        ) {

            pose =
                smoothstep(
                    t /
                    0.18
                );

        } else if (
            t <
            0.78
        ) {

            pose =
                1;

        } else {

            pose =
                1 -
                smoothstep(
                    (
                        t -
                        0.78
                    ) /
                    0.22
                );
        }


        this.weaponRoot.position.y -=
            pose *
            profile.drop;


        this.weaponRoot.position.x +=
            pose *
            profile.side;


        this.weaponRoot.rotation.z +=
            pose *
            profile.roll;


        this.weaponRoot.rotation.x +=
            pose *
            profile.pitch;


        // ----------------------------------------------------
        // Original magazine = 新弹匣
        // ----------------------------------------------------

        if (
            this.reloadMagazine
        ) {

            this.resetReloadMagazine();


            /*
             * 旧弹匣退出期间，把枪上的原弹匣隐藏。
             */
            if (
                t >=
                    0.18 &&
                t <
                    0.54
            ) {

                this.reloadMagazine.visible =
                    false;

            } else if (
                t >=
                    0.54 &&
                t <
                    0.78
            ) {

                this.reloadMagazine.visible =
                    true;


                const insertT =
                    smoothstep(
                        (
                            t -
                            0.54
                        ) /
                        0.24
                    );


                /*
                 * 新弹匣从明显低于枪身的位置插入。
                 */
                const insertOffset =
                    1 -
                    insertT;


                this.reloadMagazine.position.y -=
                    insertOffset *
                    (
                        profile.magDrop +
                        0.16
                    );


                this.reloadMagazine.position.x +=
                    insertOffset *
                    (
                        profile.magSide +
                        0.055
                    );


                this.reloadMagazine.position.z +=
                    insertOffset *
                    0.045;


                this.reloadMagazine.rotation.z +=
                    insertOffset *
                    0.16;
            }
        }


        // ----------------------------------------------------
        // Ejected magazine = 旧弹匣
        // ----------------------------------------------------

        if (
            this.reloadEjectedMagazine
        ) {

            if (
                t <
                0.18
            ) {

                this.reloadEjectedMagazine.visible =
                    false;

            } else {

                this.reloadEjectedMagazine.visible =
                    true;


                const ejectT =
                    clamp01(
                        (
                            t -
                            0.18
                        ) /
                        0.30
                    );


                const eased =
                    smoothstep(
                        ejectT
                    );


                this.reloadEjectedMagazine.position
                    .copy(
                        this.reloadMagazineBasePosition
                    );


                this.reloadEjectedMagazine.rotation
                    .copy(
                        this.reloadMagazineBaseRotation
                    );


                /*
                 * 明显向下 + 向外掉落。
                 */
                this.reloadEjectedMagazine.position.y -=
                    eased *
                    (
                        profile.magDrop +
                        0.26
                    );


                this.reloadEjectedMagazine.position.x +=
                    eased *
                    (
                        profile.magSide +
                        0.10
                    );


                this.reloadEjectedMagazine.position.z +=
                    eased *
                    0.08;


                this.reloadEjectedMagazine.rotation.x +=
                    eased *
                    0.28;


                this.reloadEjectedMagazine.rotation.z +=
                    eased *
                    0.34;


                /*
                 * 旧弹匣掉出视野后直接隐藏，
                 * 防止后半段和新弹匣重叠。
                 */
                if (
                    t >
                    0.56
                ) {

                    this.reloadEjectedMagazine.visible =
                        false;
                }
            }
        }


        if (
            t >=
            1
        ) {

            this.resetReloadMagazine();

            this.clearReloadEjectedMagazine();

            this.reloadMagazine =
                null;

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
    //
    // Weapon Feedback V2
    // - immediate backward snap
    // - slight upward lift
    // - tiny random roll
    // - smooth return
    //
    // Visual only: camera / raycast / damage remain untouched.
    // ========================================================

    updateRecoil(
        delta
    ) {

        // ----------------------------------------------------
        // Existing sustained recoil
        // ----------------------------------------------------

        this.fireKick =
            damp(
                this.fireKick,
                0,
                13,
                delta
            );


        this.fireSideKick =
            damp(
                this.fireSideKick,
                0,
                11,
                delta
            );


        this.recoilRotation.x =
            damp(
                this.recoilRotation.x,
                0,
                14,
                delta
            );


        this.recoilRotation.z =
            damp(
                this.recoilRotation.z,
                0,
                11,
                delta
            );


        // ----------------------------------------------------
        // Fast visual impulse recovery
        // ----------------------------------------------------

        this.visualKickVelocity =
            damp(
                this.visualKickVelocity,
                0,
                22,
                delta
            );


        this.visualLiftVelocity =
            damp(
                this.visualLiftVelocity,
                0,
                20,
                delta
            );


        this.visualRollVelocity =
            damp(
                this.visualRollVelocity,
                0,
                18,
                delta
            );


        // ----------------------------------------------------
        // Apply to first-person weapon model only
        // ----------------------------------------------------

        this.weaponRoot.position.z +=
            this.fireKick +
            this.visualKickVelocity;


        this.weaponRoot.position.x +=
            this.fireSideKick;


        /*
         * Negative X rotation lifts the muzzle visually.
         */
        this.weaponRoot.rotation.x -=
            this.recoilRotation.x +
            this.visualLiftVelocity;


        this.weaponRoot.rotation.z +=
            this.recoilRotation.z +
            this.visualRollVelocity;
    }


    // ========================================================
    // Flash update
    // ========================================================

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


            case WEAPON_VIEW_STATE.GRENADE_DRAW:
            case WEAPON_VIEW_STATE.GRENADE_PRIME:
            case WEAPON_VIEW_STATE.GRENADE_THROW:
            case WEAPON_VIEW_STATE.GRENADE_RECOVER:

                this.updateGrenadeAnimation(
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


        this.updateMuzzleSmoke(
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


        gameEvents.off(
            "grenade:selected",
            this._handlers.grenadeSelected
        );


        gameEvents.off(
            "grenade:holster",
            this._handlers.grenadeHolster
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


        for (
            const particle
            of this.muzzleSmokeParticles
        ) {

            particle.mesh
                ?.parent
                ?.remove(
                    particle.mesh
                );


            particle.mesh
                ?.material
                ?.dispose?.();
        }


        this.muzzleSmokeParticles.length =
            0;


        this.muzzleSmokeGeometry
            ?.dispose?.();


        this.muzzleSmokeMaterial
            ?.dispose?.();


        this.muzzleSmokeGeometry =
            null;


        this.muzzleSmokeMaterial =
            null;


        this.clearReloadEjectedMagazine();

        this.reloadMagazine =
            null;


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