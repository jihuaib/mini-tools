import { createStore } from 'vuex';
import theme from './modules/theme';

// 用于跟踪缓存视图的状态
const state = {
    cachedViews: []
};

// 修改缓存视图的变异
const mutations = {
    ADD_CACHED_VIEW: (state, view) => {
        if (state.cachedViews.includes(view.name)) return;
        if (view.meta && view.meta.keepAlive) {
            state.cachedViews.push(view.name);
        }
    },
    DEL_CACHED_VIEW: (state, view) => {
        const index = state.cachedViews.indexOf(view.name);
        index > -1 && state.cachedViews.splice(index, 1);
    },
    RESET_CACHED_VIEWS: state => {
        state.cachedViews = [];
    }
};

// 缓存视图操作的行动
const actions = {
    addCachedView({ commit }, view) {
        commit('ADD_CACHED_VIEW', view);
    },
    delCachedView({ commit }, view) {
        commit('DEL_CACHED_VIEW', view);
    },
    resetCachedViews({ commit }) {
        commit('RESET_CACHED_VIEWS');
    }
};

export default createStore({
    state,
    mutations,
    actions,
    modules: {
        theme
    }
});
