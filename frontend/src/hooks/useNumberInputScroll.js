import { useEffect, useRef } from 'react';

export const useNumberInputScroll = (ref, onChange) => {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleWheel = (e) => {
            // Hover-based scroll behavior (like Blender/CAD)
            // Always prevent default page scroll when hovering
            e.preventDefault();

            // Calculate step
            let step = 10;
            if (e.shiftKey) step = 100;
            if (e.ctrlKey || e.metaKey) step = 1;

            // Direction
            const delta = e.deltaY < 0 ? 1 : -1;
            const change = delta * step;

            // Current value
            const currentVal = parseFloat(element.value) || 0;

            // Check limits if they exist
            const min = element.min !== '' ? parseFloat(element.min) : -Infinity;
            const max = element.max !== '' ? parseFloat(element.max) : Infinity;

            let newVal = currentVal + change;
            if (!isNaN(min)) newVal = Math.max(min, newVal);
            if (!isNaN(max)) newVal = Math.min(max, newVal);

            // Create synthetic event
            const syntheticEvent = {
                target: {
                    value: newVal,
                    name: element.name,
                    type: element.type,
                },
                preventDefault: () => {},
                stopPropagation: () => {}
            };

            if (onChangeRef.current) {
                onChangeRef.current(syntheticEvent);
            }
        };

        element.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, [ref]);
};
