const TASKS_STORAGE_KEY = 'smartTasks';

let tasks = [];
let elements = null;
let draggedTaskId = '';

function generateId() {
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function loadTasks() {
    const parsed = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || '[]');
    tasks = parsed.map((task) => ({
        ...task,
        priority: task.priority || 'medium',
        blockedBy: task.blockedBy || '',
        completed: !!task.completed,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
    }));
}

function saveTasks() {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

function formatDate(dateString) {
    if (!dateString) {
        return 'No due date';
    }

    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
        return 'Invalid date';
    }

    return date.toLocaleDateString();
}

function isOverdue(task) {
    if (!task.dueDate) {
        return false;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(`${task.dueDate}T00:00:00`);

    return taskDate < todayStart && !task.completed;
}

function getPriorityClass(priority) {
    if (priority === 'high') {
        return 'priority-high';
    }
    if (priority === 'medium') {
        return 'priority-medium';
    }
    return 'priority-low';
}

function getTaskById(id) {
    return tasks.find((task) => task.id === id);
}

function hasDependencyLoop(taskId, dependencyId) {
    let cursor = dependencyId;

    while (cursor) {
        if (cursor === taskId) {
            return true;
        }

        const nextTask = getTaskById(cursor);
        if (!nextTask || !nextTask.blockedBy) {
            return false;
        }

        cursor = nextTask.blockedBy;
    }

    return false;
}

function isBlocked(task) {
    if (!task.blockedBy) {
        return false;
    }

    const blockingTask = getTaskById(task.blockedBy);
    return !!blockingTask && !blockingTask.completed;
}

function updateDependencyOptions() {
    const dependencySelect = elements.dependency;
    const currentSelection = dependencySelect.value;

    dependencySelect.innerHTML = '<option value="">None</option>';

    tasks.forEach((task) => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.title;
        dependencySelect.appendChild(option);
    });

    if (currentSelection && tasks.some((task) => task.id === currentSelection)) {
        dependencySelect.value = currentSelection;
    }
}

function renderDependencyMap() {
    if (!elements.dependencyList) {
        return;
    }

    elements.dependencyList.innerHTML = '';

    if (tasks.length === 0) {
        elements.dependencyList.innerHTML = '<li>No dependencies yet.</li>';
        return;
    }

    tasks.forEach((task) => {
        const item = document.createElement('li');
        if (!task.blockedBy) {
            item.textContent = `${task.title} -> ready (no blocker)`;
        } else {
            const blocker = getTaskById(task.blockedBy);
            item.textContent = `${task.title} -> blocked by ${blocker ? blocker.title : 'unknown task'}`;
        }
        elements.dependencyList.appendChild(item);
    });
}

function showMessage(message, isError = false) {
    elements.message.textContent = message;
    elements.message.classList.toggle('error-text', isError);
}

function toggleTaskCompletion(taskId) {
    const task = getTaskById(taskId);
    if (!task) {
        return;
    }

    task.completed = !task.completed;
    saveTasks();
    renderTasks();
}

function toggleSubtask(taskId, subtaskId) {
    const task = getTaskById(taskId);
    if (!task) {
        return;
    }

    const subtask = task.subtasks.find((item) => item.id === subtaskId);
    if (!subtask) {
        return;
    }

    subtask.completed = !subtask.completed;
    saveTasks();
    renderTasks();
}

function addSubtask(taskId, title) {
    const task = getTaskById(taskId);
    if (!task || !title.trim()) {
        return;
    }

    task.subtasks.push({
        id: generateId(),
        title: title.trim(),
        completed: false
    });

    saveTasks();
    renderTasks();
}

function removeTask(taskId) {
    tasks = tasks.map((task) => {
        if (task.blockedBy === taskId) {
            return { ...task, blockedBy: '' };
        }
        return task;
    }).filter((task) => task.id !== taskId);

    saveTasks();
    renderTasks();
}

function moveTask(dragTaskId, targetTaskId) {
    if (!dragTaskId || !targetTaskId || dragTaskId === targetTaskId) {
        return;
    }

    const fromIndex = tasks.findIndex((task) => task.id === dragTaskId);
    const toIndex = tasks.findIndex((task) => task.id === targetTaskId);

    if (fromIndex < 0 || toIndex < 0) {
        return;
    }

    const [moved] = tasks.splice(fromIndex, 1);
    tasks.splice(toIndex, 0, moved);

    saveTasks();
    renderTasks();
}

function moveTaskByOffset(taskId, offset) {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index < 0) {
        return;
    }

    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= tasks.length) {
        return;
    }

    const [moved] = tasks.splice(index, 1);
    tasks.splice(targetIndex, 0, moved);

    saveTasks();
    renderTasks();
    showMessage(`Moved "${moved.title}" ${offset < 0 ? 'up' : 'down'}.`);
}

