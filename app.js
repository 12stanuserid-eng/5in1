const topicsInput = document.getElementById('topics');
const marketInput = document.getElementById('market');
const audienceInput = document.getElementById('audience');
const goalInput = document.getElementById('goal');
const constraintsInput = document.getElementById('constraints');
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const startBtn = document.getElementById('startBtn');
const heroStartBtn = document.getElementById('heroStartBtn');
const scrollPipelineBtn = document.getElementById('scrollPipelineBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const terminal = document.getElementById('terminal');
const result = document.getElementById('result');
const statusBadge = document.getElementById('statusBadge');
const workflowIdEl = document.getElementById('workflowId');
const modelLabel = document.getElementById('model-label');
const keyMode = document.getElementById('key-mode');
const heroStatus = document.getElementById('heroStatus');
const zipState = document.getElementById('zipState');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const completedAgents = document.getElementById('completedAgents');
const charCounter = document.getElementById('charCounter');
const pipelineState = document.getElementById('pipelineState');
const consoleHint = document.getElementById('consoleHint');

const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TABS = ['master', 'ideas', 'winner', 'naming', 'prd', 'pack'];

let selectedType = 'app';
let isRunning = false;
let activeTab = 'master';
let finalBundle = null;
let lastRunData = null;
let generatedZipBlob = null;

const stageOutput = {
  master: '',
  ideas: '',
  winner: '',
  naming: '',
  prd: '',
  pack: ''
};

const agentCards = Array.from(document.querySelectorAll('[data-agent-card]'));
const agentStateEls = Array.from(document.querySelectorAll('[data-agent-state]'));
const agentPreviewEls = {
  1: document.getElementById('agentPreview1'),
  2: document.getElementById('agentPreview2'),
  3: document.getElementById('agentPreview3'),
  4: document.getElementById('agentPreview4'),
  5: document.getElementById('agentPreview5')
};

const presetMap = {
  saas: {
    type: 'app',
    topics: 'AI CRM\nSales follow-up automation\nProposal generation\nCustomer success insights',
    market: 'Global B2B SaaS',
    audience: 'Agencies, startup founders, sales teams',
    goal: 'Recurring revenue AI SaaS with premium positioning',
    constraints: 'Fast onboarding, sticky dashboard, clear ROI, enterprise upsell path'
  },
  consumer: {
    type: 'app',
    topics: 'Habit building\nPersonal finance\nLanguage learning\nShort-form creator productivity',
    market: 'India + global consumers',
    audience: 'Gen Z and young professionals',
    goal: 'Mass-market app with strong retention and viral loops',
    constraints: 'Simple onboarding, mobile-first, Play Store friendly, freemium monetization'
  },
  agent: {
    type: 'agent',
    topics: 'Lead qualification\nLocal business automation\nRecruiting workflows\nCreator operations assistant',
    market: 'Service businesses and founders',
    audience: 'SMB owners, agencies, solo founders',
    goal: 'High-ticket AI agent offer that can scale into productized service',
    constraints: 'Clear deliverables, premium feel, automation heavy, fast deployment'
  },
  hindi: {
    type: 'app',
    topics: 'Hindi learning app\nLocal business helper\nBharat creator toolkit\nAI voice assistant for SMBs',
    market: 'India Tier 2 / Tier 3 + Hindi-first audience',
    audience: 'Hindi users, shop owners, students',
    goal: 'High utility product with localized moat',
    constraints: 'Hindi-first UX, simple copy, Android friendly, trust building'
  }
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(text) {
  if (!text || !text.trim()) return '<p>Waiting for output...</p>';

  const escaped = escapeHtml(text);
  const codeBlocks = [];

  const protectedText = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });

  let html = protectedText
    .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-4]|pre|blockquote|ul|ol)/.test(trimmed)) return trimmed;

      const lines = trimmed.split('\n').filter(Boolean);
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${line.replace(/^[-*]\s+/, '')}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`).join('')}</ol>`;
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
  const row = document.createElement('div');
  row.className = `log-line ${level}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  row.innerHTML = `<span class="time">${time}</span><span class="text">${escapeHtml(message)}</span>`;
  terminal.appendChild(row);
  terminal.scrollTop = terminal.scrollHeight;
}

function setStatus(status) {
  statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  statusBadge.className = `status-badge ${status.toLowerCase()}`;
  heroStatus.textContent =
    status === 'running' ? 'Pipeline executing live' :
    status === 'completed' ? 'Execution completed' :
    status === 'failed' ? 'Execution failed' :
    status === 'queued' ? 'Queued for execution' : 'Ready for execution';
}

function shortPreview(text, max = 220) {
  const clean = String(text || '').replace(/[#>*`_-]/g, '').replace(/\n{2,}/g, ' ').replace(/\n/g, ' ').trim();
  if (!clean) return 'No output yet.';
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
}

