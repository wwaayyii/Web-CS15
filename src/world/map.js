/**
 * Web-CS15
 * src/world/map.js
 *
 * 地图系统
 *
 * 负责：
 * - 地图几何
 * - 地板
 * - 墙壁
 * - 掩体
 * - 出生点
 * - Buy Zone
 * - 武器 Raycast 碰撞
 * - Grenade 碰撞
 * - BOT AI 视线障碍
 *
 * Multi-Map 管理器
 *
 * 地图具体内容位于：
 * src/world/maps/
 */

import * as THREE from "three";

import {
    MAP_CONFIG,
    TEAM
} from "../core/config.js";

import {
    randomRange,
    gameEvents
} from "../core/utils.js";

import {
    weaponSystem
} from "../weapons/weapon.js";

import {
    grenadeSystem
} from "../weapons/grenade.js";


import {
    MAP_ID as FY_ICEWORLD_ID,
    buildFyIceworld
} from "./maps/fy_iceworld.js?v=20260808_1";


import {
    MAP_ID as AIM_ARENA_ID,
    buildAimArena
} from "./maps/aim_arena.js?v=20260808_3";




// ============================================================
// Map object types
// ============================================================

export const MAP_OBJECT_TYPE = Object.freeze({
    FLOOR: "floor",
    WALL: "wall",
    COVER: "cover",
    CRATE: "crate",
    DECORATION: "decoration"
});


/*
 * Surface Impact V2
 *
 * 地图物体的视觉材质类型。
 * weapon.js 之后会读取 object.userData.surfaceType，
 * effects.js 再根据它播放不同命中特效。
 */
export const SURFACE_TYPE = Object.freeze({
    CONCRETE:
        "concrete",

    METAL:
        "metal",

    WOOD:
        "wood"
});


// ============================================================
// Map Registry
//
// 新地图只需要：
// 1. 在 src/world/maps/ 新建文件
// 2. import builder
// 3. 在这里注册
// ============================================================

const MAP_BUILDERS =
    new Map([
        [
            FY_ICEWORLD_ID,
            buildFyIceworld
        ],

        [
            AIM_ARENA_ID,
            buildAimArena
        ]
    ]);


// ============================================================
// GameMap
// ============================================================

export class GameMap {

    constructor({
        scene = null
    } = {}) {

        this.scene = scene;


        // ====================================================
        // Root
        // ====================================================

        this.group =
            new THREE.Group();

        this.group.name =
            "GAME_MAP";


        // ====================================================
        // Registries
        // ====================================================

        this.collisionObjects = [];

        this.weaponTargets = [];

        this.grenadeCollisionObjects = [];

        this.aiCollisionObjects = [];


        // ====================================================
        // Navigation / A*
        // ====================================================

        this.navigationGraph =
            null;


        this.navigationDebugEnabled =
            false;


        this.navigationDebugGroup =
            null;


        this.navigationBotDebugGroups =
            new Map();


        /*
         * Debug only:
         * 记录因为进入墙体/掩体而被导航系统拒绝的 Waypoint。
         * 这些点不会加入 A* Graph。
         */
        this.navigationRejectedWaypoints =
            [];


        // ====================================================
        // Spawn points
        // ====================================================

        this.spawnPoints = {
            [TEAM.CT]: [],
            [TEAM.T]: []
        };


        // ====================================================
        // Buy zones
        // ====================================================

        this.buyZones = {
            [TEAM.CT]: null,
            [TEAM.T]: null
        };


        // ====================================================
        // Materials
        // ====================================================

        this.materials = {};


        // ====================================================
        // State
        // ====================================================

        this.loaded =
            false;


        this.currentMap =
            null;
    }


    // ========================================================
    // Init
    // ========================================================

    init({
        scene = this.scene,
        mapName =
            MAP_CONFIG.defaultMap
    } = {}) {

        if (!scene) {

            throw new Error(
                "[GameMap] scene is required."
            );
        }


        this.scene =
            scene;


        if (
            !this.group.parent
        ) {

            this.scene.add(
                this.group
            );
        }


        this.load(
            mapName
        );


        return this;
    }


    // ========================================================
    // Load
    // ========================================================

