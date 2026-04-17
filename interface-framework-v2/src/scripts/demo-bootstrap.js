(function bootstrapInterfaceFrameworkV2Demo() {
  "use strict";

  if (typeof window.createInterfaceFrameworkV2 !== "function") {
    throw new Error("createInterfaceFrameworkV2 is not available on window.");
  }

  var root = document.getElementById("ifw2-demo-root");
  var modeOutput = document.getElementById("ifw2-demo-mode");
  var applyModeButtons = Array.prototype.slice.call(
    document.querySelectorAll("[data-demo-mode]"),
  );

  var scenarios = {
    chat: {
      title: "AI Chat Hub",
      subtitle: "Universal OSRS shell for conversational generators",
      mode: "ai-chat",
      status: "Connected to dialogue runtime",
      messages: [
        { role: "system", content: "Dialogue instance ready." },
        { role: "user", content: "How do I beat the next boss?" },
        {
          role: "assistant",
          content:
            "Use protect from missiles, keep movement tight, and save spec for phase two.",
        },
      ],
      actions: [
        { id: "send-strategy", label: "Strategy", tone: "ok" },
        { id: "open-build", label: "Build", tone: "base" },
        { id: "focus-chat", label: "Reply", tone: "base" },
      ],
      cards: [
        {
          title: "Current Topic",
          text: "Boss progression and gear planning.",
          badge: "Chat",
          action: "focus-chat",
        },
        {
          title: "Memory",
          text: "User prefers concise answers with practical steps.",
          badge: "Memory",
          action: "inspect-target",
        },
      ],
      summary: {
        languageModel: "GPT",
        thread: "raids-advice",
        persona: "Veteran ranger",
      },
      social: {
        friends: [
          { name: "Stone Lynx", online: true, world: 302 },
          { name: "Mire Finch", online: false, world: "-" },
        ],
        clan: "Dawn Watch",
        channel: "Tactics",
      },
    },
    rpg: {
      title: "Interactive RPG Session",
      subtitle: "Quest, combat, and inventory in one universal frame",
      mode: "ai-rpg",
      status: "Adventure state synchronized",
      stats: {
        hp: 84,
        maxHp: 99,
        prayer: 67,
        maxPrayer: 99,
        run: 76,
        spec: 42,
        running: true,
      },
      markers: {
        player: { x: 42, y: 62 },
        target: { x: 71, y: 39 },
      },
      inventory: [
        { name: "Rune scimitar", qty: 1 },
        { name: "Shark", qty: 8 },
        { name: "Prayer potion", qty: 4 },
        { name: "Stamina potion", qty: 2 },
      ],
      equipment: {
        head: "Neitiznot helm",
        body: "Fighter torso",
        legs: "Rune platelegs",
        weapon: "Rune scimitar",
      },
      quests: {
        completed: 113,
        total: 158,
        inProgress: 3,
        active: ["Desert Treasure II", "Monkey Madness II", "Song of the Elves"],
      },
      skills: {
        attack: 82,
        strength: 88,
        defence: 79,
        slayer: 77,
      },
      spells: ["Wind Blast", "High Alchemy", "Camelot Teleport", "Snare"],
      prayers: [
        { name: "Protect from Missiles", active: true },
        { name: "Piety", active: false },
      ],
      notes: [
        { type: "info", text: "A mysterious gate blocks the route north." },
        { type: "warn", text: "Combat level recommendation: 95+" },
      ],
      actions: [
        { id: "walk-here", label: "Move", tone: "base" },
        { id: "inspect-target", label: "Inspect", tone: "base" },
        { id: "open-quest-log", label: "Quest Log", tone: "ok" },
      ],
    },
    quiz: {
      title: "Geography Guesser",
      subtitle: "Question-driven interfaces rendered in RPG client layout",
      mode: "guesser",
      status: "Waiting for answer",
      question: "Which city is known as the City of Canals?",
      choices: [
        { id: "choice-venice", label: "Venice", tone: "ok" },
        { id: "choice-prague", label: "Prague", tone: "base" },
        { id: "choice-amsterdam", label: "Amsterdam", tone: "base" },
        { id: "choice-bruges", label: "Bruges", tone: "base" },
      ],
      output: [
        { type: "info", text: "Round 7 of 20." },
        { type: "info", text: "Hint budget remaining: 2." },
      ],
      summary: {
        score: "12/18",
        streak: 4,
        topic: "European cities",
      },
      messages: [
        { role: "system", content: "Select an answer from the action panel." },
      ],
      cards: [
        {
          title: "Prompt",
          text: "Which city is known as the City of Canals?",
          badge: "Quiz",
          action: "focus-chat",
        },
      ],
    },
    image: {
      title: "Text-to-Image Studio",
      subtitle: "Visual output workflow in a game-like interface",
      mode: "text-to-image",
      status: "Render queue complete",
      prompt:
        "A high-detail old school fantasy harbor at sunrise, lively market, painterly style",
      negativePrompt: "blurry, washed out, low detail",
      style: "OSRS painterly",
      generatedImages: [
        {
          url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=512&q=60",
          label: "Candidate A",
          caption: "Warm morning light",
        },
        {
          url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=512&q=60",
          label: "Candidate B",
          caption: "Dense market atmosphere",
        },
        {
          url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=512&q=60",
          label: "Candidate C",
          caption: "Painterly composition",
        },
      ],
      files: [
        { name: "seed-124839.png", kind: "image" },
        { name: "prompt-run-04.json", kind: "json" },
      ],
      actions: [
        { id: "reroll-image", label: "Reroll", tone: "warn" },
        { id: "upscale-image", label: "Upscale", tone: "ok" },
        { id: "export-batch", label: "Export", tone: "base" },
      ],
      messages: [
        { role: "system", content: "3 image candidates generated." },
        { role: "assistant", content: "Use assets tab to inspect files and prompt metadata." },
      ],
    },
  };

  var activeMode = "chat";

  var app = window.createInterfaceFrameworkV2({
    mount: root,
    title: "Interface Framework v2",
    subtitle: "Universal OSRS-style shell",
    mode: "universal",
    adapter: {
      name: "demo-adapter",
      onAction: function onAction(actionId) {
        if (actionId.indexOf("choice-") === 0) {
          app.pushFeed("System", "Answer selected: " + actionId.replace(/^choice-/, "") + ".");
          return {
            status: "Answer submitted",
            output: [{ type: "ok", text: "Answer received: " + actionId + "." }],
          };
        }

        if (actionId === "send-strategy") {
          app.pushFeed("Game", "Suggested route: kite first phase, burst second phase.");
        }

        if (actionId === "open-build") {
          return {
            notes: [
              {
                type: "info",
                text: "Build opened: balanced melee setup with emergency teleport.",
              },
            ],
          };
        }

        if (actionId === "reroll-image") {
          app.pushFeed("System", "Image reroll requested.");
        }

        if (actionId === "upscale-image") {
          app.pushFeed("System", "Upscale pipeline started.");
        }

        if (actionId === "export-batch") {
          var skeleton = app.createAiCharacterChatSkeleton({
            characterName: "Studio Assistant",
            threadTitle: "Export Thread",
          });
          app.pushFeed(
            "System",
            "Export skeleton prepared with tables: " +
              Object.keys(skeleton.data.data).join(", ") +
              ".",
          );
        }

        return null;
      },
      onChat: function onChat(message, channel) {
        if (channel === "Public") {
          return {
            messages: [
              {
                role: "assistant",
                content: "Demo echo: " + message,
              },
            ],
          };
        }
        return null;
      },
    },
  });

  function applyScenario(modeName) {
    var scenario = scenarios[modeName];
    if (!scenario) {
      return;
    }

    activeMode = modeName;
    app.setData(scenario, "demo-scenario:" + modeName);
    app.setMode(scenario.mode || modeName);
    app.setStatus(scenario.status || "Ready");
    if (modeOutput) {
      modeOutput.textContent = modeName;
    }
  }

  applyModeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var modeName = button.getAttribute("data-demo-mode") || "chat";
      applyScenario(modeName);
    });
  });

  applyScenario(activeMode);

  var rotation = ["chat", "rpg", "quiz", "image"];
  var rotationIndex = 0;
  setInterval(function () {
    rotationIndex = (rotationIndex + 1) % rotation.length;
    applyScenario(rotation[rotationIndex]);
  }, 18000);
})();