function resetAgentBoard() {
  for (let i = 1; i <= 5; i += 1) {
    agentStateEls[i - 1].textContent = 'Queued';
    agentStateEls[i - 1].className = 'agent-state queued';
    agentPreviewEls[i].textContent = 'No output yet.';
  }
}

function setAgentState(index, state, previewText = null) {
  const stateEl = agentStateEls[index - 1];
  const card = agentCards[index - 1];
  stateEl.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  stateEl.className = `agent-state ${state}`;
  card.dataset.state = state;
  if (previewText !== null) {
    agentPreviewEls[index].textContent = shortPreview(previewText, index === 4 ? 280 : 180);
  }
}

function genWorkflowId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `db_${t}_${r}`;
}

function updateProgress(completed, percentOverride = null) {
  const percent = percentOverride !== null ? percentOverride : Math.round((completed / 5) * 100);
  completedAgents.textContent = `${completed} / 5`;
  progressLabel.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function updateCharCount() {
  const total = Object.values(stageOutput).join('\n\n').length;
  charCounter.textContent = `${total.toLocaleString()} chars`;
}

function resetOutputState() {
  TABS.forEach((tab) => {
    stageOutput[tab] = '';
  });
  finalBundle = null;
  generatedZipBlob = null;
  lastRunData = null;
  zipState.textContent = 'ZIP not generated';
  downloadBtn.disabled = true;
  pipelineState.textContent = 'Waiting to start';
  consoleHint.textContent = 'Agent logs will appear here';
  workflowIdEl.textContent = 'No run yet';
  terminal.innerHTML = '';
  updateProgress(0, 0);
  updateCharCount();
  resetAgentBoard();
  renderCurrentTab();
}

function renderCurrentTab() {
  result.innerHTML = renderMarkdown(stageOutput[activeTab] || stageOutput.master || '');
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  renderCurrentTab();
}

function buildProjectBrief() {
  return {
    type: selectedType,
    topics: topicsInput.value.trim(),
    market: marketInput.value.trim(),
    audience: audienceInput.value.trim(),
    goal: goalInput.value.trim(),
    constraints: constraintsInput.value.trim()
  };
}

function validateInputs() {
  const brief = buildProjectBrief();
  if (!brief.topics) {
    appendLog('Topics / niches missing. Pehle topics daalo.', 'error');
    setStatus('failed');
    return false;
  }
  if (!apiKeyInput.value.trim()) {
    appendLog('Groq API key missing. gsk_... key paste karo.', 'error');
    setStatus('failed');
    return false;
  }
  return true;
}

function bootConfig() {
  const savedKey = localStorage.getItem('deploybot_groq_key') || '';
  const savedModel = localStorage.getItem('deploybot_groq_model') || DEFAULT_MODEL;
  const savedType = localStorage.getItem('deploybot_build_type') || 'app';
  const savedMarket = localStorage.getItem('deploybot_market') || '';
  const savedAudience = localStorage.getItem('deploybot_audience') || '';
  const savedGoal = localStorage.getItem('deploybot_goal') || '';
  const savedConstraints = localStorage.getItem('deploybot_constraints') || '';
  const savedTopics = localStorage.getItem('deploybot_topics') || '';

  apiKeyInput.value = savedKey;
  modelInput.value = savedModel;
  modelLabel.textContent = savedModel;
  marketInput.value = savedMarket;
  audienceInput.value = savedAudience;
  goalInput.value = savedGoal;
  constraintsInput.value = savedConstraints;
  topicsInput.value = savedTopics;
  keyMode.textContent = 'Bring your Groq API key';
  applyBuildType(savedType);
  setStatus('idle');
  resetOutputState();
  appendLog('DeployBot Premium Agent Studio ready. Setup fill karo aur premium run start karo.', 'info');
}

function persistInputs() {
  localStorage.setItem('deploybot_groq_key', apiKeyInput.value.trim());
  localStorage.setItem('deploybot_groq_model', modelInput.value.trim() || DEFAULT_MODEL);
  localStorage.setItem('deploybot_build_type', selectedType);
  localStorage.setItem('deploybot_market', marketInput.value.trim());
  localStorage.setItem('deploybot_audience', audienceInput.value.trim());
  localStorage.setItem('deploybot_goal', goalInput.value.trim());
  localStorage.setItem('deploybot_constraints', constraintsInput.value.trim());
  localStorage.setItem('deploybot_topics', topicsInput.value.trim());
}

function applyBuildType(type) {
  selectedType = type === 'agent' ? 'agent' : 'app';
  document.querySelectorAll('.segment').forEach((button) => {
    button.classList.toggle('active', button.dataset.type === selectedType);
  });
}

async function callGroqStream({ prompt, apiKey, model, onDelta, onLog }) {
  onLog('Connecting to Groq API...', 'info');
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content: 'You are DeployBot Premium Agent Studio. Follow the task exactly. Be highly structured, practical, concise where needed, and always write the output in the same language as the user brief. Use markdown headings, bullet lists, numbered sections, and crisp reasoning. When uniqueness or web research is requested, provide the best possible research-style reasoning and clearly mark that final trademark/store verification is still required.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    let errMsg = `Groq API error: HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      const apiMessage = errBody?.error?.message;
      if (apiMessage) errMsg = `Groq API: ${apiMessage}`;
    } catch (_) {}
    throw new Error(errMsg);
  }

  if (!response.body) throw new Error('Streaming not supported in this browser.');

  onLog('Stream opened. Receiving tokens...', 'success');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chars = 0;
  let lastTick = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') {
          onLog('Stream finished.', 'success');
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            chars += delta.length;
            onDelta(delta);
            const now = Date.now();
            if (now - lastTick > 900) {
              onLog(`Streaming... ${chars} chars received.`, 'info');
              lastTick = now;
            }
          }
        } catch (_) {}
      }
    }
  }
}

