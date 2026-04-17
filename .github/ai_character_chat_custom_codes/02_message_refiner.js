const CC_REFINER_STATE = oc.thread.customData.messageRefiner ?? {
  enabled: true,
  running: false,
};
oc.thread.customData.messageRefiner = CC_REFINER_STATE;

oc.thread.on("MessageAdded", async function ({ message }) {
  if (!CC_REFINER_STATE.enabled) return;
  if (CC_REFINER_STATE.running) return;
  if (message.author !== "ai") return;
  if (message.customData?.refinedByCustomCode) return;

  CC_REFINER_STATE.running = true;
  try {
    const result = await oc.getInstructCompletion({
      instruction: [
        "Rewrite the following message.",
        "Requirements:",
        "- Keep original meaning.",
        "- Keep markdown intact.",
        "- Remove repetition and filler.",
        "- Keep tone natural and concise.",
        "- Return only the rewritten message.",
        "",
        "---",
        message.content,
        "---",
      ].join("\n"),
      startWith: "",
    });

    const rewritten = (result.generatedText || result.text || "").trim();
    if (rewritten) message.content = rewritten;

    message.customData ??= {};
    message.customData.refinedByCustomCode = true;
  } catch (err) {
    console.error("message refiner failed", err);
  } finally {
    CC_REFINER_STATE.running = false;
  }
});
