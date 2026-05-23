window.initTurnstile = async () => {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        if (typeof turnstile !== 'undefined' && document.getElementById('turnstileWidgetContainer')) {
            turnstile.render('#turnstileWidgetContainer', {
                sitekey: config.turnstileSiteKey,
                theme: 'auto'
            });
        }
    } catch (error) {
        console.error('Turnstile rendering failed:', error.message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    const authOverlay = document.getElementById('authOverlay');
    const authForm = document.getElementById('authForm');
    const authError = document.getElementById('authError');
    const messageListContainer = document.getElementById('messageListContainer');
    const emptyStateContainer = document.getElementById('emptyStateContainer');
    const detailPaneContainer = document.getElementById('detailPaneContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const mobileBackBtn = document.getElementById('mobileBackBtn');
    
    let allMessages = [];
    let activeMessageId = null;

    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const getAuthHeader = () => {
        return sessionStorage.getItem('admin_token');
    };

    const formatRelativeTime = (timestamp) => {
        const diff = Date.now() - timestamp;
        const secs = Math.floor(diff / 1000);
        const mins = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);

        if (secs < 60) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const selectMessage = (msgId) => {
        activeMessageId = msgId;
        const msg = allMessages.find(m => m.id === msgId);
        if (!msg) return;

        document.querySelectorAll('.message-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-id') === msgId);
        });

        document.getElementById('detailSenderName').textContent = msg.name;
        const emailEl = document.getElementById('detailSenderEmail');
        emailEl.textContent = msg.email;
        emailEl.href = `mailto:${msg.email}`;
        document.getElementById('detailSentTime').textContent = new Date(msg.createdAt).toLocaleString();
        document.getElementById('detailBody').textContent = msg.message;

        emptyStateContainer.style.display = 'none';
        detailPaneContainer.style.display = 'flex';
        
        if (window.innerWidth <= 992) {
            detailPaneContainer.classList.add('active');
        }
    };

    const loadMessages = async () => {
        try {
            const token = getAuthHeader();
            if (!token) {
                authOverlay.style.display = 'flex';
                return;
            }

            const response = await fetch('/api/messages', {
                headers: {
                    'Authorization': token
                }
            });

            if (response.status === 401) {
                sessionStorage.removeItem('admin_token');
                authOverlay.style.display = 'flex';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load messages');
            }

            allMessages = await response.json();
            renderMessageList();
            authOverlay.style.display = 'none';
        } catch (error) {
            console.error('Error fetching messages:', error.message);
        }
    };

    const renderMessageList = () => {
        messageListContainer.innerHTML = '';
        if (allMessages.length === 0) {
            messageListContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No messages</div>';
            emptyStateContainer.style.display = 'flex';
            detailPaneContainer.style.display = 'none';
            return;
        }

        allMessages.forEach(msg => {
            const card = document.createElement('div');
            card.className = `message-card${activeMessageId === msg.id ? ' active' : ''}`;
            card.setAttribute('data-id', msg.id);
            
            const snippet = msg.message;
            const dateStr = formatRelativeTime(msg.createdAt);

            card.innerHTML = `
                <div class="card-header-row">
                    <span class="sender-name">${escapeHtml(msg.name)}</span>
                    <span class="sent-time">${escapeHtml(dateStr)}</span>
                </div>
                <div class="message-subject">${escapeHtml(msg.email)}</div>
                <div class="message-snippet">${escapeHtml(snippet)}</div>
            `;

            card.addEventListener('click', () => selectMessage(msg.id));
            messageListContainer.appendChild(card);
        });
    };

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        
        const user = document.getElementById('usernameInput').value;
        const pass = document.getElementById('passwordInput').value;
        const token = 'Basic ' + btoa(`${user}:${pass}`);
        const turnstileInput = document.querySelector('#authOverlay [name="cf-turnstile-response"]');
        const turnstileToken = turnstileInput ? turnstileInput.value : '';

        if (!turnstileToken) {
            authError.textContent = 'Please complete the security challenge.';
            return;
        }

        try {
            const response = await fetch('/api/messages', {
                headers: {
                    'Authorization': token,
                    'CF-Turnstile-Response': turnstileToken
                }
            });

            if (response.status === 401) {
                throw new Error('Invalid username or password.');
            }

            if (response.status === 400) {
                throw new Error('Security verification failed. Please try again.');
            }

            if (!response.ok) {
                throw new Error('Server connection error.');
            }

            sessionStorage.setItem('admin_token', token);
            allMessages = await response.json();
            renderMessageList();
            authOverlay.style.display = 'none';
            authForm.reset();
        } catch (err) {
            authError.textContent = err.message;
        } finally {
            if (typeof turnstile !== 'undefined') {
                turnstile.reset();
            }
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!activeMessageId) return;
        
        const confirmDelete = confirm('Are you sure you want to delete this message?');
        if (!confirmDelete) return;

        try {
            const response = await fetch('/api/messages', {
                method: 'DELETE',
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: activeMessageId })
            });

            if (!response.ok) {
                throw new Error('Failed to delete message');
            }

            allMessages = allMessages.filter(m => m.id !== activeMessageId);
            activeMessageId = null;
            renderMessageList();
            
            emptyStateContainer.style.display = 'flex';
            detailPaneContainer.style.display = 'none';
            detailPaneContainer.classList.remove('active');
        } catch (err) {
            alert(err.message);
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('admin_token');
        allMessages = [];
        activeMessageId = null;
        messageListContainer.innerHTML = '';
        emptyStateContainer.style.display = 'flex';
        detailPaneContainer.style.display = 'none';
        settingsPaneContainer.style.display = 'none';
        settingsPaneContainer.classList.remove('active');
        authOverlay.style.display = 'flex';
    });

    mobileBackBtn.addEventListener('click', () => {
        detailPaneContainer.classList.remove('active');
    });

    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    const settingsPaneContainer = document.getElementById('settingsPaneContainer');
    const settingsBackBtn = document.getElementById('settingsBackBtn');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordStatus = document.getElementById('changePasswordStatus');
    const createAdminForm = document.getElementById('createAdminForm');
    const createAdminStatus = document.getElementById('createAdminStatus');
    const superusersListContainer = document.getElementById('superusersListContainer');

    const getLoggedInUsername = () => {
        const token = getAuthHeader();
        if (!token) return '';
        try {
            const credentials = atob(token.split(' ')[1]);
            return credentials.split(':')[0];
        } catch (e) {
            return '';
        }
    };

    const loadSuperusers = async () => {
        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': getAuthHeader()
                }
            });
            if (!response.ok) throw new Error('Failed to load superusers');
            const users = await response.json();
            renderSuperusers(users);
        } catch (err) {
            console.error(err.message);
        }
    };

    const renderSuperusers = (users) => {
        superusersListContainer.innerHTML = '';
        const current = getLoggedInUsername();

        users.forEach(u => {
            const row = document.createElement('div');
            row.className = 'superuser-row';
            
            const info = document.createElement('div');
            info.className = 'superuser-info';
            info.innerHTML = `
                <span class="superuser-name">${escapeHtml(u.username)}</span>
                <span class="superuser-date">Added on ${new Date(u.createdAt).toLocaleDateString()}</span>
            `;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-mini-delete';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>';
            delBtn.disabled = (u.username === current);
            delBtn.title = (u.username === current) ? 'You cannot delete yourself' : 'Delete user';

            delBtn.addEventListener('click', async () => {
                const confirmDel = confirm(`Are you sure you want to delete administrator "${u.username}"?`);
                if (!confirmDel) return;

                try {
                    const response = await fetch('/api/users', {
                        method: 'DELETE',
                        headers: {
                            'Authorization': getAuthHeader(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username: u.username })
                    });
                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.error || 'Failed to delete user');
                    }
                    loadSuperusers();
                } catch (err) {
                    alert(err.message);
                }
            });

            row.appendChild(info);
            row.appendChild(delBtn);
            superusersListContainer.appendChild(row);
        });
        lucide.createIcons();
    };

    settingsToggleBtn.addEventListener('click', () => {
        activeMessageId = null;
        document.querySelectorAll('.message-card').forEach(card => card.classList.remove('active'));
        
        emptyStateContainer.style.display = 'none';
        detailPaneContainer.style.display = 'none';
        settingsPaneContainer.style.display = 'flex';

        if (window.innerWidth <= 992) {
            settingsPaneContainer.classList.add('active');
        }
        
        loadSuperusers();
    });

    settingsBackBtn.addEventListener('click', () => {
        settingsPaneContainer.classList.remove('active');
        settingsPaneContainer.style.display = 'none';
        emptyStateContainer.style.display = 'flex';
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        changePasswordStatus.textContent = '';
        changePasswordStatus.style.color = 'var(--text-primary)';

        const newPassword = document.getElementById('changePasswordInput').value;

        try {
            const response = await fetch('/api/users', {
                method: 'PUT',
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: newPassword })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update password');
            }

            changePasswordStatus.style.color = 'var(--primary)';
            changePasswordStatus.textContent = 'Password updated successfully! Logging out...';
            changePasswordForm.reset();

            setTimeout(() => {
                logoutBtn.click();
            }, 1500);
        } catch (err) {
            changePasswordStatus.style.color = 'var(--danger)';
            changePasswordStatus.textContent = err.message;
        }
    });

    createAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createAdminStatus.textContent = '';
        createAdminStatus.style.color = 'var(--text-primary)';

        const username = document.getElementById('newAdminUsername').value;
        const password = document.getElementById('newAdminPassword').value;

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create user');
            }

            createAdminStatus.style.color = 'var(--primary)';
            createAdminStatus.textContent = 'Administrator account created successfully!';
            createAdminForm.reset();
            loadSuperusers();
        } catch (err) {
            createAdminStatus.style.color = 'var(--danger)';
            createAdminStatus.textContent = err.message;
        }
    });

    loadMessages();
});