    load(mapName) {

        this.clear();


        const requestedMap =
            MAP_BUILDERS.has(
                mapName
            )
                ? mapName
                : FY_ICEWORLD_ID;


        const builder =
            MAP_BUILDERS.get(
                requestedMap
            );


        if (!builder) {

            throw new Error(
                `[GameMap] Map builder not found: ${requestedMap}`
            );
        }


        console.log(
            `[GameMap] Loading map builder: ${requestedMap}`
        );


        builder(
            this
        );


        this.currentMap =
            requestedMap;


        console.log(
            `[GameMap] Loaded map: ${this.currentMap}`,
            {
                groupMapName:
                    this.group?.userData?.mapName,

                collisionObjects:
                    this.collisionObjects.length,

                navigationNodes:
                    this.navigationGraph?.size ?? 0
            }
        );

        this.loaded =
            true;


        this.registerSystems();


        gameEvents.emit(
            "map:loaded",
            {
                map:
                    this,

                name:
                    this.currentMap
            }
        );
    }


    // ========================================================
    // Materials
    // ========================================================

    createMaterials() {

        this.disposeMaterials();


        this.materials.floor =
            new THREE.MeshStandardMaterial({
                color:
                    0xddeeff,

                roughness:
                    0.92,

                metalness:
                    0
            });


        this.materials.wall =
            new THREE.MeshStandardMaterial({
                color:
                    0x9ab5c8,

                roughness:
                    0.78
            });


        this.materials.cover =
            new THREE.MeshStandardMaterial({
                color:
                    0x7892a3,

                roughness:
                    0.75
            });


        this.materials.crate =
            new THREE.MeshStandardMaterial({
                color:
                    0x7a5b37,

                roughness:
                    0.88
            });


        this.materials.ctMarker =
            new THREE.MeshBasicMaterial({
                color:
                    0x2255ff,

                transparent:
                    true,

                opacity:
                    0.15,

                depthWrite:
                    false
            });


        this.materials.tMarker =
            new THREE.MeshBasicMaterial({
                color:
                    0xff3322,

                transparent:
                    true,

                opacity:
                    0.15,

                depthWrite:
                    false
            });
    }


    // ========================================================
    // Create Iceworld
    // ========================================================

    // ========================================================
    // Create Aim Arena
    //
    // Multi-Map V1 第二张地图：
    // - 更开放
    // - 三条主推进路线
    // - 中央低掩体
    // - 适合枪法 / BOT Tactical / A* 测试
    // ========================================================

    // ========================================================
    // Wall
    // ========================================================

