const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const giteeOnly = args.includes('--gitee-only');
const showHelp = args.includes('--help') || args.includes('-h');

// Show help
if (showHelp) {
    console.log(`
NetNexus Release Script

Usage: node release.js [options]

Options:
  --help, -h          显示帮助信息
  --gitee-only        只发布到 Gitee（不编译，需要先有 tag 和 dist 文件）

Examples:
  node release.js                    # 编译并发布到 GitHub 和 Gitee（默认）
  node release.js --gitee-only       # 只发布到 Gitee（不编译）
`);
    process.exit(0);
}

if (giteeOnly) {
    console.log('\n📦 NetNexus Release Script - Gitee Only Mode');
} else {
    console.log('\n📦 NetNexus Release Script - Full Release Mode');
}

// Load .env file
const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split(/\r?\n/).forEach(line => {
        if (line.trim().startsWith('#') || !line.trim()) {
            return;
        }

        const parts = line.match(/^([^=]+)=(.*)$/);
        if (parts) {
            const key = parts[1].trim();
            const value = parts[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
                const logValue =
                    key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') ? '******' : value;
                console.log(`Set ${key}=${logValue}`);
            }
        }
    });
}

// Function to create Gitee release
async function createGiteeRelease() {
    const giteeToken = process.env.GITEE_TOKEN;

    if (!giteeToken) {
        console.log('\n⚠️  GITEE_TOKEN not found, skipping Gitee release');
        console.log('To enable Gitee release, add GITEE_TOKEN to your .env file');
        return;
    }

    // Get current git tag
    let currentTag;
    try {
        currentTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
    } catch (error) {
        console.log('\n⚠️  No git tag found, skipping Gitee release');
        return;
    }

    console.log(`\n📦 Creating Gitee release for tag: ${currentTag}`);

    // Step 1: Create release
    const releaseId = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
            access_token: giteeToken,
            tag_name: currentTag,
            name: `NetNexus ${currentTag}`,
            body: `自动发布 ${currentTag}\n\n通过自动构建和发布。`,
            prerelease: false,
            target_commitish: 'master'
        });

        const options = {
            hostname: 'gitee.com',
            path: '/api/v5/repos/muping18/NetNexus/releases',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, res => {
            let body = '';
            res.on('data', chunk => (body += chunk));
            res.on('end', () => {
                if (res.statusCode === 201) {
                    const result = JSON.parse(body);
                    console.log('✅ Gitee release created successfully');
                    console.log('   View at: https://gitee.com/muping18/NetNexus/releases');
                    resolve(result.id);
                } else {
                    console.log(`⚠️  Gitee release response (${res.statusCode}):`, body);
                    resolve(null);
                }
            });
        });

        req.on('error', error => {
            console.error('❌ Gitee release failed:', error.message);
            resolve(null);
        });

        req.write(data);
        req.end();
    });

    if (!releaseId) {
        return;
    }

    // Step 2: Upload files
    const distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
        console.log('⚠️  dist directory not found, skipping file upload');
        return;
    }

    const files = fs
        .readdirSync(distPath)
        .filter(
            file =>
                file.endsWith('.exe') ||
                file.endsWith('.zip') ||
                file.endsWith('.dmg') ||
                file.endsWith('.msi') ||
                file.endsWith('.AppImage')
        );

    if (files.length === 0) {
        console.log('⚠️  No installation files found in dist directory');
        return;
    }

    console.log(`\n📤 Uploading ${files.length} file(s) to Gitee release...`);

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (Gitee limit)
    let uploadedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
        const filePath = path.join(distPath, file);
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        // Check file size
        if (fileStats.size > MAX_FILE_SIZE) {
            console.log(`   ⚠️  Skipped: ${file} (${fileSizeMB} MB - exceeds Gitee 100 MB limit)`);
            skippedCount++;
            continue;
        }

        const fileContent = fs.readFileSync(filePath);

        await new Promise(resolve => {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('access_token', giteeToken);
            form.append('file', fileContent, file);

            const req = https.request(
                {
                    hostname: 'gitee.com',
                    path: `/api/v5/repos/muping18/NetNexus/releases/${releaseId}/attach_files`,
                    method: 'POST',
                    headers: form.getHeaders()
                },
                res => {
                    let body = '';
                    res.on('data', chunk => (body += chunk));
                    res.on('end', () => {
                        if (res.statusCode === 201) {
                            console.log(`   ✅ Uploaded: ${file} (${fileSizeMB} MB)`);
                            uploadedCount++;
                        } else {
                            console.log(`   ⚠️  Failed to upload ${file}: ${body}`);
                            skippedCount++;
                        }
                        resolve();
                    });
                }
            );

            req.on('error', error => {
                console.error(`   ❌ Upload error for ${file}:`, error.message);
                skippedCount++;
                resolve();
            });

            form.pipe(req);
        });
    }

    console.log(`\n✅ Gitee release completed: ${uploadedCount} uploaded, ${skippedCount} skipped`);
    if (skippedCount > 0) {
        console.log('💡 Tip: Large files (>100 MB) cannot be uploaded to Gitee due to platform limits');
        console.log('   Consider using GitHub Releases for large files or compressing them');
    }
}

// Run electron-builder
async function build() {
    try {
        if (giteeOnly) {
            // Gitee only mode: 只发布到 Gitee，不编译
            console.log('\n⏭️  Skipping build (Gitee only mode)');
            await createGiteeRelease();
        } else {
            // 默认模式：编译并发布到 GitHub 和 Gitee
            console.log('\n🔨 Starting electron-builder...');

            // Filter out our custom arguments
            const builderArgs = args
                .filter(arg => arg !== '--gitee-only' && arg !== '--help' && arg !== '-h')
                .join(' ');

            const command = `electron-builder ${builderArgs || '--win --x64'}`;

            execSync(command, {
                stdio: 'inherit',
                env: process.env
            });

            console.log('\n✅ Build completed successfully');

            // GitHub release (handled by electron-builder if GH_TOKEN is set)
            if (process.env.GH_TOKEN) {
                console.log('✅ GitHub release created by electron-builder');
            } else {
                console.log('⚠️  GH_TOKEN not found, GitHub release skipped');
            }

            // Gitee release
            await createGiteeRelease();
        }

        console.log('\n🎉 Release process completed!\n');
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        process.exit(1);
    }
}

build();
