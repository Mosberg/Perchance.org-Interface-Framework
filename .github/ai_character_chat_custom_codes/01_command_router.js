const CC_ROUTER_STATE = oc.thread.customData.commandRouter ?? {
  mode: "default",
  lastRoll: null,
};
oc.thread.customData.commandRouter = CC_ROUTER_STATE;

function ccRemoveMessageObject(target) {
  const idx = oc.thread.messages.findIndex((m) => m === target);
  if (idx !== -1) oc.thread.messages.splice(idx, 1);
}

function ccSystemToUser(content) {
  oc.thread.messages.push({
    author: "system",
    hiddenFrom: ["ai"],
    expectsReply: false,
    content,
  });
}

function ccSetSceneMode(mode) {
  const scenes = {
    default: { url: "", filter: "none" },
    neon: {
      url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
      filter: "hue-rotate(250deg) saturate(1.3) brightness(0.9)",
    },
    sunset: {
      url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
      filter: "saturate(1.1) contrast(1.05)",
    },
    storm: {
      url: "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1600&q=80",
      filter: "grayscale(0.2) contrast(1.15) brightness(0.8)",
    },
  };

  const key = scenes[mode] ? mode : "default";
  CC_ROUTER_STATE.mode = key;

  oc.thread.messages.push({
    author: "system",
    hiddenFrom: ["user"],
    expectsReply: false,
    content: `Scene mode set to ${key}.`,
    scene: {
      background: {
        url: scenes[key].url,
        filter: scenes[key].filter,
      },
    },
  });
}

function ccHandleRoll(rawArg) {
  const arg = (rawArg || "1d6").replace(/\s+/g, "");
  const m = arg.match(/^(\d{1,2})d(\d{1,5})([+-]\d+)?$/i);
  if (!m) return "Invalid format. Use /roll 2d20+3";

  const dice = Math.max(1, Math.min(parseInt(m[1], 10), 50));
  const sides = Math.max(2, Math.min(parseInt(m[2], 10), 100000));
  const mod = parseInt(m[3] || "0", 10) || 0;

  const rolls = Array.from(
    { length: dice },
    () => 1 + Math.floor(Math.random() * sides),
  );
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + mod;

  CC_ROUTER_STATE.lastRoll = { arg, rolls, mod, total, time: Date.now() };
  return `Rolled ${arg}: [${rolls.join(", ")}]${mod ? ` ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}` : ""} = ${total}`;
}

oc.thread.on("MessageAdded", function ({ message }) {
  if (message.author !== "user") return;

  const content = (message.content || "").trim();
  if (!content.startsWith("/")) return;

  const [cmdRaw, ...rest] = content.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = rest.join(" ").trim();

  let handled = true;
  if (cmd === "/help") {
    ccSystemToUser("Commands: /help, /charname, /persona, /mode, /roll");
  } else if (cmd === "/charname") {
    if (!arg) ccSystemToUser("Usage: /charname New Name");
    else {
      oc.character.name = arg;
      ccSystemToUser(`Character name updated to ${arg}.`);
    }
  } else if (cmd === "/persona") {
    if (!arg) ccSystemToUser("Usage: /persona Your role instruction text");
    else {
      oc.character.roleInstruction = arg;
      ccSystemToUser("Role instruction updated.");
    }
  } else if (cmd === "/mode") {
    ccSetSceneMode((arg || "default").toLowerCase());
    ccSystemToUser(`Mode is now ${CC_ROUTER_STATE.mode}.`);
  } else if (cmd === "/roll") {
    ccSystemToUser(ccHandleRoll(arg));
  } else {
    handled = false;
  }

  if (handled) ccRemoveMessageObject(message);
});
