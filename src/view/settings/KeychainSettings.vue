<template>
    <div class="keychain-settings-container">
        <a-card title="Keychain 配置">
            <a-alert
                type="info"
                message="什么是 Keychain？"
                description="Keychain 允许配置多个密钥，每个密钥有不同的生效时间段。系统会根据当前时间自动选择有效的密钥，实现密钥的自动轮换。"
                show-icon
                style="margin-bottom: 24px"
            />

            <!-- Keychain 列表 -->
            <a-table :columns="keychainColumns" :data-source="keychains" :pagination="false" row-key="id">
                <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'keys'">
                        <a-tag>{{ record.keys.length }} 个密钥</a-tag>
                    </template>
                    <template v-else-if="column.key === 'action'">
                        <a-space>
                            <a-button type="link" size="small" @click="editKeychain(record)">编辑</a-button>
                            <a-popconfirm title="确定删除此 Keychain？" @confirm="deleteKeychain(record.id)">
                                <a-button type="link" danger size="small">删除</a-button>
                            </a-popconfirm>
                        </a-space>
                    </template>
                </template>
            </a-table>

            <a-button type="dashed" block style="margin-top: 16px" @click="addKeychain">
                <template #icon><PlusOutlined /></template>
                添加 Keychain
            </a-button>
        </a-card>

        <!-- Keychain 编辑对话框 -->
        <a-modal
            v-model:open="editDialogVisible"
            :title="editingKeychain.id ? '编辑 Keychain' : '新建 Keychain'"
            width="800px"
            @ok="saveKeychain"
        >
            <a-form :model="editingKeychain" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
                <a-form-item label="Keychain 名称" required>
                    <a-input v-model:value="editingKeychain.name" placeholder="例如: BMP-Keychain-1" />
                </a-form-item>

                <a-form-item label="描述">
                    <a-textarea v-model:value="editingKeychain.description" :rows="2" />
                </a-form-item>

                <a-divider>密钥列表</a-divider>

                <!-- 密钥列表 -->
                <div v-for="(key, index) in editingKeychain.keys" :key="index" class="key-item">
                    <a-card size="small" :title="`密钥 ${index + 1}`">
                        <template #extra>
                            <a-button type="link" danger size="small" @click="removeKey(index)">删除</a-button>
                        </template>

                        <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
                            <a-form-item label="Key ID">
                                <a-input-number v-model:value="key.keyId" :min="0" :max="255" style="width: 100%" />
                            </a-form-item>

                            <a-form-item label="算法">
                                <a-select v-model:value="key.algorithm" style="width: 100%">
                                    <a-select-option value="md5">MD5</a-select-option>
                                    <a-select-option value="hmac-sha-1">HMAC-SHA-1</a-select-option>
                                    <a-select-option value="hmac-sha-256">HMAC-SHA-256 (TCP-AO)</a-select-option>
                                </a-select>
                            </a-form-item>

                            <a-form-item label="密码">
                                <a-input-password
                                    v-model:value="key.password"
                                    placeholder="至少16个字符（TCP-AO需要）"
                                />
                                <div
                                    v-if="key.password && key.password.length < 16"
                                    style="color: #ff4d4f; font-size: 12px; margin-top: 4px"
                                >
                                    ⚠️ TCP-AO 要求密码至少 16 个字符，当前: {{ key.password.length }} 个字符
                                </div>
                            </a-form-item>

                            <a-form-item label="发送时间段">
                                <a-space direction="vertical" style="width: 100%">
                                    <a-checkbox v-model:checked="key.sendLifetime.always">始终发送</a-checkbox>
                                    <template v-if="!key.sendLifetime.always">
                                        <a-range-picker
                                            v-model:value="key.sendLifetime.range"
                                            show-time
                                            format="YYYY-MM-DD HH:mm:ss"
                                            style="width: 100%"
                                        />
                                    </template>
                                </a-space>
                            </a-form-item>

                            <a-form-item label="接受时间段">
                                <a-space direction="vertical" style="width: 100%">
                                    <a-checkbox v-model:checked="key.acceptLifetime.always">始终接受</a-checkbox>
                                    <template v-if="!key.acceptLifetime.always">
                                        <a-range-picker
                                            v-model:value="key.acceptLifetime.range"
                                            show-time
                                            format="YYYY-MM-DD HH:mm:ss"
                                            style="width: 100%"
                                        />
                                    </template>
                                </a-space>
                            </a-form-item>
                        </a-form>
                    </a-card>
                </div>

                <a-button type="dashed" block style="margin-top: 16px" @click="addKey">
                    <template #icon><PlusOutlined /></template>
                    添加密钥
                </a-button>
            </a-form>
        </a-modal>
    </div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { message } from 'ant-design-vue';
    import { PlusOutlined } from '@ant-design/icons-vue';
    import dayjs from 'dayjs';

    defineOptions({
        name: 'KeychainSettings'
    });

    const keychains = ref([]);
    const editDialogVisible = ref(false);
    const editingKeychain = ref({
        id: '',
        name: '',
        description: '',
        keys: []
    });

    const keychainColumns = [
        {
            title: 'Keychain 名称',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description'
        },
        {
            title: '密钥数量',
            key: 'keys'
        },
        {
            title: '操作',
            key: 'action',
            width: 150
        }
    ];

    // 加载 Keychains
    onMounted(async () => {
        await loadKeychains();
    });

    const loadKeychains = async () => {
        try {
            const result = await window.commonApi.loadKeychains();
            if (result.status === 'success') {
                keychains.value = result.data || [];
            }
        } catch (error) {
            message.error('加载 Keychain 失败');
        }
    };

    const addKeychain = () => {
        editingKeychain.value = {
            id: '',
            name: '',
            description: '',
            keys: []
        };
        editDialogVisible.value = true;
    };

    const editKeychain = record => {
        // Deep clone with dayjs conversion
        editingKeychain.value = {
            ...record,
            keys: record.keys.map(key => ({
                ...key,
                sendLifetime: {
                    always: key.sendLifetime.start === 'always',
                    range:
                        key.sendLifetime.start !== 'always'
                            ? [dayjs(key.sendLifetime.start), dayjs(key.sendLifetime.end)]
                            : null
                },
                acceptLifetime: {
                    always: key.acceptLifetime.start === 'always',
                    range:
                        key.acceptLifetime.start !== 'always'
                            ? [dayjs(key.acceptLifetime.start), dayjs(key.acceptLifetime.end)]
                            : null
                }
            }))
        };
        editDialogVisible.value = true;
    };

    const addKey = () => {
        editingKeychain.value.keys.push({
            keyId: editingKeychain.value.keys.length,
            algorithm: 'md5',
            password: '',
            sendLifetime: {
                always: true,
                range: null
            },
            acceptLifetime: {
                always: true,
                range: null
            }
        });
    };

    const removeKey = index => {
        editingKeychain.value.keys.splice(index, 1);
    };

    const saveKeychain = async () => {
        // Validation
        if (!editingKeychain.value.name) {
            message.error('请输入 Keychain 名称');
            return;
        }

        if (editingKeychain.value.keys.length === 0) {
            message.error('请至少添加一个密钥');
            return;
        }

        // 验证密码长度
        for (const key of editingKeychain.value.keys) {
            if (!key.password) {
                message.error('请为所有密钥设置密码');
                return;
            }
            if ((key.algorithm === 'hmac-sha-1' || key.algorithm === 'hmac-sha-256') && key.password.length < 16) {
                message.error(
                    `TCP-AO 算法要求密码至少 16 个字符，密钥 ${key.keyId} 的密码只有 ${key.password.length} 个字符`
                );
                return;
            }
        }

        // Convert to storage format
        const keychainToSave = {
            id: editingKeychain.value.id || `kc-${Date.now()}`,
            name: editingKeychain.value.name,
            description: editingKeychain.value.description,
            keys: editingKeychain.value.keys.map(key => ({
                keyId: key.keyId,
                algorithm: key.algorithm,
                password: key.password,
                sendLifetime: {
                    start: key.sendLifetime.always ? 'always' : key.sendLifetime.range[0].toISOString(),
                    end: key.sendLifetime.always ? 'forever' : key.sendLifetime.range[1].toISOString()
                },
                acceptLifetime: {
                    start: key.acceptLifetime.always ? 'always' : key.acceptLifetime.range[0].toISOString(),
                    end: key.acceptLifetime.always ? 'forever' : key.acceptLifetime.range[1].toISOString()
                }
            })),
            createdAt: editingKeychain.value.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const result = await window.commonApi.saveKeychain(keychainToSave);
            if (result.status === 'success') {
                message.success('Keychain 保存成功');
                editDialogVisible.value = false;
                await loadKeychains();
            } else {
                message.error(result.msg || '保存失败');
            }
        } catch (error) {
            message.error('保存 Keychain 失败');
        }
    };

    const deleteKeychain = async id => {
        try {
            const result = await window.commonApi.deleteKeychain(id);
            if (result.status === 'success') {
                message.success('Keychain 删除成功');
                await loadKeychains();
            } else {
                message.error(result.msg || '删除失败');
            }
        } catch (error) {
            message.error('删除 Keychain 失败');
        }
    };
</script>

<style scoped>
    .keychain-settings-container {
        max-width: 100%;
    }

    .key-item {
        margin-bottom: 16px;
    }
</style>
