<template>
    <div class="mt-container">
        <a-card title="IPv6-UNC路由配置">
            <a-form :model="ipv6Data" :label-col="labelCol" :wrapper-col="wrapperCol">
                <a-row>
                    <a-col :span="8">
                        <a-form-item label="Prefix" name="prefix">
                            <a-tooltip :title="validationErrors.prefix" :open="!!validationErrors.prefix">
                                <a-input
                                    v-model:value="ipv6Data.prefix"
                                    :status="validationErrors.prefix ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="8">
                        <a-form-item label="Mask" name="mask">
                            <a-tooltip :title="validationErrors.mask" :open="!!validationErrors.mask">
                                <a-input v-model:value="ipv6Data.mask" :status="validationErrors.mask ? 'error' : ''" />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                    <a-col :span="8">
                        <a-form-item label="Count" name="count">
                            <a-tooltip :title="validationErrors.count" :open="!!validationErrors.count">
                                <a-input
                                    v-model:value="ipv6Data.count"
                                    :status="validationErrors.count ? 'error' : ''"
                                />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-row>
                    <a-col :span="8">
                        <a-form-item label="RT" name="rt">
                            <a-tooltip :title="validationErrors.rt" :open="!!validationErrors.rt">
                                <a-input v-model:value="ipv6Data.rt" :status="validationErrors.rt ? 'error' : ''" />
                            </a-tooltip>
                        </a-form-item>
                    </a-col>
                </a-row>
                <a-form-item>
                    <a-button type="link" @click="showCustomRouteAttr">
                        <template #icon><SettingOutlined /></template>
                        配置自定义路由属性
                    </a-button>
                </a-form-item>
                <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
                    <a-space size="middle">
                        <a-button type="primary" @click="generateRoutes">生成IPv6路由</a-button>
                        <a-button type="primary" danger :disabled="!hasRoutes" @click="deleteRoutes">
                            删除IPv6路由
                        </a-button>
                    </a-space>
                </a-form-item>

                <!-- 路由列表 -->
                <div class="route-list-section">
                    <div class="route-list-header">
                        <UnorderedListOutlined />
                        <span class="header-text">已生成IPv6路由列表</span>
                        <a-tag v-if="pagination.total > 0" color="blue">
                            {{ pagination.total }}
                        </a-tag>
                    </div>
                    <a-table
                        :data-source="sentRoutes"
                        :columns="routeColumns"
                        :pagination="pagination"
                        size="small"
                        :row-key="record => `${record.ip}-${record.mask}`"
                        :scroll="{ y: 240 }"
                        @change="handleTableChange"
                    >
                        <template #bodyCell="{ column, record }">
                            <template v-if="column.key === 'action'">
                                <a-button type="primary" danger size="small" @click="deleteSingleRoute(record)">
                                    <template #icon><DeleteOutlined /></template>
                                    删除
                                </a-button>
                            </template>
                            <template v-else-if="column.key === 'ip'">
                                <div>{{ record.ip }}/{{ record.mask }}</div>
                            </template>
                        </template>
                    </a-table>
                </div>
            </a-form>
        </a-card>

        <CustomPktDrawer
            v-model:visible="customRouteAttrVisible"
            v-model:input-value="ipv6Data.customAttr"
            @submit="handleCustomRouteAttrSubmit"
        />
    </div>
</template>

