/* =========================================================
   DeployBot Premium Web Runner — Frontend-only edition
   GitHub Pages ready. Groq API directly called from browser
   ========================================================= */

const promptInput = document.getElementById('prompt');
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const terminal = document.getElementById('terminal');
const result = document.getElementById('result');
const statusBadge = document.getElementById('statusBadge');
const workflowId = document.getElementById('workflowId');
const modelLabel = document.getElementById('model-label');
const keyMode = document.getElementById('key-mode');

const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

let abortController = null;
let finalText = '';
let isRunning = false;

/* ---------------- helpers ---------------- */

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function renderMarkdown(text) {
  const escaped = escapeHtml(text);
  const codeBlocks = [];

  const protectedText = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });

  let html = protectedText
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';

      if (/^<h[1-3]>/.test(trimmed) || /^<pre>/.test(trimmed)) {
        return trimmed;
      }

      if (/^(?:- |\* )/m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => `<li>${line.replace(/^[-*]\s+/, '')}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      if (/^\d+\.\s/m.test(trimmed)) {
        const items = trimmed
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return html || '<p>Waiting for output...</p>';
}

function appendLog(message, level = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${level}`;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.innerHTML = `<span class="time">${time}</span><span class="text">${escapeHtml(message)}</span>`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function setStatus(status) {
  statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  statusBadge.className = `status-badge ${status.toLowerCase()}`;
}

function resetOutput() {
  finalText = '';
  terminal.innerHTML = '';
  result.innerHTML = '<p>Waiting for output...</p>';
}

function genWorkflowId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `wf_${t}_${r}`;
}

/* ---------------- boot ---------------- */

function bootConfig() {
  modelInput.value = DEFAULT_MODEL;
  modelLabel.textContent = DEFAULT_MODEL;
  keyMode.textContent = 'UI key required';

  const savedKey = localStorage.getItem('deploybot_groq_key') || '';
  if (savedKey) apiKeyInput.value = savedKey;

  const savedModel = localStorage.getItem('deploybot_groq_model');
  if (savedModel) {
    modelInput.value = savedModel;
    modelLabel.textContent = savedModel;
  }
}

modelInput.addEventListener('input', () => {
  const v = modelInput.value.trim() || DEFAULT_MODEL;
  modelLabel.textContent = v;
  localStorage.setItem('deploybot_groq_model', v);
});

/* ---------------- system prompt: agent style orchestration ---------------- */

const SYSTEM_PROMPT = `You are DeployBot, a premium multi-step AI workflow runner.
You receive a single user task prompt and produce a richly structured, production-ready deliverable.

Always follow this internal pipeline (do NOT print the stage headers verbatim — instead weave them into a clean, well-formatted markdown response):

1. Research & framing — restate the goal and assumptions.
2. Validation — list constraints, target audience, success criteria.
3. Feature / section breakdown — bullet the building blocks.
4. PRD / spec — concrete sections, copy, structure.
5. Materials & next steps — handoff checklist, links to consider, KPIs.

Output rules:
- Use markdown: H1 for title, H2/H3 for sections, bullet lists, numbered steps, code blocks where relevant.
- Be specific, opinionated, and useful — no filler.
- Keep formatting tight and skimmable.
- Respond in the same language as the user's prompt (English / Hindi / Hinglish).`;

/* ---------------- Groq streaming call ---------------- */