function buildIdeasPrompt(brief) {
  return `Agent 1 - Idea Finder\n\nCreate 10 strong ${brief.type} ideas from these topics: ${brief.topics}.\n\nContext:\n- Primary market: ${brief.market || 'Not specified'}\n- Target audience: ${brief.audience || 'Not specified'}\n- Business goal: ${brief.goal || 'Not specified'}\n- Constraints: ${brief.constraints || 'Not specified'}\n\nOutput requirements:\n- Write in Hinglish / Hindi if the brief sounds Hindi, otherwise follow user tone.
- Title: # Agent 1 Output - Idea Pool
- For each idea include: name placeholder, one-line concept, why it can win, monetization angle, difficulty score /10.
- End with a section called ## Front-runners listing top 3 ideas with short reason.
- Make it premium, market-aware, and practical.`;
}

function buildSelectorPrompt(brief, ideasText) {
  return `Agent 2 - Best Idea Selector\n\nYou must choose ONLY ONE winning ${brief.type} from the idea pool below and reject the rest.\n\nProject brief:\n- Topics: ${brief.topics}\n- Market: ${brief.market || 'Not specified'}\n- Audience: ${brief.audience || 'Not specified'}\n- Goal: ${brief.goal || 'Not specified'}\n- Constraints: ${brief.constraints || 'Not specified'}\n\nIdea pool:\n${ideasText}\n\nOutput requirements:\n- Title: # Agent 2 Output - Winning Concept
- Give: chosen concept, why this wins now, ICP, pain point, value prop, monetization, moat, launch reason, risk list, what was rejected and why.
- Add a section named ## Single-line founder pitch.
- Do not leave multiple options. Pick one strong winner only.`;
}

