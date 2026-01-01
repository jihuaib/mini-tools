/*
 * Simple JSON Parser for TCP-AO Keys
 * 
 * 解析格式:
 * [{"keyId":1,"algorithm":"hmac-sha-256","password":"key1","send":true,"recv":true}]
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>

#define MAX_KEYS 10
#define MAX_PASSWORD_LEN 80
#define MAX_ALG_NAME 64

typedef struct {
    int keyId;
    char algorithm[MAX_ALG_NAME];
    char password[MAX_PASSWORD_LEN];
    time_t sendStart;
    time_t sendEnd;
    time_t acceptStart;
    time_t acceptEnd;
} KeyConfig;

// 跳过空白字符
static const char* skip_whitespace(const char* str) {
    while (*str && isspace(*str)) str++;
    return str;
}

// 查找字符串值
static const char* find_string_value(const char* json, const char* key, char* value, int max_len) {
    char search[128];
    snprintf(search, sizeof(search), "\"%s\"", key);
    
    const char* pos = strstr(json, search);
    if (!pos) return NULL;
    
    pos += strlen(search);
    pos = skip_whitespace(pos);
    
    if (*pos != ':') return NULL;
    pos++;
    pos = skip_whitespace(pos);
    
    if (*pos != '"') return NULL;
    pos++;
    
    int i = 0;
    while (*pos && *pos != '"' && i < max_len - 1) {
        value[i++] = *pos++;
    }
    value[i] = '\0';
    
    return pos;
}

// 查找整数值
static int find_int_value(const char* json, const char* key, int* value) {
    char search[128];
    snprintf(search, sizeof(search), "\"%s\"", key);
    
    const char* pos = strstr(json, search);
    if (!pos) return -1;
    
    pos += strlen(search);
    pos = skip_whitespace(pos);
    
    if (*pos != ':') return -1;
    pos++;
    pos = skip_whitespace(pos);
    
    *value = atoi(pos);
    return 0;
}

// 查找布尔值
static int find_bool_value(const char* json, const char* key, int* value) {
    char search[128];
    snprintf(search, sizeof(search), "\"%s\"", key);
    
    const char* pos = strstr(json, search);
    if (!pos) return -1;
    
    pos += strlen(search);
    pos = skip_whitespace(pos);
    
    if (*pos != ':') return -1;
    pos++;
    pos = skip_whitespace(pos);
    
    if (strncmp(pos, "true", 4) == 0) {
        *value = 1;
    } else if (strncmp(pos, "false", 5) == 0) {
        *value = 0;
    } else {
        return -1;
    }
    
    return 0;
}

// 解析密钥数组
int parse_keys_json(const char* json_str, KeyConfig* keys, int max_keys) {
    int key_count = 0;
    const char* pos = json_str;
    
    // 跳过开始的 '['
    pos = skip_whitespace(pos);
    if (*pos != '[') {
        fprintf(stderr, "Invalid JSON: expected '['\n");
        return -1;
    }
    pos++;
    
    // 解析每个密钥对象
    while (key_count < max_keys) {
        pos = skip_whitespace(pos);
        
        // 检查数组结束
        if (*pos == ']') break;
        
        // 跳过 ','
        if (key_count > 0) {
            if (*pos != ',') {
                fprintf(stderr, "Invalid JSON: expected ','\n");
                return -1;
            }
            pos++;
            pos = skip_whitespace(pos);
        }
        
        // 检查对象开始
        if (*pos != '{') {
            fprintf(stderr, "Invalid JSON: expected '{'\n");
            return -1;
        }
        
        // 查找对象结束
        const char* obj_start = pos;
        int brace_count = 1;
        pos++;
        while (*pos && brace_count > 0) {
            if (*pos == '{') brace_count++;
            else if (*pos == '}') brace_count--;
            pos++;
        }
        
        if (brace_count != 0) {
            fprintf(stderr, "Invalid JSON: unmatched braces\n");
            return -1;
        }
        
        // 提取对象字符串
        int obj_len = pos - obj_start;
        char obj_str[1024];
        if (obj_len >= sizeof(obj_str)) {
            fprintf(stderr, "Object too large\n");
            return -1;
        }
        strncpy(obj_str, obj_start, obj_len);
        obj_str[obj_len] = '\0';
        
        // 解析对象字段
        KeyConfig* key = &keys[key_count];
        
        if (find_int_value(obj_str, "keyId", &key->keyId) < 0) {
            fprintf(stderr, "Missing keyId\n");
            return -1;
        }
        
        if (!find_string_value(obj_str, "algorithm", key->algorithm, MAX_ALG_NAME)) {
            fprintf(stderr, "Missing algorithm\n");
            return -1;
        }
        
        if (!find_string_value(obj_str, "password", key->password, MAX_PASSWORD_LEN)) {
            fprintf(stderr, "Missing password\n");
            return -1;
        }
        
        // 解析时间字段（Unix 时间戳）
        int temp_time;
        if (find_int_value(obj_str, "sendStart", &temp_time) >= 0) {
            key->sendStart = (time_t)temp_time;
        } else {
            key->sendStart = 0; // 0 表示无限制
        }
        
        if (find_int_value(obj_str, "sendEnd", &temp_time) >= 0) {
            key->sendEnd = (time_t)temp_time;
        } else {
            key->sendEnd = 0;
        }
        
        if (find_int_value(obj_str, "acceptStart", &temp_time) >= 0) {
            key->acceptStart = (time_t)temp_time;
        } else {
            key->acceptStart = 0;
        }
        
        if (find_int_value(obj_str, "acceptEnd", &temp_time) >= 0) {
            key->acceptEnd = (time_t)temp_time;
        } else {
            key->acceptEnd = 0;
        }
        
        key_count++;
    }
    
    return key_count;
}
