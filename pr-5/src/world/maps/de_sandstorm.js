/**
 * Web-CS15 - de_sandstorm Vertical Gameplay Blockout V2
 *
 * Original compact demolition layout with a lowered canal/tunnel network,
 * an elevated radar site, and real walkable ramps linking every level.
 */

import * as THREE from "three";
import { TEAM } from "../../core/config.js";
import { WaypointGraph } from "../../bot/navigation.js";

export const MAP_ID = "de_sandstorm";
export const MAP_VERSION = "de_sandstorm_blockout_v2";

export function buildDeSandstorm(gameMap) {
    if (!gameMap) {
        throw new Error("[de_sandstorm] gameMap is required.");
    }

    gameMap.createMaterials();
    gameMap.hasVerticalTerrain = true;
    createTheme(gameMap);
    createGeometry(gameMap);
    createSpawnsAndZones(gameMap);
    createNavigation(gameMap);

    gameMap.group.userData.mapName = MAP_ID;
    gameMap.group.userData.mapVersion = MAP_VERSION;
    gameMap.group.userData.bombSites = {
        A: new THREE.Vector3(-35, 4, -27),
        B: new THREE.Vector3(34, 0, -24)
    };
    return gameMap;
}

function createTheme(gameMap) {
    gameMap.materials.floor.color.setHex(0xb99157);
    gameMap.materials.wall.color.setHex(0x80684d);
    gameMap.materials.cover.color.setHex(0x9a7a4e);
    gameMap.materials.crate.color.setHex(0x5f5b4a);
    gameMap.materials.floor.roughness = 0.94;
    gameMap.materials.wall.roughness = 0.9;
}

function addWalkableBox(gameMap, { position, size, rotation = null, name }) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        gameMap.materials.floor
    );
    mesh.position.copy(position);
    if (rotation) {
        mesh.rotation.order = "YXZ";
        mesh.rotation.copy(rotation);
    }
    mesh.name = name;
    gameMap.addMapObject(mesh, "floor", {
        collision: true,
        weaponTarget: true,
        grenadeCollision: true,
        aiCollision: false,
        walkableSurface: true
    });
    return mesh;
}

function addFloor(gameMap, name, x, groundY, z, width, depth) {
    return addWalkableBox(gameMap, {
        name,
        position: new THREE.Vector3(x, groundY - 0.2, z),
        size: new THREE.Vector3(width, 0.4, depth)
    });
}

function addRamp(gameMap, name, start, end, width = 7) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const rise = end.y - start.y;
    const run = Math.hypot(dx, dz);
    const slopeLength = Math.hypot(run, rise);
    const thickness = 0.4;
    const pitch = -Math.atan2(rise, run);
    const yaw = Math.atan2(dx, dz);

    /*
     * Offset the solid box beneath its walking plane. The local +Y normal
     * tilts with the ramp, so subtracting it keeps the top-face center on the
     * exact midpoint between start/end rather than shifting the seam sideways.
     */
    const rotation = new THREE.Euler(pitch, yaw, 0, "YXZ");
    const surfaceNormal = new THREE.Vector3(0, 1, 0)
        .applyEuler(rotation);
    const center = new THREE.Vector3()
        .addVectors(start, end)
        .multiplyScalar(0.5)
        .addScaledVector(surfaceNormal, -thickness * 0.5);

    return addWalkableBox(gameMap, {
        name,
        position: center,
        size: new THREE.Vector3(width, thickness, slopeLength),
        rotation
    });
}

