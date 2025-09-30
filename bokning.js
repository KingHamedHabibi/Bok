(function () {
    'use strict';

    const DAY_NAMES = ['M\u00e5n', 'Tis', 'Ons', 'Tor', 'Fre', 'L\u00f6r', 'S\u00f6n'];
    const BUSINESS_DAYS = new Set([1, 2, 3, 4, 5]);
    const OPEN_HOUR = 8;
    const CLOSE_HOUR = 17;
    const SLOT_INTERVAL_MIN = 30;
    const LUNCH_START_MIN = 12 * 60;
    const LUNCH_END_MIN = 13 * 60;
    const TIME_SLOTS = (() => {
        const out = [];
        for (let m = OPEN_HOUR * 60; m <= CLOSE_HOUR * 60; m += SLOT_INTERVAL_MIN) {
            if (m >= LUNCH_START_MIN && m < LUNCH_END_MIN) continue;
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            out.push(`${hh}:${mm}`);
        }
        return out;
    })();
    const STORAGE_KEY = 'bdt.bookings.v1';

    const toDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateKey = (key) => {
        const [year, month, day] = key.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const addDays = (date, amount) => {
        const output = new Date(date);
        output.setDate(output.getDate() + amount);
        return output;
    };

    const addMonths = (date, amount) => {
        const output = new Date(date);
        output.setMonth(output.getMonth() + amount);
        return output;
    };

    const startOfWeek = (date) => {
        const base = startOfDay(date);
        const day = base.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        return addDays(base, diff);
    };

    const endOfWeek = (date) => addDays(startOfWeek(date), 6);

    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

    const isBusinessDay = (date) => BUSINESS_DAYS.has(date.getDay());

    const createDateTime = (dateKey, time) => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute);
    };

    const formatMonthYear = (date) => new Intl.DateTimeFormat('sv-SE', {
        month: 'long',
        year: 'numeric'
    }).format(date);

    const formatDayLabel = (date) => new Intl.DateTimeFormat('sv-SE', {
        weekday: 'short',
        day: 'numeric'
    }).format(date);

    const formatFullDate = (date) => new Intl.DateTimeFormat('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);

    const formatCardDate = (date) => new Intl.DateTimeFormat('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
    }).format(date);

    const capitalise = (value) => value.charAt(0).toUpperCase() + value.slice(1);

    const compareBookings = (a, b) => {
        if (a.date === b.date) {
            return a.time.localeCompare(b.time);
        }
        return a.date.localeCompare(b.date);
    };

    const findNextBusinessDay = (date) => {
        let pointer = startOfDay(date);
        const direction = isBusinessDay(pointer) ? 0 : 1;
        while (!isBusinessDay(pointer)) {
            pointer = addDays(pointer, direction || 1);
        }
        return pointer;
    };
    class BookingStore {
        constructor(storageKey = STORAGE_KEY) {
            this.storageKey = storageKey;
            this.bookings = [];
            this.supportsStorage = this.checkSupport();
            this.load();
        }

        checkSupport() {
            try {
                const key = '__storage_test__';
                window.localStorage.setItem(key, '1');
                window.localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('LocalStorage inte tillg\u00e4ngligt, anv\u00e4nder minne.');
                return false;
            }
        }

        load() {
            if (!this.supportsStorage) {
                this.bookings = [];
                return;
            }
            try {
                const raw = window.localStorage.getItem(this.storageKey);
                this.bookings = raw ? JSON.parse(raw) : [];
            } catch (error) {
                console.error('Kunde inte l\u00e4sa bokningsdata', error);
                this.bookings = [];
            }
        }

        persist() {
            if (!this.supportsStorage) {
                return;
            }
            try {
                window.localStorage.setItem(this.storageKey, JSON.stringify(this.bookings));
            } catch (error) {
                console.error('Kunde inte spara bokningsdata', error);
            }
        }

        getAll() {
            return [...this.bookings].sort(compareBookings);
        }

        findByDate(dateKey) {
            return this.bookings.filter((booking) => booking.date === dateKey);
        }

        findById(id) {
            return this.bookings.find((booking) => booking.id === id) || null;
        }

        isSlotBooked(dateKey, time, ignoreId = null) {
            return this.bookings.some((booking) => {
                const sameSlot = booking.date === dateKey && booking.time === time;
                const isIgnored = ignoreId && booking.id === ignoreId;
                return sameSlot && !isIgnored;
            });
        }

        add(booking) {
            this.bookings.push(booking);
            this.persist();
            return booking;
        }

        update(id, updates) {
            const index = this.bookings.findIndex((booking) => booking.id === id);
            if (index === -1) {
                return null;
            }
            this.bookings[index] = { ...this.bookings[index], ...updates };
            this.persist();
            return this.bookings[index];
        }

        remove(id) {
            this.bookings = this.bookings.filter((booking) => booking.id !== id);
            this.persist();
        }
    }
    class CalendarApp {
        constructor() {
            this.store = new BookingStore();
            let today = startOfDay(new Date());
            if (!isBusinessDay(today)) {
                today = findNextBusinessDay(today);
            }

            this.state = {
                view: 'month',
                currentDate: new Date(today.getFullYear(), today.getMonth(), 1),
                selectedDate: today,
                pendingSlot: null,
                bookingInEdit: null
            };

            this.elements = {
                viewButtons: Array.from(document.querySelectorAll('.view-button')),
                navButtons: Array.from(document.querySelectorAll('.nav-button')),
                currentRange: document.getElementById('current-range'),
                dayLabels: document.getElementById('day-labels'),
                calendarView: document.getElementById('calendar-view'),
                slotList: document.getElementById('slot-list'),
                slotListWrapper: document.querySelector('.slot-panel'),
                selectedDateLabel: document.getElementById('selected-date-label'),
                bookingCards: document.getElementById('booking-cards'),
                bookingEmpty: document.getElementById('booking-empty'),
                modal: document.getElementById('booking-modal'),
                modalBackdrop: document.getElementById('modal-backdrop'),
                modalClose: document.querySelector('.modal-close'),
                modalSlot: document.getElementById('modal-slot'),
                bookingForm: document.getElementById('booking-form'),
                modalCancel: document.getElementById('modal-cancel'),
                modalSuccess: document.getElementById('booking-success'),
                successMessage: document.getElementById('success-message'),
                successClose: document.getElementById('success-close'),
                toast: document.getElementById('toast')
            };

            this.toastTimer = null;
            this.bindEvents();
            this.updateDayLabels();
            this.render();
        }

        bindEvents() {
            this.elements.viewButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const view = button.dataset.view;
                    if (view) {
                        this.setView(view);
                    }
                });
            });

            this.elements.navButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const action = button.dataset.action;
                    if (action === 'prev') {
                        this.goToPrevious();
                    } else if (action === 'next') {
                        this.goToNext();
                    } else if (action === 'today') {
                        this.goToToday();
                    }
                });
            });

            // Delegate clicks from calendar grid and timeline
            this.elements.calendarView.addEventListener('click', (event) => {
                const dayCell = event.target.closest('.calendar-cell');
                if (dayCell) {
                    if (dayCell.disabled) {
                        return;
                    }
                    const dateKey = dayCell.dataset.date;
                    if (dateKey) {
                        this.selectDate(parseDateKey(dateKey));
                    }
                    return;
                }

                const slotButton = event.target.closest('.week-slot, .timeline-slot');
                if (slotButton && !slotButton.disabled) {
                    const { date: dateKey, time } = slotButton.dataset;
                    if (dateKey && time) {
                        this.handleSlotSelection({ dateKey, time });
                    }
                }
            });

            this.elements.slotList.addEventListener('click', (event) => {
                const button = event.target.closest('.slot-button');
                if (button && !button.disabled) {
                    const { date: dateKey, time } = button.dataset;
                    if (dateKey && time) {
                        this.handleSlotSelection({ dateKey, time });
                    }
                }
            });

            this.elements.bookingCards.addEventListener('click', (event) => {
                const actionButton = event.target.closest('[data-action]');
                if (!actionButton) {
                    return;
                }
                const { action, id } = actionButton.dataset;
                if (!id) {
                    return;
                }
                if (action === 'cancel') {
                    this.cancelBooking(id);
                } else if (action === 'edit') {
                    this.startEditBooking(id);
                }
            });

            this.elements.modalClose.addEventListener('click', () => this.closeModal());
            this.elements.modalCancel.addEventListener('click', () => this.closeModal());
            this.elements.successClose.addEventListener('click', () => this.closeModal());
            this.elements.modalBackdrop.addEventListener('click', () => this.closeModal());

            this.elements.bookingForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.submitBooking();
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !this.elements.modal.classList.contains('hidden')) {
                    this.closeModal();
                }
            });
        }
        setView(view) {
            if (!['month', 'week', 'day'].includes(view)) {
                return;
            }
            this.state.view = view;
            if (view === 'month') {
                this.state.currentDate = new Date(this.state.selectedDate.getFullYear(), this.state.selectedDate.getMonth(), 1);
            } else if (view === 'week') {
                this.state.currentDate = startOfWeek(this.state.selectedDate);
            } else {
                this.state.currentDate = startOfDay(this.state.selectedDate);
            }
            this.render();
        }

        goToToday() {
            let today = startOfDay(new Date());
            if (!isBusinessDay(today)) {
                today = findNextBusinessDay(today);
            }
            this.state.selectedDate = today;
            this.state.pendingSlot = null;
            if (this.state.view === 'month') {
                this.state.currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
            } else if (this.state.view === 'week') {
                this.state.currentDate = startOfWeek(today);
            } else {
                this.state.currentDate = today;
            }
            this.render();
        }

        goToPrevious() {
            if (this.state.view === 'month') {
                this.state.currentDate = addMonths(this.state.currentDate, -1);
            } else if (this.state.view === 'week') {
                this.state.currentDate = addDays(this.state.currentDate, -7);
            } else {
                let candidate = addDays(this.state.currentDate, -1);
                while (!isBusinessDay(candidate)) {
                    candidate = addDays(candidate, -1);
                }
                this.state.currentDate = candidate;
                this.state.selectedDate = candidate;
            }
            if (this.state.view !== 'day') {
                this.state.selectedDate = this.alignSelectedDate();
            }
            this.state.pendingSlot = null;
            this.render();
        }

        goToNext() {
            if (this.state.view === 'month') {
                this.state.currentDate = addMonths(this.state.currentDate, 1);
            } else if (this.state.view === 'week') {
                this.state.currentDate = addDays(this.state.currentDate, 7);
            } else {
                let candidate = addDays(this.state.currentDate, 1);
                while (!isBusinessDay(candidate)) {
                    candidate = addDays(candidate, 1);
                }
                this.state.currentDate = candidate;
                this.state.selectedDate = candidate;
            }
            if (this.state.view !== 'day') {
                this.state.selectedDate = this.alignSelectedDate();
            }
            this.state.pendingSlot = null;
            this.render();
        }

        alignSelectedDate() {
            if (this.state.view === 'month') {
                const reference = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth(), 1);
                if (!isSameMonth(this.state.selectedDate, reference)) {
                    const candidate = findNextBusinessDay(reference);
                    return candidate;
                }
            }
            if (this.state.view === 'week') {
                const start = startOfWeek(this.state.currentDate);
                const end = endOfWeek(this.state.currentDate);
                if (this.state.selectedDate < start || this.state.selectedDate > end || !isBusinessDay(this.state.selectedDate)) {
                    let candidate = start;
                    while (!isBusinessDay(candidate) && candidate <= end) {
                        candidate = addDays(candidate, 1);
                    }
                    return candidate;
                }
            }
            return this.state.selectedDate;
        }

        selectDate(date) {
            const candidate = startOfDay(date);
            if (!isBusinessDay(candidate)) {
                this.showToast('Bokningar g\u00f6rs m\u00e5ndag till fredag.');
                return;
            }
            this.state.selectedDate = candidate;
            if (this.state.view === 'month') {
                this.state.currentDate = new Date(candidate.getFullYear(), candidate.getMonth(), 1);
            } else if (this.state.view === 'week') {
                this.state.currentDate = startOfWeek(candidate);
            } else {
                this.state.currentDate = candidate;
            }
            this.state.pendingSlot = null;
            this.render();
        }

        render() {
            this.updateViewButtons();
            this.updateRangeLabel();
            this.renderCalendar();
            this.renderSlotPanel();
            this.renderBookings();
        }

        updateViewButtons() {
            this.elements.viewButtons.forEach((button) => {
                if (button.dataset.view === this.state.view) {
                    button.classList.add('is-active');
                    button.setAttribute('aria-selected', 'true');
                } else {
                    button.classList.remove('is-active');
                    button.setAttribute('aria-selected', 'false');
                }
            });
        }

        updateRangeLabel() {
            if (this.state.view === 'month') {
                this.elements.currentRange.textContent = capitalise(formatMonthYear(this.state.currentDate));
            } else if (this.state.view === 'week') {
                const start = startOfWeek(this.state.currentDate);
                const end = endOfWeek(this.state.currentDate);
                const startLabel = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(start);
                const endLabel = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
                this.elements.currentRange.textContent = `${startLabel} - ${endLabel}`;
            } else {
                this.elements.currentRange.textContent = capitalise(formatFullDate(this.state.currentDate));
            }
        }

        updateDayLabels() {
            this.elements.dayLabels.innerHTML = '';
            DAY_NAMES.forEach((day) => {
                const span = document.createElement('span');
                span.textContent = day;
                this.elements.dayLabels.appendChild(span);
            });
        }
        renderCalendar() {
            const view = this.state.view;
            if (view === 'month') {
                this.elements.dayLabels.classList.remove('hidden');
                this.renderMonthView();
            } else if (view === 'week') {
                this.elements.dayLabels.classList.add('hidden');
                this.renderWeekView();
            } else {
                this.elements.dayLabels.classList.add('hidden');
                this.renderDayView();
            }
        }

        // Build a 6-week matrix that always starts on a Monday
        renderMonthView() {
            const calendar = this.elements.calendarView;
            calendar.className = 'calendar-view month-view';
            calendar.innerHTML = '';

            const firstOfMonth = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth(), 1);
            const start = startOfWeek(firstOfMonth);
            const cells = [];
            for (let i = 0; i < 42; i += 1) {
                cells.push(addDays(start, i));
            }

            const today = startOfDay(new Date());
            const fragment = document.createDocumentFragment();

            cells.forEach((date) => {
                const dateKey = toDateKey(date);
                const bookings = this.store.findByDate(dateKey);
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.classList.add('calendar-cell');
                cell.dataset.date = dateKey;

                if (!isBusinessDay(date)) {
                    cell.classList.add('is-closed');
                    cell.disabled = true;
                }
                if (!isSameMonth(date, firstOfMonth)) {
                    cell.classList.add('is-inactive');
                }
                if (isSameDay(date, today)) {
                    cell.classList.add('is-today');
                }
                if (isSameDay(date, this.state.selectedDate)) {
                    cell.classList.add('is-selected');
                }
                if (bookings.length >= TIME_SLOTS.length && isBusinessDay(date)) {
                    cell.classList.add('is-booked');
                }

                const number = document.createElement('span');
                number.className = 'day-number';
                number.textContent = String(date.getDate());
                cell.appendChild(number);

                const badges = document.createElement('div');
                badges.className = 'booking-badges';

                if (bookings.length > 0) {
                    const bookedBadge = document.createElement('span');
                    bookedBadge.className = 'badge is-booked';
                    bookedBadge.textContent = `${bookings.length} bokad`;
                    badges.appendChild(bookedBadge);
                }

                if (isBusinessDay(date)) {
                    const availableCount = Math.max(TIME_SLOTS.length - bookings.length, 0);
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.textContent = availableCount > 0 ? `${availableCount} ledig` : 'Fullbokad';
                    badges.appendChild(badge);
                } else {
                    const badge = document.createElement('span');
                    badge.className = 'badge is-closed-label';
                    badge.textContent = 'St\u00e4ngt';
                    badges.appendChild(badge);
                }

                cell.appendChild(badges);
                fragment.appendChild(cell);
            });

            calendar.appendChild(fragment);
        }

        renderWeekView() {
            const calendar = this.elements.calendarView;
            calendar.className = 'calendar-view week-view';
            calendar.innerHTML = '';

            const start = startOfWeek(this.state.currentDate);
            const days = Array.from({ length: 7 }, (_, index) => addDays(start, index)).filter(isBusinessDay);

            const headerBlank = document.createElement('div');
            headerBlank.className = 'week-header';
            calendar.appendChild(headerBlank);

            days.forEach((date) => {
                const header = document.createElement('button');
                header.type = 'button';
                header.className = 'week-header';
                header.dataset.date = toDateKey(date);
                header.textContent = capitalise(formatDayLabel(date));
                header.addEventListener('click', () => this.selectDate(date));
                calendar.appendChild(header);
            });

            TIME_SLOTS.forEach((time) => {
                const label = document.createElement('div');
                label.className = 'time-label';
                label.textContent = time;
                calendar.appendChild(label);

                days.forEach((date) => {
                    const slot = this.createSlotControl(toDateKey(date), time, 'week');
                    calendar.appendChild(slot);
                });
            });
        }

        renderDayView() {
            const calendar = this.elements.calendarView;
            calendar.className = 'calendar-view day-view';
            calendar.innerHTML = '';

            const date = this.state.selectedDate;
            const bookings = this.store.findByDate(toDateKey(date));
            const available = Math.max(TIME_SLOTS.length - bookings.length, 0);

            const summary = document.createElement('div');
            summary.className = 'day-summary';
            summary.innerHTML = `<h3>${capitalise(formatFullDate(date))}</h3><span>${available} ledig${available === 1 ? '' : 'a'} tid${available === 1 ? '' : 'er'}</span>`;
            calendar.appendChild(summary);

            const timeline = document.createElement('div');
            timeline.className = 'slot-timeline';

            TIME_SLOTS.forEach((time) => {
                const slot = this.createSlotControl(toDateKey(date), time, 'timeline');
                timeline.appendChild(slot);
            });

            calendar.appendChild(timeline);
        }

        renderSlotPanel() {
            const date = this.state.selectedDate;
            this.elements.slotList.innerHTML = '';

            if (!isBusinessDay(date)) {
                this.elements.selectedDateLabel.textContent = capitalise(formatFullDate(date));
                const message = document.createElement('p');
                message.className = 'slot-closed-message';
                message.textContent = 'Bokningar g\u00f6rs endast m\u00e5ndag till fredag mellan 08:00 och 18:00.';
                this.elements.slotList.appendChild(message);
                return;
            }

            this.elements.selectedDateLabel.textContent = capitalise(formatFullDate(date));
            const dateKey = toDateKey(date);
            const fragment = document.createDocumentFragment();

            TIME_SLOTS.forEach((time) => {
                const button = this.createSlotControl(dateKey, time, 'list');
                fragment.appendChild(button);
            });

            this.elements.slotList.appendChild(fragment);
        }
        // Determine slot state to style availability and guard interactions
        createSlotControl(dateKey, time, variant) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.date = dateKey;
            button.dataset.time = time;

            const editing = this.state.bookingInEdit;
            const ignoreId = editing ? editing.id : null;
            const isBooked = this.store.isSlotBooked(dateKey, time, ignoreId);
            const isOwnSlot = editing && editing.date === dateKey && editing.time === time;
            const isPast = this.isSlotInPast(dateKey, time) && !isOwnSlot;
            const isSelected = this.state.pendingSlot && this.state.pendingSlot.dateKey === dateKey && this.state.pendingSlot.time === time;

            let statusText = 'Ledig';
            if (isBooked) {
                statusText = 'Bokad';
                button.disabled = true;
            }
            if (isPast) {
                statusText = 'Ej tillg\u00e4nglig';
                button.disabled = true;
                button.classList.add('is-past');
            }
            if (isSelected) {
                button.classList.add('is-selected');
            }
            if (isBooked) {
                button.classList.add('is-booked');
            }

            if (variant === 'list') {
                button.classList.add('slot-button');
                const timeLabel = document.createElement('span');
                timeLabel.textContent = time;
                const statusLabel = document.createElement('small');
                statusLabel.textContent = statusText;
                button.append(timeLabel, statusLabel);
            } else if (variant === 'week') {
                button.classList.add('week-slot');
                button.textContent = statusText;
            } else {
                button.classList.add('slot-button', 'timeline-slot');
                const timeLabel = document.createElement('span');
                timeLabel.textContent = time;
                const statusLabel = document.createElement('small');
                statusLabel.textContent = statusText;
                button.append(timeLabel, statusLabel);
            }

            button.setAttribute('aria-label', `${statusText} ${time} ${capitalise(formatFullDate(parseDateKey(dateKey)))}`);
            return button;
        }

        isSlotInPast(dateKey, time) {
            const slotDate = createDateTime(dateKey, time);
            const now = new Date();
            return slotDate.getTime() < now.getTime();
        }

        handleSlotSelection(slot) {
            if (!slot) {
                return;
            }
            const { dateKey, time } = slot;
            if (this.store.isSlotBooked(dateKey, time, this.state.bookingInEdit ? this.state.bookingInEdit.id : null)) {
                this.showToast('Den h\u00e4r tiden \u00e4r redan bokad.');
                return;
            }
            if (this.isSlotInPast(dateKey, time) && !(this.state.bookingInEdit && this.state.bookingInEdit.date === dateKey && this.state.bookingInEdit.time === time)) {
                this.showToast('Du kan inte boka en tid som redan passerat.');
                return;
            }
            this.state.selectedDate = parseDateKey(dateKey);
            this.state.pendingSlot = { dateKey, time };
            this.openModal();
            this.render();
        }

        openModal() {
            const slot = this.state.pendingSlot;
            if (!slot) {
                return;
            }
            const { dateKey, time } = slot;
            const date = parseDateKey(dateKey);
            this.elements.modalSlot.textContent = `${capitalise(formatFullDate(date))} \u22c5 ${time}`;

            this.elements.bookingForm.classList.remove('hidden');
            this.elements.modalSuccess.classList.add('hidden');

            const formControls = this.elements.bookingForm.elements;
            const nameField = formControls.namedItem('name');
            const emailField = formControls.namedItem('email');
            const phoneField = formControls.namedItem('phone');

            this.elements.bookingForm.reset();

            if (this.state.bookingInEdit && nameField && emailField && phoneField) {
                nameField.value = this.state.bookingInEdit.name;
                emailField.value = this.state.bookingInEdit.email;
                phoneField.value = this.state.bookingInEdit.phone;
            }

            this.elements.modal.classList.remove('hidden');
            this.elements.modalBackdrop.classList.remove('hidden');

            window.requestAnimationFrame(() => {
                if (nameField) {
                    nameField.focus({ preventScroll: true });
                }
            });
        }

        closeModal() {
            this.elements.modal.classList.add('hidden');
            this.elements.modalBackdrop.classList.add('hidden');
            this.elements.bookingForm.reset();
            this.elements.bookingForm.classList.remove('hidden');
            this.elements.modalSuccess.classList.add('hidden');
            this.state.pendingSlot = null;
            this.state.bookingInEdit = null;
            this.render();
        }

        // Collect customer details from the booking form
        submitBooking() {
            if (!this.state.pendingSlot) {
                this.showToast('V\u00e4lj en tid innan du bekr\u00e4ftar.');
                return;
            }

            const formData = new FormData(this.elements.bookingForm);
            const name = String(formData.get('name') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const phone = String(formData.get('phone') || '').trim();

            if (!name || !email || !phone) {
                this.showToast('Fyll i alla uppgifter innan du bekr\u00e4ftar.');
                return;
            }

            const { dateKey, time } = this.state.pendingSlot;
            const payload = { name, email, phone };

            if (this.state.bookingInEdit) {
                const booking = this.store.update(this.state.bookingInEdit.id, {
                    ...payload,
                    date: dateKey,
                    time
                });
                if (booking) {
                    this.showConfirmation(`${name}, din bokning \u00e4r uppdaterad.`);
                }
            } else {
                const booking = {
                    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    date: dateKey,
                    time,
                    ...payload,
                    createdAt: new Date().toISOString()
                };
                this.store.add(booking);
                this.showConfirmation(`${name}, din tid \u00e4r bokad.`);
            }

            this.render();
        }

        showConfirmation(message) {
            this.elements.bookingForm.classList.add('hidden');
            this.elements.modalSuccess.classList.remove('hidden');
            this.elements.successMessage.textContent = message;
            this.state.pendingSlot = null;
        }

        // Render booking cards with action buttons for edit and cancel
        renderBookings() {
            const bookings = this.store.getAll();
            this.elements.bookingCards.innerHTML = '';
            if (bookings.length === 0) {
                this.elements.bookingEmpty.classList.remove('hidden');
                return;
            }
            this.elements.bookingEmpty.classList.add('hidden');

            const fragment = document.createDocumentFragment();
            bookings.forEach((booking) => {
                const card = document.createElement('article');
                card.className = 'booking-card';
                card.dataset.id = booking.id;
                if (this.state.bookingInEdit && this.state.bookingInEdit.id === booking.id) {
                    card.classList.add('is-editing');
                }

                const header = document.createElement('header');
                const title = document.createElement('h3');
                title.textContent = capitalise(formatCardDate(parseDateKey(booking.date)));
                const time = document.createElement('span');
                time.textContent = booking.time;
                header.append(title, time);

                const meta = document.createElement('div');
                meta.className = 'meta';
                meta.innerHTML = `<span>${booking.name}</span><span>${booking.email}</span><span>${booking.phone}</span>`;

                const actions = document.createElement('div');
                actions.className = 'actions';

                const editButton = document.createElement('button');
                editButton.className = 'card-button primary';
                editButton.dataset.action = 'edit';
                editButton.dataset.id = booking.id;
                editButton.textContent = '\u00c4ndra';

                const cancelButton = document.createElement('button');
                cancelButton.className = 'card-button ghost';
                cancelButton.dataset.action = 'cancel';
                cancelButton.dataset.id = booking.id;
                cancelButton.textContent = 'Avboka';

                actions.append(editButton, cancelButton);
                card.append(header, meta, actions);
                fragment.appendChild(card);
            });

            this.elements.bookingCards.appendChild(fragment);
        }

        // Prefill modal state and switch to day view for easier rescheduling
        startEditBooking(id) {
            const booking = this.store.findById(id);
            if (!booking) {
                this.showToast('Kunde inte hitta bokningen.');
                return;
            }
            this.state.bookingInEdit = { ...booking };
            this.state.selectedDate = parseDateKey(booking.date);
            this.state.currentDate = this.state.selectedDate;
            this.state.pendingSlot = null;
            this.state.view = 'day';
            this.render();
            this.showToast('V\u00e4lj en ny tid f\u00f6r att uppdatera bokningen.');
        }

        cancelBooking(id) {
            const booking = this.store.findById(id);
            if (!booking) {
                return;
            }
            const confirmed = window.confirm('Vill du avboka den h\u00e4r tiden?');
            if (!confirmed) {
                return;
            }
            this.store.remove(id);
            if (this.state.bookingInEdit && this.state.bookingInEdit.id === id) {
                this.state.bookingInEdit = null;
            }
            this.showToast('Bokningen \u00e4r avbokad.');
            this.render();
        }

        showToast(message) {
            if (!this.elements.toast) {
                return;
            }
            this.elements.toast.textContent = message;
            this.elements.toast.classList.remove('hidden');
            this.elements.toast.classList.add('is-visible');
            if (this.toastTimer) {
                window.clearTimeout(this.toastTimer);
            }
            this.toastTimer = window.setTimeout(() => {
                this.elements.toast.classList.remove('is-visible');
                this.toastTimer = window.setTimeout(() => {
                    this.elements.toast.classList.add('hidden');
                }, 220);
            }, 2600);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        new CalendarApp();
    });
})();
