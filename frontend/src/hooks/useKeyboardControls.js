import { useEffect } from 'react';
import { useStore as useVanillaStore } from 'zustand';
import { useStore } from '../store';

export const useKeyboardControls = () => {
    const setViewState = useStore(state => state.setViewState);
    const { undo, redo } = useVanillaStore(useStore.temporal, (state) => state);

    useEffect(() => {
        const PAN_STEP = 50;
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // Undo/Redo Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }
             if ((e.ctrlKey || e.metaKey) && e.key === 'y') { // Windows Redo Standard
                e.preventDefault();
                redo();
                return;
            }

            let dx = 0, dy = 0;
            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup': dy = PAN_STEP; break;
                case 's': case 'arrowdown': dy = -PAN_STEP; break;
                case 'a': case 'arrowleft': dx = PAN_STEP; break;
                case 'd': case 'arrowright': dx = -PAN_STEP; break;
                default: return;
            }
            if (dx !== 0 || dy !== 0) {
                e.preventDefault();
                setViewState(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, setViewState]);
};
