const _ = require('lodash');

function cloneDeep(obj) {
    obj = obj || {};
    return _.cloneDeepWith(obj, (elem) => {
        // Do not try to customize cloning of arrays or POJOs
        if (Array.isArray(elem) || _.isPlainObject(elem)) {
            return undefined;
        }

        // Don't clone stuff that's an object, but not a plain one - fx example sequelize models and instances
        if (typeof elem === 'object') {
            return elem;
        }

        // Preserve special data-types like `fn` across clones. _.get() is used for checking up the prototype chain
        if (elem && typeof elem.clone === 'function') {
            return elem.clone();
        }
    });
}

function warnDeprecated(message) {
    console.warn(`DEPRECATED: ${message}`);
}

module.exports = {
    cloneDeep,
    warnDeprecated,
};
