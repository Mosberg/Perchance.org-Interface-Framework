const CC_CONTEXT_STATE = oc.thread.customData.hiddenContext ?? {
  lastNotesHash: "",
};
oc.thread.customData.hiddenContext = CC_CONTEXT_STATE;

const CC_CONTEXT_RULES = [
  {
    test: /\bcode|program|debug|bug|javascript|python|typescript\b/i,
    note: "If code is requested, provide runnable examples and explain assumptions briefly.",
  },
  {
    test: /\bmath|equation|calculate|solve\b/i,
    note: "If math is requested, show steps and keep notation precise.",
  },
  {
    test: /\broleplay|rp|in character|stay in character\b/i,
    note: "Stay fully in character and avoid controlling user actions.",
  },
  {
    test: /\bshort|concise|brief\b/i,
    note: "Keep the response concise unless the user explicitly asks for depth.",
  },
];

function ccHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

function ccInjectHiddenGuidance(lines) {
  const body = `Conversation guidance:\n- ${lines.join("\n- ")}`;
  oc.thread.messages.push({
    author: "system",
    hiddenFrom: ["user"],
    expectsReply: false,
    content: body,
  });
}

oc.thread.on("MessageAdded", function ({ message }) {
  if (message.author !== "user") return;

  const text = message.content || "";
  const notes = CC_CONTEXT_RULES.filter((r) => r.test.test(text)).map(
    (r) => r.note,
  );
  if (notes.length === 0) return;

  const hash = ccHash(notes.join("|"));
  if (hash === CC_CONTEXT_STATE.lastNotesHash) return;

  CC_CONTEXT_STATE.lastNotesHash = hash;
  ccInjectHiddenGuidance(notes);
});
