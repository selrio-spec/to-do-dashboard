const STORAGE_KEY = "pastel-dashboard-tasks";
const THEME_KEY = "pastel-dashboard-theme";

const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const priorityInput = document.querySelector("#priorityInput");
const dueInput = document.querySelector("#dueInput");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const filterButtons = document.querySelectorAll(".filter-button");
const clearDoneButton = document.querySelector("#clearDoneButton");
const themeToggle = document.querySelector("#themeToggle");
const themeLabel = document.querySelector("#themeLabel");

const totalCount = document.querySelector("#totalCount");
const activeCount = document.querySelector("#activeCount");
const doneCount = document.querySelector("#doneCount");
const dueTodayCount = document.querySelector("#dueTodayCount");
const focusScore = document.querySelector("#focusScore");
const focusCopy = document.querySelector("#focusCopy");
const progressFill = document.querySelector("#progressFill");
const taskHint = document.querySelector("#taskHint");
const currentDate = document.querySelector("#currentDate");

let tasks = loadTasks();
let activeFilter = "all";
let currentTheme = loadTheme();
let editingTaskId = null;
let draggedTaskId = null;

const today = new Date();
const todayKey = toDateKey(today);
dueInput.value = todayKey;
currentDate.textContent = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(today);

applyTheme(currentTheme);
render();

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) return;

  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    priority: priorityInput.value,
    due: dueInput.value,
    done: false,
    createdAt: new Date().toISOString(),
  });

  taskInput.value = "";
  priorityInput.value = "gentle";
  dueInput.value = todayKey;
  saveAndRender();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const item = button.closest(".task-item");
  const taskId = item?.dataset.id;
  if (!taskId) return;
  if (!button.dataset.action) return;

  if (button.dataset.action === "toggle") {
    tasks = tasks.map((task) =>
      task.id === taskId ? { ...task, done: !task.done } : task
    );
    editingTaskId = null;
  }

  if (button.dataset.action === "edit") {
    editingTaskId = taskId;
    render();
    return;
  }

  if (button.dataset.action === "cancel-edit") {
    editingTaskId = null;
    render();
    return;
  }

  if (button.dataset.action === "delete") {
    tasks = tasks.filter((task) => task.id !== taskId);
    editingTaskId = null;
  }

  saveAndRender();
});

taskList.addEventListener("submit", (event) => {
  const form = event.target.closest(".edit-form");
  if (!form) return;

  event.preventDefault();

  const item = form.closest(".task-item");
  const taskId = item?.dataset.id;
  const title = form.elements.title.value.trim();
  if (!taskId || !title) return;

  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          title,
          priority: form.elements.priority.value,
          due: form.elements.due.value,
        }
      : task
  );
  editingTaskId = null;
  saveAndRender();
});

taskList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".task-item");
  if (!item || editingTaskId) {
    event.preventDefault();
    return;
  }

  draggedTaskId = item.dataset.id;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
});

taskList.addEventListener("dragover", (event) => {
  const item = event.target.closest(".task-item");
  if (!item || !draggedTaskId || item.dataset.id === draggedTaskId) return;

  event.preventDefault();
  item.classList.add("drop-target");
});

taskList.addEventListener("dragleave", (event) => {
  const item = event.target.closest(".task-item");
  item?.classList.remove("drop-target");
});

taskList.addEventListener("drop", (event) => {
  const item = event.target.closest(".task-item");
  if (!item || !draggedTaskId || item.dataset.id === draggedTaskId) return;

  event.preventDefault();
  reorderTasks(draggedTaskId, item.dataset.id);
  draggedTaskId = null;
  saveAndRender();
});

taskList.addEventListener("dragend", () => {
  draggedTaskId = null;
  document
    .querySelectorAll(".task-item.dragging, .task-item.drop-target")
    .forEach((item) => item.classList.remove("dragging", "drop-target"));
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

clearDoneButton.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.done);
  saveAndRender();
});

