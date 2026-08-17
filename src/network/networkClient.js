import { NET } from "./networkProtocol.js";

export class NetworkClient extends EventTarget {
    constructor(url) {
        super();
        this.url = url;
        this.socket = null;
        this.playerId = null;
        this.ping = null;
        this.pingTimer = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(this.url);
            this.socket = socket;

            socket.addEventListener("open", () => {
                this._startPing();
                this.dispatchEvent(new Event("open"));
                resolve();
            }, { once: true });

            socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
            socket.addEventListener("close", () => {
                clearInterval(this.pingTimer);
                this.dispatchEvent(new Event("close"));
            });
            socket.addEventListener("message", event => this._handleMessage(event.data));
        });
    }

    send(type, data = {}) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false;
        this.socket.send(JSON.stringify({ type, ...data }));
        return true;
    }

    setName(name) { this.send(NET.SET_NAME, { name }); }
    refreshRooms() { this.send(NET.GET_ROOM_LIST); }
    createRoom({ name, map }) { this.send(NET.CREATE_ROOM, { name, map, maxPlayers: 2 }); }
    joinRoom(roomId) { this.send(NET.JOIN_ROOM, { roomId }); }
    leaveRoom() { this.send(NET.LEAVE_ROOM); }

    _startPing() {
        const ping = () => this.send(NET.PING, { sentAt: performance.now() });
        ping();
        this.pingTimer = setInterval(ping, 3000);
    }

    _handleMessage(raw) {
        let message;
        try { message = JSON.parse(raw); } catch { return; }

        if (message.type === NET.WELCOME) this.playerId = message.playerId;
        if (message.type === NET.PONG && Number.isFinite(message.sentAt)) {
            this.ping = Math.max(0, Math.round(performance.now() - message.sentAt));
            this.dispatchEvent(new CustomEvent("ping", { detail: this.ping }));
        }

        this.dispatchEvent(new CustomEvent("message", { detail: message }));
        this.dispatchEvent(new CustomEvent(message.type, { detail: message }));
    }
}
