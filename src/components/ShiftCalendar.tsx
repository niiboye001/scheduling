import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Check, X, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ShiftCalendarProps {
    currentDate: Date;
    selectedUserId?: string | null;
}

const ShiftCalendar: React.FC<ShiftCalendarProps> = ({ currentDate, selectedUserId }) => {
    const { user } = useAuth();
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

    const [availability, setAvailability] = useState<Record<string, 'Available' | 'Unavailable' | 'Partial'>>({});
    const [bookedShifts, setBookedShifts] = useState<any[]>([]);

    useEffect(() => {
        const targetId = selectedUserId || user?.id;
        if (!targetId) return;

        // 1. Initial Data Fetch
        const fetchData = async () => {
            const targetId = selectedUserId || user?.id;
            if (!targetId) return;

            // Optional: reset current view for smooth transition
            if (selectedUserId) {
                // Only reset if we are switching to a specific user
                // setBookedShifts([]); 
            }

            try {
                // 1. Fetch profile for routine and naming
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', targetId)
                    .single();
                
                if (profile) setSelectedUserProfile(profile as UserProfile);

                // 2. Fetch availabilities
                const { data: availData } = await supabase
                    .from('availabilities')
                    .select('date, status')
                    .eq('user_id', targetId);

                if (availData) {
                    const payload: Record<string, 'Available' | 'Unavailable' | 'Partial'> = {};
                    availData.forEach((row: any) => payload[row.date] = row.status);
                    setAvailability(payload);
                } else {
                    setAvailability({});
                }

                // 3. Fetch shifts with user filtering
                let shiftsQuery = supabase
                    .from('shifts')
                    .select('*, profiles(name)')
                    .gte('date', format(startDate, 'yyyy-MM-dd'))
                    .lte('date', format(addDays(startDate, 6), 'yyyy-MM-dd'));
                
                // Admin logic: if no user selected, show everything. If user selected, filter by them.
                // Non-admins always filter by themselves (handled by targetId defaulting to user.id).
                const isViewAllAdmin = user?.role === 'ADMIN' && !selectedUserId;
                
                if (!isViewAllAdmin) {
                    shiftsQuery = shiftsQuery.eq('user_id', targetId);
                }

                const { data: shiftsData, error: shiftsError } = await shiftsQuery;
                if (!shiftsError && shiftsData) {
                    setBookedShifts(shiftsData);
                }
            } catch (err) {
                console.error("Error in fetchUserData:", err);
            }
        };

        fetchData();

        // 2. Availabilities Subscription
        const availabilityChannel = supabase
            .channel('public:availabilities')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'availabilities' },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData && newData.user_id === targetId) {
                        setAvailability((prev: Record<string, 'Available' | 'Unavailable' | 'Partial'>) => ({
                            ...prev,
                            [newData.date]: newData.status
                        }));
                    }
                }
            )
            .subscribe();

        // 3. Shifts Subscription (Universal)
        const shiftsChannel = supabase
            .channel('public:shifts')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shifts' },
                () => fetchData() 
            )
            .subscribe();

        return () => {
            supabase.removeChannel(availabilityChannel);
            supabase.removeChannel(shiftsChannel);
        };
    }, [user?.id, user?.role, selectedUserId, currentDate]);

    const toggleAvailability = async (dateStr: string) => {
        if (!user) return; 
        const targetId = selectedUserId || user.id;
        const currentStatus = availability[dateStr];
        
        // ADMIN Cycle: Neutral -> Unavailable (Day Off) -> Available -> Neutral (Clear Record)
        // STAFF Cycle: Unavailable <-> Available (Only on assigned days)
        let nextStatus: 'Available' | 'Unavailable' | undefined;
        
        if (user.role === 'ADMIN') {
            if (!currentStatus) nextStatus = 'Unavailable';
            else if (currentStatus === 'Unavailable') nextStatus = 'Available';
            else nextStatus = undefined;
        } else {
            if (!currentStatus) return; // Locked for staff if not initiated by Admin
            nextStatus = currentStatus === 'Available' ? 'Unavailable' : 'Available';
        }

        // Optimistic UI Update
        setAvailability(prev => {
            const next = { ...prev };
            if (nextStatus) next[dateStr] = nextStatus;
            else delete next[dateStr];
            return next;
        });

        if (nextStatus) {
            const { error } = await supabase
                .from('availabilities')
                .upsert({ user_id: targetId, date: dateStr, status: nextStatus }, { onConflict: 'user_id, date' });
            if (error) setAvailability(prev => ({ ...prev, [dateStr]: currentStatus }));
        } else {
            const { error } = await supabase
                .from('availabilities')
                .delete()
                .eq('user_id', targetId)
                .eq('date', dateStr);
            if (error) setAvailability(prev => ({ ...prev, [dateStr]: currentStatus }));
        }
    };

    return (
        <div className="calendar-container animate-fade-in" style={{ padding: '1.5rem' }}>
            {/* Header section above the grid */}
            <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                    width: '48px', height: '48px', borderRadius: '16px', 
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                }}>
                    <User size={24} />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        {selectedUserId && selectedUserId !== user?.id ? selectedUserProfile?.name : "My Schedule"}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        {selectedUserId && selectedUserId !== user?.id ? `Viewing availability for ${selectedUserProfile?.name}` : "Manage your weekly availability and overtime requests"}
                    </p>
                </div>
            </div>

            <div className="calendar-grid">
                {/* Day Headers */}
                {weekDays.map((day, idx) => (
                    <div key={idx} className="calendar-header-cell" style={{ textAlign: 'center', borderRight: idx === 6 ? 'none' : '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {format(day, 'EEE')}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: isSameDay(day, new Date()) ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                            {format(day, 'dd')}
                        </div>
                    </div>
                ))}

                {/* Availability and Shift Row */}
                {user && (
                    weekDays.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const status = availability[dateStr];
                        
                        // Admins can toggle anyone's specific off-days. 
                        // Staff can ONLY toggle availability on days indicated as 'Off' by an Admin.
                        const isAdmin = user?.role === 'ADMIN';
                        const isOwnCalendar = !selectedUserId || selectedUserId === user?.id;
                        const isEditable = isAdmin || (isOwnCalendar && status !== undefined);

                        let bgColor = 'var(--bg-secondary)';
                        let borderColor = 'transparent';
                        
                        if (status === 'Available') {
                            bgColor = 'var(--bg-status-success-subtle)';
                            borderColor = 'var(--status-success)';
                        } else if (status === 'Unavailable') {
                            bgColor = 'var(--bg-status-danger-subtle)';
                            borderColor = 'var(--status-danger)';
                        }

                        const dayShifts = bookedShifts.filter(s => s.date === dateStr);
                        const hasShifts = dayShifts.length > 0;

                        return (
                            <div
                                key={idx}
                                className={`calendar-cell ${isEditable ? 'availability-toggle' : ''}`}
                                style={{ 
                                    background: bgColor, 
                                    border: `1px solid ${borderColor}`, 
                                    borderRight: idx === 6 ? 'none' : '1px solid var(--border-color)',
                                    cursor: isEditable ? 'pointer' : 'not-allowed', 
                                    transition: 'all 0.2s', 
                                    position: 'relative',
                                    opacity: hasShifts ? 1 : (status ? 1 : 0.6),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '140px',
                                    padding: hasShifts ? '8px' : '12px',
                                    gap: '6px'
                                }}
                                onClick={() => isEditable && toggleAvailability(dateStr)}
                                title={isAdmin ? 
                                    (status ? `Status: ${status} (Cycle: Off -> Available -> Clear)` : "Work Day (Click to assign Day Off)") : 
                                    (status ? `Click to signal your availability` : "Standard Work Day (Locked)")
                                }
                            >
                                {hasShifts ? (
                                    /* Shift View: Only show shifts, no background text/indicators */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', height: '100%', justifyContent: 'center' }}>
                                        {dayShifts.map((shift, sidx) => (
                                            <div key={sidx} style={{ 
                                                background: shift.user_id ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'linear-gradient(135deg, #f59e0b, #fbbf24)', 
                                                color: '#FFFFFF',
                                                padding: '10px 12px', borderRadius: '12px', fontSize: '0.8rem',
                                                fontWeight: 800, boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                                                display: 'flex', flexDirection: 'column', gap: '3px',
                                                border: '1px solid rgba(255,255,255,0.25)',
                                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                width: '100%'
                                            }}>
                                                {shift.user_id !== user?.id && (
                                                    <div style={{ marginBottom: '2px' }}>
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#FFFFFF', background: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            {shift.profiles?.name || 'TBD'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ letterSpacing: '0.5px', color: '#FFFFFF', fontWeight: 800 }}>{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>
                                                </div>
                                                {shift.location && <div style={{ color: '#FFFFFF', opacity: 0.9, fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{shift.location}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* Status View: Show Dash or Work/Off indicators */
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', flex: 1 }}>
                                        {status ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', opacity: 0.6 }}>
                                                    {status === 'Available' ? 'Available' : 'Day Off'}
                                                </div>
                                                {status === 'Available' ? (
                                                    <Check size={28} color="var(--status-success)" strokeWidth={3} />
                                                ) : (
                                                    <X size={28} color="var(--status-danger)" strokeWidth={3} />
                                                )}
                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: status === 'Available' ? 'var(--status-success)' : 'var(--status-danger)', textTransform: 'uppercase' }}>
                                                    {status === 'Available' ? 'Available' : 'Unavailable'}
                                                </div>
                                            </div>
                                        ) : hasShifts ? (
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', opacity: 0.5 }}>On Duty</div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ShiftCalendar;
