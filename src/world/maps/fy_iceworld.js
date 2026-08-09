/**
 * Web-CS15
 * src/world/maps/fy_iceworld.js
 *
 * Iceworld 地图定义
 *
 * 只负责：
 * - 地图几何
 * - Spawn
 * - Buy Zone
 * - Waypoint Graph
 */

import * as THREE from "three";

import {
    MAP_CONFIG
} from "../../core/config.js";

import {
    WaypointGraph
} from "../../bot/navigation.js";


export const MAP_ID =
    "fy_iceworld_web";


export function buildFyIceworld(
    gameMap
) {

    if (!gameMap) {
        throw new Error(
            "[fy_iceworld] gameMap is required."
        );
    }


    createIceworldGeometry.call(
        gameMap
    );


    return gameMap;
}


// ============================================================
// Geometry
// ============================================================

function createIceworldGeometry() {

    this.createMaterials();


    // ====================================================
    // Floor
    // ====================================================

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


    // ====================================================
    // Outer Walls
    // ====================================================

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


    // ====================================================
    // 中央结构
    // ====================================================

    this.createCover({
        position:
            new THREE.Vector3(
                0,
                1.8,
                0
            ),

        size:
            new THREE.Vector3(
                8,
                3.6,
                8
            )
    });


    // ====================================================
    // 十字掩体
    // ====================================================

    this.createCover({
        position:
            new THREE.Vector3(
                -15,
                1.4,
                0
            ),

        size:
            new THREE.Vector3(
                6,
                2.8,
                16
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                15,
                1.4,
                0
            ),

        size:
            new THREE.Vector3(
                6,
                2.8,
                16
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                0,
                1.4,
                -16
            ),

        size:
            new THREE.Vector3(
                18,
                2.8,
                5
            )
    });


    this.createCover({
        position:
            new THREE.Vector3(
                0,
                1.4,
                16
            ),

        size:
            new THREE.Vector3(
                18,
                2.8,
                5
            )
    });


    // ====================================================
    // Crates
    // ====================================================

    const crates = [
        [-28, 1, -12],
        [-28, 1, 12],
        [28, 1, -12],
        [28, 1, 12],

        [-10, 1, -30],
        [10, 1, -30],

        [-10, 1, 30],
        [10, 1, 30]
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
                    3.2,
                    2,
                    3.2
                )
        });
    }


    // ====================================================
    // Spawn points
    // ====================================================

    this.createSpawnPoints();


    // ====================================================
    // Buy zones
    // ====================================================

    this.createBuyZones();


    // ====================================================
    // Waypoint Graph + A*
    // ====================================================

    createIceworldNavigationGraph.call(this);


    // ====================================================
    // Map metadata
    // ====================================================

    this.group.userData.mapName =
        "fy_iceworld_web";
}



// ============================================================
// Navigation
// ============================================================

function createIceworldNavigationGraph() {

    this.disposeNavigationDebug();


    this.navigationGraph =
        new WaypointGraph();


    this.navigationRejectedWaypoints =
        [];


    const graph =
        this.navigationGraph;


    /*
     * 节点故意放在建筑物外侧、走廊和出生区。
     * y 使用 0，实际连线检测时会抬高到 BOT 身体中部。
     */
    const points = [

        // CT spawn side
        ["ct_l", -24, -42],
        ["ct_ml", -12, -42],
        ["ct_c", 0, -42],
        ["ct_mr", 12, -42],
        ["ct_r", 24, -42],

        // North outer lane
        ["n_l2", -34, -29],
        ["n_l1", -21, -29],
        ["n_c", 0, -26],
        ["n_r1", 21, -29],
        ["n_r2", 34, -29],

        // North-middle corridor
        ["nm_l2", -28, -20],
        ["nm_l1", -20, -12],
        ["nm_c1", -10, -10],
        ["nm_c2", 0, -10],
        ["nm_c3", 10, -10],
        ["nm_r1", 20, -12],
        ["nm_r2", 28, -20],

        // Center west/east corridors
        ["c_w2", -29, 0],
        ["c_w1", -21, 0],
        ["c_w0", -9, 0],
        ["c_e0", 9, 0],
        ["c_e1", 21, 0],
        ["c_e2", 29, 0],

        // South-middle corridor
        ["sm_l2", -28, 20],
        ["sm_l1", -20, 12],
        ["sm_c1", -10, 10],
        ["sm_c2", 0, 10],
        ["sm_c3", 10, 10],
        ["sm_r1", 20, 12],
        ["sm_r2", 28, 20],

        // South outer lane
        ["s_l2", -34, 29],
        ["s_l1", -21, 29],
        ["s_c", 0, 26],
        ["s_r1", 21, 29],
        ["s_r2", 34, 29],

        // T spawn side
        ["t_l", -24, 42],
        ["t_ml", -12, 42],
        ["t_c", 0, 42],
        ["t_mr", 12, 42],
        ["t_r", 24, 42]
    ];


    for (
        const [
            id,
            x,
            z
        ]
        of points
    ) {

        const position =
            new THREE.Vector3(
                x,
                0,
                z
            );


        /*
         * 保险：
         * 如果以后地图几何调整导致节点进入墙体，
         * 该节点直接跳过，不让 A* 使用无效点。
         */
        if (
            !this.isWalkable(
                position,
                0.65
            )
        ) {

            console.warn(
                `[Map Navigation] Waypoint ${id} is not walkable.`,
                position
            );


            /*
             * 只用于 Debug 显示。
             * 不会加入 navigationGraph，
             * 因此 A* 永远不会经过这个无效点。
             */
            this.navigationRejectedWaypoints.push({
                id,
                position:
                    position.clone()
            });


            continue;
        }


        graph.addNode(
            id,
            position
        );
    }


    this.autoConnectNavigationGraph(
        18.5,
        5
    );


    /*
     * 如果 Debug 当前已经开启，
     * 地图重载后自动重新显示。
     */
    if (
        this.navigationDebugEnabled
    ) {

        this.rebuildNavigationDebug();
    }


    console.log(
        `[Map Navigation] ${graph.nodes.size} waypoints, ` +
        `${graph.getEdges().length} edges`
    );


    return graph;
}



export default buildFyIceworld;