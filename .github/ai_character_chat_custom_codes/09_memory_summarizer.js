const CC_MEMORY = oc.thread.customData.memorySummary ?? {
  summary: "",
  turnsSinceRefresh: 0,
  refreshEvery: 6,
  maxWindowMessages: 14,
  running: false,
  lastInjectedAtMessageCount: -1,
};
oc.thread.customData.memorySummary = CC_MEMORY;

function ccRecentDialogText() {
  return oc.thread.messages
    .slice(-CC_MEMORY.maxWindowMessages)
    .filter((m) => m.author !== "system")
    .map((m) => `[${m.author}] ${m.content}`)
    .join("\n\n")
    .slice(0, 16000);
}

async function ccRefreshMemorySummary() {
  if (CC_MEMORY.running) return;
  CC_MEMORY.running = true;
  try {
    const context = ccRecentDialogText();
    if (!context.trim()) return;

    const result = await oc.getInstructCompletion({
      instruction: [
        "Summarize durable context for future turns.",
        "Include only:",
        "- user goals and preferences",
        "- unresolved tasks",
        "- important facts and constraints",
        "Keep it under 180 words.",
        "",
        context,
      ].join("\n"),
      startWith: "",
    });

    const summary = (result.generatedText || result.text || "").trim();
    if (summary) CC_MEMORY.summary = summary;
  } catch (err) {
    console.error("memory summarizer failed", err);
  } finally {
    CC_MEMORY.running = false;
  }
}

oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "ai") return;

  CC_MEMORY.turnsSinceRefresh += 1;
  if (CC_MEMORY.turnsSinceRefresh < CC_MEMORY.refreshEvery) return;

  CC_MEMORY.turnsSinceRefresh = 0;
  await ccRefreshMemorySummary();
});

oc.thread.on("MessageAdded", function ({ message }) {
  if (message.author !== "user") return;
  if (!CC_MEMORY.summary) return;

  const messageCount = oc.thread.messages.length;
  if (CC_MEMORY.lastInjectedAtMessageCount === messageCount) return;
  CC_MEMORY.lastInjectedAtMessageCount = messageCount;

  oc.thread.messages.push({
    author: "system",
    hiddenFrom: ["user"],
    expectsReply: false,
    content: `Memory summary:\n${CC_MEMORY.summary}`,
  });
});
