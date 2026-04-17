while (speechSynthesis.getVoices().length === 0) {
  await new Promise((r) => setTimeout(r, 15));
}

const CC_TTS_STATE = oc.thread.customData.browserTts ?? {
  enabled: true,
  voiceName: speechSynthesis.getVoices()[0]?.name || "",
};
oc.thread.customData.browserTts = CC_TTS_STATE;

const availableVoices = speechSynthesis
  .getVoices()
  .map((v) => v.name)
  .sort((a, b) => a.localeCompare(b));

window.ccSetVoiceName = function (value) {
  CC_TTS_STATE.voiceName = value;
};

window.ccToggleTts = function () {
  CC_TTS_STATE.enabled = !CC_TTS_STATE.enabled;
  const btn = document.getElementById("cc-tts-toggle");
  if (btn)
    btn.textContent = CC_TTS_STATE.enabled ? "Disable TTS" : "Enable TTS";
};

window.ccCloseTtsPicker = function () {
  oc.window.hide();
};

document.body.innerHTML = `
  <div style="font-family:ui-sans-serif,system-ui; padding:10px; max-width:340px;">
    <div style="font-weight:700; margin-bottom:0.45rem;">Streaming Browser TTS</div>
    <label style="font-size:0.9rem;">Voice</label><br>
    <select style="margin-top:0.2rem; margin-bottom:0.55rem; width:100%;" onchange="ccSetVoiceName(this.value)">
      ${availableVoices
        .map(
          (n) =>
            `<option ${n === CC_TTS_STATE.voiceName ? "selected" : ""}>${n}</option>`,
        )
        .join("")}
    </select>
    <div style="display:flex; gap:0.45rem;">
      <button id="cc-tts-toggle" onclick="ccToggleTts()">${CC_TTS_STATE.enabled ? "Disable TTS" : "Enable TTS"}</button>
      <button onclick="ccCloseTtsPicker()">Close</button>
    </div>
  </div>
`;
oc.window.show();

let ccSentenceBuffer = "";

oc.thread.on("MessageStreaming", async function (data) {
  if (!CC_TTS_STATE.enabled) return;

  for await (const chunk of data.chunks) {
    ccSentenceBuffer += chunk.text;

    const endIndex = Math.max(
      ccSentenceBuffer.indexOf("."),
      ccSentenceBuffer.indexOf("!"),
      ccSentenceBuffer.indexOf("?"),
    );

    if (endIndex === -1) continue;

    const sentence = ccSentenceBuffer.slice(0, endIndex + 1);
    ccSentenceBuffer = ccSentenceBuffer
      .slice(endIndex + 1)
      .replace(/^[.!?\s]+/g, "");

    try {
      await ccSpeakSentence(sentence, CC_TTS_STATE.voiceName);
    } catch (err) {
      console.error("tts failed", err);
    }
  }
});

function ccSpeakSentence(text, voiceName) {
  return new Promise((resolve, reject) => {
    const voice = speechSynthesis.getVoices().find((v) => v.name === voiceName);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice || null;
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.onend = resolve;
    utterance.onerror = reject;
    speechSynthesis.speak(utterance);
  });
}
