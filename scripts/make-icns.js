/**
 * macOS 图标生成脚本
 *
 * 此脚本用于从 PNG 图像生成 macOS 所需的 .icns 图标文件
 * 需要在 macOS 上运行，使用系统自带的 iconutil 工具
 *
 * 用法: node scripts/make-icns.js [源PNG文件] [输出icns文件]
 *
 * 示例:
 *   node scripts/make-icns.js electron/assets/logo.png electron/assets/icon.icns
 *
 * 如果不提供参数，将使用默认路径
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// 默认路径
const DEFAULT_SOURCE = path.join(__dirname, '..', 'electron', 'assets', 'logo.png');
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'electron', 'assets', 'icon.icns');

// 解析命令行参数
const args = process.argv.slice(2);
const sourcePng = args[0] ? path.resolve(args[0]) : DEFAULT_SOURCE;
const outputIcns = args[1] ? path.resolve(args[1]) : DEFAULT_OUTPUT;

// 检查是否在 macOS 上运行
if (process.platform !== 'darwin') {
    console.error('Error: This script only works on macOS');
    console.error('To generate .icns on other platforms, please use online tools or install ImageMagick');
    process.exit(1);
}

// 检查源文件是否存在
if (!fs.existsSync(sourcePng)) {
    console.error(`Error: Source file not found: ${sourcePng}`);
    process.exit(1);
}

// 检查是否有 sips 和 iconutil 命令
try {
    execSync('which sips', { stdio: 'ignore' });
    execSync('which iconutil', { stdio: 'ignore' });
} catch {
    console.error('Error: sips or iconutil not found. These are macOS system tools.');
    process.exit(1);
}

console.log('Creating macOS icon...');
console.log(`Source: ${sourcePng}`);
console.log(`Output: ${outputIcns}`);

// 创建临时 iconset 目录
const tempDir = path.join(__dirname, 'temp_iconset');
const iconsetDir = path.join(tempDir, 'icon.iconset');

// 清理并创建目录
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
}
fs.mkdirSync(iconsetDir, { recursive: true });

// 需要生成的图标尺寸
const sizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' }
];

try {
    // 使用 sips 生成各种尺寸的图标
    console.log('Generating icon sizes...');
    for (const { size, name } of sizes) {
        const outputPath = path.join(iconsetDir, name);
        const result = spawnSync('sips', ['-z', String(size), String(size), sourcePng, '--out', outputPath], {
            stdio: 'pipe'
        });

        if (result.status !== 0) {
            throw new Error(`Failed to generate ${name}: ${result.stderr?.toString()}`);
        }
        console.log(`  Created: ${name} (${size}x${size})`);
    }

    // 使用 iconutil 生成 .icns 文件
    console.log('Creating .icns file...');
    const result = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcns], {
        stdio: 'pipe'
    });

    if (result.status !== 0) {
        throw new Error(`Failed to create icns: ${result.stderr?.toString()}`);
    }

    console.log(`\nSuccess! Icon created: ${outputIcns}`);
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
} finally {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }
}