function saveTaskEdits(taskId, title, dueDate, priority, blockedBy) {
    const task = getTaskById(taskId);
    if (!task) {
        return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !dueDate) {
        showMessage('Task title and due date are required.', true);
        return;
    }

    if (blockedBy === task.id || (blockedBy && hasDependencyLoop(task.id, blockedBy))) {
        showMessage('Dependency loop detected. Choose a different blocker.', true);
        return;
    }

    task.title = trimmedTitle;
    task.dueDate = dueDate;
    task.priority = priority;
    task.blockedBy = blockedBy;

    saveTasks();
    renderTasks();
    showMessage('Task updated.');
}

function buildEditForm(task) {
    const editor = document.createElement('form');
    editor.className = 'task-edit-form hidden';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = task.title;
    titleInput.required = true;

    const dueDateInput = document.createElement('input');
    dueDateInput.type = 'date';
    dueDateInput.value = task.dueDate || '';
    dueDateInput.required = true;

    const prioritySelect = document.createElement('select');
    ['high', 'medium', 'low'].forEach((level) => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level.toUpperCase();
        if (task.priority === level) {
            option.selected = true;
        }
        prioritySelect.appendChild(option);
    });

    const dependencySelect = document.createElement('select');
    dependencySelect.innerHTML = '<option value="">None</option>';
    tasks.forEach((candidate) => {
        if (candidate.id === task.id) {
            return;
        }
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = candidate.title;
        if (task.blockedBy === candidate.id) {
            option.selected = true;
        }
        dependencySelect.appendChild(option);
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'task-edit-actions';

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'feature-btn';
    saveButton.textContent = 'Save';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'task-expand-btn';
    cancelButton.textContent = 'Cancel';

    cancelButton.addEventListener('click', () => {
        editor.classList.add('hidden');
    });

    actionRow.appendChild(saveButton);
    actionRow.appendChild(cancelButton);

    editor.appendChild(titleInput);
    editor.appendChild(dueDateInput);
    editor.appendChild(prioritySelect);
    editor.appendChild(dependencySelect);
    editor.appendChild(actionRow);

    editor.addEventListener('submit', (event) => {
        event.preventDefault();
        saveTaskEdits(task.id, titleInput.value, dueDateInput.value, prioritySelect.value, dependencySelect.value);
    });

    return editor;
}

function createSubtaskList(task) {
    const wrapper = document.createElement('div');
    wrapper.className = 'subtask-wrapper';

    const form = document.createElement('form');
    form.className = 'subtask-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add a subtask';
    input.required = true;

    const addButton = document.createElement('button');
    addButton.type = 'submit';
    addButton.className = 'feature-btn';
    addButton.textContent = 'Add';

    form.appendChild(input);
    form.appendChild(addButton);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        addSubtask(task.id, input.value);
    });

    const list = document.createElement('ul');
    list.className = 'subtask-list';

    task.subtasks.forEach((subtask) => {
        const item = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!subtask.completed;
        checkbox.addEventListener('change', () => {
            toggleSubtask(task.id, subtask.id);
        });

        const text = document.createElement('span');
        text.textContent = subtask.title;
        if (subtask.completed) {
            text.classList.add('task-completed');
        }

        item.appendChild(checkbox);
        item.appendChild(text);
        list.appendChild(item);
    });

    wrapper.appendChild(form);
    wrapper.appendChild(list);
    return wrapper;
}

