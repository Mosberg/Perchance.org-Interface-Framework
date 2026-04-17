delete window.sessionStorage;
window.sessionStorage = {};

if (!window.__ccPyRunner) {
  await import("https://cdn.jsdelivr.net/pyodide/v0.26.3/full/pyodide.js");

  const printed = [];
  const errors = [];

  const pyodide = await loadPyodide({
    stdout: (line) => printed.push(line),
    stderr: (line) => errors.push(line),
  });

  await pyodide.loadPackage("micropip");

  window.__ccPyRunner = {
    pyodide,
    printed,
    errors,
    running: false,
  };
}

function ccExtractPythonBlocks(text) {
  return [
    ...String(text || "").matchAll(/```(?:python|py)?\n(.+?)\n```/gs),
  ].map((m) => m[1]);
}

oc.thread.on("MessageAdded", async function ({ message }) {
  if (message.author !== "ai") return;

  const codeBlocks = ccExtractPythonBlocks(message.content);
  if (codeBlocks.length === 0) return;
  if (window.__ccPyRunner.running) return;

  window.__ccPyRunner.running = true;
  try {
    const code = codeBlocks.join("\n\n");

    window.__ccPyRunner.printed.length = 0;
    window.__ccPyRunner.errors.length = 0;

    await window.__ccPyRunner.pyodide
      .runPythonAsync(code)
      .catch((e) => window.__ccPyRunner.errors.push(e.message));

    let content = "";
    if (window.__ccPyRunner.printed.length > 0) {
      content += `**Code Execution Output**:\n\n${window.__ccPyRunner.printed.join("\n")}`;
    }
    if (window.__ccPyRunner.errors.length > 0) {
      content += `\n\n**Code Execution Errors**:\n\n\`\`\`\n${window.__ccPyRunner.errors.join("\n")}\n\`\`\``;
    }
    if (!content.trim()) {
      content =
        "(The Python code ran successfully, but there was no printed output.)";
    }

    oc.thread.messages.push({
      author: "user",
      expectsReply: false,
      content,
    });
  } finally {
    window.__ccPyRunner.running = false;
  }
});
