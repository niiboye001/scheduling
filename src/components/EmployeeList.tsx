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

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', targetUser.id);

        if (!error) {
            setEmployees(prev => prev.map(emp =>
                emp.id === targetUser.id ? { ...emp, role: newRole as 'ADMIN' | 'EMPLOYEE' } : emp
            ));
        }
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
            background: 'var(--bg-secondary)',
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
                                    background: selectedUserId === emp.id ? 'var(--bg-status-info-subtle)' : 'var(--bg-primary)',
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
                                                    background: 'var(--bg-dropdown)', boxShadow: 'var(--shadow-lg)',
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
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover-subtle)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        onClick={(e) => { e.stopPropagation(); toggleRole(emp); setOpenMenuId(null); }}
                                                    >
                                                        <Shield size={14} color="var(--accent-primary)" />
                                                        {emp.role === 'ADMIN' ? 'Demote to Staff' : 'Make Admin'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default EmployeeList;
