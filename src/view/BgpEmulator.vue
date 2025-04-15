<template>
  <a-row :gutter="[16,16]">
    <a-col :span="16">
      <a-form :model="bgpData" @finish="startBgp" :label-col="labelCol"
              :wrapper-col="wrapperCol">
        <a-divider>BGP配置</a-divider>
        <a-form-item label="请选择网卡">
          <a-select
              ref="select"
              v-model:value="networkValue"
              :options="networkInfo"
              @select="handleNetworkChange"
          ></a-select>
        </a-form-item>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Local IP" name="localIp">
              <a-input v-model:value="bgpData.localIp" disabled/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Local AS" name="localAs"
                         :rules="[{ required: true, message: '请输入开始数值' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.localAs"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Peer IP" name="peerIp" :rules="[{ required: true, message: '请输入占位符' }]">
              <a-input v-model:value="bgpData.peerIp"/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Peer AS" name="peerAs"
                         :rules="[{ required: true, message: '请输入Peer AS' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.peerAs"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Router ID" name="routerId" :rules="[{ required: true, message: '请输入Router ID' }]">
              <a-input v-model:value="bgpData.routerId"/>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Hold Time" name="holdTime"
                         :rules="[{ required: true, message: '请输入holdTime时间' },
                                  { pattern: /^\d+$/, message: '请输入数字' }]">
              <a-input v-model:value="bgpData.holdTime"/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Open Cap" name="openCap">
          <a-space>
            <a-checkbox-group v-model:value="bgpData.openCap" :options="openCapOptions" />
            <a-button type="primary" @click="showCustomOpenCap">自定义能力</a-button>
          </a-space>
        </a-form-item>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Address Family" name="addressFamily">
              <a-select
                v-model:value="bgpData.addressFamily"
                mode="multiple"
                style="width: 100%"
                :options="addressFamilyOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Role" name="role">
              <a-select
                v-model:value="bgpData.role"
                style="width: 100%"
                :options="roleOptions"
                :disabled="!bgpData.openCap.includes('Role')"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Peer state" name="peerState">
              <a-input v-model:value="bgpData.peerState" disabled/>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item :wrapper-col="{ offset: 8, span: 16 }">
          <a-space size="middle">
            <a-button type="primary" html-type="submit">启动</a-button>
            <a-button type="primary" danger @click="stopBgp">停止</a-button>
          </a-space>
        </a-form-item>

        <a-divider>路由配置</a-divider>
        <a-row>
          <a-col :span="8">
            <a-form-item label="Prefix" name="routePrefix">
              <a-input v-model:value="bgpData.routeConfig.prefix"/>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Mask" name="routeMask">
              <a-input v-model:value="bgpData.routeConfig.mask"/>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Count" name="routeCount">
              <a-input v-model:value="bgpData.routeConfig.count"/>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
          <a-button type="primary" @click="sendRoutes">发送路由</a-button>
        </a-form-item>
      </a-form>
    </a-col>

    <a-col :span="8">
      <ScrollTextarea
          v-model:modelValue="bgpLog"
          :height="680"
      />
    </a-col>
  </a-row>

  <CustomPktDrawer
    v-model:visible="customOpenCapVisible"
    v-model:inputValue="bgpData.openCapCustom"
    @submit="handleCustomOpenCapSubmit"
  />
</template>

<script setup>
import {onMounted, ref, toRaw, watch } from 'vue'
import ScrollTextarea from "../components/ScrollTextarea.vue";
import CustomPktDrawer from "../components/CustomPktDrawer.vue";
import {message} from "ant-design-vue";
import { debounce } from 'lodash-es';

defineOptions({
  name: 'BgpEmulator'
})

const labelCol = { style: { width: '100px' } };
const wrapperCol = { span: 40 };

const openCapOptions = [
  { label: 'Address Family', value: 'Address Family', disabled: true },
  { label: 'Route-Refresh', value: 'Route-Refresh' },
  { label: 'AS4', value: 'AS4' },
  { label: 'Role', value: 'Role' },
];

const roleOptions = [
  { label: 'Provider', value: 'Provider' },
  { label: 'RS', value: 'RS' },
  { label: 'RS-Client', value: 'RS-Client' },
  { label: 'Customer', value: 'Customer' },
  { label: 'Lateral Peer', value: 'Lateral Peer' },
];

const addressFamilyOptions = [
  { label: 'Ipv4-UNC', value: 'Ipv4-UNC', disabled: true },
  { label: 'Ipv6-UNC', value: 'Ipv6-UNC' },
];

const bgpData = ref({
  localIp:'',
  localAs:'65535',
  peerIp:'192.168.56.11',
  peerAs:'100',
  routerId: '',
  holdTime: '180',
  openCap:['Address Family', 'Route-Refresh', 'AS4'],
  addressFamily: ['Ipv4-UNC'],
  peerState:'',
  role: '',
  openCapCustom: '',
  routeConfig: {
    prefix: '1.1.1.1',
    mask: '32',
    count: '10'
  }
});

const bgpLog = ref('')

const checkAndClearLog = (log) => {
  const lines = log.split('\r\n');
  if (lines.length > 1000) {
    return lines.slice(lines.length - 1000).join('\r\n');
  }
  return log;
}

const networkList = []
const networkInfo = ref([])
const networkValue = ref('')
const handleNetworkChange = (name) => {
  bgpData.value.localIp = networkList.find(item => item.name === name).ip;
  bgpData.value.routerId = networkList.find(item => item.name === name).ip;
}

const saveBgpConfig = {
  networkValue: '',
  localAs: '',
  peerIp: '',
  peerAs: '',
  routerId: '',
  holdTime: '',
  openCap: [],
  addressFamily: [],
  role: '',
  openCapCustom: '',
  routeConfig: {
    prefix: '',
    mask: '',
    count: ''
  }
}

