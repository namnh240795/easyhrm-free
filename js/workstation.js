/**
 * Workstation Setup Module
 * Handles workstation configuration and storage
 */

// Days of week configuration
const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
];

// Default schedule (9 AM - 5 PM for weekdays)
const DEFAULT_SCHEDULE = {
    monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
    sunday: { enabled: false, startTime: '09:00', endTime: '17:00' }
};

// DOM Elements
const currentWorkstationEl = document.getElementById('current-workstation');
const workstationFormEl = document.getElementById('workstation-form');
const formTitleEl = document.getElementById('form-title');
const formSubtitleEl = document.getElementById('form-subtitle');
const wsForm = document.getElementById('ws-form');
const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const scheduleGridEl = document.getElementById('schedule-grid');
const copyMondayBtn = document.getElementById('copy-monday-btn');
const copyWeekdaysBtn = document.getElementById('copy-weekdays-btn');

// Form inputs
const wsNameInput = document.getElementById('ws-name-input');
const wsLocationInput = document.getElementById('ws-location-input');
const wsDepartmentInput = document.getElementById('ws-department-input');
const wsTypeInput = document.getElementById('ws-type-input');
const wsStatusInput = document.getElementById('ws-status-input');
const wsCodeInput = document.getElementById('ws-code-input');
const wsNotesInput = document.getElementById('ws-notes-input');

// Display elements
const wsNameDisplay = document.getElementById('ws-name');
const wsLocationDisplay = document.getElementById('ws-location');
const wsDepartmentDisplay = document.getElementById('ws-department');
const wsTypeDisplay = document.getElementById('ws-type');
const wsStatusDisplay = document.getElementById('ws-status');
const wsUpdatedDisplay = document.getElementById('ws-updated');

// State
let currentWorkstation = null;
let isEditMode = false;
let scheduleData = { ...DEFAULT_SCHEDULE };

/**
 * Initialize the application
 */
async function init() {
    try {
        generateScheduleGrid();
        await loadWorkstation();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Error loading workstation: ' + error.message);
    }
}

/**
 * Generate the schedule grid HTML
 */
function generateScheduleGrid() {
    scheduleGridEl.innerHTML = DAYS_OF_WEEK.map(day => `
        <div class="schedule-day" id="day-${day.key}">
            <input type="checkbox" class="day-checkbox" id="checkbox-${day.key}" checked>
            <span class="day-name">${day.label}</span>
            <input type="time" class="time-input start-time" id="start-${day.key}" value="09:00">
            <input type="time" class="time-input end-time" id="end-${day.key}" value="17:00">
            <div class="schedule-actions">
                <button type="button" class="btn btn-secondary btn-sm" onclick="resetDay('${day.key}')">Reset</button>
            </div>
        </div>
    `).join('');

    // Add event listeners for checkboxes
    DAYS_OF_WEEK.forEach(day => {
        const checkbox = document.getElementById(`checkbox-${day.key}`);
        const dayEl = document.getElementById(`day-${day.key}`);
        const startInput = document.getElementById(`start-${day.key}`);
        const endInput = document.getElementById(`end-${day.key}`);

        checkbox.addEventListener('change', () => {
            dayEl.classList.toggle('disabled', !checkbox.checked);
            startInput.disabled = !checkbox.checked;
            endInput.disabled = !checkbox.checked;
        });
    });

    // Initialize with disabled state for unchecked days
    DAYS_OF_WEEK.forEach(day => {
        if (!scheduleData[day.key].enabled) {
            const checkbox = document.getElementById(`checkbox-${day.key}`);
            const dayEl = document.getElementById(`day-${day.key}`);
            const startInput = document.getElementById(`start-${day.key}`);
            const endInput = document.getElementById(`end-${day.key}`);

            checkbox.checked = false;
            dayEl.classList.add('disabled');
            startInput.disabled = true;
            endInput.disabled = true;
        }
    });
}

/**
 * Get schedule data from the form
 */
function getScheduleFromForm() {
    const schedule = {};

    DAYS_OF_WEEK.forEach(day => {
        const checkbox = document.getElementById(`checkbox-${day.key}`);
        const startInput = document.getElementById(`start-${day.key}`);
        const endInput = document.getElementById(`end-${day.key}`);

        schedule[day.key] = {
            enabled: checkbox.checked,
            startTime: startInput.value,
            endTime: endInput.value
        };
    });

    return schedule;
}

/**
 * Populate schedule data in the form
 */
function populateScheduleForm(schedule) {
    scheduleData = { ...DEFAULT_SCHEDULE, ...schedule };

    DAYS_OF_WEEK.forEach(day => {
        const dayData = scheduleData[day.key] || { enabled: false, startTime: '09:00', endTime: '17:00' };
        const checkbox = document.getElementById(`checkbox-${day.key}`);
        const dayEl = document.getElementById(`day-${day.key}`);
        const startInput = document.getElementById(`start-${day.key}`);
        const endInput = document.getElementById(`end-${day.key}`);

        checkbox.checked = dayData.enabled;
        startInput.value = dayData.startTime;
        endInput.value = dayData.endTime;

        if (dayData.enabled) {
            dayEl.classList.remove('disabled');
            startInput.disabled = false;
            endInput.disabled = false;
        } else {
            dayEl.classList.add('disabled');
            startInput.disabled = true;
            endInput.disabled = true;
        }
    });
}

