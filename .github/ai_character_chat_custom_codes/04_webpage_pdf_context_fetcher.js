const CC_WEB_STATE = oc.thread.customData.webFetcher ?? {
  busy: false,
};
oc.thread.customData.webFetcher = CC_WEB_STATE;

const CC_WEB_MAX_CHARS = 5000;
const CC_WEB_TIMEOUT_MS = 15000;

function ccExtractUrls(text) {
  return [
    ...String(text || "").matchAll(
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    ),
  ].map((m) => m[0]);
}

async function ccFetchBlobWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}

async function ccEnsureReadability() {
  if (!window.Readability) {
    window.Readability =
      await import("https://esm.sh/@mozilla/readability@0.4.4?no-check").then(
        (m) => m.Readability,
      );
  }
}

async function ccEnsurePdfJs() {
  if (!window.pdfjsLib) {
    window.pdfjsLib =
      await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.6.172/+esm").then(
        (m) => m.default,
      );
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.6.172/build/pdf.worker.min.js";
  }
}

async function ccExtractPdfText(arrayBuffer) {
  const doc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = Array.from({ length: doc.numPages }, async (_, i) => {
    const page = await doc.getPage(i + 1);
    const content = await page.getTextContent();
    return content.items.map((token) => token.str).join(" ");
  });
  return (await Promise.all(pageTexts)).join(" ");
}

function ccPushHiddenContext(content) {
  oc.thread.messages.push({
    author: "system",
    hiddenFrom: ["user"],
    expectsReply: false,
    content,
  });
}

oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "user") return;
  if (CC_WEB_STATE.busy) return;

  const urls = ccExtractUrls(message.content);
  if (urls.length === 0) return;

  CC_WEB_STATE.busy = true;
  try {
    const url = urls.at(-1);
    const blob = await ccFetchBlobWithTimeout(url, CC_WEB_TIMEOUT_MS);

    let extractedText = "";
    if (blob.type === "application/pdf") {
      await ccEnsurePdfJs();
      extractedText = await ccExtractPdfText(await blob.arrayBuffer());
    } else {
      await ccEnsureReadability();
      const html = await blob.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const article = new window.Readability(doc).parse();
      const title = article?.title || "(no page title)";
      const body = article?.textContent || "";
      extractedText = `# ${title}\n\n${body}`;
    }

    extractedText = extractedText.slice(0, CC_WEB_MAX_CHARS);
    ccPushHiddenContext(
      `Web content extracted from ${url}:\n\n${extractedText}`,
    );
  } catch (err) {
    console.error("web fetcher failed", err);
    ccPushHiddenContext(
      `Note: Failed to fetch linked content (${String(err.message || err)}).`,
    );
  } finally {
    CC_WEB_STATE.busy = false;
  }
});
