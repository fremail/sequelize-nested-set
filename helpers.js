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

function generateLevel(tree, limit = false) {
    const newTree = [];
    const rightValues = {};
    let prevLft = 0;
    let prevRgt = 0;
    let level = -1;
    tree.forEach((node) => {
        if (prevLft === node.lft - 1) {
            level++;
            rightValues[level] = node.rgt;
        }
        if (prevRgt < node.lft - 1) {
            level -= node.lft - prevRgt;
        }
        prevLft = node.lft;
        prevRgt = node.rgt;
        // if (limit && level > limit) {
        //     return;
        // }
        node.level = level;
        newTree.push(node);
    });
    return newTree;
}

module.exports = {
    cloneDeep,
    generateLevel,
    warnDeprecated,
};
