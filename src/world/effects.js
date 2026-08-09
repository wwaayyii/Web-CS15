/**
 * Web-CS15
 * src/world/effects.js
 *
 * 视觉特效系统：
 * - 枪口火焰
 * - 弹孔
 * - 命中特效
 * - 爆炸球
 * - 爆炸火花
 * - 受伤闪屏
 * - Hitmarker
 * - 简易屏幕抖动
 * - 临时光源
 *
 * 注意：
 * 这个模块依赖 Three.js。
 */

import * as THREE from "three";

import {
    GRAPHICS_CONFIG,
    HUD_CONFIG
} from "../core/config.js";

import {
    clamp,
    randomRange,
    gameEvents
} from "../core/utils.js";


// ============================================================
// EffectsSystem
// ============================================================

export class EffectsSystem {

    constructor() {

        this.scene = null;

        this.camera = null;

        this.renderer = null;

        this.initialized = false;

        this.activeEffects = [];

        this.cameraShake = {
            amount: 0,
            duration: 0,
            elapsed: 0,
            originalPosition: new THREE.Vector3()
        };

        this.hitmarkerElement = null;

        this.damageOverlayElement = null;
    }


    // ========================================================
    // 初始化
    // ========================================================

    init({
        scene,
        camera,
        renderer,
        hitmarkerElement = null,
        damageOverlayElement = null
    } = {}) {

        if (!scene) {
            throw new Error(
                "[EffectsSystem] scene is required."
            );
        }

        if (!camera) {
            throw new Error(
                "[EffectsSystem] camera is required."
            );
        }

        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer || null;

        this.hitmarkerElement =
            hitmarkerElement ||
            document.getElementById(
                "hitmarker"
            );

        this.damageOverlayElement =
            damageOverlayElement ||
            document.getElementById(
                "damage-indicator"
            );

        this.initialized = true;

        return this;
    }


    // ========================================================
    // Update
    // ========================================================

    update(delta) {

        if (!this.initialized) {
            return;
        }

        this._updateTimedEffects(delta);

        this._updateCameraShake(delta);
    }


    _updateTimedEffects(delta) {

        for (
            let i =
                this.activeEffects.length - 1;
            i >= 0;
            i--
        ) {

            const effect =
                this.activeEffects[i];

            effect.elapsed += delta;

            if (
                typeof effect.update ===
                "function"
            ) {

                effect.update(
                    delta,
                    effect
                );
            }

            if (
                effect.elapsed >=
                effect.duration
            ) {

                this._destroyEffect(
                    effect
                );

                this.activeEffects.splice(
                    i,
                    1
                );
            }
        }
    }


    _destroyEffect(effect) {

        if (!effect) {
            return;
        }

        if (
            typeof effect.destroy ===
            "function"
        ) {

            effect.destroy();

            return;
        }

        if (effect.object) {

            this._disposeObject(
                effect.object
            );
        }
    }


    _disposeObject(object) {

        if (!object) {
            return;
        }

        object.traverse?.(
            child => {

                if (child.geometry) {
                    child.geometry.dispose?.();
                }

                if (child.material) {

                    if (
                        Array.isArray(
                            child.material
                        )
                    ) {

                        child.material.forEach(
                            material =>
                                material.dispose?.()
                        );

                    } else {

                        child.material.dispose?.();
                    }
                }
            }
        );

        if (object.parent) {

            object.parent.remove(
                object
            );
        }
    }


    // ========================================================
    // 枪口火焰
    // ========================================================

