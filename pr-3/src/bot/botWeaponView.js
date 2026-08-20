/**
 * Web-CS15
 * src/bot/botWeaponView.js
 *
 * BOT Weapon Model V1
 *
 * Third-person weapon models for BOTs.
 * Geometry only; no external assets required.
 */

import * as THREE from "three";


function material(
    color,
    {
        roughness = 0.45,
        metalness = 0.25
    } = {}
) {

    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });
}


function box(
    group,
    size,
    position,
    mat,
    rotation = null
) {

    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                size[0],
                size[1],
                size[2]
            ),
            mat
        );


    mesh.position.set(
        position[0],
        position[1],
        position[2]
    );


    if (rotation) {

        mesh.rotation.set(
            rotation[0] || 0,
            rotation[1] || 0,
            rotation[2] || 0
        );
    }


    mesh.userData.ignoreHitbox =
        true;


    group.add(mesh);


    return mesh;
}


function cylinder(
    group,
    radius,
    length,
    position,
    mat,
    {
        radialSegments = 10,
        rotationX = Math.PI / 2
    } = {}
) {

    const geometry =
        new THREE.CylinderGeometry(
            radius,
            radius,
            length,
            radialSegments
        );


    geometry.rotateX(
        rotationX
    );


    const mesh =
        new THREE.Mesh(
            geometry,
            mat
        );


    mesh.position.set(
        position[0],
        position[1],
        position[2]
    );


    mesh.userData.ignoreHitbox =
        true;


    group.add(mesh);


    return mesh;
}


function createMaterials() {

    return {
        black:
            material(
                0x111315,
                {
                    roughness: 0.32,
                    metalness: 0.50
                }
            ),

        dark:
            material(
                0x25292d,
                {
                    roughness: 0.42,
                    metalness: 0.35
                }
            ),

        steel:
            material(
                0x666b70,
                {
                    roughness: 0.25,
                    metalness: 0.70
                }
            ),

        silver:
            material(
                0xaeb4ba,
                {
                    roughness: 0.22,
                    metalness: 0.78
                }
            ),

        wood:
            material(
                0x754421,
                {
                    roughness: 0.62,
                    metalness: 0.02
                }
            ),

        woodLight:
            material(
                0x9a5b2b,
                {
                    roughness: 0.60,
                    metalness: 0.02
                }
            ),

        green:
            material(
                0x455341,
                {
                    roughness: 0.58,
                    metalness: 0.12
                }
            )
    };
}


function createPistol(
    mats,
    {
        silver = false,
        suppressor = false,
        heavy = false
    } = {}
) {

    const g =
        new THREE.Group();


    const slide =
        silver
            ? mats.silver
            : mats.dark;


    box(
        g,
        heavy
            ? [0.14, 0.15, 0.44]
            : [0.11, 0.12, 0.36],
        [0, 0.02, -0.16],
        slide
    );


    box(
        g,
        [0.10, 0.25, 0.13],
        [0, -0.15, -0.02],
        mats.black,
        [0.18, 0, 0]
    );


    cylinder(
        g,
        heavy
            ? 0.045
            : 0.032,
        heavy
            ? 0.22
            : 0.16,
        [0, 0.03, -0.44],
        mats.black
    );


    if (suppressor) {

        cylinder(
            g,
            0.048,
            0.30,
            [0, 0.03, -0.66],
            mats.black
        );
    }


    return g;
}


function createAK47(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.13, 0.17, 0.55],
        [0, 0, -0.24],
        m.dark
    );


    box(
        g,
        [0.15, 0.16, 0.34],
        [0, -0.01, -0.62],
        m.woodLight
    );


    cylinder(
        g,
        0.035,
        0.62,
        [0, 0.03, -1.05],
        m.black
    );


    box(
        g,
        [0.12, 0.16, 0.42],
        [0, -0.01, 0.24],
        m.wood
    );


    box(
        g,
        [0.11, 0.34, 0.14],
        [0, -0.24, -0.28],
        m.dark,
        [-0.28, 0, 0]
    );


    return g;
}


function createM4A1(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.14, 0.17, 0.58],
        [0, 0, -0.25],
        m.dark
    );


    box(
        g,
        [0.16, 0.15, 0.28],
        [0, -0.01, 0.25],
        m.black
    );


    cylinder(
        g,
        0.032,
        0.68,
        [0, 0.03, -1.00],
        m.black
    );


    box(
        g,
        [0.10, 0.30, 0.13],
        [0, -0.23, -0.28],
        m.dark
    );


    box(
        g,
        [0.05, 0.06, 0.28],
        [0, 0.15, -0.24],
        m.black
    );


    return g;
}