<script setup>
    import { onMounted, ref, computed } from 'vue';
    import CustomPktDrawer from '../../components/CustomPktDrawer.vue';
    import { message } from 'ant-design-vue';
    import { SettingOutlined, UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons-vue';
    import { BGP_ADDR_FAMILY, DEFAULT_VALUES } from '../../const/bgpConst';
    import { FormValidator, createBgpIpv6RouteConfigValidationRules } from '../../utils/validationCommon';

    defineOptions({
        name: 'RouteIpv6'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const ipv6Data = ref({
        prefix: DEFAULT_VALUES.IPV6_PREFIX,
        mask: DEFAULT_VALUES.IPV6_MASK,
        count: DEFAULT_VALUES.IPV6_COUNT,
        customAttr: '',
        rt: '',
        addressFamily: BGP_ADDR_FAMILY.IPV6_UNC
    });

    const validationErrors = ref({
        prefix: '',
        mask: '',
        count: '',
        rt: ''
    });

    const validator = new FormValidator(validationErrors);
    validator.addRules(createBgpIpv6RouteConfigValidationRules());

    // 暴露给父组件
    defineExpose({
        clearValidationErrors: () => {
            if (validator) {
                validator.clearErrors();
            }
        }
    });

    const sentRoutes = ref([]);
    const hasRoutes = computed(() => pagination.value.total > 0);

    const customRouteAttrVisible = ref(false);

    const showCustomRouteAttr = () => {
        customRouteAttrVisible.value = true;
    };

    const handleCustomRouteAttrSubmit = data => {
        ipv6Data.value.customAttr = data;
    };

    const routeColumns = [
        {
            title: '前缀',
            dataIndex: 'ip',
            key: 'ip',
            width: 80
        },
        {
            title: 'MED',
            dataIndex: 'med',
            key: 'med',
            width: 80
        },
        {
            title: 'RT',
            dataIndex: 'rt',
            key: 'rt',
            width: 80
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            align: 'center'
        }
    ];

    const pagination = ref({
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: false,
        position: ['bottomCenter'],
        showTotal: total => `共 ${total} 条`
    });

    onMounted(async () => {
        // 加载保存的配置
        const savedConfig = await window.bgpApi.loadIpv6UNCRouteConfig();
        if (savedConfig.status === 'success' && savedConfig.data) {
            Object.assign(ipv6Data.value, savedConfig.data);
        } else {
            console.error('IPv6-UNC路由配置文件加载失败', savedConfig.msg);
        }

        // 加载已生成的路由列表
        pagination.value.current = 1;
        await refreshRoutes();
    });

    const handleTableChange = (pag, _filters, _sorter) => {
        pagination.value.current = pag.current;
        pagination.value.pageSize = pag.pageSize;
        refreshRoutes();
    };

    const refreshRoutes = async () => {
        const result = await window.bgpApi.getRoutes(
            BGP_ADDR_FAMILY.IPV6_UNC,
            pagination.value.current,
            pagination.value.pageSize
        );
        if (result.status === 'success' && result.data) {
            sentRoutes.value = result.data.list;
            pagination.value.total = result.data.total;
        } else {
            console.error(result.msg);
        }
    };

    const generateRoutes = async () => {
        try {
            const hasErrors = validator.validate(ipv6Data.value);
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
                pagination.value.current = 1;
                await refreshRoutes();
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由生成失败: ${e.message}`);
        }
    };

    const deleteRoutes = async () => {
        try {
            const hasErrors = validator.validate(ipv6Data.value);
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
                pagination.value.current = 1;
                await refreshRoutes();
            } else {
                message.error(`${result.msg}`);
            }
        } catch (e) {
            message.error(`IPv6路由删除失败: ${e.message}`);
        }
    };

    const deleteSingleRoute = async route => {
        try {
            const config = {
                prefix: route.ip,
                mask: parseInt(route.mask),
                count: 1,
                customAttr: route.customAttr || '',
                addressFamily: route.addressFamily
            };

            const result = await window.bgpApi.deleteIpv6Routes(config);

            if (result.status === 'success') {
                message.success(`${result.msg}`);
                await refreshRoutes();
            } else {
                message.error(`路由删除失败: ${result.msg}`);
            }
        } catch (e) {
            message.error(`路由删除失败: ${e.message}`);
        }
    };
</script>

<style scoped>
    .route-list-section {
        margin-top: 24px;
        border-top: 1px solid #f0f0f0;
        padding-top: 16px;
    }

    .route-list-header {
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.85);
    }

    .header-text {
        margin-left: 8px;
        margin-right: 8px;
    }

    /* 固定表格体高度，防止分页栏跳动 */
    :deep(.ant-table-body) {
        min-height: 300px;
    }
</style>
