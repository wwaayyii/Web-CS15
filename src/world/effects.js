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


        // Bullet Impact V1
        this.bulletHoleEffects = [];
        this.maxBulletHoles = 70;


        this.cameraShake = {
            amount: 0,
            duration: 0,
            elapsed: 0,
            originalPosition: new THREE.Vector3()
        };

        this.hitmarkerElement = null;

        this.damageOverlayElement = null;

        this.combatFeedbackElement = null;

        this.combatFeedbackTimer = null;


        // Smoke Grenade V1
        this.smokeEffects = [];
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


        this.combatFeedbackElement =
            document.getElementById(
                "combat-feedback"
            );


        if (
            !this.combatFeedbackElement
        ) {

            this.combatFeedbackElement =
                document.createElement(
                    "div"
                );


            this.combatFeedbackElement.id =
                "combat-feedback";


            this.combatFeedbackElement.className =
                "combat-feedback";


            document.body.appendChild(
                this.combatFeedbackElement
            );
        }


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
    // Bullet Impact V1 - 弹孔
    // ========================================================

    createBulletHole(
        point,
        normal,
        {
            size = randomRange(
                0.10,
                0.145
            ),
            lifetime =
                GRAPHICS_CONFIG.effects
                    .bulletHoleLifetime /
                1000,
            color = 0x161616
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
            new THREE.CircleGeometry(
                size * 0.5,
                10
            );


        const material =
            new THREE.MeshBasicMaterial({
                color,
                side:
                    THREE.DoubleSide,
                polygonOffset:
                    true,
                polygonOffsetFactor:
                    -4,
                transparent:
                    true,
                opacity:
                    randomRange(
                        0.68,
                        0.90
                    ),
                depthWrite:
                    false
            });


        const decal =
            new THREE.Mesh(
                geometry,
                material
            );


        decal.position
            .copy(
                point
            )
            .add(
                normal
                    .clone()
                    .multiplyScalar(
                        0.014
                    )
            );


        decal.lookAt(
            point
                .clone()
                .add(
                    normal
                )
        );


        decal.rotateZ(
            randomRange(
                0,
                Math.PI *
                    2
            )
        );


        this.scene.add(
            decal
        );


        const baseOpacity =
            material.opacity;


        const effect = {
            object:
                decal,

            duration:
                Math.max(
                    1,
                    lifetime
                ),

            elapsed:
                0,

            isBulletHole:
                true,

            update: (
                delta,
                state
            ) => {

                const fadeStart =
                    state.duration *
                    0.82;


                if (
                    state.elapsed >
                    fadeStart
                ) {

                    const t =
                        clamp(
                            (
                                state.elapsed -
                                fadeStart
                            ) /
                            Math.max(
                                0.001,
                                state.duration -
                                    fadeStart
                            ),
                            0,
                            1
                        );


                    material.opacity =
                        baseOpacity *
                        (
                            1 -
                            t
                        );
                }
            },

            destroy: () => {

                if (
                    decal.parent
                ) {

                    decal.parent.remove(
                        decal
                    );
                }


                geometry.dispose();
                material.dispose();


                const index =
                    this.bulletHoleEffects
                        .indexOf(
                            effect
                        );


                if (
                    index >=
                    0
                ) {

                    this.bulletHoleEffects
                        .splice(
                            index,
                            1
                        );
                }
            }
        };


        this.activeEffects.push(
            effect
        );


        this.bulletHoleEffects.push(
            effect
        );


        /*
         * Web 性能保护：
         * 只保留最近 maxBulletHoles 个弹孔。
         */
        while (
            this.bulletHoleEffects.length >
            this.maxBulletHoles
        ) {

            const oldest =
                this.bulletHoleEffects[
                    0
                ];


            const activeIndex =
                this.activeEffects
                    .indexOf(
                        oldest
                    );


            if (
                activeIndex >=
                0
            ) {

                this.activeEffects.splice(
                    activeIndex,
                    1
                );
            }


            this._destroyEffect(
                oldest
            );
        }


        return decal;
    }


    // ========================================================
    // Bullet Impact V1 - 火花
    // ========================================================

    createImpactSpark(
        point,
        normal = null,
        {
            count = 4,
            lifetime = 0.18
        } = {}
    ) {

        if (
            !this.initialized ||
            !point
        ) {
            return;
        }


        const surfaceNormal =
            normal
                ? normal
                    .clone()
                    .normalize()
                : new THREE.Vector3(
                    0,
                    1,
                    0
                );


        for (
            let i =
                0;

            i <
                count;

            i++
        ) {

            const geometry =
                new THREE.SphereGeometry(
                    randomRange(
                        0.012,
                        0.022
                    ),
                    4,
                    4
                );


            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        Math.random() >
                            0.35
                            ? 0xffd37a
                            : 0xff9d3d,

                    transparent:
                        true,

                    opacity:
                        1,

                    depthWrite:
                        false
                });


            const particle =
                new THREE.Mesh(
                    geometry,
                    material
                );


            particle.position
                .copy(
                    point
                )
                .addScaledVector(
                    surfaceNormal,
                    0.025
                );


            this.scene.add(
                particle
            );


            const velocity =
                surfaceNormal
                    .clone()
                    .multiplyScalar(
                        randomRange(
                            1.0,
                            2.5
                        )
                    );


            velocity.x +=
                randomRange(
                    -1.2,
                    1.2
                );

            velocity.y +=
                randomRange(
                    0.15,
                    1.5
                );

            velocity.z +=
                randomRange(
                    -1.2,
                    1.2
                );


            const effect = {
                object:
                    particle,

                duration:
                    randomRange(
                        lifetime *
                            0.70,
                        lifetime *
                            1.25
                    ),

                elapsed:
                    0,

                update: (
                    delta,
                    state
                ) => {

                    velocity.y -=
                        8 *
                        delta;


                    particle.position
                        .addScaledVector(
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


                    particle.scale
                        .setScalar(
                            1 -
                            t *
                                0.55
                        );


                    material.opacity =
                        1 -
                        t;
                }
            };


            this.activeEffects.push(
                effect
            );
        }
    }


    // ========================================================
    // Bullet Impact V1 - 灰尘
    // ========================================================

    createImpactDust(
        point,
        normal = null,
        {
            count = 3,
            lifetime = 0.34
        } = {}
    ) {

        if (
            !this.initialized ||
            !point
        ) {
            return;
        }


        const surfaceNormal =
            normal
                ? normal
                    .clone()
                    .normalize()
                : new THREE.Vector3(
                    0,
                    1,
                    0
                );


        for (
            let i =
                0;

            i <
                count;

            i++
        ) {

            const geometry =
                new THREE.PlaneGeometry(
                    randomRange(
                        0.06,
                        0.11
                    ),
                    randomRange(
                        0.06,
                        0.11
                    )
                );


            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        Math.random() >
                            0.5
                            ? 0x8c8478
                            : 0xaaa092,

                    transparent:
                        true,

                    opacity:
                        randomRange(
                            0.20,
                            0.34
                        ),

                    depthWrite:
                        false,

                    side:
                        THREE.DoubleSide
                });


            const dust =
                new THREE.Mesh(
                    geometry,
                    material
                );


            dust.position
                .copy(
                    point
                )
                .addScaledVector(
                    surfaceNormal,
                    0.035
                );


            /*
             * 灰尘面片大致朝向摄像机，
             * 避免侧面完全看不到。
             */
            if (
                this.camera
            ) {

                dust.quaternion.copy(
                    this.camera.quaternion
                );
            }


            dust.rotation.z =
                randomRange(
                    0,
                    Math.PI *
                        2
                );


            this.scene.add(
                dust
            );


            const velocity =
                surfaceNormal
                    .clone()
                    .multiplyScalar(
                        randomRange(
                            0.15,
                            0.42
                        )
                    );


            velocity.x +=
                randomRange(
                    -0.18,
                    0.18
                );

            velocity.y +=
                randomRange(
                    0.10,
                    0.32
                );

            velocity.z +=
                randomRange(
                    -0.18,
                    0.18
                );


            const baseOpacity =
                material.opacity;


            this.activeEffects.push({
                object:
                    dust,

                duration:
                    randomRange(
                        lifetime *
                            0.80,
                        lifetime *
                            1.25
                    ),

                elapsed:
                    0,

                update: (
                    delta,
                    state
                ) => {

                    dust.position
                        .addScaledVector(
                            velocity,
                            delta
                        );


                    dust.rotation.z +=
                        delta *
                        0.8;


                    dust.scale
                        .multiplyScalar(
                            1 +
                            delta *
                                1.65
                        );


                    const t =
                        clamp(
                            state.elapsed /
                                state.duration,
                            0,
                            1
                        );


                    material.opacity =
                        baseOpacity *
                        (
                            1 -
                            t
                        );
                }
            });
        }
    }


    // ========================================================
    // Surface Impact V2 - 木屑
    // ========================================================

    createWoodChips(
        point,
        normal = null,
        {
            count = 5,
            lifetime = 0.34
        } = {}
    ) {

        if (
            !this.initialized ||
            !point
        ) {
            return;
        }


        const surfaceNormal =
            normal
                ? normal
                    .clone()
                    .normalize()
                : new THREE.Vector3(
                    0,
                    1,
                    0
                );


        for (
            let i =
                0;

            i <
                count;

            i++
        ) {

            const geometry =
                new THREE.BoxGeometry(
                    randomRange(
                        0.018,
                        0.040
                    ),
                    randomRange(
                        0.010,
                        0.024
                    ),
                    randomRange(
                        0.035,
                        0.075
                    )
                );


            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        Math.random() >
                            0.5
                            ? 0x9a6738
                            : 0x6e4527,

                    transparent:
                        true,

                    opacity:
                        0.95
                });


            const chip =
                new THREE.Mesh(
                    geometry,
                    material
                );


            chip.position
                .copy(
                    point
                )
                .addScaledVector(
                    surfaceNormal,
                    0.035
                );


            chip.rotation.set(
                randomRange(
                    0,
                    Math.PI
                ),
                randomRange(
                    0,
                    Math.PI
                ),
                randomRange(
                    0,
                    Math.PI
                )
            );


            this.scene.add(
                chip
            );


            const velocity =
                surfaceNormal
                    .clone()
                    .multiplyScalar(
                        randomRange(
                            0.6,
                            1.8
                        )
                    );


            velocity.x +=
                randomRange(
                    -1.0,
                    1.0
                );

            velocity.y +=
                randomRange(
                    0.35,
                    1.8
                );

            velocity.z +=
                randomRange(
                    -1.0,
                    1.0
                );


            const angularVelocity =
                new THREE.Vector3(
                    randomRange(
                        -7,
                        7
                    ),
                    randomRange(
                        -7,
                        7
                    ),
                    randomRange(
                        -7,
                        7
                    )
                );


            this.activeEffects.push({
                object:
                    chip,

                duration:
                    randomRange(
                        lifetime *
                            0.75,
                        lifetime *
                            1.25
                    ),

                elapsed:
                    0,

                update: (
                    delta,
                    state
                ) => {

                    velocity.y -=
                        6.5 *
                        delta;


                    chip.position
                        .addScaledVector(
                            velocity,
                            delta
                        );


                    chip.rotation.x +=
                        angularVelocity.x *
                        delta;

                    chip.rotation.y +=
                        angularVelocity.y *
                        delta;

                    chip.rotation.z +=
                        angularVelocity.z *
                        delta;


                    const t =
                        clamp(
                            state.elapsed /
                                state.duration,
                            0,
                            1
                        );


                    material.opacity =
                        0.95 *
                        (
                            1 -
                            t
                        );
                }
            });
        }
    }


    // ========================================================
    // Surface Impact V2 - 统一表面命中
    // ========================================================

    createBulletImpact(
        point,
        normal,
        {
            surfaceType =
                "concrete"
        } = {}
    ) {

        if (
            !point ||
            !normal
        ) {

            return;
        }


        const n =
            normal
                .clone()
                .normalize();


        const type =
            String(
                surfaceType ||
                "concrete"
            )
                .toLowerCase();


        // ====================================================
        // METAL
        // ====================================================

        if (
            type ===
            "metal"
        ) {

            this.createBulletHole(
                point,
                n,
                {
                    size:
                        randomRange(
                            0.075,
                            0.105
                        ),

                    color:
                        0x0c0d0f
                }
            );


            this.createImpactSpark(
                point,
                n,
                {
                    count:
                        8,

                    lifetime:
                        0.22
                }
            );


            /*
             * 金属只留极少量灰尘，
             * 避免和 concrete 看起来一样。
             */
            if (
                Math.random() <
                0.25
            ) {

                this.createImpactDust(
                    point,
                    n,
                    {
                        count:
                            1,

                        lifetime:
                            0.20
                    }
                );
            }


            return;
        }


        // ====================================================
        // WOOD
        // ====================================================

        if (
            type ===
            "wood"
        ) {

            this.createBulletHole(
                point,
                n,
                {
                    size:
                        randomRange(
                            0.095,
                            0.135
                        ),

                    color:
                        0x3e2415
                }
            );


            this.createWoodChips(
                point,
                n,
                {
                    count:
                        6,

                    lifetime:
                        0.36
                }
            );


            /*
             * 木头有少量浅棕灰尘，
             * 但不产生金属火花。
             */
            this.createImpactDust(
                point,
                n,
                {
                    count:
                        2,

                    lifetime:
                        0.28
                }
            );


            return;
        }


        // ====================================================
        // CONCRETE / DEFAULT
        // ====================================================

        const isGround =
            n.y >
            0.68;


        this.createBulletHole(
            point,
            n,
            {
                size:
                    isGround
                        ? randomRange(
                            0.085,
                            0.120
                        )
                        : randomRange(
                            0.10,
                            0.145
                        ),

                color:
                    0x151515
            }
        );


        this.createImpactDust(
            point,
            n,
            {
                count:
                    isGround
                        ? 5
                        : 3,

                lifetime:
                    isGround
                        ? 0.38
                        : 0.32
            }
        );


        /*
         * Concrete 只保留极少量火星，
         * 让它和 Metal 明显区分。
         */
        if (
            !isGround &&
            Math.random() <
                0.35
        ) {

            this.createImpactSpark(
                point,
                n,
                {
                    count:
                        2,

                    lifetime:
                        0.14
                }
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
    // Smoke Grenade V3 - Procedural Sprite Smoke
    //
    // 纯 JS / 无外部 PNG：
    // - Canvas 动态生成软边烟雾纹理
    // - Sprite 代替 Sphere Mesh
    // - Core / Body / Edge 三层
    // - 中心更浓、外围更柔
    // ========================================================

    _createSmokeTexture() {

        const size =
            128;


        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            size;

        canvas.height =
            size;


        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {

            return null;
        }


        const center =
            size *
            0.5;


        const gradient =
            context.createRadialGradient(
                center,
                center,
                0,

                center,
                center,
                center
            );


        /*
         * 不是纯白圆：
         * 中心浓、外圈快速淡出，
         * 用于消除 Sprite 边缘。
         */
        gradient.addColorStop(
            0.00,
            "rgba(255,255,255,1.00)"
        );

        gradient.addColorStop(
            0.28,
            "rgba(255,255,255,0.92)"
        );

        gradient.addColorStop(
            0.55,
            "rgba(255,255,255,0.58)"
        );

        gradient.addColorStop(
            0.78,
            "rgba(255,255,255,0.20)"
        );

        gradient.addColorStop(
            1.00,
            "rgba(255,255,255,0.00)"
        );


        context.fillStyle =
            gradient;


        context.fillRect(
            0,
            0,
            size,
            size
        );


        const texture =
            new THREE.CanvasTexture(
                canvas
            );


        texture.needsUpdate =
            true;


        return texture;
    }


    createSmokeCloud(
        position,
        {
            radius = 8,
            duration = 15,
            buildTime = 1.0,
            fadeTime = 2.0
        } = {}
    ) {

        if (
            !this.initialized ||
            !position?.isVector3
        ) {

            return null;
        }


        const texture =
            this._createSmokeTexture();


        if (!texture) {

            return null;
        }


        const group =
            new THREE.Group();


        group.position.copy(
            position
        );


        const visualRadius =
            clamp(
                radius *
                    0.62,
                4.3,
                5.4
            );


        const sprites =
            [];


        const createLayer =
            ({
                count,
                radialFactor,
                minY,
                maxY,
                minScale,
                maxScale,
                colorMin,
                colorMax,
                opacityMin,
                opacityMax,
                driftHorizontal,
                driftVertical,
                layer
            }) => {

                for (
                    let i = 0;
                    i < count;
                    i++
                ) {

                    const gray =
                        randomRange(
                            colorMin,
                            colorMax
                        );


                    const material =
                        new THREE.SpriteMaterial({
                            map:
                                texture,

                            color:
                                new THREE.Color(
                                    gray,
                                    gray,
                                    gray
                                ),

                            transparent:
                                true,

                            opacity:
                                0,

                            depthWrite:
                                false,

                            depthTest:
                                true
                        });


                    const sprite =
                        new THREE.Sprite(
                            material
                        );


                    const angle =
                        randomRange(
                            0,
                            Math.PI *
                                2
                        );


                    const horizontal =
                        Math.sqrt(
                            Math.random()
                        ) *
                        visualRadius *
                        radialFactor;


                    sprite.position.set(
                        Math.cos(
                            angle
                        ) *
                            horizontal,

                        randomRange(
                            minY,
                            maxY
                        ),

                        Math.sin(
                            angle
                        ) *
                            horizontal
                    );


                    const baseScale =
                        randomRange(
                            minScale,
                            maxScale
                        );


                    sprite.scale.set(
                        0.15,
                        0.15,
                        1
                    );


                    sprites.push({
                        sprite,

                        material,

                        baseScale,

                        baseOpacity:
                            randomRange(
                                opacityMin,
                                opacityMax
                            ),

                        drift:
                            new THREE.Vector3(
                                randomRange(
                                    -driftHorizontal,
                                    driftHorizontal
                                ),

                                randomRange(
                                    driftVertical *
                                        0.55,
                                    driftVertical
                                ),

                                randomRange(
                                    -driftHorizontal,
                                    driftHorizontal
                                )
                            ),

                        phase:
                            randomRange(
                                0,
                                Math.PI *
                                    2
                            ),

                        layer
                    });


                    group.add(
                        sprite
                    );
                }
            };


        // ----------------------------------------------------
        // Core：中心最浓
        // ----------------------------------------------------

        createLayer({
            count:
                18,

            radialFactor:
                0.38,

            minY:
                0.55,

            maxY:
                2.05,

            minScale:
                2.0,

            maxScale:
                2.8,

            colorMin:
                0.23,

            colorMax:
                0.31,

            opacityMin:
                0.50,

            opacityMax:
                0.64,

            driftHorizontal:
                0.022,

            driftVertical:
                0.028,

            layer:
                "core"
        });


        // ----------------------------------------------------
        // Body：主体
        // ----------------------------------------------------

        createLayer({
            count:
                26,

            radialFactor:
                0.72,

            minY:
                0.42,

            maxY:
                2.45,

            minScale:
                2.1,

            maxScale:
                3.1,

            colorMin:
                0.30,

            colorMax:
                0.39,

            opacityMin:
                0.31,

            opacityMax:
                0.46,

            driftHorizontal:
                0.035,

            driftVertical:
                0.038,

            layer:
                "body"
        });


        // ----------------------------------------------------
        // Edge：大、淡，用来柔化外围
        // ----------------------------------------------------

        createLayer({
            count:
                18,

            radialFactor:
                0.98,

            minY:
                0.28,

            maxY:
                2.75,

            minScale:
                2.35,

            maxScale:
                3.55,

            colorMin:
                0.38,

            colorMax:
                0.49,

            opacityMin:
                0.13,

            opacityMax:
                0.24,

            driftHorizontal:
                0.045,

            driftVertical:
                0.045,

            layer:
                "edge"
        });


        this.scene.add(
            group
        );


        const totalDuration =
            Math.max(
                0.5,
                duration
            );


        const effect = {
            object:
                group,

            duration:
                totalDuration,

            elapsed:
                0,

            update: (
                delta,
                state
            ) => {

                const age =
                    state.elapsed;


                const rawBuild =
                    clamp(
                        age /
                            Math.max(
                                0.05,
                                buildTime
                            ),
                        0,
                        1
                    );


                /*
                 * Smoothstep 起烟。
                 */
                const build =
                    rawBuild *
                    rawBuild *
                    (
                        3 -
                        2 *
                        rawBuild
                    );


                const fadeStart =
                    Math.max(
                        buildTime,
                        totalDuration -
                            fadeTime
                    );


                let fade =
                    1;


                if (
                    age >
                    fadeStart
                ) {

                    fade =
                        1 -
                        clamp(
                            (
                                age -
                                    fadeStart
                            ) /
                            Math.max(
                                0.001,
                                totalDuration -
                                    fadeStart
                            ),
                            0,
                            1
                        );
                }


                const density =
                    build *
                    fade;


                for (
                    const item
                    of sprites
                ) {

                    item.sprite.position
                        .addScaledVector(
                            item.drift,
                            delta
                        );


                    const breathe =
                        1 +
                        Math.sin(
                            age *
                                0.62 +
                            item.phase
                        ) *
                            0.045;


                    let growth =
                        0.42 +
                        build *
                            0.86;


                    if (
                        item.layer ===
                        "edge"
                    ) {

                        growth *=
                            1.06;
                    }


                    const scale =
                        item.baseScale *
                        growth *
                        breathe;


                    /*
                     * Sprite 轻微纵向压扁，
                     * 整体更像低矮烟团。
                     */
                    item.sprite.scale.set(
                        scale,

                        scale *
                            0.78,

                        1
                    );


                    item.material.opacity =
                        clamp(
                            item.baseOpacity *
                                density,
                            0,
                            item.layer ===
                                "core"
                                ? 0.68
                                : item.layer ===
                                    "body"
                                    ? 0.48
                                    : 0.26
                        );
                }
            },

            destroy: () => {

                if (
                    group.parent
                ) {

                    group.parent.remove(
                        group
                    );
                }


                for (
                    const item
                    of sprites
                ) {

                    item.material.dispose();
                }


                texture.dispose();


                const index =
                    this.smokeEffects
                        .indexOf(
                            effect
                        );


                if (
                    index >=
                    0
                ) {

                    this.smokeEffects.splice(
                        index,
                        1
                    );
                }
            }
        };


        this.activeEffects.push(
            effect
        );


        this.smokeEffects.push(
            effect
        );


        return effect;
    }


    // ========================================================
    // Hitmarker
    // ========================================================

    showHitmarker({
        kill = false,
        headshot = false
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


        let color =
            "#ffffff";


        let glow =
            "#ffffff";


        let scale =
            1;


        if (
            headshot &&
            kill
        ) {

            color =
                "#ffb52e";

            glow =
                "#ff8a00";

            scale =
                1.42;

        } else if (
            kill
        ) {

            color =
                "#ff3d3d";

            glow =
                "#ff2d2d";

            scale =
                1.32;

        } else if (
            headshot
        ) {

            color =
                "#ffd84d";

            glow =
                "#ffb300";

            scale =
                1.20;
        }


        lines.forEach(
            line => {

                line.style.backgroundColor =
                    color;


                line.style.boxShadow =
                    `0 0 ${
                        kill
                            ? 8
                            : 5
                    }px ${glow}`;
            }
        );


        element.style.opacity =
            "1";


        /*
         * 原 CSS 已经负责 translate(-50%, -50%)。
         * 这里不能直接写 scale() 覆盖 translate，
         * 否则 Hitmarker 会偏离准星中心。
         */
        element.style.transform =
            `translate(-50%, -50%) scale(${scale})`;


        window.setTimeout(
            () => {

                element.style.opacity =
                    "0";


                element.style.transform =
                    "translate(-50%, -50%) scale(1)";

            },
            kill
                ? HUD_CONFIG.hitmarker
                    .killDuration
                : HUD_CONFIG.hitmarker
                    .duration
        );
    }


    // ========================================================
    // Combat Feedback Text
    // ========================================================

    showCombatFeedback({
        headshot = false,
        kill = false
    } = {}) {

        const element =
            this.combatFeedbackElement;


        if (!element) {
            return;
        }


        let text =
            "";


        let type =
            "hit";


        if (
            headshot &&
            kill
        ) {

            text =
                "HEADSHOT KILL";

            type =
                "headshot-kill";

        } else if (
            kill
        ) {

            text =
                "KILL";

            type =
                "kill";

        } else if (
            headshot
        ) {

            text =
                "HEADSHOT";

            type =
                "headshot";
        }


        if (!text) {
            return;
        }


        if (
            this.combatFeedbackTimer
        ) {

            window.clearTimeout(
                this.combatFeedbackTimer
            );
        }


        element.textContent =
            text;


        element.dataset.type =
            type;


        element.classList.remove(
            "combat-feedback-show"
        );


        /*
         * 强制 reflow，确保连续爆头时动画能重新播放。
         */
        void element.offsetWidth;


        element.classList.add(
            "combat-feedback-show"
        );


        this.combatFeedbackTimer =
            window.setTimeout(
                () => {

                    element.classList.remove(
                        "combat-feedback-show"
                    );


                    this.combatFeedbackTimer =
                        null;

                },
                kill
                    ? 700
                    : 520
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

        this.bulletHoleEffects.length = 0;

        this.smokeEffects.length = 0;


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


        if (
            this.combatFeedbackTimer
        ) {

            window.clearTimeout(
                this.combatFeedbackTimer
            );


            this.combatFeedbackTimer =
                null;
        }


        this.combatFeedbackElement
            ?.remove();


        this.combatFeedbackElement =
            null;


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

        effects.createBulletImpact(
            data.point,
            data.normal,
            {
                surfaceType:
                    data.surfaceType ||
                    "concrete"
            }
        );
    }
);


gameEvents.on(
    "weapon:hit",
    (data = {}) => {

        /*
         * Hitmarker 是第一人称玩家反馈，
         * 不能因为 BOT 互相开枪就在玩家屏幕上闪。
         */
        const owner =
            data.owner ||
            data.attacker;


        const isLocalPlayer =
            owner?.constructor?.name ===
                "Player" ||
            owner?.name ===
                "PLAYER (You)";


        if (
            !isLocalPlayer
        ) {

            return;
        }


        const headshot =
            Boolean(
                data.headshot ||
                data.hitZone ===
                    "head"
            );


        const kill =
            Boolean(
                data.kill
            );


        effects.showHitmarker({
            kill,
            headshot
        });


        if (
            headshot ||
            kill
        ) {

            effects.showCombatFeedback({
                headshot,
                kill
            });
        }
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

        if (
            !data.position
        ) {

            return;
        }


        /*
         * HE 才使用爆炸火球。
         * Smoke / Flash 使用各自独立视觉。
         */
        if (
            data.type !==
            "he"
        ) {

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


gameEvents.on(
    "grenade:smoke",
    (data = {}) => {

        if (
            !data.position
        ) {

            return;
        }


        effects.createSmokeCloud(
            data.position,
            {
                radius:
                    data.radius ||
                    8,

                duration:
                    data.duration ||
                    15,

                buildTime:
                    data.buildTime ||
                    1.0,

                fadeTime:
                    data.fadeTime ||
                    2.0
            }
        );
    }
);


// ============================================================
// 默认导出
// ============================================================

export default effects;