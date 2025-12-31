#!/bin/bash
# BMP TCP MD5 Proxy
# This script creates a TCP proxy with MD5 authentication using a custom C helper

PEER_IP=$1
MD5_PASSWORD=$2
LISTEN_PORT=$3
FORWARD_ADDR=${4:-"localhost:11020"}

if [ -z "$PEER_IP" ] || [ -z "$MD5_PASSWORD" ] || [ -z "$LISTEN_PORT" ]; then
    echo "Usage: $0 <peer_ip> <md5_password> <listen_port> [forward_addr]"
    echo "Example: $0 192.168.1.1 mypassword 11019 localhost:11020"
    exit 1
fi

PROXY_DIR="/opt/bmp-md5-proxy"
PID_FILE="/var/run/bmp-md5-proxy.pid"
LOG_FILE="/var/log/bmp-md5-proxy.log"
HELPER_BIN="$PROXY_DIR/tcp-md5-helper"

# Function to log with timestamp
log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to compile helper if needed
compile_helper() {
    if [ ! -f "$HELPER_BIN" ]; then
        log_msg "Compiling TCP MD5 helper..."
        gcc -g -o "$HELPER_BIN" "$PROXY_DIR/tcp-md5-helper.c" >> "$LOG_FILE" 2>&1 || {
            log_msg "ERROR: Failed to compile helper"
            return 1
        }
        log_msg "Helper compiled successfully"
    fi
}

# Function to start proxy
start_proxy() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "Proxy already running with PID $PID"
            log_msg "Start attempt failed: Proxy already running with PID $PID"
            return 1
        fi
    fi

    log_msg "========================================="
    log_msg "Starting BMP MD5 proxy"
    log_msg "Peer IP: $PEER_IP"
    log_msg "Listen port: $LISTEN_PORT"
    log_msg "Forward to: $FORWARD_ADDR"
    log_msg "MD5 password: ***"
    
    # Compile helper if needed
    compile_helper || return 1

    # Start the TCP MD5 proxy helper
    log_msg "Launching helper process..."
    nohup "$HELPER_BIN" "$PEER_IP" "$MD5_PASSWORD" "$LISTEN_PORT" "$FORWARD_ADDR" \
        >> "$LOG_FILE" 2>&1 &
    
    PID=$!
    echo $PID > "$PID_FILE"
    
    echo "Proxy started with PID $PID"
    log_msg "Proxy started with PID $PID"
    log_msg "Log file: $LOG_FILE"
}

# Function to stop proxy
stop_proxy() {
    if [ ! -f "$PID_FILE" ]; then
        echo "Proxy not running"
        log_msg "Stop attempt: Proxy not running"
        return 1
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Stopping proxy (PID: $PID)..."
        log_msg "Stopping proxy (PID: $PID)"
        kill "$PID"
        rm -f "$PID_FILE"
        echo "Proxy stopped"
        log_msg "Proxy stopped successfully"
    else
        echo "Proxy not running (stale PID file)"
        log_msg "Stop attempt: Proxy not running (stale PID file)"
        rm -f "$PID_FILE"
    fi
}

# Function to check status
status_proxy() {
    if [ ! -f "$PID_FILE" ]; then
        echo "Proxy is not running"
        return 1
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Proxy is running (PID: $PID)"
        echo "Listening on port: $LOCAL_PORT"
        echo "Forwarding to: $TARGET_HOST:$TARGET_PORT"
        echo "Log file: $LOG_FILE"
        return 0
    else
        echo "Proxy is not running (stale PID file)"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Main
case "${5:-start}" in
    start)
        start_proxy
        ;;
    stop)
        stop_proxy
        ;;
    restart)
        stop_proxy
        sleep 1
        start_proxy
        ;;
    status)
        status_proxy
        ;;
    *)
        echo "Usage: $0 <target_host> <target_port> <md5_password> [local_port] {start|stop|restart|status}"
        exit 1
        ;;
esac
