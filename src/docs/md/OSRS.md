# OSRS.md — Old School RuneScape Interface Reference

A structured, implementation‑oriented overview of Old School RuneScape’s interface, focused on how each part behaves and how you might model it in a custom client or UI framework. For full canonical details, always defer to the Old School RuneScape Wiki’s **[Interface](https://oldschool.runescape.wiki/w/Interface)** page.

---

## 1. Global interface architecture

The OSRS interface is a fixed‑screen HUD composed of:

- **Viewport:** 3D/2D game world rendering.
- **Minimap:** Navigation, data orbs, compass, wiki lookup.
- **Control panel:** Right‑side tabbed panel (top + bottom rows).
- **Chat interface:** Bottom chat panel with filters and input.
- **Context menus:** “Choose Option” radial list for actions.
- **System overlays:** Dialogs, trading, welcome screen, debug, etc.

From an implementation perspective, you can think of this as:

- **Layouts & containers:** Root HUD, side panels, bottom bar.
- **Panels & pages:** Each tab (Combat, Skills, Inventory, etc.) is a “page” in a shared container.
- **States & modes:** Active tab, active chat filter, minimap zoom, etc.
- **Events & handlers:** Clicks, hovers, keybinds, context‑menu triggers.
- **Renderers:** World renderer, UI renderer, overlays.

---

## 2. Minimap and data orbs

### 2.1 Minimap

**Wiki:** <https://oldschool.runescape.wiki/w/Minimap>

**Role:** Shows a top‑down slice of the world around the player, with:

- **Dots:** Players, NPCs, items, objects (color‑coded).
- **Icons:** Banks, altars, quest markers, etc.
- **Click‑to‑walk:** Clicking on the minimap issues movement commands.

**Implementation concepts:**

- **Canvas / renderer:** Circular mask, world‑to‑minimap coordinate transform.
- **States:** Player position, camera angle, zoom level.
- **Events:** Click → pathfinding request; hover → tooltip or highlight.
- **Layers:** Background terrain, icons, dots, overlays (e.g., activity indicators).

### 2.2 Compass

**Wiki:** <https://oldschool.runescape.wiki/w/Compass>

- Shows facing direction (north reference).
- Clicking can reset camera orientation.
- Implementation: a **rotated sprite** or **shader‑driven** compass, bound to camera yaw.

### 2.3 Data orbs (Hitpoints, Prayer, Run, Special)

**Wiki:** <https://oldschool.runescape.wiki/w/Minimap> (data orbs section)

Orbs show:

- **Hitpoints:** Current HP, color changes for poison/venom/disease.
- **Prayer:** Prayer points, quick‑prayer toggle.
- **Run energy:** Percentage, click to toggle run/walk.
- **Special attack:** Special energy, click to arm special attack.

Implementation notes:

- **States:** Current value, max value, status flags (poisoned, venomed, diseased).
- **Animations:** Pulses, color transitions, cooldown arcs.
- **Events:** Click → toggle (run, quick prayers, special attack).
- **Tooltips:** Hover to show numeric values and descriptions.

### 2.4 Wiki lookup

**Wiki:** <https://oldschool.runescape.wiki/w/Wiki_lookup>

- Right‑click options: **Lookup‑entity** and **Search**.
- Implementation: a **command adapter** that maps in‑game entities to external URLs, plus a **search dialog**.

---

## 3. Control panel (top row)

**Wiki:** <https://oldschool.runescape.wiki/w/Interface#Control_Panel>

The control panel is the right‑side tabbed interface. Each tab is a **mode** with its own layout, data, and interactions.

### 3.1 Combat Options

**Wiki:** <https://oldschool.runescape.wiki/w/Combat_Options>

- **Abilities / actions:** Attack styles, Auto‑retaliate toggle, Special attack button.
- **States:** Selected style, auto‑retaliate on/off, special energy.
- **UI:** Buttons, toggles, special bar, weapon icon.
- **Logic:** Style selection affects XP distribution; special attack triggers weapon‑specific behavior.

### 3.2 Sailing Options

**Wiki:** <https://oldschool.runescape.wiki/w/Sailing_Options>

- Shows boat status, crew, routes, and sailing actions.
- Implementation: data‑driven panel with **ship entity attributes**, **route lists**, and **action buttons**.

### 3.3 Skills / Character Summary

- **Skills wiki:** <https://oldschool.runescape.wiki/w/Skills>
- **Character Summary:** <https://oldschool.runescape.wiki/w/Character_Summary>

Key concepts:

- **Datasets:** Skill levels, XP, total level, boosts/debuffs.
- **Layouts:** Grid of icons with labels and tooltips.
- **Interactions:** Click skill → open detailed panel (perks, milestones).

### 3.4 Quest List / Achievement Diaries / Adventure Paths

- **Quest List:** <https://oldschool.runescape.wiki/w/Quest_List>
- **Achievement Diary:** <https://oldschool.runescape.wiki/w/Achievement_Diary>
- **Adventure Paths:** <https://oldschool.runescape.wiki/w/Adventure_Paths>

Implementation:

- **Lists & filters:** Completed / in progress / not started.
- **States:** Quest status, diary tier completion, path progression.
- **Dialogs:** Clicking entries opens detail views with requirements and rewards.

### 3.5 Inventory

**Wiki:** <https://oldschool.runescape.wiki/w/Inventory>

- 28 slots, each holding an item stack.
- **Behaviors:** Use, Drop, Examine, Equip, Eat, etc.
- **Context menu:** “Choose Option” for each item.
- **Tooltips:** Item name, quantity, value, effects.

Implementation:

- **Grid component:** Slots as nodes with item references.
- **Hitboxes:** Per‑slot click areas.
- **Events:** Left‑click default action; right‑click context menu.
- **Storage:** Backed by an inventory data structure (array/list).

### 3.6 Worn Equipment / Equipment Stats

- **Worn Equipment:** <https://oldschool.runescape.wiki/w/Worn_Equipment>
- **Equipment Stats:** <https://oldschool.runescape.wiki/w/Equipment_Stats>

Concepts:

- **Slots:** Head, cape, neck, weapon, body, shield, legs, hands, feet, ring, ammo.
- **Stats:** Attack, defence, strength, prayer, bonuses vs. styles.
- **Flows:** Equip/unequip, compare stats, show deltas.

### 3.7 Items Kept on Death / Guide Prices / Call follower

- **Items Kept on Death:** <https://oldschool.runescape.wiki/w/Items_Kept_on_Death>
- **Interface:** <https://oldschool.runescape.wiki/w/Items_Kept_on_Death_(Interface)>
- **Guide Prices:** <https://oldschool.runescape.wiki/w/Guide_Prices>
- **Call follower:** <https://oldschool.runescape.wiki/w/Call_follower>

Implementation:

- **Simulated state:** Death scenario preview, item retention rules.
- **Price datasets:** Item → value mapping, total stack values.
- **Follower actions:** Summon/dismiss, teleport, special abilities.

### 3.8 Prayer / Spellbook

- **Prayer:** <https://oldschool.runescape.wiki/w/Prayer>
- **Spellbook:** <https://oldschool.runescape.wiki/w/Spellbook>

Concepts:

- **Icons:** Each prayer/spell is a sprite with a tooltip.
- **States:** Locked/unlocked, active/inactive, cooldowns, requirements.
- **Mechanics:** Prayer drain, spell runes, level requirements.
- **UI behaviors:** Toggle with glow, cooldown overlays, disabled states.

---

## 4. Control panel (bottom row)

### 4.1 Friends List / Ignore List

- **Friends List:** <https://oldschool.runescape.wiki/w/Friends_List>
- **Ignore List:** <https://oldschool.runescape.wiki/w/Ignore_List>

Implementation:

- **Datasets:** Player identifiers, online status, world, notes.
- **Actions:** Add, remove, message, join chat.
- **States:** Online/offline, privacy modes.

### 4.2 Account Management

**Wiki:** <https://oldschool.runescape.wiki/w/Account_Management>

Subsections:

- **Account:** Settings, security, membership.
- **Community:** Social links, news, events.
- **Links:** External resources.

Implementation: a **multi‑page settings hub** with forms, toggles, and external link handlers.

### 4.3 Chat‑channel / Clans / Grouping

- **Chat‑channel:** <https://oldschool.runescape.wiki/w/Chat-channel>
- **Clan:** <https://oldschool.runescape.wiki/w/Clan>
- **Grouping:** <https://oldschool.runescape.wiki/w/Grouping>

Concepts:

- **Channels:** Friends chat, clan chat, guest chat, group finder.
- **Queues & sessions:** Joining/leaving channels, group matchmaking.
- **Messages:** Routed via channel identifiers and permissions.

### 4.4 Logout / World switching

- **Logout button:** <https://oldschool.runescape.wiki/w/Logout_button>
- **World switching:** <https://oldschool.runescape.wiki/w/World_switching>

Implementation:

- **Dialogs:** Confirm logout, world list popup.
- **States:** Current world, target world, cooldowns.
- **Flows:** Save state → disconnect → reconnect.

### 4.5 Settings / Emotes / Music player

- **Settings:** <https://oldschool.runescape.wiki/w/Settings>
- **Emotes:** <https://oldschool.runescape.wiki/w/Emotes>
- **Music player:** <https://oldschool.runescape.wiki/w/Music_player>

Concepts:

- **Settings:** Graphics, audio, controls, interface toggles (data orbs, roofs, etc.).
- **Emotes:** Unlockable actions, icons, animation triggers.
- **Music:** Track list, unlock states, playback controls, area‑based auto‑play.

---

## 5. Chat interface and context menus

### 5.1 Chat Interface

**Wiki:** <https://oldschool.runescape.wiki/w/Chat_Interface>

Features:

- **Filters:** All, Game, Public, Private, Channel, Clan, Trade/Group.
- **Input modes:** Public, private, channel, clan, guest, command line.
- **Effects:** Color codes, text effects, badges/icons.
- **Commands:** `::wiki`, emotes, client commands.

Implementation:

- **Streams:** Message stream with type tags (game, public, private, etc.).
- **Selectors:** Filter buttons that toggle visibility of message subsets.
- **Input context:** Current chat mode, prefix shortcuts (`/`, `//`, `///`).
- **Log:** Scrollback buffer, optional logging to file.

### 5.2 Choose Option (context menu)

**Wiki:** <https://oldschool.runescape.wiki/w/Choose_Option>

Includes actions like:

- **Walk here:** <https://oldschool.runescape.wiki/w/Walk_here>
- **Examine:** <https://oldschool.runescape.wiki/w/Examine>

Implementation:

- **Hit detection:** Determine clicked entity (tile, NPC, object, item).
- **Menu builder:** Generate list of actions based on entity type and state.
- **Overlay:** Popup menu near cursor, keyboard navigation optional.
- **Handlers:** Each option maps to a game command (use, talk‑to, trade, etc.).

---

## 6. Other interfaces and overlays

### 6.1 Debug Console

**Wiki:** <https://oldschool.runescape.wiki/w/Debug_Console>

- Developer / diagnostic output.
- Implementation: log window, filters, command input.

### 6.2 Font

**Wiki:** <https://oldschool.runescape.wiki/w/Font>

- OSRS uses custom bitmap fonts for UI and chat.
- In custom clients, you approximate with pixel fonts and **text rendering pipelines**.

### 6.3 Game controls / Main Menu

- **Game controls:** <https://oldschool.runescape.wiki/w/Game_controls>
- **Main Menu:** <https://oldschool.runescape.wiki/w/Main_Menu>

Concepts:

- **Keybindings:** Movement, camera, interaction, hotkeys.
- **Front‑end:** Login, world selection, settings, news.

### 6.4 Trading interface / Welcome Screen

- **Trading:** <https://oldschool.runescape.wiki/w/Trading>
- **Welcome Screen:** <https://oldschool.runescape.wiki/w/Welcome_Screen>

Implementation:

- **Dialogs:** Multi‑step confirmation, offer grids, accept/decline.
- **States:** Pending trade, accepted, modified, cancelled.
- **Messages:** System notifications, login messages, news banners.

---

## 7. Interface concept taxonomy (for implementation)

Below is a compact mapping of the long concept list you gave into how it typically manifests in an OSRS‑style interface implementation:

- **Abilities, actions, mechanics:** Combat styles, prayers, spells, emotes, context‑menu options.
- **Adapters, APIs, services, protocols:** Wiki lookup, world list, chat routing, server commands.
- **Add‑ons, modules, plugins, frameworks:** Client plugins (e.g., RuneLite‑style), UI modules for each tab.
- **Algorithms, heuristics, logic:** Pathfinding, menu prioritization, filter rules, cooldown handling.
- **Animations, transitions, effects:** Orb pulses, button hover, spell cooldown overlays, emote animations.
- **Architecture, systems, pipelines:** HUD layout system, event bus, rendering pipeline, networking pipeline.
- **Assets, sprites, textures, shaders:** Icons, fonts, minimap tiles, spell/prayer sprites, item sprites.
- **Attributes, stats, properties, fields:** Skill levels, bonuses, HP, prayer points, run energy, special energy.
- **Behaviors, states, lifecycles:** Active tab, toggled prayers, chat mode, minimap zoom, overlays open/closed.
- **Buffers, caches, storage:** Chat log buffer, minimap tile cache, item definition cache.
- **Buttons, controls, toggles, checkboxes:** Tab buttons, filter buttons, settings toggles, auto‑retaliate, run.
- **Canvases, views, windows, overlays:** Game viewport, minimap, dialogs, trading window, welcome screen.
- **Channels, queues, streams:** Chat channels, message queues, event streams.
- **Components, widgets, panels, containers:** Inventory grid, skill grid, orbs, tabs, chat panel, minimap.
- **Configs, defaults, presets:** Graphics settings, keybinds, interface layout presets.
- **Contexts, sessions, profiles:** Account session, world session, chat context, player profile.
- **Cooldowns, timers, thresholds:** Special attack, spell cooldowns, logout timer, run energy thresholds.
- **Datasets, records, dictionaries:** Item definitions, NPC definitions, quest data, diary tasks.
- **Dependencies, manifests, packages:** Client libraries, plugin manifests, asset bundles.
- **Dialogs, popups, menus:** Logout dialog, world switcher, trade window, context menus.
- **Events, handlers, triggers:** Clicks, hovers, key presses, server messages, state changes.
- **Forms, inputs, fields:** Login form, search fields, settings sliders, text inputs.
- **Hitboxes, HUD, layouts, layers:** Click regions, overlay ordering, z‑indexing.
- **Identifiers, keys, indexes:** Item IDs, NPC IDs, object IDs, world IDs, channel IDs.
- **Jobs, tasks, workflows:** Periodic updates (orbs, minimap), async loading, matchmaking flows.
- **Labels, messages, notifications:** Chat lines, system messages, error toasts.
- **Loaders, managers:** Asset loader, UI manager, state manager, plugin manager.
- **Metrics, stats, logs:** FPS, ping, XP/hour, debug logs.
- **Modes, options:** Fixed/resizable, different spellbooks, chat modes, game modes.
- **Nodes, objects, entities:** UI nodes, game entities (players, NPCs, items).
- **Operations, processes:** Login, logout, trade, bank, teleport, world hop.
- **Overlays, routes, pages:** Interface overlays, navigation between panels and menus.
- **Schemas, templates:** Data schemas for items/quests, UI templates for panels.
- **Scripts, selectors, utilities:** UI scripts, DOM selectors, helper utilities.
- **Sessions, storage:** Local settings, persistent profiles, cookies/config files.
- **Shaders, renderers:** World rendering, minimap rendering, post‑processing.
- **Spawners, states, steps:** Entity spawning, tutorial steps, quest stages.
- **Structures, systems:** Inventory system, combat system, chat system, UI system.
- **Tooltips, widgets, UX:** Hover info, contextual hints, consistent interaction patterns.
- **Variables, parameters:** Configurable values for animations, timings, thresholds.

You can treat each OSRS interface element as a **composition** of these concepts: a panel is a container of components; components bind to data and states; events drive behaviors; renderers and assets provide the visual layer; and workflows tie everything into a coherent UX.

---
