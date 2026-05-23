let turnstileWidgetId = null;

window.initTurnstile = async () => {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        if (typeof turnstile !== 'undefined' && document.getElementById('turnstileWidgetContainer')) {
            turnstileWidgetId = turnstile.render('#turnstileWidgetContainer', {
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
    
    const downloadBtn = document.getElementById('downloadVcardBtn');
    const contactForm = document.getElementById('contactForm');
    const formFeedback = document.getElementById('formFeedback');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            try {
                const vcardData = [
                    'BEGIN:VCARD',
                    'VERSION:3.0',
                    'N:Burt;Aaron;Micheal;;',
                    'FN:Aaron Micheal Burt',
                    'TITLE:Software Developer',
                    'EMAIL;TYPE=PREF,INTERNET:contact@aaronburt.co.uk',
                    'URL:https://aaronburt.co.uk',
                    'NOTE:Software Developer. Portfolio: aaronburt.co.uk',
                    'REV:' + new Date().toISOString(),
                    'END:VCARD'
                ].join('\r\n');

                const blob = new Blob([vcardData], { type: 'text/vcard;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Aaron_Micheal_Burt.vcf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                throw new Error(`Failed to generate and download vCard: ${error.message}`);
            }
        });
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Sending...</span>';
            
            try {
                const name = document.getElementById('nameInput').value;
                const email = document.getElementById('emailInput').value;
                const message = document.getElementById('messageInput').value;

                let turnstileToken = '';
                if (typeof turnstile !== 'undefined' && turnstileWidgetId !== null) {
                    turnstileToken = await new Promise((resolve, reject) => {
                        turnstile.execute(turnstileWidgetId, {
                            callback: (token) => resolve(token),
                            'error-callback': () => reject(new Error('Security verification failed. Please try again.'))
                        });
                    });
                }

                if (!turnstileToken) {
                    throw new Error('Please complete the security challenge.');
                }

                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message, turnstileToken })
                });

                const responseData = await response.json();

                if (!response.ok || responseData.error) {
                    throw new Error(responseData.error || 'Failed to submit form');
                }
                
                formFeedback.textContent = 'Message sent successfully! Thank you.';
                formFeedback.className = 'form-feedback success';
                formFeedback.classList.remove('hidden');
                
                contactForm.reset();
                
                setTimeout(() => {
                    formFeedback.classList.add('hidden');
                }, 5000);
            } catch (error) {
                formFeedback.textContent = error.message;
                formFeedback.className = 'form-feedback error';
                formFeedback.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
                if (typeof turnstile !== 'undefined') {
                    turnstile.reset();
                }
                lucide.createIcons();
            }
        });
    }

    const privacyBadge = document.querySelector('.privacy-badge');
    if (privacyBadge) {
        privacyBadge.classList.add('expanded');
        setTimeout(() => {
            privacyBadge.classList.remove('expanded');
        }, 5000);
    }
});
