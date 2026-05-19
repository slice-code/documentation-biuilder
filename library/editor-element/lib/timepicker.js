// TimePicker Component - Input dengan dropdown untuk memilih waktu
const timepicker = async function(options = {}) {
    // el is passed from editor.js via options.el
    const el = options.el;
    if (!el) {
        throw new Error('timepicker: el is required in options');
    }
    
    // Konfigurasi default
    const config = {
        value: null,              // Waktu awal (Date object atau string "HH:MM")
        placeholder: 'Select time',
        format: '24',             // '12' | '24' - format tampilan
        theme: 'dark',            // dark | light
        disabled: false,          // Disable input
        minTime: null,            // Waktu minimum (string "HH:MM")
        maxTime: null,            // Waktu maksimum (string "HH:MM")
        step: 30,                 // Step menit (15, 30, 60)
        showClear: true,          // Tampilkan tombol clear
        showNow: true,            // Tampilkan tombol "Now"
        onChange: null,           // Callback saat waktu berubah: (timeString) => {}
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
            clearBtn: 'text-gray-400 hover:text-white hover:bg-gray-700',
            nowBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            timeText: 'text-white',
            periodBtn: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            periodBtnActive: 'bg-blue-600 text-white',
            hourBtn: 'text-gray-300 hover:bg-gray-700',
            hourBtnActive: 'bg-blue-600 text-white',
            minuteBtn: 'text-gray-300 hover:bg-gray-700',
            minuteBtnActive: 'bg-blue-600 text-white',
            separator: 'text-gray-400'
        },
        light: {
            input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
            inputHover: 'hover:border-gray-400',
            inputFocus: 'focus:border-blue-500 focus:ring-blue-500',
            dropdown: 'bg-white border-gray-200',
            icon: 'text-gray-500',
            clearBtn: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            nowBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
            timeText: 'text-gray-900',
            periodBtn: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            periodBtnActive: 'bg-blue-600 text-white',
            hourBtn: 'text-gray-700 hover:bg-gray-100',
            hourBtnActive: 'bg-blue-600 text-white',
            minuteBtn: 'text-gray-700 hover:bg-gray-100',
            minuteBtnActive: 'bg-blue-600 text-white',
            separator: 'text-gray-400'
        }
    };
    
    const currentTheme = themes[config.theme];
    
    // State
    let selectedHour = null;
    let selectedMinute = null;
    let selectedPeriod = 'AM'; // AM/PM for 12-hour format
    let isOpen = false;
    
    // Parse initial value
    const parseTime = (value) => {
        if (!value) return null;
        
        if (typeof value === 'string') {
            const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
            if (match) {
                let hour = parseInt(match[1], 10);
                const minute = parseInt(match[2], 10);
                const period = match[3] ? match[3].toUpperCase() : null;
                
                if (config.format === '12' && period) {
                    selectedPeriod = period;
                }
                
                return { hour, minute };
            }
        }
        
        if (value instanceof Date) {
            return {
                hour: value.getHours(),
                minute: value.getMinutes()
            };
        }
        
        return null;
    };
    
    // Initialize from config value
    const initialTime = parseTime(config.value);
    if (initialTime) {
        selectedHour = initialTime.hour;
        selectedMinute = initialTime.minute;
    }
    
    // Connectors
    const connector = {};
    
    // Format time for display
    const formatTime = () => {
        if (selectedHour === null || selectedMinute === null) return '';
        
        if (config.format === '12') {
            let hour = selectedHour;
            let period = 'AM';
            
            if (hour === 0) {
                hour = 12;
                period = 'AM';
            } else if (hour === 12) {
                period = 'PM';
            } else if (hour > 12) {
                hour -= 12;
                period = 'PM';
            } else {
                period = 'AM';
            }
            
            return `${String(hour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')} ${period}`;
        }
        
        return `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    };
    
    // Get time string in 24-hour format
    const getTimeString = () => {
        if (selectedHour === null || selectedMinute === null) return '';
        return `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    };
    
    // Toggle dropdown
    const toggleDropdown = () => {
        if (config.disabled) return;
        
        isOpen = !isOpen;
        const dropdownEl = connector.dropdown;
        
        if (dropdownEl) {
            dropdownEl.style.display = isOpen ? 'block' : 'none';
            
            if (isOpen) {
                positionDropdown();
                if (config.onOpen) config.onOpen();
            } else {
                if (config.onClose) config.onClose();
            }
        }
    };
    
    // Position dropdown
    const positionDropdown = () => {
        const inputEl = connector.input;
        const dropdownEl = connector.dropdown;
        
        if (!inputEl || !dropdownEl) return;
        
        const inputRect = inputEl.getBoundingClientRect();
        const dropdownWidth = 260;
        const dropdownHeight = 300;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        dropdownEl.style.left = 'auto';
        dropdownEl.style.right = 'auto';
        dropdownEl.style.top = 'auto';
        dropdownEl.style.bottom = 'auto';
        dropdownEl.style.marginTop = '0';
        dropdownEl.style.marginBottom = '0';
        dropdownEl.style.width = '100%';
        dropdownEl.style.minWidth = '220px';
        dropdownEl.style.maxWidth = '260px';
        
        if (inputRect.bottom + dropdownHeight > windowHeight) {
            dropdownEl.style.bottom = '100%';
            dropdownEl.style.marginBottom = '4px';
        } else {
            dropdownEl.style.top = '100%';
            dropdownEl.style.marginTop = '4px';
        }
        
        // Horizontal positioning - ensure it doesn't overflow container
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
    
    // Select hour
    const selectHour = (hour) => {
        selectedHour = hour;
        updateDisplay();
        renderTimeSelector();
        
        if (config.onChange) {
            config.onChange(getTimeString());
        }
    };
    
    // Select minute
    const selectMinute = (minute) => {
        selectedMinute = minute;
        updateDisplay();
        renderTimeSelector();
        
        if (config.onChange) {
            config.onChange(getTimeString());
        }
    };
    
    // Select period (AM/PM)
    const selectPeriod = (period) => {
        selectedPeriod = period;
        
        // Adjust hour based on period
        if (period === 'PM' && selectedHour !== null && selectedHour < 12) {
            selectedHour += 12;
        } else if (period === 'AM' && selectedHour !== null && selectedHour >= 12) {
            selectedHour -= 12;
        }
        
        updateDisplay();
        renderTimeSelector();
        
        if (config.onChange) {
            config.onChange(getTimeString());
        }
    };
    
    // Update display input
    const updateDisplay = () => {
        const inputEl = connector.displayInput;
        if (inputEl) {
            inputEl.value = formatTime();
        }
        
        // Update hour custom input if exists
        const hourInputEl = connector.hourInput;
        if (hourInputEl && selectedHour !== null) {
            const displayHour = config.format === '12' ? (selectedHour % 12 || 12) : selectedHour;
            hourInputEl.value = String(displayHour).padStart(2, '0');
        }
        
        // Update minute custom input if exists
        const minuteInputEl = connector.minuteInput;
        if (minuteInputEl && selectedMinute !== null) {
            minuteInputEl.value = String(selectedMinute).padStart(2, '0');
        }
    };
    
    // Clear time
    const clearTime = (e) => {
        e.stopPropagation();
        selectedHour = null;
        selectedMinute = null;
        selectedPeriod = 'AM';
        
        updateDisplay();
        renderTimeSelector();
        
        if (config.onChange) {
            config.onChange('');
        }
    };
    
    // Set to now
    const setNow = (e) => {
        e.stopPropagation();
        const now = new Date();
        selectedHour = now.getHours();
        selectedMinute = now.getMinutes();
        
        if (config.format === '12') {
            selectedPeriod = selectedHour >= 12 ? 'PM' : 'AM';
        }
        
        updateDisplay();
        renderTimeSelector();
        
        if (config.onChange) {
            config.onChange(getTimeString());
        }
    };
    
    // Close on outside click
    const handleOutsideClick = (e) => {
        const containerEl = connector.container;
        if (containerEl && !containerEl.contains(e.target)) {
            if (isOpen) {
                isOpen = false;
                const dropdownEl = connector.dropdown;
                if (dropdownEl) {
                    dropdownEl.style.display = 'none';
                }
                if (config.onClose) config.onClose();
            }
        }
    };
    
    // Render time selector
    const renderTimeSelector = () => {
        const timeSelectorEl = connector.timeSelector;
        if (!timeSelectorEl) return;
        
        timeSelectorEl.innerHTML = '';
        
        const container = el('div').class('p-3');
        
        // Time display
        const timeDisplay = el('div').class('flex items-center justify-center mb-4');
        
        // Hour display
        const hourDisplay = el('div')
            .class(`text-3xl font-bold cursor-pointer px-2 py-1 rounded ${currentTheme.timeText} hover:bg-gray-100`)
            .text(selectedHour !== null ? String(selectedHour).padStart(2, '0') : '--');
        timeDisplay.child(hourDisplay);
        
        // Separator
        const separator = el('div')
            .class(`text-3xl font-bold mx-1 ${currentTheme.separator}`)
            .text(':');
        timeDisplay.child(separator);
        
        // Minute display
        const minuteDisplay = el('div')
            .class(`text-3xl font-bold cursor-pointer px-2 py-1 rounded ${currentTheme.timeText} hover:bg-gray-100`)
            .text(selectedMinute !== null ? String(selectedMinute).padStart(2, '0') : '--');
        timeDisplay.child(minuteDisplay);
        
        // Period selector (for 12-hour format)
        if (config.format === '12') {
            const periodContainer = el('div').class('flex flex-col ml-2 gap-1');
            
            ['AM', 'PM'].forEach(period => {
                const isActive = selectedPeriod === period;
                const periodBtn = el('button')
                    .type('button')
                    .class(`px-2 py-1 text-xs font-semibold rounded cursor-pointer ${isActive ? currentTheme.periodBtnActive : currentTheme.periodBtn}`)
                    .text(period)
                    .click((e) => {
                        e.stopPropagation();
                        selectPeriod(period);
                    });
                periodContainer.child(periodBtn);
            });
            
            timeDisplay.child(periodContainer);
        }
        
        container.child(timeDisplay);
        
        // Hour selector
        const hourSection = el('div').class('mb-3');
        const hourLabel = el('div').class(`text-xs font-medium mb-2 ${currentTheme.separator}`).text('Hour');
        hourSection.child(hourLabel);
        
        // Custom hour input with grid
        const hourInputContainer = el('div').class('flex items-center gap-2 mb-2');
        
        const hourInput = el('input')
            .type('number')
            .attr('min', config.format === '12' ? '1' : '0')
            .attr('max', config.format === '12' ? '12' : '23')
            .attr('placeholder', config.format === '12' ? 'HH' : 'HH')
            .class(`w-20 px-2 py-1 text-sm border rounded ${currentTheme.input} ${currentTheme.inputFocus}`)
            .style('text-align', 'center')
            .link(connector, 'hourInput');
        
        if (selectedHour !== null) {
            const displayHour = config.format === '12' ? (selectedHour % 12 || 12) : selectedHour;
            hourInput.attr('value', String(displayHour).padStart(2, '0'));
        }
        
        const hourRangeText = config.format === '12' ? '(1-12)' : '(0-23)';
        const hourInputHint = el('span').class(`text-xs ${currentTheme.separator}`).text(hourRangeText);
        
        hourInputContainer.child([hourInput, hourInputHint]);
        
        // Handle hour input change
        hourInput.on('input', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) {
                value = 0;
            }
            
            // Convert 12-hour to 24-hour format for internal storage
            if (config.format === '12') {
                // Clamp between 1-12
                value = Math.max(1, Math.min(12, value));
                
                // Convert to 24-hour format
                if (selectedPeriod === 'PM' && value < 12) {
                    value += 12;
                } else if (selectedPeriod === 'AM' && value === 12) {
                    value = 0;
                }
            } else {
                // Clamp between 0-23
                value = Math.max(0, Math.min(23, value));
            }
            
            selectHour(value);
        });
        
        hourInputContainer.child(hourInput);
        container.child(hourInputContainer);
        
        const hourGrid = el('div').class('grid grid-cols-4 gap-1');
        const startHour = config.format === '12' ? 1 : 0;
        const endHour = config.format === '12' ? 12 : 23;
        
        for (let h = startHour; h <= endHour; h++) {
            const displayHour = h;
            const isActive = selectedHour === h;
            
            const hourBtn = el('button')
                .type('button')
                .class(`px-1 py-2 text-xs rounded cursor-pointer ${isActive ? currentTheme.hourBtnActive : currentTheme.hourBtn}`)
                .text(String(displayHour).padStart(2, '0'))
                .click((e) => {
                    e.stopPropagation();
                    selectHour(h);
                });
            hourGrid.child(hourBtn);
        }
        hourSection.child(hourGrid);
        container.child(hourSection);
        
        // Minute selector
        const minuteSection = el('div').class('mb-3');
        const minuteLabel = el('div').class(`text-xs font-medium mb-2 ${currentTheme.separator}`).text('Minute');
        minuteSection.child(minuteLabel);
        
        // Custom minute input with grid
        const minuteInputContainer = el('div').class('flex items-center gap-2 mb-2');
        
        const minuteInput = el('input')
            .type('number')
            .attr('min', '0')
            .attr('max', '59')
            .attr('placeholder', 'MM')
            .class(`w-20 px-2 py-1 text-sm border rounded ${currentTheme.input} ${currentTheme.inputFocus}`)
            .style('text-align', 'center')
            .link(connector, 'minuteInput');
        
        if (selectedMinute !== null) {
            minuteInput.attr('value', String(selectedMinute).padStart(2, '0'));
        }
        
        const minuteInputHint = el('span').class(`text-xs ${currentTheme.separator}`).text('(0-59)');
        
        minuteInputContainer.child([minuteInput, minuteInputHint]);
        
        // Handle minute input change
        minuteInput.on('input', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) {
                value = 0;
            }
            // Clamp between 0-59
            value = Math.max(0, Math.min(59, value));
            selectMinute(value);
        });
        
        minuteInputContainer.child(minuteInput);
        container.child(minuteInputContainer);
        
        const minuteGrid = el('div').class('grid grid-cols-4 gap-1');
        for (let m = 0; m < 60; m += config.step) {
            const isActive = selectedMinute === m;
            
            const minuteBtn = el('button')
                .type('button')
                .class(`px-1 py-2 text-xs rounded cursor-pointer ${isActive ? currentTheme.minuteBtnActive : currentTheme.minuteBtn}`)
                .text(String(m).padStart(2, '0'))
                .click((e) => {
                    e.stopPropagation();
                    selectMinute(m);
                });
            minuteGrid.child(minuteBtn);
        }
        minuteSection.child(minuteGrid);
        container.child(minuteSection);
        
        timeSelectorEl.appendChild(container.get());
    };
    
    // Render dropdown
    const renderDropdown = () => {
        const dropdown = el('div')
            .class(`absolute left-0 z-50 min-w-[260px] rounded-lg shadow-xl border ${currentTheme.dropdown}`)
            .style('display', 'none')
            .link(connector, 'dropdown');
        
        // Time selector container
        const timeSelectorContainer = el('div')
            .link(connector, 'timeSelector');
        dropdown.child(timeSelectorContainer);
        
        // Footer buttons
        if (config.showNow || config.showClear) {
            const footerBorder = config.theme === 'light' ? 'border-gray-200' : 'border-gray-700';
            const footer = el('div').class(`flex justify-between items-center p-3 border-t ${footerBorder}`);
            
            if (config.showNow) {
                footer.child(
                    el('button').type('button')
                        .class(`px-3 py-1 text-xs rounded cursor-pointer ${currentTheme.nowBtn}`)
                        .text('Now')
                        .click(setNow)
                );
            } else {
                footer.child(el('div'));
            }
            
            if (config.showClear) {
                footer.child(
                    el('button').type('button')
                        .class(`px-3 py-1 text-xs rounded cursor-pointer ${currentTheme.clearBtn}`)
                        .text('Clear')
                        .click(clearTime)
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
        .class(`relative flex items-center border rounded-lg px-3 py-2 ${currentTheme.input} ${currentTheme.inputHover} ${currentTheme.inputFocus} ${config.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`)
        .click(toggleDropdown)
        .link(connector, 'input');
    
    // Clock icon
    const icon = el('div').class(`mr-2 ${currentTheme.icon}`)
        .html('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>');
    
    // Display input (readonly)
    const displayInput = el('input')
        .attr('type', 'text')
        .attr('readonly', 'true')
        .attr('placeholder', config.placeholder)
        .class('bg-transparent outline-none flex-1 min-w-0 cursor-pointer')
        .link(connector, 'displayInput');
    
    if (selectedHour !== null && selectedMinute !== null) {
        displayInput.attr('value', formatTime());
    }
    
    // Clear button (optional)
    if (config.showClear && selectedHour !== null) {
        const clearBtn = el('div')
            .class(`ml-2 cursor-pointer ${currentTheme.clearBtn}`)
            .html('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>')
            .click(clearTime);
        inputWrapper.child([icon, displayInput, clearBtn]);
    } else {
        inputWrapper.child([icon, displayInput]);
    }
    
    // Build container
    container.child([inputWrapper, renderDropdown()]);
    
    // Render initial time selector
    renderTimeSelector();
    
    // Add outside click listener
    document.addEventListener('click', handleOutsideClick);
    
    // Public API
    const publicAPI = {
        getValue: () => getTimeString(),
        setValue: (timeString) => {
            const time = parseTime(timeString);
            if (time) {
                selectedHour = time.hour;
                selectedMinute = time.minute;
            } else {
                selectedHour = null;
                selectedMinute = null;
            }
            updateDisplay();
            renderTimeSelector();
        },
        getHour: () => selectedHour,
        getMinute: () => selectedMinute,
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
        clear: clearTime,
        destroy: () => {
            document.removeEventListener('click', handleOutsideClick);
        }
    };
    
    // Attach API
    container.get().timepicker = publicAPI;
    
    return container.get();
};

export { timepicker };
