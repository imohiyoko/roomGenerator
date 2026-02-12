import React, { useRef } from 'react';
import { useNumberInputScroll } from '../hooks/useNumberInputScroll';

export const NumberInput = ({ value, onChange, ...props }) => {
    const ref = useRef(null);
    useNumberInputScroll(ref, onChange);

    return (
        <input
            ref={ref}
            type="number"
            value={value}
            onChange={onChange}
            {...props}
        />
    );
};