/**
 * Reset a specific day to default values
 */
function resetDay(dayKey) {
    const checkbox = document.getElementById(`checkbox-${dayKey}`);
    const startInput = document.getElementById(`start-${dayKey}`);
    const endInput = document.getElementById(`end-${dayKey}`);
    const dayEl = document.getElementById(`day-${dayKey}`);

    const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(dayKey);

    checkbox.checked = isWeekday;
    startInput.value = '09:00';
    endInput.value = '17:00';

    if (isWeekday) {
        dayEl.classList.remove('disabled');
        startInput.disabled = false;
        endInput.disabled = false;
    } else {
        dayEl.classList.add('disabled');
        startInput.disabled = true;
        endInput.disabled = true;
    }
}

/**
 * Copy Monday's schedule to all days
 */
function copyMondayToAll() {
    const mondayCheckbox = document.getElementById('checkbox-monday');
    const mondayStart = document.getElementById('start-monday').value;
    const mondayEnd = document.getElementById('end-monday').value;

    DAYS_OF_WEEK.forEach(day => {
        const checkbox = document.getElementById(`checkbox-${day.key}`);
        const dayEl = document.getElementById(`day-${day.key}`);
        const startInput = document.getElementById(`start-${day.key}`);
        const endInput = document.getElementById(`end-${day.key}`);

        checkbox.checked = mondayCheckbox.checked;
        startInput.value = mondayStart;
        endInput.value = mondayEnd;

        if (mondayCheckbox.checked) {
            dayEl.classList.remove('disabled');
            startInput.disabled = false;
            endInput.disabled = false;
        } else {
            dayEl.classList.add('disabled');
            startInput.disabled = true;
            endInput.disabled = true;
        }
    });
}

/**
 * Copy Monday's schedule to weekdays only
 */
function copyToWeekdays() {
    const mondayCheckbox = document.getElementById('checkbox-monday');
    const mondayStart = document.getElementById('start-monday').value;
    const mondayEnd = document.getElementById('end-monday').value;

    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    weekdays.forEach(dayKey => {
        const checkbox = document.getElementById(`checkbox-${dayKey}`);
        const dayEl = document.getElementById(`day-${dayKey}`);
        const startInput = document.getElementById(`start-${dayKey}`);
        const endInput = document.getElementById(`end-${dayKey}`);

        checkbox.checked = mondayCheckbox.checked;
        startInput.value = mondayStart;
        endInput.value = mondayEnd;

        if (mondayCheckbox.checked) {
            dayEl.classList.remove('disabled');
            startInput.disabled = false;
            endInput.disabled = false;
        } else {
            dayEl.classList.add('disabled');
            startInput.disabled = true;
            endInput.disabled = true;
        }
    });
}

/**
 * Check if current time is within working hours
 */
function isWithinWorkingHours() {
    const now = new Date();
    const dayKey = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1].key;
    const currentTime = now.toTimeString().slice(0, 5);

    const daySchedule = scheduleData[dayKey];

    if (!daySchedule || !daySchedule.enabled) {
        return { withinHours: false, reason: 'Outside working days' };
    }

    if (currentTime >= daySchedule.startTime && currentTime <= daySchedule.endTime) {
        return { withinHours: true, schedule: daySchedule };
    } else {
        return { withinHours: false, reason: 'Outside working hours' };
    }
}

/**
 * Get workstation schedule data (for use in other pages)
 */
async function getWorkstationSchedule() {
    const ws = await faceDB.getWorkstation();
    return ws ? ws.schedule || DEFAULT_SCHEDULE : DEFAULT_SCHEDULE;
}

/**
 * Check if workstation is configured
 */
async function isWorkstationConfigured() {
    return await faceDB.isWorkstationConfigured();
}

/**
 * Get workstation info (for use in other pages)
 */
async function getWorkstationInfo() {
    return await faceDB.getWorkstation();
}

/**
 * Load workstation configuration
 */
async function loadWorkstation() {
    try {
        currentWorkstation = await faceDB.getWorkstation();

        if (currentWorkstation) {
            // Update schedule data for working hours check
            scheduleData = currentWorkstation.schedule || DEFAULT_SCHEDULE;
            displayWorkstation(currentWorkstation);
        } else {
            showForm();
        }
    } catch (error) {
        throw new Error('Failed to load workstation configuration');
    }
}

/**
 * Display workstation information
 */
