export function createPanelRenderers(app) {
  const { state, constants } = app;
  const { escapeHtml, titleCase, formatCoins, formatDuration, clamp } = app;

  function kv(key, value) {
    return `<div class="kv"><b>${escapeHtml(key)}</b><span>${escapeHtml(value)}</span></div>`;
  }

  function meter(label, value, modeClass) {
    const normalized = clamp(Math.round(value), 0, 100);
    return `<div class="module"><div class="row"><span>${escapeHtml(label)}</span><span class="badge">${normalized}%</span></div><div class="meter ${modeClass}"><span style="width:${normalized}%"></span></div></div>`;
  }

  function renderCombatPanel() {
    const styles = ["Accurate", "Aggressive", "Defensive", "Controlled"];
    return `
      <section class="module">
        <h3>Combat Setup</h3>
        <div class="kv-grid">
          ${kv("Target", state.stats.targetName)}
          ${kv("Style", state.stats.combatStyle)}
          ${kv("Auto-retaliate", state.stats.autoRetaliate ? "On" : "Off")}
          ${kv("Special", `${state.stats.spec}%`)}
        </div>

        <label>
          Attack style
          <select data-combat-style>
            ${styles
              .map(
                (style) =>
                  `<option value="${style}" ${style === state.stats.combatStyle ? "selected" : ""}>${style}</option>`,
              )
              .join("")}
          </select>
        </label>

        ${meter("Special energy", state.stats.spec, "spec")}
      </section>
    `;
  }

  function renderSkillsPanel() {
    const skills = [
      ["Attack", 82],
      ["Strength", 89],
      ["Defence", 78],
      ["Ranged", 87],
      ["Prayer", 70],
      ["Magic", 85],
      ["Runecraft", 62],
      ["Slayer", 78],
      ["Agility", 71],
      ["Fishing", 86],
    ];

    return `
      <section class="module">
        <h3>Skills</h3>
        <div class="row-list">
          ${skills
            .map(
              ([name, level]) =>
                `<div class="row"><span>${name}</span><span class="badge">${level}</span></div>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderQuestPanel() {
    return `
      <section class="module">
        <h3>Quest List</h3>
        <div class="kv-grid">
          ${kv("Completed", String(state.quests.completed))}
          ${kv("In Progress", String(state.quests.inProgress))}
          ${kv("Total", String(state.quests.total))}
          ${kv("Quest Points", String(state.progression.questPoints))}
        </div>

        <div class="row-list">
          ${state.quests.highlighted
            .map(
              (quest) =>
                `<div class="row"><span>${escapeHtml(quest)}</span><span class="badge warn">Active</span></div>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderInventoryPanel() {
    return `
      <section class="module">
        <h3>Inventory</h3>
        <div class="inventory-grid">
          ${state.inventory
            .map((item, index) => {
              if (!item) {
                return `<button type="button" class="slot empty" data-item-index="${index}"><span class="name">Empty</span><span class="qty">-</span></button>`;
              }
              const active = state.ui.selectedItemIndex === index ? "active" : "";
              return `<button type="button" class="slot ${active}" data-item-index="${index}"><span class="name">${escapeHtml(item.name)}</span><span class="qty">x${item.qty}</span></button>`;
            })
            .join("")}
        </div>
        ${renderSelectedItemInfo()}
      </section>
    `;
  }

  function renderSelectedItemInfo() {
    const index = state.ui.selectedItemIndex;
    if (index == null || !state.inventory[index]) {
      return `<div class="row"><span>No item selected</span><span class="badge">Select slot</span></div>`;
    }

    const item = state.inventory[index];
    const unitPrice = state.prices[item.name] || 0;
    const total = unitPrice * item.qty;

    return `
      <div class="row-list">
        <div class="row"><span>Selected</span><span class="badge">${escapeHtml(item.name)}</span></div>
        <div class="row"><span>Quantity</span><span class="badge">${item.qty}</span></div>
        <div class="row"><span>Guide value</span><span class="badge warn">${formatCoins(total)} gp</span></div>
      </div>
    `;
  }

  function renderEquipmentPanel() {
    return `
      <section class="module">
        <h3>Worn Equipment</h3>
        <div class="row-list">
          ${Object.entries(state.equipment)
            .map(
              ([slot, value]) =>
                `<div class="row"><span>${titleCase(slot)}</span><span class="badge">${escapeHtml(value)}</span></div>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderPrayerPanel() {
    return `
      <section class="module">
        <h3>Prayer</h3>
        ${meter("Prayer points", state.stats.prayer, "prayer")}
        <div class="row-list">
          ${state.prayers
            .map((prayer) => {
              const active = prayer === state.ui.selectedPrayer;
              return `<button type="button" class="row" data-prayer-toggle="${escapeHtml(prayer)}"><span>${escapeHtml(prayer)}</span><span class="badge ${active ? "ok" : "warn"}">${active ? "Active" : "Toggle"}</span></button>`;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderMagicPanel() {
    return `
      <section class="module">
        <h3>Spellbook</h3>
        <div class="row-list">
          ${state.spells
            .map((spell) => {
              const selected = spell === state.ui.selectedSpell;
              return `<button type="button" class="row" data-spell-cast="${escapeHtml(spell)}"><span>${escapeHtml(spell)}</span><span class="badge ${selected ? "ok" : "warn"}">${selected ? "Selected" : "Cast"}</span></button>`;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSailingPanel() {
    const presets = ["Balanced", "Fast", "Safe", "Cargo"];
    return `
      <section class="module">
        <h3>Sailing Options</h3>
        <div class="kv-grid">
          ${kv("Route", state.sailing.route)}
          ${kv("Hull", `${state.sailing.hull}%`)}
          ${kv("Risk", `${state.sailing.risk}%`)}
          ${kv("Wind assist", state.sailing.windAssist ? "On" : "Off")}
        </div>

        <label>
          Speed preset
          <select data-sailing-preset>
            ${presets
              .map(
                (preset) =>
                  `<option value="${preset}" ${preset === state.sailing.preset ? "selected" : ""}>${preset}</option>`,
              )
              .join("")}
          </select>
        </label>

        ${meter("Hull integrity", state.sailing.hull, "run")}
      </section>
    `;
  }

  function renderFriendsPanel() {
    return `
      <section class="module">
        <h3>Friends List</h3>
        <div class="row-list">
          ${state.social.friends
            .map((friend) => {
              const worldLabel = friend.online ? `W${friend.world}` : "Offline";
              const badgeClass = friend.online ? "ok" : "danger";
              return `<div class="row"><span>${escapeHtml(friend.name)}</span><span class="badge ${badgeClass}">${worldLabel}</span><button type="button" data-message-friend="${escapeHtml(friend.name)}">Msg</button></div>`;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderIgnorePanel() {
    return `
      <section class="module">
        <h3>Ignore List</h3>
        <div class="row-list">
          ${state.social.ignores
            .map(
              (name) =>
                `<div class="row"><span>${escapeHtml(name)}</span><span class="badge danger">Ignored</span></div>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderClanPanel() {
    return `
      <section class="module">
        <h3>Clan</h3>
        <div class="kv-grid">
          ${kv("Clan", state.social.clan)}
          ${kv("Channel", state.social.channel)}
          ${kv("Role", state.social.groupingRole)}
          ${kv("Grouping CD", `${state.social.groupingCooldown}s`)}
        </div>
      </section>
    `;
  }

  function renderAccountPanel() {
    return `
      <section class="module">
        <h3>Account Management</h3>
        <div class="kv-grid">
          ${kv("Membership", "Active")}
          ${kv("Authenticator", "Enabled")}
          ${kv("Profile", "Main")}
          ${kv("World", `W${state.runtime.world}`)}
        </div>
      </section>
    `;
  }

  function renderLogoutPanel() {
    const session = Math.floor((Date.now() - state.runtime.startedAt) / 1000);
    return `
      <section class="module">
        <h3>Logout</h3>
        <div class="row-list">
          <div class="row"><span>Current world</span><span class="badge">W${state.runtime.world}</span></div>
          <div class="row"><span>Session time</span><span class="badge">${formatDuration(session)}</span></div>
        </div>
        <button type="button" data-action="open-settings">Open settings before logout</button>
      </section>
    `;
  }

  function renderSettingsPanel() {
    const isResizable = state.settings.gameClientLayout !== constants.LAYOUT_FIXED_CLASSIC;
    const scalePercent = Math.round(state.settings.interfaceScale * 100);

    return `
      <section class="module">
        <h3>Settings</h3>

        <section class="module">
          <h3>Game client layout</h3>
          <div class="setting-stack">
            ${renderLayoutOption(
              constants.LAYOUT_FIXED_CLASSIC,
              "Fixed - Classic layout - toggles the game client to be a fixed size of 765x503 pixels.",
            )}
            ${renderLayoutOption(
              constants.LAYOUT_RESIZABLE_CLASSIC,
              "Resizable - Classic layout - toggles the game client to fill the window, but has the side-panels in the classic format.",
            )}
            ${renderLayoutOption(
              constants.LAYOUT_RESIZABLE_MODERN,
              "Resizable - Modern layout - toggles the game client to fill the window, but has the side-panels attached to the bottom of the window.",
            )}
          </div>
        </section>

        <section class="module">
          <h3>Interface scaling</h3>
          <label>
            Scale ${scalePercent}%
            <input type="range" min="0.8" max="1.8" step="0.05" value="${state.settings.interfaceScale.toFixed(2)}" data-interface-scale ${
              isResizable ? "" : "disabled"
            } />
          </label>
          <p class="setting-note">Suitable for large display monitors where the default interface size may appear small. Can only be changed in resizable mode.</p>
        </section>

        <section class="module">
          <h3>Interface scaling mode</h3>
          <label>
            Scaling quality
            <select data-interface-scaling-mode>
              <option value="${constants.SCALING_NEAREST_NEIGHBOUR}" ${state.settings.interfaceScalingMode === constants.SCALING_NEAREST_NEIGHBOUR ? "selected" : ""}>Nearest-Neighbour</option>
              <option value="${constants.SCALING_LINEAR}" ${state.settings.interfaceScalingMode === constants.SCALING_LINEAR ? "selected" : ""}>Linear</option>
              <option value="${constants.SCALING_BICUBIC}" ${state.settings.interfaceScalingMode === constants.SCALING_BICUBIC ? "selected" : ""}>Bicubic</option>
            </select>
          </label>
        </section>

        <label>
          Brightness ${state.settings.brightness}
          <input type="range" min="0" max="100" value="${state.settings.brightness}" data-setting-range="brightness" />
        </label>

        <label>
          Music volume ${state.settings.musicVolume}
          <input type="range" min="0" max="100" value="${state.settings.musicVolume}" data-setting-range="musicVolume" />
        </label>

        <label>
          Effects volume ${state.settings.effectVolume}
          <input type="range" min="0" max="100" value="${state.settings.effectVolume}" data-setting-range="effectVolume" />
        </label>

        <div class="row-list">
          ${renderSettingCheckbox("showGroundItems", "Show ground items")}
          ${renderSettingCheckbox("profanityFilter", "Profanity filter")}
          ${renderSettingCheckbox("roofHiding", "Roof hiding")}
          ${renderSettingCheckbox("chatTimestamps", "Chat timestamps")}
        </div>
      </section>
    `;
  }

  function renderLayoutOption(layoutId, label) {
    return `
      <label class="layout-option">
        <input type="radio" name="game-layout" value="${layoutId}" data-client-layout="${layoutId}" ${
          state.settings.gameClientLayout === layoutId ? "checked" : ""
        } />
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderSettingCheckbox(key, label) {
    return `
      <label class="row">
        <span>${label}</span>
        <input type="checkbox" data-setting-check="${key}" ${state.settings[key] ? "checked" : ""} />
      </label>
    `;
  }

  function renderEmotesPanel() {
    const emotes = [
      "Yes",
      "No",
      "Bow",
      "Cheer",
      "Dance",
      "Wave",
      "Shrug",
      "Beckon",
    ];
    return `
      <section class="module">
        <h3>Emotes</h3>
        <div class="kv-grid">
          ${emotes.map((emote) => `<button type="button">${emote}</button>`).join("")}
        </div>
      </section>
    `;
  }

  function renderMusicPanel() {
    const modes = ["Shuffle", "Repeat", "Area", "Manual"];
    return `
      <section class="module">
        <h3>Music Player</h3>
        <div class="kv-grid">
          ${kv("Now playing", state.music.nowPlaying)}
          ${kv("Unlocked", `${state.music.unlocked} tracks`)}
        </div>

        <label>
          Mode
          <select data-music-mode>
            ${modes
              .map(
                (mode) =>
                  `<option value="${mode}" ${mode === state.music.mode ? "selected" : ""}>${mode}</option>`,
              )
              .join("")}
          </select>
        </label>
      </section>
    `;
  }

  function renderFallbackPanel() {
    return `
      <section class="module">
        <h3>Panel</h3>
        <p>This tab does not have content yet.</p>
      </section>
    `;
  }

  const topPanelRenderers = {
    combat: renderCombatPanel,
    skills: renderSkillsPanel,
    quests: renderQuestPanel,
    inventory: renderInventoryPanel,
    equipment: renderEquipmentPanel,
    prayer: renderPrayerPanel,
    magic: renderMagicPanel,
    sailing: renderSailingPanel,
  };

  const bottomPanelRenderers = {
    friends: renderFriendsPanel,
    ignore: renderIgnorePanel,
    clan: renderClanPanel,
    account: renderAccountPanel,
    logout: renderLogoutPanel,
    settings: renderSettingsPanel,
    emotes: renderEmotesPanel,
    music: renderMusicPanel,
  };

  return {
    topPanelRenderers,
    bottomPanelRenderers,
    renderFallbackPanel,
  };
}
