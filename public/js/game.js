/* global */

const TOTAL_ROUNDS = 5;
const ROUND_TIME = 60;
const UNSOLVABLE_RATIO = 0.3;

const state = {
  mode: "solo",
  cards: [],
  cardSuits: [],
  solvable: true,
  round: 0,
  scoreMe: 0,
  scoreOpponent: 0,
  timeLeft: ROUND_TIME,
  peer: null,
  conn: null,
  roomId: "",
  roundActive: false,
  exprSlots: [],
  usedCards: new Set(),
  gaveUp: false,
  opponentGaveUp: false,
};

const $ = (sel) => document.querySelector(sel);
const screens = {};
let timer = null;
let exprBuilder = null;

document.addEventListener("DOMContentLoaded", () => {
  screens.home = $("#screen-home");
  screens.join = $("#screen-join");
  screens.waiting = $("#screen-waiting");
  screens.game = $("#screen-game");
  screens.result = $("#screen-result");

  timer = window.Timer.createTimer($("#timer"), onTimedOut);

  const els = {
    dropZone: $("#expr-drop-zone"),
    input: $("#expr-input"),
    cardsContainer: $("#cards-container"),
  };
  exprBuilder = window.Expression.createExpressionBuilder(state, els);

  bindEvents();
});

function setJoinConnecting(connecting) {
  const screen = $("#screen-join");
  const overlay = $("#join-loading-overlay");
  const input = $("#input-room-id");
  const btnJoin = $("#btn-join-confirm");
  const btnBack = $("#btn-join-back");
  if (!screen) return;
  screen.classList.toggle("is-connecting", connecting);
  if (overlay) {
    overlay.hidden = !connecting;
    overlay.setAttribute("aria-busy", connecting ? "true" : "false");
  }
  if (input) input.disabled = !!connecting;
  if (btnJoin) btnJoin.disabled = !!connecting;
  if (btnBack) btnBack.disabled = !!connecting;
}

function bindEvents() {
  $("#btn-solo").addEventListener("click", () => startGame("solo"));
  $("#btn-create").addEventListener("click", handleCreateRoom);
  $("#btn-join").addEventListener("click", () => {
    setJoinConnecting(false);
    showScreen("join");
  });

  $("#btn-join-confirm").addEventListener("click", handleJoinRoom);
  $("#btn-join-back").addEventListener("click", () => {
    setJoinConnecting(false);
    showScreen("home");
  });
  $("#input-room-id").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJoinRoom();
  });

  $("#btn-copy-room").addEventListener("click", () => {
    navigator.clipboard.writeText(state.roomId);
    const btn = $("#btn-copy-room");
    btn.textContent = "已复制";
    setTimeout(() => (btn.textContent = "复制"), 1500);
  });

  $("#btn-waiting-back").addEventListener("click", () => {
    if (state.peer) state.peer.destroy();
    showScreen("home");
  });

  $("#btn-back").addEventListener("click", handleBack);

  $("#btn-submit").addEventListener("click", submitAnswer);
  $("#expr-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAnswer();
  });

  $("#btn-give-up").addEventListener("click", handleGiveUp);
  $("#btn-no-solution").addEventListener("click", handleNoSolution);

  document.querySelectorAll(".op-btn:not(.paren-btn):not(.undo-btn):not(.clear-btn)").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.roundActive) return;
      exprBuilder.addOperator(btn.dataset.op);
    });
  });

  $("#btn-paren-open").addEventListener("click", () => {
    if (!state.roundActive) return;
    exprBuilder.addParen("(");
  });
  $("#btn-paren-close").addEventListener("click", () => {
    if (!state.roundActive) return;
    exprBuilder.addParen(")");
  });

  $("#btn-undo").addEventListener("click", () => exprBuilder.undo());
  $("#btn-clear-expr").addEventListener("click", () => exprBuilder.clear());

  $("#btn-continue").addEventListener("click", handleContinue);

  $("#btn-again").addEventListener("click", () => {
    if (state.mode === "solo") {
      startGame("solo");
    } else if (state.conn && state.conn.open) {
      state.conn.send({ type: "rematch" });
      startGame(state.mode);
    } else {
      showScreen("home");
    }
  });

  $("#btn-home").addEventListener("click", () => {
    if (state.peer) state.peer.destroy();
    timer.stop();
    showScreen("home");
  });
}

