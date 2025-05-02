<template>
    <div class="route-config-container">
        <a-card title="BGP路由配置" class="route-config-card">
            <a-tabs>
                <a-tab-pane :key="ADDRESS_FAMILY.IPV4_UNC" tab="IPv4-UNC路由">
                    <a-form :model="ipv4Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.ipv4Prefix"
                                        :open="!!ipv4UNCValidationErrors.ipv4Prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.prefix"
                                            @blur="
                                                e =>
                                                    validateIpv4UNCField(
                                                        e.target.value,
                                                        'ipv4Prefix',
                                                        validateIpv4Prefix
                                                    )
                                            "
                                            :status="ipv4UNCValidationErrors.ipv4Prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.ipv4Mask"
                                        :open="!!ipv4UNCValidationErrors.ipv4Mask"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.mask"
                                            @blur="
                                                e => validateIpv4UNCField(e.target.value, 'ipv4Mask', validateIpv4Mask)
                                            "
                                            :status="ipv4UNCValidationErrors.ipv4Mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.ipv4Count"
                                        :open="!!ipv4UNCValidationErrors.ipv4Count"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.count"
                                            @blur="
                                                e =>
                                                    validateIpv4UNCField(e.target.value, 'ipv4Count', validateIpv4Count)
                                            "
                                            :status="ipv4UNCValidationErrors.ipv4Count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV4)" class="custom-route-btn">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv4Routes">生成IPv4路由</a-button>
                                <a-button type="primary" danger @click="deleteIpv4Routes" :disabled="!hasIpv4Routes">
                                    删除IPv4路由
                                </a-button>
                            </a-space>
                        </a-form-item>

                        <!-- IPv4路由列表 -->
                        <div class="route-list-section">
                            <div class="route-list-header">
                                <UnorderedListOutlined />
                                <span class="header-text">已生成IPv4路由列表</span>
                                <a-tag v-if="sentIpv4Routes.length > 0" color="blue">
                                    {{ sentIpv4Routes.length }}
                                </a-tag>
                            </div>
                            <a-table
                                :dataSource="sentIpv4Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :rowKey="record => `${record.prefix}-${record.addressFamily}`"
                                :scroll="{ y: 240 }"
                            >
                                <template #bodyCell="{ column, record }">
                                    <template v-if="column.key === 'action'">
                                        <a-button type="primary" danger size="small" @click="deleteSingleRoute(record)">
                                            <template #icon><DeleteOutlined /></template>
                                            删除
                                        </a-button>
                                    </template>
                                    <template v-else-if="column.key === 'prefix'">
                                        <div>{{ record.prefix }}/{{ record.mask }}</div>
                                    </template>
                                    <template v-else-if="column.key === 'addressFamily'">
                                        <div>{{ getAddressFamilyLabel(record.addressFamily) }}</div>
                                    </template>
                                </template>
                            </a-table>
                        </div>
                    </a-form>
                </a-tab-pane>

                <a-tab-pane :key="ADDRESS_FAMILY.IPV6_UNC" tab="IPv6-UNC路由">
                    <a-form :model="ipv6Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.ipv6Prefix"
                                        :open="!!ipv6UNCValidationErrors.ipv6Prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.prefix"
                                            @blur="
                                                e =>
                                                    validateIpv6UNCField(
                                                        e.target.value,
                                                        'ipv6Prefix',
                                                        validateIpv6Prefix
                                                    )
                                            "
                                            :status="ipv6UNCValidationErrors.ipv6Prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.ipv6Mask"
                                        :open="!!ipv6UNCValidationErrors.ipv6Mask"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.mask"
                                            @blur="
                                                e => validateIpv6UNCField(e.target.value, 'ipv6Mask', validateIpv6Mask)
                                            "
                                            :status="ipv6UNCValidationErrors.ipv6Mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.ipv6Count"
                                        :open="!!ipv6UNCValidationErrors.ipv6Count"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.count"
                                            @blur="
                                                e =>
                                                    validateIpv6UNCField(e.target.value, 'ipv6Count', validateIpv6Count)
                                            "
                                            :status="ipv6UNCValidationErrors.ipv6Count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV6)" class="custom-route-btn">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv6Routes">生成IPv6路由</a-button>
                                <a-button type="primary" danger @click="deleteIpv6Routes" :disabled="!hasIpv6Routes">
                                    删除IPv6路由
                                </a-button>
                            </a-space>
                        </a-form-item>

                        <!-- IPv6路由列表 -->
                        <div class="route-list-section">
                            <div class="route-list-header">
                                <UnorderedListOutlined />
                                <span class="header-text">已生成IPv6路由列表</span>
                                <a-tag v-if="sentIpv6Routes.length > 0" color="blue">
                                    {{ sentIpv6Routes.length }}
                                </a-tag>
                            </div>
                            <a-table
                                :dataSource="sentIpv6Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :rowKey="record => `${record.ip}-${record.mask}`"
                                :scroll="{ y: 240 }"
                            >
                                <template #bodyCell="{ column, record }">
                                    <template v-if="column.key === 'action'">
                                        <a-button type="primary" danger size="small" @click="deleteSingleRoute(record)">
                                            <template #icon><DeleteOutlined /></template>
                                            删除
                                        </a-button>
                                    </template>
                                </template>
                            </a-table>
                        </div>
                    </a-form>
                </a-tab-pane>
            </a-tabs>
        </a-card>

        <CustomPktDrawer
            v-model:visible="customIpv4RouteAttrVisible"
            v-model:inputValue="ipv4Data.customAttr"
            @submit="handleCustomIpv4RouteAttrSubmit"
        />

        <CustomPktDrawer
            v-model:visible="customIpv6RouteAttrVisible"
            v-model:inputValue="ipv6Data.customAttr"
            @submit="handleCustomIpv6RouteAttrSubmit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, toRaw, watch, computed, onActivated } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { debounce } from 'lodash-es';
    import { SettingOutlined, UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons-vue';
    import { ADDRESS_FAMILY, DEFAULT_VALUES, IP_TYPE } from '../../const/bgpConst';
    import {
        validateIpv4Prefix,
        validateIpv4Mask,
        validateIpv4Count,
        validateIpv6Prefix,
        validateIpv6Mask,
        validateIpv6Count
    } from '../../utils/bgpValidation';
    import { clearValidationErrors } from '../../utils/validationCommon';

    defineOptions({
        name: 'RouteConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    // 分别为IPv4和IPv6定义独立的数据对象
    const ipv4Data = ref({
        prefix: DEFAULT_VALUES.IPV4_PREFIX,
        mask: DEFAULT_VALUES.IPV4_MASK,
        count: DEFAULT_VALUES.IPV4_COUNT,
        customAttr: '',
        addressFamily: ADDRESS_FAMILY.IPV4_UNC
    });

    const ipv6Data = ref({
        prefix: DEFAULT_VALUES.IPV6_PREFIX,
        mask: DEFAULT_VALUES.IPV6_MASK,
        count: DEFAULT_VALUES.IPV6_COUNT,
        customAttr: '',
        addressFamily: ADDRESS_FAMILY.IPV6_UNC
    });

    const saveIpv4UNCRouteConfig = debounce(async data => {
        const result = await window.bgpApi.saveIpv4UNCRouteConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const saveIpv6UNCRouteConfig = debounce(async data => {
        const result = await window.bgpApi.saveIpv6UNCRouteConfig(data);
        if (result.status === 'success') {
            console.info(result.msg);
        } else {
            console.error(result.msg);
        }
    }, 300);

    const ipv4UNCValidationErrors = ref({
        ipv4Prefix: '',
        ipv4Mask: '',
        ipv4Count: ''
    });

    const ipv6UNCValidationErrors = ref({
        ipv6Prefix: '',
        ipv6Mask: '',
        ipv6Count: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(ipv4UNCValidationErrors);
            clearValidationErrors(ipv6UNCValidationErrors);
        }
    });

    const validateIpv4UNCField = (value, fieldName, validationFn) => {
        validationFn(value, ipv4UNCValidationErrors);
    };

    const validateIpv6UNCField = (value, fieldName, validationFn) => {
        validationFn(value, ipv6UNCValidationErrors);
    };

    const hasIpv4Routes = computed(() => sentIpv4Routes.value.length > 0);
    const hasIpv6Routes = computed(() => sentIpv6Routes.value.length > 0);

    // 添加加载标记，避免在mounted前触发watch保存
    const mounted = ref(false);

    onMounted(async () => {
        // 加载保存的IPv4-UNC路由配置
        const savedIpv4UNCRouteConfig = await window.bgpApi.loadIpv4UNCRouteConfig();
        if (savedIpv4UNCRouteConfig.status === 'success' && savedIpv4UNCRouteConfig.data) {
            // 加载IPv4路由配置
            ipv4Data.value = {
                prefix: savedIpv4UNCRouteConfig.data.prefix,
                mask: savedIpv4UNCRouteConfig.data.mask,
                count: savedIpv4UNCRouteConfig.data.count,
                customAttr: savedIpv4UNCRouteConfig.data.customAttr,
                addressFamily: savedIpv4UNCRouteConfig.data.addressFamily
            };
        } else {
            console.error('IPv4-UNC路由配置文件加载失败', savedIpv4UNCRouteConfig.msg);
        }

        // 加载保存的IPv6-UNC路由配置
        const savedIpv6UNCRouteConfig = await window.bgpApi.loadIpv6UNCRouteConfig();
        if (savedIpv6UNCRouteConfig.status === 'success' && savedIpv6UNCRouteConfig.data) {
            // 加载IPv6路由配置
            ipv6Data.value = {
                prefix: savedIpv6UNCRouteConfig.data.prefix,
                mask: savedIpv6UNCRouteConfig.data.mask,
                count: savedIpv6UNCRouteConfig.data.count,
                customAttr: savedIpv6UNCRouteConfig.data.customAttr,
                addressFamily: savedIpv6UNCRouteConfig.data.addressFamily
            };
        } else {
            console.error('IPv6-UNC路由配置文件加载失败', savedIpv6UNCRouteConfig.msg);
        }

        // 所有数据加载完成后，标记mounted为true，允许watch保存数据
        mounted.value = true;
    });

    const customIpv4RouteAttrVisible = ref(false);
    const customIpv6RouteAttrVisible = ref(false);

    const showCustomRouteAttr = ipType => {
        if (ipType === IP_TYPE.IPV4) {
            customIpv4RouteAttrVisible.value = true;
        } else {
            customIpv6RouteAttrVisible.value = true;
        }
    };

    const handleCustomIpv4RouteAttrSubmit = data => {
        ipv4Data.value.customAttr = data;
    };

    const handleCustomIpv6RouteAttrSubmit = data => {
        ipv6Data.value.customAttr = data;
    };

    // 添加显示已发送路由相关数据
    const sentIpv4Routes = ref([]);
    const sentIpv6Routes = ref([]);

    // 路由表列配置
    const routeColumns = [
        {
            title: '前缀',
            dataIndex: 'ip',
            key: 'ip'
        },
        {
            title: '掩码',
            dataIndex: 'mask',
            key: 'mask',
            width: 80
        },
        {
            title: 'MED',
            dataIndex: 'med',
            key: 'med',
            width: 80
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            align: 'center'
        }
    ];

    // 撤销单个路由
    const deleteSingleRoute = async route => {
        try {
            const config = {
                prefix: route.ip,
                mask: parseInt(route.mask),
                count: 1,
                customAttr: route.customAttr || '',
                addressFamily: route.addressFamily
            };

            let result;
            if (route.addressFamily === ADDRESS_FAMILY.IPV4_UNC) {
                result = await window.bgpApi.deleteIpv4Routes(config);
            } else if (route.addressFamily === ADDRESS_FAMILY.IPV6_UNC) {
                result = await window.bgpApi.deleteIpv6Routes(config);
            }

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                if (route.addressFamily === ADDRESS_FAMILY.IPV4_UNC) {
                    await getRoutes(ADDRESS_FAMILY.IPV4_UNC);
                } else if (route.addressFamily === ADDRESS_FAMILY.IPV6_UNC) {
                    await getRoutes(ADDRESS_FAMILY.IPV6_UNC);
                }
            } else {
                message.error(`路由删除失败: ${result.msg}`);
            }
        } catch (e) {
            console.error(e);
            message.error('路由删除失败');
        }
    };

    const getRoutes = async addressFamily => {
        const result = await window.bgpApi.getRoutes(addressFamily);
        if (result.status === 'success') {
            // 将结果转换为表格数据
            const routes = result.data;
            if (addressFamily === ADDRESS_FAMILY.IPV4_UNC) {
                sentIpv4Routes.value = Array.isArray(routes) ? [...routes] : [];
            } else if (addressFamily === ADDRESS_FAMILY.IPV6_UNC) {
                sentIpv6Routes.value = Array.isArray(routes) ? [...routes] : [];
            }
        } else {
            console.error(result.msg);
        }
    };

    // IPv4路由处理
    const generateIpv4Routes = async () => {
        try {
            const currentConfig = ipv4Data.value;

            clearValidationErrors(ipv4UNCValidationErrors);
            validateIpv4Prefix(currentConfig.prefix, ipv4UNCValidationErrors);
            validateIpv4Mask(currentConfig.mask, ipv4UNCValidationErrors);
            validateIpv4Count(currentConfig.count, ipv4UNCValidationErrors);

            const hasErrors = Object.values(ipv4UNCValidationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(currentConfig));
            const result = await window.bgpApi.generateIpv4Routes(payload);
            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(ADDRESS_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            console.error(e);
            message.error('IPv4路由生成失败');
        }
    };

    const deleteIpv4Routes = async () => {
        try {
            const currentConfig = ipv4Data.value;

            clearValidationErrors(ipv4UNCValidationErrors);
            validateIpv4Prefix(currentConfig.prefix, ipv4UNCValidationErrors);
            validateIpv4Mask(currentConfig.mask, ipv4UNCValidationErrors);
            validateIpv4Count(currentConfig.count, ipv4UNCValidationErrors);

            const hasErrors = Object.values(ipv4UNCValidationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            // 从选中的地址族移除路由
            const payload = JSON.parse(JSON.stringify(currentConfig));
            const result = await window.bgpApi.deleteIpv4Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(ADDRESS_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            console.error(e);
            message.error('IPv4路由删除失败');
        }
    };

    // IPv6路由处理
    const generateIpv6Routes = async () => {
        try {
            const currentConfig = ipv6Data.value;

            clearValidationErrors(ipv6UNCValidationErrors);
            validateIpv6Prefix(currentConfig.prefix, ipv6UNCValidationErrors);
            validateIpv6Mask(currentConfig.mask, ipv6UNCValidationErrors);
            validateIpv6Count(currentConfig.count, ipv6UNCValidationErrors);

            const hasErrors = Object.values(ipv6UNCValidationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(currentConfig));
            const result = await window.bgpApi.generateIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(ADDRESS_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            console.error(e);
            message.error('IPv6路由生成失败');
        }
    };

    const deleteIpv6Routes = async () => {
        try {
            const currentConfig = ipv6Data.value;

            clearValidationErrors(ipv6UNCValidationErrors);
            validateIpv6Prefix(currentConfig.prefix, ipv6UNCValidationErrors);
            validateIpv6Mask(currentConfig.mask, ipv6UNCValidationErrors);
            validateIpv6Count(currentConfig.count, ipv6UNCValidationErrors);

            const hasErrors = Object.values(ipv6UNCValidationErrors.value).some(error => error !== '');

            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(currentConfig));
            const result = await window.bgpApi.deleteIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(ADDRESS_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            console.error(e);
            message.error('IPv6路由删除失败');
        }
    };

    // 监听数据变化并保存配置
    watch(
        ipv4Data,
        newValue => {
            // 只有在组件挂载后才保存数据
            if (!mounted.value) return;

            try {
                clearValidationErrors(ipv4UNCValidationErrors);

                // 验证IPv4数据
                validateIpv4Prefix(newValue.prefix, ipv4UNCValidationErrors);
                validateIpv4Mask(newValue.mask, ipv4UNCValidationErrors);
                validateIpv4Count(newValue.count, ipv4UNCValidationErrors);

                // Check if there are any validation errors
                const hasErrors = Object.values(ipv4UNCValidationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('ipv4UNC route config validation failed, configuration not saved');
                    return;
                }

                const raw = toRaw(newValue);
                saveIpv4UNCRouteConfig(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true }
    );

    // 监听数据变化并保存配置
    watch(
        ipv6Data,
        newValue => {
            // 只有在组件挂载后才保存数据
            if (!mounted.value) return;

            try {
                clearValidationErrors(ipv6UNCValidationErrors);

                // 验证IPv6数据
                validateIpv6Prefix(newValue.prefix, ipv6UNCValidationErrors);
                validateIpv6Mask(newValue.mask, ipv6UNCValidationErrors);
                validateIpv6Count(newValue.count, ipv6UNCValidationErrors);

                // Check if there are any validation errors
                const hasErrors = Object.values(ipv6UNCValidationErrors.value).some(error => error !== '');

                if (hasErrors) {
                    console.log('ipv6UNC route config validation failed, configuration not saved');
                    return;
                }

                const raw = toRaw(newValue);
                saveIpv6UNCRouteConfig(raw);
            } catch (error) {
                console.error(error);
            }
        },
        { deep: true }
    );

    onActivated(async () => {
        await getRoutes(ADDRESS_FAMILY.IPV4_UNC);
        await getRoutes(ADDRESS_FAMILY.IPV6_UNC);
    });
</script>

<style scoped>
    .route-config-container {
        margin-top: 10px;
        margin-left: 8px;
    }

    .route-config-card {
        margin-top: 10px;
    }

    :deep(.ant-form-item) {
        margin-bottom: 8px;
    }

    .error-message {
        display: none;
    }

    :deep(.ant-input-status-error) {
        border-color: #ff4d4f;
    }

    :deep(.ant-input-status-error:hover) {
        border-color: #ff4d4f;
    }

    :deep(.ant-input-status-error:focus) {
        border-color: #ff4d4f;
        box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
    }

    :deep(.ant-tooltip) {
        z-index: 1000;
    }

    :deep(.ant-tooltip-inner) {
        background-color: #ff4d4f;
        color: white;
        border-radius: 4px;
        padding: 8px 12px;
        font-size: 12px;
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

    /* 路由列表样式 */
    .route-list-section {
        margin-top: 16px;
    }

    .route-list-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        background-color: #f5f5f5;
        border-radius: 4px;
    }

    .header-text {
        margin-right: 8px;
        font-weight: 500;
    }

    /* 表格样式调整 */
    :deep(.ant-table-small) {
        font-size: 12px;
    }
</style>
