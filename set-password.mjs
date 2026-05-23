import { createInterface } from 'node:readline/promises';
import { randomBytes, createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const MIN_PASSWORD_LENGTH = 6;
const DATABASE_NAME = 'contact-db';

function hashPassword(password, salt) {
    return createHash('sha256').update(password + salt).digest('hex');
}

async function promptPassword() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const password = await rl.question('Enter new admin password: ');
        if (!password || password.trim().length < MIN_PASSWORD_LENGTH) {
            throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        return password.trim();
    } finally {
        rl.close();
    }
}

function updateRemoteDatabase(passwordHash, salt) {
    const sql = `UPDATE superusers SET passwordHash = '${passwordHash}', salt = '${salt}' WHERE username = 'admin';`;
    execSync(`npx wrangler d1 execute ${DATABASE_NAME} --remote --command "${sql}"`, { stdio: 'inherit' });
}

try {
    const password = await promptPassword();
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    console.log('\nUpdating production database...');
    updateRemoteDatabase(passwordHash, salt);
    console.log('Admin password updated successfully.');
} catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
}
