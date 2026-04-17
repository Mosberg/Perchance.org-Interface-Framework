export function createChatModule(app) {
  const { state, refs } = app;

  function sendChat() {
    const message = refs.chatInput.value.trim();
    if (!message) {
      return;
    }

    if (message.toLowerCase().startsWith("::wiki ")) {
      const term = message.slice(7).trim();
      pushChat("System", `Wiki lookup requested for '${term || "unknown"}'.`);
      refs.chatInput.value = "";
      app.notify("info", "Wiki command issued.");
      return;
    }

    if (message.startsWith("/@")) {
      const privateText = message.replace(/^\/@\S+\s*/, "").trim();
      pushChat("Private", privateText || "(empty private message)");
      refs.chatInput.value = "";
      return;
    }

    let channel = state.ui.chatChannel;
    let text = message;

    if (message.startsWith("/p ")) {
      channel = "Public";
      text = message.slice(3).trim();
    } else if (message.startsWith("// ")) {
      channel = "Clan";
      text = message.slice(3).trim();
    } else if (message.startsWith("/// ")) {
      channel = "Trade";
      text = message.slice(4).trim();
    }

    pushChat(channel, text || "...");
    refs.chatInput.value = "";
  }

  function pushChat(channel, text) {
    state.chat.entries.push({ channel, text });
    state.chat.entries = state.chat.entries.slice(-180);
    app.renderChatLog();
  }

  return {
    sendChat,
    pushChat,
  };
}
