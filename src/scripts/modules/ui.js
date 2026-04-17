export function createUiModule(app) {
  const { state, refs, constants } = app;
  const { TOP_TABS, BOTTOM_TABS } = constants;
  const { escapeHtml, clamp } = app;

  function renderTabs() {
    refs.topTabs.innerHTML = TOP_TABS.map((tab) => {
      const active = state.ui.activeGroup === "top" && state.ui.activeTop === tab.id;
      return `<button type="button" class="${active ? "active" : ""}" data-tab-group="top" data-tab-id="${tab.id}" title="${escapeHtml(tab.label)}">${escapeHtml(tab.short)}</button>`;
    }).join("");

    refs.bottomTabs.innerHTML = BOTTOM_TABS.map((tab) => {
      const active =
        state.ui.activeGroup === "bottom" && state.ui.activeBottom === tab.id;
      return `<button type="button" class="${active ? "active" : ""}" data-tab-group="bottom" data-tab-id="${tab.id}" title="${escapeHtml(tab.label)}">${escapeHtml(tab.short)}</button>`;
    }).join("");
  }

  function renderPanel() {
    const isTop = state.ui.activeGroup === "top";
    const tabId = isTop ? state.ui.activeTop : state.ui.activeBottom;
    const tabDef = (isTop ? TOP_TABS : BOTTOM_TABS).find((tab) => tab.id === tabId);

    refs.panelTitle.textContent = tabDef ? tabDef.label : "Panel";
    refs.panelSubtitle.textContent = isTop ? "Top Panel" : "Bottom Panel";

    const rendererMap = isTop
      ? app.panelRenderers.topPanelRenderers
      : app.panelRenderers.bottomPanelRenderers;
    const renderer = rendererMap[tabId];
    refs.panelContent.innerHTML = renderer
      ? renderer()
      : app.panelRenderers.renderFallbackPanel();
  }

  function renderChatFilters() {
    Array.from(refs.chatFilters.querySelectorAll("[data-channel]")).forEach(
      (button) => {
        const active = button.getAttribute("data-channel") === state.ui.chatChannel;
        button.classList.toggle("active", active);
      },
    );

    refs.chatChannelLabel.textContent = state.ui.chatChannel;
  }

  function renderChatLog() {
    refs.chatLog.innerHTML = state.chat.entries
      .filter((entry) => {
        return (
          state.ui.chatChannel === "All" ||
          entry.channel === state.ui.chatChannel ||
          entry.channel === "System"
        );
      })
      .slice(-80)
      .map(
        (entry) =>
          `<div class="chat-line"><b>${escapeHtml(entry.channel)}:</b> ${escapeHtml(entry.text)}</div>`,
      )
      .join("");

    refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
  }

  function setOrb(orbElement, valueElement, value, maxValue, valueText) {
    const fill = orbElement.querySelector(".orb-fill");
    if (!(fill instanceof HTMLElement)) {
      return;
    }
    const percent = clamp(Math.round((value / maxValue) * 100), 0, 100);
    fill.style.height = `${percent}%`;
    valueElement.textContent = valueText;
  }

  function renderOrbs() {
    setOrb(
      refs.orbHp,
      refs.orbHpValue,
      state.stats.hp,
      state.stats.maxHp,
      String(state.stats.hp),
    );
    setOrb(
      refs.orbPrayer,
      refs.orbPrayerValue,
      state.stats.prayer,
      state.stats.maxPrayer,
      String(state.stats.prayer),
    );
    setOrb(refs.orbRun, refs.orbRunValue, state.stats.run, 100, String(state.stats.run));
    setOrb(
      refs.orbSpec,
      refs.orbSpecValue,
      state.stats.spec,
      100,
      String(state.stats.spec),
    );

    refs.orbPrayer.classList.toggle("active", state.stats.quickPrayer);
    refs.orbRun.classList.toggle("active", state.stats.running);
  }

  function updateHeading() {
    refs.headingReadout.textContent = `Heading ${String(Math.round(state.runtime.heading)).padStart(3, "0")}`;
  }

  return {
    renderTabs,
    renderPanel,
    renderChatFilters,
    renderChatLog,
    renderOrbs,
    setOrb,
    updateHeading,
  };
}
