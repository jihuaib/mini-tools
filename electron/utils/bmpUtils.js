const BmpConst = require('../const/bmpConst');

function getInitiationTlvName(tlvType) {
    switch (tlvType) {
        case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_NAME:
            return 'sysName';
        case BmpConst.BMP_INITIATION_TLV_TYPE.SYS_DESC:
            return 'sysDesc';
        default:
            return `tlv${tlvType}`;
    }
}

module.exports = { getInitiationTlvName };
