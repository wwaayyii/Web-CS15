/**
 * Web-CS15
 * src/world/maps/aim_arena.js
 *
 * Aim Arena V3 - Full Rebuild
 *
 * 设计目标：
 * - 与 Iceworld 完全不同的拓扑
 * - 中央大面积开放练枪区
 * - LEFT / MID / RIGHT 三条明显路线
 * - 四组 L 型低掩体
 * - 左右两条侧翼长墙
 * - 少量箱子
 * - 深灰竞技场主题
 * - 黄色中心圆环
 * - CT 蓝色出生区
 * - T 红色出生区
 * - 独立 Waypoint Graph
 */

import * as THREE from "three";

import {
    MAP_CONFIG,
    TEAM
} from "../../core/config.js";

import {
    gameEvents
} from "../../core/utils.js";

import {
    WaypointGraph
} from "../../bot/navigation.js";


export const MAP_ID =
    "aim_arena_web";


export const MAP_VERSION =
    "aim_arena_v3_rebuilt_20260808";


// ============================================================
// Public Builder
// ============================================================

export function buildAimArena(
    gameMap
) {

    if (!gameMap) {

        throw new Error(
            "[aim_arena] gameMap is required."
        );
    }


    console.log(
        `[Aim Arena] Builder executing: ${MAP_VERSION}`
    );


    gameMap.group
        .userData
        .mapVersion =
        MAP_VERSION;


    createArenaTheme.call(
        gameMap
    );


    createArenaFloor.call(
        gameMap
    );


    createArenaBoundary.call(
        gameMap
    );


    createArenaCombatLayout.call(
        gameMap
    );


    createArenaDecorations.call(
        gameMap
    );


    createArenaSpawnPoints.call(
        gameMap
    );


    gameMap.createBuyZones();


    createArenaNavigation.call(
        gameMap
    );


    gameMap.group
        .userData
        .mapName =
        MAP_ID;


    return gameMap;
}


// ============================================================
// Theme
// ============================================================

function createArenaTheme() {

    this.createMaterials();


    // ========================================================
    // Strongly Different Palette
    // ========================================================

    this.materials.floor
        .color
        .setHex(
            0x2d3238
        );


    this.materials.wall
        .color
        .setHex(
            0x15191e
        );


    this.materials.cover
        .color
        .setHex(
            0x66704a
        );


    this.materials.crate
        .color
        .setHex(
            0x9a642d
        );


    this.materials.floor
        .roughness =
        0.78;


    this.materials.wall
        .roughness =
        0.88;


    this.materials.cover
        .roughness =
        0.82;
}


// ============================================================
// Floor
// ============================================================

function createArenaFloor() {

    const floor =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                MAP_CONFIG.size.width,
                0.4,
                MAP_CONFIG.size.depth
            ),
            this.materials.floor
        );


    floor.position.set(
        0,
        -0.2,
        0
    );


    this.addMapObject(
        floor,
        "floor",
        {
            collision:
                true,

            weaponTarget:
                true,

            grenadeCollision:
                true,

            aiCollision:
                false
        }
    );
}


// ============================================================
// Boundary
// ============================================================

function createArenaBoundary() {

    const halfW =
        MAP_CONFIG.size.width /
        2;


    const halfD =
        MAP_CONFIG.size.depth /
        2;


    const wallHeight =
        MAP_CONFIG.borderHeight;


    const thickness =
        MAP_CONFIG.borderThickness;


    // North
    this.createWall({
        position:
            new THREE.Vector3(
                0,
                wallHeight / 2,
                -halfD
            ),

        size:
            new THREE.Vector3(
                MAP_CONFIG.size.width,
                wallHeight,
                thickness
            )
    });


    // South
    this.createWall({
        position:
            new THREE.Vector3(
                0,
                wallHeight / 2,
                halfD
            ),

        size:
            new THREE.Vector3(
                MAP_CONFIG.size.width,
                wallHeight,
                thickness
            )
    });


    // West
    this.createWall({
        position:
            new THREE.Vector3(
                -halfW,
                wallHeight / 2,
                0
            ),

        size:
            new THREE.Vector3(
                thickness,
                wallHeight,
                MAP_CONFIG.size.depth
            )
    });


    // East
    this.createWall({
        position:
            new THREE.Vector3(
                halfW,
                wallHeight / 2,
                0
            ),

        size:
            new THREE.Vector3(
                thickness,
                wallHeight,
                MAP_CONFIG.size.depth
            )
    });
}


