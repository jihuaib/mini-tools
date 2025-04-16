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
            <a-form-item label="Local AS" name="localAs">
              <a-tooltip :title="validationErrors.localAs" :open="!!validationErrors.localAs">
                <a-input v-model:value="bgpData.localAs" @blur="validateLocalAs" :status="validationErrors.localAs ? 'error' : ''"/>
              </a-tooltip>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Peer IP" name="peerIp">
              <a-tooltip :title="validationErrors.peerIp" :open="!!validationErrors.peerIp">
                <a-input v-model:value="bgpData.peerIp" @blur="validatePeerIp" :status="validationErrors.peerIp ? 'error' : ''"/>
              </a-tooltip>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Peer AS" name="peerAs">
              <a-tooltip :title="validationErrors.peerAs" :open="!!validationErrors.peerAs">
                <a-input v-model:value="bgpData.peerAs" @blur="validatePeerAs" :status="validationErrors.peerAs ? 'error' : ''"/>
              </a-tooltip>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Router ID" name="routerId">
              <a-tooltip :title="validationErrors.routerId" :open="!!validationErrors.routerId">
                <a-input v-model:value="bgpData.routerId" @blur="validateRouterId" :status="validationErrors.routerId ? 'error' : ''"/>
              </a-tooltip>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Hold Time" name="holdTime">
              <a-tooltip :title="validationErrors.holdTime" :open="!!validationErrors.holdTime">
                <a-input v-model:value="bgpData.holdTime" @blur="validateHoldTime" :status="validationErrors.holdTime ? 'error' : ''"/>
              </a-tooltip>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Open Cap" name="openCap">
          <a-space>
            <a-checkbox-group v-model:value="bgpData.openCap" :options="openCapOptions" />
            <a-button type="link" @click="showCustomOpenCap" class="custom-route-btn">
              <template #icon><SettingOutlined /></template>
              配置自定义能力
            </a-button>
          </a-space>
        </a-form-item>

        <a-row>
          <a-col :span="12">
            <a-form-item label="Addr Family" name="addressFamily">
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

        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
          <a-space size="middle">
            <a-button type="primary" html-type="submit">启动</a-button>
            <a-button type="primary" danger @click="stopBgp">停止</a-button>
          </a-space>
        </a-form-item>

        <a-divider>路由配置</a-divider>
        <a-form-item label="IP类型" name="ipType">
          <a-radio-group v-model:value="bgpData.routeConfig.ipType">
            <a-radio value="ipv4">IPv4</a-radio>
            <a-radio value="ipv6">IPv6</a-radio>
          </a-radio-group>
        </a-form-item>

        <!-- IPv4 Route Configuration -->
        <div v-show="bgpData.routeConfig.ipType === 'ipv4'">
          <a-row>
            <a-col :span="8">
              <a-form-item label="Prefix" name="ipv4RouteConfig.prefix">
                <a-tooltip :title="validationErrors.ipv4Prefix" :open="!!validationErrors.ipv4Prefix">
                  <a-input v-model:value="bgpData.ipv4RouteConfig.prefix" @blur="validateIpv4Prefix" :status="validationErrors.ipv4Prefix ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="Mask" name="ipv4RouteConfig.mask">
                <a-tooltip :title="validationErrors.ipv4Mask" :open="!!validationErrors.ipv4Mask">
                  <a-input v-model:value="bgpData.ipv4RouteConfig.mask" @blur="validateIpv4Mask" :status="validationErrors.ipv4Mask ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="Count" name="ipv4RouteConfig.count">
                <a-tooltip :title="validationErrors.ipv4Count" :open="!!validationErrors.ipv4Count">
                  <a-input v-model:value="bgpData.ipv4RouteConfig.count" @blur="validateIpv4Count" :status="validationErrors.ipv4Count ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <!-- IPv6 Route Configuration -->
        <div v-show="bgpData.routeConfig.ipType === 'ipv6'">
          <a-row>
            <a-col :span="8">
              <a-form-item label="Prefix" name="ipv6RouteConfig.prefix">
                <a-tooltip :title="validationErrors.ipv6Prefix" :open="!!validationErrors.ipv6Prefix">
                  <a-input v-model:value="bgpData.ipv6RouteConfig.prefix" @blur="validateIpv6Prefix" :status="validationErrors.ipv6Prefix ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="Mask" name="ipv6RouteConfig.mask">
                <a-tooltip :title="validationErrors.ipv6Mask" :open="!!validationErrors.ipv6Mask">
                  <a-input v-model:value="bgpData.ipv6RouteConfig.mask" @blur="validateIpv6Mask" :status="validationErrors.ipv6Mask ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="Count" name="ipv6RouteConfig.count">
                <a-tooltip :title="validationErrors.ipv6Count" :open="!!validationErrors.ipv6Count">
                  <a-input v-model:value="bgpData.ipv6RouteConfig.count" @blur="validateIpv6Count" :status="validationErrors.ipv6Count ? 'error' : ''"/>
                </a-tooltip>
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <a-form-item>
          <a-button type="link" @click="showCustomRouteAttr" class="custom-route-btn">
            <template #icon><SettingOutlined /></template>
            配置自定义路由属性
          </a-button>
        </a-form-item>
        <a-form-item :wrapper-col="{ offset: 10, span: 20 }">
          <a-space>
            <a-button type="primary" @click="sendRoutes">发送路由</a-button>
            <a-button type="primary" danger @click="withdrawRoutes">撤销路由</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-col>

    <a-col :span="8" class="log-column">
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

  <CustomPktDrawer
    v-model:visible="customIpv4RouteAttrVisible"
    v-model:inputValue="bgpData.ipv4RouteConfig.customAttr"
    @submit="handleCustomIpv4RouteAttrSubmit"
  />

  <CustomPktDrawer
    v-model:visible="customIpv6RouteAttrVisible"
    v-model:inputValue="bgpData.ipv6RouteConfig.customAttr"
    @submit="handleCustomIpv6RouteAttrSubmit"
  />