async function callGroqStream({ prompt, apiKey, model, onDelta, onLog, signal }) {
  onLog('Connecting to Groq API...', 'info');

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    }),
    signal
  });

  if (!response.ok) {
    let errMsg = `Groq API error: HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.error && errBody.error.message) {
        errMsg = `Groq API: ${errBody.error.message}`;
      }
    } catch (_) { /* ignore */ }
    throw new Error(errMsg);
  }

  if (!response.body) {
    throw new Error('Streaming not supported in this browser.');
  }

  onLog('Stream opened. Receiving tokens...', 'success');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let totalChars = 0;
  let lastLogTick = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events split by \n\n
    const parts = buffer.split('\n\n');
    buffer = parts.pop(); // keep incomplete

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') {
          onLog('Stream finished. Wrapping up...', 'success');
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            totalChars += delta.length;
            onDelta(delta);

            const now = Date.now();
            if (now - lastLogTick > 800) {
              onLog(`Streaming... ${totalChars} chars received.`, 'info');
              lastLogTick = now;
            }
          }
        } catch (_) { /* skip malformed */ }
      }
    }
  }
}

/* ---------------- main workflow trigger ---------------- */

async function startWorkflow() {
  if (isRunning) return;

  const prompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_MODEL;

  if (!prompt) {
    appendLog('Task prompt missing. Kuch likho aur fir trigger karo.', 'error');
    setStatus('failed');
    return;
  }

  if (!apiKey) {
    appendLog('Groq API key missing. Apni key paste karo (gsk_... se start hoti hai).', 'error');
    setStatus('failed');
    return;
  }

  localStorage.setItem('deploybot_groq_key', apiKey);
  localStorage.setItem('deploybot_groq_model', model);
  modelLabel.textContent = model;

  resetOutput();
  isRunning = true;
  startBtn.disabled = true;
  setStatus('queued');

  const id = genWorkflowId();
  workflowId.textContent = id;
  appendLog(`Workflow queued: ${id}`, 'success');
  appendLog('Stage 1/5 · Research & framing prompt...', 'info');
  appendLog(`Model: ${model}`, 'info');

  abortController = new AbortController();

  // small staged pseudo-logs to give the "agentic" feel
  const stageTimers = [];
  const stageMessages = [
    [600,  'Stage 2/5 · Validating constraints & audience...'],
    [1400, 'Stage 3/5 · Feature & section breakdown...'],
    [2400, 'Stage 4/5 · Drafting PRD / structured output...'],
    [3600, 'Stage 5/5 · Materials & handoff checklist...']
  ];
  stageMessages.forEach(([ms, msg]) => {
    stageTimers.push(setTimeout(() => {
      if (isRunning) appendLog(msg, 'info');
    }, ms));
  });

  setStatus('running');

  try {
    await callGroqStream({
      prompt,
      apiKey,
      model,
      signal: abortController.signal,
      onDelta: (chunk) => {
        finalText += chunk;
        result.innerHTML = renderMarkdown(finalText);
        result.scrollTop = result.scrollHeight;
      },
      onLog: (msg, level) => appendLog(msg, level)
    });

    setStatus('completed');
    appendLog('Workflow completed successfully. Final result ready below.', 'success');
  } catch (err) {
    if (err.name === 'AbortError') {
      appendLog('Workflow aborted by user.', 'warn');
      setStatus('idle');
    } else {
      console.error(err);
      appendLog(err.message || 'Unexpected error.', 'error');
      setStatus('failed');
    }
  } finally {
    stageTimers.forEach((t) => clearTimeout(t));
    isRunning = false;
    startBtn.disabled = false;
    abortController = null;
  }
}

/* ---------------- events ---------------- */

startBtn.addEventListener('click', startWorkflow);

clearBtn.addEventListener('click', () => {
  if (abortController) {
    try { abortController.abort(); } catch (_) {}
  }
  isRunning = false;
  setStatus('idle');
  workflowId.textContent = 'No run yet';
  startBtn.disabled = false;
  resetOutput();
});

copyBtn.addEventListener('click', async () => {
  if (!finalText.trim()) return;
  try {
    await navigator.clipboard.writeText(finalText);
    appendLog('Final result copied to clipboard.', 'success');
  } catch (_) {
    appendLog('Clipboard copy failed. Browser permission missing.', 'error');
  }
});

document.querySelectorAll('.chip').forEach((button) => {
  button.addEventListener('click', () => {
    promptInput.value = button.dataset.prompt || '';
    promptInput.focus();
  });
});

bootConfig();
result.innerHTML = '<p>Waiting for output...</p>';
appendLog('DeployBot frontend ready. Paste API key, write prompt, trigger workflow.', 'info');