function showScreen(name) {
  Object.values(screens).forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (screens[name]) screens[name].classList.add("active");
}

function showMessage(text, type = "info") {
  const el = $("#game-message");
  if (!el) return;
  el.textContent = text;
  el.className = type;
}

function updateScoreDisplay() {
  const me = $("#score-me");
  const opp = $("#score-opponent");
  if (me) me.textContent = state.scoreMe;
  if (opp) opp.textContent = state.scoreOpponent;
}

function lockInput() {
  const input = $("#expr-input");
  const btn = $("#btn-submit");
  if (input) input.disabled = true;
  if (btn) btn.disabled = true;
  document.querySelectorAll(".op-btn").forEach((b) => (b.disabled = true));
}

function unlockInput() {
  const input = $("#expr-input");
  const btn = $("#btn-submit");
  if (input) { input.value = ""; input.disabled = false; }
  if (btn) btn.disabled = false;
  document.querySelectorAll(".op-btn").forEach((b) => (b.disabled = false));
  exprBuilder.clear();
  exprBuilder.setupDropZone();
}

function updateGiveUpButton() {
  const btnGiveUp = $("#btn-give-up");
  const btnContinue = $("#btn-continue");
  const btnNoSolution = $("#btn-no-solution");
  if (!btnGiveUp || !btnContinue) return;

  if (state.mode === "solo") {
    btnGiveUp.style.display = state.roundActive ? "" : "none";
    btnContinue.style.display = "none";
    if (btnNoSolution) btnNoSolution.style.display = state.roundActive ? "" : "none";
  } else {
    btnGiveUp.style.display = state.roundActive && !state.gaveUp ? "" : "none";
    btnContinue.style.display = "none";
    if (btnNoSolution) btnNoSolution.style.display = state.roundActive && !state.gaveUp ? "" : "none";
  }
}

function showConfirmDialog(message, onConfirm, onCancel) {
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="dialog-box">
      <p>${message}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost btn-dialog-cancel">取消</button>
        <button class="btn btn-primary btn-dialog-confirm">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".btn-dialog-confirm").addEventListener("click", () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });
  overlay.querySelector(".btn-dialog-cancel").addEventListener("click", () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });
}

function handleBack() {
  if (state.mode === "solo") {
    timer.stop();
    state.roundActive = false;
    if (state.peer) state.peer.destroy();
    showScreen("home");
  } else {
    showConfirmDialog("确定退出对战吗？对手将会收到退出通知。", () => {
      timer.stop();
      state.roundActive = false;
      if (state.conn && state.conn.open) {
        state.conn.send({ type: "opponent-quit" });
      }
      endGame();
    });
  }
}

function handleNoSolution() {
  if (!state.roundActive) return;

  if (!state.solvable) {
    state.roundActive = false;
    timer.stop();
    state.scoreMe++;
    updateScoreDisplay();
    showMessage("✅ 正确！这组牌确实无解", "success");
    lockInput();
    updateGiveUpButton();

    if (state.conn && state.conn.open) {
      state.conn.send({ type: "solved", round: state.round });
    }

    if (state.mode === "solo") {
      setTimeout(() => nextRound(), 1500);
    } else if (state.mode === "host") {
      setTimeout(() => nextRound(), 1500);
    }
  } else {
    showMessage("❌ 这组牌有解哦，再想想！", "error");
  }
}

// ========== Game Flow ==========

function startGame(mode) {
  state.mode = mode;
  state.round = 0;
  state.scoreMe = 0;
  state.scoreOpponent = 0;
  state.gaveUp = false;
  state.opponentGaveUp = false;
  updateScoreDisplay();

  if (mode === "solo") {
    $("#score-board").style.display = "none";
  } else {
    $("#score-board").style.display = "flex";
    $("#opponent-label").textContent = "对手";
  }

  showScreen("game");

  if (mode === "solo" || mode === "host") {
    nextRound();
  }
}

function generateCards() {
  if (Math.random() < UNSOLVABLE_RATIO) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const cards = Array.from({ length: 4 }, () => Math.floor(Math.random() * 13) + 1);
      if (!window.Solver.canMake24(cards)) {
        return { cards, solvable: false };
      }
    }
  }
  let cards;
  do {
    cards = Array.from({ length: 4 }, () => Math.floor(Math.random() * 13) + 1);
  } while (!window.Solver.canMake24(cards));
  return { cards, solvable: true };
}

