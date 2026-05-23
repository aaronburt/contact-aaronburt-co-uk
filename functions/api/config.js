export async function onRequestGet(context) {
    try {
        return new Response(JSON.stringify({
            turnstileSiteKey: context.env.TURNSTILE_SITE_KEY || '0x4AAAAAADSiXQi4uE18ynxQ'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
