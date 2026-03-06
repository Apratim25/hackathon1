const { io } = require('socket.io-client');

const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('Connected to backend simulation! Sending request_agent event.');
    socket.emit('request_agent', {
        user: { id: 'test', name: 'Test User', accounts: [{ id: '123', type: 'Checking', balance: 50 }] },
        history: [{ sender: 'user', text: 'I need an agent' }, { sender: 'ai', text: 'Escalating now.' }]
    });

    setTimeout(() => {
        console.log('Test complete.');
        process.exit();
    }, 2000);
});