function nextRound() {
  state.round++;
  if (state.round > TOTAL_ROUNDS) {
    endGame();
    if (state.conn && state.conn.open) {
      state.conn.send({ type: "game-over" });
    }
    return;
  }

  state.roundActive = true;
  state.gaveUp = false;
  state.opponentGaveUp = false;
  $("#round-num").textContent = state.round;
  $("#round-total").textContent = TOTAL_ROUNDS;
  unlockInput();
  showMessage("");

  const { cards, solvable } = generateCards();
  state.cards = cards;
  state.solvable = solvable;

  window.Cards.renderCards(cards, $("#cards-container"), state, {
    onCardClick: (i, num) => exprBuilder.addCard(i, num),
  });

  timer.start(ROUND_TIME);
  updateGiveUpButton();

  if (state.mode === "host" && state.conn && state.conn.open) {
    state.conn.send({ type: "new-round", cards, solvable, round: state.round });
  }
}

function receiveNewRound(msg) {
  state.cards = msg.cards;
  state.solvable = msg.solvable;
  state.round = msg.round;
  state.roundActive = true;
  state.gaveUp = false;
  state.opponentGaveUp = false;
  $("#round-num").textContent = msg.round;
  $("#round-total").textContent = TOTAL_ROUNDS;
  unlockInput();

  window.Cards.renderCards(msg.cards, $("#cards-container"), state, {
    onCardClick: (i, num) => exprBuilder.addCard(i, num),
  });

  timer.start(ROUND_TIME);
  showMessage("");
  updateGiveUpButton();
}

function onTimedOut() {
  if (!state.roundActive) return;
  state.roundActive = false;
  showMessage("⏰ 时间到！", "error");
  lockInput();
  updateGiveUpButton();

  if (state.mode === "solo") {
    showSolutionAndWait();
  } else if (state.mode === "host") {
    setTimeout(() => nextRound(), 2000);
  }
}

function submitAnswer() {
  const expr = $("#expr-input").value.trim();
  if (!expr || !state.roundActive) return;

  if (!state.solvable) {
    showMessage("❌ 这组牌其实无解，试试点击「无解」按钮", "error");
    return;
  }

  const result = window.Solver.validateExpression(expr, state.cards);

  if (result.valid) {
    state.roundActive = false;
    timer.stop();
    state.scoreMe++;
    updateScoreDisplay();
    showMessage("✅ 正确！", "success");
    lockInput();
    updateGiveUpButton();

    if (state.conn && state.conn.open) {
      state.conn.send({ type: "solved", round: state.round });
    }

    if (state.mode === "solo") {
      setTimeout(() => nextRound(), 1500);
    } else if (state.mode === "host") {
      setTimeout(() => nextRound(), 1500);
    }
  } else {
    showMessage(`❌ ${result.error}`, "error");
    $("#expr-input").select();
  }
}

function handleGiveUp() {
  if (!state.roundActive) return;

  if (state.mode === "solo") {
    state.roundActive = false;
    state.gaveUp = true;
    timer.stop();
    lockInput();
    showSolutionAndWait();
  } else {
    state.gaveUp = true;
    lockInput();
    updateGiveUpButton();

    if (state.conn && state.conn.open) {
      state.conn.send({ type: "gave-up", round: state.round });
    }

    if (state.opponentGaveUp) {
      state.roundActive = false;
      timer.stop();
      showMessage("双方都放弃了", "info");
      if (state.mode === "host") {
        setTimeout(() => nextRound(), 2000);
      }
    } else {
      showMessage("你已放弃，等待对手...", "info");
    }
  }
}

function showSolutionAndWait() {
  const btnContinue = $("#btn-continue");
  const btnGiveUp = $("#btn-give-up");
  const btnNoSolution = $("#btn-no-solution");
  if (btnGiveUp) btnGiveUp.style.display = "none";
  if (btnNoSolution) btnNoSolution.style.display = "none";

  if (state.solvable) {
    const sol = window.Solver.findSolution(state.cards);
    showMessage(`💡 解法：${sol}`, "info");
  } else {
    showMessage("🚫 这组牌无法算出 24 点", "info");
  }

  if (btnContinue) btnContinue.style.display = "";
}

