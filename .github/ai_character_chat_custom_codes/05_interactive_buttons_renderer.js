oc.messageRenderingPipeline.push(function ({ message, reader }) {
  if (reader !== "user") return;
  if (typeof message.content !== "string") return;

  message.content = message.content.replace(/\[\[(.+?)\]\]/g, (_, label) => {
    const cleanLabel = String(label).trim();
    const encoded = encodeURIComponent(cleanLabel);
    return `<button style="margin:0.2rem 0.25rem; padding:0.35rem 0.65rem; border-radius:0.55rem; border:1px solid #8ca0b3; background:#f2f6fb; cursor:pointer;" onclick="oc.thread.messages.push({author:'user', content:decodeURIComponent('${encoded}')});">${cleanLabel}</button>`;
  });
});
