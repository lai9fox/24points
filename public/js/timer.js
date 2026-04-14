/* global */

function createTimer(el, onTimeout) {
  let intervalId = null;
  let timeLeft = 0;

  function update() {
    if (!el) return;
    el.textContent = timeLeft;
    el.className = timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : "";
  }

  function start(seconds) {
    timeLeft = seconds;
    update();
    stop();
    intervalId = setInterval(() => {
      timeLeft--;
      update();
      if (timeLeft <= 0) {
        stop();
        if (onTimeout) onTimeout();
      }
    }, 1000);
  }

  function stop() {
    clearInterval(intervalId);
  }

  function getTimeLeft() {
    return timeLeft;
  }

  return { start, stop, getTimeLeft };
}

window.Timer = { createTimer };
