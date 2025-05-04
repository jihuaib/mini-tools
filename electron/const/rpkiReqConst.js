// RPKI request types for worker communication
const RPKI_REQ_TYPES = {
    START_RPKI: 'start-rpki',
    STOP_RPKI: 'stop-rpki',
    GET_CLIENT_LIST: 'get-client-list',
    GET_CLIENT: 'get-client',
    DISCONNECT_CLIENT: 'disconnect-client',
    GET_ROA_LIST: 'get-roa-list',
    ADD_ROA: 'add-roa',
    UPDATE_ROA: 'update-roa',
    DELETE_ROA: 'delete-roa',
    CLEAR_ALL_ROA: 'clear-all-roa'
};

module.exports = {
    RPKI_REQ_TYPES
};
