import { completionStats, MAX_TEXT_LENGTH } from '../todos.js';

export function createTodoList(root, handlers) {
  const dateEl = root.querySelector('#todo-date');
  const goToday = root.querySelector('#go-today');
  const listEl = root.querySelector('#todo-list');
  const form = root.querySelector('#todo-form');
  const input = root.querySelector('#todo-input');
  const progress = root.querySelector('#todo-progress');

  // 항목 행(li)은 렌더링 사이에 재사용한다. 다시 만들면 편집 중인 입력창이 사라지고,
  // 마우스를 누른 요소가 뗄 때까지 교체되어 클릭이 유실된다.
  const rows = new Map(); // todo id -> { id, li, checkbox, label, text } (id 는 날짜 안에서 고유: storage 가 보장)
  let renderedKey = null;
  let activeEdit = null; // { row, edit, cancel() }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    handlers.onAdd(input.value);
    input.value = '';
    input.focus();
  });
  goToday.addEventListener('click', () => handlers.onGoToday());

  function cancelEdit() {
    if (!activeEdit) return;
    const { cancel } = activeEdit;
    activeEdit = null;
    cancel();
  }

  function startEdit(row) {
    if (activeEdit?.row === row) return;
    cancelEdit();
    const edit = document.createElement('input');
    edit.type = 'text';
    edit.className = 'todo-edit';
    edit.value = row.text;
    edit.maxLength = MAX_TEXT_LENGTH;
    let finished = false;
    const restoreLabel = () => { if (edit.isConnected) edit.replaceWith(row.label); };
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      if (activeEdit?.edit === edit) activeEdit = null;
      const value = edit.value.trim();
      restoreLabel();
      if (commit && value && value !== row.text) handlers.onEdit(row.id, value);
    };
    activeEdit = {
      row,
      edit,
      cancel: () => { finished = true; restoreLabel(); },
    };
    edit.addEventListener('keydown', (event) => {
      // 한글 등 조합 입력 중의 Enter/Esc 는 글자 확정용이다 (keyCode 229 는 구형 브라우저의 같은 신호)
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter') finish(true);
      else if (event.key === 'Escape') finish(false);
    });
    edit.addEventListener('blur', () => finish(true));
    row.label.replaceWith(edit);
    edit.focus();
    edit.select();
  }

  function createRow(id) {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', '완료 표시');
    checkbox.addEventListener('change', () => handlers.onToggle(id));

    const label = document.createElement('span');
    label.className = 'todo-text';
    label.title = '더블클릭하여 수정';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'todo-del';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', '삭제');
    remove.addEventListener('click', () => handlers.onRemove(id));

    li.append(checkbox, label, remove);
    const row = { id, li, checkbox, label, text: '' };
    label.addEventListener('dblclick', () => startEdit(row));
    return row;
  }

  function updateRow(row, todo) {
    row.text = todo.text;
    row.li.className = todo.done ? 'done' : '';
    if (row.checkbox.checked !== todo.done) row.checkbox.checked = todo.done;
    // textContent 로만 넣는다 (HTML 해석 금지)
    if (row.label.textContent !== todo.text) row.label.textContent = todo.text;
  }

  function render({ key, todayKey, list }) {
    dateEl.textContent = key === todayKey ? `📅 ${key} (오늘)` : `📅 ${key}`;
    goToday.hidden = key === todayKey;

    if (key !== renderedKey) {
      // 다른 날짜로 바뀌면 편집은 버리고 행을 모두 새로 만든다 (다른 날짜에 쓰이지 않도록)
      cancelEdit();
      rows.clear();
      listEl.replaceChildren();
      renderedKey = key;
    }

    const seen = new Set();
    const ordered = list.map((todo) => {
      let row = rows.get(todo.id);
      if (!row) {
        row = createRow(todo.id);
        rows.set(todo.id, row);
      }
      updateRow(row, todo);
      seen.add(todo.id);
      return row.li;
    });

    for (const [id, row] of rows) {
      if (seen.has(id)) continue;
      if (activeEdit?.row === row) cancelEdit();
      row.li.remove();
      rows.delete(id);
    }

    const current = [...listEl.children];
    if (current.length !== ordered.length || current.some((node, i) => node !== ordered[i])) {
      listEl.replaceChildren(...ordered);
    }

    const { done, total, rate } = completionStats(list);
    progress.textContent = total === 0
      ? '할 일을 추가해 보세요'
      : `진행률 ${done}/${total} (${Math.round(rate * 100)}%)`;
  }

  return { render };
}
