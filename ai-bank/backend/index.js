const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const { users } = require('./mockData');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
});

const JWT_SECRET = 'super-secret-key-for-hackathon';

// Mock Authentication
app.post('/api/auth/login', (req, res) => {
    const { id, pin } = req.body;
    const user = users.find((u) => u.id === id && u.pin === pin);

    if (user) {
        const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { name: user.name, accounts: user.accounts } });
    } else {
        res.status(401).json({ error: 'Invalid ID or PIN' });
    }
});

// Helper for intent logic (Mock Gen-AI)
// In a real scenario, this would call an LLM API to determine intent.
function determineIntent(query, user) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('balance') || lowerQuery.includes('how much')) {
        const total = user.accounts.reduce((sum, acc) => sum + acc.balance, 0);
        return `Your total balance across all accounts is $${total.toFixed(2)}.`;
    }

    if (lowerQuery.includes('transfer') || lowerQuery.includes('send')) {
        return `You want to make a transfer. Please specify the amount and the recipient. (This is a mocked response)`;
    }

    if (lowerQuery.includes('agent') || lowerQuery.includes('human') || lowerQuery.includes('help')) {
        return `I am escalating this to a human agent now. Please wait...`;
    }

    return `I can help you with your banking needs. Would you like to check your balance, make a transfer, or speak to an agent?`;
}

// Conversation Endpoint
app.post('/api/chat', (req, res) => {
    console.log('Received chat request:', req.body);
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.log('Missing auth header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            console.log('User not found in mock DB');
            return res.status(401).json({ error: 'User not found' });
        }

        const { message } = req.body;
        console.log('Processing message:', message);

        const aiResponse = determineIntent(message, user);
        console.log('Generated response:', aiResponse);

        res.json({ reply: aiResponse, intent: aiResponse.includes('escalating') ? 'escalate' : 'general' });
    } catch (err) {
        console.error('Error processing chat:', err);
        res.status(401).json({ error: 'Invalid Token' });
    }
});

// Agent Escalation via Socket
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('request_agent', (data) => {
        // data contains conversation history and user info
        console.log('Escalation requested for user:', data.user?.name);
        // Broadcast to agent dashboard
        io.emit('agent_escalation', {
            clientId: socket.id,
            user: data.user,
            history: data.history
        });
    });

    socket.on('agent_reply', (data) => {
        // Agent sending back message to specific client
        io.to(data.clientId).emit('agent_message', { message: data.message });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
