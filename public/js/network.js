/* global Peer */

const CONN_FAIL_PROXY_HINT =
  "\n\n提示：使用代理工具可能导致连接失败，请尝试关闭代理或切换网络后重试。";

function generateRoomId() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function peerIdFromRoom(roomId) {
  return `twenty-four-game-${roomId}`;
}

function initPeer(customId) {
  return new Promise((resolve, reject) => {
    const peer = customId ? new Peer(customId) : new Peer();
    peer.on("open", () => resolve(peer));
    peer.on("error", (err) => reject(err));
  });
}

async function createRoom(state, onConnected) {
  state.roomId = generateRoomId();
  const peerId = peerIdFromRoom(state.roomId);

  try {
    state.peer = await initPeer(peerId);
  } catch (err) {
    alert("WebRTC 初始化失败: " + err.message + CONN_FAIL_PROXY_HINT);
    return null;
  }

  state.peer.on("connection", (conn) => {
    state.conn = conn;
    if (onConnected) onConnected(conn);
  });

  return state.roomId;
}

async function joinRoom(roomId, state, onConnected, onFail) {
  try {
    state.peer = await initPeer();
  } catch (err) {
    alert("WebRTC 初始化失败: " + err.message + CONN_FAIL_PROXY_HINT);
    if (onFail) onFail();
    return;
  }

  const hostPeerId = peerIdFromRoom(roomId);
  const conn = state.peer.connect(hostPeerId, { reliable: true });
  state.conn = conn;
  state.roomId = roomId;

  const timeout = setTimeout(() => {
    conn.close();
    alert("连接超时，房间可能不存在。" + CONN_FAIL_PROXY_HINT);
    if (onFail) onFail();
  }, 8000);

  conn.on("open", () => clearTimeout(timeout));
  conn.on("error", () => {
    clearTimeout(timeout);
    alert("连接失败，房间可能不存在。" + CONN_FAIL_PROXY_HINT);
    if (onFail) onFail();
  });

  if (onConnected) onConnected(conn);
}

const PING_INTERVAL = 3000;
const PING_TIMEOUT = 8000;

function setupConn(conn, role, state, handlers) {
  state.mode = role;
  let pingTimer = null;
  let lastPong = Date.now();
  let closed = false;

  function startPing() {
    stopPing();
    lastPong = Date.now();
    pingTimer = setInterval(() => {
      if (closed) { stopPing(); return; }
      if (Date.now() - lastPong > PING_TIMEOUT) {
        stopPing();
        if (!closed) {
          closed = true;
          try { conn.close(); } catch {}
          if (handlers.onClose) handlers.onClose();
        }
        return;
      }
      try {
        if (conn.open) conn.send({ type: "__ping" });
      } catch {}
    }, PING_INTERVAL);
  }

  function stopPing() {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  conn.on("open", () => {
    startPing();
    if (handlers.onOpen) handlers.onOpen();
  });

  conn.on("data", (msg) => {
    if (msg && msg.type === "__ping") {
      try { if (conn.open) conn.send({ type: "__pong" }); } catch {}
      return;
    }
    if (msg && msg.type === "__pong") {
      lastPong = Date.now();
      return;
    }
    if (handlers.onMessage) handlers.onMessage(msg);
  });

  conn.on("close", () => {
    if (closed) return;
    closed = true;
    stopPing();
    if (handlers.onClose) handlers.onClose();
  });
}

window.Network = { generateRoomId, createRoom, joinRoom, setupConn };