function createTaskCard(task) {
    const card = document.createElement('article');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    card.addEventListener('dragstart', () => {
        draggedTaskId = task.id;
        card.classList.add('task-dragging');
    });

    card.addEventListener('dragend', () => {
        draggedTaskId = '';
        card.classList.remove('task-dragging');
    });

    card.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    card.addEventListener('drop', () => {
        moveTask(draggedTaskId, task.id);
    });

    if (isOverdue(task)) {
        card.classList.add('task-overdue');
    }

    const blocked = isBlocked(task);
    if (blocked) {
        card.classList.add('task-blocked');
    }

    const header = document.createElement('div');
    header.className = 'task-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'task-title-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!task.completed;
    checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));

    const title = document.createElement('h3');
    title.textContent = task.title;
    if (task.completed) {
        title.classList.add('task-completed');
    }

    titleRow.appendChild(checkbox);
    titleRow.appendChild(title);

    const priority = document.createElement('span');
    priority.className = `priority-pill ${getPriorityClass(task.priority)}`;
    priority.textContent = task.priority.toUpperCase();

    const orderActions = document.createElement('div');
    orderActions.className = 'task-order-actions';

    const moveUpButton = document.createElement('button');
    moveUpButton.type = 'button';
    moveUpButton.className = 'task-order-btn';
    moveUpButton.textContent = 'Move up';
    moveUpButton.setAttribute('aria-label', `Move ${task.title} up`);
    moveUpButton.addEventListener('click', () => {
        moveTaskByOffset(task.id, -1);
    });

    const moveDownButton = document.createElement('button');
    moveDownButton.type = 'button';
    moveDownButton.className = 'task-order-btn';
    moveDownButton.textContent = 'Move down';
    moveDownButton.setAttribute('aria-label', `Move ${task.title} down`);
    moveDownButton.addEventListener('click', () => {
        moveTaskByOffset(task.id, 1);
    });

    const currentIndex = tasks.findIndex((item) => item.id === task.id);
    moveUpButton.disabled = currentIndex <= 0;
    moveDownButton.disabled = currentIndex === tasks.length - 1;

    orderActions.appendChild(moveUpButton);
    orderActions.appendChild(moveDownButton);

    header.appendChild(titleRow);
    header.appendChild(priority);
    header.appendChild(orderActions);

    const meta = document.createElement('p');
    meta.className = 'task-meta';
    meta.textContent = `Due: ${formatDate(task.dueDate)}`;

    const dependency = document.createElement('p');
    dependency.className = 'task-meta';
    if (!task.blockedBy) {
        dependency.textContent = 'Blocked by: none';
    } else {
        const blockingTask = getTaskById(task.blockedBy);
        dependency.textContent = `Blocked by: ${blockingTask ? blockingTask.title : 'unknown task'}`;
    }

    const blockedState = document.createElement('p');
    blockedState.className = 'task-meta';
    blockedState.textContent = blocked ? 'Status: blocked' : 'Status: ready';

    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className = 'task-expand-btn';
    expandButton.textContent = 'Expand subtasks';

    const subtaskContainer = createSubtaskList(task);
    subtaskContainer.classList.add('hidden');

    expandButton.addEventListener('click', () => {
        const isHidden = subtaskContainer.classList.contains('hidden');
        subtaskContainer.classList.toggle('hidden', !isHidden);
        expandButton.textContent = isHidden ? 'Hide subtasks' : 'Expand subtasks';
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'task-remove-btn';
    removeButton.textContent = 'Delete task';
    removeButton.addEventListener('click', () => removeTask(task.id));

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'task-expand-btn';
    editButton.textContent = 'Edit task';

    const editForm = buildEditForm(task);
    editButton.addEventListener('click', () => {
        editForm.classList.toggle('hidden');
    });

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(dependency);
    card.appendChild(blockedState);
    card.appendChild(expandButton);
    card.appendChild(editButton);
    card.appendChild(subtaskContainer);
    card.appendChild(editForm);
    card.appendChild(removeButton);

    return card;
}

function renderTasks() {
    elements.list.innerHTML = '';

    if (tasks.length === 0) {
        elements.list.innerHTML = '<p class="helper-text">No tasks yet. Add your first task above.</p>';
        updateDependencyOptions();
        renderDependencyMap();
        return;
    }

    tasks.forEach((task) => {
        elements.list.appendChild(createTaskCard(task));
    });

    updateDependencyOptions();
    renderDependencyMap();
}

function handleTaskSubmit(event) {
    event.preventDefault();

    const title = elements.title.value.trim();
    const dueDate = elements.dueDate.value;
    const priority = elements.priority.value;
    const blockedBy = elements.dependency.value;

    if (!title || !dueDate) {
        showMessage('Please add a task title and due date.', true);
        return;
    }

    const task = {
        id: generateId(),
        title,
        dueDate,
        priority,
        blockedBy,
        completed: false,
        subtasks: []
    };

    if (blockedBy && hasDependencyLoop(task.id, blockedBy)) {
        showMessage('Dependency loop detected. Choose a different blocker.', true);
        return;
    }

    tasks.push(task);
    saveTasks();
    renderTasks();
    elements.form.reset();
    elements.priority.value = 'medium';
    showMessage('Task added successfully.');
}

export function initTaskManager() {
    const form = document.getElementById('task-form');
    const list = document.getElementById('task-list');
    const message = document.getElementById('task-message');
    const title = document.getElementById('task-title');
    const dueDate = document.getElementById('task-due-date');
    const priority = document.getElementById('task-priority');
    const dependency = document.getElementById('task-dependency');
    const dependencyList = document.getElementById('task-dependency-list');

    if (!form || !list || !message || !title || !dueDate || !priority || !dependency || !dependencyList) {
        return;
    }

    elements = {
        form,
        list,
        message,
        title,
        dueDate,
        priority,
        dependency,
        dependencyList
    };

    loadTasks();
    renderTasks();
    showMessage('Task manager ready.');

    form.addEventListener('submit', handleTaskSubmit);
}