function createGeometry(gameMap) {
    // A low safety floor prevents falling out; tactical surfaces sit above it.
    addFloor(gameMap, "SANDSTORM_LOW_SAFETY_FLOOR", 0, -4, 0, 120, 120);

    // Main combat levels.
    addFloor(gameMap, "T_SPAWN_FLOOR", 0, 0, 49, 112, 18);
    addFloor(gameMap, "LONG_APPROACH_FLOOR", -44, 0, 33, 12, 22);
    addFloor(gameMap, "MID_BASIN_FLOOR", 0, -2, 3, 15, 70);
    addFloor(gameMap, "SHORT_MID_PLATFORM", -14, 1, -8, 9, 9);
    addFloor(gameMap, "A_ELEVATED_PLATFORM", -34, 4, -29, 30, 28);
    addFloor(gameMap, "CT_ELEVATED_SPAWN", 0, 1.5, -53, 48, 8);
    addFloor(gameMap, "B_SITE_FLOOR", 35, 0, -20, 24, 40);
    addFloor(gameMap, "B_TUNNEL_FLOOR", 32, -3, 23, 18, 20);

    // Required tactical ramps. All are real floor colliders and grenade targets.
    addRamp(gameMap, "LONG_RAMP", new THREE.Vector3(-44, 0, 22), new THREE.Vector3(-44, 4, -18), 11);
    addRamp(gameMap, "MID_BASIN_DESCENT", new THREE.Vector3(0, 0, 43), new THREE.Vector3(0, -2, 33), 7);
    addRamp(gameMap, "MID_SHORT_RAMP", new THREE.Vector3(0, -2, -3), new THREE.Vector3(-14, 1, -8), 7);
    addRamp(gameMap, "SHORT_A_RAMP", new THREE.Vector3(-14, 1, -12), new THREE.Vector3(-25, 4, -23), 7);
    addRamp(gameMap, "T_TUNNEL_DESCENT", new THREE.Vector3(21, 0, 44), new THREE.Vector3(32, -3, 34), 8);
    addRamp(gameMap, "TUNNEL_B_RAMP", new THREE.Vector3(32, -3, 13), new THREE.Vector3(43, 0, -4), 8);
    addRamp(gameMap, "CT_A_SUPPORT_RAMP", new THREE.Vector3(-20, 1.5, -51), new THREE.Vector3(-24, 4, -43), 7);
    addRamp(gameMap, "CT_B_SUPPORT_RAMP", new THREE.Vector3(15, 1.5, -51), new THREE.Vector3(29, 0, -39), 7);
    addRamp(gameMap, "CT_MID_RAMP", new THREE.Vector3(0, 1.5, -49), new THREE.Vector3(0, -2, -32), 7);

    const walls = [
        [0, -60, 120, 4], [0, 60, 120, 4], [-60, 0, 4, 120], [60, 0, 4, 120],
        [-31, 22, 3, 48], [-31, -43, 3, 18], [-51, 2, 3, 72], [-41, -38, 20, 3],
        [-9, 25, 3, 34], [-9, -21, 3, 22], [9, 29, 3, 26], [9, -15, 3, 30],
        [-40, -48, 20, 3], [-14, -48, 8, 3], [-18, -32, 3, 20],
        [16, -42, 16, 3], [39, -42, 14, 3], [48, -25, 3, 34], [30, -8, 18, 3],
        [22, 24, 3, 32], [43, 29, 3, 34]
    ];
    for (const [x, z, sx, sz] of walls) {
        gameMap.createWall({
            position: new THREE.Vector3(x, 2, z),
            size: new THREE.Vector3(sx, 12, sz)
        });
    }

    const covers = [
        [-39, 1.25, 18, 4, 2.5, 7], [-39, 5.25, -27, 6, 2.5, 3],
        [-29, 5.25, -25, 3, 2.5, 5], [-2, -0.9, 7, 5, 2.2, 3],
        [2, -0.9, -21, 4, 2.2, 3], [31, 1.3, -24, 5, 2.6, 4],
        [39, 1.3, -18, 3, 2.6, 6], [33, -1.9, 25, 4, 2.2, 4]
    ];
    for (const [x, y, z, sx, sy, sz] of covers) {
        gameMap.createCover({ position: new THREE.Vector3(x, y, z), size: new THREE.Vector3(sx, sy, sz) });
    }

    addSiteMarker(gameMap, "A", -35, 4, -27);
    addSiteMarker(gameMap, "B", 34, 0, -24);
}

function addSiteMarker(gameMap, name, x, y, z) {
    const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ color: 0xd18b2d, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, y + 0.012, z);
    marker.name = `BOMB_SITE_${name}`;
    marker.userData.bombSite = name;
    gameMap.group.add(marker);
}

function createSpawnsAndZones(gameMap) {
    gameMap.spawnPoints[TEAM.T] = [-8, -4, 0, 4, 8].map((x, index) => new THREE.Vector3(x, 0, index % 2 ? 45 : 49));
    gameMap.spawnPoints[TEAM.CT] = [-8, -4, 0, 4, 8].map((x, index) => new THREE.Vector3(x, 1.5, index % 2 ? -51 : -54));
    gameMap.buyZones[TEAM.T] = { minX: -14, maxX: 14, minZ: 41, maxZ: 56 };
    gameMap.buyZones[TEAM.CT] = { minX: -24, maxX: 24, minZ: -57, maxZ: -48 };
}

