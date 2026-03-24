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
        };
        fetchUserData();

        // 2. Real-time Subscription Channel
        const channel = supabase
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, selectedUserId]);

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
            console.error("Database connection fault or RLS failure mapping availability:", error);
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

                {/* Availability Row */}
                {(user?.role === 'EMPLOYEE' || (user?.role === 'ADMIN' && selectedUserId)) && (
                    weekDays.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const status = availability[dateStr] || 'Available';
                        const dayOfWeek = day.getDay(); // 0-6
                        
                        // Check if it's a designated off-day for this user
                        const profileOffDays = selectedUserProfile?.off_days || [0, 6];
                        
                        const isOffDay = profileOffDays.includes(dayOfWeek);
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

                        return (
                            <div
                                key={idx}
                                className={`calendar-cell ${isEditable ? 'availability-toggle' : ''}`}
                                style={{ 
                                    background: bgColor, 
                                    border: `1px solid ${borderColor}`, 
                                    borderRight: idx === 6 ? 'none' : '1px solid var(--border-color)',
                                    cursor: isEditable ? 'pointer' : 'default', 
                                    transition: 'all 0.2s', 
                                    position: 'relative',
                                    opacity: isEditable || isOffDay ? 1 : 0.6,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '120px'
                                }}
                                onClick={() => isEditable && toggleAvailability(dateStr)}
                                title={!isOffDay ? "Standard Work Day (Locked)" : isEditable ? `Click to signal availability for this off-day` : `Status: ${status}`}
                            >
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
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ShiftCalendar;
