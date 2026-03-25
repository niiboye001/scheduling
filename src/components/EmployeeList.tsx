import React, { useEffect, useState } from 'react';
import { Search, Shield, User as UserIcon, Loader2, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';

interface EmployeeListProps {
    selectedUserId?: string | null;
    onUserClick?: (userId: string) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ selectedUserId, onUserClick }) => {
    const { user: currentUser } = useAuth();
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [editingOffDays, setEditingOffDays] = useState<string | null>(null);
    const [tempOffDays, setTempOffDays] = useState<number[]>([]);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('name', { ascending: true });

        if (!error && data) {
            setEmployees(data as UserProfile[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const toggleRole = async (targetUser: UserProfile) => {
        if (currentUser?.role !== 'ADMIN' || targetUser.id === currentUser.id) return;

        const newRole = targetUser.role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN';
        setUpdatingId(targetUser.id);

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', targetUser.id);

        if (!error) {
            setEmployees(prev => prev.map(emp =>
                emp.id === targetUser.id ? { ...emp, role: newRole as 'ADMIN' | 'EMPLOYEE' } : emp
            ));
        }
        setUpdatingId(null);
    };

    const saveOffDays = async (userId: string) => {
        if (tempOffDays.length !== 2) return;
        setUpdatingId(userId);

        const { error } = await supabase
            .from('profiles')
            .update({ off_days: tempOffDays })
            .eq('id', userId);

        if (!error) {
            setEmployees(prev => prev.map(emp =>
                emp.id === userId ? { ...emp, off_days: tempOffDays } : emp
            ));
            setEditingOffDays(null);
        }
        setUpdatingId(null);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(22, 25, 37, 0.4)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)'
        }}>
            <div style={{ padding: '1.25rem 1.25rem 1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Team Directory</h3>
                <div style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                    {employees.length} Members
                </div>
            </div>

            <div style={{ padding: '1rem 1.25rem' }}>
                <div className="search-bar" style={{ width: '100%', background: 'var(--bg-primary)' }}>
                    <Search size={16} className="search-icon" color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Find member..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader2 className="animate-spin" size={24} color="var(--accent-primary)" />
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        No members found matching your search.
                    </div>
                ) : (
                    filteredEmployees.map((emp) => (
                        <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div
                                className={`employee-card ${selectedUserId === emp.id ? 'selected' : ''}`}
                                onClick={() => onUserClick?.(emp.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem',
                                    background: selectedUserId === emp.id ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: selectedUserId === emp.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                    transition: 'all 0.2s',
                                    boxShadow: selectedUserId === emp.id ? '0 0 0 1px var(--accent-primary)' : 'var(--shadow-sm)',
                                    cursor: 'pointer'
                                }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: emp.role === 'ADMIN' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
                                    color: emp.role === 'ADMIN' ? 'white' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', fontSize: '0.75rem'
                                }}>
                                    {emp.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                                        {emp.role === 'ADMIN' ? (
                                            <Shield size={12} color="var(--accent-primary)" />
                                        ) : (
                                            <UserIcon size={12} color="var(--text-muted)" />
                                        )}
                                        <span style={{ fontSize: '0.7rem', color: emp.role === 'ADMIN' ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: emp.role === 'ADMIN' ? 600 : 400 }}>{emp.role}</span>
                                    </div>
                                </div>
                                {currentUser?.role === 'ADMIN' && (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className="icon-btn"
                                            style={{ color: openMenuId === emp.id ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === emp.id ? null : emp.id);
                                            }}
                                        >
                                            <MoreVertical size={18} />
                                        </button>

                                        {openMenuId === emp.id && (
                                            <div 
                                                className="glass-panel animate-fade-in" 
                                                style={{ 
                                                    position: 'absolute', top: '100%', right: 0, zIndex: 100,
                                                    width: '160px', marginTop: '0.5rem', overflow: 'hidden',
                                                    background: 'rgba(30, 34, 51, 0.95)', boxShadow: 'var(--shadow-lg)',
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            >
                                                {emp.id !== currentUser.id && (
                                                    <button
                                                        className="dropdown-item"
                                                        style={{ 
                                                            width: '100%', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                            background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left',
                                                            cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        onClick={(e) => { e.stopPropagation(); toggleRole(emp); setOpenMenuId(null); }}
                                                    >
                                                        <Shield size={14} color="var(--accent-primary)" />
                                                        {emp.role === 'ADMIN' ? 'Demote to Staff' : 'Make Admin'}
                                                    </button>
                                                )}
                                                <button
                                                    className="dropdown-item"
                                                    style={{ 
                                                        width: '100%', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                        background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left',
                                                        cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingOffDays(editingOffDays === emp.id ? null : emp.id);
                                                        setTempOffDays(emp.off_days || []);
                                                        setOpenMenuId(null);
                                                    }}
                                                >
                                                    <Search size={14} color="var(--text-muted)" />
                                                    Routine Off-Days
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {editingOffDays === emp.id && (
                                <div onClick={(e) => e.stopPropagation()} className="animate-fade-in" style={{ 
                                    padding: '0.75rem', background: 'var(--bg-tertiary)', 
                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow-lg)'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Set 2 Non-Consecutive Days Off</span>
                                        <span style={{ color: tempOffDays.length === 2 ? 'var(--status-success)' : 'var(--status-danger)' }}>{tempOffDays.length}/2 Selected</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                                            const isSelected = tempOffDays.includes(idx);
                                            // Non-consecutive rule: can't select adjacent days
                                            const isConsecutive = tempOffDays.some(d => Math.abs(d - idx) === 1 || Math.abs(d - idx) === 6);
                                            const isDisabled = (!isSelected && tempOffDays.length >= 2) || (!isSelected && isConsecutive);
                                            
                                            return (
                                                <button
                                                    key={idx}
                                                    disabled={isDisabled}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setTempOffDays(prev => prev.filter(d => d !== idx));
                                                        } else {
                                                            setTempOffDays(prev => [...prev, idx]);
                                                        }
                                                    }}
                                                    style={{
                                                        width: '100%', aspectRatio: '1/1', borderRadius: '8px', border: '1px solid var(--border-color)',
                                                        background: isSelected ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                                        color: isSelected ? 'white' : 'var(--text-muted)',
                                                        fontSize: '0.75rem', fontWeight: 600, cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                        opacity: isDisabled ? 0.3 : 1, transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            className="btn btn-sm btn-primary" 
                                            style={{ flex: 1, fontSize: '0.7rem' }}
                                            disabled={tempOffDays.length !== 2 || updatingId === emp.id}
                                            onClick={() => saveOffDays(emp.id)}
                                        >
                                            {updatingId === emp.id && editingOffDays === emp.id ? <Loader2 size={12} className="animate-spin" /> : 'Save Routine'}
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-secondary" 
                                            style={{ fontSize: '0.7rem' }}
                                            onClick={() => setEditingOffDays(null)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default EmployeeList;
