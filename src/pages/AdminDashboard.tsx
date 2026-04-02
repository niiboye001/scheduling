import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ShiftCalendar from '../components/ShiftCalendar';
import EmployeeList from '../components/EmployeeList';
import ShiftModal from '../components/ShiftModal';

const AdminDashboard: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [modalInitialDate, setModalInitialDate] = useState<string | null>(null);
    const [modalInitialAssignee, setModalInitialAssignee] = useState<string | null>(null);
    const [modalInitialMode, setModalInitialMode] = useState<'shift' | 'off_day'>('shift');
    const [modalInitialShift, setModalInitialShift] = useState<any | null>(null);

    const openModalWithContext = (dateStr?: string, assignee?: string, mode?: 'shift' | 'off_day', shift?: any) => {
        setModalInitialDate(dateStr || null);
        setModalInitialAssignee(assignee || null);
        setModalInitialMode(mode || 'shift');
        setModalInitialShift(shift || null);
        setIsModalOpen(true);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="app-container">
                <Sidebar />
                <div className="main-content-wrapper">
                    <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
                    <main className="main-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                        <div style={{ flex: '1 1 75%', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Admin Console</h1>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '1rem' }}>
                                        Manage staff shifts, resolve conflicts, and oversee availability.
                                    </p>
                                </div>
                                <button className="btn btn-primary" style={{ height: 'fit-content', padding: '0.75rem 1.5rem', position: 'relative', zIndex: 10 }} onClick={() => openModalWithContext()}>
                                    + New Shift
                                </button>
                            </div>
                            <ShiftCalendar 
                                currentDate={currentDate} 
                                selectedUserId={selectedUserId} 
                                onDayClick={(dateStr, userId, mode, shift) => openModalWithContext(dateStr, userId, mode, shift)}
                            />
                        </div>

                        <div style={{ flex: '1 1 22%', minWidth: '0', maxWidth: '280px' }}>
                            <EmployeeList selectedUserId={selectedUserId} onUserClick={setSelectedUserId} />
                        </div>

                    </main>
                </div>
            </div>

            <ShiftModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                initialDate={modalInitialDate}
                initialAssignee={modalInitialAssignee}
                initialMode={modalInitialMode}
                initialShift={modalInitialShift}
            />
        </div>
    );
};

export default AdminDashboard;
