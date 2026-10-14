import { completionStats } from './todos.js';

export function levelFor(rate) {
  if (rate === null || rate === undefined) return -1;
  if (rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate < 1) return 3;
  return 4;
}

export function cellInfo(key, days) {
  const { done, total, rate } = completionStats(days[key]);
  return { level: levelFor(rate), done, total, rate };
}

export function tooltipText(key, info) {
  const monthDay = key.slice(5).replace('-', '/');
  if (info.total === 0) return `${monthDay} · 기록 없음`;
  return `${monthDay} · ${info.done}/${info.total} 완료 (${Math.round(info.rate * 100)}%)`;
}

const stateByContainer = new WeakMap();

function buildGrid(container, grid) {
  const columns = grid.map((week) => {
    const column = document.createElement('div');
    column.className = 'week';
    for (let i = 0; i < week.length; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      column.append(button);
    }
    return column;
  });
  container.replaceChildren(...columns);
}

function updateCell(button, cell, info, selectedKey) {
  button.dataset.key = cell.key;
  button.classList.toggle('future', cell.isFuture);
  button.classList.toggle('selected', !cell.isFuture && cell.key === selectedKey);
  if (cell.isFuture) {
    button.disabled = true;
    button.tabIndex = -1;
    delete button.dataset.level;
    button.removeAttribute('title');
    button.removeAttribute('aria-label');
    button.removeAttribute('aria-pressed');
    return;
  }
  const label = tooltipText(cell.key, info);
  button.disabled = false;
  button.removeAttribute('tabindex');
  button.dataset.level = String(info.level);
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(cell.key === selectedKey));
}

// 칸 버튼은 한 번만 만들고 이후에는 속성만 갱신한다. 다시 만들면 눌러 둔 칸이 교체되어
// 클릭이 유실되고 키보드 포커스가 사라진다. 클릭은 컨테이너에서 위임으로 받는다.
export function renderHeatmap(container, { grid, days, selectedKey, onSelect }) {
  let state = stateByContainer.get(container);
  if (!state) {
    state = { onSelect };
    stateByContainer.set(container, state);
    container.addEventListener('click', (event) => {
      const button = event.target.closest('button.cell');
      if (!button || button.disabled) return;
      stateByContainer.get(container).onSelect(button.dataset.key);
    });
  }
  state.onSelect = onSelect;

  const cells = grid.flat();
  let buttons = container.querySelectorAll('button.cell');
  if (buttons.length !== cells.length) {
    buildGrid(container, grid);
    buttons = container.querySelectorAll('button.cell');
  }
  cells.forEach((cell, i) => updateCell(buttons[i], cell, cellInfo(cell.key, days), selectedKey));
}
