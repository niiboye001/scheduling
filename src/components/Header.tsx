import React from 'react';
import { Search, Bell, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';

interface HeaderProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
}

const Header: React.FC<HeaderProps> = ({ currentDate, setCurrentDate }) => {
    return (
        <header className="header animate-fade-in" style={{
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(15, 17, 26, 0.8)',
            backdropFilter: 'blur(16px)',
            position: 'sticky',
            top: 0,
            zIndex: 10
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.25rem' }}>
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="icon-btn" aria-label="Previous month">
                        <ChevronLeft size={20} />
                    </button>
                    <div style={{ width: '150px', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                            {format(currentDate, 'MMMM yyyy')}
                        </h1>
                    </div>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="icon-btn" aria-label="Next month">
                        <ChevronRight size={20} />
                    </button>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                    Today
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="search-bar">
                    <Search size={16} className="search-icon" color="var(--text-muted)" />
                    <input type="text" placeholder="Search shifts or staff..." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                    <button className="icon-btn relative" aria-label="Notifications">
                        <Bell size={20} />
                        <span className="badge"></span>
                    </button>
                    <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                        <FileDown size={16} /> Export Plan
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
