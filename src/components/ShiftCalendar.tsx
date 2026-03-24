import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Check, X, Minus, User } from 'lucide-react';
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
        const fetchUserData = async () => {
            // Fetch profile if it's not the current user, or if we need fresh off_days
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetId)
                .single();
            
            if (profile) setSelectedUserProfile(profile as UserProfile);

            const { data, error } = await supabase
                .from('availabilities')
                .select('date, status')
                .eq('user_id', targetId);

            if (!error && data) {
                const payload: Record<string, 'Available' | 'Unavailable' | 'Partial'> = {};
                data.forEach((row: any) => {
                    payload[row.date] = row.status;
                });
                setAvailability(payload);
            } else {
                setAvailability({});
            }

            // 1c. Fetch Shifts
            let shiftsQuery = supabase
                .from('shifts')
                .select('*, profiles(name)')
                .gte('date', format(startDate, 'yyyy-MM-dd'))
                .lte('date', format(addDays(startDate, 6), 'yyyy-MM-dd'));
            
            if (user?.role !== 'ADMIN' || selectedUserId) {
                shiftsQuery = shiftsQuery.eq('user_id', targetId);
            }

            const { data: shiftsData } = await shiftsQuery;
            if (shiftsData) setBookedShifts(shiftsData);
        };
        fetchUserData();

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

        // 3. Shifts Subscription
        const shiftsChannel = supabase
            .channel('public:shifts')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shifts' },
                () => fetchUserData() // Refetch shifts and profiles when a shift changes
            )
            .subscribe();

        return () => {
            supabase.removeChannel(availabilityChannel);
            supabase.removeChannel(shiftsChannel);
        };
    }, [user, selectedUserId, currentDate]);

    const toggleAvailability = async (dateStr: string) => {
        if (!user) return; // Prevent unauthorized mutations

        // Calculate new status
        const currentStatus = availability[dateStr] || 'Available';
        const nextStatus: 'Available' | 'Unavailable' | 'Partial' =
            currentStatus === 'Available' ? 'Partial' :
                currentStatus === 'Partial' ? 'Unavailable' : 'Available';

        // Optimistic UI Update for zero latency feel locally
        setAvailability(prev => ({ ...prev, [dateStr]: nextStatus }));

        // Real DB Upsert Execution over Supabase REST
        const { error } = await supabase
            .from('availabilities')
            .upsert({
                user_id: user.id,
                date: dateStr,
                status: nextStatus
            }, { onConflict: 'user_id, date' })
            .select();

        if (error) {
            // Revert mapping on strict failure
            setAvailability(prev => ({ ...prev, [dateStr]: currentStatus }));
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
                        const status = availability[dateStr] || 'Available';
                        const dayOfWeek = day.getDay(); // 0-6
                        
                        // Check if it's a designated off-day for this user
                        const profileOffDays = selectedUserProfile?.off_days;
                        const isSchedulePending = !profileOffDays || profileOffDays.length === 0;
                        
                        const isOffDay = profileOffDays?.includes(dayOfWeek);
                        const isEditable = (!selectedUserId || selectedUserId === user?.id) && isOffDay;

                        let bgColor = 'var(--bg-secondary)';
                        let borderColor = 'transparent';
                        
                        if (!isOffDay) {
                            bgColor = 'rgba(99, 102, 241, 0.03)'; // Subtle indigo for work days
                        } else if (status === 'Available') {
                            bgColor = 'rgba(16, 185, 129, 0.05)';
                            borderColor = 'rgba(16, 185, 129, 0.3)';
                        } else if (status === 'Partial') {
                            bgColor = 'rgba(245, 158, 11, 0.05)';
                            borderColor = 'rgba(245, 158, 11, 0.3)';
                        } else if (status === 'Unavailable') {
                            bgColor = 'rgba(239, 68, 68, 0.05)';
                            borderColor = 'rgba(239, 68, 68, 0.3)';
                        }

                        const dayShifts = bookedShifts.filter(s => s.date === dateStr);
                        const hasShifts = dayShifts.length > 0;

                        return (
                            <div
                                key={idx}
                                className={`calendar-cell ${isEditable ? 'availability-toggle' : ''}`}
                                style={{ 
                                    background: isSchedulePending && !hasShifts ? 'rgba(255, 255, 255, 0.02)' : bgColor, 
                                    border: isSchedulePending && !hasShifts ? '1px solid var(--border-color)' : `1px solid ${borderColor}`, 
                                    borderRight: idx === 6 ? 'none' : '1px solid var(--border-color)',
                                    cursor: isEditable ? 'pointer' : 'default', 
                                    transition: 'all 0.2s', 
                                    position: 'relative',
                                    opacity: hasShifts ? 1 : (isSchedulePending ? 0.5 : (isEditable || isOffDay ? 1 : 0.6)),
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '140px',
                                    padding: hasShifts ? '8px' : '12px',
                                    gap: '6px'
                                }}
                                onClick={() => isEditable && toggleAvailability(dateStr)}
                                title={isSchedulePending ? "No routine assigned yet" : (!isOffDay ? "Standard Work Day (Locked)" : isEditable ? `Click to signal availability for this off-day` : `Status: ${status}`)}
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
                                                {(!selectedUserId || selectedUserId !== shift.user_id) && (
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
                                        {isSchedulePending ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem', opacity: 0.5 }}>
                                                <Minus size={16} />
                                                <span>Schedule<br/>Pending</span>
                                            </div>
                                        ) : (
                                            <>
                                                {!isOffDay ? (
                                                    <>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.5rem', opacity: 0.8 }}>Work</div>
                                                        <div style={{ padding: '0.5rem', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)' }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', opacity: 0.6 }}>Day Off</div>
                                                        {status === 'Available' && <Check size={28} color="var(--status-success)" strokeWidth={3} />}
                                                        {status === 'Partial' && <Minus size={28} color="var(--status-warning)" strokeWidth={3} />}
                                                        {status === 'Unavailable' && <X size={28} color="var(--status-danger)" strokeWidth={3} />}
                                                    </>
                                                )}
                                            </>
                                        )}
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