function createMP5(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.14, 0.17, 0.48],
        [0, 0, -0.20],
        m.dark
    );


    cylinder(
        g,
        0.032,
        0.30,
        [0, 0.02, -0.59],
        m.black
    );


    box(
        g,
        [0.09, 0.34, 0.11],
        [0, -0.24, -0.20],
        m.black,
        [-0.08, 0, 0]
    );


    box(
        g,
        [0.10, 0.12, 0.28],
        [0, 0, 0.20],
        m.black
    );


    return g;
}


function addScope(
    g,
    m,
    {
        radius = 0.075,
        length = 0.36,
        z = -0.28
    } = {}
) {

    cylinder(
        g,
        radius,
        length,
        [0, 0.17, z],
        m.black
    );


    cylinder(
        g,
        radius * 1.18,
        0.055,
        [0, 0.17, z - length * 0.46],
        m.dark
    );


    cylinder(
        g,
        radius * 1.12,
        0.055,
        [0, 0.17, z + length * 0.46],
        m.dark
    );
}


function createAWP(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.17, 0.19, 0.68],
        [0, 0, -0.25],
        m.green
    );


    box(
        g,
        [0.18, 0.20, 0.38],
        [0, -0.01, 0.29],
        m.green
    );


    cylinder(
        g,
        0.040,
        0.88,
        [0, 0.03, -1.03],
        m.black
    );


    box(
        g,
        [0.12, 0.26, 0.14],
        [0, -0.21, -0.20],
        m.black
    );


    addScope(
        g,
        m,
        {
            radius: 0.082,
            length: 0.42,
            z: -0.28
        }
    );


    return g;
}


function createScout(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.12, 0.14, 0.58],
        [0, 0, -0.23],
        m.dark
    );


    box(
        g,
        [0.12, 0.14, 0.32],
        [0, -0.01, 0.25],
        m.dark
    );


    cylinder(
        g,
        0.026,
        0.78,
        [0, 0.02, -0.91],
        m.black
    );


    box(
        g,
        [0.09, 0.20, 0.11],
        [0, -0.17, -0.19],
        m.black
    );


    addScope(
        g,
        m,
        {
            radius: 0.055,
            length: 0.31,
            z: -0.25
        }
    );


    return g;
}


function createKnife(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.08, 0.09, 0.24],
        [0, -0.03, -0.02],
        m.black
    );


    const blade =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.045,
                0.025,
                0.42
            ),
            m.silver
        );


    blade.position.set(
        0,
        0,
        -0.34
    );


    blade.rotation.y =
        -0.05;


    blade.userData.ignoreHitbox =
        true;


    g.add(blade);


    return g;
}


function createGeneric(m) {

    const g =
        new THREE.Group();


    box(
        g,
        [0.11, 0.14, 0.62],
        [0, 0, -0.28],
        m.dark
    );


    cylinder(
        g,
        0.03,
        0.40,
        [0, 0.02, -0.76],
        m.black
    );


    return g;
}


export function createBotWeaponModel(
    weaponId
) {

    const m =
        createMaterials();


    let model = null;


    switch (weaponId) {

        case "glock":
            model =
                createPistol(m);
            break;

        case "usp":
            model =
                createPistol(
                    m,
                    {
                        suppressor: true
                    }
                );
            break;

        case "deagle":
            model =
                createPistol(
                    m,
                    {
                        silver: true,
                        heavy: true
                    }
                );
            break;

        case "ak47":
            model =
                createAK47(m);
            break;

        case "m4a1":
            model =
                createM4A1(m);
            break;

        case "mp5":
            model =
                createMP5(m);
            break;

        case "awp":
            model =
                createAWP(m);
            break;

        case "scout":
            model =
                createScout(m);
            break;

        case "knife":
            model =
                createKnife(m);
            break;

        default:
            model =
                createGeneric(m);
            break;
    }


    model.name =
        `BOT_WEAPON_${weaponId}`;


    model.userData.weaponId =
        weaponId;


    model.traverse(
        object => {

            object.userData.ignoreHitbox =
                true;


            if (object.isMesh) {

                object.castShadow =
                    true;

                object.receiveShadow =
                    true;
            }
        }
    );


    return model;
}


export function disposeBotWeaponModel(
    model
) {

    if (!model) {
        return;
    }


    model.traverse(
        object => {

            if (!object.isMesh) {
                return;
            }


            object.geometry
                ?.dispose?.();


            if (
                Array.isArray(
                    object.material
                )
            ) {

                object.material.forEach(
                    item =>
                        item?.dispose?.()
                );

            } else {

                object.material
                    ?.dispose?.();
            }
        }
    );
}