export function createContextMenuModule(app) {
  const { state, refs } = app;
  const { clamp, escapeHtml } = app;

  function openContextMenu(clientX, clientY, title, options, payload) {
    state.ui.contextOpen = true;
    state.ui.contextPayload = payload || null;

    refs.contextMenu.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      ${options
        .map(
          (option) =>
            `<button type="button" class="${option.className || ""}" data-context-action="${option.action}">${escapeHtml(option.label)}</button>`,
        )
        .join("")}
    `;

    const rect = refs.clientShell.getBoundingClientRect();
    const maxX = refs.clientShell.clientWidth - 196;
    const maxY = refs.clientShell.clientHeight - 168;
    const x = clamp(clientX - rect.left, 6, Math.max(6, maxX));
    const y = clamp(clientY - rect.top, 6, Math.max(6, maxY));

    refs.contextMenu.style.left = `${x}px`;
    refs.contextMenu.style.top = `${y}px`;
    refs.contextMenu.classList.remove("hidden");
  }

  function closeContextMenu() {
    state.ui.contextOpen = false;
    state.ui.contextPayload = null;
    refs.contextMenu.classList.add("hidden");
  }

  function executeContextAction(action) {
    const payload = state.ui.contextPayload;
    switch (action) {
      case "walk":
        app.executeAction("walk-here");
        break;
      case "attack":
        app.executeAction("attack-target");
        break;
      case "examine":
        app.executeAction("examine-target");
        break;
      case "wiki":
        app.executeAction("open-wiki-lookup");
        break;
      case "use-item": {
        if (!payload || payload.type !== "inventory") {
          break;
        }
        const item = state.inventory[payload.index];
        if (item) {
          app.pushChat("Game", `You use ${item.name}.`);
          app.notify("info", `${item.name} used.`);
        }
        break;
      }
      case "drop-item": {
        if (!payload || payload.type !== "inventory") {
          break;
        }
        const item = state.inventory[payload.index];
        if (item) {
          app.pushChat("Game", `You drop ${item.name}.`);
          app.notify("warn", `${item.name} dropped.`);
          state.inventory[payload.index] = null;
          if (state.ui.selectedItemIndex === payload.index) {
            state.ui.selectedItemIndex = null;
          }
          app.renderPanel();
        }
        break;
      }
      case "examine-item": {
        if (!payload || payload.type !== "inventory") {
          break;
        }
        const item = state.inventory[payload.index];
        if (item) {
          app.pushChat("Game", `${item.name}: It looks useful.`);
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    openContextMenu,
    closeContextMenu,
    executeContextAction,
  };
}