</template>

<script setup>
import {onMounted, ref, toRaw, watch } from 'vue'
import ScrollTextarea from "../components/ScrollTextarea.vue";
import CustomPktDrawer from "../components/CustomPktDrawer.vue";
import {message} from "ant-design-vue";
import { debounce } from 'lodash-es';
import { SettingOutlined } from '@ant-design/icons-vue';

defineOptions({
  name: 'BgpEmulator'
})

const labelCol = { style: { width: '100px' } };
const wrapperCol = { span: 40 };

const openCapOptions = [
  { label: 'Addr Family', value: 'Addr Family', disabled: true },
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
  openCap:['Addr Family', 'Route-Refresh', 'AS4'],
  addressFamily: ['Ipv4-UNC'],
  peerState:'',
  role: '',
  openCapCustom: '',
  ipv4RouteConfig: {
    prefix: '1.1.1.1',
    mask: '32',
    count: '10',
    customAttr: ''
  },
  ipv6RouteConfig: {
    prefix: '2001:db8::',
    mask: '64',
    count: '10',
    customAttr: ''
  },
  routeConfig: {
    ipType: 'ipv4'
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
  ipv4RouteConfig: {
    prefix: '',
    mask: '',
    count: '',
    customAttr: ''
  },
  ipv6RouteConfig: {
    prefix: '',
    mask: '',
    count: '',
    customAttr: ''
  },
  routeConfig: {
    ipType: ''
  }
}

const saveDebounced = debounce((data) => {
  window.bgpEmulatorApi.saveBgpConfig(data);
}, 300)

watch([bgpData], async ([newBgpValue]) => {
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
  saveBgpConfig.ipv4RouteConfig = { ...newBgpValue.ipv4RouteConfig };
  saveBgpConfig.ipv6RouteConfig = { ...newBgpValue.ipv6RouteConfig };
  saveBgpConfig.routeConfig = { ...newBgpValue.routeConfig };
  
  try {
    clearValidationErrors();
    validateLocalAs();
    validatePeerIp();
    validatePeerAs();
    validateRouterId();
    validateHoldTime();
    
    validateIpv4Prefix();
    validateIpv4Mask();
    validateIpv4Count();

    validateIpv6Prefix();
    validateIpv6Mask();
    validateIpv6Count();


    // Check if there are any validation errors
    const hasErrors = Object.values(validationErrors.value).some(error => error !== '');
    
    if (hasErrors) {
      console.log('Validation failed, configuration not saved');
      return;
    }

    const raw = toRaw(saveBgpConfig);
    saveDebounced(raw);
  } catch (error) {
    // Form validation failed, don't save
    console.log('Form validation failed, configuration not saved');
  }
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
    
    // Load route configurations
    if (savedConfig.data.ipv4RouteConfig) {
      bgpData.value.ipv4RouteConfig = {
        prefix: savedConfig.data.ipv4RouteConfig.prefix || '',
        mask: savedConfig.data.ipv4RouteConfig.mask || '',
        count: savedConfig.data.ipv4RouteConfig.count || '',
        customAttr: savedConfig.data.ipv4RouteConfig.customAttr || ''
      };
    }
    
    if (savedConfig.data.ipv6RouteConfig) {
      bgpData.value.ipv6RouteConfig = {
        prefix: savedConfig.data.ipv6RouteConfig.prefix || '',
        mask: savedConfig.data.ipv6RouteConfig.mask || '',
        count: savedConfig.data.ipv6RouteConfig.count || '',
        customAttr: savedConfig.data.ipv6RouteConfig.customAttr || ''
      };
    }
    
    if (savedConfig.data.routeConfig) {
      bgpData.value.routeConfig.ipType = savedConfig.data.routeConfig.ipType || 'ipv4';
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

const customIpv4RouteAttrVisible = ref(false)
const customIpv6RouteAttrVisible = ref(false)

const showCustomRouteAttr = () => {
  if (bgpData.value.routeConfig.ipType === 'ipv4') {
    customIpv4RouteAttrVisible.value = true
  } else {
    customIpv6RouteAttrVisible.value = true
  }
}

const handleCustomIpv4RouteAttrSubmit = (data) => {
  console.log(data)
  bgpData.value.ipv4RouteConfig.customAttr = data
}

const handleCustomIpv6RouteAttrSubmit = (data) => {
  console.log(data)
  bgpData.value.ipv6RouteConfig.customAttr = data
}

// Add validation errors ref
const validationErrors = ref({
  localAs: '',
  peerIp: '',
  peerAs: '',
  routerId: '',
  holdTime: '',
  ipv4Prefix: '',
  ipv4Mask: '',
  ipv4Count: '',
  ipv6Prefix: '',
  ipv6Mask: '',
  ipv6Count: ''
});

// Add clearValidationErrors function
const clearValidationErrors = () => {
  Object.keys(validationErrors.value).forEach(key => {
    validationErrors.value[key] = '';
  });
};

// Validation functions
const validateLocalAs = () => {
  if (!bgpData.value.localAs) {
    validationErrors.value.localAs = '请输入Local AS';
  } else if (!/^\d+$/.test(bgpData.value.localAs)) {
    validationErrors.value.localAs = '请输入数字';
  } else {
    validationErrors.value.localAs = '';
  }
};

const validatePeerIp = () => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!bgpData.value.peerIp) {
    validationErrors.value.peerIp = '请输入Peer IP';
  } else if (!ipv4Regex.test(bgpData.value.peerIp)) {
    validationErrors.value.peerIp = '请输入有效的IPv4地址';
  } else {
    validationErrors.value.peerIp = '';
  }
};

const validatePeerAs = () => {
  if (!bgpData.value.peerAs) {
    validationErrors.value.peerAs = '请输入Peer AS';
  } else if (!/^\d+$/.test(bgpData.value.peerAs)) {
    validationErrors.value.peerAs = '请输入数字';
  } else {
    validationErrors.value.peerAs = '';
  }
};

const validateRouterId = () => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!bgpData.value.routerId) {
    validationErrors.value.routerId = '请输入Router ID';
  } else if (!ipv4Regex.test(bgpData.value.routerId)) {
    validationErrors.value.routerId = '请输入有效的IPv4地址';
  } else {
    validationErrors.value.routerId = '';
  }
};

