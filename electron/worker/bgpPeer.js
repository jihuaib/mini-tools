const BgpConst = require('../const/bgpConst');
const { BGP_EVT_TYPES } = require('../const/bgpEvtConst');
const { writeUInt32, ipToBytes, writeUInt16, getIpType } = require('../utils/ipUtils');
const { getAddrFamilyType } = require('../utils/bgpUtils');
const logger = require('../log/logger');
const CommonUtils = require('../utils/commonUtils');
class BgpPeer {
    constructor(session, instance) {
        this.peerState = BgpConst.BGP_PEER_STATE.IDLE;
        this.session = session;
        this.instance = instance;
    }

    changePeerState(state) {
        if (state !== BgpConst.BGP_PEER_STATE.IDLE) {
            if (this.peerState == BgpConst.BGP_PEER_STATE.NO_NEG) {
                return;
            }
        }

        logger.info(
            `peer ${this.session.peerIp} fsm state ${BgpConst.BGP_PEER_STATE_NAME[this.peerState]} -> ${BgpConst.BGP_PEER_STATE_NAME[state]}`
        );

        this.peerState = state;

        const peerInfo = this.getPeerInfo();

        // 发送状态变更事件
        this.session.messageHandler.sendEvent(BGP_EVT_TYPES.BGP_PEER_CHANGE, { data: peerInfo });
    }

    resetPeer() {
        logger.info(
            `peer ${this.session.peerIp} fsm state ${BgpConst.BGP_PEER_STATE_NAME[this.peerState]} -> ${BgpConst.BGP_PEER_STATE_NAME[BgpConst.BGP_PEER_STATE.IDLE]}`
        );

        this.peerState = BgpConst.BGP_PEER_STATE.IDLE;

        const peerInfo = this.getPeerInfo();

        // 发送状态变更事件
        this.session.messageHandler.sendEvent(BGP_EVT_TYPES.BGP_PEER_CHANGE, { data: peerInfo });
    }

    getPeerInfo() {
        const addressFamily = getAddrFamilyType(this.instance.afi, this.instance.safi);
        return {
            vrfIndex: this.instance.vrfIndex,
            localIp: this.session.localIp,
            localAs: this.session.localAs,
            peerIp: this.session.peerIp,
            peerAs: this.session.peerAs,
            routerId: this.session.routerId,
            peerState: BgpConst.BGP_PEER_STATE_NAME[this.peerState],
            addressFamily: addressFamily,
            peerType: this.session.peerType
        };
    }

    buildPathAttribute(type, flags, value) {
        const attr = [];
        attr.push(flags);
        attr.push(type);
        if (value.length > 255) {
            attr.push(...writeUInt16(value.length));
        } else {
            attr.push(value.length);
        }
        attr.push(...value);
        return attr;
    }