// ============================================================
// Combat Layout
// ============================================================

function createArenaCombatLayout() {

    // ========================================================
    // CENTRAL OPEN ZONE
    //
    // 中央保持开放，不放大建筑。
    // 这是与 Iceworld 最大区别。
    // ========================================================


    // ========================================================
    // Four L-shaped cover groups
    //
    // 每组由两块低墙组成一个 L。
    // ========================================================

    const lGroups = [
        // North-West
        {
            x:
                -16,
            z:
                -14,
            sx1:
                10,
            sz1:
                2.6,
            sx2:
                2.6,
            sz2:
                8,
            ox:
                -3.7,
            oz:
                2.7
        },

        // North-East
        {
            x:
                16,
            z:
                -14,
            sx1:
                10,
            sz1:
                2.6,
            sx2:
                2.6,
            sz2:
                8,
            ox:
                3.7,
            oz:
                2.7
        },

        // South-West
        {
            x:
                -16,
            z:
                14,
            sx1:
                10,
            sz1:
                2.6,
            sx2:
                2.6,
            sz2:
                8,
            ox:
                -3.7,
            oz:
                -2.7
        },

        // South-East
        {
            x:
                16,
            z:
                14,
            sx1:
                10,
            sz1:
                2.6,
            sx2:
                2.6,
            sz2:
                8,
            ox:
                3.7,
            oz:
                -2.7
        }
    ];


    for (
        const group
        of lGroups
    ) {

        // Horizontal part
        this.createCover({
            position:
                new THREE.Vector3(
                    group.x,
                    1.15,
                    group.z
                ),

            size:
                new THREE.Vector3(
                    group.sx1,
                    2.3,
                    group.sz1
                )
        });


        // Vertical part
        this.createCover({
            position:
                new THREE.Vector3(
                    group.x +
                        group.ox,
                    1.15,
                    group.z +
                        group.oz
                ),

            size:
                new THREE.Vector3(
                    group.sx2,
                    2.3,
                    group.sz2
                )
        });
    }


    // ========================================================
    // LEFT / RIGHT side-lane barriers
    //
    // 在地图两侧形成真正的侧翼通路。
    // ========================================================

    this.createCover({
        position:
            new THREE.Vector3(
                -34,
                1.5,
                -7
            ),

        size:
            new THREE.Vector3(
                3.0,
                3.0,
                24
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                -34,
                1.5,
                20
            ),

        size:
            new THREE.Vector3(
                3.0,
                3.0,
                14
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                34,
                1.5,
                -20
            ),

        size:
            new THREE.Vector3(
                3.0,
                3.0,
                14
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                34,
                1.5,
                7
            ),

        size:
            new THREE.Vector3(
                3.0,
                3.0,
                24
            )
    });


    // ========================================================
    // Two central shooting blocks
    //
    // 小而高，不阻断中央视线。
    // ========================================================

    this.createCover({
        position:
            new THREE.Vector3(
                -5,
                1.7,
                0
            ),

        size:
            new THREE.Vector3(
                2.8,
                3.4,
                2.8
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                5,
                1.7,
                0
            ),

        size:
            new THREE.Vector3(
                2.8,
                3.4,
                2.8
            )
    });


    // ========================================================
    // Sparse crates
    //
    // 只在侧路和出生区域附近放少量箱子。
    // ========================================================

    const crates = [
        [-42, 1, -30],
        [ 42, 1, -30],

        [-42, 1,  30],
        [ 42, 1,  30],

        [-24, 1, -34],
        [ 24, 1,  34]
    ];


    for (
        const [
            x,
            y,
            z
        ]
        of crates
    ) {

        this.createCrate({
            position:
                new THREE.Vector3(
                    x,
                    y,
                    z
                ),

            size:
                new THREE.Vector3(
                    3.4,
                    2.0,
                    3.4
                )
        });
    }
}


