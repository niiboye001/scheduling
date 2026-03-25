import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, Lock, User, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!email || !password || (isSignUp && !name)) {
            setError('Please fill in all fields.');
            setLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                // Sign up logic - metadata is picked up by the DB Trigger
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name }
                    }
                });

                if (signUpError) throw signUpError;
                navigate('/');
            } else {
                // Standard Login
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInError) throw signInError;
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            width: '100vw', height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at top left, var(--bg-tertiary), var(--bg-primary))'
        }}>
            <div className="glass-panel animate-fade-in" style={{
                width: '100%', maxWidth: '420px', padding: '2.5rem',
                display: 'flex', flexDirection: 'column', gap: '1.5rem',
                boxShadow: 'var(--shadow-lg)'
            }}>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'var(--accent-primary)', padding: '0.75rem', borderRadius: '12px' }}>
                        <Clock size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.5px' }}>ShiftMaster</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                        {isSignUp ? 'Create a secure account to join your team.' : 'Sign in securely to manage your schedule.'}
                    </p>
                </div>

                {error && (
                    <div style={{ background: 'var(--bg-status-danger-subtle)', border: '1px solid var(--status-danger)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-danger)', fontSize: '0.85rem' }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {isSignUp && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Full Name</label>
                            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <User size={18} color="var(--text-muted)" />
                                <input
                                    type="text"
                                    placeholder="Sarah Jenkins"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Email Account</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <User size={18} color="var(--text-muted)" />
                            <input
                                type="email"
                                placeholder="you@hospital.org"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Password</label>
                        <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-secondary)', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <Lock size={18} color="var(--text-muted)" />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.95rem' }}
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.8rem', fontSize: '1rem' }}>
                        {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Secure Sign In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Powered by Supabase Database
                </div>
            </div>
        </div>
    );
};

export default Login;
