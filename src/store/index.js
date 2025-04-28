import { createStore } from 'vuex';

// State for tracking cached views
const state = {
    cachedViews: []
};

// Mutations to modify cached views
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

// Actions for cached views operations
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
    actions
});