// ============================================================
// Decorative Floor Markings
// ============================================================

function createArenaDecorations() {

    // ========================================================
    // Center Ring
    // ========================================================

    const ringMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0xf2d85c,

            transparent:
                true,

            opacity:
                0.72,

            side:
                THREE.DoubleSide,

            depthWrite:
                false
        });


    const ring =
        new THREE.Mesh(
            new THREE.RingGeometry(
                8.0,
                8.45,
                64
            ),
            ringMaterial
        );


    ring.rotation.x =
        -Math.PI / 2;


    ring.position.set(
        0,
        0.025,
        0
    );


    ring.userData
        .decoration =
        true;


    this.group.add(
        ring
    );


    // ========================================================
    // Center Cross Lines
    // ========================================================

    const lineMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0xf2d85c,

            transparent:
                true,

            opacity:
                0.50,

            depthWrite:
                false
        });


    const horizontalLine =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                46,
                0.32
            ),
            lineMaterial
        );


    horizontalLine.rotation.x =
        -Math.PI / 2;


    horizontalLine.position.set(
        0,
        0.026,
        0
    );


    horizontalLine.userData
        .decoration =
        true;


    this.group.add(
        horizontalLine
    );


    const verticalLine =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                0.32,
                46
            ),
            lineMaterial
        );


    verticalLine.rotation.x =
        -Math.PI / 2;


    verticalLine.position.set(
        0,
        0.027,
        0
    );


    verticalLine.userData
        .decoration =
        true;


    this.group.add(
        verticalLine
    );


    // ========================================================
    // Spawn Zone Floors
    // ========================================================

    const ctMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0x1976d2,

            transparent:
                true,

            opacity:
                0.34,

            depthWrite:
                false
        });


    const tMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0xd63b32,

            transparent:
                true,

            opacity:
                0.34,

            depthWrite:
                false
        });


    const ctZone =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                54,
                9
            ),
            ctMaterial
        );


    ctZone.rotation.x =
        -Math.PI / 2;


    ctZone.position.set(
        0,
        0.028,
        -43
    );


    ctZone.userData
        .decoration =
        true;


    this.group.add(
        ctZone
    );


    const tZone =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                54,
                9
            ),
            tMaterial
        );


    tZone.rotation.x =
        -Math.PI / 2;


    tZone.position.set(
        0,
        0.029,
        43
    );


    tZone.userData
        .decoration =
        true;


    this.group.add(
        tZone
    );


    // ========================================================
    // Lane Labels / blocks
    //
    // 简单色块提示左右路线。
    // ========================================================

    const laneMaterial =
        new THREE.MeshBasicMaterial({
            color:
                0x8a9258,

            transparent:
                true,

            opacity:
                0.16,

            depthWrite:
                false
        });


    const leftLane =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                12,
                72
            ),
            laneMaterial
        );


    leftLane.rotation.x =
        -Math.PI / 2;


    leftLane.position.set(
        -38,
        0.02,
        0
    );


    leftLane.userData
        .decoration =
        true;


    this.group.add(
        leftLane
    );


    const rightLane =
        new THREE.Mesh(
            new THREE.PlaneGeometry(
                12,
                72
            ),
            laneMaterial
        );


    rightLane.rotation.x =
        -Math.PI / 2;


    rightLane.position.set(
        38,
        0.02,
        0
    );


    rightLane.userData
        .decoration =
        true;


    this.group.add(
        rightLane
    );
}


// ============================================================
// Spawn Points
// ============================================================