    buildMpReachNlriAttribute(routes, routeIndex, msgLen) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_REACH_NLRI);
        msgLen += 2;

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度
        msgLen += 2;

        // AFI and SAFI
        attr.push(...writeUInt16(this.instance.afi));
        attr.push(this.instance.safi);
        msgLen += 3;

        // Next Hop
        if (CommonUtils.BIT_TEST(this.session.localCapFlags, BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING)) {
            const nextHopBytes = ipToBytes(`${this.session.localIp}`);
            attr.push(nextHopBytes.length);
            attr.push(...nextHopBytes);
            msgLen += 1 + nextHopBytes.length;
        } else {
            const nextHopBytes = ipToBytes(`::ffff:${this.session.localIp}`);
            attr.push(nextHopBytes.length);
            attr.push(...nextHopBytes);
            msgLen += 1 + nextHopBytes.length;
        }

        // Reserved
        attr.push(0x00);
        msgLen += 1;

        // NLRI
        let route = routes[routeIndex];
        let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
        let nlriLen = 1 + prefixLength;
        while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
            attr.push(route.mask); // 前缀长度（单位bit）
            const prefixBytes = ipToBytes(route.ip);
            attr.push(...prefixBytes.slice(0, prefixLength));

            routeIndex++;
            msgLen += nlriLen;
            if (routeIndex < routes.length) {
                route = routes[routeIndex];
                prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                nlriLen = 1 + prefixLength;
            } else {
                break;
            }
        }

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return { index: routeIndex, attr: attr };
    }

    buildMpUnreachNlriAttribute(routes, msgLen, routeIndex) {
        const attr = [];
        attr.push(BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL | BgpConst.BGP_PATH_ATTR_FLAGS.EXTENDED_LENGTH);
        attr.push(BgpConst.BGP_PATH_ATTR.MP_UNREACH_NLRI);
        msgLen += 2;

        // 记录长度位置，稍后更新
        const lengthPos = attr.length;
        attr.push(0x00, 0x00); // 占位长度
        msgLen += 2;

        // AFI and SAFI
        attr.push(...writeUInt16(this.instance.afi));
        attr.push(this.instance.safi);
        msgLen += 3;

        // NLRI
        let route = routes[routeIndex];
        let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
        let nlriLen = 1 + prefixLength;
        while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
            attr.push(route.mask); // 前缀长度（单位bit）
            const prefixBytes = ipToBytes(route.ip);
            attr.push(...prefixBytes.slice(0, prefixLength));

            routeIndex++;
            msgLen += nlriLen;
            if (routeIndex < routes.length) {
                route = routes[routeIndex];
                prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                nlriLen = 1 + prefixLength;
            } else {
                break;
            }
        }

        // 更新长度
        const length = attr.length - lengthPos - 2;
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(length, 0);
        attr[lengthPos] = lengthBuf[0];
        attr[lengthPos + 1] = lengthBuf[1];

        return { index: routeIndex, attr: attr };
    }

    buildUpdateMsgIpv6(routes, routeIndex) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建路径属性
            let asPath = [];
            let localPref = [];
            if (this.session.peerType === BgpConst.BGP_PEER_TYPE.PEER_TYPE_EBGP) {
                asPath = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.AS_PATH,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [0x02, 0x01, ...writeUInt32(this.session.localAs)] // AS_SEQUENCE
                );
            } else {
                asPath = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.AS_PATH,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [] // AS_SEQUENCE
                );
                localPref = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.LOCAL_PREF,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    writeUInt32(100)
                );
            }

            const pathAttr = [
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.ORIGIN,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [0x00] // IGP
                ),
                ...asPath,
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.MED,
                    BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL,
                    writeUInt32(0)
                ),
                ...localPref
            ];

            // 添加自定义属性
            if (this.instance.customAttr?.trim()) {
                try {
                    const customPathAttr = this.session.processCustomPkt(this.instance.customAttr);
                    pathAttr.push(...customPathAttr);
                } catch (error) {
                    logger.error(`Error processing custom path attribute: ${error.message}`);
                    return {
                        status: false,
                        index: routeIndex,
                        buffer: null
                    };
                }
            }

            const msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + 2 + pathAttr.length; // 固定长度

            const mpNlriAttrResult = this.buildMpReachNlriAttribute(routes, routeIndex, msgLen);
            pathAttr.push(...mpNlriAttrResult.attr);

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建消息头
            const bufHeader = this.session.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);
            return {
                status: true,
                index: mpNlriAttrResult.index,
                buffer: buffer
            };
        } catch (error) {
            logger.error(`Error building IPv6 UPDATE message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildUpdateMsgIpv4(routes, routeIndex) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            // 构建路径属性
            let asPath = [];
            let localPref = [];
            if (this.session.peerType === BgpConst.BGP_PEER_TYPE.PEER_TYPE_EBGP) {
                asPath = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.AS_PATH,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [0x02, 0x01, ...writeUInt32(this.session.localAs)] // AS_SEQUENCE
                );
            } else {
                asPath = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.AS_PATH,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [] // AS_SEQUENCE
                );
                localPref = this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.LOCAL_PREF,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    writeUInt32(100)
                );
            }

            const pathAttr = [
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.ORIGIN,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    [0x00] // IGP
                ),
                ...asPath,
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.NEXT_HOP,
                    BgpConst.BGP_PATH_ATTR_FLAGS.TRANSITIVE,
                    ipToBytes(this.session.localIp)
                ),
                ...this.buildPathAttribute(
                    BgpConst.BGP_PATH_ATTR.MED,
                    BgpConst.BGP_PATH_ATTR_FLAGS.OPTIONAL,
                    writeUInt32(0)
                ),
                ...localPref
            ];

            // 添加自定义属性
            if (this.instance.customAttr?.trim()) {
                try {
                    const customPathAttr = this.session.processCustomPkt(this.instance.customAttr);
                    pathAttr.push(...customPathAttr);
                } catch (error) {
                    logger.error(`Error processing custom path attribute: ${error.message}`);
                    return {
                        status: false,
                        index: routeIndex,
                        buffer: null
                    };
                }
            }

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(pathAttr.length + 2);
            pathAttrBuf.writeUInt16BE(pathAttr.length, 0);
            pathAttrBuf.set(pathAttr, 2);

            // 构建NLRI
            const nlri = [];
            let msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length;

            let route = routes[routeIndex];
            let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            let nlriLen = 1 + prefixLength;
            while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
                nlri.push(route.mask); // 前缀长度（单位bit）
                const prefixBytes = ipToBytes(route.ip);
                nlri.push(...prefixBytes.slice(0, prefixLength));

                routeIndex++;
                msgLen += nlriLen;
                if (routeIndex < routes.length) {
                    route = routes[routeIndex];
                    prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                    nlriLen = 1 + prefixLength;
                } else {
                    break;
                }
            }

            const nlriBuf = Buffer.alloc(nlri.length);
            nlriBuf.set(nlri);

            // 构建消息头
            const bufHeader = this.session.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length + nlriBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf, nlriBuf]);
            return {
                status: true,
                index: routeIndex,
                buffer: buffer
            };
        } catch (error) {
            logger.error(`Error building IPv4 UPDATE message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildWithdrawMsgIpv4(routes, routeIndex) {
        try {
            const pathAttrBuf = Buffer.alloc(2);
            pathAttrBuf.writeUInt16BE(0, 0);

            const withdrawNlri = [];
            let msgLen = BgpConst.BGP_HEAD_LEN + pathAttrBuf.length + 2; // 固定长度

            let route = routes[routeIndex];
            let prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
            let nlriLen = 1 + prefixLength;
            while (msgLen + nlriLen < BgpConst.BGP_MAX_PKT_SIZE && routeIndex < routes.length) {
                withdrawNlri.push(route.mask); // 前缀长度（单位bit）
                const prefixBytes = ipToBytes(route.ip);
                withdrawNlri.push(...prefixBytes.slice(0, prefixLength));

                routeIndex++;
                msgLen += nlriLen;
                if (routeIndex < routes.length) {
                    route = routes[routeIndex];
                    prefixLength = Math.ceil(route.mask / 8); // 计算需要的字节数
                    nlriLen = 1 + prefixLength;
                } else {
                    break;
                }
            }

            const withdrawNlriBuf = Buffer.alloc(withdrawNlri.length + 2);
            withdrawNlriBuf.writeUInt16BE(withdrawNlri.length, 0);
            withdrawNlriBuf.set(withdrawNlri, 2);

            const bufHeader = this.session.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawNlriBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawNlriBuf, pathAttrBuf]);
            return {
                status: true,
                index: routeIndex,
                buffer: buffer
            };
        } catch (error) {
            logger.error(`Error building IPv4 WITHDRAW message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    buildWithdrawMsgIpv6(routes, routeIndex) {
        try {
            // 构建撤销路由缓冲区
            const withdrawnRoutesBuf = Buffer.alloc(2);
            withdrawnRoutesBuf.writeUInt16BE(0, 0);

            const msgLen = BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + 2; // 固定长度

            // 构建路径属性
            const mpUnReachAttrResult = this.buildMpUnreachNlriAttribute(routes, msgLen, routeIndex);

            // 构建路径属性缓冲区
            const pathAttrBuf = Buffer.alloc(mpUnReachAttrResult.attr.length + 2);
            pathAttrBuf.writeUInt16BE(mpUnReachAttrResult.attr.length, 0);
            pathAttrBuf.set(mpUnReachAttrResult.attr, 2);

            // 构建消息头
            const bufHeader = this.session.buildBgpMessageHeader(
                BgpConst.BGP_HEAD_LEN + withdrawnRoutesBuf.length + pathAttrBuf.length,
                BgpConst.BGP_PACKET_TYPE.UPDATE
            );

            const buffer = Buffer.concat([bufHeader, withdrawnRoutesBuf, pathAttrBuf]);

            return {
                status: true,
                index: mpUnReachAttrResult.index,
                buffer: buffer
            };
        } catch (error) {
            logger.error(`Error building IPv6 WITHDRAW message: ${error.message}`);
            return {
                status: false,
                index: routeIndex,
                buffer: null
            };
        }
    }

    sendRoute() {
        let routeIndex = 0;
        let routes = [];

        if (this.peerState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
            return;
        }

        this.instance.routeMap.forEach((route, _) => {
            routes.push(route);
        });

        const ipType = getIpType(this.session.peerIp);

        if (
            this.instance.afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 &&
            this.instance.safi === BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
        ) {
            if (CommonUtils.BIT_TEST(this.session.localCapFlags, BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING)) {
                while (routeIndex < routes.length) {
                    const result = this.buildUpdateMsgIpv6(routes, routeIndex);
                    if (result.status) {
                        this.session.sendRoute(result.buffer);
                        routeIndex = result.index;
                    } else {
                        break;
                    }
                }
            } else if (ipType === BgpConst.IP_TYPE.IPV4) {
                // 没使能EXTENDED_NEXT_HOP_ENCODING的话，需要ipv4邻居才发送
                while (routeIndex < routes.length) {
                    const result = this.buildUpdateMsgIpv4(routes, routeIndex);
                    if (result.status) {
                        this.session.sendRoute(result.buffer);
                        routeIndex = result.index;
                    } else {
                        break;
                    }
                }
            }
        } else if (
            this.instance.afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6 &&
            this.instance.safi === BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
        ) {
            while (routeIndex < routes.length) {
                const result = this.buildUpdateMsgIpv6(routes, routeIndex);
                if (result.status) {
                    this.session.sendRoute(result.buffer);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        }
    }

    withdrawRoute(withdrawnRoutes) {
        let routeIndex = 0;

        if (this.peerState !== BgpConst.BGP_PEER_STATE.ESTABLISHED) {
            return;
        }

        if (
            this.instance.afi === BgpConst.BGP_AFI_TYPE.AFI_IPV4 &&
            this.instance.safi === BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
        ) {
            if (CommonUtils.BIT_TEST(this.session.localCapFlags, BgpConst.BGP_CAP_FLAGS.EXTENDED_NEXT_HOP_ENCODING)) {
                while (routeIndex < withdrawnRoutes.length) {
                    const result = this.buildWithdrawMsgIpv6(withdrawnRoutes, routeIndex);
                    if (result.status) {
                        this.session.sendRoute(result.buffer);
                        routeIndex = result.index;
                    } else {
                        break;
                    }
                }
            } else {
                while (routeIndex < withdrawnRoutes.length) {
                    const result = this.buildWithdrawMsgIpv4(withdrawnRoutes, routeIndex);
                    if (result.status) {
                        this.session.sendRoute(result.buffer);
                        routeIndex = result.index;
                    } else {
                        break;
                    }
                }
            }
        } else if (
            this.instance.afi === BgpConst.BGP_AFI_TYPE.AFI_IPV6 &&
            this.instance.safi === BgpConst.BGP_SAFI_TYPE.SAFI_UNICAST
        ) {
            while (routeIndex < withdrawnRoutes.length) {
                const result = this.buildWithdrawMsgIpv6(withdrawnRoutes, routeIndex);
                if (result.status) {
                    this.session.sendRoute(result.buffer);
                    routeIndex = result.index;
                } else {
                    break;
                }
            }
        }
    }
}

module.exports = BgpPeer;
