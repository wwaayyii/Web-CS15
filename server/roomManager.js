const MAPS = new Set(["fy_iceworld_web", "aim_arena_web"]);

const makeId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    list() {
        return [...this.rooms.values()].map(room => this.publicRoom(room));
    }

    publicRoom(room) {
        return {
            id: room.id,
            name: room.name,
            map: room.map,
            players: room.players.size,
            maxPlayers: room.maxPlayers,
            status: room.status
        };
    }

    create({ name, map, maxPlayers = 2, owner }) {
        const safeMap = MAPS.has(map) ? map : "fy_iceworld_web";
        const room = {
            id: makeId(),
            name: String(name || "WEB-CS Room").trim().slice(0, 28) || "WEB-CS Room",
            map: safeMap,
            maxPlayers: Math.max(2, Math.min(2, Number(maxPlayers) || 2)),
            status: "waiting",
            hostId: owner.id,
            players: new Map()
        };
        room.players.set(owner.id, owner);
        this.rooms.set(room.id, room);
        return room;
    }

    join(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("ROOM_NOT_FOUND");
        if (room.status !== "waiting") throw new Error("ROOM_NOT_WAITING");
        if (room.players.size >= room.maxPlayers) throw new Error("ROOM_FULL");
        room.players.set(player.id, player);
        return room;
    }

    leave(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        room.players.delete(playerId);
        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            return null;
        }
        if (room.hostId === playerId) {
            room.hostId = room.players.keys().next().value;
        }
        return room;
    }

    lobby(room) {
        return {
            ...this.publicRoom(room),
            hostId: room.hostId,
            playersList: [...room.players.values()].map(player => ({
                id: player.id,
                name: player.name
            }))
        };
    }
}
