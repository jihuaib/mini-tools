<template>
    <div class="ftp-server-container">
        <a-row>
            <a-col :span="24">
                <a-card title="FTP服务器配置">
                    <a-form :model="ftpConfig" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="服务器端口" name="port">
                                    <a-tooltip
                                        :title="validationFtpConfigErrors.port"
                                        :open="!!validationFtpConfigErrors.port"
                                    >
                                        <a-input
                                            v-model:value="ftpConfig.port"
                                            :status="validationFtpConfigErrors.port ? 'error' : ''"
                                            @blur="e => validateFtpConfigField(e.target.value, 'port', validatePort)"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button
                                    type="primary"
                                    :loading="serverLoading"
                                    :disabled="serverRunning"
                                    @click="startFtp"
                                >
                                    启动服务器
                                </a-button>
                                <a-button type="primary" danger :disabled="!serverRunning" @click="stopFtp">
                                    停止服务器
                                </a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- 用户配置 -->
        <a-row style="margin-top: 10px">
            <a-col :span="24">
                <a-card title="用户配置">
                    <a-form :model="ftpUserConfig" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="根目录" name="rootDir">
                                    <a-tooltip
                                        :title="validationFtpUserErrors.rootDir"
                                        :open="!!validationFtpUserErrors.rootDir"
                                    >
                                        <a-input-group compact>
                                            <a-input
                                                v-model:value="ftpUserConfig.rootDir"
                                                :status="validationFtpUserErrors.rootDir ? 'error' : ''"
                                                style="width: calc(100% - 40px)"
                                                readonly
                                                @blur="
                                                    e =>
                                                        validateFtpUserField(e.target.value, 'rootDir', validateRootDir)
                                                "
                                            />
                                            <a-button type="primary" @click="selectDirectory">
                                                <folder-outlined />
                                            </a-button>
                                        </a-input-group>
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="用户名" name="username">
                                    <a-tooltip
                                        :title="validationFtpUserErrors.username"
                                        :open="!!validationFtpUserErrors.username"
                                    >
                                        <a-input
                                            v-model:value="ftpUserConfig.username"
                                            :status="validationFtpUserErrors.username ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="密码" name="password">
                                    <a-tooltip
                                        :title="validationFtpUserErrors.password"
                                        :open="!!validationFtpUserErrors.password"
                                    >
                                        <a-input-password
                                            v-model:value="ftpUserConfig.password"
                                            :status="validationFtpUserErrors.password ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button type="primary" @click="addUser">添加用户</a-button>
                                <a-button type="default" @click="showUserList">用户列表</a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- FTP客户端列表 -->
        <a-row style="margin-top: 10px">
            <a-col :span="24">
                <a-card title="FTP客户端列表">
                    <div>
                        <a-table
                            :columns="clientColumns"
                            :data-source="clientList"
                            :row-key="record => `${record.remoteIp}|${record.remotePort}`"
                            :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                            :scroll="{ y: 200 }"
                            size="small"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'action'">
                                    <a-button type="link" @click="viewClientDetails(record)">详情</a-button>
                                </template>
                            </template>
                        </a-table>
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <!-- 用户列表弹窗 -->
        <a-modal
            v-model:open="userListModalVisible"
            title="用户列表"
            width="700px"
            :mask-closable="false"
            @cancel="closeUserListModal"
        >
            <div class="user-list-modal-content">
                <a-table
                    :columns="userListColumns"
                    :data-source="userList"
                    :pagination="{ pageSize: 5, showSizeChanger: false, position: ['bottomCenter'] }"
                    :scroll="{ y: 200 }"
                    size="small"
                >
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'action'">
                            <a-button type="link" @click="loadUserItem(record)">使用</a-button>
                            <a-button type="link" danger @click="deleteUser(record)">删除</a-button>
                        </template>
                    </template>
                </a-table>
            </div>
            <template #footer>
                <a-button type="primary" @click="closeUserListModal">关闭</a-button>
            </template>
        </a-modal>
    </div>
</template>

