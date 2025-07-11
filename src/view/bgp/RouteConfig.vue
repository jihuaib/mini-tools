<template>
    <div class="mt-container">
        <a-card title="BGP路由配置">
            <a-tabs v-model:active-key="activeTabKey">
                <a-tab-pane :key="BGP_ADDR_FAMILY.IPV4_UNC" tab="IPv4-UNC路由">
                    <a-form :model="ipv4Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.prefix"
                                        :open="!!ipv4UNCValidationErrors.prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.prefix"
                                            :status="ipv4UNCValidationErrors.prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.mask"
                                        :open="!!ipv4UNCValidationErrors.mask"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.mask"
                                            :status="ipv4UNCValidationErrors.mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv4UNCValidationErrors.count"
                                        :open="!!ipv4UNCValidationErrors.count"
                                    >
                                        <a-input
                                            v-model:value="ipv4Data.count"
                                            :status="ipv4UNCValidationErrors.count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV4)">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv4Routes">生成IPv4路由</a-button>
                                <a-button type="primary" danger :disabled="!hasIpv4Routes" @click="deleteIpv4Routes">
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
                                :data-source="sentIpv4Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :row-key="record => `${record.prefix}-${record.addressFamily}`"
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

                <a-tab-pane :key="BGP_ADDR_FAMILY.IPV6_UNC" tab="IPv6-UNC路由">
                    <a-form :model="ipv6Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                        <a-row>
                            <a-col :span="8">
                                <a-form-item label="Prefix" name="prefix">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.prefix"
                                        :open="!!ipv6UNCValidationErrors.prefix"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.prefix"
                                            :status="ipv6UNCValidationErrors.prefix ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Mask" name="mask">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.mask"
                                        :open="!!ipv6UNCValidationErrors.mask"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.mask"
                                            :status="ipv6UNCValidationErrors.mask ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="8">
                                <a-form-item label="Count" name="count">
                                    <a-tooltip
                                        :title="ipv6UNCValidationErrors.count"
                                        :open="!!ipv6UNCValidationErrors.count"
                                    >
                                        <a-input
                                            v-model:value="ipv6Data.count"
                                            :status="ipv6UNCValidationErrors.count ? 'error' : ''"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item>
                            <a-button type="link" @click="showCustomRouteAttr(IP_TYPE.IPV6)">
                                <template #icon><SettingOutlined /></template>
                                配置自定义路由属性
                            </a-button>
                        </a-form-item>
                        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                            <a-space size="middle">
                                <a-button type="primary" @click="generateIpv6Routes">生成IPv6路由</a-button>
                                <a-button type="primary" danger :disabled="!hasIpv6Routes" @click="deleteIpv6Routes">
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
                                :data-source="sentIpv6Routes"
                                :columns="routeColumns"
                                :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                                size="small"
                                :row-key="record => `${record.ip}-${record.mask}`"
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
            v-model:input-value="ipv4Data.customAttr"
            @submit="handleCustomIpv4RouteAttrSubmit"
        />

        <CustomPktDrawer
            v-model:visible="customIpv6RouteAttrVisible"
            v-model:input-value="ipv6Data.customAttr"
            @submit="handleCustomIpv6RouteAttrSubmit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, computed, onActivated, watch } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { SettingOutlined, UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons-vue';
    import { BGP_ADDR_FAMILY, DEFAULT_VALUES, IP_TYPE } from '../../const/bgpConst';
    import {
        FormValidator,
        createBgpIpv4RouteConfigValidationRules,
        createBgpIpv6RouteConfigValidationRules
    } from '../../utils/validationCommon';

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
        addressFamily: BGP_ADDR_FAMILY.IPV4_UNC
    });

    const ipv6Data = ref({
        prefix: DEFAULT_VALUES.IPV6_PREFIX,
        mask: DEFAULT_VALUES.IPV6_MASK,
        count: DEFAULT_VALUES.IPV6_COUNT,
        customAttr: '',
        addressFamily: BGP_ADDR_FAMILY.IPV6_UNC
    });

    const ipv4UNCValidationErrors = ref({
        prefix: '',
        mask: '',
        count: ''
    });

    const ipv6UNCValidationErrors = ref({
        prefix: '',
        mask: '',
        count: ''
    });

    const ipv4UNCValidator = new FormValidator(ipv4UNCValidationErrors);
    ipv4UNCValidator.addRules(createBgpIpv4RouteConfigValidationRules());

    const ipv6UNCValidator = new FormValidator(ipv6UNCValidationErrors);
    ipv6UNCValidator.addRules(createBgpIpv6RouteConfigValidationRules());

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (ipv4UNCValidator) {
                ipv4UNCValidator.clearErrors();
            }
            if (ipv6UNCValidator) {
                ipv6UNCValidator.clearErrors();
            }
        }
    });

    const activeTabKey = ref(BGP_ADDR_FAMILY.IPV4_UNC);

    const hasIpv4Routes = computed(() => sentIpv4Routes.value.length > 0);
    const hasIpv6Routes = computed(() => sentIpv6Routes.value.length > 0);

    watch(activeTabKey, () => {
        if (ipv4UNCValidator) {
            ipv4UNCValidator.clearErrors();
        }
        if (ipv6UNCValidator) {
            ipv6UNCValidator.clearErrors();
        }
    });

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
            if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                result = await window.bgpApi.deleteIpv4Routes(config);
            } else if (route.addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                result = await window.bgpApi.deleteIpv6Routes(config);
            }

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                if (route.addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                    await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
                } else if (route.addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                    await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
                }
            } else {
                message.error(`路由删除失败: ${result.msg}`);
            }
        } catch (e) {
            message.error(`路由删除失败: ${e.message}`);
        }
    };

    const getRoutes = async addressFamily => {
        const result = await window.bgpApi.getRoutes(addressFamily);
        if (result.status === 'success') {
            // 将结果转换为表格数据
            const routes = result.data;
            if (addressFamily === BGP_ADDR_FAMILY.IPV4_UNC) {
                sentIpv4Routes.value = Array.isArray(routes) ? [...routes] : [];
            } else if (addressFamily === BGP_ADDR_FAMILY.IPV6_UNC) {
                sentIpv6Routes.value = Array.isArray(routes) ? [...routes] : [];
            }
        } else {
            console.error(result.msg);
        }
    };

    // IPv4路由处理
    const generateIpv4Routes = async () => {
        try {
            const hasErrors = ipv4UNCValidator.validate(ipv4Data.value);
            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv4Data.value));
            const saveResult = await window.bgpApi.saveIpv4UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.generateIpv4Routes(payload);
            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv4路由生成失败: ${e.message}`);
        }
    };

    const deleteIpv4Routes = async () => {
        try {
            const hasErrors = ipv4UNCValidator.validate(ipv4Data.value);
            if (hasErrors) {
                message.error('请检查IPv4路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv4Data.value));
            const saveResult = await window.bgpApi.saveIpv4UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            // 从选中的地址族移除路由
            const result = await window.bgpApi.deleteIpv4Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv4路由删除失败: ${e.message}`);
        }
    };

    // IPv6路由处理
    const generateIpv6Routes = async () => {
        try {
            const hasErrors = ipv6UNCValidator.validate(ipv6Data.value);
            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv6Data.value));
            const saveResult = await window.bgpApi.saveIpv6UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.generateIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由生成失败: ${e.message}`);
        }
    };

    const deleteIpv6Routes = async () => {
        try {
            const hasErrors = ipv6UNCValidator.validate(ipv6Data.value);
            if (hasErrors) {
                message.error('请检查IPv6路由配置信息是否正确');
                return;
            }

            const payload = JSON.parse(JSON.stringify(ipv6Data.value));
            const saveResult = await window.bgpApi.saveIpv6UNCRouteConfig(payload);
            if (saveResult.status !== 'success') {
                message.error(saveResult.msg || '配置文件保存失败');
                return;
            }

            const result = await window.bgpApi.deleteIpv6Routes(payload);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                // 更新路由列表
                await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由删除失败: ${e.message}`);
        }
    };

    onActivated(async () => {
        await getRoutes(BGP_ADDR_FAMILY.IPV4_UNC);
        await getRoutes(BGP_ADDR_FAMILY.IPV6_UNC);
    });
</script>

<style scoped>
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
</style>
