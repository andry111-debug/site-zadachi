let DATA = window.TASK_DATA;
const STORAGE_PREFIX = 'N_147_';
const state = {
  user: null,
  progress: {},
  day: null,
  employeeFilter: 'all',
  editingTaskId: null
};

const $ = (id) => document.getElementById(id);
function byId(list, id) { return list.find(x => x.id === id); }
function userCanSeeAll(user) { return user && user.role === 'admin'; }
function isAdmin(user) { return userCanSeeAll(user); }

function loadTasksData() {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'taskData');
    if (saved) DATA = JSON.parse(saved);
  } catch (e) {}
}
function saveTasksData() { localStorage.setItem(STORAGE_PREFIX + 'taskData', JSON.stringify(DATA)); }
function loadProgress() {
  try { state.progress = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'taskProgress') || '{}'); } catch (e) { state.progress = {}; }
}
function saveProgress() { localStorage.setItem(STORAGE_PREFIX + 'taskProgress', JSON.stringify(state.progress)); }

function initLogin() {
  $('projectLine').textContent = `${DATA.project}. Период: ${DATA.period}`;
  $('userSelect').innerHTML = DATA.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} — ${escapeHtml(u.title || '')}</option>`).join('');
  const saved = localStorage.getItem(STORAGE_PREFIX + 'currentUserId');
  if (saved && byId(DATA.users, saved)) $('userSelect').value = saved;
  $('loginBtn').addEventListener('click', login);
  $('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
}

function login() {
  const user = byId(DATA.users, $('userSelect').value);
  const pin = $('pinInput').value.trim();
  if (!user || user.pin !== pin) {
    $('loginError').textContent = 'Неверный код.';
    $('loginError').classList.remove('hidden');
    return;
  }
  $('loginError').classList.add('hidden');
  state.user = user;
  localStorage.setItem(STORAGE_PREFIX + 'currentUserId', user.id);
  $('loginPanel').classList.add('hidden');
  $('workspace').classList.remove('hidden');
  initWorkspace();
}

function initWorkspace() {
  $('currentUser').textContent = `${state.user.name} — ${state.user.title || ''}`;
  $('daySelect').innerHTML = DATA.days.map(d => `<option value="${d.date}">${d.date}</option>`).join('');
  state.day = DATA.days[0].date;
  $('daySelect').value = state.day;
  $('daySelect').onchange = () => { state.day = $('daySelect').value; state.editingTaskId = null; render(); };
  if (userCanSeeAll(state.user)) {
    $('employeeFilterWrap').classList.remove('hidden');
    $('employeeFilter').innerHTML = `<option value="all">Все сотрудники</option>` + DATA.users.filter(u => u.id !== 'admin').map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    $('employeeFilter').onchange = () => { state.employeeFilter = $('employeeFilter').value; state.editingTaskId = null; render(); };
  } else {
    $('employeeFilterWrap').classList.add('hidden');
  }
  $('logoutBtn').onclick = () => location.reload();
  if ($('exportBtn')) $('exportBtn').onclick = exportProgress;
  if ($('importInput')) $('importInput').onchange = importProgress;
  if ($('clearDayBtn')) $('clearDayBtn').onclick = clearSelectedDay;
  if ($('exportTasksBtn')) $('exportTasksBtn').onclick = exportTasks;
  if ($('importTasksInput')) $('importTasksInput').onchange = importTasks;
  render();
}

function getSelectedDay() { return DATA.days.find(d => d.date === state.day) || DATA.days[0]; }
function visiblePeople(day) {
  let people = day.people;
  if (!userCanSeeAll(state.user)) return people.filter(p => p.userId === state.user.id);
  if (state.employeeFilter !== 'all') return people.filter(p => p.userId === state.employeeFilter);
  return people;
}
function isDone(id) { return !!state.progress[id]; }
function splitResult(text) {
  const marker = 'Результат:';
  const idx = text.indexOf(marker);
  if (idx < 0) return { main: text.trim(), result: '' };
  return { main: text.slice(0, idx).trim(), result: text.slice(idx + marker.length).trim() };
}
function findTask(taskId) {
  for (const day of DATA.days) for (const person of day.people) {
    const task = person.items.find(t => t.id === taskId);
    if (task) return { day, person, task };
  }
  return null;
}
function linkify(text) {
  let s = escapeHtml(text);
  s = s.replace(/Справочник пакетов РД/g, '<a href="rd.html">Справочник пакетов РД</a>');
  return s;
}
function renderTaskBody(task) {
  const parts = splitResult(task.text);
  const main = `<div class="task-main">${linkify(parts.main)}</div>`;
  const result = parts.result ? `<div class="task-result"><span>Результат:</span> ${linkify(parts.result)}</div>` : '';
  const practical = task.practicalMeaning ? `<div class="task-practical"><span>Практический смысл:</span> ${linkify(task.practicalMeaning)}</div>` : '';
  const editButton = isAdmin(state.user) ? `<button type="button" class="edit-task-btn" data-edit-task="${task.id}">Редактировать</button>` : '';
  return `<span class="task-text">${main}${result}${practical}</span>${editButton}`;
}
function render() {
  const day = getSelectedDay();
  const people = visiblePeople(day);
  let total = 0, done = 0;
  const html = people.map(person => {
    const personTotal = person.items.length;
    const personDone = person.items.filter(t => isDone(t.id)).length;
    total += personTotal; done += personDone;
    return `<div class="person-block">
      <div class="person-title"><h3>${escapeHtml(person.name)}</h3><span class="progress-pill">${personDone} из ${personTotal}</span></div>
      ${person.items.map(task => {
        if (state.editingTaskId === task.id && isAdmin(state.user)) {
          return `<div class="task task-editing">
            <input type="checkbox" ${isDone(task.id) ? 'checked' : ''} data-task-id="${task.id}">
            <div>
              <label class="editor-label">Текст задачи и результат</label>
              <textarea class="task-editor" id="editor_${task.id}">${escapeHtml(task.text)}</textarea>
              <label class="editor-label">Практический смысл</label>
              <textarea class="task-editor practical-editor" id="practical_${task.id}">${escapeHtml(task.practicalMeaning || '')}</textarea>
              <div class="edit-actions">
                <button type="button" class="primary small-btn" data-save-task="${task.id}">Сохранить текст</button>
                <button type="button" class="small-btn" data-cancel-edit="${task.id}">Отмена</button>
              </div>
            </div>
          </div>`;
        }
        return `<label class="task ${isDone(task.id) ? 'done' : ''}">
          <input type="checkbox" ${isDone(task.id) ? 'checked' : ''} data-task-id="${task.id}">
          ${renderTaskBody(task)}
        </label>`;
      }).join('')}
    </div>`;
  }).join('');
  $('tasksPanel').innerHTML = html || '<div class="empty">На выбранный день задач для этого пользователя нет.</div>';
  $('totalTasks').textContent = String(total);
  $('doneTasks').textContent = String(done);
  $('leftTasks').textContent = String(total - done);
  $('summaryPanel').innerHTML = `<h3>Итог дня</h3><ol class="summary-list">${(day.summary || []).map(x => `<li>${linkify(x)}</li>`).join('')}</ol>`;
  document.querySelectorAll('input[data-task-id]').forEach(cb => cb.addEventListener('change', (e) => { state.progress[e.target.getAttribute('data-task-id')] = e.target.checked; saveProgress(); render(); }));
  document.querySelectorAll('[data-edit-task]').forEach(btn => btn.addEventListener('click', (e) => { state.editingTaskId = e.target.getAttribute('data-edit-task'); render(); }));
  document.querySelectorAll('[data-cancel-edit]').forEach(btn => btn.addEventListener('click', () => { state.editingTaskId = null; render(); }));
  document.querySelectorAll('[data-save-task]').forEach(btn => btn.addEventListener('click', (e) => {
    const found = findTask(e.target.getAttribute('data-save-task'));
    if (!found) return;
    const editor = document.getElementById('editor_' + found.task.id);
    found.task.text = editor.value.trim();
    const practicalEditor = document.getElementById('practical_' + found.task.id);
    found.task.practicalMeaning = practicalEditor ? practicalEditor.value.trim() : (found.task.practicalMeaning || '');
    state.editingTaskId = null;
    saveTasksData();
    render();
  }));
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function exportProgress() { downloadJson({ exportedAt: new Date().toISOString(), progress: state.progress }, 'otmetki_vypolneniya_zadach.json'); }
function importProgress(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { const payload = JSON.parse(reader.result); state.progress = payload.progress || payload || {}; saveProgress(); render(); } catch(err) { alert('Не удалось загрузить файл отметок.'); } };
  reader.readAsText(file); e.target.value = '';
}
function clearSelectedDay() {
  const day = getSelectedDay();
  day.people.forEach(p => p.items.forEach(t => { delete state.progress[t.id]; }));
  saveProgress(); render();
}
function exportTasks() { downloadJson(DATA, 'zadachi_sotrudnikov_redaktsiya.json'); }
function importTasks(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { DATA = JSON.parse(reader.result); window.TASK_DATA = DATA; saveTasksData(); initLogin(); render(); } catch(err) { alert('Не удалось загрузить файл задач.'); } };
  reader.readAsText(file); e.target.value = '';
}

loadTasksData(); loadProgress(); initLogin();
