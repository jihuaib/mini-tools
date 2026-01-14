// 主题管理 store
import { applyTheme } from '../../utils/themes';

const state = {
    currentTheme: localStorage.getItem('app-theme') || 'purple'
};

const mutations = {
    SET_THEME(state, themeId) {
        state.currentTheme = themeId;
        localStorage.setItem('app-theme', themeId);
    }
};

const actions = {
    setTheme({ commit }, themeId) {
        commit('SET_THEME', themeId);
        // 动态应用主题
        applyTheme(themeId);
    }
};

const getters = {
    currentTheme: state => state.currentTheme
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};
