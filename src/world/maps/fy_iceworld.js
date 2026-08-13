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


    createIceFloorDetails.call(
        this
    );


    createMountainBackdrop.call(
        this
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


    createOuterWallCaps.call(
        this,
        halfW,
        halfD,
        wallHeight,
        thickness
    );


    createOuterWallDetails.call(
        this,
        halfW,
        halfD,
        wallHeight
    );



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


    createCoverSnowCap.call(
        this,
        0,
        3.69,
        0,
        8,
        8
    );


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


    createCoverSnowCap.call(
        this,
        -15,
        2.89,
        0,
        6,
        16
    );


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


    createCoverSnowCap.call(
        this,
        15,
        2.89,
        0,
        6,
        16
    );


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


    createCoverSnowCap.call(
        this,
        0,
        2.89,
        -16,
        18,
        5
    );


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


    createCoverSnowCap.call(
        this,
        0,
        2.89,
        16,
        18,
        5
    );



    createSnowSurfaceDetails.call(
        this
    );


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


        createCrateVisualDetails.call(
            this,
            x,
            y,
            z
        );
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
// Iceworld Visual Upgrade V1
//
// Decoration-only geometry.
// 不加入 collision / weaponTargets / AI collision。
// ============================================================

function addDecoration(
    gameMap,
    mesh
) {

    mesh.userData.decoration =
        true;

    mesh.userData.ignoreHitbox =
        true;


    mesh.castShadow =
        false;

    mesh.receiveShadow =
        true;


    gameMap.group.add(
        mesh
    );


    return mesh;
}


function createIceFloorDetails() {

    const size =
        MAP_CONFIG.size;


    /*
     * 大面积极浅色冰层，
     * 用几块半透明平面制造冰雪层次，
     * 避免地面像纯白纸。
     */
    const patches = [
        [-31, -27, 12, 8, -0.18],
        [-18, -19, 9, 6, 0.14],
        [18, -31, 14, 7, 0.22],
        [31, -20, 10, 6, -0.12],
        [-10, -3, 13, 8, -0.08],
        [8, 6, 9, 6, 0.19],
        [28, 17, 12, 7, -0.16],
        [-29, 28, 11, 7, 0.12],
        [-12, 35, 8, 5, -0.20],
        [11, 31, 14, 6, 0.09],
        [34, 34, 9, 5, -0.11]
    ];


    for (
        const [
            x,
            z,
            width,
            depth,
            rotation
        ]
        of patches
    ) {

        const mesh =
            new THREE.Mesh(
                new THREE.CircleGeometry(
                    width * 0.5,
                    8
                ),
                this.materials.iceAccent
            );


        mesh.rotation.x =
            -Math.PI / 2;


        mesh.rotation.z =
            rotation;


        mesh.position.set(
            x,
            0.009,
            z
        );


        mesh.scale.z =
            depth /
            width *
            2;


        addDecoration(
            this,
            mesh
        );
    }


    /*
     * 几条很淡的冰面裂纹线。
     */
    const crackMaterial =
        new THREE.LineBasicMaterial({
            color:
                0xb7dbe9,

            transparent:
                true,

            opacity:
                0.36
        });


    const cracks = [
        [[-38, -19], [-25, -14], [-14, -17], [-4, -11]],
        [[16, 7], [23, 13], [31, 10], [40, 15]],
        [[-33, 24], [-20, 28], [-13, 23], [-2, 31]]
    ];


    for (
        const crack
        of cracks
    ) {

        const geometry =
            new THREE.BufferGeometry()
                .setFromPoints(
                    crack.map(
                        ([x, z]) =>
                            new THREE.Vector3(
                                x,
                                0.018,
                                z
                            )
                    )
                );


        const line =
            new THREE.Line(
                geometry,
                crackMaterial
            );


        line.userData.decoration =
            true;

        line.userData.ignoreHitbox =
            true;


        this.group.add(
            line
        );
    }
}


function createOuterWallCaps(
    halfW,
    halfD,
    wallHeight,
    thickness
) {

    const capHeight =
        0.34;


    const northSouthSize =
        new THREE.Vector3(
            MAP_CONFIG.size.width,
            capHeight,
            Math.max(
                0.34,
                thickness * 0.82
            )
        );


    const eastWestSize =
        new THREE.Vector3(
            Math.max(
                0.34,
                thickness * 0.82
            ),
            capHeight,
            MAP_CONFIG.size.depth
        );


    const capY =
        wallHeight +
        capHeight / 2 -
        0.06;


    const caps = [
        [
            new THREE.Vector3(
                0,
                capY,
                -halfD
            ),
            northSouthSize
        ],
        [
            new THREE.Vector3(
                0,
                capY,
                halfD
            ),
            northSouthSize
        ],
        [
            new THREE.Vector3(
                -halfW,
                capY,
                0
            ),
            eastWestSize
        ],
        [
            new THREE.Vector3(
                halfW,
                capY,
                0
            ),
            eastWestSize
        ]
    ];


    for (
        const [
            position,
            size
        ]
        of caps
    ) {

        const cap =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    size.x,
                    size.y,
                    size.z
                ),
                this.materials.wallCap
            );


        cap.position.copy(
            position
        );


        addDecoration(
            this,
            cap
        );
    }
}


