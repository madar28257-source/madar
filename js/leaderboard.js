// ==========================================
// 🏆 جدول التصنيف الموحد وتنسيق الأرقام الضخمة (MADAR)
// ==========================================

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td',
];

export function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (!Number.isFinite(num)) return '∞$';
  if (Math.abs(num) < 1000) return `${Math.floor(num)}$`;

  const tier = Math.min(
    SUFFIXES.length - 1,
    Math.floor(Math.log10(Math.abs(num)) / 3)
  );
  const scale = Math.pow(10, tier * 3);
  const scaled = num / scale;
  const formatted = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
  return `${formatted.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}${SUFFIXES[tier]}$`;
}

const RIVAL_PLAYERS = [
  { id: 'r1', name: '7ODA069', part: 3, money: 48500000000, growthPerSec: 12500000 },
  { id: 'r2', name: 'Ziad_Chem', part: 3, money: 9200000000, growthPerSec: 4200000 },
  { id: 'r3', name: 'OmarPro', part: 2, money: 64000000, growthPerSec: 95000 },
  { id: 'r4', name: 'YassinLab', part: 2, money: 14500000, growthPerSec: 28000 },
  { id: 'r5', name: 'Patrick_EG', part: 2, money: 2800000, growthPerSec: 7500 },
  { id: 'r6', name: 'KareemX', part: 1, money: 420000, growthPerSec: 1800 },
  { id: 'r7', name: 'Mazen99', part: 1, money: 48000, growthPerSec: 320 },
  { id: 'r8', name: 'Ali_Tycoon', part: 1, money: 3400, growthPerSec: 45 },
];

export function createLeaderboard({ playerName = 'محمد' } = {}) {
  const stageEl = document.getElementById('stage') || document.body;

  const wrapper = document.createElement('div');
  wrapper.id = 'madar-leaderboard';
  wrapper.style.cssText = `
    position: absolute;
    top: 96px;
    right: 16px;
    z-index: 36;
    width: 228px;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 12px;
    color: #f8fafc;
    font-size: 0.74rem;
    backdrop-filter: blur(8px);
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
  `;

  const header = document.createElement('button');
  header.type = 'button';
  header.style.cssText = `
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: rgba(30, 41, 59, 0.9);
    border: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    color: #fef08a;
    font-weight: 700;
    font-size: 0.76rem;
    cursor: pointer;
  `;
  header.innerHTML = `<span>🏆 التصنيف العام</span><span id="lb-toggle-icon">▾</span>`;
  wrapper.appendChild(header);

  const listEl = document.createElement('div');
  listEl.style.cssText = `
    max-height: 195px;
    overflow-y: auto;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `;
  wrapper.appendChild(listEl);
  stageEl.appendChild(wrapper);

  let collapsed = false;
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    listEl.style.display = collapsed ? 'none' : 'flex';
    const icon = header.querySelector('#lb-toggle-icon');
    if (icon) icon.textContent = collapsed ? '▸' : '▾';
  });

  const rivals = RIVAL_PLAYERS.map((r) => ({ ...r }));
  let currentMoney = 0;
  let currentPart = 1;
  let renderTimer = 0;

  function render() {
    const allPlayers = [
      { id: 'me', name: playerName, part: currentPart, money: currentMoney, isMe: true },
      ...rivals,
    ].sort((a, b) => b.money - a.money);

    listEl.innerHTML = allPlayers
      .map((p, idx) => {
        const partBadgeColor =
          p.part === 3 ? '#f43f5e' : p.part === 2 ? '#a855f7' : '#38bdf8';
        const rowBg = p.isMe
          ? 'rgba(56, 189, 248, 0.22)'
          : 'rgba(30, 41, 59, 0.45)';
        const borderStyle = p.isMe
          ? '1px solid rgba(56, 189, 248, 0.55)'
          : '1px solid transparent';

        return `
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:6px;
            padding:4px 6px;
            border-radius:7px;
            background:${rowBg};
            border:${borderStyle};
          ">
            <div style="display:flex;align-items:center;gap:5px;min-width:0;">
              <span style="color:#94a3b8;font-weight:700;min-width:18px;">#${idx + 1}</span>
              <span style="
                font-weight:${p.isMe ? '800' : '600'};
                color:${p.isMe ? '#7dd3fc' : '#e2e8f0'};
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
                max-width:74px;
              ">${p.name}</span>
              <span style="
                font-size:0.62rem;
                padding:1px 5px;
                border-radius:999px;
                background:${partBadgeColor}26;
                color:${partBadgeColor};
                border:1px solid ${partBadgeColor}55;
                font-weight:700;
              ">P${p.part}</span>
            </div>
            <span style="color:#86efac;font-weight:700;white-space:nowrap;">${formatMoney(p.money)}</span>
          </div>
        `;
      })
      .join('');
  }

  function update(dt, playerMoney, playerPart) {
    currentMoney = playerMoney;
    currentPart = playerPart;

    for (const r of rivals) {
      r.money += r.growthPerSec * dt;
    }

    renderTimer += dt;
    if (renderTimer >= 0.6) {
      renderTimer = 0;
      render();
    }
  }

  render();

  return { update, render };
}
