export function createSimulationModule(app) {
  const { state, refs, threeState } = app;
  const { clamp, randomBetween } = app;

  function setTarget(x, y) {
    state.markers.target.x = clamp(Math.round(x), 4, 96);
    state.markers.target.y = clamp(Math.round(y), 4, 96);
    updateMarkers();
  }

  function movePlayerStep() {
    const p = state.markers.player;
    const t = state.markers.target;

    const dx = t.x - p.x;
    const dy = t.y - p.y;

    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      refs.hintLabel.textContent = "Walk here";
      return;
    }

    const step = state.stats.running ? 2 : 1;
    p.x = clamp(p.x + Math.sign(dx) * Math.min(step, Math.abs(dx)), 4, 96);
    p.y = clamp(p.y + Math.sign(dy) * Math.min(step, Math.abs(dy)), 4, 96);

    updateMarkers();
  }

  function updateMarkers() {
    const p = state.markers.player;
    const t = state.markers.target;

    const playerViewportTop = 20 + p.y * 0.68;
    const targetViewportTop = 20 + t.y * 0.68;

    refs.actorPlayer.style.left = `${p.x}%`;
    refs.actorPlayer.style.top = `${playerViewportTop}%`;
    refs.actorTarget.style.left = `${t.x}%`;
    refs.actorTarget.style.top = `${targetViewportTop}%`;

    refs.mapPlayerDot.style.left = `${p.x}%`;
    refs.mapPlayerDot.style.top = `${p.y}%`;
    refs.mapTargetDot.style.left = `${t.x}%`;
    refs.mapTargetDot.style.top = `${t.y}%`;

    app.syncThreeActors();
  }

  function stepSimulation() {
    if (state.stats.running) {
      state.stats.run = clamp(state.stats.run - 1, 0, 100);
    } else {
      state.stats.run = clamp(state.stats.run + 2, 0, 100);
    }

    if (state.stats.quickPrayer) {
      state.stats.prayer = clamp(state.stats.prayer - 1, 0, state.stats.maxPrayer);
    }

    if (state.stats.run <= 0) {
      state.stats.running = false;
    }

    if (state.stats.prayer <= 0) {
      state.stats.quickPrayer = false;
    }

    state.stats.spec = clamp(state.stats.spec + 1, 0, 100);
    state.stats.hp = clamp(state.stats.hp + randomBetween(-1, 1), 55, state.stats.maxHp);

    if (state.social.groupingCooldown > 0) {
      state.social.groupingCooldown -= 1;
    }

    if (!threeState.controls) {
      state.runtime.heading = (state.runtime.heading + (state.stats.running ? 3 : 1)) % 360;
      app.updateHeading();
    }

    drawMinimap();
    app.renderOrbs();

    if (
      state.ui.activeTop === "inventory" ||
      state.ui.activeTop === "prayer" ||
      state.ui.activeTop === "magic" ||
      state.ui.activeBottom === "settings"
    ) {
      app.renderPanel();
    }
  }

  function drawMinimap() {
    const ctx = refs.minimapCanvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const w = refs.minimapCanvas.width;
    const h = refs.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.clip();

    const mapGradient = ctx.createRadialGradient(cx - 10, cy - 14, 5, cx, cy, 74);
    mapGradient.addColorStop(0, "#6f8f5f");
    mapGradient.addColorStop(0.48, "#405634");
    mapGradient.addColorStop(1, "#1d2917");
    ctx.fillStyle = mapGradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
    ctx.lineWidth = 1;
    for (let i = 8; i < w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 8; i < h; i += 16) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((state.runtime.heading * Math.PI) / 180);

    ctx.fillStyle = "#d14f45";
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.lineTo(5, -6);
    ctx.lineTo(-5, -6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(4, 6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = "rgba(255, 211, 141, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 71, 0, Math.PI * 2);
    ctx.stroke();
  }

  return {
    setTarget,
    movePlayerStep,
    updateMarkers,
    stepSimulation,
    drawMinimap,
  };
}