const saveDebounced = debounce((data) => {
  window.bgpEmulatorApi.saveBgpConfig(data);
}, 300)

watch([bgpData], ([newBgpValue]) => {
  // 转换为saveBgpConfig
  saveBgpConfig.networkValue = networkValue.value;
  saveBgpConfig.localAs = newBgpValue.localAs;
  saveBgpConfig.peerIp = newBgpValue.peerIp;
  saveBgpConfig.peerAs = newBgpValue.peerAs;
  saveBgpConfig.routerId = newBgpValue.routerId;
  saveBgpConfig.holdTime = newBgpValue.holdTime;
  saveBgpConfig.openCap = [...newBgpValue.openCap];
  saveBgpConfig.addressFamily = [...newBgpValue.addressFamily];
  saveBgpConfig.role = newBgpValue.role;
  saveBgpConfig.openCapCustom = newBgpValue.openCapCustom;
  saveBgpConfig.routeConfig = { ...newBgpValue.routeConfig };
  const raw = toRaw(saveBgpConfig);
  saveDebounced(raw)
}, { deep: true, immediate: true })

onMounted(async () => {
  const result = await window.bgpEmulatorApi.getNetworkInfo()
  console.log(result);

  for (const [name, addresses] of Object.entries(result)) {
    addresses.forEach((addr) => {
      if (addr.family === 'IPv4' && !addr.internal) {
        networkList.push({
          name: name,
          ip: addr.address
        })
      }
    })
  }

  // 默认选中第一个
  if (networkList.length > 0) {
    for (let i = 0; i < networkList.length; i++) {
      networkInfo.value.push({
        value: networkList[i].name
      })
    }
    networkValue.value = networkInfo.value[0].value
    handleNetworkChange(networkValue.value)
  }

  window.bgpEmulatorApi.updateBgpData((data) => {
    console.log(data);
    if (data.status === 'success') {
      const response = data.data;
      if (response.op === 'log') {
        bgpLog.value = checkAndClearLog(bgpLog.value + response.message + '\r\n');
      } else if (response.op === 'peer-state') {
        bgpData.value.peerState = response.message;
      }
    } else {
      console.error(data.msg);
      message.error(data.msg);
    }
  })

  // 加载保存的配置
  const savedConfig = await window.bgpEmulatorApi.loadBgpConfig();
  if (savedConfig.status === 'success' && savedConfig.data) {
    console.log('Loading saved config:', savedConfig.data);
    networkValue.value = savedConfig.data.networkValue;
    handleNetworkChange(networkValue.value);
    bgpData.value.localAs = savedConfig.data.localAs;
    bgpData.value.peerIp = savedConfig.data.peerIp;
    bgpData.value.peerAs = savedConfig.data.peerAs;
    if (savedConfig.data.routerId) {
      bgpData.value.routerId = savedConfig.data.routerId;
    }
    bgpData.value.holdTime = savedConfig.data.holdTime;
    bgpData.value.openCap = Array.isArray(savedConfig.data.openCap) ? [...savedConfig.data.openCap] : [];
    bgpData.value.addressFamily = Array.isArray(savedConfig.data.addressFamily) ? [...savedConfig.data.addressFamily] : [];
    bgpData.value.role = savedConfig.data.role || '';
    bgpData.value.openCapCustom = savedConfig.data.openCapCustom || '';
    
    // Load route configuration
    if (savedConfig.data.routeConfig) {
      bgpData.value.routeConfig = {
        prefix: savedConfig.data.routeConfig.prefix || '',
        mask: savedConfig.data.routeConfig.mask || '',
        count: savedConfig.data.routeConfig.count || ''
      };
    }
  }
})

const customOpenCapVisible = ref(false)
const showCustomOpenCap = () => {
  customOpenCapVisible.value = true
}

const handleCustomOpenCapSubmit = (data) => {
  console.log(data)
  bgpData.value.openCapCustom = data
}

// Add watch for openCap changes
watch(() => bgpData.value.openCap, (newValue) => {
  if (!newValue.includes('Role')) {
    bgpData.value.role = '';
  }
  else {
    bgpData.value.role = 'Provider';
  }
}, { deep: true })

const sendRoutes = async () => {
  try {
    if (!bgpData.value.routeConfig.prefix || !bgpData.value.routeConfig.mask || !bgpData.value.routeConfig.count) {
      message.error('请填写完整路由配置信息');
      return;
    }
    const result = await window.bgpEmulatorApi.sendRoutes(bgpData.value.routeConfig);
    if (result.status === 'success') {
      message.success('路由发送成功');
    } else {
      message.error(result.msg || '路由发送失败');
    }
  } catch (e) {
    console.error(e);
    message.error('路由发送失败');
  }
};

const startBgp = () => {
  try {
    const payload = JSON.parse(JSON.stringify(bgpData.value));
    window.bgpEmulatorApi.startBgp(payload);
  } catch (e) {
    console.error(e);
    message.error(e);
  }
}

const stopBgp = async () => {
  const result = await window.bgpEmulatorApi.stopBgp();
  console.log(result);
};
</script>

<style scoped>
:deep(.ant-col-8) {
  margin-top: 16px;
}

:deep(.ant-divider) {
  margin: 10px 0;
  font-size: 16px;
  font-weight: 500;
  color: #1890ff;
}

:deep(.ant-input[disabled]) {
  background-color: #f5f5f5;
  color: rgba(0, 0, 0, 0.85);
}

:deep(.ant-select-disabled .ant-select-selector) {
  background-color: #f5f5f5;
  color: rgba(0, 0, 0, 0.85);
}
</style>