#!/bin/bash
# TCP-MD5 诊断脚本 - Ubuntu

echo "========================================="
echo "TCP-MD5 连接诊断工具"
echo "========================================="
echo ""

# 1. 检查操作系统
echo "[1] 操作系统信息:"
cat /etc/os-release | grep -E "PRETTY_NAME|VERSION"
echo ""

# 2. 检查内核 TCP-MD5 支持
echo "[2] 内核 TCP-MD5 支持:"
if grep -q "CONFIG_TCP_MD5SIG=y" /boot/config-$(uname -r) 2>/dev/null; then
    echo "✓ 内核支持 TCP-MD5"
else
    echo "✗ 内核不支持 TCP-MD5 或配置文件不存在"
    echo "  尝试检查模块:"
    lsmod | grep tcp || echo "  未找到 TCP 相关模块"
fi
echo ""

# 3. 检查编译工具
echo "[3] 编译工具检查:"
if command -v gcc &> /dev/null; then
    echo "✓ GCC 已安装: $(gcc --version | head -n1)"
else
    echo "✗ GCC 未安装"
    echo "  安装命令: sudo apt-get install build-essential"
fi
echo ""

# 4. 检查 TCP-MD5 代理进程
echo "[4] TCP-MD5 代理进程:"
if pgrep -f "tcp-md5-helper" > /dev/null; then
    echo "✓ 代理进程正在运行:"
    ps aux | grep tcp-md5-helper | grep -v grep
else
    echo "✗ 代理进程未运行"
fi
echo ""

# 5. 检查日志文件
echo "[5] 最近的日志 (最后20行):"
if [ -f /tmp/tcp-md5-proxy-bmp.log ]; then
    tail -20 /tmp/tcp-md5-proxy-bmp.log
else
    echo "  日志文件不存在: /tmp/tcp-md5-proxy-bmp.log"
fi
echo ""

# 6. 检查监听端口
echo "[6] 监听端口检查:"
netstat -tlnp 2>/dev/null | grep -E "179|11020" || ss -tlnp | grep -E "179|11020" || echo "  未找到监听端口"
echo ""

# 7. 检查防火墙
echo "[7] 防火墙状态:"
if command -v ufw &> /dev/null; then
    sudo ufw status
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --state
else
    echo "  未检测到防火墙管理工具"
fi
echo ""

# 8. 检查 SELinux (通常 Ubuntu 不启用)
echo "[8] SELinux 状态:"
if command -v getenforce &> /dev/null; then
    getenforce
else
    echo "  SELinux 未安装 (Ubuntu 默认)"
fi
echo ""

echo "========================================="
echo "诊断完成"
echo "========================================="