function createCrateVisualDetails(
    x,
    y,
    z
) {

    const trim =
        this.materials.crateTrim;


    const plankThickness =
        0.10;


    const crateWidth =
        3.2;

    const crateHeight =
        2.0;


    /*
     * 四条深色边框，让木箱不再是一个纯色方块。
     */
    const verticalOffsets = [
        -1.48,
        1.48
    ];


    for (
        const xOffset
        of verticalOffsets
    ) {

        for (
            const zOffset
            of verticalOffsets
        ) {

            const post =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        plankThickness,
                        crateHeight +
                            0.08,
                        plankThickness
                    ),
                    trim
                );


            post.position.set(
                x +
                    xOffset,
                y,
                z +
                    zOffset
            );


            addDecoration(
                this,
                post
            );
        }
    }


    /*
     * 上下横条。
     */
    const railY = [
        y - 0.76,
        y + 0.76
    ];


    for (
        const yy
        of railY
    ) {

        const front =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    crateWidth +
                        0.06,
                    0.12,
                    0.12
                ),
                trim
            );


        front.position.set(
            x,
            yy,
            z - 1.56
        );


        addDecoration(
            this,
            front
        );


        const back =
            front.clone();


        back.position.z =
            z + 1.56;


        addDecoration(
            this,
            back
        );
    }


    /*
     * 金属角块。
     */
    const metal =
        this.materials.metalAccent;


    const cornerOffsets = [
        [-1.48, -1.48],
        [1.48, -1.48],
        [-1.48, 1.48],
        [1.48, 1.48]
    ];


    for (
        const [
            xx,
            zz
        ]
        of cornerOffsets
    ) {

        const corner =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.18,
                    0.18,
                    0.18
                ),
                metal
            );


        corner.position.set(
            x + xx,
            y + 0.91,
            z + zz
        );


        addDecoration(
            this,
            corner
        );
    }
}



// ============================================================
// Iceworld Visual Upgrade V2
// ============================================================

function createCoverSnowCap(x, y, z, width, depth) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.18, 0.18, depth + 0.18),
        this.materials.snow
    );
    mesh.position.set(x, y, z);
    addDecoration(this, mesh);
}


function createOuterWallDetails(halfW, halfD, wallHeight) {
    const snow = this.materials.snow;
    const detail = this.materials.wallDetail;

    const ledges = [
        [0, wallHeight - 0.18, -halfD + 0.44, MAP_CONFIG.size.width, 0.20, 0.72],
        [0, wallHeight - 0.18,  halfD - 0.44, MAP_CONFIG.size.width, 0.20, 0.72],
        [-halfW + 0.44, wallHeight - 0.18, 0, 0.72, 0.20, MAP_CONFIG.size.depth],
        [ halfW - 0.44, wallHeight - 0.18, 0, 0.72, 0.20, MAP_CONFIG.size.depth]
    ];

    for (const [x,y,z,sx,sy,sz] of ledges) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), snow);
        m.position.set(x,y,z);
        addDecoration(this,m);
    }

    for (let x=-42; x<=42; x+=12) {
        for (const z of [-halfD+0.46, halfD-0.46]) {
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(0.42, wallHeight-0.5, 0.18),
                detail
            );
            m.position.set(x,(wallHeight-0.5)/2,z);
            addDecoration(this,m);
        }
    }

    for (let z=-36; z<=36; z+=12) {
        for (const x of [-halfW+0.46, halfW-0.46]) {
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, wallHeight-0.5, 0.42),
                detail
            );
            m.position.set(x,(wallHeight-0.5)/2,z);
            addDecoration(this,m);
        }
    }
}


