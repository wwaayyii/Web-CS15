import { NetworkClient } from "./networkClient.js";
import { NET } from "./networkProtocol.js";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const defaultUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname || "localhost"}:8080`;
const serverUrl = params.get("server") || defaultUrl;
const client = new NetworkClient(serverUrl);

const roomList = $("room-list");
const status = $("online-status");
const lobby = $("lobby-panel");
const browser = $("browser-panel");
const pingText = $("ping-text");

function setStatus(text, bad = false) {
    status.textContent = text;
    status.classList.toggle("bad", bad);
}

function mapLabel(map) {
    return map === "aim_arena_web" ? "AIM ARENA" : "ICEWORLD";
}

function renderRooms(rooms = []) {
    roomList.innerHTML = "";
    if (!rooms.length) {
        roomList.innerHTML = `<div class="empty-room">NO ROOMS FOUND — CREATE ONE</div>`;
        return;
    }

    for (const room of rooms) {
        const row = document.createElement("div");
        row.className = "room-row";
        const joinable = room.status === "waiting" && room.players < room.maxPlayers;
        row.innerHTML = `
            <div><strong>${escapeHtml(room.name)}</strong><small>${room.id}</small></div>
            <div>${mapLabel(room.map)}</div>
            <div>${room.players} / ${room.maxPlayers}</div>
            <div>${room.status.toUpperCase()}</div>
            <button ${joinable ? "" : "disabled"}>${joinable ? "JOIN" : "FULL"}</button>`;
        row.querySelector("button").addEventListener("click", () => client.joinRoom(room.id));
        roomList.appendChild(row);
    }
}

function renderLobby(data) {
    browser.hidden = true;
    lobby.hidden = false;
    $("lobby-title").textContent = data.name;
    $("lobby-map").textContent = mapLabel(data.map);
    $("lobby-id").textContent = data.id;
    const players = $("lobby-players");
    players.innerHTML = "";
    for (const player of data.playersList) {
        const line = document.createElement("div");
        line.className = "lobby-player";
        line.textContent = `${player.id === data.hostId ? "HOST  " : "PLAYER  "}${player.name}${player.id === client.playerId ? "  (YOU)" : ""}`;
        players.appendChild(line);
    }
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

$("refresh-button").addEventListener("click", () => client.refreshRooms());
$("create-button").addEventListener("click", () => $("create-dialog").showModal());
$("create-cancel").addEventListener("click", () => $("create-dialog").close());
$("create-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("room-name").value.trim() || "WEB-CS Room";
    const map = $("room-map").value;
    client.createRoom({ name, map });
    $("create-dialog").close();
});
$("leave-room").addEventListener("click", () => client.leaveRoom());

client.addEventListener("open", () => {
    setStatus(`CONNECTED · ${serverUrl}`);
    const savedName = localStorage.getItem("webcs-player-name") || `Player-${Math.floor(1000 + Math.random() * 9000)}`;
    $("player-name").value = savedName;
    client.setName(savedName);
});
client.addEventListener("close", () => setStatus("DISCONNECTED FROM ONLINE SERVER", true));
client.addEventListener("ping", event => pingText.textContent = `PING ${event.detail} ms`);
client.addEventListener(NET.ROOM_LIST, event => renderRooms(event.detail.rooms));
client.addEventListener(NET.LOBBY_STATE, event => renderLobby(event.detail.lobby));
client.addEventListener(NET.LEFT_ROOM, () => {
    lobby.hidden = true;
    browser.hidden = false;
    client.refreshRooms();
});
client.addEventListener(NET.ERROR, event => setStatus(`SERVER ERROR: ${event.detail.code}`, true));

$("player-name").addEventListener("change", event => {
    const name = event.target.value.trim().slice(0, 20) || "Player";
    localStorage.setItem("webcs-player-name", name);
    client.setName(name);
});

client.connect().catch(error => setStatus(`${error.message} · START server/server.js FIRST`, true));
