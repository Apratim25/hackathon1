import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Headset, AlertCircle, CircleUser, Copy } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001';

function App() {
    const [socket, setSocket] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [agentInput, setAgentInput] = useState('');

    const chatEndRef = useRef(null);

    useEffect(() => {
        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);

        newSocket.on('agent_escalation', (data) => {
            setSessions(prev => {
                // Avoid duplicate session logic in memory
                const exists = prev.find(s => s.clientId === data.clientId);
                if (exists) return prev;
                return [...prev, data];
            });

            // Auto-select if it's the first one
            if (!activeSessionId) {
                setActiveSessionId(data.clientId);
            }
        });

        return () => newSocket.close();
    }, [activeSessionId]);

    const activeSession = sessions.find(s => s.clientId === activeSessionId);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSession?.history]);

    const handleSend = () => {
        if (!agentInput.trim() || !activeSession || !socket) return;

        const newMessage = { sender: 'agent', text: agentInput };

        // Update local history
        setSessions(prev => prev.map(s => {
            if (s.clientId === activeSessionId) {
                return { ...s, history: [...s.history, newMessage] };
            }
            return s;
        }));

        // Send to backend
        socket.emit('agent_reply', { clientId: activeSessionId, message: agentInput });
        setAgentInput('');
    };

    return (
        <div className="agent-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <Headset size={24} />
                    Agent Control Center
                </div>
                <div className="escalation-list">
                    {sessions.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Headset size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <div>No active escalations</div>
                        </div>
                    )}
                    {sessions.map(s => (
                        <div
                            key={s.clientId}
                            className={`session-item ${activeSessionId === s.clientId ? 'active' : ''}`}
                            onClick={() => setActiveSessionId(s.clientId)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <h4>{s.user.name}</h4>
                                <AlertCircle size={16} color="#ef4444" />
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>ID: {s.user.id}</div>
                            <div className="session-badge">Requires Assistance</div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div style={{ fontWeight: 600 }}>Contact Center Dashboard</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}></span>
                        Agent Online
                    </div>
                </header>

                {activeSession ? (
                    <div className="workspace">
                        <div className="chat-area">
                            <div className="chat-history">
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
                                    --- Escalation Context History ---
                                </div>
                                {activeSession.history.map((msg, i) => (
                                    <div key={i} className={`msg ${msg.sender}`}>
                                        <div className="sender-label">{msg.sender === 'user' ? activeSession.user.name : msg.sender.toUpperCase()}</div>
                                        {msg.text}
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="input-area">
                                <input
                                    type="text"
                                    className="chat-input"
                                    placeholder="Type your response to the customer..."
                                    value={agentInput}
                                    onChange={e => setAgentInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <button className="send-btn" onClick={handleSend}>Send</button>
                            </div>
                        </div>

                        <aside className="context-area">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                                <CircleUser size={32} color="var(--primary)" />
                                <div>
                                    <h3 style={{ fontSize: '1.2rem' }}>{activeSession.user.name}</h3>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Customer since 2018</div>
                                </div>
                            </div>

                            <div className="stat-group">
                                <div className="stat-label">Customer ID</div>
                                <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {activeSession.user.id}
                                    <Copy size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                                </div>
                            </div>

                            <div className="stat-group">
                                <div className="stat-label">Accounts</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {activeSession.user.accounts.map(acc => (
                                        <div key={acc.id} style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{acc.type}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{acc.id}</div>
                                            <div style={{ marginTop: '0.25rem', color: 'var(--primary)', fontWeight: 700 }}>${acc.balance.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="stat-group" style={{ marginTop: '2rem' }}>
                                <div className="stat-label">System Identified Intent</div>
                                <div className="stat-value" style={{ padding: '0.5rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.25rem', fontSize: '0.85rem' }}>
                                    Escalation Requested
                                </div>
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div className="workspace" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                        <AlertCircle size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <h2>No Active Call Selected</h2>
                        <p>Select an escalation from the queue to start assisting</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
