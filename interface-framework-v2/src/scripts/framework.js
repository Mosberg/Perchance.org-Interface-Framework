(function attachInterfaceFrameworkV2(global) {
	"use strict";

	var VERSION = "2.0.0";

	var TOP_TABS = [
		{ id: "combat", short: "CB", label: "Combat" },
		{ id: "skills", short: "SK", label: "Skills" },
		{ id: "quests", short: "QP", label: "Quests" },
		{ id: "inventory", short: "INV", label: "Inventory" },
		{ id: "equipment", short: "EQ", label: "Equipment" },
		{ id: "prayer", short: "PR", label: "Prayer" },
		{ id: "magic", short: "MG", label: "Magic" },
		{ id: "world", short: "WR", label: "World" },
	];

	var BOTTOM_TABS = [
		{ id: "social", short: "FR", label: "Social" },
		{ id: "output", short: "OUT", label: "Output" },
		{ id: "actions", short: "ACT", label: "Actions" },
		{ id: "adapters", short: "API", label: "Adapters" },
		{ id: "settings", short: "SET", label: "Settings" },
		{ id: "assets", short: "AST", label: "Assets" },
		{ id: "docs", short: "DOC", label: "Docs" },
		{ id: "history", short: "HIS", label: "History" },
	];

	var DEFAULT_CHANNELS = ["All", "System", "Game", "Public", "Private", "Clan", "Story"];

	var BUILT_IN_ACTIONS = [
		{ id: "walk-here", label: "Walk", tone: "base" },
		{ id: "inspect-target", label: "Inspect", tone: "base" },
		{ id: "refresh-data", label: "Refresh", tone: "ok" },
		{ id: "focus-chat", label: "Chat", tone: "base" },
	];

	function createInterfaceFrameworkV2(options) {
		var opts = isObject(options) ? options : {};
		var mount = resolveMount(opts.mount);

		if (!mount) {
			throw new Error("createInterfaceFrameworkV2: unable to resolve mount element.");
		}

		mount.classList.add("ifw2-host");
		mount.innerHTML = buildTemplate();

		var refs = collectRefs(mount);
		var state = createInitialState(opts);
		var listeners = new Map();
		var adapter = createAdapter(opts.adapter);
		var pollTimer = null;
		var pulseTimer = null;
		var destroyed = false;

		state.adapter.name = adapter.name;
		state.adapter.pollMs = adapter.pollMs;
		state.adapter.status = adapter.pollMs > 0 ? "polling" : "ready";

		var onRootClick = function onRootClick(event) {
			var target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			var tabButton = target.closest("[data-ifw2-tab-id]");
			if (tabButton instanceof HTMLElement) {
				var tabId = tabButton.getAttribute("data-ifw2-tab-id") || "";
				var tabGroup = tabButton.getAttribute("data-ifw2-tab-group") || "top";
				setActiveTab(tabGroup, tabId);
				return;
			}

			var channelButton = target.closest("[data-ifw2-channel]");
			if (channelButton instanceof HTMLElement) {
				var nextChannel = channelButton.getAttribute("data-ifw2-channel") || "All";
				setChatChannel(nextChannel);
				return;
			}

			var actionButton = target.closest("[data-ifw2-action]");
			if (actionButton instanceof HTMLElement) {
				var actionId = actionButton.getAttribute("data-ifw2-action") || "";
				executeAction(actionId, { source: "button" });
				return;
			}

			var cardButton = target.closest("[data-ifw2-card-action]");
			if (cardButton instanceof HTMLElement) {
				var cardAction = cardButton.getAttribute("data-ifw2-card-action") || "";
				executeAction(cardAction, { source: "card" });
			}
		};

		var onChatInputKeyDown = function onChatInputKeyDown(event) {
			if (event.key === "Enter") {
				sendChat();
			}
		};

		var onMinimapClick = function onMinimapClick(event) {
			var rect = refs.minimap.getBoundingClientRect();
			if (!rect.width || !rect.height) {
				return;
			}

			var x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
			var y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);

			state.markers.target.x = x;
			state.markers.target.y = y;
			syncHeadingWithMarkers(state);
			state.meta.status = "Target updated";
			pushFeed("Game", "Target set to " + Math.round(x) + ", " + Math.round(y) + ".");
			renderAll();
			emit("target", { x: x, y: y });
		};

		var onSendChatClick = function onSendChatClick() {
			sendChat();
		};

		refs.shell.addEventListener("click", onRootClick);
		refs.chatInput.addEventListener("keydown", onChatInputKeyDown);
		refs.sendChat.addEventListener("click", onSendChatClick);
		refs.minimap.addEventListener("click", onMinimapClick);

		var api = {
			version: VERSION,
			root: mount,
			getState: getPublicState,
			setData: setData,
			setAdapter: setAdapter,
			setTitle: setTitle,
			setSubtitle: setSubtitle,
			setStatus: setStatus,
			setMode: setMode,
			setCards: setCards,
			setGallery: setGallery,
			setActions: replaceActions,
			addAction: addAction,
			pushFeed: pushFeed,
			execute: executeAction,
			updateStats: updateStats,
			setChatChannel: setChatChannel,
			reset: reset,
			render: renderAll,
			on: on,
			off: off,
			destroy: destroy,
			normalizeInput: normalizeInput,
			createAiCharacterChatSkeleton: createAiCharacterChatSkeleton,
			normalizeRegistryId: normalizeRegistryId,
		};

		renderAll();

		if (opts.initialData != null) {
			setData(opts.initialData, "initial-data");
		}

		if (typeof adapter.load === "function") {
			Promise.resolve()
				.then(function () {
					return adapter.load(api);
				})
				.then(function (payload) {
					if (payload != null) {
						setData(payload, "adapter-load");
					}
				})
				.catch(function (error) {
					pushFeed("System", "Adapter load failed: " + toErrorText(error));
					state.adapter.status = "error";
					renderAll();
				});
		}

		startPolling();
		startPulse();

		function getPublicState() {
			return JSON.parse(JSON.stringify(state));
		}

		function setData(rawInput, sourceName) {
			if (destroyed) {
				return api;
			}

			var transformed = null;
			if (typeof adapter.transform === "function") {
					try {
						transformed = adapter.transform(rawInput, {
							normalizeInput: normalizeInput,
							normalizeRegistryId: normalizeRegistryId,
							createAiCharacterChatSkeleton: createAiCharacterChatSkeleton,
							state: getPublicState(),
						});
					} catch (error) {
						pushFeed("System", "Adapter transform failed: " + toErrorText(error));
						transformed = null;
					}
			}

			var normalized = normalizeInput(transformed != null ? transformed : rawInput);
			applyNormalizedState(state, normalized);

			if (sourceName) {
				state.meta.source = sourceName;
			}

			syncHeadingWithMarkers(state);
			renderAll();
			emit("data", {
				source: sourceName || "set-data",
				input: rawInput,
				normalized: normalized,
			});

			return api;
		}

		function setAdapter(nextAdapter) {
			adapter = createAdapter(nextAdapter);
			state.adapter.name = adapter.name;
			state.adapter.pollMs = adapter.pollMs;
			state.adapter.status = adapter.pollMs > 0 ? "polling" : "ready";
			startPolling();
			renderAll();
			emit("adapter", { name: adapter.name, pollMs: adapter.pollMs });
			return api;
		}

		function setTitle(value) {
			state.meta.title = toText(value, state.meta.title);
			renderAll();
			return api;
		}

		function setSubtitle(value) {
			state.meta.subtitle = toText(value, state.meta.subtitle);
			renderAll();
			return api;
		}

		function setStatus(value) {
			state.meta.status = toText(value, state.meta.status);
			renderAll();
			return api;
		}

		function setMode(value) {
			state.meta.mode = normalizeRegistryId(value || state.meta.mode || "universal");
			renderAll();
			return api;
		}

		function setCards(cards) {
			state.visuals.cards = normalizeCards(cards);
			renderViewport();
			return api;
		}

		function setGallery(gallery) {
			state.visuals.gallery = normalizeGallery(gallery);
			renderPanel();
			return api;
		}

		function replaceActions(actions) {
			state.actions = normalizeActions(actions);
			renderActionBar();
			renderPanel();
			return api;
		}

		function addAction(action) {
			var normalizedActions = normalizeActions([action]);
			if (!normalizedActions.length) {
				return api;
			}

			var next = normalizedActions[0];
			var index = state.actions.findIndex(function (item) {
				return item.id === next.id;
			});

			if (index >= 0) {
				state.actions[index] = next;
			} else {
				state.actions.push(next);
			}

			renderActionBar();
			renderPanel();
			return api;
		}

		function updateStats(nextStats) {
			if (!isObject(nextStats)) {
				return api;
			}

			applyPartialStats(state.stats, nextStats);
			renderOrbs();
			renderPanel();
			return api;
		}

		function setChatChannel(channel) {
			var safeChannel = toText(channel, "All");
			if (state.chat.channels.indexOf(safeChannel) < 0) {
				state.chat.channels.push(safeChannel);
			}
			state.ui.chatChannel = safeChannel;
			renderChatFilters();
			renderChatLog();
			return api;
		}

		function pushFeed(channel, text) {
			var entry = {
				channel: toText(channel, "System"),
				text: toText(text, ""),
				timestamp: Date.now(),
			};

			if (!entry.text) {
				return api;
			}

			if (state.chat.channels.indexOf(entry.channel) < 0) {
				state.chat.channels.push(entry.channel);
			}

			state.chat.entries.push(entry);
			state.chat.entries = state.chat.entries.slice(-220);
			renderChatFilters();
			renderChatLog();
			emit("feed", entry);
			return api;
		}

		function sendChat() {
			var message = refs.chatInput.value.trim();
			if (!message) {
				return;
			}

			refs.chatInput.value = "";

			if (tryRunCommand(message)) {
				return;
			}

			var channel = state.ui.chatChannel === "All" ? "Public" : state.ui.chatChannel;
			pushFeed(channel, message);

			if (typeof adapter.onChat === "function") {
				try {
					var adapterResult = adapter.onChat(message, channel, api);
					if (adapterResult != null) {
						setData(adapterResult, "adapter-chat");
					}
				} catch (error) {
					pushFeed("System", "Adapter chat failed: " + toErrorText(error));
				}
			}

			emit("chat", { channel: channel, text: message });
		}

		function tryRunCommand(message) {
			if (message.indexOf("::") !== 0) {
				return false;
			}

			var body = message.slice(2).trim();
			if (!body) {
				return false;
			}

			if (body === "help") {
				pushFeed("System", "Commands: ::help, ::clear, ::mode <name>, ::status <text>, ::channel <name>, ::action <id>.");
				return true;
			}

			if (body === "clear") {
				state.chat.entries = [];
				pushFeed("System", "Chat log cleared.");
				return true;
			}

			if (body.indexOf("mode ") === 0) {
				setMode(body.slice(5));
				pushFeed("System", "Mode set to " + state.meta.mode + ".");
				return true;
			}

			if (body.indexOf("status ") === 0) {
				setStatus(body.slice(7));
				pushFeed("System", "Status updated.");
				return true;
			}

			if (body.indexOf("channel ") === 0) {
				var nextChannel = body.slice(8).trim();
				setChatChannel(nextChannel || "All");
				pushFeed("System", "Channel switched to " + state.ui.chatChannel + ".");
				return true;
			}

			if (body.indexOf("action ") === 0) {
				var nextAction = normalizeRegistryId(body.slice(7));
				executeAction(nextAction, { source: "chat-command" });
				return true;
			}

			pushFeed("System", "Unknown command: " + body + ". Use ::help.");
			return true;
		}

		function executeAction(actionId, payload) {
			var normalizedActionId = normalizeRegistryId(actionId);
			if (!normalizedActionId) {
				return api;
			}

			state.meta.status = "Action: " + normalizedActionId;

			if (normalizedActionId === "walk-here") {
				state.markers.player.x = clamp(state.markers.player.x + randomBetween(-5, 5), 0, 100);
				state.markers.player.y = clamp(state.markers.player.y + randomBetween(-5, 5), 0, 100);
				syncHeadingWithMarkers(state);
				pushFeed("Game", "You move across the interface map.");
			} else if (normalizedActionId === "inspect-target") {
				pushFeed("Game", "Inspecting current target context.");
			} else if (normalizedActionId === "refresh-data") {
				pollAdapterOnce("manual-refresh");
			} else if (normalizedActionId === "focus-chat") {
				refs.chatInput.focus();
			} else if (normalizedActionId === "orb-hp") {
				pushFeed("System", "HP: " + state.stats.hp + "/" + state.stats.maxHp);
			} else if (normalizedActionId === "toggle-run") {
				state.stats.running = !state.stats.running;
				pushFeed("System", state.stats.running ? "Run enabled." : "Run disabled.");
			} else if (normalizedActionId === "toggle-prayer") {
				state.stats.quickPrayer = !state.stats.quickPrayer;
				pushFeed("System", state.stats.quickPrayer ? "Quick prayer enabled." : "Quick prayer disabled.");
			} else if (normalizedActionId === "reset-heading") {
				state.meta.heading = 0;
				pushFeed("System", "Heading reset.");
			}

			if (typeof adapter.onAction === "function") {
				try {
					var adapterResult = adapter.onAction(normalizedActionId, payload || {}, api);
					if (adapterResult != null) {
						setData(adapterResult, "adapter-action:" + normalizedActionId);
					}
				} catch (error) {
					pushFeed("System", "Adapter action failed: " + toErrorText(error));
				}
			}

			renderAll();
			emit("action", { id: normalizedActionId, payload: payload || {} });
			return api;
		}

		function setActiveTab(group, tabId) {
			var safeTabId = normalizeRegistryId(tabId);
			if (!safeTabId) {
				return;
			}

			if (group === "bottom") {
				state.ui.activeGroup = "bottom";
				state.ui.activeBottom = safeTabId;
			} else {
				state.ui.activeGroup = "top";
				state.ui.activeTop = safeTabId;
			}

			renderTabs();
			renderPanel();

			if (typeof adapter.onTabChange === "function") {
				try {
					var adapterResult = adapter.onTabChange(group, safeTabId, api);
					if (adapterResult != null) {
						setData(adapterResult, "adapter-tab-change");
					}
				} catch (error) {
					pushFeed("System", "Adapter tab handler failed: " + toErrorText(error));
				}
			}

			emit("tab", { group: group, tabId: safeTabId });
		}

		function pollAdapterOnce(source) {
			if (typeof adapter.tick !== "function") {
				return;
			}

			try {
				var output = adapter.tick(api);
				if (isPromiseLike(output)) {
					output
						.then(function (payload) {
							if (payload != null) {
								setData(payload, source || "adapter-tick");
							}
							state.adapter.lastTick = Date.now();
							renderPanel();
						})
						.catch(function (error) {
							pushFeed("System", "Adapter tick failed: " + toErrorText(error));
							state.adapter.status = "error";
							renderPanel();
						});
					return;
				}

				if (output != null) {
					setData(output, source || "adapter-tick");
				}
				state.adapter.lastTick = Date.now();
			} catch (error) {
				pushFeed("System", "Adapter tick failed: " + toErrorText(error));
				state.adapter.status = "error";
			}

			renderPanel();
		}

		function startPolling() {
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}

			if (!adapter.pollMs || typeof adapter.tick !== "function") {
				return;
			}

			pollTimer = setInterval(function () {
				pollAdapterOnce("adapter-poll");
			}, adapter.pollMs);
		}

		function startPulse() {
			if (pulseTimer) {
				clearInterval(pulseTimer);
				pulseTimer = null;
			}

			pulseTimer = setInterval(function () {
				if (destroyed) {
					return;
				}
				state.meta.clock = new Date().toLocaleTimeString();
				renderViewportHeader();
			}, 1000);
		}

		function reset() {
			var preserved = {
				title: state.meta.title,
				subtitle: state.meta.subtitle,
				mode: state.meta.mode,
			};
			state = createInitialState(preserved);
			state.adapter.name = adapter.name;
			state.adapter.pollMs = adapter.pollMs;
			renderAll();
			return api;
		}

		function on(eventName, handler) {
			if (typeof handler !== "function") {
				return function noop() {};
			}

			var list = listeners.get(eventName) || [];
			list.push(handler);
			listeners.set(eventName, list);

			return function unsubscribe() {
				off(eventName, handler);
			};
		}

		function off(eventName, handler) {
			var list = listeners.get(eventName);
			if (!list || !list.length) {
				return;
			}

			var next = list.filter(function (entry) {
				return entry !== handler;
			});

			if (next.length) {
				listeners.set(eventName, next);
			} else {
				listeners.delete(eventName);
			}
		}

		function emit(eventName, payload) {
			var list = listeners.get(eventName);
			if (!list || !list.length) {
				return;
			}

			list.slice().forEach(function (handler) {
				try {
					handler(payload, api);
				} catch (error) {
					pushFeed("System", "Listener failed: " + toErrorText(error));
				}
			});
		}

		function destroy() {
			if (destroyed) {
				return;
			}

			destroyed = true;

			if (pollTimer) {
				clearInterval(pollTimer);
			}
			if (pulseTimer) {
				clearInterval(pulseTimer);
			}

			refs.shell.removeEventListener("click", onRootClick);
			refs.chatInput.removeEventListener("keydown", onChatInputKeyDown);
			refs.sendChat.removeEventListener("click", onSendChatClick);
			refs.minimap.removeEventListener("click", onMinimapClick);

			listeners.clear();
			mount.innerHTML = "";
		}

		function renderAll() {
			renderViewportHeader();
			renderViewport();
			renderActionBar();
			renderChatFilters();
			renderChatLog();
			renderTabs();
			renderPanel();
			renderOrbs();
			drawMinimap();
			refs.channelLabel.textContent = state.ui.chatChannel;
			refs.hint.textContent = state.meta.status;
		}

		function renderViewportHeader() {
			refs.title.textContent = state.meta.title;
			refs.subtitle.textContent = state.meta.subtitle;
			refs.modeBadge.textContent = "Mode: " + state.meta.mode;
			refs.sourceBadge.textContent = "Source: " + state.meta.source;
			refs.clockBadge.textContent = state.meta.clock || "-";
		}

		function renderViewport() {
			var cards = state.visuals.cards.slice(0, 6);
			refs.viewGrid.innerHTML = cards
				.map(function (card) {
					var actionMarkup = card.action
						? '<button type="button" class="ifw2-card-action" data-ifw2-card-action="' +
							escapeHtml(card.action) +
							'">Run</button>'
						: "";

					return (
						'<article class="ifw2-card">' +
						'<header><h3>' +
						escapeHtml(card.title) +
						"</h3>" +
						'<span class="ifw2-pill">' +
						escapeHtml(card.badge || "Info") +
						"</span></header>" +
						"<p>" +
						escapeHtml(card.text || "") +
						"</p>" +
						actionMarkup +
						"</article>"
					);
				})
				.join("");
		}

		function renderActionBar() {
			var actions = state.actions.length ? state.actions : BUILT_IN_ACTIONS;

			refs.actionBar.innerHTML = actions
				.slice(0, 8)
				.map(function (action) {
					return (
						'<button type="button" class="ifw2-action ifw2-tone-' +
						escapeHtml(action.tone || "base") +
						'" data-ifw2-action="' +
						escapeHtml(action.id) +
						'">' +
						escapeHtml(action.label) +
						"</button>"
					);
				})
				.join("");
		}

		function renderChatFilters() {
			refs.chatFilters.innerHTML = state.chat.channels
				.map(function (channel) {
					var active = state.ui.chatChannel === channel;
					return (
						'<button type="button" class="' +
						(active ? "active" : "") +
						'" data-ifw2-channel="' +
						escapeHtml(channel) +
						'">' +
						escapeHtml(channel) +
						"</button>"
					);
				})
				.join("");
		}

		function renderChatLog() {
			refs.chatLog.innerHTML = state.chat.entries
				.filter(function (entry) {
					return (
						state.ui.chatChannel === "All" ||
						entry.channel === state.ui.chatChannel ||
						entry.channel === "System"
					);
				})
				.slice(-120)
				.map(function (entry) {
					return (
						'<div class="ifw2-chat-line">' +
						"<b>" +
						escapeHtml(entry.channel) +
						":</b> " +
						escapeHtml(entry.text) +
						"</div>"
					);
				})
				.join("");

			refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
		}

		function renderTabs() {
			refs.topTabs.innerHTML = TOP_TABS.map(function (tab) {
				var active = state.ui.activeGroup === "top" && state.ui.activeTop === tab.id;
				return (
					'<button type="button" class="' +
					(active ? "active" : "") +
					'" data-ifw2-tab-group="top" data-ifw2-tab-id="' +
					escapeHtml(tab.id) +
					'" title="' +
					escapeHtml(tab.label) +
					'">' +
					escapeHtml(tab.short) +
					"</button>"
				);
			}).join("");

			refs.bottomTabs.innerHTML = BOTTOM_TABS.map(function (tab) {
				var active = state.ui.activeGroup === "bottom" && state.ui.activeBottom === tab.id;
				return (
					'<button type="button" class="' +
					(active ? "active" : "") +
					'" data-ifw2-tab-group="bottom" data-ifw2-tab-id="' +
					escapeHtml(tab.id) +
					'" title="' +
					escapeHtml(tab.label) +
					'">' +
					escapeHtml(tab.short) +
					"</button>"
				);
			}).join("");
		}

		function renderPanel() {
			var isTop = state.ui.activeGroup === "top";
			var tabId = isTop ? state.ui.activeTop : state.ui.activeBottom;
			var tabDef = (isTop ? TOP_TABS : BOTTOM_TABS).find(function (tab) {
				return tab.id === tabId;
			});

			refs.panelTitle.textContent = tabDef ? tabDef.label : "Panel";
			refs.panelSubtitle.textContent = isTop ? "Top panel" : "Bottom panel";

			refs.panelContent.innerHTML = isTop ? renderTopPanel(tabId) : renderBottomPanel(tabId);
		}

		function renderTopPanel(tabId) {
			if (tabId === "combat") {
				return renderCombatPanel(state);
			}
			if (tabId === "skills") {
				return renderSkillsPanel(state);
			}
			if (tabId === "quests") {
				return renderQuestsPanel(state);
			}
			if (tabId === "inventory") {
				return renderInventoryPanel(state);
			}
			if (tabId === "equipment") {
				return renderEquipmentPanel(state);
			}
			if (tabId === "prayer") {
				return renderPrayerPanel(state);
			}
			if (tabId === "magic") {
				return renderMagicPanel(state);
			}
			if (tabId === "world") {
				return renderWorldPanel(state);
			}
			return renderFallbackPanel("Top panel unavailable.");
		}

		function renderBottomPanel(tabId) {
			if (tabId === "social") {
				return renderSocialPanel(state);
			}
			if (tabId === "output") {
				return renderOutputPanel(state);
			}
			if (tabId === "actions") {
				return renderActionsPanel(state);
			}
			if (tabId === "adapters") {
				return renderAdaptersPanel(state);
			}
			if (tabId === "settings") {
				return renderSettingsPanel(state);
			}
			if (tabId === "assets") {
				return renderAssetsPanel(state);
			}
			if (tabId === "docs") {
				return renderDocsPanel(state);
			}
			if (tabId === "history") {
				return renderHistoryPanel(state);
			}
			return renderFallbackPanel("Bottom panel unavailable.");
		}

		function renderOrbs() {
			paintOrb(refs.orbHp, refs.orbHpValue, state.stats.hp, state.stats.maxHp);
			paintOrb(refs.orbPrayer, refs.orbPrayerValue, state.stats.prayer, state.stats.maxPrayer);
			paintOrb(refs.orbRun, refs.orbRunValue, state.stats.run, 100);
			paintOrb(refs.orbSpec, refs.orbSpecValue, state.stats.spec, 100);

			refs.orbRun.classList.toggle("active", !!state.stats.running);
			refs.orbPrayer.classList.toggle("active", !!state.stats.quickPrayer);
			refs.heading.textContent = "Heading " + String(Math.round(state.meta.heading)).padStart(3, "0");
		}

		function drawMinimap() {
			var ctx = refs.minimap.getContext("2d");
			if (!ctx) {
				return;
			}

			var w = refs.minimap.width;
			var h = refs.minimap.height;

			ctx.clearRect(0, 0, w, h);

			var radial = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
			radial.addColorStop(0, "#283d2a");
			radial.addColorStop(1, "#10170d");

			ctx.fillStyle = radial;
			ctx.fillRect(0, 0, w, h);

			ctx.strokeStyle = "rgba(220, 190, 132, 0.18)";
			ctx.lineWidth = 1;
			for (var i = 0; i <= 6; i += 1) {
				var p = Math.round((i / 6) * w);
				ctx.beginPath();
				ctx.moveTo(p, 0);
				ctx.lineTo(p, h);
				ctx.stroke();

				ctx.beginPath();
				ctx.moveTo(0, p);
				ctx.lineTo(w, p);
				ctx.stroke();
			}

			drawMarker(ctx, state.markers.player, "#ffe9bd", "#5f4829", w, h, 5);
			drawMarker(ctx, state.markers.target, "#ff9c90", "#5e241e", w, h, 5);
		}

		return api;
	}

	function createInitialState(options) {
		var opts = isObject(options) ? options : {};

		return {
			meta: {
				title: toText(opts.title, "Interface Framework v2"),
				subtitle: toText(opts.subtitle, "Universal OSRS-style shell for Perchance generators"),
				mode: normalizeRegistryId(opts.mode || "universal"),
				status: "Ready.",
				source: "bootstrap",
				worldName: toText(opts.worldName, "Interface Sandbox"),
				heading: 0,
				clock: new Date().toLocaleTimeString(),
			},
			ui: {
				activeGroup: "top",
				activeTop: "inventory",
				activeBottom: "output",
				chatChannel: "All",
			},
			stats: {
				hp: 92,
				maxHp: 99,
				prayer: 78,
				maxPrayer: 99,
				run: 88,
				spec: 100,
				running: true,
				quickPrayer: false,
			},
			markers: {
				player: { x: 49, y: 58 },
				target: { x: 62, y: 43 },
			},
			chat: {
				channels: DEFAULT_CHANNELS.slice(),
				entries: [
					{
						channel: "System",
						text: "Interface framework v2 loaded.",
						timestamp: Date.now(),
					},
				],
			},
			topData: {
				skills: [
					{ name: "Attack", level: 80 },
					{ name: "Strength", level: 82 },
					{ name: "Defence", level: 78 },
					{ name: "Magic", level: 86 },
				],
				quests: {
					completed: 0,
					total: 0,
					inProgress: 0,
					active: [],
				},
				inventory: [],
				equipment: [],
				prayers: [],
				spells: [],
				worldSummary: [
					{ key: "Runtime", value: "Browser" },
					{ key: "Theme", value: "OSRS classic" },
				],
			},
			bottomData: {
				social: {
					friends: [],
					ignores: [],
					clan: "-",
					channel: "-",
				},
				notes: [
					{
						type: "info",
						text: "Use setData() with any generator payload to populate panels.",
					},
				],
				diagnostics: [],
				prompts: [],
				files: [],
			},
			visuals: {
				cards: [
					{
						title: "Universal Adapter",
						text: "Map chat, RPG, story, quiz, and image outputs into one runtime.",
						badge: "Core",
						action: "refresh-data",
					},
					{
						title: "Interactive Panels",
						text: "Top and bottom tabs organize gameplay, text, assets, and workflows.",
						badge: "UI",
						action: "focus-chat",
					},
				],
				gallery: [],
			},
			actions: BUILT_IN_ACTIONS.slice(),
			adapter: {
				name: "default-adapter",
				pollMs: 0,
				status: "ready",
				lastTick: 0,
			},
			settings: {
				layout: "fixed-classic",
				interfaceScale: 1,
				scalingMode: "linear",
			},
		};
	}

	function createAdapter(input) {
		var base = {
			name: "default-adapter",
			pollMs: 0,
			load: null,
			transform: null,
			tick: null,
			onAction: null,
			onChat: null,
			onTabChange: null,
		};

		if (typeof input === "function") {
			return {
				name: normalizeRegistryId(input.name || "transform-adapter"),
				pollMs: 0,
				load: null,
				transform: input,
				tick: null,
				onAction: null,
				onChat: null,
				onTabChange: null,
			};
		}

		if (!isObject(input)) {
			return base;
		}

		return {
			name: normalizeRegistryId(input.name || "custom-adapter"),
			pollMs: clampNumber(input.pollMs, 0, 120000, 0),
			load: typeof input.load === "function" ? input.load : null,
			transform: typeof input.transform === "function" ? input.transform : null,
			tick: typeof input.tick === "function" ? input.tick : null,
			onAction: typeof input.onAction === "function" ? input.onAction : null,
			onChat: typeof input.onChat === "function" ? input.onChat : null,
			onTabChange: typeof input.onTabChange === "function" ? input.onTabChange : null,
		};
	}

	function normalizeInput(rawInput) {
		var data = isObject(rawInput) ? rawInput : {};
		var normalized = extractDirectNormalized(data);

		var meta = extractMeta(data);
		if (Object.keys(meta).length) {
			normalized.meta = meta;
		}

		var stats = extractStats(data);
		if (Object.keys(stats).length) {
			normalized.stats = stats;
		}

		var markers = extractMarkers(data);
		if (Object.keys(markers).length) {
			normalized.markers = markers;
		}

		var chat = extractChat(data);
		if (chat) {
			normalized.chat = chat;
		}

		var topData = {};
		var skills = extractSkills(data);
		if (skills.length) {
			topData.skills = skills;
		}
		var quests = extractQuests(data);
		if (quests) {
			topData.quests = quests;
		}
		var inventory = extractInventory(data);
		if (inventory.length) {
			topData.inventory = inventory;
		}
		var equipment = extractEquipment(data);
		if (equipment.length) {
			topData.equipment = equipment;
		}
		var prayers = extractNamedRows(data, ["prayers", "buffs", "toggles"]);
		if (prayers.length) {
			topData.prayers = prayers;
		}
		var spells = extractNamedRows(data, ["spells", "abilities", "moves"]);
		if (spells.length) {
			topData.spells = spells;
		}
		var worldSummary = extractWorldSummary(data);
		if (worldSummary.length) {
			topData.worldSummary = worldSummary;
		}

		if (Object.keys(topData).length) {
			normalized.topData = topData;
		}

		var bottomData = {};
		var social = extractSocial(data);
		if (social) {
			bottomData.social = social;
		}
		var notes = extractNotes(data);
		if (notes.length) {
			bottomData.notes = notes;
		}
		var diagnostics = extractDiagnostics(data);
		if (diagnostics.length) {
			bottomData.diagnostics = diagnostics;
		}
		var prompts = extractPrompts(data);
		if (prompts.length) {
			bottomData.prompts = prompts;
		}
		var files = extractFiles(data);
		if (files.length) {
			bottomData.files = files;
		}

		if (Object.keys(bottomData).length) {
			normalized.bottomData = bottomData;
		}

		var cards = extractCards(data);
		var gallery = extractGallery(data);
		if (cards.length || gallery.length) {
			normalized.visuals = {
				cards: cards,
				gallery: gallery,
			};
		}

		var actions = normalizeActions(
			firstArray([
				data.actions,
				data.commands,
				data.buttons,
				data.options,
				data.choices,
			]),
		);
		if (actions.length) {
			normalized.actions = actions;
		}

		var settings = extractSettings(data);
		if (Object.keys(settings).length) {
			normalized.settings = settings;
		}

		return normalized;
	}

	function extractDirectNormalized(data) {
		var direct = {};

		if (isObject(data.meta)) {
			direct.meta = Object.assign({}, data.meta);
		}

		if (isObject(data.stats)) {
			direct.stats = Object.assign({}, data.stats);
		}

		if (isObject(data.markers)) {
			direct.markers = Object.assign({}, data.markers);
		}

		if (isObject(data.chat)) {
			direct.chat = {};
			if (Array.isArray(data.chat.channels)) {
				direct.chat.channels = normalizeChannels(data.chat.channels);
			}
			if (Array.isArray(data.chat.entries)) {
				direct.chat.entries = data.chat.entries
					.map(normalizeChatEntry)
					.filter(Boolean)
					.slice(-220);
			}
			if (data.chat.activeChannel) {
				direct.chat.activeChannel = toText(data.chat.activeChannel, "All");
			}
		}

		if (isObject(data.topData)) {
			direct.topData = Object.assign({}, data.topData);
		}

		if (isObject(data.bottomData)) {
			direct.bottomData = Object.assign({}, data.bottomData);
		}

		if (isObject(data.visuals)) {
			direct.visuals = {};
			if (Array.isArray(data.visuals.cards)) {
				direct.visuals.cards = normalizeCards(data.visuals.cards);
			}
			if (Array.isArray(data.visuals.gallery)) {
				direct.visuals.gallery = normalizeGallery(data.visuals.gallery);
			}
		}

		if (Array.isArray(data.actions)) {
			direct.actions = normalizeActions(data.actions);
		}

		if (isObject(data.settings)) {
			direct.settings = Object.assign({}, data.settings);
		}

		return direct;
	}

	function extractMeta(data) {
		var out = {};

		var title = pickString(
			data.title,
			data.name,
			data.generatorTitle,
			getPath(data, "meta.title"),
			getPath(data, "generator.title"),
		);
		if (title) {
			out.title = title;
		}

		var subtitle = pickString(
			data.subtitle,
			data.description,
			data.tagline,
			getPath(data, "meta.description"),
			getPath(data, "generator.description"),
		);
		if (subtitle) {
			out.subtitle = subtitle;
		}

		var mode = pickString(
			data.mode,
			data.type,
			data.category,
			getPath(data, "meta.mode"),
			getPath(data, "generator.mode"),
		);
		if (mode) {
			out.mode = normalizeRegistryId(mode);
		}

		var status = pickString(data.status, data.state, getPath(data, "runtime.status"));
		if (status) {
			out.status = status;
		}

		var worldName = pickString(
			data.world,
			data.location,
			data.scene,
			getPath(data, "world.name"),
			getPath(data, "runtime.world"),
		);
		if (worldName) {
			out.worldName = worldName;
		}

		return out;
	}

	function extractStats(data) {
		var stats = {};
		var pools = [
			asObject(data.stats),
			asObject(data.player),
			asObject(data.character),
			asObject(data.resources),
			data,
		];

		var hp = pickNumberFromPools(pools, ["hp", "health", "hitpoints"]);
		if (hp != null) {
			stats.hp = clampNumber(hp, 0, 999, 0);
		}

		var maxHp = pickNumberFromPools(pools, ["maxHp", "hpMax", "maxHealth", "maxHitpoints"]);
		if (maxHp != null) {
			stats.maxHp = clampNumber(maxHp, 1, 999, 99);
		}

		var prayer = pickNumberFromPools(pools, ["prayer", "mana", "focus"]);
		if (prayer != null) {
			stats.prayer = clampNumber(prayer, 0, 999, 0);
		}

		var maxPrayer = pickNumberFromPools(pools, ["maxPrayer", "prayerMax", "maxMana"]);
		if (maxPrayer != null) {
			stats.maxPrayer = clampNumber(maxPrayer, 1, 999, 99);
		}

		var run = pickNumberFromPools(pools, ["run", "energy", "stamina"]);
		if (run != null) {
			stats.run = clampNumber(run, 0, 100, 0);
		}

		var spec = pickNumberFromPools(pools, ["spec", "special", "specialAttack"]);
		if (spec != null) {
			stats.spec = clampNumber(spec, 0, 100, 0);
		}

		var running = pickBooleanFromPools(pools, ["running", "isRunning", "runEnabled"]);
		if (running != null) {
			stats.running = running;
		}

		var quickPrayer = pickBooleanFromPools(pools, ["quickPrayer", "prayerEnabled"]);
		if (quickPrayer != null) {
			stats.quickPrayer = quickPrayer;
		}

		return stats;
	}

	function extractMarkers(data) {
		var markers = {};

		var player = normalizePoint(
			getPath(data, "markers.player") ||
				getPath(data, "map.player") ||
				data.playerPosition ||
				data.player,
		);
		if (player) {
			markers.player = player;
		}

		var target = normalizePoint(
			getPath(data, "markers.target") ||
				getPath(data, "map.target") ||
				data.targetPosition ||
				data.target,
		);
		if (target) {
			markers.target = target;
		}

		return markers;
	}

	function extractChat(data) {
		var channels = normalizeChannels(
			firstArray([
				data.channels,
				data.chatChannels,
				getPath(data, "chat.channels"),
			]),
		);

		var messageArrays = [
			data.messages,
			data.chat,
			data.history,
			data.feed,
			data.entries,
			getPath(data, "thread.messages"),
			getPath(data, "conversation.messages"),
			getPath(data, "chat.entries"),
			extractAiCharacterRows(data, "messages"),
		].filter(Array.isArray);

		var entries = [];
		messageArrays.forEach(function (arr) {
			arr.forEach(function (entry) {
				var normalized = normalizeChatEntry(entry);
				if (normalized) {
					entries.push(normalized);
				}
			});
		});

		if (!entries.length && !channels.length) {
			return null;
		}

		var out = {};
		if (channels.length) {
			out.channels = channels;
		}
		if (entries.length) {
			out.entries = entries.slice(-220);
		}

		var activeChannel = pickString(
			data.activeChannel,
			getPath(data, "chat.activeChannel"),
			getPath(data, "ui.chatChannel"),
		);
		if (activeChannel) {
			out.activeChannel = activeChannel;
		}

		return out;
	}

	function extractSkills(data) {
		var source =
			data.skills ||
			getPath(data, "player.skills") ||
			getPath(data, "character.skills") ||
			data.levels;

		var rows = [];

		if (Array.isArray(source)) {
			source.forEach(function (item) {
				if (Array.isArray(item) && item.length >= 2) {
					rows.push({
						name: toText(item[0], "Skill"),
						level: clampNumber(item[1], 1, 126, 1),
					});
					return;
				}

				if (isObject(item)) {
					rows.push({
						name: pickString(item.name, item.skill, item.label, "Skill"),
						level: clampNumber(item.level, 1, 126, 1),
					});
				}
			});
		} else if (isObject(source)) {
			Object.keys(source).forEach(function (key) {
				rows.push({
					name: titleCase(key),
					level: clampNumber(source[key], 1, 126, 1),
				});
			});
		}

		return dedupeRowsByName(rows).slice(0, 24);
	}

	function extractQuests(data) {
		var source = asObject(data.quests);
		var active = firstArray([
			source.active,
			source.highlighted,
			source.inProgressList,
			data.objectives,
			data.questLog,
		])
			.map(function (value) {
				return toText(value, "");
			})
			.filter(Boolean)
			.slice(0, 12);

		var completed = clampNumber(source.completed, 0, 5000, 0);
		var total = clampNumber(source.total, 0, 5000, 0);
		var inProgress = clampNumber(source.inProgress, 0, 5000, active.length);

		if (!completed && !total && !inProgress && !active.length) {
			return null;
		}

		return {
			completed: completed,
			total: total,
			inProgress: inProgress,
			active: active,
		};
	}

	function extractInventory(data) {
		var source = firstArray([
			data.inventory,
			data.items,
			data.loot,
			data.bag,
			getPath(data, "player.inventory"),
		]);

		var rows = [];

		if (Array.isArray(source)) {
			source.forEach(function (item) {
				var normalized = normalizeInventoryItem(item);
				if (normalized) {
					rows.push(normalized);
				}
			});
		} else if (isObject(source)) {
			Object.keys(source).forEach(function (key) {
				rows.push({
					name: titleCase(key),
					qty: clampNumber(source[key], 1, 999999, 1),
					value: 0,
				});
			});
		}

		return rows.slice(0, 64);
	}

	function extractEquipment(data) {
		var source = data.equipment || data.gear || data.outfit;
		var rows = [];

		if (Array.isArray(source)) {
			source.forEach(function (item, index) {
				if (typeof item === "string") {
					rows.push({ slot: "Slot " + (index + 1), item: item });
					return;
				}

				if (isObject(item)) {
					rows.push({
						slot: pickString(item.slot, item.name, "Slot " + (index + 1)),
						item: pickString(item.item, item.value, item.label, "-"),
					});
				}
			});
		} else if (isObject(source)) {
			Object.keys(source).forEach(function (slot) {
				rows.push({
					slot: titleCase(slot),
					item: toText(source[slot], "-"),
				});
			});
		}

		return rows.slice(0, 24);
	}

	function extractNamedRows(data, keys) {
		var source = null;
		for (var i = 0; i < keys.length; i += 1) {
			if (Array.isArray(data[keys[i]])) {
				source = data[keys[i]];
				break;
			}
		}

		if (!source) {
			return [];
		}

		return source
			.map(function (item) {
				if (typeof item === "string") {
					return { name: item, active: false };
				}

				if (isObject(item)) {
					return {
						name: pickString(item.name, item.label, item.id, "Entry"),
						active: !!item.active,
					};
				}

				return null;
			})
			.filter(Boolean)
			.slice(0, 32);
	}

	function extractWorldSummary(data) {
		var rows = [];

		var summary = data.summary || data.metrics || data.context;
		if (Array.isArray(summary)) {
			summary.forEach(function (entry) {
				var normalized = normalizeSummaryEntry(entry);
				if (normalized) {
					rows.push(normalized);
				}
			});
		} else if (isObject(summary)) {
			Object.keys(summary).forEach(function (key) {
				rows.push({ key: titleCase(key), value: toText(summary[key], "-") });
			});
		}

		var aiTables = extractAiTableSummary(data);
		aiTables.forEach(function (entry) {
			rows.push(entry);
		});

		var location = pickString(data.location, data.scene, data.world);
		if (location) {
			rows.push({ key: "Location", value: location });
		}

		var prompt = pickString(data.prompt, getPath(data, "generation.prompt"));
		if (prompt) {
			rows.push({ key: "Prompt", value: truncate(prompt, 96) });
		}

		return dedupeRowsByKey(rows).slice(0, 20);
	}

	function extractSocial(data) {
		var socialData = asObject(data.social);
		var friends = firstArray([socialData.friends, data.friends, getPath(data, "community.friends")]);
		var ignores = firstArray([socialData.ignores, data.ignores]);

		if (!friends.length && !ignores.length && !socialData.clan && !socialData.channel) {
			return null;
		}

		return {
			friends: friends
				.map(function (friend) {
					if (typeof friend === "string") {
						return { name: friend, online: true, world: "-" };
					}

					if (isObject(friend)) {
						return {
							name: pickString(friend.name, friend.id, "Friend"),
							online: friend.online !== false,
							world: toText(friend.world, "-"),
						};
					}

					return null;
				})
				.filter(Boolean)
				.slice(0, 40),
			ignores: ignores
				.map(function (entry) {
					return toText(entry, "");
				})
				.filter(Boolean)
				.slice(0, 40),
			clan: pickString(socialData.clan, data.clan, "-"),
			channel: pickString(socialData.channel, data.channel, "-"),
		};
	}

	function extractNotes(data) {
		var source = firstArray([
			data.notes,
			data.logs,
			data.events,
			data.output,
			data.notifications,
		]);

		return source
			.map(function (entry) {
				if (typeof entry === "string") {
					return { type: "info", text: entry };
				}

				if (isObject(entry)) {
					return {
						type: normalizeRegistryId(entry.type || entry.level || "info"),
						text: pickString(entry.text, entry.message, entry.value, ""),
					};
				}

				return null;
			})
			.filter(function (entry) {
				return entry && entry.text;
			})
			.slice(0, 120);
	}

	function extractDiagnostics(data) {
		var warnings = firstArray([data.warnings, getPath(data, "diagnostics.warnings")]);
		var errors = firstArray([data.errors, getPath(data, "diagnostics.errors")]);
		var rows = [];

		warnings.forEach(function (entry) {
			rows.push({ level: "warn", text: toText(entry, "Warning") });
		});

		errors.forEach(function (entry) {
			rows.push({ level: "error", text: toText(entry, "Error") });
		});

		return rows.slice(0, 50);
	}

	function extractPrompts(data) {
		var rows = [];
		var prompt = pickString(data.prompt, getPath(data, "generation.prompt"));
		if (prompt) {
			rows.push({ label: "Prompt", value: prompt });
		}

		var negative = pickString(data.negativePrompt, getPath(data, "generation.negativePrompt"));
		if (negative) {
			rows.push({ label: "Negative", value: negative });
		}

		var style = pickString(data.style, data.stylePreset, getPath(data, "generation.style"));
		if (style) {
			rows.push({ label: "Style", value: style });
		}

		return rows;
	}

	function extractFiles(data) {
		var source = firstArray([data.files, data.uploads, data.attachments]);
		return source
			.map(function (entry) {
				if (typeof entry === "string") {
					return { name: entry, kind: "file" };
				}

				if (isObject(entry)) {
					return {
						name: pickString(entry.name, entry.fileName, entry.url, "file"),
						kind: pickString(entry.kind, entry.type, "file"),
					};
				}

				return null;
			})
			.filter(Boolean)
			.slice(0, 80);
	}

	function extractCards(data) {
		var source = firstArray([
			data.cards,
			data.highlights,
			data.panels,
			data.widgets,
		]);

		var cards = source
			.map(function (entry) {
				if (typeof entry === "string") {
					return { title: "Entry", text: entry, badge: "Data", action: "" };
				}

				if (isObject(entry)) {
					return {
						title: pickString(entry.title, entry.name, "Card"),
						text: pickString(entry.text, entry.description, entry.value, ""),
						badge: pickString(entry.badge, entry.type, "Data"),
						action: normalizeRegistryId(entry.action || ""),
					};
				}

				return null;
			})
			.filter(Boolean);

		if (cards.length) {
			return cards;
		}

		var question = pickString(data.question, getPath(data, "quiz.question"));
		if (question) {
			return [
				{
					title: "Question",
					text: question,
					badge: "Quiz",
					action: "focus-chat",
				},
			];
		}

		return [];
	}

	function extractGallery(data) {
		var source = firstArray([
			data.images,
			data.gallery,
			data.media,
			data.generatedImages,
			getPath(data, "assets.images"),
		]);

		return normalizeGallery(source);
	}

	function normalizeGallery(items) {
		if (!Array.isArray(items)) {
			return [];
		}

		return items
			.map(function (item) {
				if (typeof item === "string") {
					return { src: item, label: "Image", caption: "" };
				}

				if (isObject(item)) {
					return {
						src: pickString(item.src, item.url, item.image, ""),
						label: pickString(item.label, item.title, "Image"),
						caption: pickString(item.caption, item.prompt, item.description, ""),
					};
				}

				return null;
			})
			.filter(function (item) {
				return item && item.src;
			})
			.slice(0, 64);
	}

	function normalizeCards(cards) {
		if (!Array.isArray(cards)) {
			return [];
		}

		return cards
			.map(function (card) {
				if (!isObject(card)) {
					return null;
				}

				return {
					title: pickString(card.title, card.name, "Card"),
					text: pickString(card.text, card.description, ""),
					badge: pickString(card.badge, card.type, "Info"),
					action: normalizeRegistryId(card.action || ""),
				};
			})
			.filter(Boolean)
			.slice(0, 12);
	}

	function normalizeActions(actions) {
		if (!Array.isArray(actions)) {
			return [];
		}

		return actions
			.map(function (action, index) {
				if (typeof action === "string") {
					return {
						id: normalizeRegistryId(action),
						label: titleCase(action),
						tone: "base",
					};
				}

				if (isObject(action)) {
					var label = pickString(action.label, action.name, action.id, "Action " + (index + 1));
					return {
						id: normalizeRegistryId(action.id || label),
						label: label,
						tone: normalizeRegistryId(action.tone || action.type || "base"),
					};
				}

				return null;
			})
			.filter(function (entry) {
				return entry && entry.id;
			})
			.slice(0, 48);
	}

	function extractSettings(data) {
		var settings = asObject(data.settings);
		var out = {};

		var layout = pickString(settings.layout, data.layout);
		if (layout) {
			out.layout = normalizeRegistryId(layout);
		}

		var scale = pickNumberFromPools([settings, data], ["interfaceScale", "scale", "uiScale"]);
		if (scale != null) {
			out.interfaceScale = clampNumber(scale, 0.7, 2.2, 1);
		}

		var scalingMode = pickString(settings.scalingMode, settings.mode, data.scalingMode);
		if (scalingMode) {
			out.scalingMode = normalizeRegistryId(scalingMode);
		}

		return out;
	}

	function applyNormalizedState(state, normalized) {
		if (!isObject(normalized)) {
			return;
		}

		if (normalized.meta) {
			Object.assign(state.meta, normalized.meta);
		}

		if (normalized.stats) {
			applyPartialStats(state.stats, normalized.stats);
		}

		if (normalized.markers) {
			if (normalized.markers.player) {
				state.markers.player = normalized.markers.player;
			}
			if (normalized.markers.target) {
				state.markers.target = normalized.markers.target;
			}
		}

		if (normalized.chat) {
			if (Array.isArray(normalized.chat.channels) && normalized.chat.channels.length) {
				state.chat.channels = normalizeChannels(normalized.chat.channels);
			}

			if (Array.isArray(normalized.chat.entries) && normalized.chat.entries.length) {
				state.chat.entries = normalized.chat.entries.slice(-220);
			}

			if (normalized.chat.activeChannel) {
				state.ui.chatChannel = normalized.chat.activeChannel;
			}
		}

		if (normalized.topData) {
			Object.assign(state.topData, normalized.topData);
		}

		if (normalized.bottomData) {
			Object.assign(state.bottomData, normalized.bottomData);
		}

		if (normalized.visuals) {
			if (Array.isArray(normalized.visuals.cards) && normalized.visuals.cards.length) {
				state.visuals.cards = normalized.visuals.cards;
			}
			if (Array.isArray(normalized.visuals.gallery)) {
				state.visuals.gallery = normalized.visuals.gallery;
			}
		}

		if (Array.isArray(normalized.actions) && normalized.actions.length) {
			state.actions = normalized.actions;
		}

		if (normalized.settings) {
			Object.assign(state.settings, normalized.settings);
		}

		state.chat.channels = normalizeChannels(state.chat.channels);
		if (state.chat.channels.indexOf(state.ui.chatChannel) < 0) {
			state.ui.chatChannel = state.chat.channels[0] || "All";
		}
	}

	function applyPartialStats(target, source) {
		if (!isObject(source)) {
			return;
		}

		if (source.maxHp != null) {
			target.maxHp = clampNumber(source.maxHp, 1, 999, target.maxHp);
		}
		if (source.hp != null) {
			target.hp = clampNumber(source.hp, 0, target.maxHp, target.hp);
		}
		if (source.maxPrayer != null) {
			target.maxPrayer = clampNumber(source.maxPrayer, 1, 999, target.maxPrayer);
		}
		if (source.prayer != null) {
			target.prayer = clampNumber(source.prayer, 0, target.maxPrayer, target.prayer);
		}
		if (source.run != null) {
			target.run = clampNumber(source.run, 0, 100, target.run);
		}
		if (source.spec != null) {
			target.spec = clampNumber(source.spec, 0, 100, target.spec);
		}
		if (source.running != null) {
			target.running = !!source.running;
		}
		if (source.quickPrayer != null) {
			target.quickPrayer = !!source.quickPrayer;
		}
	}

	function renderCombatPanel(state) {
		return (
			'<section class="ifw2-module">' +
			"<h3>Combat status</h3>" +
			'<div class="ifw2-kv-grid">' +
			renderKv("HP", state.stats.hp + "/" + state.stats.maxHp) +
			renderKv("Prayer", state.stats.prayer + "/" + state.stats.maxPrayer) +
			renderKv("Run", state.stats.run + "%") +
			renderKv("Spec", state.stats.spec + "%") +
			renderKv("Running", state.stats.running ? "Yes" : "No") +
			renderKv("Quick prayer", state.stats.quickPrayer ? "On" : "Off") +
			"</div>" +
			"</section>"
		);
	}

	function renderSkillsPanel(state) {
		if (!state.topData.skills.length) {
			return renderFallbackPanel("No skill data.");
		}

		return (
			'<section class="ifw2-module"><h3>Skills</h3><div class="ifw2-row-list">' +
			state.topData.skills
				.map(function (skill) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(skill.name) +
						"</span><span class=\"ifw2-pill\">" +
						escapeHtml(String(skill.level)) +
						"</span></div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderQuestsPanel(state) {
		var quests = state.topData.quests;
		return (
			'<section class="ifw2-module">' +
			"<h3>Quests</h3>" +
			'<div class="ifw2-kv-grid">' +
			renderKv("Completed", String(quests.completed || 0)) +
			renderKv("In progress", String(quests.inProgress || 0)) +
			renderKv("Total", String(quests.total || 0)) +
			"</div>" +
			'<div class="ifw2-row-list">' +
			(quests.active || [])
				.slice(0, 12)
				.map(function (entry) {
					return '<div class="ifw2-row"><span>' + escapeHtml(entry) + '</span><span class="ifw2-pill warn">Active</span></div>';
				})
				.join("") +
			"</div>" +
			"</section>"
		);
	}

	function renderInventoryPanel(state) {
		if (!state.topData.inventory.length) {
			return renderFallbackPanel("No inventory items.");
		}

		return (
			'<section class="ifw2-module"><h3>Inventory</h3><div class="ifw2-inventory-grid">' +
			state.topData.inventory
				.slice(0, 64)
				.map(function (item) {
					return (
						'<div class="ifw2-slot">' +
						'<span class="name">' +
						escapeHtml(item.name) +
						"</span>" +
						'<span class="qty">x' +
						escapeHtml(String(item.qty)) +
						"</span>" +
						"</div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderEquipmentPanel(state) {
		if (!state.topData.equipment.length) {
			return renderFallbackPanel("No equipment loaded.");
		}

		return (
			'<section class="ifw2-module"><h3>Equipment</h3><div class="ifw2-row-list">' +
			state.topData.equipment
				.map(function (slot) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(slot.slot) +
						"</span><span class=\"ifw2-pill\">" +
						escapeHtml(slot.item) +
						"</span></div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderPrayerPanel(state) {
		if (!state.topData.prayers.length) {
			return renderFallbackPanel("No prayer list.");
		}

		return (
			'<section class="ifw2-module"><h3>Prayer list</h3><div class="ifw2-row-list">' +
			state.topData.prayers
				.map(function (entry) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(entry.name) +
						"</span><span class=\"ifw2-pill " +
						(entry.active ? "ok" : "") +
						'\">' +
						(entry.active ? "On" : "Off") +
						"</span></div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderMagicPanel(state) {
		if (!state.topData.spells.length) {
			return renderFallbackPanel("No spells or abilities.");
		}

		return (
			'<section class="ifw2-module"><h3>Magic and abilities</h3><div class="ifw2-row-list">' +
			state.topData.spells
				.map(function (entry) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(entry.name) +
						"</span><span class=\"ifw2-pill\">" +
						(entry.active ? "Active" : "Ready") +
						"</span></div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderWorldPanel(state) {
		if (!state.topData.worldSummary.length) {
			return renderFallbackPanel("No world summary.");
		}

		return (
			'<section class="ifw2-module"><h3>World and runtime</h3><div class="ifw2-kv-grid">' +
			state.topData.worldSummary
				.map(function (entry) {
					return renderKv(entry.key, entry.value);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderSocialPanel(state) {
		var social = state.bottomData.social || {
			friends: [],
			ignores: [],
			clan: "-",
			channel: "-",
		};

		return (
			'<section class="ifw2-module">' +
			"<h3>Social</h3>" +
			'<div class="ifw2-kv-grid">' +
			renderKv("Clan", social.clan || "-") +
			renderKv("Channel", social.channel || "-") +
			renderKv("Friends", String((social.friends || []).length)) +
			renderKv("Ignored", String((social.ignores || []).length)) +
			"</div>" +
			'<div class="ifw2-row-list">' +
			(social.friends || [])
				.slice(0, 20)
				.map(function (friend) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(friend.name) +
						"</span><span class=\"ifw2-pill " +
						(friend.online ? "ok" : "") +
						'\">' +
						(friend.online ? "W" + escapeHtml(String(friend.world || "-")) : "Offline") +
						"</span></div>"
					);
				})
				.join("") +
			"</div>" +
			"</section>"
		);
	}

	function renderOutputPanel(state) {
		if (!state.bottomData.notes.length) {
			return renderFallbackPanel("No output notes.");
		}

		return (
			'<section class="ifw2-module"><h3>Output feed</h3><div class="ifw2-row-list">' +
			state.bottomData.notes
				.slice(-80)
				.map(function (note) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(note.text) +
						"</span><span class=\"ifw2-pill " +
						escapeHtml(note.type || "base") +
						'\">' +
						escapeHtml(note.type || "info") +
						"</span></div>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderActionsPanel(state) {
		return (
			'<section class="ifw2-module"><h3>Action registry</h3><div class="ifw2-row-list">' +
			state.actions
				.map(function (action) {
					return (
						'<button type="button" class="ifw2-row ifw2-row-button" data-ifw2-action="' +
						escapeHtml(action.id) +
						'"><span>' +
						escapeHtml(action.label) +
						"</span><span class=\"ifw2-pill\">" +
						escapeHtml(action.id) +
						"</span></button>"
					);
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderAdaptersPanel(state) {
		return (
			'<section class="ifw2-module">' +
			"<h3>Adapter diagnostics</h3>" +
			'<div class="ifw2-kv-grid">' +
			renderKv("Name", state.adapter.name) +
			renderKv("Status", state.adapter.status) +
			renderKv("Poll", String(state.adapter.pollMs) + "ms") +
			renderKv("Last tick", state.adapter.lastTick ? new Date(state.adapter.lastTick).toLocaleTimeString() : "-") +
			"</div>" +
			'<div class="ifw2-row-list">' +
			(state.bottomData.diagnostics || [])
				.slice(-30)
				.map(function (diag) {
					return (
						'<div class="ifw2-row"><span>' +
						escapeHtml(diag.text) +
						"</span><span class=\"ifw2-pill " +
						escapeHtml(diag.level || "warn") +
						'\">' +
						escapeHtml(diag.level || "warn") +
						"</span></div>"
					);
				})
				.join("") +
			"</div>" +
			"</section>"
		);
	}

	function renderSettingsPanel(state) {
		return (
			'<section class="ifw2-module">' +
			"<h3>Settings snapshot</h3>" +
			'<div class="ifw2-kv-grid">' +
			renderKv("Layout", state.settings.layout) +
			renderKv("Scale", String(state.settings.interfaceScale)) +
			renderKv("Scaling mode", state.settings.scalingMode) +
			renderKv("Active channel", state.ui.chatChannel) +
			renderKv("World", state.meta.worldName || "-") +
			"</div>" +
			"</section>"
		);
	}

	function renderAssetsPanel(state) {
		var gallery = state.visuals.gallery || [];
		var prompts = state.bottomData.prompts || [];
		var files = state.bottomData.files || [];

		var galleryMarkup = gallery
			.slice(0, 12)
			.map(function (item) {
				return (
					'<div class="ifw2-asset-thumb">' +
					'<img src="' +
					escapeHtml(item.src) +
					'" alt="' +
					escapeHtml(item.label || "Image") +
					'" loading="lazy" />' +
					'<span>' +
					escapeHtml(item.label || "Image") +
					"</span></div>"
				);
			})
			.join("");

		var promptMarkup = prompts
			.map(function (entry) {
				return renderKv(entry.label, entry.value);
			})
			.join("");

		var fileMarkup = files
			.slice(0, 24)
			.map(function (file) {
				return '<div class="ifw2-row"><span>' + escapeHtml(file.name) + '</span><span class="ifw2-pill">' + escapeHtml(file.kind) + "</span></div>";
			})
			.join("");

		return (
			'<section class="ifw2-module">' +
			"<h3>Assets and outputs</h3>" +
			(promptMarkup ? '<div class="ifw2-kv-grid">' + promptMarkup + "</div>" : "") +
			(galleryMarkup ? '<div class="ifw2-gallery">' + galleryMarkup + "</div>" : "") +
			(fileMarkup ? '<div class="ifw2-row-list">' + fileMarkup + "</div>" : "") +
			(!promptMarkup && !galleryMarkup && !fileMarkup ? '<p class="ifw2-empty">No assets in payload.</p>' : "") +
			"</section>"
		);
	}

	function renderDocsPanel() {
		return (
			'<section class="ifw2-module">' +
			"<h3>Adapter contract</h3>" +
			'<div class="ifw2-row-list">' +
			'<div class="ifw2-row"><span>setData(payload)</span><span class="ifw2-pill">normalize payload</span></div>' +
			'<div class="ifw2-row"><span>setAdapter(adapter)</span><span class="ifw2-pill">load/tick/hooks</span></div>' +
			'<div class="ifw2-row"><span>createAiCharacterChatSkeleton()</span><span class="ifw2-pill">table schema</span></div>' +
			'<div class="ifw2-row"><span>execute(action)</span><span class="ifw2-pill">sync command path</span></div>' +
			"</div>" +
			"</section>"
		);
	}

	function renderHistoryPanel(state) {
		return (
			'<section class="ifw2-module"><h3>Recent history</h3><div class="ifw2-row-list">' +
			state.chat.entries
				.slice(-40)
				.map(function (entry) {
					return '<div class="ifw2-row"><span>' + escapeHtml(entry.text) + '</span><span class="ifw2-pill">' + escapeHtml(entry.channel) + "</span></div>";
				})
				.join("") +
			"</div></section>"
		);
	}

	function renderFallbackPanel(text) {
		return '<section class="ifw2-module"><p class="ifw2-empty">' + escapeHtml(text || "No data.") + "</p></section>";
	}

	function renderKv(key, value) {
		return '<div class="ifw2-kv"><b>' + escapeHtml(key) + "</b><span>" + escapeHtml(value) + "</span></div>";
	}

	function paintOrb(orb, valueNode, value, maxValue) {
		var safeMax = Math.max(1, maxValue || 1);
		var safeValue = clampNumber(value, 0, safeMax, 0);
		var percent = Math.round((safeValue / safeMax) * 100);
		orb.style.setProperty("--ifw2-orb-fill", String(percent) + "%");
		valueNode.textContent = String(safeValue);
	}

	function drawMarker(ctx, marker, fillColor, strokeColor, width, height, size) {
		var x = clampNumber(marker.x, 0, 100, 50) * 0.01 * width;
		var y = clampNumber(marker.y, 0, 100, 50) * 0.01 * height;

		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.fillStyle = fillColor;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = strokeColor;
		ctx.stroke();
	}

	function syncHeadingWithMarkers(state) {
		if (!state || !state.markers || !state.meta) {
			return;
		}

		var dx = state.markers.target.x - state.markers.player.x;
		var dy = state.markers.target.y - state.markers.player.y;
		var angle = Math.atan2(dx, -dy) * (180 / Math.PI);

		if (!Number.isFinite(angle)) {
			state.meta.heading = 0;
			return;
		}

		state.meta.heading = (Math.round(angle) + 360) % 360;
	}

	function collectRefs(root) {
		return {
			shell: root.querySelector(".ifw2-shell"),
			title: root.querySelector("[data-ifw2-title]"),
			subtitle: root.querySelector("[data-ifw2-subtitle]"),
			modeBadge: root.querySelector("[data-ifw2-mode]"),
			sourceBadge: root.querySelector("[data-ifw2-source]"),
			clockBadge: root.querySelector("[data-ifw2-clock]"),
			viewGrid: root.querySelector("[data-ifw2-view-grid]"),
			actionBar: root.querySelector("[data-ifw2-action-bar]"),
			hint: root.querySelector("[data-ifw2-hint]"),
			chatLog: root.querySelector("[data-ifw2-chat-log]"),
			chatFilters: root.querySelector("[data-ifw2-chat-filters]"),
			chatInput: root.querySelector("[data-ifw2-chat-input]"),
			sendChat: root.querySelector("[data-ifw2-send-chat]"),
			channelLabel: root.querySelector("[data-ifw2-channel-label]"),
			minimap: root.querySelector("[data-ifw2-minimap]"),
			heading: root.querySelector("[data-ifw2-heading]"),
			topTabs: root.querySelector("[data-ifw2-top-tabs]"),
			bottomTabs: root.querySelector("[data-ifw2-bottom-tabs]"),
			panelTitle: root.querySelector("[data-ifw2-panel-title]"),
			panelSubtitle: root.querySelector("[data-ifw2-panel-subtitle]"),
			panelContent: root.querySelector("[data-ifw2-panel-content]"),
			orbHp: root.querySelector("[data-ifw2-orb='hp']"),
			orbHpValue: root.querySelector("[data-ifw2-orb-value='hp']"),
			orbPrayer: root.querySelector("[data-ifw2-orb='prayer']"),
			orbPrayerValue: root.querySelector("[data-ifw2-orb-value='prayer']"),
			orbRun: root.querySelector("[data-ifw2-orb='run']"),
			orbRunValue: root.querySelector("[data-ifw2-orb-value='run']"),
			orbSpec: root.querySelector("[data-ifw2-orb='spec']"),
			orbSpecValue: root.querySelector("[data-ifw2-orb-value='spec']"),
		};
	}

	function buildTemplate() {
		return (
			'<main class="ifw2-shell">' +
			'<section class="ifw2-viewport frame">' +
			'<header class="ifw2-viewport-header">' +
			"<div>" +
			'<h1 data-ifw2-title></h1>' +
			'<p data-ifw2-subtitle></p>' +
			"</div>" +
			'<div class="ifw2-badge-row">' +
			'<span class="ifw2-pill" data-ifw2-mode></span>' +
			'<span class="ifw2-pill" data-ifw2-source></span>' +
			'<span class="ifw2-pill" data-ifw2-clock></span>' +
			"</div>" +
			"</header>" +
			'<div class="ifw2-viewport-body">' +
			'<div class="ifw2-view-grid" data-ifw2-view-grid></div>' +
			'<div class="ifw2-hint" data-ifw2-hint>Ready.</div>' +
			"</div>" +
			'<div class="ifw2-action-bar" data-ifw2-action-bar></div>' +
			"</section>" +

			'<section class="ifw2-chat frame">' +
			'<div class="ifw2-chat-log" data-ifw2-chat-log></div>' +
			'<div class="ifw2-chat-filters" data-ifw2-chat-filters></div>' +
			'<div class="ifw2-chat-input-row">' +
			'<span class="ifw2-chat-channel" data-ifw2-channel-label>All</span>' +
			'<input type="text" maxlength="240" placeholder="Press Enter to chat..." autocomplete="off" data-ifw2-chat-input />' +
			'<button type="button" data-ifw2-send-chat>Send</button>' +
			"</div>" +
			"</section>" +

			'<aside class="ifw2-side frame">' +
			'<section class="ifw2-minimap-wrap">' +
			'<div class="ifw2-minimap-head">' +
			'<button type="button" class="ifw2-compass" data-ifw2-action="reset-heading">N</button>' +
			'<span data-ifw2-heading>Heading 000</span>' +
			"</div>" +
			'<canvas width="146" height="146" data-ifw2-minimap></canvas>' +
			'<div class="ifw2-orbs">' +
			'<button type="button" class="ifw2-orb hp" data-ifw2-action="orb-hp" data-ifw2-orb="hp"><span class="ifw2-orb-fill"></span><span class="ifw2-orb-tag">HP</span><span class="ifw2-orb-value" data-ifw2-orb-value="hp">0</span></button>' +
			'<button type="button" class="ifw2-orb prayer" data-ifw2-action="toggle-prayer" data-ifw2-orb="prayer"><span class="ifw2-orb-fill"></span><span class="ifw2-orb-tag">PR</span><span class="ifw2-orb-value" data-ifw2-orb-value="prayer">0</span></button>' +
			'<button type="button" class="ifw2-orb run" data-ifw2-action="toggle-run" data-ifw2-orb="run"><span class="ifw2-orb-fill"></span><span class="ifw2-orb-tag">RN</span><span class="ifw2-orb-value" data-ifw2-orb-value="run">0</span></button>' +
			'<button type="button" class="ifw2-orb spec" data-ifw2-action="inspect-target" data-ifw2-orb="spec"><span class="ifw2-orb-fill"></span><span class="ifw2-orb-tag">SP</span><span class="ifw2-orb-value" data-ifw2-orb-value="spec">0</span></button>' +
			"</div>" +
			"</section>" +
			'<section class="ifw2-tabs top" data-ifw2-top-tabs></section>' +
			'<section class="ifw2-panel">' +
			'<header class="ifw2-panel-head"><h2 data-ifw2-panel-title></h2><span data-ifw2-panel-subtitle></span></header>' +
			'<div class="ifw2-panel-content" data-ifw2-panel-content></div>' +
			"</section>" +
			'<section class="ifw2-tabs bottom" data-ifw2-bottom-tabs></section>' +
			"</aside>" +
			"</main>"
		);
	}

	function resolveMount(mount) {
		if (typeof mount === "string") {
			var selected = document.querySelector(mount);
			if (selected instanceof HTMLElement) {
				return selected;
			}
		}

		if (mount instanceof HTMLElement) {
			return mount;
		}

		var fallback = document.createElement("div");
		document.body.appendChild(fallback);
		return fallback;
	}

	function createAiCharacterChatSkeleton(seed) {
		var now = new Date().toISOString();
		var input = isObject(seed) ? seed : {};
		var characterName = toText(input.characterName, "Interface Guide");
		var threadId = normalizeRegistryId(input.threadId || "main-thread");
		var characterId = normalizeRegistryId(input.characterId || "main-character");
		var messageId = normalizeRegistryId(input.messageId || "seed-message");

		return {
			data: {
				data: {
					characters: {
						rows: [
							{
								id: characterId,
								name: characterName,
								avatar: toText(input.avatar, ""),
								prompt: toText(input.characterPrompt, "You are a helpful guide."),
							},
						],
					},
					threads: {
						rows: [
							{
								id: threadId,
								title: toText(input.threadTitle, "Main Thread"),
								characterId: characterId,
								createdAt: now,
							},
						],
					},
					messages: {
						rows: [
							{
								id: messageId,
								threadId: threadId,
								role: "system",
								content: toText(input.openingMessage, "Interface framework v2 initialized."),
								createdAt: now,
							},
						],
					},
					misc: {
						rows: [
							{ key: "source", value: "interface-framework-v2" },
							{ key: "version", value: VERSION },
							{ key: "createdAt", value: now },
						],
					},
					summaries: {
						rows: [],
					},
					memories: {
						rows: [],
					},
					lore: {
						rows: [],
					},
					textEmbeddingCache: {
						rows: [],
					},
					textCompressionCache: {
						rows: [],
					},
				},
			},
		};
	}

	function extractAiCharacterRows(data, tableName) {
		var tables = getPath(data, "data.data");
		if (!isObject(tables)) {
			return [];
		}

		var table = tables[tableName];
		if (Array.isArray(table)) {
			return table;
		}

		if (isObject(table) && Array.isArray(table.rows)) {
			return table.rows;
		}

		return [];
	}

	function extractAiTableSummary(data) {
		var names = [
			"characters",
			"threads",
			"messages",
			"misc",
			"summaries",
			"memories",
			"lore",
			"textEmbeddingCache",
			"textCompressionCache",
		];

		var rows = [];
		names.forEach(function (name) {
			var tableRows = extractAiCharacterRows(data, name);
			if (tableRows.length) {
				rows.push({
					key: "AI " + titleCase(name),
					value: String(tableRows.length) + " rows",
				});
			}
		});

		return rows;
	}

	function normalizeInventoryItem(item) {
		if (typeof item === "string") {
			return { name: item, qty: 1, value: 0 };
		}

		if (!isObject(item)) {
			return null;
		}

		return {
			name: pickString(item.name, item.item, item.label, "Item"),
			qty: clampNumber(item.qty != null ? item.qty : item.count, 1, 999999, 1),
			value: clampNumber(item.value, 0, 999999999, 0),
		};
	}

	function normalizeSummaryEntry(entry) {
		if (typeof entry === "string") {
			return { key: "Summary", value: entry };
		}

		if (!isObject(entry)) {
			return null;
		}

		return {
			key: pickString(entry.key, entry.label, entry.name, "Summary"),
			value: pickString(entry.value, entry.text, entry.description, "-"),
		};
	}

	function normalizeChatEntry(entry) {
		if (typeof entry === "string") {
			return {
				channel: "Game",
				text: entry,
				timestamp: Date.now(),
			};
		}

		if (!isObject(entry)) {
			return null;
		}

		var role = pickString(entry.channel, entry.role, entry.speaker, entry.type, entry.author);
		var content = pickString(
			entry.text,
			entry.content,
			entry.message,
			entry.value,
			getPath(entry, "content.text"),
			getPath(entry, "message.text"),
		);

		if (!content) {
			return null;
		}

		return {
			channel: normalizeRoleToChannel(role),
			text: content,
			timestamp: clampNumber(entry.timestamp, 0, Number.MAX_SAFE_INTEGER, Date.now()),
		};
	}

	function normalizeRoleToChannel(role) {
		var id = normalizeRegistryId(role || "game");
		if (id === "assistant") {
			return "Game";
		}
		if (id === "user") {
			return "Public";
		}
		if (id === "narrator") {
			return "Story";
		}
		if (id === "system") {
			return "System";
		}
		if (id === "private") {
			return "Private";
		}

		if (!id) {
			return "Game";
		}
		return titleCase(id);
	}

	function normalizeChannels(channels) {
		var list = Array.isArray(channels) ? channels : [];
		var output = [];

		list.forEach(function (entry) {
			var channel = toText(entry, "");
			if (channel && output.indexOf(channel) < 0) {
				output.push(channel);
			}
		});

		DEFAULT_CHANNELS.forEach(function (entry) {
			if (output.indexOf(entry) < 0) {
				output.push(entry);
			}
		});

		return output;
	}

	function normalizePoint(value) {
		if (Array.isArray(value) && value.length >= 2) {
			return {
				x: clampNumber(value[0], 0, 100, 50),
				y: clampNumber(value[1], 0, 100, 50),
			};
		}

		if (isObject(value)) {
			return {
				x: clampNumber(value.x != null ? value.x : value.left, 0, 100, 50),
				y: clampNumber(value.y != null ? value.y : value.top, 0, 100, 50),
			};
		}

		return null;
	}

	function normalizeRegistryId(value) {
		return toText(value, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	}

	function titleCase(value) {
		return toText(value, "")
			.split(/[-_\s]+/g)
			.filter(Boolean)
			.map(function (token) {
				return token.charAt(0).toUpperCase() + token.slice(1);
			})
			.join(" ");
	}

	function dedupeRowsByName(rows) {
		var seen = new Set();
		return rows.filter(function (row) {
			var key = normalizeRegistryId(row.name || "");
			if (!key || seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	function dedupeRowsByKey(rows) {
		var seen = new Set();
		return rows.filter(function (row) {
			var key = normalizeRegistryId(row.key || "");
			if (!key || seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	function firstArray(candidates) {
		for (var i = 0; i < candidates.length; i += 1) {
			if (Array.isArray(candidates[i])) {
				return candidates[i];
			}
		}
		return [];
	}

	function pickString() {
		for (var i = 0; i < arguments.length; i += 1) {
			var value = arguments[i];
			if (typeof value === "string" && value.trim()) {
				return value.trim();
			}
			if (typeof value === "number" && Number.isFinite(value)) {
				return String(value);
			}
		}
		return "";
	}

	function pickNumberFromPools(pools, keys) {
		for (var i = 0; i < pools.length; i += 1) {
			var obj = pools[i];
			if (!isObject(obj)) {
				continue;
			}
			for (var j = 0; j < keys.length; j += 1) {
				var key = keys[j];
				if (obj[key] == null) {
					continue;
				}
				var num = Number(obj[key]);
				if (Number.isFinite(num)) {
					return num;
				}
			}
		}
		return null;
	}

	function pickBooleanFromPools(pools, keys) {
		for (var i = 0; i < pools.length; i += 1) {
			var obj = pools[i];
			if (!isObject(obj)) {
				continue;
			}
			for (var j = 0; j < keys.length; j += 1) {
				var key = keys[j];
				if (obj[key] == null) {
					continue;
				}
				return !!obj[key];
			}
		}
		return null;
	}

	function asObject(value) {
		return isObject(value) ? value : {};
	}

	function isObject(value) {
		return value != null && typeof value === "object" && !Array.isArray(value);
	}

	function isPromiseLike(value) {
		return !!value && typeof value.then === "function";
	}

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function clampNumber(value, min, max, fallback) {
		var num = Number(value);
		if (!Number.isFinite(num)) {
			return fallback;
		}
		return clamp(num, min, max);
	}

	function toText(value, fallback) {
		if (typeof value === "string") {
			return value;
		}
		if (typeof value === "number" && Number.isFinite(value)) {
			return String(value);
		}
		return fallback == null ? "" : String(fallback);
	}

	function randomBetween(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function getPath(value, path) {
		var segments = path.split(".");
		var current = value;

		for (var i = 0; i < segments.length; i += 1) {
			if (!isObject(current)) {
				return undefined;
			}
			current = current[segments[i]];
		}

		return current;
	}

	function truncate(value, maxLength) {
		var text = toText(value, "");
		if (text.length <= maxLength) {
			return text;
		}
		return text.slice(0, Math.max(0, maxLength - 3)) + "...";
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function toErrorText(error) {
		if (!error) {
			return "Unknown error";
		}
		if (typeof error === "string") {
			return error;
		}
		return toText(error.message, "Unknown error");
	}

	global.createInterfaceFrameworkV2 = createInterfaceFrameworkV2;
	global.createInterfaceFrameworkV2Version = VERSION;
})(typeof window !== "undefined" ? window : globalThis);
