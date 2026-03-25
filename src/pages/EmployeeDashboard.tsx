import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ShiftCalendar from '../components/ShiftCalendar';

const EmployeeDashboard: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content-wrapper">
                <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
                <main className="main-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                    <div style={{ flex: '1 1 100%', minWidth: '700px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', margin: 0, background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>My Schedule</h1>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '1rem' }}>
                                    View your upcoming shifts and update your personal availability by clicking the calendar grid.
                                </p>
                            </div>
                        </div>

                        {/* The calendar stretches full width for the employee view */}
                        <ShiftCalendar currentDate={currentDate} />
                    </div>

                </main>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
