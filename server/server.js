import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { RoomManager } from "./roomManager.js";

const PORT = Number(process.env.PORT || 8080);
const rooms = new RoomManager();
const wss = new WebSocketServer({ port: PORT });

const send = (ws, type, data = {}) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...data }));
    }
};

const broadcastRoomList = () => {
    const payload = JSON.stringify({ type: "ROOM_LIST", rooms: rooms.list() });
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
};

const broadcastLobby = room => {
    if (!room) return;
    const payload = JSON.stringify({ type: "LOBBY_STATE", lobby: rooms.lobby(room) });
    for (const player of room.players.values()) {
        if (player.ws?.readyState === WebSocket.OPEN) player.ws.send(payload);
    }
};

const leaveCurrentRoom = ws => {
    if (!ws.roomId) return;
    const oldRoomId = ws.roomId;
    ws.roomId = null;
    const room = rooms.leave(oldRoomId, ws.playerId);
    broadcastLobby(room);
    broadcastRoomList();
};

wss.on("connection", ws => {
    ws.playerId = randomUUID();
    ws.roomId = null;
    ws.playerName = `Player-${ws.playerId.slice(0, 4)}`;

    send(ws, "WELCOME", { playerId: ws.playerId });
    send(ws, "ROOM_LIST", { rooms: rooms.list() });

    ws.on("message", raw => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            send(ws, "ERROR", { code: "BAD_MESSAGE" });
            return;
        }

        try {
            switch (msg.type) {
                case "PING":
                    send(ws, "PONG", { sentAt: msg.sentAt });
                    break;

                case "GET_ROOM_LIST":
                    send(ws, "ROOM_LIST", { rooms: rooms.list() });
                    break;

                case "SET_NAME":
                    ws.playerName = String(msg.name || ws.playerName).trim().slice(0, 20) || ws.playerName;
                    break;

                case "CREATE_ROOM": {                    
                    leaveCurrentRoom(ws);
                    const room = rooms.create({
                        name: msg.name,
                        map: msg.map,
                        maxPlayers: 2,
                        owner: { id: ws.playerId, name: ws.playerName, ws }
                    });
                    ws.roomId = room.id;
                    broadcastLobby(room);
                    broadcastRoomList();
                    break;
                }

                case "JOIN_ROOM": {
                    leaveCurrentRoom(ws);
                    const room = rooms.join(msg.roomId, {
                        id: ws.playerId,
                        name: ws.playerName,
                        ws
                    });
                    ws.roomId = room.id;
                    broadcastLobby(room);
                    broadcastRoomList();
                    break;
                }

                case "LEAVE_ROOM":
                    leaveCurrentRoom(ws);
                    send(ws, "LEFT_ROOM");
                    break;

                default:
                    send(ws, "ERROR", { code: "UNKNOWN_MESSAGE" });
            }
        } catch (error) {
            send(ws, "ERROR", { code: error.message || "SERVER_ERROR" });
        }
    });

    ws.on("close", () => leaveCurrentRoom(ws));
});

console.log(`WEB-CS15 online server listening on ws://0.0.0.0:${PORT}`);