    createMuzzleFlash({
        parent,
        position =
            new THREE.Vector3(
                0,
                0,
                -0.6
            ),
        size = 0.08,
        duration =
            GRAPHICS_CONFIG.effects
                .muzzleFlashDuration /
            1000
    } = {}) {

        if (
            !this.initialized ||
            !parent
        ) {
            return null;
        }

        const group =
            new THREE.Group();

        group.position.copy(
            position
        );

        const flashMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffdd44,
                transparent: true,
                opacity: 1,
                depthWrite: false
            });

        const flashMesh =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    size,
                    8,
                    8
                ),
                flashMaterial
            );

        group.add(
            flashMesh
        );

        const light =
            new THREE.PointLight(
                0xffaa00,
                3,
                8
            );

        group.add(
            light
        );

        parent.add(
            group
        );

        const effect = {
            object: group,
            duration,
            elapsed: 0,

            update: (
                delta,
                state
            ) => {

                const t =
                    clamp(
                        state.elapsed /
                        state.duration,
                        0,
                        1
                    );

                flashMaterial.opacity =
                    1 - t;

                light.intensity =
                    3 *
                    (1 - t);

                group.scale.setScalar(
                    1 + t * 0.5
                );
            },

            destroy: () => {

                if (group.parent) {
                    group.parent.remove(
                        group
                    );
                }

                flashMesh.geometry.dispose();
                flashMaterial.dispose();
            }
        };

        this.activeEffects.push(
            effect
        );

        return effect;
    }


    // ========================================================
    // 弹孔
    // ========================================================

    createBulletHole(
        point,
        normal,
        {
            size = 0.18,
            lifetime =
                GRAPHICS_CONFIG.effects
                    .bulletHoleLifetime /
                1000,
            color = 0x111111
        } = {}
    ) {

        if (
            !this.initialized ||
            !point ||
            !normal
        ) {
            return null;
        }

        const geometry =
            new THREE.PlaneGeometry(
                size,
                size
            );

        const material =
            new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                transparent: true,
                opacity: 0.85,
                depthWrite: false
            });

        const decal =
            new THREE.Mesh(
                geometry,
                material
            );

        decal.position
            .copy(point)
            .add(
                normal
                    .clone()
                    .multiplyScalar(
                        0.012
                    )
            );

        decal.lookAt(
            point
                .clone()
                .add(normal)
        );

        decal.rotateZ(
            randomRange(
                0,
                Math.PI * 2
            )
        );

        this.scene.add(
            decal
        );

        const effect = {
            object: decal,
            duration: lifetime,
            elapsed: 0,

            update: (
                delta,
                state
            ) => {

                const fadeStart =
                    state.duration *
                    0.75;

                if (
                    state.elapsed >
                    fadeStart
                ) {

                    const t =
                        clamp(
                            (
                                state.elapsed -
                                fadeStart
                            )
                            /
                            (
                                state.duration -
                                fadeStart
                            ),
                            0,
                            1
                        );

                    material.opacity =
                        0.85 *
                        (1 - t);
                }
            }
        };

        this.activeEffects.push(
            effect
        );

        return decal;
    }


    // ========================================================
    // 简易命中火花
    // ========================================================

    createImpactSpark(
        point,
        {
            count = 5,
            lifetime = 0.25
        } = {}
    ) {

        if (
            !this.initialized ||
            !point
        ) {
            return;
        }

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const geometry =
                new THREE.SphereGeometry(
                    0.025,
                    4,
                    4
                );

            const material =
                new THREE.MeshBasicMaterial({
                    color: 0xffcc66,
                    transparent: true,
                    opacity: 1
                });

            const particle =
                new THREE.Mesh(
                    geometry,
                    material
                );

            particle.position.copy(
                point
            );

            this.scene.add(
                particle
            );

            const velocity =
                new THREE.Vector3(
                    randomRange(
                        -2,
                        2
                    ),
                    randomRange(
                        0.5,
                        3
                    ),
                    randomRange(
                        -2,
                        2
                    )
                );

            const effect = {
                object: particle,
                duration: lifetime,
                elapsed: 0,

                update: (
                    delta,
                    state
                ) => {

                    velocity.y -=
                        8 *
                        delta;

                    particle.position.addScaledVector(
                        velocity,
                        delta
                    );

                    const t =
                        clamp(
                            state.elapsed /
                            state.duration,
                            0,
                            1
                        );

                    material.opacity =
                        1 - t;
                }
            };

            this.activeEffects.push(
                effect
            );
        }
    }


    // ========================================================
    // 爆炸视觉
    // ========================================================

    createExplosion(
        position,
        {
            radius = 3.5,
            duration = 0.35,
            createLight = true,
            createSparks = true,
            shakeCamera = true
        } = {}
    ) {

        if (
            !this.initialized ||
            !position
        ) {
            return;
        }

        const material =
            new THREE.MeshBasicMaterial({
                color: 0xff4500,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            });

        const mesh =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    radius,
                    16,
                    16
                ),
                material
            );

        mesh.position.copy(
            position
        );

        mesh.scale.setScalar(
            0.25
        );

        this.scene.add(
            mesh
        );

        let light = null;

        if (createLight) {

            light =
                new THREE.PointLight(
                    0xff6600,
                    6,
                    18
                );

            light.position.copy(
                position
            );

            this.scene.add(
                light
            );
        }

        const effect = {
            object: mesh,
            duration,
            elapsed: 0,

            update: (
                delta,
                state
            ) => {

                const t =
                    clamp(
                        state.elapsed /
                        state.duration,
                        0,
                        1
                    );

                const scale =
                    0.25 +
                    t *
                    1.5;

                mesh.scale.setScalar(
                    scale
                );

                material.opacity =
                    0.9 *
                    (1 - t);

                if (light) {

                    light.intensity =
                        6 *
                        (1 - t);
                }
            },

            destroy: () => {

                if (mesh.parent) {
                    mesh.parent.remove(
                        mesh
                    );
                }

                if (
                    light &&
                    light.parent
                ) {

                    light.parent.remove(
                        light
                    );
                }

                mesh.geometry.dispose();
                material.dispose();
            }
        };

        this.activeEffects.push(
            effect
        );

        if (createSparks) {

            this.createExplosionSparks(
                position
            );
        }

        if (shakeCamera) {

            this.addCameraShake(
                0.08,
                0.20
            );
        }
    }


    // ========================================================
    // 爆炸碎屑
    // ========================================================

    createExplosionSparks(
        position,
        count = 14
    ) {

        if (!this.initialized) {
            return;
        }

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const geometry =
                new THREE.SphereGeometry(
                    randomRange(
                        0.025,
                        0.06
                    ),
                    4,
                    4
                );

            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        Math.random() > 0.5
                            ? 0xffaa00
                            : 0xff5500,

                    transparent: true,
                    opacity: 1
                });

            const spark =
                new THREE.Mesh(
                    geometry,
                    material
                );

            spark.position.copy(
                position
            );

            this.scene.add(
                spark
            );

            const velocity =
                new THREE.Vector3(
                    randomRange(
                        -7,
                        7
                    ),
                    randomRange(
                        2,
                        8
                    ),
                    randomRange(
                        -7,
                        7
                    )
                );

            const lifetime =
                randomRange(
                    0.25,
                    0.55
                );

            this.activeEffects.push({
                object: spark,
                duration: lifetime,
                elapsed: 0,

                update: (
                    delta,
                    state
                ) => {

                    velocity.y -=
                        12 *
                        delta;

                    spark.position.addScaledVector(
                        velocity,
                        delta
                    );

                    const t =
                        clamp(
                            state.elapsed /
                            state.duration,
                            0,
                            1
                        );

                    spark.scale.setScalar(
                        1 - t * 0.6
                    );

                    material.opacity =
                        1 - t;
                }
            });
        }
    }


    // ========================================================
    // Hitmarker
    // ========================================================

    showHitmarker({
        kill = false
    } = {}) {

        const element =
            this.hitmarkerElement;

        if (!element) {
            return;
        }

        const lines =
            element.querySelectorAll(
                ".hit-line"
            );

        lines.forEach(
            line => {

                line.style.backgroundColor =
                    kill
                        ? "#ff3333"
                        : "#ffffff";

                line.style.boxShadow =
                    kill
                        ? "0 0 6px #ff3333"
                        : "0 0 4px #ffffff";
            }
        );

        element.style.opacity =
            "1";

        element.style.transform =
            kill
                ? "scale(1.3)"
                : "scale(1)";

        window.setTimeout(
            () => {

                element.style.opacity =
                    "0";

            },
            kill
                ? HUD_CONFIG.hitmarker
                    .killDuration
                : HUD_CONFIG.hitmarker
                    .duration
        );
    }


    // ========================================================
    // 玩家受伤闪屏
    // ========================================================

    showDamageOverlay(
        strength = 1
    ) {

        const element =
            this.damageOverlayElement;

        if (!element) {
            return;
        }

        element.style.opacity =
            String(
                clamp(
                    strength,
                    0,
                    1
                )
            );

        window.setTimeout(
            () => {

                element.style.opacity =
                    "0";

            },
            GRAPHICS_CONFIG.effects
                .damageFlashDuration
        );
    }


    // ========================================================
    // Camera Shake
    // ========================================================

    addCameraShake(
        amount = 0.05,
        duration = 0.15
    ) {

        if (
            !this.camera ||
            amount <= 0 ||
            duration <= 0
        ) {
            return;
        }

        this.cameraShake.amount =
            Math.max(
                this.cameraShake.amount,
                amount
            );

        this.cameraShake.duration =
            Math.max(
                this.cameraShake.duration,
                duration
            );

        this.cameraShake.elapsed = 0;

        this.cameraShake
            .originalPosition
            .copy(
                this.camera.position
            );
    }


    _updateCameraShake(delta) {

        const shake =
            this.cameraShake;

        if (
            shake.duration <= 0
        ) {
            return;
        }

        shake.elapsed += delta;

        const t =
            clamp(
                shake.elapsed /
                shake.duration,
                0,
                1
            );

        const strength =
            shake.amount *
            (1 - t);

        this.camera.position.x =
            shake.originalPosition.x +
            randomRange(
                -strength,
                strength
            );

        this.camera.position.y =
            shake.originalPosition.y +
            randomRange(
                -strength,
                strength
            );

        this.camera.position.z =
            shake.originalPosition.z +
            randomRange(
                -strength,
                strength
            );

        if (
            shake.elapsed >=
            shake.duration
        ) {

            this.camera.position.copy(
                shake.originalPosition
            );

            shake.amount = 0;
            shake.duration = 0;
            shake.elapsed = 0;
        }
    }


    // ========================================================
    // 临时点光源
    // ========================================================

    createTemporaryLight(
        position,
        {
            color = 0xffffff,
            intensity = 2,
            distance = 8,
            duration = 0.1
        } = {}
    ) {

        if (
            !this.initialized ||
            !position
        ) {
            return null;
        }

        const light =
            new THREE.PointLight(
                color,
                intensity,
                distance
            );

        light.position.copy(
            position
        );

        this.scene.add(
            light
        );

        this.activeEffects.push({
            object: light,
            duration,
            elapsed: 0,

            update: (
                delta,
                state
            ) => {

                const t =
                    clamp(
                        state.elapsed /
                        state.duration,
                        0,
                        1
                    );

                light.intensity =
                    intensity *
                    (1 - t);
            },

            destroy: () => {

                if (
                    light.parent
                ) {
                    light.parent.remove(
                        light
                    );
                }
            }
        });

        return light;
    }


    // ========================================================
    // 清空
    // ========================================================

    clear() {

        for (
            const effect
            of this.activeEffects
        ) {

            this._destroyEffect(
                effect
            );
        }

        this.activeEffects.length = 0;

        this.cameraShake.amount = 0;
        this.cameraShake.duration = 0;
        this.cameraShake.elapsed = 0;
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.clear();

        this.scene = null;

        this.camera = null;

        this.renderer = null;

        this.hitmarkerElement = null;

        this.damageOverlayElement = null;

        this.initialized = false;
    }
}


