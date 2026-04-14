/* global */

function createExpressionBuilder(state, els) {
  const { FACE_NAMES } = window.Cards;

  function lastSlot() {
    return state.exprSlots.length ? state.exprSlots[state.exprSlots.length - 1] : null;
  }

  function addCard(cardIndex, num) {
    const last = lastSlot();
    if (last && last.type === "card") return;
    if (last && last.type === "paren" && last.value === ")") return;

    state.exprSlots.push({ type: "card", value: num, cardIndex });
    state.usedCards.add(cardIndex);
    window.Cards.markCardUsed(els.cardsContainer, cardIndex, true);
    updateDisplay();
    syncToInput();
  }

  function addOperator(op) {
    const last = lastSlot();
    if (!last) return;
    if (last.type === "op") {
      last.value = op;
      updateDisplay();
      syncToInput();
      return;
    }
    if (last.type === "card" || (last.type === "paren" && last.value === ")")) {
      state.exprSlots.push({ type: "op", value: op });
      updateDisplay();
      syncToInput();
    }
  }

  function addParen(paren) {
    const last = lastSlot();
    if (paren === "(") {
      if (last && last.type === "card") return;
      if (last && last.type === "paren" && last.value === ")") return;
    }
    if (paren === ")") {
      if (!last) return;
      if (last.type === "op") return;
      if (last.type === "paren" && last.value === "(") return;
    }
    state.exprSlots.push({ type: "paren", value: paren });
    updateDisplay();
    syncToInput();
  }

  function undo() {
    if (!state.exprSlots.length) return;
    const removed = state.exprSlots.pop();
    if (removed.type === "card") {
      state.usedCards.delete(removed.cardIndex);
      window.Cards.markCardUsed(els.cardsContainer, removed.cardIndex, false);
    }
    updateDisplay();
    syncToInput();
  }

  function clear() {
    state.exprSlots = [];
    state.usedCards.clear();
    els.cardsContainer.querySelectorAll(".card").forEach((c) => c.classList.remove("used"));
    updateDisplay();
    syncToInput();
  }

  function updateDisplay() {
    const zone = els.dropZone;
    zone.innerHTML = "";
    if (!state.exprSlots.length) {
      zone.innerHTML = '<span class="expr-placeholder">拖动卡牌到此处，或点击卡牌构建表达式</span>';
      return;
    }
    state.exprSlots.forEach((slot) => {
      const el = document.createElement("span");
      if (slot.type === "card") {
        el.className = "expr-token expr-card";
        el.textContent = FACE_NAMES[slot.value] || slot.value;
      } else if (slot.type === "op") {
        el.className = "expr-token expr-op";
        el.textContent = slot.value;
      } else if (slot.type === "paren") {
        el.className = "expr-token expr-paren";
        el.textContent = slot.value;
      }
      zone.appendChild(el);
    });
  }

  function syncToInput() {
    els.input.value = state.exprSlots.map((s) => s.value).join(" ");
  }

  function setupDropZone() {
    const zone = els.dropZone;
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.type === "card") addCard(data.index, data.num);
      } catch {}
    });
  }

  return { addCard, addOperator, addParen, undo, clear, setupDropZone, updateDisplay, syncToInput };
}

window.Expression = { createExpressionBuilder };
