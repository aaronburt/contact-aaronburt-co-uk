export async function onRequestPost(context) {
    try {
        const requestData = await context.request.json();
        const { name, email, message, turnstileToken } = requestData;
        
        if (!name || !email || !message || !turnstileToken) {
            return new Response(JSON.stringify({ error: 'All fields, including security challenge, are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const turnstileSecret = context.env.TURNSTILE_SECRET || '0x4AAAAAADSiXbjJPkUCfud2GNdPCSlZVu4';
        try {
            const formData = new FormData();
            formData.append('secret', turnstileSecret);
            formData.append('response', turnstileToken);
            formData.append('remoteip', context.request.headers.get('CF-Connecting-IP') || '');

            const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: formData
            });

            const outcome = await verifyResult.json();
            if (!outcome.success) {
                return new Response(JSON.stringify({ error: 'Security verification failed. Please try again.' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (verificationError) {
            throw new Error(`Turnstile verification connection failed: ${verificationError.message}`);
        }

        const id = crypto.randomUUID();
        const createdAt = Date.now();

        try {
            await context.env.DB.prepare(
                'INSERT INTO messages (id, name, email, message, createdAt) VALUES (?, ?, ?, ?, ?)'
            ).bind(id, name, email, message, createdAt).run();
        } catch (dbError) {
            throw new Error(`Database transaction failed: ${dbError.message}`);
        }

        const webhookUrl = context.env.WEBHOOK_URL;
        if (webhookUrl) {
            const chatPayload = {
                cards: [{
                    header: { title: 'New Contact Message', subtitle: new Date(createdAt).toUTCString() },
                    sections: [{
                        widgets: [
                            { keyValue: { topLabel: 'Name', content: name } },
                            { keyValue: { topLabel: 'Email', content: email } },
                            { textParagraph: { text: message } }
                        ]
                    }]
                }]
            };
            context.waitUntil(
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chatPayload)
                }).catch(() => {})
            );
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
