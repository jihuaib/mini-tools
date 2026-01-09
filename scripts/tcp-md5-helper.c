/*
 * TCP MD5 Proxy Helper - Server Mode (IPv4/IPv6 Support)
 * Accepts incoming connections with TCP MD5 authentication
 * Forwards data through SSH tunnel to Windows
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <stdarg.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <sys/time.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <signal.h>
#include <time.h>
#include <linux/tcp.h>

#define BUFFER_SIZE 8192

volatile sig_atomic_t running = 1;

void signal_handler(int sig) {
    running = 0;
}

// Log with timestamp
void log_msg(const char *format, ...) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char timestamp[20];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", tm_info);

    printf("[%s] ", timestamp);

    va_list args;
    va_start(args, format);
    vprintf(format, args);
    va_end(args);

    printf("\n");
    fflush(stdout);
}

// Detect if IP is IPv4 or IPv6
int detect_ip_family(const char *ip) {
    struct in_addr addr4;
    struct in6_addr addr6;

    if (inet_pton(AF_INET, ip, &addr4) == 1) {
        return AF_INET;
    } else if (inet_pton(AF_INET6, ip, &addr6) == 1) {
        return AF_INET6;
    }
    return -1;
}

// Set TCP MD5 signature for a peer (IPv4/IPv6)
int set_tcp_md5_peer(int sockfd, const char *peer_ip, const char *password) {
    struct tcp_md5sig md5sig;
    int family = detect_ip_family(peer_ip);

    if (family < 0) {
        log_msg("ERROR: Invalid peer IP address: %s", peer_ip);
        return -1;
    }

    memset(&md5sig, 0, sizeof(md5sig));

    if (family == AF_INET) {
        struct sockaddr_in *addr4 = (struct sockaddr_in *)&md5sig.tcpm_addr;
        addr4->sin_family = AF_INET;
        if (inet_pton(AF_INET, peer_ip, &addr4->sin_addr) <= 0) {
            log_msg("ERROR: Invalid IPv4 address: %s", peer_ip);
            return -1;
        }
    } else {
        struct sockaddr_in6 *addr6 = (struct sockaddr_in6 *)&md5sig.tcpm_addr;
        addr6->sin6_family = AF_INET6;
        if (inet_pton(AF_INET6, peer_ip, &addr6->sin6_addr) <= 0) {
            log_msg("ERROR: Invalid IPv6 address: %s", peer_ip);
            return -1;
        }
    }

    // Set up MD5 signature structure
    md5sig.tcpm_keylen = strlen(password);
    if (md5sig.tcpm_keylen > TCP_MD5SIG_MAXKEYLEN) {
        log_msg("ERROR: MD5 password too long (max %d bytes)", TCP_MD5SIG_MAXKEYLEN);
        return -1;
    }
    memcpy(md5sig.tcpm_key, password, md5sig.tcpm_keylen);

    log_msg("Setting TCP MD5 signature for peer %s (%s, key length: %d)",
            peer_ip, family == AF_INET ? "IPv4" : "IPv6", md5sig.tcpm_keylen);
    log_msg("DEBUG: MD5 password first 4 bytes: %02x %02x %02x %02x",
            (unsigned char)password[0], (unsigned char)password[1],
            (unsigned char)password[2], (unsigned char)password[3]);

    // Try to set TCP MD5 signature
    if (setsockopt(sockfd, IPPROTO_TCP, TCP_MD5SIG, &md5sig, sizeof(md5sig)) < 0) {
        log_msg("ERROR: setsockopt TCP_MD5SIG failed: %s (errno=%d)", strerror(errno), errno);
        log_msg("       This may indicate:");
        log_msg("       1. Kernel doesn't support TCP_MD5SIG");
        log_msg("       2. Insufficient permissions (need root/CAP_NET_ADMIN)");
        log_msg("       3. Socket state doesn't allow MD5 setup");
        return -1;
    }

    log_msg("TCP MD5 signature set successfully for peer %s", peer_ip);

    // Verify the setting (read it back)
    struct tcp_md5sig verify_md5sig;
    socklen_t optlen = sizeof(verify_md5sig);
    memset(&verify_md5sig, 0, sizeof(verify_md5sig));
    memcpy(&verify_md5sig.tcpm_addr, &md5sig.tcpm_addr,
           family == AF_INET ? sizeof(struct sockaddr_in) : sizeof(struct sockaddr_in6));

    if (getsockopt(sockfd, IPPROTO_TCP, TCP_MD5SIG, &verify_md5sig, &optlen) == 0) {
        log_msg("DEBUG: MD5 signature verified, key length: %d", verify_md5sig.tcpm_keylen);
    } else {
        log_msg("WARNING: Could not verify MD5 signature: %s", strerror(errno));
    }

    return 0;
}

// Forward data between two sockets
void forward_data(int client_sock, int forward_sock) {
    fd_set read_fds;
    char buffer[BUFFER_SIZE];
    int max_fd = (client_sock > forward_sock) ? client_sock : forward_sock;

    while (running) {
        FD_ZERO(&read_fds);
        FD_SET(client_sock, &read_fds);
        FD_SET(forward_sock, &read_fds);

        struct timeval timeout = {1, 0};  // 1 second timeout
        int activity = select(max_fd + 1, &read_fds, NULL, NULL, &timeout);

        if (activity < 0) {
            if (errno == EINTR) continue;
            log_msg("ERROR: select failed: %s", strerror(errno));
            break;
        }

        if (activity == 0) continue;  // Timeout

        // Client -> Forward
        if (FD_ISSET(client_sock, &read_fds)) {
            int n = recv(client_sock, buffer, BUFFER_SIZE, 0);
            if (n <= 0) {
                log_msg("Client connection closed");
                break;
            }
            if (send(forward_sock, buffer, n, 0) < 0) {
                log_msg("ERROR: Failed to send to forward socket");
                break;
            }
        }

        // Forward -> Client
        if (FD_ISSET(forward_sock, &read_fds)) {
            int n = recv(forward_sock, buffer, BUFFER_SIZE, 0);
            if (n <= 0) {
                log_msg("Forward connection closed");
                break;
            }
            if (send(client_sock, buffer, n, 0) < 0) {
                log_msg("ERROR: Failed to send to client");
                break;
            }
        }
    }
}

int main(int argc, char *argv[]) {
    if (argc != 5) {
        fprintf(stderr, "Usage: %s <peer_ip> <md5_password> <listen_port> <forward_host:port>\n", argv[0]);
        fprintf(stderr, "Example (IPv4): %s 192.168.1.1 mypassword 11019 localhost:11020\n", argv[0]);
        fprintf(stderr, "Example (IPv6): %s 2001:db8::1 mypassword 11019 localhost:11020\n", argv[0]);
        return 1;
    }

    const char *peer_ip = argv[1];
    const char *md5_password = argv[2];
    int listen_port = atoi(argv[3]);

    // Detect IP family
    int family = detect_ip_family(peer_ip);
    if (family < 0) {
        fprintf(stderr, "ERROR: Invalid peer IP address: %s\n", peer_ip);
        return 1;
    }

    // Parse forward address
    char forward_host[256];
    int forward_port;
    if (sscanf(argv[4], "%255[^:]:%d", forward_host, &forward_port) != 2) {
        fprintf(stderr, "Invalid forward address format. Use host:port\n");
        return 1;
    }

    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    // Create listening socket with appropriate family
    int listen_sock = socket(family, SOCK_STREAM, 0);
    if (listen_sock < 0) {
        log_msg("ERROR: socket creation failed: %s", strerror(errno));
        return 1;
    }

    int opt = 1;
    setsockopt(listen_sock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    // For IPv6, allow IPv4-mapped addresses
    if (family == AF_INET6) {
        int ipv6only = 0;
        setsockopt(listen_sock, IPPROTO_IPV6, IPV6_V6ONLY, &ipv6only, sizeof(ipv6only));
    }

    // Set TCP MD5 signature for expected peer
    if (set_tcp_md5_peer(listen_sock, peer_ip, md5_password) < 0) {
        close(listen_sock);
        return 1;
    }

    // Bind to appropriate address family
    struct sockaddr_storage listen_addr;
    socklen_t addr_len;
    memset(&listen_addr, 0, sizeof(listen_addr));

    if (family == AF_INET) {
        struct sockaddr_in *addr4 = (struct sockaddr_in *)&listen_addr;
        addr4->sin_family = AF_INET;
        addr4->sin_addr.s_addr = INADDR_ANY;
        addr4->sin_port = htons(listen_port);
        addr_len = sizeof(struct sockaddr_in);
    } else {
        struct sockaddr_in6 *addr6 = (struct sockaddr_in6 *)&listen_addr;
        addr6->sin6_family = AF_INET6;
        addr6->sin6_addr = in6addr_any;
        addr6->sin6_port = htons(listen_port);
        addr_len = sizeof(struct sockaddr_in6);
    }

    if (bind(listen_sock, (struct sockaddr*)&listen_addr, addr_len) < 0) {
        log_msg("ERROR: bind failed: %s", strerror(errno));
        close(listen_sock);
        return 1;
    }

    if (listen(listen_sock, 5) < 0) {
        log_msg("ERROR: listen failed: %s", strerror(errno));
        close(listen_sock);
        return 1;
    }

    log_msg("TCP MD5 Proxy listening on %s port %d", family == AF_INET ? "IPv4" : "IPv6", listen_port);
    log_msg("Expecting connections from %s with MD5 authentication", peer_ip);
    log_msg("MD5 password length: %d bytes", (int)strlen(md5_password));
    log_msg("Forwarding to %s:%d", forward_host, forward_port);
    log_msg("========================================");
    log_msg("Waiting for router connection...");
    log_msg("If connection fails, check:");
    log_msg("  1. Router is configured with correct MD5 password");
    log_msg("  2. Router IP matches: %s", peer_ip);
    log_msg("  3. Firewall allows port %d", listen_port);
    log_msg("========================================");

    while (running) {
        struct sockaddr_storage client_addr;
        socklen_t client_len = sizeof(client_addr);

        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(listen_sock, &read_fds);

        struct timeval timeout = {1, 0};
        int activity = select(listen_sock + 1, &read_fds, NULL, NULL, &timeout);

        if (activity <= 0) continue;

        int client_sock = accept(listen_sock, (struct sockaddr*)&client_addr, &client_len);
        if (client_sock < 0) {
            if (errno == EINTR) continue;

            char client_ip[INET6_ADDRSTRLEN];
            int client_port;

            if (client_addr.ss_family == AF_INET) {
                struct sockaddr_in *addr4 = (struct sockaddr_in *)&client_addr;
                inet_ntop(AF_INET, &addr4->sin_addr, client_ip, INET6_ADDRSTRLEN);
                client_port = ntohs(addr4->sin_port);
            } else {
                struct sockaddr_in6 *addr6 = (struct sockaddr_in6 *)&client_addr;
                inet_ntop(AF_INET6, &addr6->sin6_addr, client_ip, INET6_ADDRSTRLEN);
                client_port = ntohs(addr6->sin6_port);
            }

            // MD5 authentication failure will cause accept to fail
            if (errno == ECONNABORTED || errno == ECONNRESET) {
                log_msg("ERROR: Connection from %s:%d failed - Possible MD5 authentication mismatch",
                        client_ip, client_port);
                log_msg("       Check that router is using correct MD5 password");
            } else if (errno == ETIMEDOUT) {
                log_msg("ERROR: Connection from %s:%d timed out", client_ip, client_port);
            } else {
                log_msg("ERROR: accept failed from %s:%d: %s (errno=%d)",
                        client_ip, client_port, strerror(errno), errno);
            }
            continue;
        }

        char client_ip[INET6_ADDRSTRLEN];
        int client_port;

        if (client_addr.ss_family == AF_INET) {
            struct sockaddr_in *addr4 = (struct sockaddr_in *)&client_addr;
            inet_ntop(AF_INET, &addr4->sin_addr, client_ip, INET6_ADDRSTRLEN);
            client_port = ntohs(addr4->sin_port);
        } else {
            struct sockaddr_in6 *addr6 = (struct sockaddr_in6 *)&client_addr;
            inet_ntop(AF_INET6, &addr6->sin6_addr, client_ip, INET6_ADDRSTRLEN);
            client_port = ntohs(addr6->sin6_port);
        }

        log_msg("New connection from %s:%d", client_ip, client_port);

        // Verify it's from expected peer
        if (strcmp(client_ip, peer_ip) != 0) {
            log_msg("WARNING: Connection from unexpected peer %s (expected %s), rejecting", client_ip, peer_ip);
            close(client_sock);
            continue;
        }

        log_msg("Connection accepted from expected peer %s (MD5 authentication successful)", peer_ip);

        // Fork to handle connection
        pid_t pid = fork();
        if (pid == 0) {
            // Child process
            close(listen_sock);

            // Connect to forward destination
            int forward_sock = socket(AF_INET, SOCK_STREAM, 0);
            if (forward_sock < 0) {
                log_msg("ERROR: forward socket creation failed: %s", strerror(errno));
                close(client_sock);
                exit(1);
            }

            struct sockaddr_in forward_addr;
            memset(&forward_addr, 0, sizeof(forward_addr));
            forward_addr.sin_family = AF_INET;
            forward_addr.sin_port = htons(forward_port);

            struct hostent *he = gethostbyname(forward_host);
            if (!he) {
                log_msg("ERROR: Failed to resolve forward host: %s", forward_host);
                close(forward_sock);
                close(client_sock);
                exit(1);
            }
            memcpy(&forward_addr.sin_addr, he->h_addr_list[0], he->h_length);

            if (connect(forward_sock, (struct sockaddr*)&forward_addr, sizeof(forward_addr)) < 0) {
                log_msg("ERROR: connect to forward destination failed: %s", strerror(errno));
                close(forward_sock);
                close(client_sock);
                exit(1);
            }

            log_msg("Connected to forward destination %s:%d", forward_host, forward_port);
            log_msg("Forwarding data between %s and %s:%d", peer_ip, forward_host, forward_port);

            // Forward data
            forward_data(client_sock, forward_sock);

            close(forward_sock);
            close(client_sock);
            log_msg("Connection closed");
            exit(0);
        } else if (pid > 0) {
            // Parent process
            close(client_sock);
        } else {
            log_msg("ERROR: fork failed: %s", strerror(errno));
            close(client_sock);
        }
    }

    close(listen_sock);
    log_msg("Proxy stopped");
    return 0;
}
