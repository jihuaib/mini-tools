<template>
    <div class="rpki-roa-config-container">
        <a-row>
            <a-col :span="24">
                <a-card title="RPKI ROA配置">
                    <a-form
                        :model="roaConfig"
                        :label-col="labelCol"
                        :wrapper-col="wrapperCol"
                        @finish="submitRoaConfig"
                    >
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="IP类型" name="ipType">
                                    <a-radio-group v-model:value="roaConfig.ipType">
                                        <a-radio :value="IP_TYPE.IPV4">IPv4</a-radio>
                                        <a-radio :value="IP_TYPE.IPV6">IPv6</a-radio>
                                    </a-radio-group>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="12">
                                <a-form-item label="IP" name="ip">
                                    <a-tooltip :title="validationErrors.ip" :open="!!validationErrors.ip">
                                        <a-input
                                            v-model:value="roaConfig.ip"
                                            :status="validationErrors.ip ? 'error' : ''"
                                            @blur="e => validateField(e.target.value, 'ip', validateIp)"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                            <a-col :span="12">
                                <a-form-item label="mask" name="mask">
                                    <a-tooltip :title="validationErrors.mask" :open="!!validationErrors.mask">
                                        <a-input
                                            v-model:value="roaConfig.mask"
                                            :status="validationErrors.mask ? 'error' : ''"
                                            @blur="e => validateField(e.target.value, 'mask', validateMask)"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="ASN" name="asn">
                                    <a-tooltip :title="validationErrors.asn" :open="!!validationErrors.asn">
                                        <a-input
                                            v-model:value="roaConfig.asn"
                                            :status="validationErrors.asn ? 'error' : ''"
                                            @blur="e => validateField(e.target.value, 'asn', validateAsn)"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-row>
                            <a-col :span="24">
                                <a-form-item label="最大前缀长度" name="maxLength">
                                    <a-tooltip :title="validationErrors.maxLength" :open="!!validationErrors.maxLength">
                                        <a-input
                                            v-model:value="roaConfig.maxLength"
                                            :status="validationErrors.maxLength ? 'error' : ''"
                                            @blur="e => validateField(e.target.value, 'maxLength', validateMaxLength)"
                                        />
                                    </a-tooltip>
                                </a-form-item>
                            </a-col>
                        </a-row>
                        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
                            <a-space>
                                <a-button type="primary" html-type="submit" :loading="submitLoading">添加ROA</a-button>
                                <a-button @click="resetForm">重置</a-button>
                            </a-space>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>

        <!-- ROA列表 -->
        <a-row style="margin-top: 10px">
            <a-col :span="24">
                <a-card title="ROA列表">
                    <div>
                        <a-table
                            :columns="roaColumns"
                            :data-source="roaList"
                            :row-key="record => `${record.asn}-${record.ip}-${record.mask}-${record.maxLength}`"
                            :pagination="{ pageSize: 10, showSizeChanger: false, position: ['bottomCenter'] }"
                            :scroll="{ y: 200 }"
                            size="small"
                        >
                            <template #bodyCell="{ column, record }">
                                <template v-if="column.key === 'action'">
                                    <a-button type="link" danger @click="deleteRoa(record)">删除</a-button>
                                </template>
                            </template>
                        </a-table>
                    </div>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup>
    import { ref, onMounted, watch } from 'vue';
    import { message } from 'ant-design-vue';
    import { clearValidationErrors } from '../../utils/validationCommon';
    import {
        validateAsn,
        validateIpv4Prefix,
        validateIpv6Prefix,
        validateIpv4Mask,
        validateIpv6Mask,
        validateIpv4MaxLength,
        validateIpv6MaxLength
    } from '../../utils/rpkiValidation';
    import { DEFAULT_VALUES } from '../../const/rpkiConst';
    import { IP_TYPE } from '../../const/bgpConst';

    defineOptions({
        name: 'RpkiRoaConfig'
    });

    const labelCol = { style: { width: '100px' } };
    const wrapperCol = { span: 40 };

    const roaConfig = ref({
        ipType: IP_TYPE.IPV4,
        asn: DEFAULT_VALUES.DEFAULT_RPKI_ASN,
        ip: DEFAULT_VALUES.DEFAULT_RPKI_IPV4,
        mask: DEFAULT_VALUES.DEFAULT_RPKI_MASKV4,
        maxLength: DEFAULT_VALUES.DEFAULT_RPKI_MAX_LENGTHV4
    });

    watch(
        () => roaConfig.value.ipType,
        newType => {
            if (newType === IP_TYPE.IPV4) {
                roaConfig.value.ip = DEFAULT_VALUES.DEFAULT_RPKI_IPV4;
                roaConfig.value.mask = DEFAULT_VALUES.DEFAULT_RPKI_MASKV4;
                roaConfig.value.maxLength = DEFAULT_VALUES.DEFAULT_RPKI_MAX_LENGTHV4;
            } else {
                roaConfig.value.ip = DEFAULT_VALUES.DEFAULT_RPKI_IPV6;
                roaConfig.value.mask = DEFAULT_VALUES.DEFAULT_RPKI_MASKV6;
                roaConfig.value.maxLength = DEFAULT_VALUES.DEFAULT_RPKI_MAX_LENGTHV6;
            }
            clearValidationErrors(validationErrors);
        }
    );

    const submitLoading = ref(false);

    // ROA列表
    const roaList = ref([]);
    const roaColumns = [
        {
            title: 'ASN',
            dataIndex: 'asn',
            key: 'asn',
            ellipsis: true
        },
        {
            title: 'IP',
            dataIndex: 'ip',
            key: 'ip',
            ellipsis: true
        },
        {
            title: 'mask',
            dataIndex: 'mask',
            key: 'mask',
            ellipsis: true
        },
        {
            title: '最大前缀长度',
            dataIndex: 'maxLength',
            key: 'maxLength',
            ellipsis: true
        },
        {
            title: '操作',
            key: 'action'
        }
    ];

    const validationErrors = ref({
        asn: '',
        ip: '',
        mask: '',
        maxLength: ''
    });

    // 暴露清空验证错误的方法给父组件
    defineExpose({
        clearValidationErrors: () => {
            clearValidationErrors(validationErrors);
        }
    });

    const validateField = (value, fieldName, validationFn) => {
        validationFn(value, validationErrors);
    };

    // 验证IP
    const validateIp = (value, errors) => {
        clearValidationErrors(validationErrors);
        if (roaConfig.value.ipType === IP_TYPE.IPV4) {
            validateIpv4Prefix(value, errors);
        } else {
            validateIpv6Prefix(value, errors);
        }
    };

    const validateMask = (value, errors) => {
        clearValidationErrors(validationErrors);
        value = parseInt(value);
        if (roaConfig.value.ipType === IP_TYPE.IPV4) {
            if (roaConfig.value.maxLength < value) {
                errors.value.mask = '最大前缀长度不能小于mask';
                return;
            }
            validateIpv4Mask(value, errors);
        } else {
            if (roaConfig.value.maxLength < value) {
                errors.value.mask = '最大前缀长度不能小于mask';
                return;
            }
            validateIpv6Mask(value, errors);
        }
    };

    // 验证最大前缀长度
    const validateMaxLength = (value, errors) => {
        clearValidationErrors(validationErrors);
        value = parseInt(value);
        if (roaConfig.value.ipType === IP_TYPE.IPV4) {
            if (roaConfig.value.mask > value) {
                errors.value.maxLength = 'mask不能小于最大前缀长度';
                return;
            }
            validateIpv4MaxLength(value, errors);
        } else {
            if (roaConfig.value.mask > value) {
                errors.value.maxLength = 'mask不能小于最大前缀长度';
                return;
            }
            validateIpv6MaxLength(value, errors);
        }
    };

    // 提交ROA配置
    const submitRoaConfig = async () => {
        clearValidationErrors(validationErrors);

        // 验证所有字段
        validateIp(roaConfig.value.ip, validationErrors);
        validateAsn(roaConfig.value.asn, validationErrors);
        validateMask(roaConfig.value.mask, validationErrors);
        validateMaxLength(roaConfig.value.maxLength, validationErrors);

        const hasErrors = Object.values(validationErrors.value).some(error => error !== '');
        if (hasErrors) {
            message.error('请检查ROA配置信息是否正确');
            return;
        }

        submitLoading.value = true;
        try {
            const payload = JSON.parse(JSON.stringify(roaConfig.value));
            const result = await window.rpkiApi.addRoa(payload);
            if (result.status === 'success') {
                message.success('ROA添加成功');
                // 刷新ROA列表
                fetchRoaList();
            } else {
                message.error(result.msg || 'ROA添加失败');
            }
        } catch (error) {
            message.error(`ROA添加出错: ${error.message}`);
        } finally {
            submitLoading.value = false;
        }
    };

    // 重置表单
    const resetForm = () => {
        roaConfig.value = {
            ipType: roaConfig.value.ipType, // 保持当前选择的IP类型
            asn: DEFAULT_VALUES.DEFAULT_RPKI_ASN,
            ip:
                roaConfig.value.ipType === IP_TYPE.IPV4
                    ? DEFAULT_VALUES.DEFAULT_RPKI_IPV4
                    : DEFAULT_VALUES.DEFAULT_RPKI_IPV6,
            mask:
                roaConfig.value.ipType === IP_TYPE.IPV4
                    ? DEFAULT_VALUES.DEFAULT_RPKI_MASKV4
                    : DEFAULT_VALUES.DEFAULT_RPKI_MASKV6,
            maxLength:
                roaConfig.value.ipType === IP_TYPE.IPV4
                    ? DEFAULT_VALUES.DEFAULT_RPKI_MAX_LENGTHV4
                    : DEFAULT_VALUES.DEFAULT_RPKI_MAX_LENGTHV6
        };
        clearValidationErrors(validationErrors);
    };

    // 删除ROA
    const deleteRoa = async record => {
        try {
            const result = await window.rpkiApi.deleteRoa({
                asn: record.asn,
                ip: record.ip,
                mask: record.mask,
                maxLength: record.maxLength
            });

            if (result.status === 'success') {
                message.success('ROA删除成功');
                fetchRoaList();
            } else {
                message.error(result.msg || 'ROA删除失败');
            }
        } catch (error) {
            message.error(`ROA删除出错: ${error.message}`);
        }
    };

    // 获取ROA列表
    const fetchRoaList = async () => {
        try {
            const result = await window.rpkiApi.getRoaList();
            if (result.status === 'success') {
                roaList.value = result.data;
            } else {
                console.error('获取ROA列表失败:', result.msg);
            }
        } catch (error) {
            console.error('获取ROA列表失败:', error);
        }
    };

    onMounted(async () => {
        fetchRoaList();
    });
</script>

<style scoped>
    .rpki-roa-config-container {
        margin-top: 10px;
        margin-left: 8px;
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
</style>
