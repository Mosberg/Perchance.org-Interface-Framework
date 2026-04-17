export function createActionModule(app) {
  const { state, refs } = app;
  const { clamp } = app;

  function executeAction(action) {
    switch (action) {
      case "send-chat":
        app.sendChat();
        break;
      case "walk-here":
        refs.hintLabel.textContent = "Walking";
        app.pushChat("Game", `You walk toward ${state.stats.targetName}.`);
        break;
      case "attack-target":
        app.pushChat("Game", `You attack ${state.stats.targetName}.`);
        if (state.stats.spec >= 10) {
          state.stats.spec = clamp(state.stats.spec - 10, 0, 100);
        }
        app.renderOrbs();
        app.notify("warn", "Combat engaged.");
        break;
      case "examine-target":
        app.pushChat("Game", `${state.stats.targetName}: Looks alert and ready.`);
        app.notify("info", `Examined ${state.stats.targetName}.`);
        break;
      case "toggle-choose-option": {
        if (state.ui.contextOpen) {
          app.closeContextMenu();
        } else {
          const rect = refs.viewport.getBoundingClientRect();
          app.openContextMenu(
            rect.left + 40,
            rect.top + 46,
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
        }
        break;
      }
      case "reset-compass":
        app.resetCameraToNorth();
        app.notify("info", "Compass reset.");
        break;
      case "orb-hp":
        app.notify("info", `HP ${state.stats.hp}/${state.stats.maxHp}`);
        break;
      case "toggle-quick-prayer":
        state.stats.quickPrayer = !state.stats.quickPrayer;
        app.notify(
          "info",
          `Quick prayer ${state.stats.quickPrayer ? "enabled" : "disabled"}.`,
        );
        app.renderOrbs();
        break;
      case "toggle-run":
        state.stats.running = !state.stats.running;
        app.notify("info", state.stats.running ? "Run enabled." : "Run disabled.");
        app.renderOrbs();
        break;
      case "use-special":
        if (state.stats.spec < 50) {
          app.notify("warn", "Not enough special energy.");
          return;
        }
        state.stats.spec = clamp(state.stats.spec - 50, 0, 100);
        app.pushChat("Game", "Special attack unleashed.");
        app.notify("success", "Special attack activated.");
        app.renderOrbs();
        break;
      case "open-activity-adviser":
        app.notify("info", "Activity Adviser opened.");
        break;
      case "open-world-map":
        app.notify("info", "World Map opened.");
        break;
      case "open-wiki-lookup":
        app.notify("info", "Wiki lookup opened.");
        break;
      case "open-settings":
        state.ui.activeGroup = "bottom";
        state.ui.activeBottom = "settings";
        app.renderTabs();
        app.renderPanel();
        break;
      default:
        break;
    }
  }

  return {
    executeAction,
  };
}
