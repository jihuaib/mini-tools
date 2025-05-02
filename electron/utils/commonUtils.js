function BIT_SET(flags, flag) {
    return flags | flag;
}

function BIT_RESET(flags, flag) {
    return flags & ~flag;
}

function BIT_TEST(flags, flag) {
    return (flags & flag) !== 0;
}

module.exports = { BIT_SET, BIT_RESET, BIT_TEST };
