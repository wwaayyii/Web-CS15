/**
 * Web-CS15
 * src/weapons/worldWeaponView.js
 *
 * Dropped Weapon & Pickup System V1
 * Reuses the BOT third-person weapon geometry for world drops.
 */

import * as THREE from "three";

import {
    createBotWeaponModel,
    disposeBotWeaponModel
} from "../bot/botWeaponView.js";


export function createWorldWeaponModel(
    weaponId
) {

    const root =
        new THREE.Group();


    root.name =
        `WORLD_WEAPON_${weaponId}`;


    const model =
        createBotWeaponModel(
            weaponId
        );


    /*
     * botWeaponView 的枪默认沿 -Z。
     * 地面武器侧躺，并稍微抬高避免 Z-fighting。
     */
    model.rotation.z =
        Math.PI / 2;


    model.rotation.y =
        Math.PI * 0.08;


    root.add(
        model
    );


    root.userData.weaponId =
        weaponId;


    root.userData.isDroppedWeapon =
        true;


    root.traverse(
        object => {

            object.userData.ignoreHitbox =
                true;

            object.userData.isDroppedWeapon =
                true;
        }
    );


    return root;
}


export function disposeWorldWeaponModel(
    root
) {

    if (!root) {
        return;
    }


    const child =
        root.children?.[0] ||
        null;


    if (child) {

        root.remove(
            child
        );


        disposeBotWeaponModel(
            child
        );
    }
}