function createMountainBackdrop() {

    /*
     * V2.3 Final Environment Tune
     * 山脉推远、降低、变淡；减少连续白色雪边。
     */

    const rock =
        this.materials.mountainRock;

    const snow =
        this.materials.mountainSnow;


    const DISTANCE_SCALE =
        1.38;

    const HEIGHT_SCALE =
        0.72;


    const ridgeSets = [
        {
            axis: "x", fixed: -103, baseY: 3.2, depth: 15,
            points: [
                [-82,13],[-70,20],[-59,15],[-48,25],[-35,17],[-23,22],
                [-11,14],[2,28],[15,18],[28,24],[41,16],[54,27],[68,18],[82,22]
            ]
        },
        {
            axis: "x", fixed: 103, baseY: 3.0, depth: 15,
            points: [
                [-82,18],[-69,25],[-56,16],[-44,22],[-31,15],[-18,28],
                [-5,19],[8,24],[22,15],[36,26],[49,18],[63,23],[75,16],[84,20]
            ]
        },
        {
            axis: "z", fixed: -104, baseY: 2.9, depth: 14,
            points: [
                [-72,15],[-60,23],[-48,17],[-36,27],[-24,16],[-12,22],
                [0,14],[13,26],[27,18],[40,24],[54,16],[68,21]
            ]
        },
        {
            axis: "z", fixed: 104, baseY: 3.1, depth: 14,
            points: [
                [-72,19],[-59,26],[-46,16],[-34,23],[-21,17],[-8,29],
                [5,18],[18,25],[32,15],[45,22],[58,17],[70,24]
            ]
        }
    ];


    for (const sourceRidge of ridgeSets) {

        const ridge = {
            ...sourceRidge,
            fixed:
                sourceRidge.fixed *
                DISTANCE_SCALE,
            points:
                sourceRidge.points.map(
                    ([position, height]) => [
                        position,
                        height * HEIGHT_SCALE
                    ]
                )
        };


        const mountain =
            createMountainRidgeMesh(
                ridge,
                rock,
                0.86
            );

        addDecoration(
            this,
            mountain
        );


        /*
         * 更远的第二层，仅用于纵深。
         */
        const farRidge = {
            ...ridge,
            fixed:
                ridge.fixed *
                1.18,
            baseY:
                ridge.baseY +
                1.0,
            depth:
                ridge.depth *
                1.12,
            points:
                ridge.points.map(
                    ([position, height], index) => [
                        position +
                            (
                                index % 2 === 0
                                    ? -4
                                    : 4
                            ),
                        height * 0.80
                    ]
                )
        };


        const farMountain =
            createMountainRidgeMesh(
                farRidge,
                rock,
                0.46
            );

        addDecoration(
            this,
            farMountain
        );


        /*
         * 只在高峰形成明显雪顶。
         */
        const maxHeight =
            Math.max(
                ...ridge.points.map(
                    point => point[1]
                )
            );


        const snowMesh =
            createSelectiveSnowRidgeMesh(
                {
                    ...ridge,
                    snowTopPoints:
                        ridge.points.map(
                            ([position, height]) => {
                                const ratio =
                                    height /
                                    maxHeight;

                                return [
                                    position,
                                    height,
                                    ratio >= 0.82
                                        ? height * 0.25
                                        : ratio >= 0.72
                                            ? height * 0.08
                                            : 0.10
                                ];
                            }
                        )
                },
                snow
            );


        addDecoration(
            this,
            snowMesh
        );
    }
}


function createSelectiveSnowRidgeMesh(
    ridge,
    material
) {

    const vertices = [];
    const indices = [];
    const points =
        ridge.snowTopPoints;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const [
            along,
            fullHeight,
            snowDepth
        ] = points[i];


        const topY =
            ridge.baseY +
            fullHeight;

        const bottomY =
            topY -
            snowDepth;

        const halfDepth =
            ridge.depth / 2;


        if (ridge.axis === "x") {

            vertices.push(
                along, bottomY, ridge.fixed - halfDepth * 0.30,
                along, topY,    ridge.fixed,
                along, topY - snowDepth * 0.12, ridge.fixed + halfDepth * 0.30
            );
        }
        else {

            vertices.push(
                ridge.fixed - halfDepth * 0.30, bottomY, along,
                ridge.fixed, topY, along,
                ridge.fixed + halfDepth * 0.30, topY - snowDepth * 0.12, along
            );
        }
    }


    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {

        const a = i * 3;
        const b = (i + 1) * 3;

        indices.push(
            a, b, a + 1,
            a + 1, b, b + 1,
            a + 1, b + 1, a + 2,
            a + 2, b + 1, b + 2
        );
    }


    const geometry =
        new THREE.BufferGeometry();


    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );

    geometry.setIndex(
        indices
    );

    geometry.computeVertexNormals();


    return new THREE.Mesh(
        geometry,
        material
    );
}