const validateHoldTime = () => {
  if (!bgpData.value.holdTime) {
    validationErrors.value.holdTime = '请输入holdTime时间';
  } else if (!/^\d+$/.test(bgpData.value.holdTime)) {
    validationErrors.value.holdTime = '请输入数字';
  } else {
    validationErrors.value.holdTime = '';
  }
};

const validateIpv4Prefix = () => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!bgpData.value.ipv4RouteConfig.prefix) {
    validationErrors.value.ipv4Prefix = '请输入Prefix';
  } else if (!ipv4Regex.test(bgpData.value.ipv4RouteConfig.prefix)) {
    validationErrors.value.ipv4Prefix = '请输入有效的IPv4地址';
  } else {
    validationErrors.value.ipv4Prefix = '';
  }
};

const validateIpv4Mask = () => {
  if (!bgpData.value.ipv4RouteConfig.mask) {
    validationErrors.value.ipv4Mask = '请输入Mask';
  } else if (!/^(?:[0-9]|[1-2][0-9]|3[0-2])$/.test(bgpData.value.ipv4RouteConfig.mask)) {
    validationErrors.value.ipv4Mask = '请输入0-32之间的数字';
  } else {
    validationErrors.value.ipv4Mask = '';
  }
};

const validateIpv4Count = () => {
  if (!bgpData.value.ipv4RouteConfig.count) {
    validationErrors.value.ipv4Count = '请输入Count';
  } else if (!/^\d+$/.test(bgpData.value.ipv4RouteConfig.count)) {
    validationErrors.value.ipv4Count = '请输入数字';
  } else {
    validationErrors.value.ipv4Count = '';
  }
};

