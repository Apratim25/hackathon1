import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, LogOut, Banknote, ShieldAlert, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

// Web Speech API interfaces
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [idInput, setIdInput] = useState('');
    const [pinInput, setPinInput] = useState('');

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    const [socket, setSocket] = useState(null);
    const [recognition, setRecognition] = useState(null);
    const [escalated, setEscalated] = useState(false);

    const chatEndRef = useRef(null);
    const silenceTimer = useRef(null); // Ref to track the silence timeout
    const currentTranscript = useRef(''); // Ref to track ongoing speech

    // Maintain fresh refs for the speech API closure
    const userRef = useRef(user);
    const messagesRef = useRef(messages);

    useEffect(() => {
        userRef.current = user;
        messagesRef.current = messages;
    }, [user, messages]);

    // Initialize Socket & Speech Rec
    useEffect(() => {
        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);

        if (SpeechRecognition) {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';
            rec.maxAlternatives = 1;

            rec.onstart = () => {
                setIsListening(true);
                currentTranscript.current = '';
                console.log('Voice listening started');
            };

            rec.onend = () => {
                setIsListening(false);
                console.log('Voice listening ended. Final transcript buffer:', currentTranscript.current);
            };

            rec.onresult = (event) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                const latestText = final || interim;
                if (!latestText.trim()) return;

                currentTranscript.current = latestText;
            };

            setRecognition(rec);
        }

        return () => newSocket.close();
    }, []);

    // Listen for agent messages
    useEffect(() => {
        if (!socket) return;

        socket.on('agent_message', (data) => {
            setIsTyping(false);
            addMessage('agent', data.message);
            speak(data.message);
        });

        return () => {
            socket.off('agent_message');
        };
    }, [socket]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const speak = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    const addMessage = (sender, text) => {
        setMessages(prev => [...prev, { id: Date.now(), sender, text }]);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: idInput, pin: pinInput })
            });
            const data = await res.json();
            if (res.ok) {
                setToken(data.token);
                setUser(data.user);
                addMessage('ai', `Welcome to Nexa Bank, ${data.user.name}. How can I assist you today?`);
                speak(`Welcome to Nexa Bank, ${data.user.name}. How can I assist you today?`);
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to connect to backend");
        }
    };

    const handlePointerDown = () => {
        if (!recognition) return;
        currentTranscript.current = '';
        try { recognition.start(); } catch (e) { console.log(e); }
    };

    const handlePointerUp = () => {
        if (!recognition) return;
        recognition.stop();
        if (currentTranscript.current.trim()) {
            handleSendMessage(currentTranscript.current, userRef.current, messagesRef.current);
            currentTranscript.current = '';
        }
    };

    // passing down latestUser from refs optionally, fallback to current state if not via voice
    const handleSendMessage = async (textOverride, latestUser = user, latestMessages = messages) => {
        const msg = textOverride || inputText;
        if (!msg.trim()) return;

        addMessage('user', msg);
        setInputText('');
        setIsTyping(true);

        if (escalated) {
            // Send directly to agent via socket
            socket.emit('agent_reply', { clientId: socket.id, message: msg }); // Mock agent flow handling
            setIsTyping(false);
            return;
        }

        try {
            const cleanMessage = msg.toString().trim();
            const res = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: cleanMessage })
            });
            const data = await res.json();

            setIsTyping(false);

            if (!res.ok) {
                console.error('Backend returned error:', res.status, data);
                addMessage('ai', `Error: ${data.error || 'Server rejected request'}`);
                speak('Sorry, I am having trouble understanding that.');
                return;
            }

            if (!data.reply) {
                console.error('Backend returned empty reply:', data);
                addMessage('ai', 'Error: Received empty response from server.');
                return;
            }

            addMessage('ai', data.reply);
            speak(data.reply);

            if (data.intent === 'escalate') {
                setEscalated(true);
                socket.emit('request_agent', {
                    user: latestUser,
                    history: [...latestMessages, { sender: 'user', text: msg }, { sender: 'ai', text: data.reply }]
                });
            }
        } catch (err) {
            console.error(err);
            setIsTyping(false);
            addMessage('ai', 'Sorry, I am having trouble connecting to the network right now.');
        }
    };

    const handleLogout = () => {
        setUser(null);
        setToken(null);
        setMessages([]);
        setEscalated(false);
        setIdInput('');
        setPinInput('');
    };

    if (!user) {
        return (
            <div className="kiosk-container">
                <header className="header">
                    <div className="logo"><Cpu size={32} /> Nexa Bank Kiosk</div>
                </header>
                <div className="glass-panel auth-form">
                    <h2>Welcome to Nexa Bank</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Please insert your card or enter your ID below.</p>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Customer ID (e.g. user1)"
                            value={idInput}
                            onChange={e => setIdInput(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            className="input-field"
                            placeholder="PIN (e.g. 1234)"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary">Login</button>
                    </form>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                        Use user1/1234 or user2/4321 to test
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="kiosk-container">
            <header className="header">
                <div className="logo"><Cpu size={32} /> Nexa Bank</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {escalated && <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <ShieldAlert size={20} /> Agent Connected
                    </div>}
                    <div style={{ color: 'var(--text-secondary)' }}>{user.name}</div>
                    <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                {user.accounts.map(acc => (
                    <div key={acc.id} className="account-card">
                        <h3>{acc.type} Account</h3>
                        <div className="balance">${acc.balance.toFixed(2)}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>**** **** **** {acc.id.replace('acc', '456')}</div>
                    </div>
                ))}
            </div>

            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="chat-container">
                    {messages.map(m => (
                        <div key={m.id} className={`message ${m.sender === 'user' ? 'message-user' : 'message-ai'}`}>
                            {m.text}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="typing-indicator">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="controls-area">
                    <button
                        className={`mic-btn ${isListening ? 'listening' : ''}`}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        title="Hold to speak"
                        style={{ userSelect: 'none', touchAction: 'none' }}
                    >
                        {isListening ? <Mic size={24} /> : <MicOff size={24} />}
                    </button>

                    <input
                        type="text"
                        className="input-field"
                        placeholder="Type your question..."
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                        style={{ flex: 1 }}
                    />

                    <button onClick={() => handleSendMessage()} className="btn btn-primary" style={{ padding: '1rem' }}>
                        <Send size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;