function buildNamingPrompt(brief, winnerText) {
  return `Agent 3 - Name Researcher\n\nUse the winning concept below and perform a research-style naming analysis inspired by Play Store / app ecosystem / internet brand naming. Your goal is to suggest names that feel uncommon and brandable.\n\nProject brief:\n- Build type: ${brief.type}
- Market: ${brief.market || 'Not specified'}
- Audience: ${brief.audience || 'Not specified'}
- Goal: ${brief.goal || 'Not specified'}
\nWinning concept:\n${winnerText}\n\nOutput requirements:\n- Title: # Agent 3 Output - Naming Research
- Provide 12 candidate names in a scored table-like markdown list with: name, style angle, uniqueness confidence, brand feel.
- Then select ONE final name.
- Add sections: ## Why this name, ## Store listing positioning, ## Naming risks, ## Verification note.
- IMPORTANT: Clearly state that final trademark / domain / store verification should still be done manually.
- Keep it highly premium and professional.`;
}

function buildPrdPrompt(brief, winnerText, namingText) {
  return `Agent 4 - PRD Architect\n\nCreate a COMPLETE production-grade PRD for the product below. Go deep.\n\nProject brief:\n- Build type: ${brief.type}
- Topics: ${brief.topics}
- Market: ${brief.market || 'Not specified'}
- Audience: ${brief.audience || 'Not specified'}
- Goal: ${brief.goal || 'Not specified'}
- Constraints: ${brief.constraints || 'Not specified'}
\nWinning concept:\n${winnerText}\n\nNaming research:\n${namingText}\n\nOutput requirements:\n- Title: # Agent 4 Output - Full PRD
- Include: executive summary, product vision, user personas, JTBD, problem statement, solution overview, core features, feature priority (P0/P1/P2), UX flow, onboarding, dashboard / app screens, AI logic, system behavior, data model outline, API/module suggestions, monetization, launch plan, analytics, success metrics, edge cases, risks, roadmap, and developer handoff checklist.
- Write enough detail so a designer + developer can begin immediately.
- Use markdown headings and bullet lists generously.
- Keep tone premium, precise, and execution-ready.`;
}

function buildPackPrompt(brief, winnerText, namingText, prdText) {
  return `Agent 5 - Download Pack Builder\n\nConvert the product research below into a crisp downloadable execution pack summary.\n\nBrief:\n- Type: ${brief.type}
- Market: ${brief.market || 'Not specified'}
- Audience: ${brief.audience || 'Not specified'}
\nWinning concept:\n${winnerText}\n\nFinal name research:\n${namingText}\n\nPRD:\n${prdText}\n\nOutput requirements:\n- Title: # Agent 5 Output - Execution Pack
- Include: project snapshot, final chosen name, one-line pitch, MVP checklist, brand notes, launch assets checklist, team handoff files list, 30-day action plan.
- Keep it concise, highly skimmable, and suitable for exporting into a download bundle.
- Mention which files should be included in the download pack.`;
}

async function runAgent({ index, label, prompt, tabKey, progressStart, progressEnd }) {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_MODEL;
  let text = '';

  setAgentState(index, 'running', 'Generating live output...');
  pipelineState.textContent = `${label} running`;
  consoleHint.textContent = `${label} is currently streaming`;
  appendLog(`${label} started.`, 'info');

  await callGroqStream({
    prompt,
    apiKey,
    model,
    onDelta: (chunk) => {
      text += chunk;
      stageOutput[tabKey] = text;
      if (tabKey === activeTab || (activeTab === 'master' && !stageOutput.master.trim())) {
        renderCurrentTab();
      }
      setAgentState(index, 'running', text);
      updateCharCount();
      const dynamicPercent = Math.min(progressEnd, progressStart + Math.max(4, Math.floor(text.length / 180)));
      updateProgress(index - 1, dynamicPercent);
    },
    onLog: (message, level) => appendLog(`${label}: ${message}`, level)
  });

  setAgentState(index, 'completed', text);
  appendLog(`${label} completed.`, 'success');
  updateProgress(index, progressEnd);
  return text;
}

