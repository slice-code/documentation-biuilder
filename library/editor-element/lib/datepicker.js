// DatePicker Component - Input dengan dropdown calendar untuk memilih tanggal
const datepicker = async function(options = {}) {
    // el is passed from editor.js via options.el
    const el = options.el;
    if (!el) {
        throw new Error('datepicker: el is required in options');
    }
    
    // Konfigurasi default
    const config = {
        mode: 'single',           // 'single' | 'range' - single date atau date range
        value: null,              // Tanggal awal (Date object atau string)
        startDate: null,          // Untuk mode range: tanggal mulai
        endDate: null,            // Untuk mode range: tanggal selesai
        placeholder: 'Select date', // Placeholder text
        rangeSeparator: ' - ',    // Separator untuk range display
        format: 'DD/MM/YYYY',     // Format tampilan: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
        locale: 'en-US',          // Locale untuk nama bulan/hari
        theme: 'dark',            // dark | light
        disabled: false,          // Disable input
        minDate: null,            // Tanggal minimum yang bisa dipilih
        maxDate: null,            // Tanggal maksimum yang bisa dipilih
        showClear: true,          // Tampilkan tombol clear
        showToday: true,          // Tampilkan tombol "Today"
        onChange: null,           // Callback saat tanggal berubah: (date) => {} atau ({start, end}) => {}
        onOpen: null,             // Callback saat dropdown terbuka
        onClose: null,            // Callback saat dropdown tertutup
        ...options
    };
    
    // Theme styles
    const themes = {
        dark: {
            input: 'bg-gray-800 border-gray-600 text-white placeholder-gray-400',
            inputHover: 'hover:border-gray-500',
            inputFocus: 'focus:border-blue-500 focus:ring-blue-500',
            dropdown: 'bg-gray-800 border-gray-600',
            icon: 'text-gray-400',
            clearBtn: 'text-gray-400 hover:text-white',
            todayBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            // Calendar elements
            headerText: 'text-white',
            headerBtn: 'hover:bg-gray-700 text-gray-300',
            weekdayText: 'text-gray-400',
            dayText: 'text-gray-300 hover:bg-gray-700',
            dayToday: 'bg-gray-700 text-white hover:bg-gray-600',
            daySelected: 'bg-blue-600 text-white hover:bg-blue-700',
            dayMuted: 'text-gray-500 hover:bg-gray-700',
            dayDisabled: 'text-gray-600 cursor-not-allowed',
            // Year/Month selector
            selectorTitle: 'text-gray-400',
            selectorBtn: 'text-gray-300 hover:bg-gray-700',
            selectorBtnActive: 'bg-blue-600 text-white',
            selectorBack: 'text-gray-400 hover:text-white'
        },
        light: {
            input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
            inputHover: 'hover:border-gray-400',
            inputFocus: 'focus:border-blue-500 focus:ring-blue-500',
            dropdown: 'bg-white border-gray-200',
            icon: 'text-gray-500',
            clearBtn: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            todayBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            // Calendar elements
            headerText: 'text-gray-900',
            headerBtn: 'hover:bg-gray-100 text-gray-600',
            weekdayText: 'text-gray-500',
            dayText: 'text-gray-700 hover:bg-gray-100',
            dayToday: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
            daySelected: 'bg-blue-600 text-white hover:bg-blue-700',
            dayMuted: 'text-gray-400 hover:bg-gray-100',
            dayDisabled: 'text-gray-300 cursor-not-allowed',
            // Year/Month selector
            selectorTitle: 'text-gray-500',
            selectorBtn: 'text-gray-700 hover:bg-gray-100',
            selectorBtnActive: 'bg-blue-600 text-white',
            selectorBack: 'text-gray-500 hover:text-gray-700'
        }
    };
    
    const currentTheme = themes[config.theme];
    
    // State
    const isRangeMode = config.mode === 'range';
    let selectedDate = config.value ? new Date(config.value) : null;
    let startDate = config.startDate ? new Date(config.startDate) : null;
    let endDate = config.endDate ? new Date(config.endDate) : null;
    let currentMonth = selectedDate || startDate || new Date();
    let isOpen = false;
    let hoverDate = null; // For range preview
    let selectorView = null; // null | 'year' | 'month' - step-by-step selection
    
    // Connectors
    const connector = {};
    const selectorConnector = {};
    
    // Helper: Parse date dari berbagai format
    const parseDate = (input) => {
        if (!input) return null;
        if (input instanceof Date) return input;
        if (typeof input === 'string') {
            const date = new Date(input);
            return isNaN(date.getTime()) ? null : date;
        }
        return null;
    };
    
    // Helper: Format date ke string
    const formatDate = (date) => {
        if (!date) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        switch (config.format) {
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'DD/MM/YYYY':
            default:
                return `${day}/${month}/${year}`;
        }
    };
    
    // Helper: Cek apakah tanggal sama
    const isSameDay = (date1, date2) => {
        if (!date1 || !date2) return false;
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    };
    
    // Helper: Cek apakah tanggal adalah hari ini
    const isToday = (date) => isSameDay(date, new Date());
    
    // Helper: Cek apakah tanggal dipilih
    const isSelected = (date) => {
        if (isRangeMode) {
            return isSameDay(date, startDate) || isSameDay(date, endDate);
        }
        return isSameDay(date, selectedDate);
    };
    
    // Helper: Cek apakah tanggal dalam range (untuk mode range)
    const isInRange = (date) => {
        if (!isRangeMode || !startDate || !endDate) return false;
        return date > startDate && date < endDate;
    };
    
    // Helper: Cek apakah tanggal dalam hover preview range
    const isInHoverRange = (date) => {
        if (!isRangeMode || !startDate || endDate || !hoverDate) return false;
        const minDate = hoverDate < startDate ? hoverDate : startDate;
        const maxDate = hoverDate < startDate ? startDate : hoverDate;
        return date > minDate && date < maxDate;
    };
    
    // Helper: Cek apakah tanggal adalah start date
    const isStartDate = (date) => isRangeMode && isSameDay(date, startDate);
    
    // Helper: Cek apakah tanggal adalah end date
    const isEndDate = (date) => isRangeMode && isSameDay(date, endDate);
    
    // Helper: Cek apakah tanggal disabled
    const isDisabled = (date) => {
        if (config.minDate) {
            const minDate = parseDate(config.minDate);
            if (minDate && date < minDate) return true;
        }
        if (config.maxDate) {
            const maxDate = parseDate(config.maxDate);
            if (maxDate && date > maxDate) return true;
        }
        return false;
    };
    
    // Helper: Dapatkan jumlah hari dalam bulan
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };
    
    // Helper: Dapatkan hari pertama dalam bulan
    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };
    
    // Toggle dropdown
    const toggleDropdown = () => {
        if (config.disabled) return;
        
        isOpen = !isOpen;
        const dropdownEl = connector.dropdown;
        
        if (dropdownEl) {
            dropdownEl.style.display = isOpen ? 'block' : 'none';
            
            if (isOpen) {
                // Position dropdown
                positionDropdown();
                if (config.onOpen) config.onOpen();
            } else {
                // Reset selector when closing
                selectorView = null;
                if (config.onClose) config.onClose();
            }
        }
    };
    
    // Position dropdown relative to input
    const positionDropdown = () => {
        const inputEl = connector.input;
        const dropdownEl = connector.dropdown;
        
        if (!inputEl || !dropdownEl) return;
        
        const inputRect = inputEl.getBoundingClientRect();
        const dropdownWidth = 280; // Min width
        const dropdownHeight = 320; // Approximate height
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // Reset positioning
        dropdownEl.style.left = 'auto';
        dropdownEl.style.right = 'auto';
        dropdownEl.style.top = 'auto';
        dropdownEl.style.bottom = 'auto';
        dropdownEl.style.marginTop = '0';
        dropdownEl.style.marginBottom = '0';
        dropdownEl.style.width = '100%';
        dropdownEl.style.minWidth = '240px';
        dropdownEl.style.maxWidth = '280px';
        
        // Vertical positioning - check if there's room below
        if (inputRect.bottom + dropdownHeight > windowHeight) {
            // Show above
            dropdownEl.style.bottom = '100%';
            dropdownEl.style.marginBottom = '4px';
        } else {
            // Show below
            dropdownEl.style.top = '100%';
            dropdownEl.style.marginTop = '4px';
        }
        
        // Horizontal positioning - ensure it doesn't overflow container
        const parentRect = inputEl.parentElement.getBoundingClientRect();
        const spaceRight = windowWidth - inputRect.left;
        const spaceLeft = inputRect.right;
        
        if (spaceRight < dropdownWidth && spaceLeft >= dropdownWidth) {
            // Not enough space on right, show to the left
            dropdownEl.style.right = '0';
            dropdownEl.style.left = 'auto';
        } else {
            // Show to the right (left-aligned)
            dropdownEl.style.left = '0';
            dropdownEl.style.right = 'auto';
        }
    };
    
    // Select date
    const selectDate = (date, e) => {
        if (e) {
            e.stopPropagation(); // Prevent triggering outside click handler
        }
        
        if (isRangeMode) {
            // Range mode logic
            if (!startDate || (startDate && endDate)) {
                // Start new selection
                startDate = new Date(date);
                endDate = null;
                
                // Update input display
                const inputEl = connector.displayInput;
                if (inputEl) {
                    inputEl.value = formatDate(startDate) + config.rangeSeparator;
                }
            } else {
                // Complete selection
                const selectedDate = new Date(date);
                if (selectedDate < startDate) {
                    // Swap if selected is before start
                    endDate = startDate;
                    startDate = selectedDate;
                } else {
                    endDate = selectedDate;
                }
                
                // Update input display
                const inputEl = connector.displayInput;
                if (inputEl) {
                    inputEl.value = formatDate(startDate) + config.rangeSeparator + formatDate(endDate);
                }
                
                // Close dropdown after complete selection
                toggleDropdown();
                
                // Callback with range
                if (config.onChange) {
                    config.onChange({ start: startDate, end: endDate });
                }
            }
        } else {
            // Single mode logic
            selectedDate = new Date(date);
            
            // Update input display
            const inputEl = connector.displayInput;
            if (inputEl) {
                inputEl.value = formatDate(selectedDate);
            }
            
            // Close dropdown
            toggleDropdown();
            
            // Callback
            if (config.onChange) {
                config.onChange(selectedDate);
            }
        }
        
        // Re-render calendar
        renderCalendar();
    };
    
    // Clear date
    const clearDate = (e) => {
        e.stopPropagation();
        selectedDate = null;
        startDate = null;
        endDate = null;
        hoverDate = null;
        
        const inputEl = connector.displayInput;
        if (inputEl) {
            inputEl.value = '';
        }
        
        if (config.onChange) {
            config.onChange(isRangeMode ? { start: null, end: null } : null);
        }
        
        renderCalendar();
    };
    
    // Go to today
    const gotoToday = (e) => {
        e.stopPropagation();
        currentMonth = new Date();
        selectedDate = new Date();
        
        const inputEl = connector.displayInput;
        if (inputEl) {
            inputEl.value = formatDate(selectedDate);
        }
        
        if (config.onChange) {
            config.onChange(selectedDate);
        }
        
        renderCalendar();
    };
    
    // Navigate month
    const navigateMonth = (e, direction) => {
        if (e) {
            e.stopPropagation(); // Prevent triggering outside click handler
            e.preventDefault();
        }
        currentMonth.setMonth(currentMonth.getMonth() + direction);
        renderCalendar();
    };
    
    // Close on outside click
    const handleOutsideClick = (e) => {
        const containerEl = connector.container;
        if (containerEl && !containerEl.contains(e.target)) {
            if (isOpen) {
                isOpen = false;
                selectorView = null;
                const dropdownEl = connector.dropdown;
                if (dropdownEl) {
                    dropdownEl.style.display = 'none';
                }
                if (config.onClose) config.onClose();
            }
        }
    };
    
    // Toggle year selector (step 1)
    const toggleYearSelector = (e) => {
        if (e) {
            e.stopPropagation();
        }
        // Toggle: if already showing year, close; otherwise show year
        selectorView = selectorView === 'year' ? null : 'year';
        renderCalendar();
    };
    
    // Select year (step 2) - after selecting year, show month selector
    const selectYear = (e, year) => {
        e.stopPropagation();
        currentMonth.setFullYear(year);
        selectorView = 'month'; // Move to month selection
        renderCalendar();
    };
    
    // Select month (step 3) - after selecting month, show calendar days
    const selectMonth = (e, month) => {
        e.stopPropagation();
        currentMonth.setMonth(month);
        selectorView = null; // Close selector, show calendar
        renderCalendar();
    };
    
    // Render year selector
    const renderYearSelector = () => {
        const currentYear = currentMonth.getFullYear();
        
        // Generate years (current year ± 10)
        const years = [];
        for (let y = currentYear - 10; y <= currentYear + 10; y++) {
            years.push(y);
        }
        
        const container = el('div').class('p-3');
        
        // Title
        const title = el('div').class(`text-center text-sm mb-3 ${currentTheme.selectorTitle}`)
            .text('Select Year');
        container.child(title);
        
        // Year grid
        const yearGrid = el('div').class('grid grid-cols-5 gap-1 max-h-48 overflow-y-auto');
        years.forEach(year => {
            const isSelected = year === currentYear;
            const yearEl = el('button').type('button')
                .class(`px-2 py-2 text-sm rounded cursor-pointer ${isSelected ? currentTheme.selectorBtnActive : currentTheme.selectorBtn}`)
                .text(String(year))
                .click((e) => selectYear(e, year));
            yearGrid.child(yearEl);
        });
        
        container.child(yearGrid);
        return container;
    };
    
    // Render month selector
    const renderMonthSelector = () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIndex = currentMonth.getMonth();
        const currentYear = currentMonth.getFullYear();
        
        const container = el('div').class('p-3');
        
        // Title with back button
        const header = el('div').class('flex items-center justify-between mb-3')
            .child([
                el('button').type('button')
                    .class(`cursor-pointer text-xs ${currentTheme.selectorBack}`)
                    .text('‹ Back to years')
                    .click((e) => {
                        e.stopPropagation();
                        selectorView = 'year';
                        renderCalendar();
                    }),
                el('div').class(`text-sm ${currentTheme.selectorTitle}`)
                    .text(currentYear)
            ]);
        container.child(header);
        
        // Month grid
        const monthGrid = el('div').class('grid grid-cols-4 gap-2');
        months.forEach((month, index) => {
            const isSelected = index === currentMonthIndex;
            const monthEl = el('button').type('button')
                .class(`px-3 py-2 text-sm rounded cursor-pointer ${isSelected ? currentTheme.selectorBtnActive : currentTheme.selectorBtn}`)
                .text(month)
                .click((e) => selectMonth(e, index));
            monthGrid.child(monthEl);
        });
        
        container.child(monthGrid);
        return container;
    };
    
    // Navigate year (for year selector view)
    const navigateYear = (e, direction) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        currentMonth.setFullYear(currentMonth.getFullYear() + direction);
        renderCalendar();
    };
    
    // Render calendar header
    const renderHeader = () => {
        const monthYearText = currentMonth.toLocaleDateString(config.locale, {
            month: 'long',
            year: 'numeric'
        });
        
        const yearText = String(currentMonth.getFullYear());
        
        // Determine header content based on selectorView
        let centerText, centerClick, prevClick, nextClick;
        
        if (selectorView === 'year') {
            // Year selector mode - navigate years
            centerText = yearText;
            centerClick = (e) => { e.stopPropagation(); }; // Do nothing on click
            prevClick = (e) => navigateYear(e, -1);
            nextClick = (e) => navigateYear(e, 1);
        } else if (selectorView === 'month') {
            // Month selector mode - show year, click to go back to year selector
            centerText = yearText;
            centerClick = (e) => toggleYearSelector(e);
            prevClick = null;
            nextClick = null;
        } else {
            // Calendar days mode - navigate months
            centerText = monthYearText;
            centerClick = (e) => toggleYearSelector(e);
            prevClick = (e) => navigateMonth(e, -1);
            nextClick = (e) => navigateMonth(e, 1);
        }
        
        const header = el('div').class('flex justify-between items-center mb-3');
        const children = [];
        
        // Prev button (only show if has navigation)
        if (prevClick) {
            children.push(
                el('button').type('button')
                    .class(`w-8 h-8 flex items-center justify-center rounded cursor-pointer ${currentTheme.headerBtn}`)
                    .text('‹')
                    .click(prevClick)
            );
        } else {
            children.push(el('div').class('w-8'));
        }
        
        // Center button
        children.push(
            el('button').type('button')
                .class(`text-sm font-semibold px-2 py-1 rounded cursor-pointer ${currentTheme.headerText} ${currentTheme.headerBtn}`)
                .text(centerText)
                .click(centerClick)
        );
        
        // Next button (only show if has navigation)
        if (nextClick) {
            children.push(
                el('button').type('button')
                    .class(`w-8 h-8 flex items-center justify-center rounded cursor-pointer ${currentTheme.headerBtn}`)
                    .text('›')
                    .click(nextClick)
            );
        } else {
            children.push(el('div').class('w-8'));
        }
        
        header.child(children);
        return header;
    };
    
    // Render weekdays header
    const renderWeekdays = () => {
        const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const container = el('div').class('grid grid-cols-7 gap-1 mb-2');
        
        weekdays.forEach(day => {
            container.child(
                el('div').class(`h-6 flex items-center justify-center text-xs font-medium ${currentTheme.weekdayText}`)
                    .text(day)
            );
        });
        
        return container;
    };
    
    // Render calendar days
    const renderDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        // Previous month info
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
        
        // Next month info
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        
        const container = el('div').class('grid grid-cols-7 gap-1');
        
        // Previous month days (before first day of current month)
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const date = new Date(prevYear, prevMonth, day);
            const disabled = isDisabled(date);
            const selected = isSelected(date);
            
            let cellClass = `h-8 flex items-center justify-center text-sm cursor-pointer transition-colors ${currentTheme.dayMuted} `;
            if (selected) {
                cellClass += currentTheme.daySelected;
            }
            if (disabled) {
                cellClass += 'opacity-50 cursor-not-allowed';
            }
            
            const dayEl = el('div').class(cellClass).text(String(day));
            
            if (!disabled) {
                dayEl.click((e) => {
                    e.stopPropagation();
                    currentMonth = new Date(prevYear, prevMonth, 1);
                    selectDate(date, e);
                });
            }
            
            container.child(dayEl);
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const disabled = isDisabled(date);
            const selected = isSelected(date);
            const today = isToday(date);
            const inRange = isInRange(date);
            const inHoverRange = isInHoverRange(date);
            const isStart = isStartDate(date);
            const isEnd = isEndDate(date);
            
            let cellClass = 'h-8 flex items-center justify-center text-sm cursor-pointer transition-colors ';
            
            if (disabled) {
                cellClass += currentTheme.dayDisabled;
            } else if (isStart || isEnd) {
                // Start or end date - highlight with rounded corners
                cellClass += currentTheme.daySelected;
                if (isStart && endDate) {
                    cellClass = cellClass.replace('rounded', 'rounded-l');
                } else if (isEnd && startDate) {
                    cellClass = cellClass.replace('rounded', 'rounded-r');
                }
            } else if (inRange) {
                // In range - no rounded corners, different background
                cellClass += 'bg-blue-100 text-blue-800 rounded-none';
            } else if (inHoverRange) {
                // Hover preview range
                cellClass += 'bg-blue-50 text-blue-700 rounded-none';
            } else if (selected) {
                cellClass += currentTheme.daySelected;
            } else if (today) {
                cellClass += currentTheme.dayToday;
            } else {
                cellClass += currentTheme.dayText;
            }
            
            const dayEl = el('div').class(cellClass).text(String(day));
            
            if (!disabled) {
                dayEl.click((e) => selectDate(date, e));
                
                // Add hover event for range preview
                if (isRangeMode && startDate && !endDate) {
                    const dayDate = date;
                    dayEl.get().addEventListener('mouseenter', () => {
                        hoverDate = dayDate;
                        renderCalendar();
                    });
                    dayEl.get().addEventListener('mouseleave', () => {
                        hoverDate = null;
                        renderCalendar();
                    });
                }
            }
            
            container.child(dayEl);
        }
        
        // Next month days (fill remaining cells to complete the grid)
        const totalCells = firstDay + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(nextYear, nextMonth, day);
            const disabled = isDisabled(date);
            const selected = isSelected(date);
            
            let cellClass = `h-8 flex items-center justify-center text-sm cursor-pointer transition-colors ${currentTheme.dayMuted} `;
            if (selected) {
                cellClass += currentTheme.daySelected;
            }
            if (disabled) {
                cellClass += 'opacity-50 cursor-not-allowed';
            }
            
            const dayEl = el('div').class(cellClass).text(String(day));
            
            if (!disabled) {
                dayEl.click((e) => {
                    e.stopPropagation();
                    currentMonth = new Date(nextYear, nextMonth, 1);
                    selectDate(date, e);
                });
            }
            
            container.child(dayEl);
        }
        
        return container;
    };
    
    // Render calendar
    const renderCalendar = () => {
        const calendarEl = connector.calendar;
        if (!calendarEl) return;
        
        calendarEl.innerHTML = '';
        
        const calendar = el('div').class('p-3');
        
        // Always show header
        calendar.child(renderHeader());
        
        // Show selector or calendar days based on selectorView state
        if (selectorView === 'year') {
            calendar.child(renderYearSelector());
        } else if (selectorView === 'month') {
            calendar.child(renderMonthSelector());
        } else {
            calendar.child([
                renderWeekdays(),
                renderDays()
            ]);
        }
        
        calendarEl.appendChild(calendar.get());
    };
    
    // Render dropdown
    const renderDropdown = () => {
        const dropdown = el('div')
            .class(`absolute left-0 z-50 min-w-[280px] rounded-lg shadow-xl border ${currentTheme.dropdown}`)
            .style('display', 'none')
            .link(connector, 'dropdown');
        
        // Calendar container
        const calendarContainer = el('div')
            .link(connector, 'calendar');
        
        dropdown.child(calendarContainer);
        
        // Footer buttons
        if (config.showToday || config.showClear) {
            const footerBorder = config.theme === 'light' ? 'border-gray-200' : 'border-gray-700';
            const footer = el('div').class(`flex justify-between items-center p-3 border-t ${footerBorder}`);
            
            if (config.showToday) {
                footer.child(
                    el('button').type('button')
                        .class(`px-3 py-1 text-xs rounded cursor-pointer ${currentTheme.todayBtn}`)
                        .text('Today')
                        .click(gotoToday)
                );
            } else {
                footer.child(el('div'));
            }
            
            if (config.showClear) {
                footer.child(
                    el('button').type('button')
                        .class(`px-3 py-1 text-xs rounded cursor-pointer ${currentTheme.clearBtn}`)
                        .text('Clear')
                        .click(clearDate)
                );
            }
            
            dropdown.child(footer);
        }
        
        return dropdown;
    };
    
    // Build component
    const container = el('div')
        .class('relative w-full')
        .link(connector, 'container');
    
    // Input field
    const inputWrapper = el('div')
        .class(`relative flex w-full items-center border rounded-lg px-3 py-2 ${currentTheme.input} ${currentTheme.inputHover} ${currentTheme.inputFocus} ${config.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`)
        .click(toggleDropdown)
        .link(connector, 'input');
    
    // Calendar icon
    const icon = el('div').class(`mr-2 ${currentTheme.icon}`)
        .html('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>');
    
    // Display input (readonly)
    const displayInput = el('input')
        .attr('type', 'text')
        .attr('readonly', 'true')
        .attr('placeholder', config.placeholder)
        .class('bg-transparent outline-none flex-1 min-w-0 cursor-pointer')
        .link(connector, 'displayInput');
    
    if (selectedDate) {
        displayInput.attr('value', formatDate(selectedDate));
    }
    
    // Clear button (optional)
    if (config.showClear && selectedDate) {
        const clearBtn = el('div')
            .class(`ml-2 cursor-pointer ${currentTheme.clearBtn}`)
            .html('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>')
            .click(clearDate);
        inputWrapper.child([icon, displayInput, clearBtn]);
    } else {
        inputWrapper.child([icon, displayInput]);
    }
    
    // Build container
    container.child([inputWrapper, renderDropdown()]);
    
    // Render initial calendar
    renderCalendar();
    
    // Add outside click listener
    document.addEventListener('click', handleOutsideClick);
    
    // Public API
    const publicAPI = {
        getValue: () => isRangeMode ? { start: startDate, end: endDate } : selectedDate,
        setValue: (dateOrRange) => {
            if (isRangeMode) {
                if (dateOrRange && dateOrRange.start) {
                    startDate = new Date(dateOrRange.start);
                    endDate = dateOrRange.end ? new Date(dateOrRange.end) : null;
                    currentMonth = new Date(startDate);
                } else {
                    startDate = null;
                    endDate = null;
                    currentMonth = new Date();
                }
                
                const inputEl = connector.displayInput;
                if (inputEl) {
                    if (startDate) {
                        inputEl.value = formatDate(startDate) + (endDate ? config.rangeSeparator + formatDate(endDate) : '');
                    } else {
                        inputEl.value = '';
                    }
                }
            } else {
                selectedDate = dateOrRange ? new Date(dateOrRange) : null;
                currentMonth = selectedDate ? new Date(selectedDate) : new Date();
                
                const inputEl = connector.displayInput;
                if (inputEl) {
                    inputEl.value = selectedDate ? formatDate(selectedDate) : '';
                }
            }
            
            renderCalendar();
        },
        getStartDate: () => startDate,
        getEndDate: () => endDate,
        open: () => {
            if (!isOpen && !config.disabled) {
                toggleDropdown();
            }
        },
        close: () => {
            if (isOpen) {
                toggleDropdown();
            }
        },
        clear: clearDate,
        destroy: () => {
            document.removeEventListener('click', handleOutsideClick);
        }
    };
    
    // Attach API
    container.get().datepicker = publicAPI;
    
    return container.get();
};

export { datepicker };