function createMountainRidgeMesh(
    ridge,
    material,
    opacityScale = 1
) {

    const vertices = [];

    const indices = [];


    const points =
        ridge.points;


    /*
     * 每个山脊点生成：
     * front base
     * front top
     * back top
     * back base
     *
     * 再连接成连续低多边形带。
     */
    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const [
            along,
            height
        ] =
            points[i];


        const halfDepth =
            ridge.depth /
            2;


        if (
            ridge.axis ===
            "x"
        ) {

            vertices.push(
                along,
                ridge.baseY,
                ridge.fixed -
                    halfDepth,

                along,
                ridge.baseY +
                    height,
                ridge.fixed,

                along,
                ridge.baseY +
                    height *
                    0.88,
                ridge.fixed +
                    halfDepth,

                along,
                ridge.baseY,
                ridge.fixed +
                    halfDepth
            );
        }
        else {

            vertices.push(
                ridge.fixed -
                    halfDepth,
                ridge.baseY,
                along,

                ridge.fixed,
                ridge.baseY +
                    height,
                along,

                ridge.fixed +
                    halfDepth,
                ridge.baseY +
                    height *
                    0.88,
                along,

                ridge.fixed +
                    halfDepth,
                ridge.baseY,
                along
            );
        }
    }


    for (
        let i = 0;
        i <
        points.length - 1;
        i++
    ) {

        const a =
            i * 4;

        const b =
            (
                i + 1
            ) *
            4;


        indices.push(
            a,
            b,
            a + 1,

            a + 1,
            b,
            b + 1,

            a + 1,
            b + 1,
            a + 2,

            a + 2,
            b + 1,
            b + 2,

            a + 2,
            b + 2,
            a + 3,

            a + 3,
            b + 2,
            b + 3
        );
    }


    const geometry =
        new THREE.BufferGeometry();


    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );


    geometry.setIndex(
        indices
    );


    geometry.computeVertexNormals();


    let ridgeMaterial =
        material;


    if (
        opacityScale <
        1
    ) {

        ridgeMaterial =
            material.clone();


        ridgeMaterial.transparent =
            true;

        ridgeMaterial.opacity =
            opacityScale;

        ridgeMaterial.depthWrite =
            true;
    }


    const mesh =
        new THREE.Mesh(
            geometry,
            ridgeMaterial
        );


    mesh.userData
        .mountainOwnedMaterial =
        ridgeMaterial !==
        material;


    return mesh;
}


function createSnowRidgeMesh(
    ridge,
    material
) {

    const vertices = [];

    const indices = [];


    const points =
        ridge.snowTopPoints;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const [
            along,
            fullHeight
        ] =
            points[i];


        const topY =
            ridge.baseY +
            fullHeight;


        const snowDepth =
            Math.max(
                4.5,
                fullHeight *
                0.34
            );


        const bottomY =
            topY -
            snowDepth;


        const halfDepth =
            ridge.depth /
            2;


        if (
            ridge.axis ===
            "x"
        ) {

            vertices.push(
                along,
                bottomY,
                ridge.fixed -
                    halfDepth *
                    0.38,

                along,
                topY,
                ridge.fixed,

                along,
                topY -
                    snowDepth *
                    0.16,
                ridge.fixed +
                    halfDepth *
                    0.38
            );
        }
        else {

            vertices.push(
                ridge.fixed -
                    halfDepth *
                    0.38,
                bottomY,
                along,

                ridge.fixed,
                topY,
                along,

                ridge.fixed +
                    halfDepth *
                    0.38,
                topY -
                    snowDepth *
                    0.16,
                along
            );
        }
    }


    for (
        let i = 0;
        i <
        points.length - 1;
        i++
    ) {

        const a =
            i * 3;

        const b =
            (
                i + 1
            ) *
            3;


        indices.push(
            a,
            b,
            a + 1,

            a + 1,
            b,
            b + 1,

            a + 1,
            b + 1,
            a + 2,

            a + 2,
            b + 1,
            b + 2
        );
    }


    const geometry =
        new THREE.BufferGeometry();


    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );


    geometry.setIndex(
        indices
    );


    geometry.computeVertexNormals();


    return new THREE.Mesh(
        geometry,
        material
    );
}



// ============================================================
// Iceworld Rendering V3 - Map Structure Detail
// ============================================================

function createSnowSurfaceDetails() {

    const material =
        this.materials.snowScuff;


    /*
     * Sparse snow scuffs / worn patches.
     * Kept intentionally subtle and away from gameplay semantics.
     */
    const marks = [
        [-36, -20, 5.8, 1.6,  0.16],
        [-27, -10, 4.2, 1.2, -0.10],
        [-35,  15, 6.5, 1.5,  0.08],
        [-19,  25, 4.8, 1.1, -0.18],

        [ 34, -24, 5.6, 1.4, -0.12],
        [ 27, -12, 4.0, 1.0,  0.18],
        [ 36,  13, 6.0, 1.5, -0.08],
        [ 22,  27, 4.6, 1.1,  0.12],

        [-7, -31, 4.2, 0.9,  0.04],
        [ 8,  31, 4.4, 1.0, -0.06]
    ];


    for (const [x,z,length,width,rotation] of marks) {

        const mesh =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    length,
                    width
                ),
                material
            );

        mesh.rotation.x =
            -Math.PI / 2;

        mesh.rotation.z =
            rotation;

        mesh.position.set(
            x,
            0.014,
            z
        );

        addDecoration(
            this,
            mesh
        );
    }
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