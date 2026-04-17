(function attachInterfaceFrameworkV2Presets(global) {
  "use strict";

  var VERSION = "2.0.0";

  var GENERATOR_LINKS = {
    "ai-chat": "https://perchance.org/ai-chat",
    "ai-character-chat": "https://perchance.org/ai-character-chat",
    "ai-rpg": "https://perchance.org/ai-rpg",
  };

  function createAiChatAdapter(options) {
    var opts = isObject(options) ? options : {};

    return {
      name: "ai-chat-preset",
      pollMs: clampNumber(opts.pollMs, 0, 120000, 0),
      transform: function transformAiChat(input, helpers) {
        var normalized = helpers.normalizeInput(input);

        normalized.meta = normalized.meta || {};
        normalized.meta.mode = "ai-chat";

        if (!normalized.meta.title) {
          normalized.meta.title = toText(opts.title, "AI Chat");
        }

        if (!normalized.meta.subtitle) {
          normalized.meta.subtitle = toText(
            opts.subtitle,
            "Conversation preset for https://perchance.org/ai-chat",
          );
        }

        if (!normalized.meta.status) {
          normalized.meta.status = "Chat ready";
        }

        normalized.actions = mergeActionSets(
          normalized.actions,
          [
            { id: "focus-chat", label: "Reply", tone: "base" },
            { id: "refresh-data", label: "Refresh", tone: "ok" },
            { id: "regenerate-response", label: "Regenerate", tone: "warn" },
            { id: "clear-thread", label: "Clear", tone: "base" },
          ],
          helpers,
        );

        normalized.visuals = normalized.visuals || {};
        normalized.visuals.cards = mergeCards(
          normalized.visuals.cards,
          [
            {
              title: "Conversation",
              text: pickConversationPreview(normalized),
              badge: "ai-chat",
              action: "focus-chat",
            },
          ],
        );

        normalized.bottomData = normalized.bottomData || {};
        normalized.bottomData.notes = mergeNotes(
          normalized.bottomData.notes,
          [
            {
              type: "info",
              text: "Preset active: ai-chat",
            },
          ],
        );

        return normalized;
      },
      onAction: function onAiChatAction(actionId, payload, api) {
        var normalized = api.normalizeRegistryId(actionId);

        if (normalized === "regenerate-response") {
          if (typeof opts.onRegenerate === "function") {
            return opts.onRegenerate(payload, api);
          }

          return {
            status: "Regeneration requested",
            messages: [
              {
                role: "assistant",
                content: toText(
                  opts.regenerateMessage,
                  "Regeneration trigger captured by ai-chat preset.",
                ),
              },
            ],
          };
        }

        if (normalized === "clear-thread") {
          if (typeof opts.onClearThread === "function") {
            return opts.onClearThread(payload, api);
          }

          return {
            status: "Thread cleared",
            messages: [
              {
                role: "system",
                content: "Thread reset.",
              },
            ],
            notes: [
              {
                type: "warn",
                text: "Conversation history was reset by preset action.",
              },
            ],
          };
        }

        if (typeof opts.onAction === "function") {
          return opts.onAction(normalized, payload, api);
        }

        return null;
      },
      onChat: function onAiChatMessage(message, channel, api) {
        if (typeof opts.onChat === "function") {
          return opts.onChat(message, channel, api);
        }

        if (opts.echoAssistant === false) {
          return null;
        }

        return {
          messages: [
            {
              role: "assistant",
              content: toText(opts.defaultAssistantPrefix, "Assistant") + ": " + message,
            },
          ],
        };
      },
    };
  }

  function createAiCharacterChatAdapter(options) {
    var opts = isObject(options) ? options : {};

    return {
      name: "ai-character-chat-preset",
      pollMs: clampNumber(opts.pollMs, 0, 120000, 0),
      load: function loadCharacterChatPreset(api) {
        if (!opts.seedSkeletonOnLoad) {
          return null;
        }

        return api.createAiCharacterChatSkeleton({
          characterName: toText(opts.characterName, "Character Guide"),
          threadTitle: toText(opts.threadTitle, "Main Thread"),
          openingMessage: toText(
            opts.openingMessage,
            "Character chat preset loaded and waiting for dialogue.",
          ),
        });
      },
      transform: function transformCharacterChat(input, helpers) {
        var source = isObject(input) ? input : {};
        var tables = getPath(source, "data.data");
        var hasAiTables = isObject(tables);

        var merged = source;
        if (!hasAiTables && opts.seedSkeletonWhenMissing) {
          var skeleton = helpers.createAiCharacterChatSkeleton({
            characterName: toText(opts.characterName, "Character Guide"),
            threadTitle: toText(opts.threadTitle, "Main Thread"),
            openingMessage: toText(
              opts.openingMessage,
              "Missing ai-character-chat tables were auto-seeded.",
            ),
          });
          merged = deepMerge(skeleton, source);
          tables = getPath(merged, "data.data");
        }

        var normalized = helpers.normalizeInput(merged);
        normalized.meta = normalized.meta || {};
        normalized.meta.mode = "ai-character-chat";

        var characters = getTableRows(tables, "characters");
        var threads = getTableRows(tables, "threads");
        var messages = getTableRows(tables, "messages");

        var characterName = pickString(
          normalized.meta.title,
          getPath(characters, "0.name"),
          getPath(characters, "0.id"),
          toText(opts.characterName, "AI Character Chat"),
        );

        normalized.meta.title = characterName;
        normalized.meta.subtitle =
          normalized.meta.subtitle ||
          toText(opts.subtitle, "Character thread viewer for https://perchance.org/ai-character-chat");
        normalized.meta.status =
          normalized.meta.status ||
          "Threads " + String(threads.length) + " | Messages " + String(messages.length);

        normalized.actions = mergeActionSets(
          normalized.actions,
          [
            { id: "focus-chat", label: "Reply", tone: "base" },
            { id: "refresh-data", label: "Refresh", tone: "ok" },
            { id: "seed-character-skeleton", label: "Seed Tables", tone: "warn" },
          ],
          helpers,
        );

        normalized.topData = normalized.topData || {};
        normalized.topData.worldSummary = mergeWorldSummary(
          normalized.topData.worldSummary,
          [
            { key: "Characters", value: String(characters.length) },
            { key: "Threads", value: String(threads.length) },
            { key: "Messages", value: String(messages.length) },
          ],
        );

        normalized.visuals = normalized.visuals || {};
        normalized.visuals.cards = mergeCards(
          normalized.visuals.cards,
          [
            {
              title: "Active Character",
              text: characterName,
              badge: "character",
              action: "focus-chat",
            },
            {
              title: "Thread Count",
              text: String(threads.length),
              badge: "threads",
              action: "refresh-data",
            },
          ],
        );

        normalized.bottomData = normalized.bottomData || {};
        normalized.bottomData.notes = mergeNotes(
          normalized.bottomData.notes,
          [
            {
              type: "info",
              text: "Preset active: ai-character-chat",
            },
          ],
        );

        return normalized;
      },
      onAction: function onAiCharacterAction(actionId, payload, api) {
        var normalized = api.normalizeRegistryId(actionId);

        if (normalized === "seed-character-skeleton") {
          if (typeof opts.onSeedSkeleton === "function") {
            return opts.onSeedSkeleton(payload, api);
          }

          return api.createAiCharacterChatSkeleton({
            characterName: toText(opts.characterName, "Character Guide"),
            threadTitle: toText(opts.threadTitle, "Main Thread"),
            openingMessage: toText(
              opts.openingMessage,
              "Character chat skeleton generated by preset action.",
            ),
          });
        }

        if (typeof opts.onAction === "function") {
          return opts.onAction(normalized, payload, api);
        }

        return null;
      },
      onChat: function onAiCharacterMessage(message, channel, api) {
        if (typeof opts.onChat === "function") {
          return opts.onChat(message, channel, api);
        }

        if (opts.echoAssistant === false) {
          return null;
        }

        return {
          messages: [
            {
              role: "assistant",
              content:
                toText(opts.characterName, "Character") +
                " replies: " +
                message,
            },
          ],
        };
      },
    };
  }

  function createAiRpgAdapter(options) {
    var opts = isObject(options) ? options : {};

    return {
      name: "ai-rpg-preset",
      pollMs: clampNumber(opts.pollMs, 0, 120000, 0),
      transform: function transformAiRpg(input, helpers) {
        var normalized = helpers.normalizeInput(input);

        normalized.meta = normalized.meta || {};
        normalized.meta.mode = "ai-rpg";
        normalized.meta.title = normalized.meta.title || toText(opts.title, "AI RPG");
        normalized.meta.subtitle =
          normalized.meta.subtitle ||
          toText(opts.subtitle, "Adventure preset for https://perchance.org/ai-rpg");
        normalized.meta.status = normalized.meta.status || toText(opts.status, "Adventure ready");

        normalized.actions = mergeActionSets(
          normalized.actions,
          [
            { id: "walk-here", label: "Move", tone: "base" },
            { id: "inspect-target", label: "Inspect", tone: "base" },
            { id: "next-rpg-turn", label: "Next Turn", tone: "ok" },
            { id: "open-quest-log", label: "Quest Log", tone: "base" },
          ],
          helpers,
        );

        normalized.topData = normalized.topData || {};
        normalized.topData.worldSummary = mergeWorldSummary(
          normalized.topData.worldSummary,
          [
            {
              key: "Campaign",
              value: pickString(
                getPath(input, "campaign"),
                getPath(input, "world"),
                getPath(input, "location"),
                toText(opts.campaign, "Default Campaign"),
              ),
            },
          ],
        );

        normalized.bottomData = normalized.bottomData || {};
        normalized.bottomData.notes = mergeNotes(
          normalized.bottomData.notes,
          [
            {
              type: "info",
              text: "Preset active: ai-rpg",
            },
          ],
        );

        normalized.visuals = normalized.visuals || {};
        normalized.visuals.cards = mergeCards(
          normalized.visuals.cards,
          [
            {
              title: "Current Objective",
              text: pickRpgObjective(input, normalized),
              badge: "objective",
              action: "open-quest-log",
            },
          ],
        );

        return normalized;
      },
      onAction: function onAiRpgAction(actionId, payload, api) {
        var normalized = api.normalizeRegistryId(actionId);

        if (normalized === "next-rpg-turn") {
          if (typeof opts.onNextTurn === "function") {
            return opts.onNextTurn(payload, api);
          }

          return {
            status: "Turn advanced",
            output: [
              {
                type: "info",
                text: "The party advances to the next turn.",
              },
            ],
          };
        }

        if (normalized === "open-quest-log") {
          if (typeof opts.onOpenQuestLog === "function") {
            return opts.onOpenQuestLog(payload, api);
          }

          return {
            output: [
              {
                type: "info",
                text: "Quest log viewed.",
              },
            ],
          };
        }

        if (typeof opts.onAction === "function") {
          return opts.onAction(normalized, payload, api);
        }

        return null;
      },
      onChat: function onAiRpgChat(message, channel, api) {
        if (typeof opts.onChat === "function") {
          return opts.onChat(message, channel, api);
        }

        if (opts.echoNarrator === false) {
          return null;
        }

        return {
          messages: [
            {
              role: "narrator",
              content: "Narrator: " + message,
            },
          ],
        };
      },
    };
  }

  function createPresetForLink(linkOrId, options) {
    var key = normalizeLinkOrId(linkOrId);

    if (key === "ai-chat") {
      return createAiChatAdapter(options);
    }

    if (key === "ai-character-chat") {
      return createAiCharacterChatAdapter(options);
    }

    if (key === "ai-rpg") {
      return createAiRpgAdapter(options);
    }

    return null;
  }

  function listPresetLinks() {
    return Object.assign({}, GENERATOR_LINKS);
  }

  function normalizeLinkOrId(linkOrId) {
    var input = toText(linkOrId, "").trim().toLowerCase();
    if (!input) {
      return "";
    }

    if (input === "ai-chat" || input === "ai-character-chat" || input === "ai-rpg") {
      return input;
    }

    if (input.indexOf("http://") === 0 || input.indexOf("https://") === 0) {
      input = input.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (input === GENERATOR_LINKS["ai-chat"]) {
        return "ai-chat";
      }
      if (input === GENERATOR_LINKS["ai-character-chat"]) {
        return "ai-character-chat";
      }
      if (input === GENERATOR_LINKS["ai-rpg"]) {
        return "ai-rpg";
      }
    }

    return "";
  }

  function getTableRows(tables, tableName) {
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

  function pickConversationPreview(normalized) {
    var entries = getPath(normalized, "chat.entries");
    if (!Array.isArray(entries) || !entries.length) {
      return "Conversation ready.";
    }

    var last = entries[entries.length - 1];
    return pickString(last.text, "Conversation ready.");
  }

  function pickRpgObjective(input, normalized) {
    return pickString(
      getPath(input, "objective"),
      getPath(input, "currentObjective"),
      getPath(input, "quests.active.0"),
      getPath(normalized, "topData.quests.active.0"),
      "Explore the current area.",
    );
  }

  function mergeActionSets(existing, defaults, helpers) {
    var current = Array.isArray(existing) ? existing.slice() : [];
    var incoming = Array.isArray(defaults) ? defaults : [];

    incoming.forEach(function (entry) {
      if (!isObject(entry)) {
        return;
      }

      var id = helpers.normalizeRegistryId(entry.id);
      if (!id) {
        return;
      }

      var index = current.findIndex(function (item) {
        return isObject(item) && helpers.normalizeRegistryId(item.id) === id;
      });

      if (index >= 0) {
        current[index] = Object.assign({}, entry, current[index]);
      } else {
        current.push(entry);
      }
    });

    return current;
  }

  function mergeCards(existing, defaults) {
    var current = Array.isArray(existing) ? existing.slice() : [];
    var incoming = Array.isArray(defaults) ? defaults : [];

    incoming.forEach(function (entry) {
      if (!isObject(entry)) {
        return;
      }

      var id = toText(entry.title, "").toLowerCase();
      var index = current.findIndex(function (card) {
        return toText(card && card.title, "").toLowerCase() === id;
      });

      if (index >= 0) {
        current[index] = Object.assign({}, entry, current[index]);
      } else {
        current.push(entry);
      }
    });

    return current.slice(0, 12);
  }

  function mergeWorldSummary(existing, defaults) {
    var current = Array.isArray(existing) ? existing.slice() : [];
    var incoming = Array.isArray(defaults) ? defaults : [];

    incoming.forEach(function (entry) {
      if (!isObject(entry)) {
        return;
      }

      var key = toText(entry.key, "").toLowerCase();
      if (!key) {
        return;
      }

      var index = current.findIndex(function (item) {
        return toText(item && item.key, "").toLowerCase() === key;
      });

      if (index >= 0) {
        current[index] = Object.assign({}, current[index], entry);
      } else {
        current.push(entry);
      }
    });

    return current;
  }

  function mergeNotes(existing, defaults) {
    var current = Array.isArray(existing) ? existing.slice() : [];
    var incoming = Array.isArray(defaults) ? defaults : [];
    var combined = current.concat(incoming);

    return combined
      .filter(function (item) {
        return isObject(item) && toText(item.text, "").trim().length > 0;
      })
      .slice(-120);
  }

  function deepMerge(base, extension) {
    if (!isObject(base)) {
      return isObject(extension) ? extension : base;
    }

    if (!isObject(extension)) {
      return base;
    }

    var out = {};
    var keys = Object.keys(base).concat(Object.keys(extension));

    keys.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        return;
      }

      var left = base[key];
      var right = extension[key];

      if (Array.isArray(left) && Array.isArray(right)) {
        out[key] = right;
        return;
      }

      if (isObject(left) && isObject(right)) {
        out[key] = deepMerge(left, right);
        return;
      }

      out[key] = right !== undefined ? right : left;
    });

    return out;
  }

  function getPath(value, path) {
    var parts = path.split(".");
    var current = value;
    for (var i = 0; i < parts.length; i += 1) {
      if (!isObject(current) && !Array.isArray(current)) {
        return undefined;
      }
      current = current[parts[i]];
    }
    return current;
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

  function toText(value, fallback) {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return fallback == null ? "" : String(fallback);
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, num));
  }

  function isObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  global.interfaceFrameworkV2Presets = {
    version: VERSION,
    links: listPresetLinks(),
    createAiChatAdapter: createAiChatAdapter,
    createAiCharacterChatAdapter: createAiCharacterChatAdapter,
    createAiRpgAdapter: createAiRpgAdapter,
    createPresetForLink: createPresetForLink,
    listPresetLinks: listPresetLinks,
  };
})(typeof window !== "undefined" ? window : globalThis);
