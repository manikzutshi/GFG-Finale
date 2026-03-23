document.addEventListener('DOMContentLoaded', async () => {
  const urlEl = document.getElementById('current-url');
  const analyzeBtn = document.getElementById('analyze-btn');
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const resultsEl = document.getElementById('results');

  // Hardcode securely to the live Render Fastify instance
  const API_URL = "https://gfg-finale.onrender.com/analyze";

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab && currentTab.url) {
      urlEl.textContent = new URL(currentTab.url).hostname;
    } else {
      urlEl.textContent = "Cannot read URL context";
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    analyzeBtn.addEventListener('click', async () => {
      // Freeze UI and show loading pulse
      analyzeBtn.classList.add('hidden');
      loadingEl.classList.remove('hidden');
      errorEl.classList.add('hidden');
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';

      try {
        // We solely rely on sending the URL natively to perfectly mirror the web-version's exact Readability parser
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_url: currentTab.url
          })
        });

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
        
      } catch (err) {
        loadingEl.classList.add('hidden');
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
        analyzeBtn.classList.remove('hidden');
        analyzeBtn.textContent = "Retry Analysis";
      }
    });

  } catch (err) {
    urlEl.textContent = "Extension Error: " + err.message;
  }
});
