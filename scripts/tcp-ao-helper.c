/*
 * TCP-AO Proxy Helper
 * 
 * 支持 TCP Authentication Option (RFC 5925)
 * 特性:
 * - 多密钥同时有效
 * - 基于 KeyID 的密钥选择
 * - 无缝密钥轮换
 * - 支持多种算法 (HMAC-SHA-1, HMAC-SHA-256)
 * - 定时检查并更新密钥配置
 * 
 * 编译: gcc -o tcp-ao-helper tcp-ao-helper.c json-parser.c
 * 使用: ./tcp-ao-helper <peer_ip> <keys_json> <listen_port> <forward_addr> [key_rotation_interval]
 * 
 * keys_json 格式:
 * [
 *   {"keyId": 1, "algorithm": "hmac-sha-256", "password": "key1", "send": true, "recv": true},
 *   {"keyId": 2, "algorithm": "hmac-sha-256", "password": "key2", "send": false, "recv": true}
 * ]
 * 
 * key_rotation_interval: 密钥轮换检查间隔（秒），默认 60
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <sys/select.h>
#include <signal.h>
#include <time.h>
#include <stdarg.h>
#include <linux/types.h>
#include <linux/tcp.h>

#define MAX_KEYS 10
#define MAX_PASSWORD_LEN 80
#define MAX_ALG_NAME 64
#define BUFFER_SIZE 65536
#define DEFAULT_ROTATION_INTERVAL 60

// 密钥配置
typedef struct {
    int keyId;
    char algorithm[MAX_ALG_NAME];
    char password[MAX_PASSWORD_LEN];
    // 发送时间范围（Unix 时间戳，0 表示无限制）
    time_t sendStart;
    time_t sendEnd;
    // 接收时间范围（Unix 时间戳，0 表示无限制）
    time_t acceptStart;
    time_t acceptEnd;
} KeyConfig;

// 外部 JSON 解析函数
extern int parse_keys_json(const char* json_str, KeyConfig* keys, int max_keys);

// 函数前向声明
int configure_tcp_ao(int sock, const char *peer_ip, KeyConfig *key_configs, int num_keys);
int add_single_key(int sock, const char *peer_ip, const KeyConfig *key);
int delete_single_key(int sock, const char *peer_ip, const KeyConfig *key);
int delete_all_keys(int sock, const char *peer_ip);

// 全局变量
static volatile sig_atomic_t keep_running = 1;
static KeyConfig keys[MAX_KEYS];
static int key_count = 0;
static char keys_json_str[4096];  // 存储 JSON 字符串用于重新解析
static int rotation_interval = DEFAULT_ROTATION_INTERVAL;
static time_t last_rotation_check = 0;

// 信号处理
void signal_handler(int signum) {
    fprintf(stderr, "[%ld] Received signal %d, shutting down...\n", time(NULL), signum);
    keep_running = 0;
}

// 日志函数
void log_message(const char *level, const char *format, ...) {
    va_list args;
    time_t now = time(NULL);
    fprintf(stderr, "[%ld] [%s] ", now, level);
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    fprintf(stderr, "\n");
    fflush(stderr);
}

// 删除所有密钥
int delete_all_keys(int sock, const char *peer_ip) {
    struct sockaddr_in peer_addr;
    memset(&peer_addr, 0, sizeof(peer_addr));
    peer_addr.sin_family = AF_INET;
    inet_pton(AF_INET, peer_ip, &peer_addr.sin_addr);

    for (int i = 0; i < key_count; i++) {
        struct tcp_ao_del ao_del;
        memset(&ao_del, 0, sizeof(ao_del));
        memcpy(&ao_del.addr, &peer_addr, sizeof(peer_addr));
        
        ao_del.sndid = keys[i].keyId;
        ao_del.rcvid = keys[i].keyId;
        ao_del.prefix = 0;
        ao_del.ifindex = 0;
        ao_del.set_current = 0;
        ao_del.set_rnext = 0;
        ao_del.del_async = 0;
        ao_del.reserved = 0;
        ao_del.reserved2 = 0;

        if (setsockopt(sock, IPPROTO_TCP, TCP_AO_DEL_KEY, &ao_del, sizeof(ao_del)) < 0) {
            log_message("WARN", "Failed to delete key %d: %s", keys[i].keyId, strerror(errno));
        } else {
            log_message("INFO", "Deleted key %d", keys[i].keyId);
        }
    }

    return 0;
}

// 检查密钥是否在指定时间有效
int is_key_valid_for_send(const KeyConfig *key, time_t now) {
    if (key->sendStart == 0 && key->sendEnd == 0) return 1; // 无限制
    if (key->sendStart > 0 && now < key->sendStart) return 0;
    if (key->sendEnd > 0 && now > key->sendEnd) return 0;
    return 1;
}

int is_key_valid_for_recv(const KeyConfig *key, time_t now) {
    if (key->acceptStart == 0 && key->acceptEnd == 0) return 1; // 无限制
    if (key->acceptStart > 0 && now < key->acceptStart) return 0;
    if (key->acceptEnd > 0 && now > key->acceptEnd) return 0;
    return 1;
}

// 检查并更新密钥配置
int check_and_rotate_keys(int sock, const char *peer_ip) {
    time_t now = time(NULL);
    
    // 检查是否需要轮换
    if (now - last_rotation_check < rotation_interval) {
        return 0;
    }
    
    last_rotation_check = now;
    log_message("INFO", "Checking for key rotation at time %ld...", now);
    
    // 检查每个密钥的有效性变化
    int needs_update = 0;
    int keys_to_add[MAX_KEYS] = {0};     // 需要添加的密钥
    int keys_to_remove[MAX_KEYS] = {0};  // 需要删除的密钥
    
    for (int i = 0; i < key_count; i++) {
        int was_valid = is_key_valid_for_send(&keys[i], now - rotation_interval) || 
                        is_key_valid_for_recv(&keys[i], now - rotation_interval);
        int is_valid = is_key_valid_for_send(&keys[i], now) || 
                       is_key_valid_for_recv(&keys[i], now);
        
        if (!was_valid && is_valid) {
            // 密钥从无效变为有效 - 需要添加
            keys_to_add[i] = 1;
            needs_update = 1;
            log_message("INFO", "Key %d became valid, will add", keys[i].keyId);
        } else if (was_valid && !is_valid) {
            // 密钥从有效变为无效 - 需要删除
            keys_to_remove[i] = 1;
            needs_update = 1;
            log_message("INFO", "Key %d became invalid, will remove", keys[i].keyId);
        }
    }
    
    if (!needs_update) {
        log_message("DEBUG", "No key validity changes detected");
        return 0;
    }
    
    log_message("INFO", "Key validity changed, performing seamless rotation...");
    
    // 第一步：先添加新生效的密钥（无缝切换的关键）
    for (int i = 0; i < key_count; i++) {
        if (keys_to_add[i]) {
            log_message("INFO", "Adding newly valid key %d", keys[i].keyId);
            if (add_single_key(sock, peer_ip, &keys[i]) < 0) {
                log_message("ERROR", "Failed to add key %d", keys[i].keyId);
            }
        }
    }
    
    // 第二步：删除已失效的密钥
    for (int i = 0; i < key_count; i++) {
        if (keys_to_remove[i]) {
            log_message("INFO", "Removing expired key %d", keys[i].keyId);
            if (delete_single_key(sock, peer_ip, &keys[i]) < 0) {
                log_message("ERROR", "Failed to remove key %d", keys[i].keyId);
            }
        }
    }
    
    log_message("INFO", "Seamless key rotation completed");
    return 0;
}

// 添加单个密钥
int add_single_key(int sock, const char *peer_ip, const KeyConfig *key) {
    struct sockaddr_in peer_addr;
    memset(&peer_addr, 0, sizeof(peer_addr));
    peer_addr.sin_family = AF_INET;
    inet_pton(AF_INET, peer_ip, &peer_addr.sin_addr);

    time_t now = time(NULL);
    
    // 检查密钥是否在当前时间有效
    int can_send = is_key_valid_for_send(key, now);
    int can_recv = is_key_valid_for_recv(key, now);
    
    if (!can_send && !can_recv) {
        log_message("INFO", "Skipping key %d: not valid at current time", key->keyId);
        return 0;
    }
    
    log_message("INFO", "Adding key %d: send=%d, recv=%d", key->keyId, can_send, can_recv);

    struct tcp_ao_add ao_add;
    memset(&ao_add, 0, sizeof(ao_add));
    memcpy(&ao_add.addr, &peer_addr, sizeof(peer_addr));
    
    strncpy(ao_add.alg_name, key->algorithm, 63);
    ao_add.alg_name[63] = '\0';
    
    ao_add.keylen = strlen(key->password);
    if (ao_add.keylen > TCP_AO_MAXKEYLEN) {
        ao_add.keylen = TCP_AO_MAXKEYLEN;
    }
    memcpy(ao_add.key, key->password, ao_add.keylen);
    
    ao_add.sndid = key->keyId;
    ao_add.rcvid = key->keyId;
    ao_add.set_current = 1;
    ao_add.set_rnext = 0;
    ao_add.prefix = 32;
    ao_add.maclen = 0;
    ao_add.ifindex = 0;
    ao_add.keyflags = 0;
    ao_add.reserved = 0;
    ao_add.reserved2 = 0;

    if (setsockopt(sock, IPPROTO_TCP, TCP_AO_ADD_KEY, &ao_add, sizeof(ao_add)) < 0) {
        log_message("ERROR", "Failed to add key %d: %s (errno=%d)", 
                   key->keyId, strerror(errno), errno);
        return -1;
    }

    log_message("INFO", "Successfully added key %d", key->keyId);
    return 0;
}

// 删除单个密钥
int delete_single_key(int sock, const char *peer_ip, const KeyConfig *key) {
    struct sockaddr_in peer_addr;
    memset(&peer_addr, 0, sizeof(peer_addr));
    peer_addr.sin_family = AF_INET;
    inet_pton(AF_INET, peer_ip, &peer_addr.sin_addr);

    struct tcp_ao_del ao_del;
    memset(&ao_del, 0, sizeof(ao_del));
    memcpy(&ao_del.addr, &peer_addr, sizeof(peer_addr));
    
    ao_del.sndid = key->keyId;
    ao_del.rcvid = key->keyId;
    ao_del.prefix = 32;
    ao_del.ifindex = 0;
    ao_del.set_current = 0;
    ao_del.set_rnext = 0;
    ao_del.del_async = 0;
    ao_del.reserved = 0;
    ao_del.reserved2 = 0;

    if (setsockopt(sock, IPPROTO_TCP, TCP_AO_DEL_KEY, &ao_del, sizeof(ao_del)) < 0) {
        log_message("WARN", "Failed to delete key %d: %s", key->keyId, strerror(errno));
        return -1;
    }
    
    log_message("INFO", "Deleted key %d", key->keyId);
    return 0;
}

// 配置 TCP-AO 密钥
int configure_tcp_ao(int sock, const char *peer_ip, KeyConfig *key_configs, int num_keys) {
    struct sockaddr_in peer_addr;
    memset(&peer_addr, 0, sizeof(peer_addr));
    peer_addr.sin_family = AF_INET;
    inet_pton(AF_INET, peer_ip, &peer_addr.sin_addr);

    time_t now = time(NULL);
    log_message("INFO", "Configuring TCP-AO keys for peer %s at time %ld", peer_ip, now);

    // 找出最新的可发送密钥（KeyID 最大的）
    int newest_send_key = -1;
    for (int i = 0; i < num_keys; i++) {
        if (is_key_valid_for_send(&key_configs[i], now)) {
            if (newest_send_key == -1 || key_configs[i].keyId > key_configs[newest_send_key].keyId) {
                newest_send_key = i;
            }
        }
    }

    if (newest_send_key >= 0) {
        log_message("INFO", "Key %d will be used for sending (newest valid send key)", 
                   key_configs[newest_send_key].keyId);
    }

    int configured_count = 0;
    for (int i = 0; i < num_keys; i++) {
        // 检查密钥是否在当前时间有效
        int can_send = is_key_valid_for_send(&key_configs[i], now);
        int can_recv = is_key_valid_for_recv(&key_configs[i], now);
        
        if (!can_send && !can_recv) {
            log_message("INFO", "Skipping key %d: not valid at current time", key_configs[i].keyId);
            continue;
        }
        
        // 是否是当前发送密钥
        int is_current = (i == newest_send_key);
        
        log_message("INFO", "Key %d: send=%d, recv=%d, current=%d", 
                   key_configs[i].keyId, can_send, can_recv, is_current);
        
        struct tcp_ao_add ao_add;
        memset(&ao_add, 0, sizeof(ao_add));

        // 设置对端地址
        memcpy(&ao_add.addr, &peer_addr, sizeof(peer_addr));

        // 设置算法名称
        strncpy(ao_add.alg_name, key_configs[i].algorithm, 63);
        ao_add.alg_name[63] = '\0';

        // 设置密钥
        ao_add.keylen = strlen(key_configs[i].password);
        if (ao_add.keylen > TCP_AO_MAXKEYLEN) {
            ao_add.keylen = TCP_AO_MAXKEYLEN;
        }
        memcpy(ao_add.key, key_configs[i].password, ao_add.keylen);
        
        // 设置发送/接收 ID
        ao_add.sndid = key_configs[i].keyId;
        ao_add.rcvid = key_configs[i].keyId;
        
        // 关键：只有最新的发送密钥设置为 current
        ao_add.set_current = is_current ? 1 : 0;
        ao_add.set_rnext = 0;
        ao_add.reserved = 0;
        ao_add.reserved2 = 0;
        ao_add.prefix = 32;
        ao_add.maclen = 0;
        ao_add.ifindex = 0;
        ao_add.keyflags = 0;

        log_message("INFO", "Adding TCP-AO key %d:", i);
        log_message("INFO", "  - algorithm: %s", key_configs[i].algorithm);
        log_message("INFO", "  - keylen: %d", ao_add.keylen);
        log_message("INFO", "  - sndid: %d", ao_add.sndid);
        log_message("INFO", "  - rcvid: %d", ao_add.rcvid);
        log_message("INFO", "  - set_current: %d (will use for sending: %s)", 
                   ao_add.set_current, is_current ? "YES" : "NO");
        log_message("INFO", "  - prefix: %d", ao_add.prefix);

        // 添加密钥
        if (setsockopt(sock, IPPROTO_TCP, TCP_AO_ADD_KEY, &ao_add, sizeof(ao_add)) < 0) {
            log_message("ERROR", "Failed to add TCP-AO key %d: %s (errno=%d)", 
                       key_configs[i].keyId, strerror(errno), errno);
            
            // 打印更多调试信息
            log_message("ERROR", "Debug info:");
            log_message("ERROR", "  - Socket: %d", sock);
            log_message("ERROR", "  - Struct size: %zu", sizeof(ao_add));
            log_message("ERROR", "  - Peer IP: %s", peer_ip);
            log_message("ERROR", "  - Algorithm string length: %zu", strlen(ao_add.alg_name));
            
            // 检查是否是内核不支持的问题
            if (errno == EINVAL) {
                log_message("ERROR", "EINVAL suggests:");
                log_message("ERROR", "  1. Kernel may not support TCP-AO (need Linux 5.17+)");
                log_message("ERROR", "  2. Algorithm '%s' may not be supported", key_configs[i].algorithm);
                log_message("ERROR", "  3. Key parameters may be invalid");
                log_message("ERROR", "Try: uname -r to check kernel version");
            }
            
            return -1;
        }

        log_message("INFO", "Successfully added TCP-AO key %d%s", 
                   key_configs[i].keyId, is_current ? " (CURRENT for sending)" : "");
        configured_count++;
    }

    if (configured_count == 0) {
        log_message("WARN", "No keys were configured (none are valid at current time)");
        return -1;
    }

    log_message("INFO", "Configured %d out of %d TCP-AO keys successfully", configured_count, num_keys);
    return 0;
}

// 转发数据
void forward_data(int from_sock, int to_sock, const char *direction) {
    char buffer[BUFFER_SIZE];
    ssize_t bytes_read, bytes_written, total_written;

    bytes_read = recv(from_sock, buffer, sizeof(buffer), 0);
    if (bytes_read <= 0) {
        if (bytes_read < 0) {
            log_message("ERROR", "Receive error (%s): %s", direction, strerror(errno));
        }
        return;
    }

    total_written = 0;
    while (total_written < bytes_read) {
        bytes_written = send(to_sock, buffer + total_written, 
                           bytes_read - total_written, MSG_NOSIGNAL);
        if (bytes_written < 0) {
            log_message("ERROR", "Send error (%s): %s", direction, strerror(errno));
            return;
        }
        total_written += bytes_written;
    }

    log_message("DEBUG", "Forwarded %zd bytes (%s)", bytes_read, direction);
}

// 主代理逻辑
int run_proxy(const char *peer_ip, const char *listen_port, const char *forward_addr) {
    int listen_sock, peer_sock, forward_sock;
    struct sockaddr_in listen_addr, forward_addr_struct;
    int opt = 1;

    // 解析转发地址
    char forward_ip[256];
    int forward_port;
    if (sscanf(forward_addr, "%[^:]:%d", forward_ip, &forward_port) != 2) {
        log_message("ERROR", "Invalid forward address format: %s", forward_addr);
        return -1;
    }

    // 创建监听 socket
    listen_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_sock < 0) {
        log_message("ERROR", "Failed to create listen socket: %s", strerror(errno));
        return -1;
    }

    setsockopt(listen_sock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    // *** 关键：必须在 bind() 之前配置 TCP-AO 密钥 ***
    log_message("INFO", "Configuring TCP-AO keys BEFORE bind...");
    if (configure_tcp_ao(listen_sock, peer_ip, keys, key_count) < 0) {
        log_message("ERROR", "Failed to configure TCP-AO keys");
        close(listen_sock);
        return -1;
    }

    // 绑定监听地址
    memset(&listen_addr, 0, sizeof(listen_addr));
    listen_addr.sin_family = AF_INET;
    listen_addr.sin_addr.s_addr = INADDR_ANY;
    listen_addr.sin_port = htons(atoi(listen_port));

    if (bind(listen_sock, (struct sockaddr *)&listen_addr, sizeof(listen_addr)) < 0) {
        log_message("ERROR", "Failed to bind: %s", strerror(errno));
        close(listen_sock);
        return -1;
    }

    if (listen(listen_sock, 5) < 0) {
        log_message("ERROR", "Failed to listen: %s", strerror(errno));
        close(listen_sock);
        return -1;
    }

    log_message("INFO", "TCP-AO proxy listening on port %s", listen_port);
    log_message("INFO", "Forwarding to %s, expecting connections from %s", forward_addr, peer_ip);

    // 接受连接
    while (keep_running) {
        fd_set read_fds;
        struct timeval tv;
        
        FD_ZERO(&read_fds);
        FD_SET(listen_sock, &read_fds);
        
        tv.tv_sec = 1;
        tv.tv_usec = 0;
        
        int activity = select(listen_sock + 1, &read_fds, NULL, NULL, &tv);
        
        if (activity < 0 && errno != EINTR) {
            log_message("ERROR", "Select error: %s", strerror(errno));
            break;
        }
        
        if (activity > 0 && FD_ISSET(listen_sock, &read_fds)) {
            struct sockaddr_in peer_addr;
            socklen_t peer_len = sizeof(peer_addr);
            
            peer_sock = accept(listen_sock, (struct sockaddr *)&peer_addr, &peer_len);
            if (peer_sock < 0) {
                log_message("ERROR", "Accept failed: %s", strerror(errno));
                continue;
            }

            char peer_ip_str[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &peer_addr.sin_addr, peer_ip_str, sizeof(peer_ip_str));
            log_message("INFO", "Accepted connection from %s:%d", 
                       peer_ip_str, ntohs(peer_addr.sin_port));

            // 连接到转发目标
            forward_sock = socket(AF_INET, SOCK_STREAM, 0);
            if (forward_sock < 0) {
                log_message("ERROR", "Failed to create forward socket: %s", strerror(errno));
                close(peer_sock);
                continue;
            }

            memset(&forward_addr_struct, 0, sizeof(forward_addr_struct));
            forward_addr_struct.sin_family = AF_INET;
            forward_addr_struct.sin_port = htons(forward_port);
            inet_pton(AF_INET, forward_ip, &forward_addr_struct.sin_addr);

            if (connect(forward_sock, (struct sockaddr *)&forward_addr_struct, 
                       sizeof(forward_addr_struct)) < 0) {
                log_message("ERROR", "Failed to connect to %s: %s", forward_addr, strerror(errno));
                close(peer_sock);
                close(forward_sock);
                continue;
            }

            log_message("INFO", "Connected to forward target %s", forward_addr);

            // 数据转发循环
            while (keep_running) {
                // 定期检查密钥轮换
                check_and_rotate_keys(listen_sock, peer_ip);
                
                fd_set fds;
                FD_ZERO(&fds);
                FD_SET(peer_sock, &fds);
                FD_SET(forward_sock, &fds);
                
                int max_fd = (peer_sock > forward_sock) ? peer_sock : forward_sock;
                
                tv.tv_sec = 1;
                tv.tv_usec = 0;
                
                activity = select(max_fd + 1, &fds, NULL, NULL, &tv);
                
                if (activity < 0 && errno != EINTR) {
                    log_message("ERROR", "Select error in forwarding: %s", strerror(errno));
                    break;
                }
                
                if (activity > 0) {
                    if (FD_ISSET(peer_sock, &fds)) {
                        forward_data(peer_sock, forward_sock, "peer->forward");
                    }
                    if (FD_ISSET(forward_sock, &fds)) {
                        forward_data(forward_sock, peer_sock, "forward->peer");
                    }
                }
            }

            close(peer_sock);
            close(forward_sock);
            log_message("INFO", "Connection closed");
        }
    }

    close(listen_sock);
    return 0;
}

int main(int argc, char *argv[]) {
    if (argc < 5 || argc > 6) {
        fprintf(stderr, "Usage: %s <peer_ip> <keys_json> <listen_port> <forward_addr> [rotation_interval]\n", argv[0]);
        fprintf(stderr, "Example: %s 192.168.1.1 '[{\"keyId\":1,\"algorithm\":\"hmac-sha-256\",\"password\":\"key1\",\"send\":true,\"recv\":true}]' 179 localhost:11020 60\n", argv[0]);
        return 1;
    }

    const char *peer_ip = argv[1];
    const char *keys_json = argv[2];
    const char *listen_port = argv[3];
    const char *forward_addr = argv[4];
    
    if (argc == 6) {
        rotation_interval = atoi(argv[5]);
        if (rotation_interval < 10) {
            fprintf(stderr, "Warning: rotation_interval too small, using minimum 10 seconds\n");
            rotation_interval = 10;
        }
    }

    // 设置信号处理
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGPIPE, SIG_IGN);

    log_message("INFO", "TCP-AO Proxy Helper starting...");
    log_message("INFO", "Peer IP: %s", peer_ip);
    log_message("INFO", "Listen Port: %s", listen_port);
    log_message("INFO", "Forward Address: %s", forward_addr);
    log_message("INFO", "Key Rotation Interval: %d seconds", rotation_interval);

    // 保存 JSON 字符串用于后续重新解析
    strncpy(keys_json_str, keys_json, sizeof(keys_json_str) - 1);
    keys_json_str[sizeof(keys_json_str) - 1] = '\0';

    // 解析密钥配置
    key_count = parse_keys_json(keys_json_str, keys, MAX_KEYS);
    if (key_count < 0) {
        log_message("ERROR", "Failed to parse keys JSON");
        return 1;
    }
    
    log_message("INFO", "Parsed %d keys", key_count);
    for (int i = 0; i < key_count; i++) {
        log_message("INFO", "Key %d: ID=%d, Algorithm=%s",
                   i, keys[i].keyId, keys[i].algorithm);
        log_message("INFO", "  Send: %ld - %ld, Accept: %ld - %ld",
                   keys[i].sendStart, keys[i].sendEnd, 
                   keys[i].acceptStart, keys[i].acceptEnd);
    }

    // 初始化轮换检查时间
    last_rotation_check = time(NULL);

    // 运行代理
    int result = run_proxy(peer_ip, listen_port, forward_addr);

    log_message("INFO", "TCP-AO Proxy Helper stopped");
    return result;
}