function displayWorkstation(ws) {
    currentWorkstationEl.style.display = 'block';
    workstationFormEl.style.display = 'none';

    wsNameDisplay.textContent = ws.name || '-';
    wsLocationDisplay.textContent = ws.location || '-';
    wsDepartmentDisplay.textContent = ws.department || '-';
    wsTypeDisplay.textContent = getTypeLabel(ws.type) || '-';
    wsUpdatedDisplay.textContent = ws.updatedAt ? new Date(ws.updatedAt).toLocaleString() : '-';

    wsStatusDisplay.textContent = ws.status || 'Unknown';
    wsStatusDisplay.className = 'status-badge ' + (ws.status === 'active' ? 'active' : 'inactive');
}

/**
 * Get human-readable type label
 */
function getTypeLabel(type) {
    const types = {
        'kiosk': 'Self-Service Kiosk',
        'reception': 'Reception Desk',
        'security': 'Security Gate',
        'office': 'Office Station',
        'mobile': 'Mobile Device',
        'other': 'Other'
    };
    return types[type] || type;
}

/**
 * Show the form for creating/editing workstation
 */
function showForm(editMode = false) {
    isEditMode = editMode;
    currentWorkstationEl.style.display = editMode ? 'block' : 'none';
    workstationFormEl.style.display = 'block';

    if (editMode && currentWorkstation) {
        formTitleEl.textContent = 'Edit Workstation';
        formSubtitleEl.textContent = 'Update your workstation configuration';
        saveBtn.textContent = 'Update Configuration';
        cancelBtn.style.display = 'inline-block';

        // Populate form with existing data
        wsNameInput.value = currentWorkstation.name || '';
        wsLocationInput.value = currentWorkstation.location || '';
        wsDepartmentInput.value = currentWorkstation.department || '';
        wsTypeInput.value = currentWorkstation.type || '';
        wsStatusInput.value = currentWorkstation.status || 'active';
        wsCodeInput.value = currentWorkstation.code || '';
        wsNotesInput.value = currentWorkstation.notes || '';

        // Populate schedule
        populateScheduleForm(currentWorkstation.schedule || DEFAULT_SCHEDULE);
    } else {
        formTitleEl.textContent = 'Setup Workstation';
        formSubtitleEl.textContent = 'Configure your workstation details';
        saveBtn.textContent = 'Save Configuration';
        cancelBtn.style.display = 'none';

        // Clear form
        wsForm.reset();
        wsStatusInput.value = 'active';

        // Reset to default schedule
        populateScheduleForm(DEFAULT_SCHEDULE);
    }
}

/**
 * Validate form inputs
 */
function validateForm() {
    const name = wsNameInput.value.trim();
    const location = wsLocationInput.value.trim();

    if (!name) {
        alert('Please enter a workstation name');
        wsNameInput.focus();
        return false;
    }

    if (!location) {
        alert('Please enter a location');
        wsLocationInput.focus();
        return false;
    }

    return true;
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    const workstationData = {
        name: wsNameInput.value.trim(),
        location: wsLocationInput.value.trim(),
        department: wsDepartmentInput.value.trim() || null,
        type: wsTypeInput.value || null,
        status: wsStatusInput.value,
        code: wsCodeInput.value.trim() || null,
        notes: wsNotesInput.value.trim() || null,
        schedule: getScheduleFromForm()
    };

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = isEditMode ? 'Updating...' : 'Saving...';

        await faceDB.saveWorkstation(workstationData);
        currentWorkstation = await faceDB.getWorkstation();

        // Update schedule data for working hours check
        scheduleData = currentWorkstation.schedule || DEFAULT_SCHEDULE;

        displayWorkstation(currentWorkstation);

        // Show success message
        const action = isEditMode ? 'updated' : 'configured';
        alert(`Workstation ${action} successfully!`);
    } catch (error) {
        alert('Error saving workstation: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Configuration';
    }
}

/**
 * Handle edit button click
 */
function handleEdit() {
    showForm(true);
}

/**
 * Handle delete button click
 */
async function handleDelete() {
    if (!confirm('Are you sure you want to delete this workstation configuration?')) {
        return;
    }

    try {
        await faceDB.deleteWorkstation();
        currentWorkstation = null;

        alert('Workstation configuration deleted!');
        showForm(false);
    } catch (error) {
        alert('Error deleting workstation: ' + error.message);
    }
}

/**
 * Handle cancel button click
 */
function handleCancel() {
    if (currentWorkstation) {
        displayWorkstation(currentWorkstation);
    } else {
        showForm(false);
    }
}

/**
 * Show error message
 */
function showError(message) {
    // Create temporary error alert
    const errorDiv = document.createElement('div');
    errorDiv.className = 'status error';
    errorDiv.style.marginTop = '1rem';
    errorDiv.innerHTML = `<span class="status-dot"></span><span>${message}</span>`;

    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);

    // Remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

// Event Listeners
wsForm.addEventListener('submit', handleSubmit);
editBtn.addEventListener('click', handleEdit);
deleteBtn.addEventListener('click', handleDelete);
cancelBtn.addEventListener('click', handleCancel);
copyMondayBtn.addEventListener('click', copyMondayToAll);
copyWeekdaysBtn.addEventListener('click', copyToWeekdays);

// Make resetDay available globally
window.resetDay = resetDay;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', init);
