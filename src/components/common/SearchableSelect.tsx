import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';

interface SearchableSelectProps {
    options: { id: string; name: string; info?: string }[];
    value: string | string[];
    onChange: (id: string | string[]) => void;
    placeholder: string;
    icon?: React.ReactNode;
    multiple?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder, icon, multiple }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const valueArray = Array.isArray(value) ? value : [value];
    const selectedOptions = options.filter(o => valueArray.includes(o.id));

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const term = searchTerm.toLowerCase();
        return options.filter(o => o.name.toLowerCase().includes(term) || (o.info && o.info.toLowerCase().includes(term)));
    }, [options, searchTerm]);

    // Handle clicks outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = () => setIsOpen(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [isOpen]);

    return (
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    minHeight: '42px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {icon && <span style={{ color: '#94a3b8', display: 'flex' }}>{icon}</span>}
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: selectedOptions.length > 0 ? '#1e293b' : '#94a3b8',
                        fontWeight: selectedOptions.length > 0 ? 600 : 400
                    }}>
                        {selectedOptions.length > 0
                            ? (multiple ? `${selectedOptions.length} Collaborators` : selectedOptions[0].name)
                            : placeholder}
                    </span>
                </div>
                {multiple ? <Plus size={14} style={{ color: '#94a3b8', flexShrink: 0 }} /> : <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #f1f5f9',
                                fontSize: '0.8rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, maxHeight: '150px' }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No results match.</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = valueArray.includes(opt.id);
                                return (
                                    <div
                                        key={opt.id}
                                        onClick={() => {
                                            if (multiple) {
                                                const newValue = isSelected
                                                    ? valueArray.filter(v => v !== opt.id)
                                                    : [...valueArray, opt.id].filter(v => v !== '');
                                                onChange(newValue);
                                            } else {
                                                onChange(opt.id);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            background: isSelected ? '#f1f5f9' : 'transparent',
                                            borderLeft: isSelected ? '3px solid var(--primary-color)' : 'none',
                                            transition: 'all 0.15s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseOut={e => e.currentTarget.style.background = isSelected ? '#f1f5f9' : 'transparent'}
                                    >
                                        <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                                            {opt.name}
                                            {isSelected && multiple && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                                        </div>
                                        {opt.info && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{opt.info}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
