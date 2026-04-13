import { requireLogin } from "../auth.js";
    import { mountShell, setContent } from "../nav.js";
    import { api } from "../api.js";

    requireLogin();
    await mountShell("modai");

    setContent(`
      <div class="grid">
        <div class="card" style="grid-column: span 12">
          <div class="h1">AI / Ollama</div>
          <div class="muted">Manage the local Ollama AI service used for content moderation and chat.</div>
        </div>

        <div class="card" style="grid-column: span 6" id="status-card">
          <div class="h2">Ollama Status</div>
          <div id="status-body" class="muted">Checking...</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="secondary" id="btn-refresh">Refresh</button>
            <button id="btn-install">Install Ollama (current user)</button>
          </div>
          <div id="install-log" style="margin-top:10px;display:none">
            <div class="h2">Install log</div>
            <pre id="install-log-text" style="max-height:200px;overflow:auto;font-size:12px"></pre>
          </div>
        </div>

        <div class="card" style="grid-column: span 6" id="models-card">
          <div class="h2">Models</div>
          <div id="models-list" class="muted">No models loaded.</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="pull-model-input" type="text" placeholder="Model name (e.g. llama3.2)" style="flex:1;min-width:120px">
            <button id="btn-pull">Pull model</button>
          </div>
          <div id="pull-status" style="margin-top:6px;font-size:13px"></div>
        </div>

        <div class="card" style="grid-column: span 12" id="chat-card">
          <div class="h2">AI Chat</div>
          <div class="muted" style="margin-bottom:8px">Chat directly with the local AI model.</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
            <span style="font-size:13px">Model:</span>
            <input id="chat-model-input" type="text" value="llama3.2" style="width:180px">
          </div>
          <div id="chat-messages" style="min-height:200px;max-height:400px;overflow-y:auto;background:var(--surface,#1a1f28);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px"></div>
          <div style="display:flex;gap:8px">
            <textarea id="chat-input" rows="2" placeholder="Type a message..." style="flex:1;resize:vertical"></textarea>
            <button id="btn-send" style="align-self:flex-end">Send</button>
          </div>
          <div id="chat-status" style="margin-top:6px;font-size:13px"></div>
        </div>
      </div>
    `);

    const statusBody = document.getElementById("status-body");
    const modelsList = document.getElementById("models-list");
    const installLog = document.getElementById("install-log");
    const installLogText = document.getElementById("install-log-text");
    let installPoller = null;

    function renderStatus(data) {
      if (data.running) {
        statusBody.innerHTML = `<span class="badge good">Running</span> &nbsp; version: <b>${data.version ?? "unknown"}</b>`;
      } else {
        statusBody.innerHTML = `<span class="badge bad">Not running</span> — Ollama is not reachable at localhost:11434.`;
      }
      if (Array.isArray(data.models) && data.models.length) {
        modelsList.innerHTML = data.models.map((m) =>
          `<div class="item"><b>${m.name}</b> <span class="small muted">${m.size ? (m.size / 1e9).toFixed(1) + " GB" : ""}</span></div>`
        ).join("");
      } else {
        modelsList.innerHTML = `<div class="muted">No models pulled yet. Use "Pull model" to download one.</div>`;
      }
      renderInstallState(data.install);
    }

    function renderInstallState(inst) {
      if (!inst) return;
      if (inst.running || inst.done || inst.error || inst.log?.length) {
        installLog.style.display = "";
        installLogText.textContent = (inst.log || []).join("\n");
        installLogText.scrollTop = installLogText.scrollHeight;
      }
      if (inst.running) {
        document.getElementById("btn-install").disabled = true;
        document.getElementById("btn-install").textContent = "Installing...";
      } else {
        document.getElementById("btn-install").disabled = false;
        document.getElementById("btn-install").textContent = "Install Ollama (current user)";
      }
    }

    async function loadStatus() {
      statusBody.textContent = "Checking...";
      try {
        const data = await api.get("/api/mod/ai/status");
        renderStatus(data);
        return data;
      } catch (err) {
        statusBody.textContent = "Could not reach server.";
      }
    }

    function startInstallPoller() {
      if (installPoller) return;
      installPoller = setInterval(async () => {
        try {
          const data = await api.get("/api/mod/ai/install/status");
          renderInstallState(data);
          if (!data.running) {
            clearInterval(installPoller);
            installPoller = null;
            await loadStatus();
          }
        } catch {}
      }, 2000);
    }

    document.getElementById("btn-refresh").addEventListener("click", loadStatus);

    document.getElementById("btn-install").addEventListener("click", async () => {
      if (!confirm("Install Ollama for the current user? This will download and run the Ollama installer.")) return;
      try {
        await api.post("/api/mod/ai/install", {});
        installLog.style.display = "";
        installLogText.textContent = "Starting install...";
        startInstallPoller();
      } catch (err) {
        alert("Install failed: " + (err?.data?.error || err?.message || "unknown error"));
      }
    });

    document.getElementById("btn-pull").addEventListener("click", async () => {
      const model = document.getElementById("pull-model-input").value.trim();
      if (!model) { alert("Enter a model name."); return; }
      const pullStatus = document.getElementById("pull-status");
      pullStatus.textContent = `Pulling ${model}... (this may take a few minutes)`;
      document.getElementById("btn-pull").disabled = true;
      try {
        await api.post("/api/mod/ai/pull", { model });
        pullStatus.textContent = `✅ Model "${model}" pulled successfully.`;
        await loadStatus();
      } catch (err) {
        pullStatus.textContent = "Pull failed: " + (err?.data?.error || err?.message || "unknown error");
      } finally {
        document.getElementById("btn-pull").disabled = false;
      }
    });

    // ── Chat ────────────────────────────────────────────────────────────────
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatStatus = document.getElementById("chat-status");
    const history = [];

    function appendMessage(role, content) {
      const div = document.createElement("div");
      div.style.cssText = `padding:8px 12px;border-radius:6px;max-width:80%;word-break:break-word;` +
        (role === "user"
          ? "align-self:flex-end;background:var(--accent,#4f8ef7);color:#fff;"
          : "align-self:flex-start;background:var(--card,#232936);");
      div.textContent = content;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    document.getElementById("btn-send").addEventListener("click", async () => {
      const text = chatInput.value.trim();
      if (!text) return;
      const model = document.getElementById("chat-model-input").value.trim() || "llama3.2";
      chatInput.value = "";
      chatStatus.textContent = "";
      appendMessage("user", text);
      history.push({ role: "user", content: text });

      document.getElementById("btn-send").disabled = true;
      chatStatus.textContent = "Thinking...";
      try {
        const data = await api.post("/api/mod/ai/chat", { model, messages: history });
        const reply = data?.message?.content || "(no response)";
        history.push({ role: "assistant", content: reply });
        appendMessage("assistant", reply);
        chatStatus.textContent = "";
      } catch (err) {
        chatStatus.textContent = "Error: " + (err?.data?.error || err?.message || "Could not reach Ollama.");
      } finally {
        document.getElementById("btn-send").disabled = false;
      }
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.getElementById("btn-send").click();
      }
    });

    await loadStatus();
