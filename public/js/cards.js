/* global */

const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_SYMBOLS = {
  "♠": { color: "black" },
  "♥": { color: "red" },
  "♦": { color: "red" },
  "♣": { color: "black" },
};
const FACE_NAMES = { 1: "A", 11: "J", 12: "Q", 13: "K" };

const FACE_FIGURES = {
  11: { label: "J", svg: "svg/J.svg" },
  12: { label: "Q", svg: "svg/Q.svg" },
  13: { label: "K", svg: "svg/K.svg" },
};

function buildCardCenter(num, suit) {
  if (FACE_FIGURES[num]) {
    return `<div class="card-center face-figure">
      <span class="card-figure"><img src="${FACE_FIGURES[num].svg}" alt="${FACE_FIGURES[num].label}" draggable="false"></span>
      <span class="card-figure-suit">${suit}</span>
    </div>`;
  }
  return `<div class="card-center">
    <span class="card-pip">${suit}</span>
  </div>`;
}

function renderCards(cards, container, state, { onCardClick }) {
  container.innerHTML = "";
  state.cardSuits = cards.map(() => SUITS[Math.floor(Math.random() * 4)]);

  cards.forEach((num, i) => {
    const suit = state.cardSuits[i];
    const isRed = SUIT_SYMBOLS[suit].color === "red";
    const display = FACE_NAMES[num] || num;
    const isFace = !!FACE_FIGURES[num];

    const card = document.createElement("div");
    card.className = `card ${isRed ? "red" : "black"} ${isFace ? "face-card" : ""} deal`;
    card.dataset.index = i;
    card.dataset.num = num;
    card.style.animationDelay = `${i * 0.12}s`;
    card.draggable = true;

    card.innerHTML = `
      <div class="card-corner card-corner-top">
        <span class="card-rank">${display}</span>
        <span class="card-suit-small">${suit}</span>
      </div>
      ${buildCardCenter(num, suit)}
      <div class="card-corner card-corner-bottom">
        <span class="card-rank">${display}</span>
        <span class="card-suit-small">${suit}</span>
      </div>
    `;

    card.addEventListener("dragstart", (e) => {
      if (!state.roundActive || state.usedCards.has(i)) { e.preventDefault(); return; }
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "card", index: i, num }));
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("click", () => {
      if (!state.roundActive || state.usedCards.has(i)) return;
      if (onCardClick) onCardClick(i, num);
    });

    container.appendChild(card);
  });
}

function markCardUsed(container, index, used) {
  const cards = container.querySelectorAll(".card");
  if (cards[index]) cards[index].classList.toggle("used", used);
}

window.Cards = { SUITS, SUIT_SYMBOLS, FACE_NAMES, FACE_FIGURES, renderCards, markCardUsed };
