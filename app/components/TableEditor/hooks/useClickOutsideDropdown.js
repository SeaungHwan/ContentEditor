"use client";
import { useState, useEffect } from 'react';

export function useClickOutsideDropdown() {
    const [activeDropdown, setActiveDropdown] = useState(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('[data-dropdown="true"]')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return [activeDropdown, setActiveDropdown];
}