function createNavigation(gameMap) {
    gameMap.disposeNavigationDebug();
    const graph = new WaypointGraph();
    gameMap.navigationGraph = graph;
    gameMap.navigationRejectedWaypoints = [];

    const points = [
        ["t_spawn", 0, 0, 48, "T Spawn"],
        ["long_entry", -40, 0, 48, "Long"], ["long_ramp_start", -44, 0, 22, "Long"],
        ["long_ramp_mid", -44, 2, 2, "Long"], ["long_ramp_end", -44, 4, -18, "Long"], ["a_site", -35, 4, -27, "A"],
        ["mid_descent_start", 0, 0, 43, "Mid"], ["mid_descent_mid", 0, -1, 38, "Mid"], ["mid_descent_end", 0, -2, 33, "Mid"],
        ["mid", 0, -2, 3, "Mid"], ["mid_n", 0, -2, -25, "Mid"],
        ["mid_short_start", 0, -2, -3, "Short"], ["mid_short_mid", -7, -0.5, -5.5, "Short"], ["mid_short_end", -14, 1, -8, "Short"],
        ["short_a_start", -14, 1, -12, "Short"], ["short_a_mid", -19.5, 2.5, -17.5, "Short"], ["short_a_end", -25, 4, -23, "Short"],
        ["tunnel_descent_start", 21, 0, 44, "Tunnel"], ["tunnel_descent_mid", 26.5, -1.5, 39, "Tunnel"], ["tunnel_descent_end", 32, -3, 34, "Tunnel"],
        ["tunnel_low", 32, -3, 23, "Tunnel"], ["tunnel_b_start", 32, -3, 13, "Tunnel"], ["tunnel_b_mid", 37.5, -1.5, 4.5, "Tunnel"], ["tunnel_b_end", 43, 0, -4, "Tunnel"], ["b_site", 34, 0, -24, "B"],
        ["ct_spawn", 0, 1.5, -53, "CT Spawn"],
        ["ct_a_start", -20, 1.5, -51, "CT Support"], ["ct_a_mid", -22, 2.75, -47, "CT Support"], ["ct_a_end", -24, 4, -43, "CT Support"],
        ["ct_b_start", 15, 1.5, -51, "CT Support"], ["ct_b_mid", 22, 0.75, -45, "CT Support"], ["ct_b_end", 29, 0, -39, "CT Support"],
        ["ct_mid_start", 0, 1.5, -49, "CT Mid"], ["ct_mid_mid", 0, -0.25, -40.5, "CT Mid"], ["ct_mid_end", 0, -2, -32, "CT Mid"]
    ];
    for (const [id, x, y, z, area] of points) {
        graph.addNode(id, new THREE.Vector3(x, y, z), { area });
    }

    const routes = [
        ["t_spawn", "long_entry", "long_ramp_start", "long_ramp_mid", "long_ramp_end", "a_site"],
        ["t_spawn", "mid_descent_start", "mid_descent_mid", "mid_descent_end", "mid", "mid_n", "ct_mid_end"],
        ["mid", "mid_short_start", "mid_short_mid", "mid_short_end", "short_a_start", "short_a_mid", "short_a_end", "a_site"],
        ["t_spawn", "tunnel_descent_start", "tunnel_descent_mid", "tunnel_descent_end", "tunnel_low", "tunnel_b_start", "tunnel_b_mid", "tunnel_b_end", "b_site"],
        ["ct_spawn", "ct_a_start", "ct_a_mid", "ct_a_end", "a_site"],
        ["ct_spawn", "ct_b_start", "ct_b_mid", "ct_b_end", "b_site"],
        ["ct_spawn", "ct_mid_start", "ct_mid_mid", "ct_mid_end", "mid_n"],
        ["a_site", "short_a_end"], ["b_site", "ct_b_end"]
    ];
    for (const route of routes) {
        for (let index = 1; index < route.length; index += 1) {
            graph.connect(route[index - 1], route[index]);
        }
    }

    if (gameMap.navigationDebugEnabled) {
        gameMap.rebuildNavigationDebug();
    }
    console.log(`[Sandstorm Navigation] ${graph.nodes.size} waypoints, ${graph.getEdges().length} edges`);
    return graph;
}

export default buildDeSandstorm;
