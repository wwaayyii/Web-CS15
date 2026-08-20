/**
 * Web-CS15 - de_sandstorm Gameplay Blockout V1
 *
 * An original, compact demolition layout built around an exterior long lane,
 * a dry central canal, an elevated short connector, and a maintenance tunnel.
 */

import * as THREE from "three";

import { TEAM } from "../../core/config.js";
import { WaypointGraph } from "../../bot/navigation.js";

export const MAP_ID = "de_sandstorm";
export const MAP_VERSION = "de_sandstorm_blockout_v1";

export function buildDeSandstorm(gameMap) {
    if (!gameMap) {
        throw new Error("[de_sandstorm] gameMap is required.");
    }

    gameMap.createMaterials();
    createTheme(gameMap);
    createGeometry(gameMap);
    createSpawnsAndZones(gameMap);
    createNavigation(gameMap);

    gameMap.group.userData.mapName = MAP_ID;
    gameMap.group.userData.mapVersion = MAP_VERSION;
    gameMap.group.userData.bombSites = {
        A: new THREE.Vector3(-35, 0, -27),
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

function createGeometry(gameMap) {
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(120, 0.4, 120),
        gameMap.materials.floor
    );
    floor.position.y = -0.2;
    gameMap.addMapObject(floor, "floor", {
        collision: true,
        weaponTarget: true,
        grenadeCollision: true,
        aiCollision: false
    });

    // Perimeter keeps players, dropped weapons, and grenades inside the map.
    const walls = [
        [0, 4, -60, 120, 8, 4], [0, 4, 60, 120, 8, 4],
        [-60, 4, 0, 4, 8, 120], [60, 4, 0, 4, 8, 120],

        // West industrial shell creates Long without copying Dust2 geometry.
        [-31, 3, 22, 3, 6, 48], [-31, 3, -43, 3, 6, 18],
        [-51, 3, 2, 3, 6, 72],
        [-41, 3, -38, 20, 6, 3],

        // Dry canal walls define Mid and leave deliberate cross-over gates.
        [-9, 2.4, 25, 3, 4.8, 34], [-9, 2.4, -21, 3, 4.8, 22],
        [9, 2.4, 29, 3, 4.8, 26], [9, 2.4, -15, 3, 4.8, 30],

        // Radar compound / A site, with Long and Short entrances.
        [-40, 3, -48, 20, 6, 3], [-14, 3, -48, 8, 6, 3],
        [-18, 3, -32, 3, 6, 20],

        // Underground warehouse / B site and its CT-side support lane.
        [16, 3, -42, 16, 6, 3], [39, 3, -42, 14, 6, 3],
        [48, 3, -25, 3, 6, 34],
        [30, 3, -8, 18, 6, 3],

        // Maintenance Tunnel: two offset walls, open at both ends.
        [22, 2.5, 24, 3, 5, 32], [43, 2.5, 29, 3, 5, 34]
    ];

    for (const [x, y, z, sx, sy, sz] of walls) {
        gameMap.createWall({
            position: new THREE.Vector3(x, y, z),
            size: new THREE.Vector3(sx, sy, sz)
        });
    }

    const covers = [
        [-39, 1.25, 18, 4, 2.5, 7], [-39, 1.25, -27, 6, 2.5, 3],
        [-29, 1.25, -25, 3, 2.5, 5], [-2, 1.1, 7, 5, 2.2, 3],
        [2, 1.1, -21, 4, 2.2, 3], [31, 1.3, -24, 5, 2.6, 4],
        [39, 1.3, -18, 3, 2.6, 6], [33, 1.1, 31, 4, 2.2, 4]
    ];

    for (const [x, y, z, sx, sy, sz] of covers) {
        gameMap.createCover({
            position: new THREE.Vector3(x, y, z),
            size: new THREE.Vector3(sx, sy, sz)
        });
    }

    addSiteMarker(gameMap, "A", -35, -27, 0xd18b2d);
    addSiteMarker(gameMap, "B", 34, -24, 0xd18b2d);
}

function addSiteMarker(gameMap, name, x, z, color) {
    const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.012, z);
    marker.name = `BOMB_SITE_${name}`;
    marker.userData.bombSite = name;
    gameMap.group.add(marker);
}

function createSpawnsAndZones(gameMap) {
    gameMap.spawnPoints[TEAM.T] = [
        new THREE.Vector3(-8, 0, 49), new THREE.Vector3(-4, 0, 45),
        new THREE.Vector3(0, 0, 49), new THREE.Vector3(4, 0, 45),
        new THREE.Vector3(8, 0, 49)
    ];
    gameMap.spawnPoints[TEAM.CT] = [
        new THREE.Vector3(-8, 0, -53), new THREE.Vector3(-4, 0, -50),
        new THREE.Vector3(0, 0, -53), new THREE.Vector3(4, 0, -50),
        new THREE.Vector3(8, 0, -53)
    ];
    gameMap.buyZones[TEAM.T] = { minX: -14, maxX: 14, minZ: 41, maxZ: 56 };
    gameMap.buyZones[TEAM.CT] = { minX: -14, maxX: 14, minZ: -57, maxZ: -46 };
}

function createNavigation(gameMap) {
    gameMap.disposeNavigationDebug();
    const graph = new WaypointGraph();
    gameMap.navigationGraph = graph;
    gameMap.navigationRejectedWaypoints = [];

    const points = [
        ["t_spawn", 0, 48, "T Spawn"], ["t_long", -22, 50, "Long"],
        ["long_1", -40, 50, "Long"], ["long_2", -44, 18, "Long"],
        ["long_a", -44, -12, "Long"], ["a_site", -35, -27, "A"],
        ["t_mid", 0, 38, "Mid"], ["mid_s", 0, 22, "Mid"],
        ["mid", 0, 3, "Mid"], ["mid_n", 0, -14, "Mid"],
        ["ct_mid", 0, -32, "CT Mid"], ["short_1", -14, -8, "Short"],
        ["short_2", -23, -17, "Short"], ["short_a", -25, -28, "Short"],
        ["t_tunnel", 17, 43, "Tunnel"], ["tunnel_s", 32, 43, "Tunnel"],
        ["tunnel", 32, 27, "Tunnel"], ["tunnel_b", 32, 5, "Tunnel"],
        ["b_entry", 43, -4, "B"], ["b_site", 34, -24, "B"],
        ["ct_b", 28, -48, "CT Support"], ["ct_spawn", 0, -51, "CT Spawn"],
        ["ct_a", -24, -52, "CT Support"], ["a_gate", -24, -43, "CT Support"]
    ];

    for (const [id, x, z, area] of points) {
        const position = new THREE.Vector3(x, 0, z);
        if (gameMap.isWalkable(position, 0.65)) {
            graph.addNode(id, position, { area });
        } else {
            gameMap.navigationRejectedWaypoints.push({ id, position });
        }
    }

    const routes = [
        ["t_spawn", "t_long", "long_1", "long_2", "long_a", "a_site"],
        ["t_spawn", "t_mid", "mid_s", "mid", "mid_n", "ct_mid", "ct_spawn"],
        ["mid", "short_1", "short_2", "short_a", "a_site"],
        ["t_spawn", "t_tunnel", "tunnel_s", "tunnel", "tunnel_b", "b_entry", "b_site"],
        ["ct_spawn", "ct_a", "a_gate", "short_a", "a_site"],
        ["ct_spawn", "ct_b", "b_site"],
        ["ct_mid", "ct_a"], ["b_site", "ct_b"]
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
