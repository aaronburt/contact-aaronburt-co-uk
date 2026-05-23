async function authenticate(context) {
    try {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return null;
        }
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = atob(base64Credentials);
        const [username, password] = credentials.split(':');

        const superuser = await context.env.DB.prepare(
            'SELECT * FROM superusers WHERE username = ?'
        ).bind(username).first();

        if (!superuser) {
            return null;
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(password + superuser.salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (passwordHash !== superuser.passwordHash) {
            return null;
        }

        return username;
    } catch (e) {
        return null;
    }
}

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
    try {
        const currentUsername = await authenticate(context);
        if (!currentUsername) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const superusers = await context.env.DB.prepare(
            'SELECT username, createdAt FROM superusers ORDER BY username ASC'
        ).all();

        return new Response(JSON.stringify(superusers.results), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    try {
        const currentUsername = await authenticate(context);
        if (!currentUsername) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestData = await context.request.json();
        const { username, password } = requestData;

        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Username and password are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const trimmedUsername = username.trim().toLowerCase();
        if (trimmedUsername.length < 3) {
            return new Response(JSON.stringify({ error: 'Username must be at least 3 characters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const existing = await context.env.DB.prepare(
            'SELECT username FROM superusers WHERE username = ?'
        ).bind(trimmedUsername).first();

        if (existing) {
            return new Response(JSON.stringify({ error: 'Username already exists' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);

        await context.env.DB.prepare(
            'INSERT INTO superusers (username, passwordHash, salt, createdAt) VALUES (?, ?, ?, ?)'
        ).bind(trimmedUsername, passwordHash, salt, Date.now()).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPut(context) {
    try {
        const currentUsername = await authenticate(context);
        if (!currentUsername) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestData = await context.request.json();
        const { password } = requestData;

        if (!password || password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);

        await context.env.DB.prepare(
            'UPDATE superusers SET passwordHash = ?, salt = ? WHERE username = ?'
        ).bind(passwordHash, salt, currentUsername).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestDelete(context) {
    try {
        const currentUsername = await authenticate(context);
        if (!currentUsername) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const requestData = await context.request.json();
        const { username } = requestData;

        if (!username) {
            return new Response(JSON.stringify({ error: 'Username to delete is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const targetUsername = username.trim().toLowerCase();
        if (targetUsername === currentUsername) {
            return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        await context.env.DB.prepare(
            'DELETE FROM superusers WHERE username = ?'
        ).bind(targetUsername).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
