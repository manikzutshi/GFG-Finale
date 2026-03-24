document.addEventListener('DOMContentLoaded', async () => {
  const urlEl = document.getElementById('current-url');
  const analyzeBtn = document.getElementById('analyze-btn');
  const loadingEl = document.getElementById('loading');
  const loadingTextEl = document.getElementById('loading-text');
  const errorEl = document.getElementById('error');
  const resultsEl = document.getElementById('results');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const newAnalysisBtn = document.getElementById('new-analysis-btn');

  let currentAnalysisData = null;
  let currentTab = null;

  // Hardcode securely to the live Render Fastify instance
  const API_URL = "https://gfg-finale.onrender.com/analyze";

  // Staged loading messages to keep user informed during long waits
  const stages = [
    "Connecting to Veritas backend...",
    "Fetching and parsing page content...",
    "Extracting verifiable claims...",
    "Searching for evidence sources...",
    "Cross-referencing citations...",
    "Running verification engine...",
    "Finalizing analysis report..."
  ];

  function resetUI() {
    analyzeBtn.classList.remove('hidden');
    analyzeBtn.textContent = "Analyze Current Context";
    bookmarkBtn.classList.add('hidden');
    newAnalysisBtn.classList.add('hidden');
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    resultsEl.classList.add('hidden');
    resultsEl.innerHTML = '';
    currentAnalysisData = null;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (currentTab && currentTab.url) {
      urlEl.textContent = new URL(currentTab.url).hostname;
    } else {
      urlEl.textContent = "Cannot read URL context";
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // New Analysis button handler
    newAnalysisBtn.addEventListener('click', resetUI);

    analyzeBtn.addEventListener('click', async () => {
      // Freeze UI and show loading pulse
      analyzeBtn.classList.add('hidden');
      bookmarkBtn.classList.add('hidden');
      newAnalysisBtn.classList.add('hidden');
      loadingEl.classList.remove('hidden');
      errorEl.classList.add('hidden');
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';

      // Cycle through staged loading messages
      let stageIndex = 0;
      loadingTextEl.textContent = stages[0];
      const stageTimer = setInterval(() => {
        stageIndex++;
        if (stageIndex < stages.length) {
          loadingTextEl.textContent = stages[stageIndex];
        }
      }, 3000);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s hard timeout

        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input_url: currentTab.url }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        clearInterval(stageTimer);

        if (!response.ok) {
          throw new Error(`API Connection Failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.claims || data.claims.length === 0) {
          throw new Error("No statistically significant claims detected on this page.");
        }

        // Render data payload
        data.claims.forEach(claim => {
          const div = document.createElement('div');
          div.className = "claim-card";
          
          let colorClass = "v-neutral";
          let dotColor = "bg-neutral";
          
          if (claim.verdict.toLowerCase().includes('true')) {
            colorClass = "v-true"; dotColor = "bg-true";
          } else if (claim.verdict.toLowerCase().includes('false')) {
            colorClass = "v-false"; dotColor = "bg-false";
          }

          div.innerHTML = `
            <div class="claim-header">
              <h3 class="claim-text">"${claim.claim}"</h3>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="verdict-badge">
                <div class="verdict-dot ${dotColor}"></div>
                <span class="verdict-label ${colorClass}">${claim.verdict}</span>
              </div>
              <div class="confidence">CONFIDENCE: ${claim.confidence}%</div>
            </div>
            <div class="divider"></div>
            <p class="reasoning">${claim.reasoning}</p>
          `;
          resultsEl.appendChild(div);
        });

        loadingEl.classList.add('hidden');
        resultsEl.classList.remove('hidden');

        // Expose bookmarking + new analysis options
        currentAnalysisData = data;
        bookmarkBtn.classList.remove('hidden');
        bookmarkBtn.textContent = "Save to Veritas Dashboard";
        bookmarkBtn.disabled = false;
        bookmarkBtn.style.background = "rgba(52, 199, 89, 0.15)";
        bookmarkBtn.style.color = "#34C759";
        newAnalysisBtn.classList.remove('hidden');
        
      } catch (err) {
        clearInterval(stageTimer);
        loadingEl.classList.add('hidden');
        
        if (err.name === 'AbortError') {
          errorEl.textContent = "Request timed out. The backend may be cold-starting — please try again in 30 seconds.";
        } else {
          errorEl.textContent = err.message;
        }
        
        errorEl.classList.remove('hidden');
        analyzeBtn.classList.remove('hidden');
        analyzeBtn.textContent = "Retry Analysis";
        bookmarkBtn.classList.add('hidden');
        newAnalysisBtn.classList.add('hidden');
        currentAnalysisData = null;
      }
    });

    bookmarkBtn.addEventListener('click', async () => {
      if (!currentAnalysisData) return;
      
      bookmarkBtn.textContent = "Saving to Cloud...";
      bookmarkBtn.disabled = true;

      try {
        const response = await fetch("https://gfg-finale.onrender.com/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputUrl: currentTab.url,
            analysisResult: currentAnalysisData,
            source: "extension",
            type: "url"
          })
        });
        
        if (!response.ok) throw new Error("Sync failed");
        
        bookmarkBtn.textContent = "✓ Synced to Dashboard";
        bookmarkBtn.style.background = "rgba(52, 199, 89, 0.3)";
      } catch (err) {
        bookmarkBtn.textContent = "Failed to sync link.";
        bookmarkBtn.style.background = "rgba(255, 69, 58, 0.15)";
        bookmarkBtn.style.color = "#FF453A";
        bookmarkBtn.disabled = false;
      }
    });

  } catch (err) {
    urlEl.textContent = "Extension Error: " + err.message;
  }
});
