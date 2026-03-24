import { Calendar, Users, Settings, Clock, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
    const { user, logout } = useAuth();
    return (
        <aside className="sidebar glass-panel animate-fade-in" style={{
            width: '260px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border-color)',
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none',
            borderRadius: 0,
            zIndex: 20
        }}>
            <div style={{ padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'var(--accent-primary)', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                    <Clock size={24} color="white" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.5px' }}>ShiftMaster</h2>
            </div>

            <nav style={{ flex: 1, padding: '1rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '1rem', paddingLeft: '0.5rem' }}>Main Menu</div>
                <ul className="nav-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <li>
                        <a href="#" className="nav-link active">
                            <Calendar size={18} />
                            <span>Schedule</span>
                        </a>
                    </li>
                    {user?.role === 'ADMIN' && (
                        <>
                            <li>
                                <a href="#" className="nav-link">
                                    <Users size={18} />
                                    <span>Team Availability</span>
                                </a>
                            </li>
                            <li>
                                <a href="#" className="nav-link">
                                    <ShieldCheck size={18} />
                                    <span>Access Control</span>
                                </a>
                            </li>
                        </>
                    )}
                    <li>
                        <a href="#" className="nav-link">
                            <Settings size={18} />
                            <span>Settings</span>
                        </a>
                    </li>
                    <li style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="nav-link" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={logout}>
                            <LogOut size={18} />
                            <span>Log Out</span>
                        </button>
                    </li>
                </ul>
            </nav>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '1.1rem', color: 'white'
                    }}>
                        {user?.name.charAt(0) || 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 500 }}>{user?.role}</div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