function handleContinue() {
  const btnContinue = $("#btn-continue");
  if (btnContinue) btnContinue.style.display = "none";
  nextRound();
}

function endGame(reason) {
  timer.stop();
  showScreen("result");

  const title = $("#result-title");
  const scores = $("#result-scores");

  if (state.mode === "solo") {
    title.textContent = "练习结束";
    scores.innerHTML = `<span class="win">${state.scoreMe} / ${TOTAL_ROUNDS}</span>`;
  } else {
    if (reason === "opponent-quit") {
      title.textContent = "对手已退出";
    } else if (state.scoreMe > state.scoreOpponent) {
      title.textContent = "🎉 你赢了！";
    } else if (state.scoreMe < state.scoreOpponent) {
      title.textContent = "😢 你输了";
    } else {
      title.textContent = "🤝 平局";
    }
    const myClass = state.scoreMe >= state.scoreOpponent ? "win" : "lose";
    const opClass = state.scoreOpponent >= state.scoreMe ? "win" : "lose";
    scores.innerHTML = `
      <span class="${myClass}">${state.scoreMe}</span>
      <span style="color:var(--text-dim)">:</span>
      <span class="${opClass}">${state.scoreOpponent}</span>`;
  }
}

// ========== Network Handlers ==========

async function handleCreateRoom() {
  const roomId = await window.Network.createRoom(state, (conn) => {
    state.conn = conn;
    window.Network.setupConn(conn, "host", state, {
      onOpen: () => startGame("host"),
      onMessage: handlePeerMsg,
      onClose: () => {
        timer.stop();
        state.roundActive = false;
        lockInput();
        endGame("opponent-quit");
      },
    });
  });

  if (!roomId) return;

  $("#room-code-text").textContent = state.roomId;
  showScreen("waiting");
}

async function handleJoinRoom() {
  const roomId = $("#input-room-id").value.trim().toUpperCase();
  if (roomId.length !== 6) {
    alert("请输入 6 位房间号");
    return;
  }

  setJoinConnecting(true);

  await window.Network.joinRoom(roomId, state, (conn) => {
    window.Network.setupConn(conn, "guest", state, {
      onOpen: () => {
        setJoinConnecting(false);
        state.round = 0;
        state.scoreMe = 0;
        state.scoreOpponent = 0;
        updateScoreDisplay();
        $("#score-board").style.display = "flex";
        $("#opponent-label").textContent = "对手";
        showScreen("game");
        showMessage("已连接，等待房主发牌...", "info");
      },
      onMessage: handlePeerMsg,
      onClose: () => {
        timer.stop();
        state.roundActive = false;
        lockInput();
        endGame("opponent-quit");
      },
    });
  }, () => {
    setJoinConnecting(false);
    showScreen("home");
  });
}

function handlePeerMsg(msg) {
  switch (msg.type) {
    case "new-round":
      receiveNewRound(msg);
      break;

    case "solved":
      if (state.roundActive || (state.gaveUp && !state.opponentGaveUp)) {
        state.roundActive = false;
        timer.stop();
        state.scoreOpponent++;
        updateScoreDisplay();
        showMessage("😩 对手先答出来了！", "error");
        lockInput();
        updateGiveUpButton();

        if (state.mode === "host") {
          setTimeout(() => nextRound(), 1500);
        }
      }
      break;

    case "gave-up":
      state.opponentGaveUp = true;
      if (state.gaveUp) {
        state.roundActive = false;
        timer.stop();
        showMessage("双方都放弃了", "info");
        lockInput();
        updateGiveUpButton();
        if (state.mode === "host") {
          setTimeout(() => nextRound(), 2000);
        }
      } else {
        showMessage("对手已放弃，继续加油！", "info");
      }
      break;

    case "game-over":
      endGame();
      break;

    case "rematch":
      startGame(state.mode);
      break;

    case "opponent-quit":
      state.roundActive = false;
      timer.stop();
      lockInput();
      showMessage("对手退出了游戏", "error");
      setTimeout(() => endGame("opponent-quit"), 1500);
      break;
  }
}
