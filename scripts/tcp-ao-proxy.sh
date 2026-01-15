#!/bin/bash
# TCP-AO Proxy Script - Multi-Protocol Support with Keychain
# Supports BMP, BGP, RPKI with seamless key rotation

PROTOCOL=$1      # bmp, bgp, rpki
PEER_IP=$2
KEYS_JSON=$3     # JSON array of keys
LISTEN_PORT=$4
FORWARD_ADDR=$5

PROXY_DIR="/opt/tcp-ao-proxy"
PID_FILE="/tmp/tcp-ao-proxy-${PROTOCOL}.pid"
LOG_FILE="/tmp/tcp-ao-proxy-${PROTOCOL}.log"
HELPER_BIN="$PROXY_DIR/tcp-ao-helper"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}


# 启动代理
start_proxy() {
    log "Starting TCP-AO proxy for $PROTOCOL..."
    
    # 检查是否已运行
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            log "Proxy already running with PID $PID"
            return 0
        else
            log "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi
    
    # 启动 helper
    log "Starting helper: $HELPER_BIN $PEER_IP '$KEYS_JSON' $LISTEN_PORT $FORWARD_ADDR"
    nohup "$HELPER_BIN" "$PEER_IP" "$KEYS_JSON" "$LISTEN_PORT" "$FORWARD_ADDR" >> "$LOG_FILE" 2>&1 &
    
    HELPER_PID=$!
    echo $HELPER_PID > "$PID_FILE"
    
    # 等待启动
    sleep 2
    
    # 验证进程
    if ps -p "$HELPER_PID" > /dev/null 2>&1; then
        log "TCP-AO proxy started successfully with PID $HELPER_PID"
        return 0
    else
        log "ERROR: Failed to start proxy"
        rm -f "$PID_FILE"
        return 1
    fi
}

# 停止代理
stop_proxy() {
    log "Stopping TCP-AO proxy for $PROTOCOL..."
    
    if [ ! -f "$PID_FILE" ]; then
        log "No PID file found, proxy not running"
        return 0
    fi
    
    PID=$(cat "$PID_FILE")
    
    if ps -p "$PID" > /dev/null 2>&1; then
        log "Killing process $PID"
        kill "$PID"
        
        # 等待进程结束
        for i in {1..10}; do
            if ! ps -p "$PID" > /dev/null 2>&1; then
                log "Process stopped"
                rm -f "$PID_FILE"
                return 0
            fi
            sleep 1
        done
        
        # 强制杀死
        log "Force killing process"
        kill -9 "$PID"
        rm -f "$PID_FILE"
    else
        log "Process not running, removing PID file"
        rm -f "$PID_FILE"
    fi
    
    return 0
}

# 检查状态
check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "TCP-AO proxy for $PROTOCOL is running (PID: $PID)"
            return 0
        else
            echo "TCP-AO proxy for $PROTOCOL is not running (stale PID file)"
            return 1
        fi
    else
        echo "TCP-AO proxy for $PROTOCOL is not running"
        return 1
    fi
}

# 主逻辑
case "$6" in
    start)
        start_proxy
        ;;
    stop)
        stop_proxy
        ;;
    restart)
        stop_proxy
        sleep 2
        start_proxy
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: $0 <protocol> <peer_ip> <keys_json> <listen_port> <forward_addr> {start|stop|restart|status}"
        echo "Example: $0 bmp 192.168.1.1 '[{\"keyId\":1,\"algorithm\":\"hmac-sha-256\",\"password\":\"key1\",\"send\":true,\"recv\":true}]' 179 localhost:11020 start"
        exit 1
        ;;
esac

exit $?
