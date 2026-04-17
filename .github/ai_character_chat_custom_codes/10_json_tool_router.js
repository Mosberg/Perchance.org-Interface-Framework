const CC_TOOL_STATE = oc.thread.customData.toolRouter ?? {
  running: false,
};
oc.thread.customData.toolRouter = CC_TOOL_STATE;

const CC_TOOLS = {
  now: async () => ({ now: new Date().toISOString() }),
  random_int: async ({ min = 1, max = 10 } = {}) => {
    const lo = Math.min(Number(min), Number(max));
    const hi = Math.max(Number(min), Number(max));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      throw new Error("random_int requires numeric min/max");
    }
    const value = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    return { min: lo, max: hi, value };
  },
  set_name: async ({ name } = {}) => {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("set_name requires a non-empty name");
    oc.character.name = clean;
    return { name: clean };
  },
};

function ccParseJsonObject(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "user") return;
  if (CC_TOOL_STATE.running) return;

  CC_TOOL_STATE.running = true;
  try {
    const decision = await oc.getInstructCompletion({
      instruction: [
        "Return JSON only.",
        "Pick one action from: now, random_int, set_name, none.",
        "Shape:",
        '{"action":"<name>","args":{...}}',
        "Use action=none if no tool is needed.",
        "",
        `User message: ${message.content}`,
      ].join("\n"),
      startWith: "{",
      stopSequences: ["\n\n"],
    });

    const parsed = ccParseJsonObject(
      decision.generatedText ? `{${decision.generatedText}` : decision.text,
    );
    if (!parsed || typeof parsed.action !== "string") return;
    if (parsed.action === "none") return;

    const toolFn = CC_TOOLS[parsed.action];
    if (!toolFn) return;

    const result = await toolFn(parsed.args || {});

    oc.thread.messages.push({
      author: "system",
      hiddenFrom: ["user"],
      expectsReply: false,
      content: `Tool result (${parsed.action}): ${JSON.stringify(result)}`,
    });
  } catch (err) {
    console.error("tool router failed", err);
  } finally {
    CC_TOOL_STATE.running = false;
  }
});
