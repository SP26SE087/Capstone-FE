import React from 'react';
import Select, { StylesConfig, GroupBase } from 'react-select';

export interface SelectOption {
    value: string | number;
    label: string;
}

type AppSelectVariant = 'default' | 'scheduleFilter';

interface AppSelectProps {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
    isClearable?: boolean;
    isSearchable?: boolean;
    size?: 'sm' | 'md';
    variant?: AppSelectVariant;
    className?: string;
}

const buildStyles = (size: 'sm' | 'md', variant: AppSelectVariant): StylesConfig<SelectOption, false, GroupBase<SelectOption>> => {
    const isSm = size === 'sm';
    const isScheduleFilter = variant === 'scheduleFilter';
    return {
        control: (base, state) => ({
            ...base,
            minHeight: isSm ? '32px' : '38px',
            borderRadius: isSm ? '8px' : '10px',
            border: state.isFocused
                ? (isScheduleFilter ? '1.5px solid #94a3b8' : '1.5px solid var(--accent-color, #e8720c)')
                : (isScheduleFilter && state.hasValue ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0'),
            boxShadow: state.isFocused
                ? (isScheduleFilter ? '0 0 0 3px rgba(148, 163, 184, 0.16)' : '0 0 0 3px rgba(232, 114, 12, 0.10)')
                : (isScheduleFilter && state.hasValue ? '0 1px 0 rgba(148, 163, 184, 0.08)' : 'none'),
            background: state.isDisabled ? '#f8fafc' : (isScheduleFilter && state.hasValue ? '#f8fafc' : '#fff'),
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
            fontSize: isSm ? '0.82rem' : '0.875rem',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            '&:hover': {
                borderColor: state.isFocused
                    ? (isScheduleFilter ? '#94a3b8' : 'var(--accent-color, #e8720c)')
                    : (isScheduleFilter && state.hasValue ? '#b8c4d5' : '#cbd5e1'),
            },
        }),
        valueContainer: (base) => ({
            ...base,
            padding: isSm ? '0 8px' : '2px 10px',
        }),
        singleValue: (base) => ({
            ...base,
            color: isScheduleFilter ? '#475569' : '#1e293b',
            fontWeight: isScheduleFilter ? 600 : 500,
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
            boxShadow: isScheduleFilter
                ? '0 10px 24px rgba(15, 23, 42, 0.08)'
                : '0 8px 28px rgba(0,0,0,0.12)',
            background: '#fff',
            overflow: 'hidden',
            zIndex: 9999,
            marginTop: '4px',
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '320px',
        }),
        menuList: (base) => ({
            ...base,
            padding: isScheduleFilter ? '6px' : '4px',
            maxHeight: '240px',
        }),
        option: (base, state) => ({
            ...base,
            borderRadius: isScheduleFilter ? '8px' : '6px',
            fontSize: isSm ? '0.82rem' : '0.875rem',
            fontWeight: state.isSelected ? 600 : (isScheduleFilter ? 500 : 400),
            padding: isSm ? (isScheduleFilter ? '7px 10px' : '6px 10px') : (isScheduleFilter ? '8px 11px' : '8px 12px'),
            marginBottom: isScheduleFilter ? '3px' : 0,
            whiteSpace: 'nowrap',
            backgroundColor: isScheduleFilter
                ? (state.isSelected
                    ? 'var(--accent-bg, rgba(232, 114, 12, 0.08))'
                    : state.isFocused
                    ? 'rgba(232, 114, 12, 0.05)'
                    : 'transparent')
                : (state.isSelected
                    ? 'var(--accent-color, #e8720c)'
                    : state.isFocused
                    ? '#fff7ed'
                    : 'transparent'),
            color: isScheduleFilter
                ? (state.isSelected ? 'var(--accent-color, #e8720c)' : '#334155')
                : (state.isSelected ? '#fff' : '#1e293b'),
            border: isScheduleFilter
                ? (state.isSelected
                    ? '1px solid rgba(232, 114, 12, 0.30)'
                    : state.isFocused
                    ? '1px solid #e2e8f0'
                    : '1px solid transparent')
                : '1px solid transparent',
            boxShadow: 'none',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: isScheduleFilter ? 'var(--accent-bg-hover, rgba(232, 114, 12, 0.14))' : 'var(--accent-color, #e8720c)',
                color: isScheduleFilter ? 'var(--accent-color, #e8720c)' : '#fff',
            },
        }),
        noOptionsMessage: (base) => ({
            ...base,
            fontSize: isSm ? '0.78rem' : '0.82rem',
            fontWeight: 600,
            color: '#94a3b8',
            padding: isScheduleFilter ? '8px 10px' : '8px',
        }),
        indicatorSeparator: () => ({ display: 'none' }),
        dropdownIndicator: (base, state) => ({
            ...base,
            color: state.isFocused
                ? (isScheduleFilter ? '#64748b' : 'var(--accent-color, #e8720c)')
                : '#94a3b8',
            padding: isSm ? '0 6px' : '0 8px',
            transition: 'color 0.2s',
            '&:hover': { color: isScheduleFilter ? '#475569' : 'var(--accent-color, #e8720c)' },
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
    isSearchable = true,
    size = 'md',
    variant = 'default',
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
            isSearchable={isSearchable}
            styles={buildStyles(size, variant)}
            className={className}
            classNamePrefix="app-select"
            menuPortalTarget={document.body}
            menuPosition="fixed"
            noOptionsMessage={() => 'No options'}
        />
    );
};

export default AppSelect;
