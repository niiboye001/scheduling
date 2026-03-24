import React, { useEffect, useState } from 'react';
import { X, Clock, MapPin, User, FileText, AlertTriangle, Loader2, Calendar as CalendarIcon, Check, X as XIcon } from 'lucide-react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import type { UserProfile } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [assignees, setAssignees] = useState<UserProfile[]>([]);
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [loadingContext, setLoadingContext] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedAssignee || selectedAssignee === 'unassigned') {
            setSelectedUserProfile(null);
            setAvailabilityMap({});
            return;
        }

        const fetchUserContext = async () => {
            setLoadingContext(true);
            // 1. Fetch Profile for Off-Days
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', selectedAssignee)
                .single();
            
            if (profile) setSelectedUserProfile(profile as UserProfile);

            // 2. Fetch Availabilities for the week of the selected date
            const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
            const weekEnd = addDays(weekStart, 6);

            const { data: avail } = await supabase
                .from('availabilities')
                .select('date, status')
                .eq('user_id', selectedAssignee)
                .gte('date', format(weekStart, 'yyyy-MM-dd'))
                .lte('date', format(weekEnd, 'yyyy-MM-dd'));

            if (avail) {
                const map: Record<string, string> = {};
                avail.forEach(row => map[row.date] = row.status);
                setAvailabilityMap(map);
            }
            setLoadingContext(false);
        };

        fetchUserContext();
    }, [selectedAssignee, selectedDate]);

    useEffect(() => {
        if (isOpen) {
            const fetchAssignees = async () => {
                setLoading(true);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('name', { ascending: true });
                if (!error && data) {
                    setAssignees(data as UserProfile[]);
                }
                setLoading(false);
            };
            fetchAssignees();
            setSelectedAssignee('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Implementation for saving shift would go here
        onClose();
    };

    return (
        <div className="modal-overlay animate-fade-in" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem'
        }}>
            <div className="glass-panel" style={{
                width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-color)', overflow: 'hidden',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create New Shift</h3>
                    <button onClick={onClose} className="icon-btn" style={{ padding: '0.25rem', width: 'auto', height: 'auto' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>

                    {error && (
                        <div className="animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
                            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <strong>Conflict Detected</strong>
                                <p style={{ marginTop: '0.25rem' }}>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Date Selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Shift Date</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <CalendarIcon size={16} color="var(--accent-primary)" />
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', cursor: 'pointer' }} 
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Start Time</label>
                            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <Clock size={16} color="var(--accent-primary)" />
                                <input type="time" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }} />
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>End Time</label>
                            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <Clock size={16} color="var(--text-muted)" />
                                <input type="time" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Assignee</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <User size={16} color="var(--accent-primary)" />
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" color="var(--text-muted)" />
                            ) : (
                                <select
                                    value={selectedAssignee}
                                    onChange={(e) => { setSelectedAssignee(e.target.value); setError(''); }}
                                    disabled={user?.role !== 'ADMIN'}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', appearance: 'none', cursor: user?.role === 'ADMIN' ? 'pointer' : 'not-allowed' }}>
                                    <option value="">Select an assignee...</option>
                                    {assignees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                    ))}
                                    <option value="unassigned">Leave Unassigned</option>
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Availability Context Panel */}
                    {selectedAssignee && selectedAssignee !== 'unassigned' && (
                        <div className="animate-fade-in" style={{ 
                            padding: '1rem', background: 'var(--bg-tertiary)', 
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                            display: 'flex', flexDirection: 'column', gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Weekly Availability Preview</span>
                                {loadingContext && <Loader2 size={12} className="animate-spin" color="var(--accent-primary)" />}
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const day = addDays(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), i);
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const isTargetDate = dateStr === selectedDate;
                                    const status = availabilityMap[dateStr];
                                    const isOffDay = selectedUserProfile?.off_days?.includes(day.getDay());
                                    
                                    return (
                                        <div key={i} style={{ 
                                            textAlign: 'center', padding: '0.4rem 0.2rem', borderRadius: '8px',
                                            background: isTargetDate ? 'rgba(79, 70, 229, 0.2)' : 'var(--bg-primary)',
                                            border: isTargetDate ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            position: 'relative', minWidth: 0
                                        }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{format(day, 'EEE').charAt(0)}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0.1rem 0', color: isOffDay ? 'var(--accent-primary)' : 'inherit' }}>{format(day, 'd')}</div>
                                            
                                            <div style={{ height: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                {status === 'Available' && <Check size={10} color="var(--status-success)" />}
                                                {status === 'Unavailable' && <XIcon size={10} color="var(--status-danger)" />}
                                                {isOffDay && !status && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedUserProfile && availabilityMap[selectedDate] === 'Unavailable' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-danger)', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.4rem', borderRadius: '4px' }}>
                                    <AlertTriangle size={12} />
                                    <span>Staff member marked as Unavailable on this day</span>
                                </div>
                            )}
                            {selectedUserProfile?.off_days?.includes(parseISO(selectedDate).getDay()) && !availabilityMap[selectedDate] && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontSize: '0.75rem', background: 'rgba(79, 70, 229, 0.05)', padding: '0.4rem', borderRadius: '4px' }}>
                                    <Clock size={12} />
                                    <span>Designated Routine Off-Day</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Department / Location</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <MapPin size={16} color="var(--status-warning)" />
                            <input type="text" placeholder="e.g. ICU - Ward B" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Notes</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <FileText size={16} color="var(--text-muted)" style={{ marginTop: '0.2rem' }} />
                            <textarea rows={3} placeholder="Add shift notes here..." style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', resize: 'none', fontFamily: 'inherit' }}></textarea>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Create Shift</button>
                </div>
            </div>
        </div>
    );
};

export default ShiftModal;