themeToggle.addEventListener("click", () => {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

function render() {
  const visibleTasks = getVisibleTasks();
  taskList.innerHTML = visibleTasks.map(renderTask).join("");
  emptyState.classList.toggle("visible", visibleTasks.length === 0);
  updateStats();
  updateHint(visibleTasks.length);
}

function renderTask(task) {
  const dueText = task.due ? formatDueDate(task.due) : "No date";
  const checkedLabel = task.done ? "Mark task active" : "Mark task complete";
  const isEditing = task.id === editingTaskId;

  return `
    <li class="task-item ${task.done ? "done" : ""}" data-id="${task.id}" data-priority="${task.priority}" draggable="${!isEditing}">
      <button class="drag-handle" type="button" draggable="true" aria-label="Drag task to reorder" title="Drag to reorder">::</button>
      <button class="check-button" type="button" data-action="toggle" aria-label="${checkedLabel}">OK</button>
      ${
        isEditing
          ? renderEditForm(task)
          : `${renderTaskContent(task, dueText)}
            <div class="task-actions">
              <button class="edit-button" type="button" data-action="edit" aria-label="Edit task" title="Edit task">Edit</button>
              <button class="delete-button" type="button" data-action="delete" aria-label="Delete task" title="Delete task">x</button>
            </div>`
      }
    </li>
  `;
}

function renderTaskContent(task, dueText) {
  return `
    <div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      <div class="task-meta">
        <span class="pill ${task.priority}">${capitalize(task.priority)}</span>
        <span>${dueText}</span>
      </div>
    </div>
  `;
}

function renderEditForm(task) {
  return `
    <form class="edit-form">
      <input name="title" type="text" value="${escapeHtml(task.title)}" aria-label="Task title" required />
      <select name="priority" aria-label="Task priority">
        <option value="gentle" ${task.priority === "gentle" ? "selected" : ""}>Gentle</option>
        <option value="focus" ${task.priority === "focus" ? "selected" : ""}>Focus</option>
        <option value="urgent" ${task.priority === "urgent" ? "selected" : ""}>Urgent</option>
      </select>
      <input name="due" type="date" value="${task.due ?? ""}" aria-label="Task due date" />
      <button class="save-edit-button" type="submit">Save</button>
      <button class="cancel-edit-button" type="button" data-action="cancel-edit">Cancel</button>
    </form>
  `;
}

function getVisibleTasks() {
  if (activeFilter === "active") return tasks.filter((task) => !task.done);
  if (activeFilter === "done") return tasks.filter((task) => task.done);
  if (activeFilter === "today") return tasks.filter((task) => task.due === todayKey);
  return tasks;
}

function updateStats() {
  const done = tasks.filter((task) => task.done).length;
  const active = tasks.length - done;
  const dueToday = tasks.filter((task) => task.due === todayKey && !task.done).length;
  const score = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  totalCount.textContent = tasks.length;
  activeCount.textContent = active;
  doneCount.textContent = done;
  dueTodayCount.textContent = dueToday;
  focusScore.textContent = `${score}%`;
  progressFill.style.width = `${score}%`;

  if (!tasks.length) {
    focusCopy.textContent = "Add a task to begin.";
  } else if (score === 100) {
    focusCopy.textContent = "Everything is complete.";
  } else if (score >= 50) {
    focusCopy.textContent = "A steady day in motion.";
  } else {
    focusCopy.textContent = "Start with one small win.";
  }
}

function updateHint(count) {
  if (count === 0) {
    taskHint.textContent = "Nothing matches this view yet.";
    return;
  }

  taskHint.textContent = `${count} ${count === 1 ? "task" : "tasks"} in this view.`;
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

function reorderTasks(sourceId, targetId) {
  const sourceIndex = tasks.findIndex((task) => task.id === sourceId);
  const targetIndex = tasks.findIndex((task) => task.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [movedTask] = tasks.splice(sourceIndex, 1);
  tasks.splice(targetIndex, 0, movedTask);
}

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
  themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDueDate(value) {
  if (value === todayKey) return "Today";

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
