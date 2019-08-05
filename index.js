const {cloneDeep, warnDeprecated} = require('./helpers');

const Sequelize = require('sequelize');

module.exports = function (sequelize, DataTypes, modelName, attributes = {}, options = {}) {
    const Op = Sequelize.Op;
    const nsOptions = {
        lftColumnName: options.lftColumnName || 'lft',
        rgtColumnName: options.rgtColumnName || 'rgt',
        levelColumnName: options.levelColumnName || 'level',
        hasManyRoots: options.hasManyRoots || false,
        rootColumnName: options.rootColumnName || 'root_id',
        rootColumnType: options.rootColumnType || DataTypes.INTEGER,
    };

    const baseAttributes = {
        lft: {
            type: DataTypes.INTEGER,
            field: nsOptions.lftColumnName,
            allowNull: false,
            defaultValue: 1
        },
        rgt: {
            type: DataTypes.INTEGER,
            field: nsOptions.rgtColumnName,
            allowNull: false,
            defaultValue: 2
        },
        level: {
            type: DataTypes.INTEGER,
            field: nsOptions.levelColumnName,
            allowNull: false,
        },
    };
    if (nsOptions.hasManyRoots) {
        baseAttributes.rootId = {
            type: nsOptions.rootColumnType,
            field: nsOptions.rootColumnName,
            allowNull: false,
        };
    }
    attributes = {...baseAttributes, ...attributes};

    const Model = sequelize.define(modelName, attributes, options);

    /**
     * Create root node from record or create a new one
     * @param {Model} record
     * @param {object} options
     * @return {Promise<Model>}
     */
    Model.createRoot = async function (record, options = {}) {
        if (nsOptions.hasManyRoots) {
            if (record.id && !record.rootId) {
                record.rootId = record.id;
            }
        }

        record.lft = 1;
        record.rgt = 2;
        record.level = 0;
        record.rootId = record.rootId || 0; // 0 as tmp value because the column is not null
        await record.save(options);

        if (nsOptions.hasManyRoots) {
            if (!record.rootId) {
                record.rootId = record.id;
                await record.save();
            }
        }

        return record;
    };

    /**
     * Fetch root node
     * @param {int} rootId
     * @param {object} options
     * @return {Promise<Model|boolean>}
     */
    Model.fetchRoot = async function (rootId = 1, options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = 1;
        options.where.rootId = rootId;
        const root = await Model.findOne(options);

        return root || false;
    };

    /**
     * Fetch tree nodes
     * @param {int} depth use 0 to fetch all
     * @param {int} rootId
     * @param {object} options
     * @return {Promise<Array<Model>|boolean>}
     */
    Model.fetchTree = async function (depth = 0, rootId = 1, options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = {
            [Op.gte]: 1,
        };
        options.where.rootId = rootId;
        if (depth > 0) {
            options.where.level = {
                [Op.between]: [0, depth],
            };
        }
        options.order = options.order || [
            'lft',
        ];

        const nodes = await Model.findAll(options);

        return nodes || false;
    };

    /**
     * Fetch all root nodes
     * @param {object} options
     * @return {Promise<Array<Model>|boolean>}
     */
    Model.fetchRoots = async function (options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = 1;
        const roots = await Model.findAll(options);

        return roots || false;
    };

    /**
     * Test if the node has previous sibling
     * @param {object} options
     * @returns {Promise<boolean>}
     */
    Model.prototype.hasPrevSibling = async function (options = {}) {
        return this.isValidNode(await this.getPrevSibling(options));
    };

    /**
     * Test if the node has next sibling
     * @param {object} options
     * @returns {Promise<boolean>}
     */
    Model.prototype.hasNextSibling = async function (options = {}) {
        return this.isValidNode(await this.getNextSibling(options));
    };

    /**
     * Test if the node has children
     * @returns {boolean}
     */
    Model.prototype.hasChildren = function () {
        return this.rgt - this.lft > 1;
    };

    /**
     * Test if the node has parent
     * @returns {boolean}
     */
    Model.prototype.hasParent = function () {
        return !this.isRoot();
    };

    /**
     * Get previous sibling of the node
     * @param {object} options
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getPrevSibling = async function (options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.rgt = this.lft - 1;
        options.where.rootId = this.rootId;
        const sibling = await Model.findOne(options);

        return sibling || false;
    };

    /**
     * Get next sibling of the node
     * @param {object} options
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getNextSibling = async function (options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = this.rgt + 1;
        options.where.rootId = this.rootId;
        const sibling = await Model.findOne(options);

        return sibling || false;
    };

    /**
     * Get siblings for the node
     * @param {boolean} withCurrentNode
     * @param {object} options
     * @returns {Promise<*>}
     */
    Model.prototype.getSiblings = async function (withCurrentNode = false, options = {}) {
        const parent = await this.getParent(options);
        if (parent) {
            const children = await parent.getChildren(options);
            if (children) {
                if (withCurrentNode) {
                    return children;
                } else {
                    return children.filter((node) => {
                        return !this.isEqualTo(node);
                    })
                }
            }
        } else if (withCurrentNode) {
            return [this];
        }
        return [];
    };

    /**
     * Get first child of the node
     * @param {object} options
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getFirstChild = async function (options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = this.lft + 1;
        options.where.rootId = this.rootId;
        const child = await Model.findOne(options);

        return child || false;
    };

    /**
     * Get last child of the node
     * @param {object} options
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getLastChild = async function (options = {}) {
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.rgt = this.rgt - 1;
        options.where.rootId = this.rootId;
        const child = await Model.findOne(options);

        return child || false;
    };

    /**
     * Get children for the node
     * @param {object} options
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getChildren = async function (options = {}) {
        return await this.getDescendants(1, options);
    };

    /**
     * Get descendants for the node
     * @param {int} depth 0 to get all descendants
     * @param {object} options
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getDescendants = async function (depth = 0, options = {}) {
        depth = parseInt(depth, 10);
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = {
            [Op.gt]: this.lft,
        };
        options.where.rgt = {
            [Op.lt]: this.rgt,
        };
        options.where.rootId = this.rootId;
        if (depth === 0) {
            options.where.level = {
                [Op.gte]: this.level + 1,
            };
        } else {
            options.where.level = {
                [Op.between]: [this.level + 1, this.level + depth],
            };
        }

        const descendants = await Model.findAll(options);

        return descendants || false;
    };

    /**
     * Get parent
     * @param {object} options
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getParent = async function (options = {}) {
        if (this.isRoot()) {
            return false;
        }
        const parent = await this.getAncestors(1, options);
        return parent && parent.length ? parent[0] : false;
    };

    /**
     * Get ancestors for the node
     * @param {int} depth use 0 to get all ancestors
     * @param {object} options
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getAncestors = async function (depth = 0, options = {}) {
        if (this.isRoot()) {
            return false;
        }
        depth = parseInt(depth, 10);
        options = cloneDeep(options);
        options.where = options.where || {};
        options.where.lft = {
            [Op.lt]: this.lft,
        };
        options.where.rgt = {
            [Op.gt]: this.rgt,
        };
        options.where.rootId = this.rootId;
        if (depth === 0) {
            options.where.level = {
                [Op.lte]: this.level - 1,
            };
        } else {
            options.where.level = {
                [Op.between]: [this.level - 1, this.level - depth],
            };
        }

        const ancestors = await Model.findAll(options);

        return ancestors || false;
    };

    /**
     * Get number of children
     * @param {object} options
     * @returns {Promise<number>}
     */
    Model.prototype.getNumberChildren = async function (options = {}) {
        const children = await this.getChildren(options);
        return children === false ? 0 : children.length;
    };

    /**
     * Get number of descendants (children and their children)
     * @returns {number}
     */
    Model.prototype.getNumberDescendants = function () {
        return (this.rgt - this.lft - 1) / 2;
    };

    /**
     * Insert the node as parent of destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.insertAsParentOf = async function (destNode, options = {}) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (this.isRoot()) {
            throw 'Cannot insert the node as parent of root';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as parent of itself';
        }

        const newLft = destNode.lft;
        const newRgt = destNode.rgt + 2;
        const newRootId = destNode.rootId;
        const newLevel = destNode.level;

        const lambda = async function (transaction) {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };
            // make space for new node
            await this.shiftRlValues(destNode.rgt + 1, 2, newRootId, options);

            // update children
            const incOptions = cloneDeep(options);
            incOptions.where.lft = {
                [Op.gte]: newLft,
            };
            incOptions.where.rgt = {
                [Op.lte]: newRgt,
            };
            incOptions.where.rootId = newRootId;
            await Model.increment({
                lft: 1,
                rgt: 1,
                level: 1,
            }, incOptions);

            this.level = newLevel;
            await this.insertNode(newLft, newRgt, newRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as previous sibling of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.insertAsPrevSiblingOf = async function (destNode, options = {}) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as sibling of itself';
        }

        const newLft = destNode.lft;
        const newRgt = destNode.lft + 1;
        const newRootId = destNode.rootId;

        const lambda = async (transaction) => {
            options = {
                transaction: transaction,
                ...options,
            };
            await this.shiftRlValues(newLft, 2, newRootId, options);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as next sibling of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.insertAsNextSiblingOf = async function (destNode, options = {}) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as sibling of itself';
        }

        const newLft = destNode.rgt + 1;
        const newRgt = destNode.rgt + 2;
        const newRootId = destNode.rootId;

        const lambda = async (transaction) => {
            options = {
                transaction: transaction,
                ...options,
            };
            await this.shiftRlValues(newLft, 2, newRootId, options);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as first child of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.insertAsFirstChildOf = async function (destNode, options = {}) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as child of itself';
        }

        const newLft = destNode.lft + 1;
        const newRgt = destNode.lft + 2;
        const newRootId = destNode.rootId;

        const lambda = async (transaction) => {
            options = {
                transaction: transaction,
                ...options,
            };
            await this.shiftRlValues(newLft, 2, newRootId, options);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as last child of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.insertAsLastChildOf = async function (destNode, options = {}) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as child of itself';
        }

        const newLft = destNode.rgt;
        const newRgt = destNode.rgt + 1;
        const newRootId = destNode.rootId;

        const lambda = async (transaction) => {
            options = {
                transaction: transaction,
                ...options,
            };
            await this.shiftRlValues(newLft, 2, newRootId, options);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Move the node between different trees
     * @param {Model} destNode
     * @param {int} newLft
     * @param {string} moveType
     * @param {object} options
     * @returns {Promise}
     */
    // private
    Model.prototype.moveBetweenTrees = async function (destNode, newLft, moveType, options = {}) {
        const lambda = async (transaction) => {
            options = {
                transaction: transaction,
                ...options,
            };
            const newRootId = destNode.rootId;
            const oldRootId = this.rootId;
            const oldLft = this.lft;
            const oldRgt = this.rgt;
            const oldLevel = this.level;

            // prepare destination tree => free up some space
            await this.shiftRlValues(newLft, oldRgt - oldLft - 1, newRootId, options);

            this.rootId = newRootId;
            await this.save(options);

            switch (moveType) {
                case 'moveAsPrevSiblingOf':
                    await this.insertAsPrevSiblingOf(destNode, options);
                    break;
                case 'moveAsFirstChildOf':
                    await this.insertAsFirstChildOf(destNode, options);
                    break;
                case 'moveAsNextSiblingOf':
                    await this.insertAsNextSiblingOf(destNode, options);
                    break;
                case 'moveAsLastChildOf':
                    await this.insertAsLastChildOf(destNode, options);
                    break;
                default:
                    throw `Unknown move operation: ${moveType}.`;
            }

            let diff = oldRgt - oldLft;
            this.rgt = this.lft + diff;
            await this.save(options);

            const newLevel = this.level;
            const levelDiff = newLevel - oldLevel;

            // move children nodes
            const updOptions = cloneDeep(options);
            updOptions.where = updOptions.where || {};
            updOptions.where.lft = {
                [Op.gt]: oldLft,
            };
            updOptions.where.rgt = {
                [Op.lt]: oldRgt,
            };
            updOptions.where.rootId = oldRootId;
            diff = this.lft - oldLft;
            await this.update({
                lft: sequelize.literal(`lft + ${diff}`),
                rgt: sequelize.literal(`rgt + ${diff}`),
                level: sequelize.literal(`level + ${levelDiff}`),
                rootId: newRootId,
            }, updOptions);

            // fix gap in the old tree
            const first = oldRgt + 1;
            const delta = oldLft - oldRgt - 1;
            await this.shiftRlValues(first, delta, oldRootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Move the node as previous sibling of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.moveAsPrevSiblingOf = async function (destNode, options = {}) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as previous sibling of itself';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.lft, 'moveAsPrevSiblingOf', options);
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level;
            await this.updateNode(destNode.lft, this.level - oldLevel, options);
        }
    };

    /**
     * Move the node as next sibling of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.moveAsNextSiblingOf = async function (destNode, options = {}) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as next sibling of itself';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.rgt + 1, 'moveAsNextSiblingOf', options);
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level;
            await this.updateNode(destNode.rgt + 1, this.level - oldLevel, options);
        }
    };

    /**
     * Move the node as first child of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.moveAsFirstChildOf = async function (destNode, options = {}) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as first child of itself or into a descendant';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.lft + 1, 'moveAsFirstChildOf', options);
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level + 1;
            await this.updateNode(destNode.lft + 1, this.level - oldLevel, options);
        }
    };

    /**
     * Move the node as last child of the destination node
     * @param {Model} destNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.moveAsLastChildOf = async function (destNode, options = {}) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as last child of itself or into a descendant';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.rgt, 'moveAsLastChildOf', options);
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level + 1;
            await this.updateNode(destNode.rgt, this.level - oldLevel, options);
        }
    };

    /**
     * Make this node a root node. Only for multiple-root trees
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.makeRoot = async function (options = {}) {
        if (this.isRoot() || !nsOptions.hasManyRoots) {
            throw 'Cannot make the node root because it is already root or you have disabled hasManyRoots';
        }

        const oldRgt = this.rgt;
        const oldLft = this.lft;
        const oldRoot = this.rootId;
        const oldLevel = this.level;
        let newRootId = this.id;

        if (!isNaN(parseInt(options))) {
            warnDeprecated('Using makeRoot() with 2 params is deprecated from version 1.2.0. Please delete redundant newRootId');
            newRootId = options;
            if (arguments.length > 1) {
                options = arguments[1];
            }
        }

        const lambda = async (transaction) => {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };
            const diff = 1 - oldLft;

            const updOptions = cloneDeep(options);
            updOptions.where.lft = {
                [Op.gt]: oldLft,
            };
            updOptions.where.rgt = {
                [Op.lt]: oldRgt,
            };
            updOptions.where.rootId = oldRoot;
            await Model.update({
                lft: sequelize.literal(`lft + ${diff}`),
                rgt: sequelize.literal(`rgt + ${diff}`),
                level: sequelize.literal(`level - ${oldLevel}`),
                rootId: newRootId,
            }, updOptions);

            // fix gap in the old tree
            const first = oldRgt + 1;
            const delta = oldLft - oldRgt - 1;
            await this.shiftRlValues(first, delta, this.rootId, options);

            this.lft = 1;
            this.rgt = oldRgt - oldLft + 1;
            this.rootId = newRootId;
            this.level = 0;
            await this.save(options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Add the node as last child of the supplied node (new parent)
     * @param {Model} parentNode
     * @param {object} options
     * @returns {Promise}
     */
    Model.prototype.addChild = async function (parentNode, options = {}) {
        await parentNode.insertAsLastChildOf(this, options);
    };

    /**
     * Check if the node is leaf
     * @returns {boolean}
     */
    Model.prototype.isLeaf = function () {
        return this.rgt - this.lft === 1;
    };

    /**
     * Check if the node is root
     * @returns {boolean}
     */
    Model.prototype.isRoot = function () {
        return parseInt(this.lft) === 1;
    };

    /**
     * Check if the node is equal to the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isEqualTo = function (node) {
        return parseInt(node.lft) === parseInt(this.lft) && parseInt(node.rgt) === parseInt(this.rgt) &&
            node.rootId == this.rootId;
    };

    /**
     * Check if the node is descendant of the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isDescendantOf = function (node) {
        return node.lft < this.lft && node.rgt > this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is descendant or sibling to supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isDescendantOfOrEqualTo = function (node) {
        return node.lft <= this.lft && node.rgt >= this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is ancestor of the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isAncestorOf = function (node) {
        return node.lft > this.lft && node.rgt < this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is valid
     * @param {Model?} node
     * @returns {boolean}
     */
    Model.prototype.isValidNode = function (node = null) {
        if (node !== null) {
            return node.rgt > node.lft && !node.isNewRecord;
        } else {
            return this.rgt > this.lft && !this.isNewRecord;
        }
    };

    /**
     * Detach the node from the tree by invalidating its left and right values
     */
    Model.prototype.detach = function () {
        this.lft = 0;
        this.rgt = 0;
    };

    /**
     * Delete the node with all its children
     * @param {object} options
     * @returns {Promise<void>}
     */
    Model.prototype.delete = async function (options = {}) {
        const lambda = async (transaction) => {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };
            const rootId = this.rootId;

            const dOptions = cloneDeep(options);
            dOptions.where.lft = {
                [Op.gte]: this.lft,
            };
            dOptions.where.lft = {
                [Op.lte]: this.rgt,
            };
            dOptions.where.rootId = rootId;
            await this.destroy(dOptions);

            const first = this.rgt + 1;
            const delta = this.lft - this.rgt - 1;
            await this.shiftRlValues(first, delta, rootId, options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Set node's left, right and root values, then save it
     * @param {int} destLeft
     * @param {int} destRight
     * @param {int} destRoot
     * @param {object} options
     * @returns {Promise}
     */
    // private
    Model.prototype.insertNode = async function (destLeft = 0, destRight = 0, destRoot = 1, options = {}) {
        this.lft = destLeft;
        this.rgt = destRight;
        this.rootId = destRoot;
        await this.save(options);
    };

    /**
     * Move node and its children to destLeft and updates the rest of tree
     * @param {int} destLeft
     * @param {int} levelDiff
     * @param {object} options
     * @returns {Promise}
     */
    // private
    Model.prototype.updateNode = async function (destLeft, levelDiff, options = {}) {
        let left = this.lft;
        let right = this.rgt;
        const rootId = this.rootId;

        const treeSize = right - left + 1;

        const lambda = async (transaction) => {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };
            // free up some space
            await this.shiftRlValues(destLeft, treeSize, rootId, options);

            if (left >= destLeft) {
                left += treeSize;
                right += treeSize;
            }

            const incOptions = cloneDeep(options);
            incOptions.by = levelDiff;
            incOptions.where.lft = {
                [Op.gt]: left,
            };
            incOptions.where.rgt = {
                [Op.lt]: right,
            };
            incOptions.where.rootId = rootId;
            await Model.increment('level', incOptions);

            await this.shiftRlRange(left, right, destLeft - left, rootId, options);

            await this.shiftRlValues(right + 1, -treeSize, rootId, options);

            await this.save(options);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Add delta to all left and right values >= first.
     * @param {int} first
     * @param {int} delta may be negative
     * @param {int} rootId
     * @param {object} options
     * @returns {Promise}
     */
    // private
    Model.prototype.shiftRlValues = async function (first, delta, rootId = 1, options = {}) {
        const lambda = async (transaction) => {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };

            const inc1Options = cloneDeep(options);
            inc1Options.by = delta;
            inc1Options.where.lft = {
                [Op.gte]: first,
            };
            inc1Options.where.rootId = rootId;
            const promise1 = Model.increment('lft', inc1Options);

            const inc2Options = cloneDeep(options);
            inc2Options.by = delta;
            inc2Options.where.rgt = {
                [Op.gte]: first,
            };
            inc2Options.where.rootId = rootId;
            const promise2 = Model.increment('rgt', inc2Options);

            return Promise.all([
                promise1,
                promise2,
            ]);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };
    /**
     * Add delta to all left and right values between first and last.
     * @param {int} first
     * @param {int} last
     * @param {int} delta may be negative
     * @param {int?} rootId
     * @param {object} options
     * @returns {Promise}
     */
    // private
    Model.prototype.shiftRlRange = async function (first, last, delta, rootId = 1, options = {}) {
        const lambda = async (transaction) => {
            options = {
                where: {},
                transaction: transaction,
                ...options,
            };

            const inc1Options = cloneDeep(options);
            inc1Options.by = delta;
            inc1Options.where.lft = {
                [Op.between]: [first, last],
            };
            inc1Options.where.rootId = rootId;
            const promise1 = Model.increment('lft', inc1Options);

            const inc2Options = cloneDeep(options);
            inc2Options.by = delta;
            inc2Options.where.rgt = {
                [Op.between]: [first, last],
            };
            inc2Options.where.rootId = rootId;
            const promise2 = Model.increment('rgt', inc2Options);

            return Promise.all([
                promise1,
                promise2,
            ]);
        };

        // run queries in the given transaction or create a new transaction
        if (options.transaction) {
            return lambda(options.transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    return Model;
};
