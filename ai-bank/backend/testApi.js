const BACKEND_URL = 'http://localhost:3001';

async function test() {
    console.log('Logging in...');
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'user1', pin: '1234' })
    });

    if (!loginRes.ok) {
        console.log('Login failed', loginRes.status);
        return;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('Logged in, token:', token);

    console.log('Sending message...');
    try {
        const chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message: "what is my balance" })
        });

        console.log('Chat status:', chatRes.status);
        const chatData = await chatRes.json();
        console.log('Chat response:', chatData);
    } catch (err) {
        console.log('Chat fetch failed:', err);
    }
}

test();
