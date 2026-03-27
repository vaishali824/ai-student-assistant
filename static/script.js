document.addEventListener('DOMContentLoaded', async () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const downloadPdfBtn = document.getElementById('download-pdf');
    const micBtn = document.getElementById('mic-button');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const deleteAllBtn = document.getElementById('delete-all-btn');

    // Sidebar elements
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const newChatBtn = document.getElementById('new-chat-btn');
    const historyList = document.getElementById('history-list');

    // Make sure we auto-focus the input box when the page loads
    userInput.focus();

    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerHTML = '<i data-feather="sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggleBtn.innerHTML = '<i data-feather="moon"></i>';
    }
    
    // Ensure the icon renders immediately on page refresh
    if (window.feather) {
        feather.replace();
    }
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        themeToggleBtn.innerHTML = theme === 'dark' ? '<i data-feather="sun"></i>' : '<i data-feather="moon"></i>';
        localStorage.setItem('theme', theme);
        if (window.feather) feather.replace();
    });

    // Sidebar Toggle
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // --- Session Management via DB ---
    let sessions = [];
    let currentSessionId = null;

    async function fetchHistory() {
        try {
            const resp = await fetch('/history');
            if (resp.ok) {
                const data = await resp.json();
                sessions = data.sessions || [];
            } else if (resp.status === 401) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    // Force load history asynchronously from secure DB
    await fetchHistory();

    if (sessions.length === 0) {
        createNewSessionLocally();
    } else {
        // Last active session isn't saved in DB schema locally, so just picking the first one natively
        currentSessionId = sessions[0].id; 
    }

    function createNewSessionLocally() {
        const newSession = {
            id: Date.now().toString(), // Use string ID locally until DB overwrites or binds
            title: 'New Chat',
            messages: []
        };
        sessions.unshift(newSession); 
        currentSessionId = newSession.id;
        renderSidebar();
        loadChatHistory();
        if (window.innerWidth <= 800) sidebar.classList.add('collapsed');
    }

    function getCurrentSession() {
        return sessions.find(s => s.id == currentSessionId);
    }

    function renderSidebar() {
        historyList.innerHTML = '';
        sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `history-item ${session.id == currentSessionId ? 'active' : ''}`;
            div.textContent = session.title;
            div.title = session.title; 
            div.onclick = () => {
                currentSessionId = session.id;
                renderSidebar();
                loadChatHistory();
                if (window.innerWidth <= 800) sidebar.classList.add('collapsed');
            };
            historyList.appendChild(div);
        });
    }

    newChatBtn.addEventListener('click', createNewSessionLocally);

    // Initialize chat UI on load
    function loadChatHistory() {
        chatBox.innerHTML = '';
        const session = getCurrentSession();
        if (session && session.messages.length > 0) {
            session.messages.forEach(msg => {
                appendMessage(msg.role === 'user' ? 'user-message' : 'bot-message', msg.content, false);
            });
            scrollToBottom();
        } else {
            // Default welcome message for an empty chat
            const div = document.createElement('div');
            div.className = 'message bot-message';
            div.innerHTML = `<div class="message-content">Hello! I'm your AI Student Assistant. How can I help you with your studies today?</div>`;
            chatBox.appendChild(div);
        }
    }

    renderSidebar();
    loadChatHistory();

    // Listen for 'Enter' key presses
    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Listen for button clicks
    sendButton.addEventListener('click', sendMessage);

    // Chat deletion handlers
    clearChatBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;
        
        // Optimistic UI clear
        chatBox.innerHTML = '';
        
        try {
            await fetch('/delete_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId })
            });

            const sessionIndex = sessions.findIndex(s => s.id == currentSessionId);
            if (sessionIndex !== -1) {
                sessions.splice(sessionIndex, 1);
            }
            if (sessions.length > 0) {
                currentSessionId = sessions[0].id;
                renderSidebar();
                loadChatHistory();
            } else {
                createNewSessionLocally();
            }
        } catch (e) { console.error('Failed to clear chat', e); }
    });

    deleteAllBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to permanently delete ALL your chat history?")) {
            try {
                await fetch('/delete_all', { method: 'POST' });
                sessions = [];
                createNewSessionLocally();
            } catch (e) { console.error('Failed to delete all chats', e); }
        }
    });

    async function sendMessage() {
        const messageText = userInput.value.trim();
        if (messageText === '') return;

        const session = getCurrentSession();

        // 1. Auto-generate title if this is the first message locally
        if (session.messages.length === 0) {
            session.title = messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '');
            renderSidebar();
        }

        // 2. Add to local state (DB saves it on backend via POST)
        session.messages.push({ role: 'user', content: messageText });

        // 3. Display user's message
        appendMessage('user-message', messageText);
        userInput.value = '';
        
        userInput.disabled = true;
        sendButton.disabled = true;

        const loadingId = showLoading();

        try {
            const mode = document.getElementById("mode").value;
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    history: session.messages, 
                    mode: mode,
                    session_id: session.id
                })
            });

            const data = await response.json();
            removeLoading(loadingId);

            if (response.ok) {
                session.messages.push({ role: 'assistant', content: data.response });
                appendMessage('bot-message', data.response);
            } else if (response.status === 401) {
                window.location.href = '/login';
            } else {
                appendMessage('bot-message', `Error: ${data.error || 'Something went wrong.'}`);
            }
        } catch (error) {
            removeLoading(loadingId);
            appendMessage('bot-message', 'Error: Unable to connect to the server. Please ensure the server is running.');
            console.error('Fetch error:', error);
        } finally {
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }

    function appendMessage(className, text, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(contentDiv);
        chatBox.appendChild(messageDiv);

        if (animate && className.includes('bot-message')) {
            let i = 0;
            const typingSpeed = 15; 
            const typeInterval = setInterval(() => {
                if (i < text.length) {
                    contentDiv.textContent += text.charAt(i);
                    i++;
                    scrollToBottom();
                } else {
                    clearInterval(typeInterval);
                }
            }, typingSpeed);
        } else {
            contentDiv.textContent = text;
            scrollToBottom();
        }
    }

    function showLoading() {
        const loadingId = 'loading-' + Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        messageDiv.id = loadingId;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="loading">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        messageDiv.appendChild(contentDiv);
        chatBox.appendChild(messageDiv);
        scrollToBottom();
        return loadingId;
    }

    function removeLoading(id) {
        const loadingElement = document.getElementById(id);
        if (loadingElement) loadingElement.remove();
    }

    function scrollToBottom() {
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }

    // Download PDF logic
    downloadPdfBtn.addEventListener('click', () => {
        const element = document.getElementById('chat-box');
        const opt = {
            margin:       0.5,
            filename:     'AI_Student_Assistant_Chat.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // Voice Input logic (Web Speech API)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        micBtn.addEventListener('click', () => {
            micBtn.classList.add('recording');
            micBtn.innerHTML = '<i data-feather="radio"></i>';
            if (window.feather) feather.replace();
            recognition.start();
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value += transcript;
        };

        recognition.onspeechend = () => recognition.stop();
        recognition.onend = () => {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '<i data-feather="mic"></i>';
            if (window.feather) feather.replace();
        };
    } else {
        micBtn.style.display = 'none'; // Hide if not supported
    }
});