// ============================================================
// 单例
// ============================================================

export const effects =
    new EffectsSystem();


// ============================================================
// Game Event 绑定
// ============================================================

gameEvents.on(
    "weapon:impact",
    (data = {}) => {

        if (
            !data.point ||
            !data.normal
        ) {
            return;
        }

        effects.createBulletHole(
            data.point,
            data.normal
        );

        effects.createImpactSpark(
            data.point
        );
    }
);


gameEvents.on(
    "weapon:hit",
    (data = {}) => {

        effects.showHitmarker({
            kill:
                Boolean(
                    data.kill
                )
        });
    }
);


gameEvents.on(
    "player:damage",
    (data = {}) => {

        const damage =
            Number(
                data.damage ||
                0
            );

        const strength =
            clamp(
                damage / 100,
                0.18,
                0.85
            );

        effects.showDamageOverlay(
            strength
        );

        effects.addCameraShake(
            0.015 +
            strength *
            0.035,
            0.10
        );
    }
);


gameEvents.on(
    "grenade:explode",
    (data = {}) => {

        if (!data.position) {
            return;
        }

        effects.createExplosion(
            data.position,
            {
                radius:
                    data.visualRadius ||
                    3.5
            }
        );
    }
);


// ============================================================
// 默认导出
// ============================================================

export default effects;