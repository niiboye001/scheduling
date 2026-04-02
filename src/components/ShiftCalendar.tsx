import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Check, X, User, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ShiftCalendarProps {
    currentDate: Date;
    selectedUserId?: string | null;
    onDayClick?: (dateStr: string, userId?: string, mode?: 'shift' | 'off_day', shift?: any) => void;
}

const ShiftCalendar: React.FC<ShiftCalendarProps> = ({ currentDate, selectedUserId, onDayClick }) => {
    const { user } = useAuth();
    const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

    const [availability, setAvailability] = useState<Record<string, 'Available' | 'Unavailable' | 'Partial'>>({});
    const [bookedShifts, setBookedShifts] = useState<any[]>([]);
    
    // Drag and Drop States
    const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);

    // Hover Tooltip States
    const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null);

    // Filter States
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

    useEffect(() => {
        const isViewAllAdmin = user?.role === 'ADMIN' && !selectedUserId;
        const targetId = selectedUserId || user?.id;
        
        if (!targetId) return;

        // 1. Initial Data Fetch
        const fetchData = async () => {
            try {
                if (isViewAllAdmin) {
                    setAvailability({});
                    setSelectedUserProfile(null);
                } else {
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
                }

                // 3. Fetch shifts with user filtering
                let shiftsQuery = supabase
                    .from('shifts')
                    .select('*, profiles(name)')
                    .gte('date', format(startDate, 'yyyy-MM-dd'))
                    .lte('date', format(addDays(startDate, 6), 'yyyy-MM-dd'));
                
                // Admin logic: if no user selected, show everything. If user selected, filter by them.
                // Non-admins always filter by themselves.
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
                    if (isViewAllAdmin) return;
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
        
        // ADMIN Cycle: Modal Trigger 
        // STAFF Cycle: Unavailable <-> Available (Only on assigned days)
        let nextStatus: 'Available' | 'Unavailable' | undefined;
        
        if (user.role === 'ADMIN') {
            if (onDayClick) {
                const mode = currentStatus ? 'off_day' : 'shift';
                onDayClick(dateStr, selectedUserId || undefined, mode);
            }
            return;
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

    const uniqueLocations = Array.from(new Set(bookedShifts.map(s => s.location).filter(Boolean))) as string[];

    const getTotalScheduledHours = () => {
        let totalMinutes = 0;
        const shiftsToCount = selectedLocation ? bookedShifts.filter(s => s.location === selectedLocation) : bookedShifts;
        shiftsToCount.forEach(shift => {
            if (shift.start_time && shift.end_time) {
                const [startH, startM] = shift.start_time.split(':').map(Number);
                const [endH, endM] = shift.end_time.split(':').map(Number);
                let mins = (endH * 60 + endM) - (startH * 60 + startM);
                if (mins < 0) mins += 24 * 60; // night shift crossover
                totalMinutes += mins;
            }
        });
        return (totalMinutes / 60).toFixed(1);
    };

    return (
        <div className="calendar-container animate-fade-in" style={{ padding: '1.5rem' }}>
            {/* Header section above the grid */}
            <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                        width: '48px', height: '48px', borderRadius: '16px', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                    }}>
                        <User size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                            {user?.role === 'ADMIN' && !selectedUserId ? "Team Schedule" : (selectedUserId && selectedUserId !== user?.id ? selectedUserProfile?.name : "My Schedule")}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                            {user?.role === 'ADMIN' && !selectedUserId ? "Showing all shifts across the organization." : (selectedUserId && selectedUserId !== user?.id ? `Viewing availability for ${selectedUserProfile?.name}` : "Manage your weekly availability and overtime requests")}
                        </p>
                        <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: 'var(--bg-card-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                                ⏱️ {getTotalScheduledHours()}h Total
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: 'var(--bg-card-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                                👥 {selectedLocation ? bookedShifts.filter(s => s.location === selectedLocation).length : bookedShifts.length} Shifts
                            </span>
                        </div>
                    </div>
                </div>

                {/* Dynamic Location Filters */}
                {uniqueLocations.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button 
                            style={{ 
                                padding: '0.35rem 1rem', fontSize: '0.75rem', borderRadius: '20px', fontWeight: 700,
                                background: selectedLocation === null ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: selectedLocation === null ? '#fff' : 'var(--text-primary)',
                                border: '1px solid transparent',
                                transition: 'all 0.2s', cursor: 'pointer'
                            }}
                            onClick={() => setSelectedLocation(null)}
                        >
                            All Locations
                        </button>
                        {uniqueLocations.map(loc => (
                            <button 
                                key={loc} 
                                style={{ 
                                    padding: '0.35rem 1rem', fontSize: '0.75rem', borderRadius: '20px', fontWeight: 700,
                                    background: selectedLocation === loc ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                    color: selectedLocation === loc ? '#fff' : 'var(--text-primary)',
                                    border: `1px solid ${selectedLocation === loc ? 'transparent' : 'var(--border-color)'}`,
                                    transition: 'all 0.2s', cursor: 'pointer'
                                }}
                                onClick={() => setSelectedLocation(loc)}
                            >
                                {loc}
                            </button>
                        ))}
                    </div>
                )}
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
                        const isViewAllAdmin = isAdmin && !selectedUserId;
                        const isOwnCalendar = !selectedUserId || selectedUserId === user?.id;
                        const isEditable = isAdmin || (!isViewAllAdmin && isOwnCalendar && status !== undefined);

                        let bgColor = 'var(--bg-secondary)';
                        let borderColor = 'transparent';
                        
                        if (status === 'Available') {
                            bgColor = 'var(--bg-status-success-subtle)';
                            borderColor = 'var(--status-success)';
                        } else if (status === 'Unavailable') {
                            bgColor = 'var(--bg-status-danger-subtle)';
                            borderColor = 'var(--status-danger)';
                        }

                        const dayShifts = bookedShifts.filter(s => s.date === dateStr && (!selectedLocation || s.location === selectedLocation));
                        const hasShifts = dayShifts.length > 0;

                        return (
                            <div
                                key={idx}
                                className={`calendar-cell ${isEditable ? 'availability-toggle' : ''}`}
                                style={{ 
                                    background: dragOverDate === dateStr ? 'var(--bg-status-success-subtle)' : bgColor, 
                                    border: dragOverDate === dateStr ? '2px dashed var(--status-success)' : `1px solid ${borderColor}`, 
                                    borderRight: idx === 6 && dragOverDate !== dateStr ? 'none' : (dragOverDate === dateStr ? '2px dashed var(--status-success)' : '1px solid var(--border-color)'),
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
                                onDragOver={(e) => {
                                    if (isAdmin && draggedShiftId) {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverDate !== dateStr) setDragOverDate(dateStr);
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverDate === dateStr) setDragOverDate(null);
                                }}
                                onDrop={async (e) => {
                                    if (isAdmin && draggedShiftId) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverDate(null);
                                        
                                        const draggedShift = bookedShifts.find(s => s.id === draggedShiftId);
                                        if (draggedShift && draggedShift.date !== dateStr) {
                                            // Optimistic shift update
                                            setBookedShifts(prev => prev.map(s => s.id === draggedShiftId ? { ...s, date: dateStr } : s));
                                            
                                            // DB Update
                                            await supabase
                                                .from('shifts')
                                                .update({ date: dateStr })
                                                .eq('id', draggedShiftId);
                                                
                                            // Mutual Exclusion: Clear conflicting availability on the new date
                                            if (draggedShift.user_id) {
                                                await supabase
                                                    .from('availabilities')
                                                    .delete()
                                                    .eq('user_id', draggedShift.user_id)
                                                    .eq('date', dateStr);
                                                
                                                setAvailability(prev => {
                                                    const next = { ...prev };
                                                    delete next[dateStr];
                                                    return next;
                                                });
                                            }
                                        }
                                        setDraggedShiftId(null);
                                    }
                                }}
                                onClick={() => isEditable && toggleAvailability(dateStr)}
                                title={isAdmin ? 
                                    ("Click to open Modal for " + (status ? `Status: ${status}` : "Work Day")) : 
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
                                                width: '100%',
                                                position: 'relative',
                                                cursor: isAdmin ? (draggedShiftId === shift.id ? 'grabbing' : 'grab') : 'default',
                                                opacity: draggedShiftId === shift.id ? 0.6 : 1,
                                                transform: draggedShiftId === shift.id ? 'scale(0.98)' : 'scale(1)',
                                                transition: 'all 0.1s ease',
                                                zIndex: draggedShiftId === shift.id ? 10 : (hoveredShiftId === shift.id ? 20 : 1)
                                            }}
                                            // Hover disabled for now:
                                            // onMouseEnter={() => setHoveredShiftId(shift.id)}
                                            // onMouseLeave={() => setHoveredShiftId(null)}
                                            draggable={isAdmin}
                                            onDragStart={(e) => {
                                                if (isAdmin) {
                                                    setHoveredShiftId(null);
                                                    setDraggedShiftId(shift.id);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                    e.dataTransfer.setData('text/plain', shift.id);
                                                }
                                            }}
                                            onDragEnd={() => {
                                                setDraggedShiftId(null);
                                                setDragOverDate(null);
                                            }}
                                            onClick={(e) => {
                                                if (isAdmin) {
                                                    e.stopPropagation();
                                                    if (onDayClick) onDayClick(dateStr, shift.user_id, 'shift', shift);
                                                }
                                            }}>
                                                {/* Tooltip Overlay (Disabled temporarily to prevent conflicts) */}
                                                {false && hoveredShiftId === shift.id && !draggedShiftId && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: 'calc(100% + 12px)',
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        background: 'var(--bg-card)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '12px',
                                                        padding: '12px',
                                                        width: 'max-content',
                                                        maxWidth: '220px',
                                                        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                                                        zIndex: 100,
                                                        pointerEvents: 'none',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px',
                                                        textAlign: 'left',
                                                        color: 'var(--text-primary)',
                                                        textShadow: 'none'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>
                                                                {shift.profiles?.name?.charAt(0) || '?'}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shift.profiles?.name || 'Unassigned'}</div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</div>
                                                            </div>
                                                        </div>
                                                        {shift.location && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                                <MapPin size={12} color="var(--accent-primary)" /> {shift.location}
                                                            </div>
                                                        )}
                                                        {shift.notes && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)', background: 'var(--bg-card-subtle)', padding: '6px 8px', borderRadius: '6px', fontStyle: 'italic', borderLeft: '2px solid var(--accent-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                                                                "{shift.notes}"
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                                            width: '12px', height: '12px',
                                                            background: 'var(--bg-card)',
                                                            borderRight: '1px solid var(--border-color)',
                                                            borderBottom: '1px solid var(--border-color)',
                                                        }} />
                                                    </div>
                                                )}

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
                                        ) : (
                                            <div style={{ opacity: 0.15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>EMPTY</span>
                                            </div>
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
