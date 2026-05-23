async function authenticate(context) {
    try {
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return false;
        }

        const base64Credentials = authHeader.split(' ')[1];
        const credentials = atob(base64Credentials);
        const [username, password] = credentials.split(':');

        let superuser;
        try {
            superuser = await context.env.DB.prepare(
                'SELECT * FROM superusers WHERE username = ?'
            ).bind(username).first();
        } catch (dbError) {
            throw new Error(`Database lookup for superuser failed: ${dbError.message}`);
        }

        if (!superuser) {
            return false;
        }

        let passwordHash;
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + superuser.salt);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (cryptoError) {
            throw new Error(`Password hashing failed: ${cryptoError.message}`);
        }

        return passwordHash === superuser.passwordHash;
    } catch (error) {
        throw new Error(`Authentication process failed: ${error.message}`);
    }
}

async function verifyTurnstile(context, token) {
    try {
        const secretKey = context.env.TURNSTILE_SECRET || '0x4AAAAAADSiXbjJPkUCfud2GNdPCSlZVu4';
        const verifyFormData = new FormData();
        verifyFormData.append('secret', secretKey);
        verifyFormData.append('response', token);
        verifyFormData.append('remoteip', context.request.headers.get('CF-Connecting-IP') || '');

        const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: verifyFormData
        });

        const outcome = await verifyResult.json();
        return outcome.success;
    } catch (error) {
        throw new Error(`Turnstile verification failed: ${error.message}`);
    }
}

export async function onRequestGet(context) {
    try {
        const authenticated = await authenticate(context);
        if (!authenticated) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="Admin Inbox"' }
            });
        }

        const turnstileToken = context.request.headers.get('CF-Turnstile-Response');
        if (turnstileToken) {
            const isVerified = await verifyTurnstile(context, turnstileToken);
            if (!isVerified) {
                return new Response(JSON.stringify({ error: 'Security verification failed' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        let messages;
        try {
            messages = await context.env.DB.prepare(
                'SELECT * FROM messages ORDER BY createdAt DESC'
            ).all();
        } catch (dbError) {
            throw new Error(`Database query failed: ${dbError.message}`);
        }

        return new Response(JSON.stringify(messages.results), {
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
        const authenticated = await authenticate(context);
        if (!authenticated) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="Admin Inbox"' }
            });
        }

        let requestData;
        try {
            requestData = await context.request.json();
        } catch (jsonError) {
            throw new Error(`Invalid JSON payload: ${jsonError.message}`);
        }

        const { id } = requestData;
        if (!id) {
            return new Response(JSON.stringify({ error: 'Message ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        try {
            await context.env.DB.prepare(
                'DELETE FROM messages WHERE id = ?'
            ).bind(id).run();
        } catch (dbError) {
            throw new Error(`Database deletion failed: ${dbError.message}`);
        }

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
