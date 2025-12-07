const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
console.log('Loading environment variables from:', envPath);

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split(/\r?\n/).forEach(line => {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || !line.trim()) {
            return;
        }

        // Parse KEY=VALUE
        const parts = line.match(/^([^=]+)=(.*)$/);
        if (parts) {
            const key = parts[1].trim();
            const value = parts[2].trim();
            // Don't overwrite existing env vars
            if (!process.env[key]) {
                process.env[key] = value;
                // Mask secret values in logs
                const logValue =
                    key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') ? '******' : value;
                console.log(`Set ${key}=${logValue}`);
            }
        }
    });
} else {
    console.warn('.env file not found');
}

// Run electron-builder
try {
    console.log('Starting electron-builder...');
    // Pass all arguments to electron-builder
    const args = process.argv.slice(2).join(' ');
    const command = `electron-builder ${args || '--win --x64'}`;

    execSync(command, {
        stdio: 'inherit',
        env: process.env // Explicitly pass the modified environment
    });
} catch (error) {
    console.error('Build failed');
    process.exit(1);
}
