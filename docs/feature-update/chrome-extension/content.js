// Driplare AI Content Script for Meta Business Suite
(function () {
  if (window.__driplareInjected) return;
  window.__driplareInjected = true;

  console.log("[Driplare AI] Injecting Copilot into Meta Business Suite...");

  // Create floating widget container
  const container = document.createElement("div");
  container.id = "driplare-copilot-container";
  container.className = "driplare-collapsed";

  container.innerHTML = `
    <div id="driplare-toggle-btn" title="Toggle Driplare AI Copilot">
      <div class="driplare-badge-dot"></div>
      <svg class="driplare-logo-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span class="driplare-btn-label">Driplare AI</span>
    </div>

    <div id="driplare-sidebar-panel">
      <div class="driplare-panel-header">
        <div class="driplare-brand">
          <span class="driplare-brand-name">Driplare AI</span>
          <span class="driplare-brand-sub">Meta Copilot</span>
        </div>
        <button id="driplare-close-btn" class="driplare-icon-btn">&times;</button>
      </div>

      <div class="driplare-panel-body">
        <!-- AI Toggle -->
        <div class="driplare-card">
          <div class="driplare-card-row">
            <div>
              <div class="driplare-label">AI Status</div>
              <div class="driplare-sublabel" id="driplare-ai-status-text">AI is actively replying</div>
            </div>
            <label class="driplare-switch">
              <input type="checkbox" id="driplare-ai-toggle" checked>
              <span class="driplare-slider"></span>
            </label>
          </div>
        </div>

        <!-- Quick Summary & Suggested Reply -->
        <div class="driplare-card">
          <div class="driplare-label">AI Assistant</div>
          <div class="driplare-action-buttons">
            <button id="driplare-btn-summarize" class="driplare-action-btn">
              <span>📋 Summary</span>
            </button>
            <button id="driplare-btn-suggest" class="driplare-action-btn driplare-action-btn-primary">
              <span>✨ Suggest Reply</span>
            </button>
          </div>
          <div id="driplare-ai-output" class="driplare-output-box" style="display:none;"></div>
        </div>

        <!-- Assign Agent -->
        <div class="driplare-card">
          <div class="driplare-label">Assign Agent</div>
          <select id="driplare-assign-select" class="driplare-select">
            <option value="">Unassigned</option>
          </select>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Bind Events
  const toggleBtn = document.getElementById("driplare-toggle-btn");
  const closeBtn = document.getElementById("driplare-close-btn");
  const aiToggle = document.getElementById("driplare-ai-toggle");
  const aiStatusText = document.getElementById("driplare-ai-status-text");
  const btnSummarize = document.getElementById("driplare-btn-summarize");
  const btnSuggest = document.getElementById("driplare-btn-suggest");
  const outputBox = document.getElementById("driplare-ai-output");

  toggleBtn.addEventListener("click", () => {
    container.classList.toggle("driplare-collapsed");
  });

  closeBtn.addEventListener("click", () => {
    container.classList.add("driplare-collapsed");
  });

  aiToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      aiStatusText.textContent = "AI is actively replying";
      aiStatusText.style.color = "#10b981";
    } else {
      aiStatusText.textContent = "AI paused (Human mode)";
      aiStatusText.style.color = "#f59e0b";
    }
  });

  btnSummarize.addEventListener("click", () => {
    outputBox.style.display = "block";
    outputBox.textContent = "Analyzing conversation...";
    // Calls background service to fetch summary
    chrome.runtime.sendMessage(
      {
        type: "DRIPLARE_API_CALL",
        endpoint: "/api/inbox/ai-assist",
        method: "POST",
        body: { mode: "summary", conversationTranscript: document.body.innerText.slice(0, 3000) }
      },
      (res) => {
        if (res && res.data && res.data.result) {
          outputBox.textContent = res.data.result;
        } else {
          outputBox.textContent = "Could not fetch summary. Please configure your API key in extension popup.";
        }
      }
    );
  });

  btnSuggest.addEventListener("click", () => {
    outputBox.style.display = "block";
    outputBox.textContent = "Generating suggested reply...";
    chrome.runtime.sendMessage(
      {
        type: "DRIPLARE_API_CALL",
        endpoint: "/api/inbox/ai-assist",
        method: "POST",
        body: { mode: "suggest_reply", conversationTranscript: document.body.innerText.slice(0, 3000) }
      },
      (res) => {
        if (res && res.data && res.data.result) {
          outputBox.innerHTML = `<div>${res.data.result}</div><button id="driplare-copy-reply" class="driplare-mini-btn">Copy Reply</button>`;
          document.getElementById("driplare-copy-reply")?.addEventListener("click", () => {
            navigator.clipboard.writeText(res.data.result);
            alert("Reply copied to clipboard!");
          });
        } else {
          outputBox.textContent = "Could not generate reply. Please configure your API key.";
        }
      }
    );
  });
})();