<script setup>
    import { ref, onMounted, onBeforeUnmount, toRaw, watch } from 'vue';
    import { message } from 'ant-design-vue';
    import { FolderOutlined } from '@ant-design/icons-vue';
    import { debounce } from 'lodash-es';
    import { clearValidationErrors } from '../../utils/validationCommon';
    import { DEFAULT_VALUES } from '../../const/ftpConst';
    import { validatePort, validateRootDir, validateUsername, validatePassword } from '../../utils/ftpValidation';

    defineOptions({
        name: 'FtpServer'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const ftpConfig = ref({
        port: DEFAULT_VALUES.DEFAULT_FTP_PORT
    });

    const ftpUserConfig = ref({
        rootDir: DEFAULT_VALUES.DEFAULT_FTP_ROOT_DIR,
        username: DEFAULT_VALUES.DEFAULT_FTP_USERNAME,
        password: DEFAULT_VALUES.DEFAULT_FTP_PASSWORD
    });

    const serverLoading = ref(false);
    const serverRunning = ref(false);

    // 客户端列表
    const clientList = ref([]);
    const clientColumns = [
        {
            title: '客户端IP',
            dataIndex: 'remoteIp',
            key: 'remoteIp',
            ellipsis: true
        },
        {
            title: '客户端端口',
            dataIndex: 'remotePort',
            key: 'remotePort',
            ellipsis: true
        },
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
            ellipsis: true
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            ellipsis: true
        },
        {
            title: '连接时间',
            dataIndex: 'connectedTime',
            key: 'connectedTime',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const validationFtpUserErrors = ref({
        rootDir: '',
        username: '',
        password: ''
    });

    const validationFtpConfigErrors = ref({
        port: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(validationFtpConfigErrors);
            clearValidationErrors(validationFtpUserErrors);
        }
    });

    const validateFtpUserField = (value, fieldName, validationFn) => {
        validationFn(value, validationFtpUserErrors);
    };

    const validateFtpConfigField = (value, fieldName, validationFn) => {
        validationFn(value, validationFtpConfigErrors);
    };

    const mounted = ref(false);

    const saveFtpConfig = debounce(async data => {
        const result = await window.ftpApi.saveFtpConfig(data);
        if (result.status !== 'success') {
            console.error(result.msg || '配置文件保存失败');
        }
    }, 300);

    watch(
        ftpConfig,
        newFtpConfig => {
            if (!mounted.value) return;

            try {
                clearValidationErrors(validationFtpConfigErrors);
                clearValidationErrors(validationFtpUserErrors);
                validatePort(newFtpConfig.port, validationFtpConfigErrors);

                const hasErrors = Object.values(validationFtpConfigErrors.value).some(error => error !== '');

                if (hasErrors) {
                    return;
                }

                const raw = toRaw(newFtpConfig);
                saveFtpConfig(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true }
    );

    const startFtp = async () => {
        clearValidationErrors(validationFtpConfigErrors);
        clearValidationErrors(validationFtpUserErrors);

        validatePort(ftpConfig.value.port, validationFtpConfigErrors);
        let hasErrors = Object.values(validationFtpConfigErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        validateRootDir(ftpUserConfig.value.rootDir, validationFtpUserErrors);
        validateUsername(ftpUserConfig.value.username, validationFtpUserErrors);
        validatePassword(ftpUserConfig.value.password, validationFtpUserErrors);

        hasErrors = Object.values(validationFtpUserErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }

        serverLoading.value = true;
        try {
            const ftpConfigPayload = JSON.parse(JSON.stringify(ftpConfig.value));
            const ftpUserConfigPayload = JSON.parse(JSON.stringify(ftpUserConfig.value));
            const result = await window.ftpApi.startFtp(ftpConfigPayload, ftpUserConfigPayload);

            if (result.status === 'success') {
                message.success('FTP服务器启动成功');
                serverRunning.value = true;
            } else {
                message.error(result.msg || 'FTP服务器启动失败');
            }
        } catch (error) {
            message.error(`FTP服务器启动出错: ${error.message}`);
        } finally {
            serverLoading.value = false;
        }
    };

    const stopFtp = async () => {
        try {
            const result = await window.ftpApi.stopFtp();

            if (result.status === 'success') {
                message.success('FTP服务器停止成功');
                serverRunning.value = false;
                clientList.value = [];
            } else {
                message.error(result.msg || 'FTP服务器停止失败');
            }
        } catch (error) {
            message.error(`FTP服务器停止出错: ${error.message}`);
        }
    };

    const onClientConnection = data => {
        if (data.event === 'connect') {
            // 新连接
            clientList.value = [...clientList.value, data.client];
        } else if (data.event === 'disconnect') {
            // 断开连接
            clientList.value = clientList.value.filter(
                client => !(client.remoteIp === data.client.remoteIp && client.remotePort === data.client.remotePort)
            );
        } else if (data.event === 'update') {
            // 更新客户端状态
            const index = clientList.value.findIndex(
                client => client.remoteIp === data.client.remoteIp && client.remotePort === data.client.remotePort
            );

            if (index !== -1) {
                const newList = [...clientList.value];
                newList[index] = data.client;
                clientList.value = newList;
            }
        }
    };

    const selectDirectory = async () => {
        try {
            const result = await window.commonApi.selectDirectory();
            if (result.status === 'success') {
                const data = result.data;
                if (data.filePaths && data.filePaths.length > 0) {
                    ftpUserConfig.value.rootDir = data.filePaths[0];
                }
            }
        } catch (error) {
            message.error(`选择目录失败: ${error.message}`);
        }
    };

    onMounted(async () => {
        try {
            // 加载配置
            const result = await window.ftpApi.getFtpConfig();
            if (result.status === 'success' && result.data) {
                ftpConfig.value = result.data;
            }

            const userListResult = await window.ftpApi.getFtpUserList();
            if (userListResult.status === 'success' && userListResult.data) {
                ftpUserConfig.value = userListResult.data[0];
            }

            // 注册客户端连接事件监听
            window.ftpApi.onClientConnection(onClientConnection);

            mounted.value = true;
        } catch (error) {
            console.error('初始化FTP配置出错:', error);
        }
    });

    onBeforeUnmount(() => {
        // 移除事件监听
        window.ftpApi.offClientConnection(onClientConnection);
    });

    const addUser = async () => {
        clearValidationErrors(validationFtpConfigErrors);
        clearValidationErrors(validationFtpUserErrors);

        validateRootDir(ftpUserConfig.value.rootDir, validationFtpUserErrors);
        validateUsername(ftpUserConfig.value.username, validationFtpUserErrors);
        validatePassword(ftpUserConfig.value.password, validationFtpUserErrors);

        const hasErrors = Object.values(validationFtpUserErrors.value).some(error => error !== '');

        if (hasErrors) {
            message.error('请检查配置信息是否正确');
            return;
        }
        const payload = JSON.parse(JSON.stringify(ftpUserConfig.value));
        const result = await window.ftpApi.addFtpUser(payload);
        if (result.status === 'success') {
            message.success(result.msg || '用户添加成功');
        } else {
            message.error(result.msg || '用户添加失败');
        }
    };

    const showUserList = async () => {
        const result = await window.ftpApi.getFtpUserList();
        if (result.status === 'success') {
            userList.value = result.data || [];
            userListModalVisible.value = true;
        } else {
            message.error(result.msg || '用户列表获取失败');
        }
    };

    // 用户列表相关状态
    const userList = ref([]);
    const userListModalVisible = ref(false);
    const userListColumns = [
        {
            title: '根目录',
            dataIndex: 'rootDir',
            key: 'rootDir'
        },
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username'
        },
        {
            title: '密码',
            dataIndex: 'password',
            key: 'password'
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    // 关闭用户列表弹窗
    const closeUserListModal = () => {
        userListModalVisible.value = false;
    };

    // 加载用户列表项
    const loadUserItem = record => {
        if (!record) return;

        // 更新表单数据
        ftpUserConfig.value = {
            rootDir: record.rootDir || '',
            username: record.username || '',
            password: record.password || ''
        };

        // 关闭弹窗
        closeUserListModal();
    };

    const deleteUser = async record => {
        const payload = JSON.parse(JSON.stringify(record));
        const result = await window.ftpApi.deleteFtpUser(payload);
        if (result.status === 'success') {
            message.success(result.msg || '用户删除成功');
            // 删除用户后，更新用户列表
            userList.value = userList.value.filter(item => item.username !== record.username);
        } else {
            message.error(result.msg || '用户删除失败');
        }
    };
</script>

<style scoped>
    .ftp-server-container {
        margin-top: 10px;
        margin-left: 8px;
    }

    :deep(.ant-form-item) {
        margin-bottom: 8px;
    }

    :deep(.ant-card-body) {
        padding: 10px;
    }

    :deep(.ant-card-head) {
        padding: 0 10px;
        min-height: 40px;
    }

    :deep(.ant-card-head-title) {
        padding: 10px 0;
    }

    :deep(.ant-table-tbody > tr > td) {
        height: 30px;
        padding-top: 8px;
        padding-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    :deep(.ant-table-body) {
        height: 300px !important;
        overflow-y: auto !important;
    }

    :deep(.ant-table-cell) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 表格样式调整 */
    :deep(.ant-table-small) {
        font-size: 12px;
    }

    /* 用户列表样式 */
    .user-list-modal-content {
        max-height: 400px;
        overflow-y: auto;
    }
</style>
