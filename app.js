// Kanban board: vanilla JS, data stored in the browser (localStorage).
const COLUMNS = [
  { id: "todo",  title: "To Do",       color: "#94a3b8" },
  { id: "doing", title: "In Progress", color: "#6366f1" },
  { id: "done",  title: "Done",        color: "#10b981" },
];
const PRIORITY = { high: "High", medium: "Medium", low: "Low" };
const KEY = "kanbanboard.v2";

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- State ----------
function seed() {
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  return [
    { id: uid(), title: "Define project scope", desc: "Gather requirements with the team.", status: "done", priority: "high", due: day(-2), tags: ["planning"] },
    { id: uid(), title: "Design the home screen", desc: "Wireframes and color palette.", status: "doing", priority: "medium", due: day(2), tags: ["design"] },
    { id: uid(), title: "Set up the deployment pipeline", desc: "", status: "todo", priority: "high", due: day(-1), tags: ["devops"] },
    { id: uid(), title: "Drag this card to another column", desc: "You can also use the ← → buttons.", status: "todo", priority: "low", due: "", tags: ["tutorial"] },
  ];
}
let tasks = load();
function load() {
  try { const raw = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(raw)) return raw; } catch (e) { /* ignore */ }
  return seed();
}
function save() { localStorage.setItem(KEY, JSON.stringify(tasks)); }

// ---------- Rendering ----------
// Everything is built with textContent (never innerHTML) so user text cannot inject HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.forEach((c) => node.append(c));
  return node;
}

function visibleTasks() {
  const q = $("search").value.trim().toLowerCase();
  const p = $("filter-priority").value;
  return tasks.filter((t) =>
    (!p || t.priority === p) &&
    (!q || (t.title + " " + t.desc + " " + t.tags.join(" ")).toLowerCase().includes(q)));
}

function render() {
  const board = $("board");
  board.replaceChildren();
  const list = visibleTasks();

  COLUMNS.forEach((col, ci) => {
    const items = list.filter((t) => t.status === col.id);
    const cards = el("div", { className: "cards" });
    if (!items.length) cards.append(el("div", { className: "empty", textContent: "No tasks" }));
    items.forEach((t) => cards.append(renderCard(t, ci)));

    const dot = el("span", { className: "dot" });
    dot.style.background = col.color;
    const add = el("button", { className: "add-quick", type: "button", title: "Add task", textContent: "+" });
    add.setAttribute("aria-label", "Add task in " + col.title);
    add.onclick = () => openDialog(null, col.id);

    const column = el("section", { className: "column" },
      el("div", { className: "col-head" }, dot, el("h2", { textContent: col.title }),
        el("span", { className: "count", textContent: String(items.length) }), add),
      cards);
    column.dataset.status = col.id;
    column.setAttribute("aria-label", col.title);
    wireDrop(column);
    board.append(column);
  });
  renderStats();
}

function renderCard(t, colIndex) {
  const card = el("article", { className: "card", draggable: true, tabIndex: 0 });
  card.dataset.id = t.id;
  card.dataset.priority = t.priority;

  card.append(el("h3", { textContent: t.title }));
  if (t.desc) card.append(el("p", { textContent: t.desc }));

  const meta = el("div", { className: "meta" },
    el("span", { className: "badge " + t.priority, textContent: PRIORITY[t.priority] }));
  t.tags.forEach((tag) => meta.append(el("span", { className: "tag", textContent: tag })));
  if (t.due) {
    const late = t.status !== "done" && t.due < new Date().toISOString().slice(0, 10);
    const d = new Date(t.due + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short" });
    meta.append(el("span", { className: "due" + (late ? " late" : ""), textContent: (late ? "Overdue · " : "") + d }));
  }
  card.append(meta);

  const left = el("button", { type: "button", textContent: "←", title: "Move left", disabled: colIndex === 0 });
  const right = el("button", { type: "button", textContent: "→", title: "Move right", disabled: colIndex === COLUMNS.length - 1 });
  left.setAttribute("aria-label", "Move left");
  right.setAttribute("aria-label", "Move right");
  left.onclick = () => move(t.id, COLUMNS[colIndex - 1].id);
  right.onclick = () => move(t.id, COLUMNS[colIndex + 1].id);
  const edit = el("button", { type: "button", textContent: "Edit" });
  edit.onclick = () => openDialog(t.id);
  card.append(el("div", { className: "card-actions" }, left, right, el("span", { className: "spacer" }), edit));

  card.ondblclick = () => openDialog(t.id);
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", t.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const today = new Date().toISOString().slice(0, 10);
  const late = tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const stat = (n, label) => el("div", { className: "stat" }, el("b", { textContent: String(n) }), el("span", { textContent: label }));
  const bar = el("i"); bar.style.width = pct + "%";
  $("stats").replaceChildren(
    stat(total, "Total tasks"),
    stat(tasks.filter((t) => t.status === "doing").length, "In progress"),
    stat(late, "Overdue"),
    el("div", { className: "stat progress" }, el("span", { textContent: `Completed: ${pct}% (${done}/${total})` }), el("div", { className: "bar" }, bar)));
}

// ---------- Actions ----------
function move(id, status) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.status === status) return;
  t.status = status;
  save(); render();
}

function wireDrop(column) {
  column.addEventListener("dragover", (e) => { e.preventDefault(); column.classList.add("over"); });
  column.addEventListener("dragleave", (e) => { if (!column.contains(e.relatedTarget)) column.classList.remove("over"); });
  column.addEventListener("drop", (e) => {
    e.preventDefault();
    column.classList.remove("over");
    move(e.dataTransfer.getData("text/plain"), column.dataset.status);
  });
}

// ---------- Dialog ----------
const dialog = $("dialog");
let editingId = null;
$("f-status").replaceChildren(...COLUMNS.map((c) => el("option", { value: c.id, textContent: c.title })));

function openDialog(id, status = "todo") {
  editingId = id;
  const t = id ? tasks.find((x) => x.id === id) : null;
  $("dialog-title").textContent = t ? "Edit task" : "New task";
  $("f-title").value = t ? t.title : "";
  $("f-desc").value = t ? t.desc : "";
  $("f-status").value = t ? t.status : status;
  $("f-priority").value = t ? t.priority : "medium";
  $("f-due").value = t ? t.due : "";
  $("f-tags").value = t ? t.tags.join(", ") : "";
  $("btn-delete").style.display = t ? "" : "none";
  dialog.showModal();
  $("f-title").focus();
}

$("form").addEventListener("submit", () => {
  const data = {
    title: $("f-title").value.trim(),
    desc: $("f-desc").value.trim(),
    status: $("f-status").value,
    priority: $("f-priority").value,
    due: $("f-due").value,
    tags: $("f-tags").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5),
  };
  if (!data.title) return;
  if (editingId) Object.assign(tasks.find((x) => x.id === editingId), data);
  else tasks.push({ id: uid(), ...data });
  save(); render();
  toast(editingId ? "Task updated" : "Task created");
});

$("btn-cancel").onclick = () => dialog.close();
$("btn-delete").onclick = () => {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter((x) => x.id !== editingId);
  save(); render(); dialog.close(); toast("Task deleted");
};
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

// ---------- Toolbar ----------
$("new-task").onclick = () => openDialog(null);
$("search").addEventListener("input", render);
$("filter-priority").addEventListener("change", render);

const savedTheme = localStorage.getItem("kanbanboard.theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = savedTheme;
$("theme").onclick = () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("kanbanboard.theme", next);
};

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

render();