function buildMasterOutput(brief, runData) {
  return `# DeployBot Premium Master Output

## Project Brief
- **Build type:** ${brief.type}
- **Topics:** ${brief.topics}
- **Market:** ${brief.market || 'Not specified'}
- **Audience:** ${brief.audience || 'Not specified'}
- **Goal:** ${brief.goal || 'Not specified'}
- **Constraints:** ${brief.constraints || 'Not specified'}

## Agent 1 · Idea Pool
${runData.ideas}

## Agent 2 · Winning Concept
${runData.winner}

## Agent 3 · Naming Research
${runData.naming}

## Agent 4 · Full PRD
${runData.prd}

## Agent 5 · Execution Pack
${runData.pack}`;
}

async function createZipBundle(brief, runData) {
  if (!window.JSZip) throw new Error('JSZip library not loaded.');

  const zip = new window.JSZip();
  const safeBase = `${(runData.finalName || 'deploybot-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deploybot-project'}-bundle`;

  const summaryJson = {
    generatedAt: new Date().toISOString(),
    buildType: brief.type,
    market: brief.market || '',
    audience: brief.audience || '',
    goal: brief.goal || '',
    constraints: brief.constraints || '',
    finalName: runData.finalName || '',
    topics: brief.topics.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
  };

  zip.file('00-master-output.md', stageOutput.master);
  zip.file('01-idea-pool.md', runData.ideas);
  zip.file('02-winning-concept.md', runData.winner);
  zip.file('03-naming-research.md', runData.naming);
  zip.file('04-full-prd.md', runData.prd);
  zip.file('05-execution-pack.md', runData.pack);
  zip.file('project-summary.json', JSON.stringify(summaryJson, null, 2));
  zip.file(
    'README.txt',
    [
      'DeployBot Premium Agent Studio - Download Bundle',
      '',
      `Final project name: ${runData.finalName || 'Not extracted'}`,
      `Build type: ${brief.type}`,
      `Market: ${brief.market || 'Not specified'}`,
      '',
      'Included files:',
      '- 00-master-output.md',
      '- 01-idea-pool.md',
      '- 02-winning-concept.md',
      '- 03-naming-research.md',
      '- 04-full-prd.md',
      '- 05-execution-pack.md',
      '- project-summary.json'
    ].join('\n')
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  generatedZipBlob = blob;
  finalBundle = {
    blob,
    fileName: `${safeBase}.zip`
  };
  zipState.textContent = `${finalBundle.fileName} ready`;
  downloadBtn.disabled = false;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function extractFinalName(namingText) {
  const lines = namingText.split('\n').map((line) => line.trim()).filter(Boolean);
  const direct = lines.find((line) => /^final name[:\-]/i.test(line) || /^chosen name[:\-]/i.test(line));
  if (direct) return direct.split(/[:\-]/).slice(1).join(':').trim();

  const heading = lines.find((line) => /^##\s+.*name/i.test(line));
  if (heading) return heading.replace(/^##\s+/, '').trim();

  const quoted = namingText.match(/\*\*(.*?)\*\*/);
  return quoted?.[1] || '';
}

async function startWorkflow() {
  if (isRunning) return;
  if (!validateInputs()) return;

  resetOutputState();
  isRunning = true;
  startBtn.disabled = true;
  heroStartBtn.disabled = true;
  clearBtn.disabled = true;
  downloadBtn.disabled = true;
  persistInputs();
  setStatus('queued');

  const brief = buildProjectBrief();
  const workflowId = genWorkflowId();
  workflowIdEl.textContent = workflowId;
  pipelineState.textContent = 'Queued for execution';
  consoleHint.textContent = 'Pipeline boot sequence initialized';
  modelLabel.textContent = modelInput.value.trim() || DEFAULT_MODEL;
  appendLog(`Workflow queued: ${workflowId}`, 'success');
  appendLog(`Build type selected: ${brief.type}`, 'info');
  appendLog('5-agent premium run initializing...', 'info');

  try {
    setStatus('running');

    const ideas = await runAgent({
      index: 1,
      label: 'Agent 1 · Idea Finder',
      prompt: buildIdeasPrompt(brief),
      tabKey: 'ideas',
      progressStart: 5,
      progressEnd: 20
    });

    const winner = await runAgent({
      index: 2,
      label: 'Agent 2 · Best Idea Selector',
      prompt: buildSelectorPrompt(brief, ideas),
      tabKey: 'winner',
      progressStart: 22,
      progressEnd: 40
    });

    const naming = await runAgent({
      index: 3,
      label: 'Agent 3 · Name Researcher',
      prompt: buildNamingPrompt(brief, winner),
      tabKey: 'naming',
      progressStart: 42,
      progressEnd: 60
    });

    const prd = await runAgent({
      index: 4,
      label: 'Agent 4 · PRD Architect',
      prompt: buildPrdPrompt(brief, winner, naming),
      tabKey: 'prd',
      progressStart: 62,
      progressEnd: 84
    });

    const pack = await runAgent({
      index: 5,
      label: 'Agent 5 · Download Pack Builder',
      prompt: buildPackPrompt(brief, winner, naming, prd),
      tabKey: 'pack',
      progressStart: 86,
      progressEnd: 96
    });

    const runData = {
      ideas,
      winner,
      naming,
      prd,
      pack,
      finalName: extractFinalName(naming)
    };

    lastRunData = runData;
    stageOutput.master = buildMasterOutput(brief, runData);
    updateCharCount();
    switchTab('master');

    appendLog('Packaging final downloadable bundle...', 'info');
    await createZipBundle(brief, runData);
    setAgentState(5, 'completed', `${pack}\n\nZIP bundle ready for download.`);
    updateProgress(5, 100);
    pipelineState.textContent = 'Completed';
    consoleHint.textContent = finalBundle ? finalBundle.fileName : 'Run completed';
    setStatus('completed');
    appendLog('All 5 agents completed successfully. ZIP bundle ready.', 'success');
  } catch (error) {
    console.error(error);
    pipelineState.textContent = 'Run failed';
    consoleHint.textContent = 'Check console logs';
    setStatus('failed');
    appendLog(error?.message || 'Unexpected error occurred.', 'error');
  } finally {
    isRunning = false;
    startBtn.disabled = false;
    heroStartBtn.disabled = false;
    clearBtn.disabled = false;
  }
}

function clearAll() {
  if (isRunning) return;
  topicsInput.value = '';
  marketInput.value = '';
  audienceInput.value = '';
  goalInput.value = '';
  constraintsInput.value = '';
  localStorage.removeItem('deploybot_market');
  localStorage.removeItem('deploybot_audience');
  localStorage.removeItem('deploybot_goal');
  localStorage.removeItem('deploybot_constraints');
  localStorage.removeItem('deploybot_topics');
  resetOutputState();
  setStatus('idle');
  appendLog('Workspace reset. Fresh run ke liye ready.', 'warn');
}

async function copyMasterOutput() {
  const text = stageOutput.master || '';
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
    appendLog('Master output copied to clipboard.', 'success');
  } catch (_) {
    appendLog('Clipboard copy failed. Browser permission missing.', 'error');
  }
}

function applyPreset(presetKey) {
  const preset = presetMap[presetKey];
  if (!preset) return;
  topicsInput.value = preset.topics;
  marketInput.value = preset.market;
  audienceInput.value = preset.audience;
  goalInput.value = preset.goal;
  constraintsInput.value = preset.constraints;
  applyBuildType(preset.type);
  appendLog(`Preset loaded: ${presetKey}`, 'success');
}

modelInput.addEventListener('input', () => {
  modelLabel.textContent = modelInput.value.trim() || DEFAULT_MODEL;
});

apiKeyInput.addEventListener('input', () => {
  keyMode.textContent = apiKeyInput.value.trim() ? 'API key detected' : 'Bring your Groq API key';
});

scrollPipelineBtn.addEventListener('click', () => {
  document.getElementById('pipelineBoard').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

startBtn.addEventListener('click', startWorkflow);
heroStartBtn.addEventListener('click', startWorkflow);
clearBtn.addEventListener('click', clearAll);
copyBtn.addEventListener('click', copyMasterOutput);

downloadBtn.addEventListener('click', () => {
  if (!finalBundle?.blob) return;
  downloadBlob(finalBundle.blob, finalBundle.fileName);
  appendLog(`ZIP downloaded: ${finalBundle.fileName}`, 'success');
});

document.querySelectorAll('.segment').forEach((button) => {
  button.addEventListener('click', () => applyBuildType(button.dataset.type));
});

document.querySelectorAll('.chip').forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset));
});

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

bootConfig();
switchTab('master');
