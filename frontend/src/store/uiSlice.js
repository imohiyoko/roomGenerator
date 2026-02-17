export const createUISlice = (set, get) => {
    // Load initial state from localStorage if available
    const loadFromStorage = (key, defaultValue) => {
        const stored = localStorage.getItem(key);
        if (stored === null) return defaultValue;
        try {
            return JSON.parse(stored);
        } catch (e) {
            return defaultValue;
        }
    };

    return {
        leftSidebarWidth: loadFromStorage('ui_leftSidebarWidth', 256),
        rightSidebarWidth: loadFromStorage('ui_rightSidebarWidth', 288),
        leftSidebarCollapsed: loadFromStorage('ui_leftSidebarCollapsed', false),
        rightSidebarCollapsed: loadFromStorage('ui_rightSidebarCollapsed', false),

        setLeftSidebarWidth: (width) => {
            const clamped = Math.max(200, Math.min(600, width));
            localStorage.setItem('ui_leftSidebarWidth', JSON.stringify(clamped));
            set({ leftSidebarWidth: clamped });
        },
        setRightSidebarWidth: (width) => {
            const clamped = Math.max(200, Math.min(600, width));
            localStorage.setItem('ui_rightSidebarWidth', JSON.stringify(clamped));
            set({ rightSidebarWidth: clamped });
        },
        toggleLeftSidebar: () => set(state => {
            const newState = !state.leftSidebarCollapsed;
            localStorage.setItem('ui_leftSidebarCollapsed', JSON.stringify(newState));
            return { leftSidebarCollapsed: newState };
        }),
        toggleRightSidebar: () => set(state => {
            const newState = !state.rightSidebarCollapsed;
            localStorage.setItem('ui_rightSidebarCollapsed', JSON.stringify(newState));
            return { rightSidebarCollapsed: newState };
        }),
    };
};
