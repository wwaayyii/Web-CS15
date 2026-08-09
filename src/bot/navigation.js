/**
 * Web-CS15
 * src/bot/navigation.js
 *
 * Waypoint Graph + A* Path Finding
 *
 * 职责：
 * - Waypoint 节点
 * - 节点连接
 * - A* 最短路径
 * - 路径重建
 *
 * 不负责：
 * - BOT 实际移动
 * - 局部避障
 * - Debug UI
 */

import * as THREE from "three";


// ============================================================
// WaypointGraph
// ============================================================

export class WaypointGraph {

    constructor() {

        this.nodes =
            new Map();
    }


    // ========================================================
    // Node
    // ========================================================

    addNode(
        id,
        position,
        data = {}
    ) {

        if (
            !id ||
            !position
        ) {

            return null;
        }


        const node = {
            id:
                String(id),

            position:
                position.clone(),

            neighbors:
                new Map(),

            data: {
                ...data
            }
        };


        this.nodes.set(
            node.id,
            node
        );


        return node;
    }


    removeNode(id) {

        id =
            String(id);


        if (
            !this.nodes.has(
                id
            )
        ) {

            return false;
        }


        this.nodes.delete(
            id
        );


        for (
            const node
            of this.nodes.values()
        ) {

            node.neighbors.delete(
                id
            );
        }


        return true;
    }


    getNode(id) {

        return this.nodes.get(
            String(id)
        ) || null;
    }


    getNodes() {

        return [
            ...this.nodes.values()
        ];
    }


    // ========================================================
    // Connections
    // ========================================================

    connect(
        aId,
        bId,
        cost = null
    ) {

        const a =
            this.getNode(
                aId
            );


        const b =
            this.getNode(
                bId
            );


        if (
            !a ||
            !b ||
            a === b
        ) {

            return false;
        }


        const edgeCost =
            Number.isFinite(
                cost
            )
                ? Math.max(
                    0.001,
                    cost
                )
                : a.position
                    .distanceTo(
                        b.position
                    );


        a.neighbors.set(
            b.id,
            edgeCost
        );


        b.neighbors.set(
            a.id,
            edgeCost
        );


        return true;
    }


    disconnect(
        aId,
        bId
    ) {

        const a =
            this.getNode(
                aId
            );


        const b =
            this.getNode(
                bId
            );


        if (!a || !b) {
            return false;
        }


        a.neighbors.delete(
            b.id
        );


        b.neighbors.delete(
            a.id
        );


        return true;
    }


    getEdges() {

        const edges = [];

        const seen =
            new Set();


        for (
            const node
            of this.nodes.values()
        ) {

            for (
                const [
                    neighborId,
                    cost
                ]
                of node.neighbors
            ) {

                const key =
                    [
                        node.id,
                        neighborId
                    ]
                    .sort()
                    .join(
                        "::"
                    );


                if (
                    seen.has(
                        key
                    )
                ) {

                    continue;
                }


                seen.add(
                    key
                );


                const neighbor =
                    this.getNode(
                        neighborId
                    );


                if (!neighbor) {
                    continue;
                }


                edges.push({
                    a:
                        node,

                    b:
                        neighbor,

                    cost
                });
            }
        }


        return edges;
    }


    // ========================================================
    // Nearest
    // ========================================================

    findNearestNode(
        position,
        {
            filter = null
        } = {}
    ) {

        if (!position) {
            return null;
        }


        let best =
            null;


        let bestDistance =
            Infinity;


        for (
            const node
            of this.nodes.values()
        ) {

            if (
                filter &&
                !filter(
                    node
                )
            ) {

                continue;
            }


            const distance =
                node.position
                    .distanceToSquared(
                        position
                    );


            if (
                distance <
                bestDistance
            ) {

                bestDistance =
                    distance;


                best =
                    node;
            }
        }


        return best;
    }


    // ========================================================
    // A*
    // ========================================================

    findPathByNodeIds(
        startId,
        goalId
    ) {

        const start =
            this.getNode(
                startId
            );


        const goal =
            this.getNode(
                goalId
            );


        if (
            !start ||
            !goal
        ) {

            return [];
        }


        if (
            start.id ===
            goal.id
        ) {

            return [
                start.position.clone()
            ];
        }


        const open =
            new Set([
                start.id
            ]);


        const cameFrom =
            new Map();


        const gScore =
            new Map();


        const fScore =
            new Map();


        for (
            const node
            of this.nodes.values()
        ) {

            gScore.set(
                node.id,
                Infinity
            );


            fScore.set(
                node.id,
                Infinity
            );
        }


        gScore.set(
            start.id,
            0
        );


        fScore.set(
            start.id,
            this._heuristic(
                start,
                goal
            )
        );


        while (
            open.size >
            0
        ) {

            let currentId =
                null;


            let currentF =
                Infinity;


            for (
                const id
                of open
            ) {

                const score =
                    fScore.get(
                        id
                    ) ??
                    Infinity;


                if (
                    score <
                    currentF
                ) {

                    currentF =
                        score;


                    currentId =
                        id;
                }
            }


            if (
                currentId ==
                null
            ) {

                break;
            }


            if (
                currentId ===
                goal.id
            ) {

                return this._reconstructPath(
                    cameFrom,
                    currentId
                );
            }


            open.delete(
                currentId
            );


            const current =
                this.getNode(
                    currentId
                );


            if (!current) {
                continue;
            }


            for (
                const [
                    neighborId,
                    edgeCost
                ]
                of current.neighbors
            ) {

                const neighbor =
                    this.getNode(
                        neighborId
                    );


                if (!neighbor) {
                    continue;
                }


                const tentative =
                    (
                        gScore.get(
                            currentId
                        ) ??
                        Infinity
                    ) +
                    edgeCost;


                if (
                    tentative >=
                    (
                        gScore.get(
                            neighborId
                        ) ??
                        Infinity
                    )
                ) {

                    continue;
                }


                cameFrom.set(
                    neighborId,
                    currentId
                );


                gScore.set(
                    neighborId,
                    tentative
                );


                fScore.set(
                    neighborId,
                    tentative +
                    this._heuristic(
                        neighbor,
                        goal
                    )
                );


                open.add(
                    neighborId
                );
            }
        }


        return [];
    }


    findPath(
        startPosition,
        goalPosition
    ) {

        const start =
            this.findNearestNode(
                startPosition
            );


        const goal =
            this.findNearestNode(
                goalPosition
            );


        if (
            !start ||
            !goal
        ) {

            return [];
        }


        return this.findPathByNodeIds(
            start.id,
            goal.id
        );
    }


    _heuristic(
        a,
        b
    ) {

        return a.position
            .distanceTo(
                b.position
            );
    }


    _reconstructPath(
        cameFrom,
        currentId
    ) {

        const ids = [
            currentId
        ];


        while (
            cameFrom.has(
                currentId
            )
        ) {

            currentId =
                cameFrom.get(
                    currentId
                );


            ids.unshift(
                currentId
            );
        }


        return ids
            .map(
                id =>
                    this.getNode(
                        id
                    )
            )
            .filter(
                Boolean
            )
            .map(
                node =>
                    node.position
                        .clone()
            );
    }


    // ========================================================
    // Clear
    // ========================================================

    clear() {

        this.nodes.clear();
    }
}


export default WaypointGraph;