function createArenaSpawnPoints() {

    this.spawnPoints[
        TEAM.CT
    ].length =
        0;


    this.spawnPoints[
        TEAM.T
    ].length =
        0;


    const xPositions = [
        -20,
        -10,
        0,
        10,
        20
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
                -43
            )
        );


        this.spawnPoints[
            TEAM.T
        ].push(
            new THREE.Vector3(
                x,
                0,
                43
            )
        );
    }
}


// ============================================================
// Navigation
// ============================================================

function createArenaNavigation() {

    this.navigationGraph =
        new WaypointGraph();


    this.navigationRejectedWaypoints =
        [];


    const graph =
        this.navigationGraph;


    // ========================================================
    // Waypoint Layout
    //
    // LEFT / MID / RIGHT 三路线
    // 中央区域保留更多节点，便于 Tactical BOT 分流。
    // ========================================================

    const definitions = [
        // CT rear
        ["ct_l",   -22, -41],
        ["ct_m",     0, -41],
        ["ct_r",    22, -41],

        // CT forward
        ["c2_l",   -28, -32],
        ["c2_lm",  -12, -31],
        ["c2_m",     0, -31],
        ["c2_rm",   12, -31],
        ["c2_r",    28, -32],

        // North approach
        ["n_l",    -39, -22],
        ["n_lm",   -22, -22],
        ["n_m",      0, -22],
        ["n_rm",    22, -22],
        ["n_r",     39, -22],

        // North center
        ["nc_l",   -25, -10],
        ["nc_lm",  -10, -9],
        ["nc_m",     0, -11],
        ["nc_rm",   10, -9],
        ["nc_r",    25, -10],

        // Center
        ["mid_l",  -39,   0],
        ["mid_l2", -22,   0],
        ["mid_l1", -10,   0],
        ["mid_c",    0,   0],
        ["mid_r1",  10,   0],
        ["mid_r2",  22,   0],
        ["mid_r",   39,   0],

        // South center
        ["sc_l",   -25,  10],
        ["sc_lm",  -10,   9],
        ["sc_m",     0,  11],
        ["sc_rm",   10,   9],
        ["sc_r",    25,  10],

        // South approach
        ["s_l",    -39,  22],
        ["s_lm",   -22,  22],
        ["s_m",      0,  22],
        ["s_rm",    22,  22],
        ["s_r",     39,  22],

        // T forward
        ["t2_l",   -28,  32],
        ["t2_lm",  -12,  31],
        ["t2_m",     0,  31],
        ["t2_rm",   12,  31],
        ["t2_r",    28,  32],

        // T rear
        ["t_l",    -22,  41],
        ["t_m",      0,  41],
        ["t_r",     22,  41]
    ];


    for (
        const [
            id,
            x,
            z
        ]
        of definitions
    ) {

        const position =
            new THREE.Vector3(
                x,
                0,
                z
            );


        if (
            !this.isWalkable(
                position,
                0.65
            )
        ) {

            this.navigationRejectedWaypoints
                .push({
                    id,

                    position:
                        position.clone()
                });


            console.warn(
                `[Aim Arena V3] Rejected waypoint: ${id}`,
                position
            );


            continue;
        }


        graph.addNode(
            id,
            position
        );
    }


    // ========================================================
    // Auto Connections
    //
    // 较短连接 + 最多 5 邻居，
    // 避免 Debug 蓝线蜘蛛网。
    // ========================================================

    this.autoConnectNavigationGraph(
        17.5,
        5
    );


    // ========================================================
    // Debug
    // ========================================================

    if (
        this.navigationDebugEnabled
    ) {

        this.rebuildNavigationDebug();
    }


    gameEvents.emit(
        "map:navigation-ready",
        {
            graph:
                this.navigationGraph,

            nodes:
                this.navigationGraph
                    .size,

            map:
                MAP_ID
        }
    );


    console.log(
        `[Aim Arena V3] Loaded with ${this.navigationGraph.size} navigation nodes`
    );
}


export default buildAimArena;