const validateIpv6Prefix = () => {
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  if (!bgpData.value.ipv6RouteConfig.prefix) {
    validationErrors.value.ipv6Prefix = '请输入Prefix';
  } else if (!ipv6Regex.test(bgpData.value.ipv6RouteConfig.prefix)) {
    validationErrors.value.ipv6Prefix = '请输入有效的IPv6地址';
  } else {
    validationErrors.value.ipv6Prefix = '';
  }
};

const validateIpv6Mask = () => {
  if (!bgpData.value.ipv6RouteConfig.mask) {
    validationErrors.value.ipv6Mask = '请输入Mask';
  } else if (!/^(?:[0-9]|[1-9][0-9]|1[0-2][0-8])$/.test(bgpData.value.ipv6RouteConfig.mask)) {
    validationErrors.value.ipv6Mask = '请输入0-128之间的数字';
  } else {
    validationErrors.value.ipv6Mask = '';
  }
};

const validateIpv6Count = () => {
  if (!bgpData.value.ipv6RouteConfig.count) {
    validationErrors.value.ipv6Count = '请输入Count';
  } else if (!/^\d+$/.test(bgpData.value.ipv6RouteConfig.count)) {
    validationErrors.value.ipv6Count = '请输入数字';
  } else {
    validationErrors.value.ipv6Count = '';
  }
};

const startBgp = async () => {
  clearValidationErrors();
  validateLocalAs();
  validatePeerIp();
  validatePeerAs();
  validateRouterId();
  validateHoldTime();
  
  const hasErrors = Object.values(validationErrors.value).some(error => error !== '');
  
  if (hasErrors) {
    message.error('请检查BGP配置信息是否正确');
    return;
  }

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

// Modify sendRoutes function to use manual validation
const sendRoutes = async () => {
  try {
    const currentConfig = bgpData.value.routeConfig.ipType === 'ipv4' 
      ? bgpData.value.ipv4RouteConfig 
      : bgpData.value.ipv6RouteConfig;

    clearValidationErrors();
    if (bgpData.value.routeConfig.ipType === 'ipv4') {
      validateIpv4Prefix();
      validateIpv4Mask();
      validateIpv4Count();
    } else {
      validateIpv6Prefix();
      validateIpv6Mask();
      validateIpv6Count();
    }

    // Check if there are any validation errors
    const hasErrors = Object.values(validationErrors.value).some(error => error !== '');
    
    if (hasErrors) {
      message.error('请检查路由配置信息是否正确');
      return;
    }

    const result = await window.bgpEmulatorApi.sendRoutes({
      ...currentConfig,
      ipType: bgpData.value.routeConfig.ipType
    });
    
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

// Modify withdrawRoutes function to use manual validation
const withdrawRoutes = async () => {
  try {
    const currentConfig = bgpData.value.routeConfig.ipType === 'ipv4' 
      ? bgpData.value.ipv4RouteConfig 
      : bgpData.value.ipv6RouteConfig;

    // Run appropriate validations based on IP type
    if (bgpData.value.routeConfig.ipType === 'ipv4') {
      validateIpv4Prefix();
      validateIpv4Mask();
      validateIpv4Count();
    } else {
      validateIpv6Prefix();
      validateIpv6Mask();
      validateIpv6Count();
    }

    // Check if there are any validation errors
    const hasErrors = Object.values(validationErrors.value).some(error => error !== '');
    
    if (hasErrors) {
      message.error('请检查路由配置信息是否正确');
      return;
    }

    const result = await window.bgpEmulatorApi.withdrawRoutes({
      ...currentConfig,
      ipType: bgpData.value.routeConfig.ipType
    });
    
    if (result.status === 'success') {
      message.success('路由撤销成功');
    } else {
      message.error(result.msg || '路由撤销失败');
    }
  } catch (e) {
    console.error(e);
    message.error('路由撤销失败');
  }
};
</script>

<style scoped>
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

.custom-route-btn {
  color: #1890ff;
  padding: 0;
  height: 32px;
  font-size: 14px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.custom-route-btn:hover {
  color: #40a9ff;
}

.custom-route-btn:active {
  color: #096dd9;
}

/* 调整路由配置部分的间距 */
:deep(.ant-form-item) {
  margin-bottom: 16px;
}

:deep(.ant-radio-group) {
  margin-bottom: 8px;
}

/* 调整日志区域的间距 */
.log-column {
  padding-left: 24px;
  margin-top: 10px;
}

/* 调整路由配置输入框的间距 */
:deep(.ant-row) {
  margin-bottom: 8px;
}

:deep(.ant-col) {
  padding-right: 8px;
}

:deep(.ant-col:last-child) {
  padding-right: 0;
}

/* Remove error message styling since we're using tooltips now */
.error-message {
  display: none;
}

/* Update error input styling */
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

/* Add tooltip styling */
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
</style>