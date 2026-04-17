export function createEventsModule(app) {
  const { state, refs, constants } = app;

  function bindEvents() {
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("change", onDocumentChange);
    document.addEventListener("contextmenu", onDocumentContextMenu);

    refs.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        app.sendChat();
      }
    });

    refs.minimap.addEventListener("click", onMinimapClick);

    refs.viewport.addEventListener("click", (event) => {
      if (event.button !== 0) {
        return;
      }
      const rect = refs.viewport.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      app.setTarget(x, y);
      refs.hintLabel.textContent = "Walking";
      app.pushChat("Game", `Walk target set to ${Math.round(x)}, ${Math.round(y)}.`);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        app.closeContextMenu();
      }
    });
  }

  function onDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const tabButton = target.closest("[data-tab-id]");
    if (tabButton instanceof HTMLElement) {
      const tabId = tabButton.dataset.tabId;
      const group = tabButton.dataset.tabGroup;
      if (tabId && group === "top") {
        state.ui.activeTop = tabId;
        state.ui.activeGroup = "top";
      }
      if (tabId && group === "bottom") {
        state.ui.activeBottom = tabId;
        state.ui.activeGroup = "bottom";
      }
      app.renderTabs();
      app.renderPanel();
      return;
    }

    const channelButton = target.closest("[data-channel]");
    if (channelButton instanceof HTMLElement) {
      const nextChannel = channelButton.dataset.channel || "All";
      if (constants.CHAT_CHANNELS.includes(nextChannel)) {
        state.ui.chatChannel = nextChannel;
        app.renderChatFilters();
        app.renderChatLog();
      }
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      app.executeAction(actionButton.dataset.action || "");
      return;
    }

    const contextActionButton = target.closest("[data-context-action]");
    if (contextActionButton instanceof HTMLElement) {
      app.executeContextAction(contextActionButton.dataset.contextAction || "");
      app.closeContextMenu();
      return;
    }

    const itemSlot = target.closest("[data-item-index]");
    if (itemSlot instanceof HTMLElement) {
      state.ui.selectedItemIndex = Number(itemSlot.dataset.itemIndex);
      app.renderPanel();
      return;
    }

    const prayerToggle = target.closest("[data-prayer-toggle]");
    if (prayerToggle instanceof HTMLElement) {
      const prayerName = prayerToggle.dataset.prayerToggle || "Thick Skin";
      state.ui.selectedPrayer = prayerName;
      state.stats.prayer = app.clamp(state.stats.prayer - 1, 0, state.stats.maxPrayer);
      app.pushChat("Game", `${prayerName} toggled.`);
      app.renderPanel();
      app.renderOrbs();
      return;
    }

    const spellCast = target.closest("[data-spell-cast]");
    if (spellCast instanceof HTMLElement) {
      const spellName = spellCast.dataset.spellCast || "Wind Strike";
      state.ui.selectedSpell = spellName;
      app.pushChat("Game", `${spellName} cast successfully.`);
      app.notify("success", `${spellName} cast.`);
      app.renderPanel();
      return;
    }

    const friendMessage = target.closest("[data-message-friend]");
    if (friendMessage instanceof HTMLElement) {
      const name = friendMessage.dataset.messageFriend || "Friend";
      state.ui.chatChannel = "Private";
      refs.chatInput.value = `/@${name} `;
      refs.chatInput.focus();
      app.renderChatFilters();
      app.renderChatLog();
      return;
    }

    if (state.ui.contextOpen && !target.closest("#context-menu")) {
      app.closeContextMenu();
    }
  }

  function onDocumentChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches("[data-client-layout]")) {
      const nextLayout = target.getAttribute("data-client-layout") || "";
      app.setGameClientLayout(nextLayout, true);
      return;
    }

    if (target.matches("[data-interface-scale]")) {
      if (!app.isResizableLayout()) {
        return;
      }
      state.settings.interfaceScale = app.clamp(Number(target.value), 0.8, 1.8);
      app.resizeClient();
      app.renderPanel();
      return;
    }

    if (target.matches("[data-interface-scaling-mode]")) {
      const nextMode = target.value;
      if (nextMode && constants.SCALING_MODE_VALUES.has(nextMode)) {
        state.settings.interfaceScalingMode = nextMode;
        app.applyInterfaceScalingMode();
        app.resizeThreeViewport();
        app.drawMinimap();
        app.renderPanel();
      }
      return;
    }

    if (target.matches("[data-combat-style]")) {
      state.stats.combatStyle = target.value;
      app.renderPanel();
      return;
    }

    if (target.matches("[data-sailing-preset]")) {
      state.sailing.preset = target.value;
      app.renderPanel();
      return;
    }

    if (target.matches("[data-setting-range]")) {
      const key = target.getAttribute("data-setting-range");
      if (key && key in state.settings) {
        state.settings[key] = Number(target.value);
        app.renderPanel();
      }
      return;
    }

    if (target.matches("[data-setting-check]")) {
      const key = target.getAttribute("data-setting-check");
      if (key && key in state.settings) {
        state.settings[key] = Boolean(target.checked);
        app.renderPanel();
      }
      return;
    }

    if (target.matches("[data-music-mode]")) {
      state.music.mode = target.value;
      app.renderPanel();
    }
  }

  function onDocumentContextMenu(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const itemSlot = target.closest("[data-item-index]");
    if (itemSlot instanceof HTMLElement) {
      event.preventDefault();
      const index = Number(itemSlot.dataset.itemIndex);
      const item = state.inventory[index];
      if (!item) {
        return;
      }
      app.openContextMenu(
        event.clientX,
        event.clientY,
        `Choose Option: ${item.name}`,
        [
          { label: `Use ${item.name}`, action: "use-item" },
          { label: `Drop ${item.name}`, action: "drop-item" },
          { label: `Examine ${item.name}`, action: "examine-item" },
          { label: "Cancel", action: "cancel" },
        ],
        { type: "inventory", index },
      );
      return;
    }

    const inViewport = target.closest("#viewport");
    if (inViewport instanceof HTMLElement) {
      event.preventDefault();
      app.openContextMenu(
        event.clientX,
        event.clientY,
        "Choose Option",
        [
          { label: "Walk here", action: "walk", className: "walk" },
          { label: `Attack ${state.stats.targetName}`, action: "attack" },
          { label: `Examine ${state.stats.targetName}`, action: "examine" },
          { label: "Lookup target (Wiki)", action: "wiki" },
          { label: "Cancel", action: "cancel" },
        ],
        { type: "viewport" },
      );
      return;
    }

    if (target.closest("#context-menu")) {
      event.preventDefault();
      return;
    }

    app.closeContextMenu();
  }

  function onMinimapClick(event) {
    const rect = refs.minimap.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    app.setTarget(x, y);
    app.pushChat("Game", `You click the minimap at ${Math.round(x)}, ${Math.round(y)}.`);
  }

  return {
    bindEvents,
    onDocumentClick,
    onDocumentChange,
    onDocumentContextMenu,
    onMinimapClick,
  };
}