    createWall({
        position,
        size
    }) {

        const mesh =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size.x,
                    size.y,
                    size.z
                ),
                this.materials.wall
            );


        mesh.position.copy(
            position
        );


        this.addMapObject(
            mesh,
            MAP_OBJECT_TYPE.WALL,
            {
                collision:
                    true,

                weaponTarget:
                    true,

                grenadeCollision:
                    true,

                aiCollision:
                    true
            }
        );


        return mesh;
    }


    // ========================================================
    // Cover
    // ========================================================

    createCover({
        position,
        size
    }) {

        const mesh =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size.x,
                    size.y,
                    size.z
                ),
                this.materials.cover
            );


        mesh.position.copy(
            position
        );


        this.addMapObject(
            mesh,
            MAP_OBJECT_TYPE.COVER,
            {
                collision:
                    true,

                weaponTarget:
                    true,

                grenadeCollision:
                    true,

                aiCollision:
                    true
            }
        );


        return mesh;
    }


    // ========================================================
    // Crate
    // ========================================================

    createCrate({
        position,
        size
    }) {

        const mesh =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size.x,
                    size.y,
                    size.z
                ),
                this.materials.crate
            );


        mesh.position.copy(
            position
        );


        this.addMapObject(
            mesh,
            MAP_OBJECT_TYPE.CRATE,
            {
                collision:
                    true,

                weaponTarget:
                    true,

                grenadeCollision:
                    true,

                aiCollision:
                    true
            }
        );


        return mesh;
    }


    // ========================================================
    // Add Map Object
    // ========================================================

    addMapObject(
        object,
        type,
        {
            collision = true,
            weaponTarget = true,
            grenadeCollision = true,
            aiCollision = true,

            /*
             * 未显式指定时，根据 map object type 自动推断。
             */
            surfaceType = null
        } = {}
    ) {

        object.userData.mapObject =
            true;

        object.userData.mapType =
            type;


        // ====================================================
        // Surface Impact V2
        // ====================================================

        let resolvedSurfaceType =
            surfaceType;


        if (
            !resolvedSurfaceType
        ) {

            switch (
                type
            ) {

                case MAP_OBJECT_TYPE.CRATE:

                    resolvedSurfaceType =
                        SURFACE_TYPE.WOOD;

                    break;


                case MAP_OBJECT_TYPE.COVER:

                    resolvedSurfaceType =
                        SURFACE_TYPE.METAL;

                    break;


                case MAP_OBJECT_TYPE.FLOOR:
                case MAP_OBJECT_TYPE.WALL:
                default:

                    resolvedSurfaceType =
                        SURFACE_TYPE.CONCRETE;

                    break;
            }
        }


        object.userData.surfaceType =
            resolvedSurfaceType;


        object.castShadow =
            true;

        object.receiveShadow =
            true;


        this.group.add(
            object
        );


        if (collision) {

            this.collisionObjects.push(
                object
            );
        }


        if (weaponTarget) {

            this.weaponTargets.push(
                object
            );
        }


        if (grenadeCollision) {

            this.grenadeCollisionObjects.push(
                object
            );
        }


        if (aiCollision) {

            this.aiCollisionObjects.push(
                object
            );
        }


        return object;
    }


    // ========================================================
    // Spawn Points
    // ========================================================

    createSpawnPoints() {

        this.spawnPoints[
            TEAM.CT
        ].length = 0;


        this.spawnPoints[
            TEAM.T
        ].length = 0;


        const ctZ =
            -46;


        const tZ =
            46;


        const xPositions = [
            -18,
            -9,
            0,
            9,
            18
        ];


        for (
            const x
            of xPositions
        ) {

            this.spawnPoints[
                TEAM.CT
            ].push(
                new THREE.Vector3(
                    x,
                    0,
                    ctZ
                )
            );


            this.spawnPoints[
                TEAM.T
            ].push(
                new THREE.Vector3(
                    x,
                    0,
                    tZ
                )
            );
        }
    }


    // ========================================================
    // Random Spawn
    // ========================================================

    getSpawnPosition(team) {

        const list =
            this.spawnPoints[
                team
            ];


        if (
            list &&
            list.length > 0
        ) {

            const index =
                Math.floor(
                    Math.random() *
                    list.length
                );


            const position =
                list[index]
                    .clone();


            /*
             * 轻微随机，避免 BOT 完全叠在一起。
             */
            position.x +=
                randomRange(
                    -1,
                    1
                );


            position.z +=
                randomRange(
                    -1,
                    1
                );


            return position;
        }


        // ====================================================
        // fallback config
        // ====================================================

        const spawn =
            team === TEAM.T
                ? MAP_CONFIG.spawn.T
                : MAP_CONFIG.spawn.CT;


        return new THREE.Vector3(
            randomRange(
                spawn.xMin,
                spawn.xMax
            ),
            0,
            randomRange(
                spawn.zMin,
                spawn.zMax
            )
        );
    }


    // ========================================================
    // Buy Zones
    // ========================================================

    createBuyZones() {

        const ctConfig =
            MAP_CONFIG.buyZones.CT;


        const tConfig =
            MAP_CONFIG.buyZones.T;


        this.buyZones[
            TEAM.CT
        ] = {
            minX:
                ctConfig.minX,

            maxX:
                ctConfig.maxX,

            minZ:
                ctConfig.minZ,

            maxZ:
                ctConfig.maxZ
        };


        this.buyZones[
            TEAM.T
        ] = {
            minX:
                tConfig.minX,

            maxX:
                tConfig.maxX,

            minZ:
                tConfig.minZ,

            maxZ:
                tConfig.maxZ
        };


        // ====================================================
        // 可视化 Buy Zone
        //
        // 后期可以关闭。
        // ====================================================

        const ctWidth =
            ctConfig.maxX -
            ctConfig.minX;


        const ctDepth =
            ctConfig.maxZ -
            ctConfig.minZ;


        const ctMarker =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    ctWidth,
                    ctDepth
                ),
                this.materials.ctMarker
            );


        ctMarker.rotation.x =
            -Math.PI / 2;


        ctMarker.position.set(
            (
                ctConfig.minX +
                ctConfig.maxX
            ) / 2,
            0.012,
            (
                ctConfig.minZ +
                ctConfig.maxZ
            ) / 2
        );


        ctMarker.userData.decoration =
            true;


        this.group.add(
            ctMarker
        );


        const tWidth =
            tConfig.maxX -
            tConfig.minX;


        const tDepth =
            tConfig.maxZ -
            tConfig.minZ;


        const tMarker =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    tWidth,
                    tDepth
                ),
                this.materials.tMarker
            );


        tMarker.rotation.x =
            -Math.PI / 2;


        tMarker.position.set(
            (
                tConfig.minX +
                tConfig.maxX
            ) / 2,
            0.013,
            (
                tConfig.minZ +
                tConfig.maxZ
            ) / 2
        );


        tMarker.userData.decoration =
            true;


        this.group.add(
            tMarker
        );
    }


    // ========================================================
    // Buy Zone Check
    // ========================================================

    isInBuyZone(entity) {

        if (
            !entity ||
            !entity.team
        ) {

            return false;
        }


        const zone =
            this.buyZones[
                entity.team
            ];


        if (!zone) {
            return false;
        }


        let position = null;


        if (
            typeof entity.getPosition ===
            "function"
        ) {

            position =
                entity.getPosition();

        } else if (
            entity.position
                ?.isVector3
        ) {

            position =
                entity.position;

        } else if (
            entity.group
                ?.position
                ?.isVector3
        ) {

            position =
                entity.group.position;
        }


        if (!position) {
            return false;
        }


        return (
            position.x >=
                zone.minX &&

            position.x <=
                zone.maxX &&

            position.z >=
                zone.minZ &&

            position.z <=
                zone.maxZ
        );
    }



    // ========================================================
    // Navigation Graph
    //
    // fy_iceworld_web 使用手工布置 Waypoint，
    // 再根据 AI 碰撞物自动连接可直达节点。
    // ========================================================

    // ========================================================
    // Aim Arena Navigation Graph
    // ========================================================

    // ========================================================
    // Auto Connect Navigation Graph
    //
    // Navigation V3:
    // - 只连接较近节点
    // - 每个节点限制最大邻居数量
    // - 先按距离排序，再建立最自然的短连接
    //
    // 这样可以显著减少 Debug 中的“蜘蛛网”，
    // 也让 A* 更像沿道路走，而不是跨地图斜切。
    // ========================================================

    autoConnectNavigationGraph(
        maxDistance = 18.5,
        maxNeighbors = 5
    ) {

        const graph =
            this.navigationGraph;


        if (!graph) {
            return;
        }


        const nodes =
            graph.getNodes();


        const candidates =
            [];


        // ----------------------------------------------------
        // 先收集所有合法候选边
        // ----------------------------------------------------

        for (
            let i = 0;
            i < nodes.length;
            i++
        ) {

            for (
                let j = i + 1;
                j < nodes.length;
                j++
            ) {

                const a =
                    nodes[i];


                const b =
                    nodes[j];


                const distance =
                    a.position
                        .distanceTo(
                            b.position
                        );


                if (
                    distance >
                    maxDistance
                ) {

                    continue;
                }


                if (
                    !this.hasClearNavigationLine(
                        a.position,
                        b.position,
                        0.58
                    )
                ) {

                    continue;
                }


                candidates.push({
                    a,
                    b,
                    distance
                });
            }
        }


        /*
         * 短边优先。
         * 相比按节点逐个连接，
         * 这种方式更不容易产生跨区域长斜线。
         */
        candidates.sort(
            (
                first,
                second
            ) =>
                first.distance -
                second.distance
        );


        // ----------------------------------------------------
        // 第一轮：双方都没有达到邻居上限才连接
        // ----------------------------------------------------

        for (
            const candidate
            of candidates
        ) {

            const {
                a,
                b,
                distance
            } =
                candidate;


            if (
                a.neighbors.size >=
                    maxNeighbors ||
                b.neighbors.size >=
                    maxNeighbors
            ) {

                continue;
            }


            graph.connect(
                a.id,
                b.id,
                distance
            );
        }


        // ----------------------------------------------------
        // 第二轮：
        // 防止极少数节点因为邻居上限变成孤岛。
        //
        // 如果 node 完全没有连接，
        // 给它补一条最近的合法边。
        // ----------------------------------------------------

        for (
            const node
            of nodes
        ) {

            if (
                node.neighbors.size >
                0
            ) {

                continue;
            }


            const fallback =
                candidates.find(
                    candidate =>
                        candidate.a ===
                            node ||
                        candidate.b ===
                            node
                );


            if (!fallback) {

                console.warn(
                    `[Map Navigation] Waypoint ${node.id} has no reachable neighbors.`
                );

                continue;
            }


            graph.connect(
                fallback.a.id,
                fallback.b.id,
                fallback.distance
            );
        }
    }


    // ========================================================
    // Navigation clearance
    //
    // 和普通 hasClearLine 不同：
    // 同时检测中心、左侧、右侧三条射线，
    // 给 BOT 留出身体宽度，避免 A* 路径擦墙。
    // ========================================================

    hasClearNavigationLine(
        start,
        end,
        radius = 0.55
    ) {

        if (
            !start ||
            !end
        ) {

            return false;
        }


        const a =
            start.clone();


        const b =
            end.clone();


        a.y =
            0.85;


        b.y =
            0.85;


        const direction =
            b.clone()
                .sub(
                    a
                );


        const distance =
            direction.length();


        if (
            distance <=
            0.001
        ) {

            return true;
        }


        direction.normalize();


        const right =
            new THREE.Vector3(
                -direction.z,
                0,
                direction.x
            );


        const offsets = [
            0,
            radius,
            -radius
        ];


        for (
            const offset
            of offsets
        ) {

            const rayStart =
                a.clone()
                    .addScaledVector(
                        right,
                        offset
                    );


            const rayEnd =
                b.clone()
                    .addScaledVector(
                        right,
                        offset
                    );


            const rayDirection =
                rayEnd
                    .clone()
                    .sub(
                        rayStart
                    );


            const rayDistance =
                rayDirection.length();


            if (
                rayDistance <=
                0.001
            ) {

                continue;
            }


            rayDirection.normalize();


            const raycaster =
                new THREE.Raycaster(
                    rayStart,
                    rayDirection,
                    0.03,
                    Math.max(
                        0,
                        rayDistance - 0.06
                    )
                );


            const hits =
                raycaster
                    .intersectObjects(
                        this.aiCollisionObjects,
                        true
                    );


            if (
                hits.length >
                0
            ) {

                return false;
            }
        }


        return true;
    }


    // ========================================================
    // Navigation access
    // ========================================================

    getNavigationGraph() {

        return this.navigationGraph;
    }


    // ========================================================
    // Navigation Debug Toggle
    // ========================================================

    setNavigationDebug(
        enabled
    ) {

        this.navigationDebugEnabled =
            Boolean(
                enabled
            );


        if (
            this.navigationDebugEnabled
        ) {

            this.rebuildNavigationDebug();

        } else {

            if (
                this.navigationDebugGroup
            ) {

                this.navigationDebugGroup
                    .visible =
                    false;
            }


            for (
                const group
                of this
                    .navigationBotDebugGroups
                    .values()
            ) {

                group.visible =
                    false;
            }
        }


        return this.navigationDebugEnabled;
    }


    toggleNavigationDebug() {

        return this.setNavigationDebug(
            !this.navigationDebugEnabled
        );
    }


    // ========================================================
    // Build Graph Debug
    //
    // Green sphere = Waypoint
    // Blue line    = Graph edge
    // ========================================================

    rebuildNavigationDebug() {

        if (
            !this.scene ||
            !this.navigationGraph
        ) {

            return;
        }


        if (
            this.navigationDebugGroup
        ) {

            this._disposeDebugGroup(
                this.navigationDebugGroup
            );
        }


        const group =
            new THREE.Group();


        group.name =
            "NAVIGATION_DEBUG_GRAPH";


        const nodeMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0x38ff68,

                depthTest:
                    true,

                depthWrite:
                    false,

                transparent:
                    true,

                opacity:
                    0.92
            });


        const nodeGeometry =
            new THREE.SphereGeometry(
                0.22,
                7,
                7
            );


        for (
            const node
            of this.navigationGraph
                .getNodes()
        ) {

            const marker =
                new THREE.Mesh(
                    nodeGeometry,
                    nodeMaterial
                );


            marker.position
                .copy(
                    node.position
                );


            marker.position.y =
                0.34;


            marker.userData
                .navigationDebug =
                true;


            group.add(
                marker
            );
        }


        // ----------------------------------------------------
        // Invalid / rejected Waypoints
        //
        // 小红点 = 配置里存在，但因为碰撞检测失败，
        // 不会加入 A* Graph。
        // ----------------------------------------------------

        if (
            this.navigationRejectedWaypoints
                .length >
            0
        ) {

            const invalidGeometry =
                new THREE.SphereGeometry(
                    0.16,
                    7,
                    7
                );


            const invalidMaterial =
                new THREE.MeshBasicMaterial({
                    color:
                        0xff3333,

                    depthTest:
                        true,

                    depthWrite:
                        false,

                    transparent:
                        true,

                    opacity:
                        0.95,

                    wireframe:
                        true
                });


            for (
                const rejected
                of this.navigationRejectedWaypoints
            ) {

                const invalidMarker =
                    new THREE.Mesh(
                        invalidGeometry,
                        invalidMaterial
                    );


                invalidMarker.position
                    .copy(
                        rejected.position
                    );


                invalidMarker.position.y =
                    0.34;


                invalidMarker.userData
                    .navigationDebugInvalid =
                    true;


                invalidMarker.userData
                    .waypointId =
                    rejected.id;


                group.add(
                    invalidMarker
                );
            }
        }


        const edgeMaterial =
            new THREE.LineBasicMaterial({
                color:
                    0x2d8cff,

                transparent:
                    true,

                opacity:
                    0.52,

                depthTest:
                    true,

                depthWrite:
                    false
            });


        for (
            const edge
            of this.navigationGraph
                .getEdges()
        ) {

            const geometry =
                new THREE.BufferGeometry()
                    .setFromPoints([
                        new THREE.Vector3(
                            edge.a.position.x,
                            0.20,
                            edge.a.position.z
                        ),

                        new THREE.Vector3(
                            edge.b.position.x,
                            0.20,
                            edge.b.position.z
                        )
                    ]);


            const line =
                new THREE.Line(
                    geometry,
                    edgeMaterial
                );


            group.add(
                line
            );
        }


        this.scene.add(
            group
        );


        this.navigationDebugGroup =
            group;


        group.visible =
            this.navigationDebugEnabled;
    }


    // ========================================================
    // BOT Debug Path
    //
    // Yellow = remaining A* path
    // Red    = current final navigation target
    // ========================================================

    updateBotNavigationDebug(
        bot,
        path = [],
        pathIndex = 0,
        target = null
    ) {

        if (!bot) {
            return;
        }


        let group =
            this.navigationBotDebugGroups
                .get(
                    bot
                );


        if (
            group
        ) {

            this._disposeDebugGroup(
                group
            );


            this.navigationBotDebugGroups
                .delete(
                    bot
                );
        }


        if (
            !this.navigationDebugEnabled
        ) {

            return;
        }


        group =
            new THREE.Group();


        group.name =
            `BOT_NAV_DEBUG_${bot.name || "BOT"}`;


        const points = [];


        const botPosition =
            bot.getPosition?.();


        if (
            botPosition
        ) {

            points.push(
                new THREE.Vector3(
                    botPosition.x,
                    0.44,
                    botPosition.z
                )
            );
        }


        for (
            let i =
                Math.max(
                    0,
                    pathIndex
                );
            i < path.length;
            i++
        ) {

            const point =
                path[i];


            if (!point) {
                continue;
            }


            points.push(
                new THREE.Vector3(
                    point.x,
                    0.44,
                    point.z
                )
            );
        }


        if (
            target
        ) {

            const last =
                points[
                    points.length - 1
                ];


            if (
                !last ||
                last.distanceToSquared(
                    target
                ) >
                0.20
            ) {

                points.push(
                    new THREE.Vector3(
                        target.x,
                        0.44,
                        target.z
                    )
                );
            }
        }


        if (
            points.length >=
            2
        ) {

            const pathGeometry =
                new THREE.BufferGeometry()
                    .setFromPoints(
                        points
                    );


            const pathMaterial =
                new THREE.LineBasicMaterial({
                    color:
                        0xffdd22,

                    depthTest:
                        true,

                    depthWrite:
                        false,

                    transparent:
                        true,

                    opacity:
                        0.95
                });


            const line =
                new THREE.Line(
                    pathGeometry,
                    pathMaterial
                );


            group.add(
                line
            );
        }


        if (
            target
        ) {

            const targetGeometry =
                new THREE.SphereGeometry(
                    0.30,
                    8,
                    8
                );


            const targetMaterial =
                new THREE.MeshBasicMaterial({
                    color:
                        0xff3333,

                    depthTest:
                        true,

                    depthWrite:
                        false
                });


            const marker =
                new THREE.Mesh(
                    targetGeometry,
                    targetMaterial
                );


            marker.position.set(
                target.x,
                0.48,
                target.z
            );


            group.add(
                marker
            );
        }


        this.scene.add(
            group
        );


        this.navigationBotDebugGroups
            .set(
                bot,
                group
            );
    }


    clearBotNavigationDebug(
        bot
    ) {

        const group =
            this.navigationBotDebugGroups
                .get(
                    bot
                );


        if (!group) {
            return;
        }


        this._disposeDebugGroup(
            group
        );


        this.navigationBotDebugGroups
            .delete(
                bot
            );
    }


    disposeNavigationDebug() {

        if (
            this.navigationDebugGroup
        ) {

            this._disposeDebugGroup(
                this.navigationDebugGroup
            );


            this.navigationDebugGroup =
                null;
        }


        for (
            const group
            of this
                .navigationBotDebugGroups
                .values()
        ) {

            this._disposeDebugGroup(
                group
            );
        }


        this.navigationBotDebugGroups
            .clear();
    }


    _disposeDebugGroup(
        group
    ) {

        if (!group) {
            return;
        }


        group.traverse?.(
            object => {

                object.geometry
                    ?.dispose?.();


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
                                        ?.dispose?.()
                            );

                    } else {

                        object.material
                            ?.dispose?.();
                    }
                }
            }
        );


        if (
            group.parent
        ) {

            group.parent.remove(
                group
            );
        }
    }


    // ========================================================
    // System Registration
    // ========================================================

    registerSystems() {

        // ----------------------------------------------------
        // Weapon
        // ----------------------------------------------------

        for (
            const object
            of this.weaponTargets
        ) {

            weaponSystem
                .registerTarget(
                    object
                );
        }


        // ----------------------------------------------------
        // Grenade
        // ----------------------------------------------------

        for (
            const object
            of this.grenadeCollisionObjects
        ) {

            grenadeSystem
                .registerCollisionObject(
                    object
                );
        }
    }


    // ========================================================
    // Register Entity
    //
    // game.js 创建 Player / Bot 后调用。
    // ========================================================

    registerEntity(entity) {

        if (!entity) {
            return;
        }


        const object =
            entity.group ||
            entity.getObject3D?.();


        if (!object) {
            return;
        }


        // ----------------------------------------------------
        // Weapon
        // ----------------------------------------------------

        weaponSystem
            .registerTarget(
                object
            );


        // ----------------------------------------------------
        // Grenade
        // ----------------------------------------------------

        grenadeSystem
            .registerEntityObject(
                object
            );
    }


    // ========================================================
    // Unregister Entity
    // ========================================================

    unregisterEntity(entity) {

        if (!entity) {
            return;
        }


        const object =
            entity.group ||
            entity.getObject3D?.();


        if (!object) {
            return;
        }


        weaponSystem
            .unregisterTarget(
                object
            );


        grenadeSystem
            .unregisterEntityObject(
                object
            );
    }


    // ========================================================
    // AI Collision Objects
    // ========================================================

    getAICollisionObjects() {

        return [
            ...this.aiCollisionObjects
        ];
    }


    // ========================================================
    // Weapon Targets
    // ========================================================

    getWeaponTargets() {

        return [
            ...this.weaponTargets
        ];
    }


    // ========================================================
    // Grenade Colliders
    // ========================================================

    getGrenadeCollisionObjects() {

        return [
            ...this
                .grenadeCollisionObjects
        ];
    }


    // ========================================================
    // Collision
    //
    // 简化版 AABB。
    // 后面 Player/Bot 可以调用。
    // ========================================================

    resolvePositionCollision(
        position,
        radius = 0.45
    ) {

        const result =
            position.clone();


        // ----------------------------------------------------
        // World Bounds
        // ----------------------------------------------------

        result.x =
            THREE.MathUtils.clamp(
                result.x,
                MAP_CONFIG.worldBounds
                    .minX +
                    radius,

                MAP_CONFIG.worldBounds
                    .maxX -
                    radius
            );


        result.z =
            THREE.MathUtils.clamp(
                result.z,
                MAP_CONFIG.worldBounds
                    .minZ +
                    radius,

                MAP_CONFIG.worldBounds
                    .maxZ -
                    radius
            );


        // ----------------------------------------------------
        // Box obstacles
        // ----------------------------------------------------

        for (
            const object
            of this.collisionObjects
        ) {

            /*
             * floor 不做水平阻挡。
             */
            if (
                object.userData.mapType ===
                MAP_OBJECT_TYPE.FLOOR
            ) {
                continue;
            }


            const box =
                new THREE.Box3()
                    .setFromObject(
                        object
                    );


            const expanded =
                box.clone();


            expanded.min.x -=
                radius;

            expanded.max.x +=
                radius;

            expanded.min.z -=
                radius;

            expanded.max.z +=
                radius;


            if (
                result.x >
                    expanded.min.x &&

                result.x <
                    expanded.max.x &&

                result.z >
                    expanded.min.z &&

                result.z <
                    expanded.max.z
            ) {

                const distances = {
                    left:
                        Math.abs(
                            result.x -
                            expanded.min.x
                        ),

                    right:
                        Math.abs(
                            expanded.max.x -
                            result.x
                        ),

                    top:
                        Math.abs(
                            result.z -
                            expanded.min.z
                        ),

                    bottom:
                        Math.abs(
                            expanded.max.z -
                            result.z
                        )
                };


                const smallest =
                    Math.min(
                        distances.left,
                        distances.right,
                        distances.top,
                        distances.bottom
                    );


                if (
                    smallest ===
                    distances.left
                ) {

                    result.x =
                        expanded.min.x;

                } else if (
                    smallest ===
                    distances.right
                ) {

                    result.x =
                        expanded.max.x;

                } else if (
                    smallest ===
                    distances.top
                ) {

                    result.z =
                        expanded.min.z;

                } else {

                    result.z =
                        expanded.max.z;
                }
            }
        }


        return result;
    }


    // ========================================================
    // Is Walkable
    // ========================================================

    isWalkable(
        position,
        radius = 0.45
    ) {

        const resolved =
            this.resolvePositionCollision(
                position,
                radius
            );


        return (
            resolved.distanceToSquared(
                position
            ) <
            0.0001
        );
    }


    // ========================================================
    // Random Walkable Point
    //
    // BOT AI 以后可以用这个替代纯随机坐标。
    // ========================================================

    getRandomWalkablePoint({
        minX =
            MAP_CONFIG.worldBounds
                .minX +
            5,

        maxX =
            MAP_CONFIG.worldBounds
                .maxX -
            5,

        minZ =
            MAP_CONFIG.worldBounds
                .minZ +
            5,

        maxZ =
            MAP_CONFIG.worldBounds
                .maxZ -
            5,

        radius = 0.6,

        attempts = 30
    } = {}) {

        for (
            let i = 0;
            i < attempts;
            i++
        ) {

            const candidate =
                new THREE.Vector3(
                    randomRange(
                        minX,
                        maxX
                    ),
                    0,
                    randomRange(
                        minZ,
                        maxZ
                    )
                );


            if (
                this.isWalkable(
                    candidate,
                    radius
                )
            ) {

                return candidate;
            }
        }


        return new THREE.Vector3(
            0,
            0,
            0
        );
    }


    // ========================================================
    // Line of Sight helper
    // ========================================================

    hasClearLine(
        start,
        end
    ) {

        if (
            !start ||
            !end
        ) {
            return false;
        }


        const direction =
            end.clone()
                .sub(start);


        const distance =
            direction.length();


        if (
            distance <= 0.001
        ) {
            return true;
        }


        direction.normalize();


        const raycaster =
            new THREE.Raycaster(
                start,
                direction,
                0,
                distance
            );


        const hits =
            raycaster
                .intersectObjects(
                    this.aiCollisionObjects,
                    true
                );


        return (
            hits.length === 0
        );
    }


    // ========================================================
    // Clear
    // ========================================================

    clear() {

        this.disposeNavigationDebug();


        if (
            this.navigationGraph
        ) {

            this.navigationGraph
                .clear();


            this.navigationGraph =
                null;
        }


        // ====================================================
        // unregister weapon
        // ====================================================

        for (
            const object
            of this.weaponTargets
        ) {

            weaponSystem
                .unregisterTarget(
                    object
                );
        }


        // ====================================================
        // unregister grenade
        // ====================================================

        for (
            const object
            of this.grenadeCollisionObjects
        ) {

            grenadeSystem
                .unregisterCollisionObject(
                    object
                );
        }


        // ====================================================
        // Dispose
        // ====================================================

        const children =
            [
                ...this.group.children
            ];


        for (
            const child
            of children
        ) {

            this.group.remove(
                child
            );


            child.traverse?.(
                object => {

                    object.geometry
                        ?.dispose?.();
                }
            );
        }


        this.disposeMaterials();


        this.collisionObjects.length =
            0;

        this.weaponTargets.length =
            0;

        this.grenadeCollisionObjects.length =
            0;

        this.aiCollisionObjects.length =
            0;


        this.navigationRejectedWaypoints =
            [];


        this.spawnPoints[
            TEAM.CT
        ].length = 0;


        this.spawnPoints[
            TEAM.T
        ].length = 0;


        this.buyZones[
            TEAM.CT
        ] = null;


        this.buyZones[
            TEAM.T
        ] = null;


        this.loaded =
            false;
    }


    // ========================================================
    // Material disposal
    // ========================================================

    disposeMaterials() {

        for (
            const material
            of Object.values(
                this.materials
            )
        ) {

            material
                ?.dispose?.();
        }


        this.materials = {};
    }


    // ========================================================
    // State
    // ========================================================

    getState() {

        return {
            loaded:
                this.loaded,

            currentMap:
                this.currentMap,

            collisionObjects:
                this.collisionObjects
                    .length,

            weaponTargets:
                this.weaponTargets
                    .length,

            grenadeColliders:
                this
                    .grenadeCollisionObjects
                    .length,

            navigationWaypoints:
                this.navigationGraph
                    ?.nodes
                    ?.size ??
                0,

            navigationEdges:
                this.navigationGraph
                    ?.getEdges?.()
                    ?.length ??
                0,

            navigationDebug:
                this.navigationDebugEnabled,

            navigationRejectedWaypoints:
                this.navigationRejectedWaypoints
                    .length,

            ctSpawns:
                this.spawnPoints[
                    TEAM.CT
                ].length,

            tSpawns:
                this.spawnPoints[
                    TEAM.T
                ].length
        };
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.clear();


        if (
            this.group.parent
        ) {

            this.group.parent.remove(
                this.group
            );
        }


        this.scene = null;
    }
}


// ============================================================
// 全局单例
// ============================================================

export const map =
    new GameMap();

export default map;