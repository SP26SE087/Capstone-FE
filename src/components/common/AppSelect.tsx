import React from 'react';
import Select, { StylesConfig, GroupBase } from 'react-select';

export interface SelectOption {
    value: string | number;
    label: string;
}

interface AppSelectProps {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
    isClearable?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

const buildStyles = (size: 'sm' | 'md'): StylesConfig<SelectOption, false, GroupBase<SelectOption>> => {
    const isSm = size === 'sm';
    return {
        control: (base, state) => ({
            ...base,
            minHeight: isSm ? '32px' : '38px',
            borderRadius: isSm ? '8px' : '10px',
            border: state.isFocused
                ? '1.5px solid var(--accent-color, #e8720c)'
                : '1.5px solid #e2e8f0',
            boxShadow: state.isFocused
                ? '0 0 0 3px rgba(232, 114, 12, 0.10)'
                : 'none',
            background: state.isDisabled ? '#f8fafc' : '#fff',
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
            fontSize: isSm ? '0.82rem' : '0.875rem',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:hover': {
                borderColor: state.isFocused
                    ? 'var(--accent-color, #e8720c)'
                    : '#cbd5e1',
            },
        }),
        valueContainer: (base) => ({
            ...base,
            padding: isSm ? '0 8px' : '2px 10px',
        }),
        singleValue: (base) => ({
            ...base,
            color: '#1e293b',
            fontWeight: 500,
            fontSize: isSm ? '0.82rem' : '0.875rem',
        }),
        placeholder: (base) => ({
            ...base,
            color: '#94a3b8',
            fontSize: isSm ? '0.82rem' : '0.875rem',
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 9999,
            marginTop: '4px',
        }),
        menuList: (base) => ({
            ...base,
            padding: '4px',
            maxHeight: '108px',
        }),
        option: (base, state) => ({
            ...base,
            borderRadius: '6px',
            fontSize: isSm ? '0.82rem' : '0.875rem',
            fontWeight: state.isSelected ? 600 : 400,
            padding: isSm ? '6px 10px' : '8px 12px',
            backgroundColor: state.isSelected
                ? 'var(--accent-color, #e8720c)'
                : state.isFocused
                ? '#fff7ed'
                : 'transparent',
            color: state.isSelected ? '#fff' : '#1e293b',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: 'var(--accent-color, #e8720c)',
                color: '#fff',
            },
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base, state) => ({
            ...base,
            color: state.isFocused ? 'var(--accent-color, #e8720c)' : '#94a3b8',
            padding: isSm ? '0 6px' : '0 8px',
            transition: 'color 0.2s',
            '&:hover': { color: 'var(--accent-color, #e8720c)' },
        }),
        clearIndicator: (base) => ({
            ...base,
            padding: '0 6px',
            color: '#94a3b8',
            '&:hover': { color: '#ef4444' },
        }),
        loadingIndicator: (base) => ({
            ...base,
            color: 'var(--accent-color, #e8720c)',
        }),
    };
};

const AppSelect: React.FC<AppSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    isDisabled = false,
    isLoading = false,
    isClearable = false,
    size = 'md',
    className,
}) => {
    const selected = options.find(o => String(o.value) === String(value ?? '')) ?? null;

    return (
        <Select<SelectOption>
            value={selected}
            onChange={(opt) => onChange(opt ? String(opt.value) : '')}
            options={options}
            placeholder={placeholder}
            isDisabled={isDisabled}
            isLoading={isLoading}
            isClearable={isClearable}
            styles={buildStyles(size)}
            className={className}
            classNamePrefix="app-select"
            menuPortalTarget={document.body}
            menuPosition="fixed"
            noOptionsMessage={() => 'No options'}
        />
    );
};

export default AppSelect;
