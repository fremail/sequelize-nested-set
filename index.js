const Sequelize = require('sequelize');

module.exports = function (sequelize, DataTypes, modelName, attributes = {}, options = {}) {
    const Op = Sequelize.Op;
    const nsOptions = {
        levelColumnName: options.levelColumnName || 'level',
        hasManyRoots: options.hasManyRoots || false,
        rootColumnName: options.rootColumnName || 'root_id',
    };

    const baseAttributes = {
        lft: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        rgt: {
            type: DataTypes.INTEGER,
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
            type: DataTypes.INTEGER,
            field: nsOptions.rootColumnName,
            allowNull: false,
        };
    }
    attributes = {...baseAttributes, ...attributes};

    const Model = sequelize.define(modelName, attributes, options);

    /**
     * Create root node from record or create a new one
     * @param {Model} record
     * @return {Promise<Model>}
     */
    Model.createRoot = async function (record = null) {
        if (nsOptions.hasManyRoots) {
            if (record && record.id && !record.rootId) {
                record.rootId = record.id;
            }
        }

        if (!record) {
            record = new Model();
        }

        record.lft = 1;
        record.rgt = 2;
        record.level = 0;
        await record.save();

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
     * @return {Promise<Model|boolean>}
     */
    Model.fetchRoot = async function (rootId = 1) {
        const root = await Model.findOne({
            where: {
                lft: 1,
                rootId: rootId,
            },
        });

        return root || false;
    };

    /**
     * Fetch tree nodes
     * @param {int} depth use 0 to fetch all
     * @param {int} rootId
     * @return {Promise<Array<Model>|boolean>}
     */
    Model.fetchTree = async function (depth = 0, rootId = 1) {
        const where = {
            lft: {
                [Op.gte]: 1,
            },
            rootId: rootId,
        };
        if (depth > 0) {
            where.level = {
                [Op.between]: [0, depth],
            };
        }

        const nodes = await Model.findAll({
            where: where,
            order: [
                'lft',
            ],
        });

        return nodes || false;
    };

    /**
     * Fetch all root nodes
     * @return {Promise<Array<Model>|boolean>}
     */
    Model.fetchRoots = async function () {
        const roots = await Model.findAll({
            where: {
                lft: 1,
            },
        });

        return roots || false;
    };

    /**
     * Test if the node has previous sibling
     * @returns {Promise<boolean>}
     */
    Model.prototype.hasPrevSibling = async function () {
        return this.isValidNode(await this.getPrevSibling());
    };

    /**
     * Test if the node has next sibling
     * @returns {Promise<boolean>}
     */
    Model.prototype.hasNextSibling = async function () {
        return this.isValidNode(await this.getNextSibling());
    };

    /**
     * Test if the node has children
     * @returns {boolean}
     */
    Model.prototype.hasChildren = () => {
        return this.rgt - this.lft > 1;
    };

    /**
     * Test if the node has parent
     * @returns {boolean}
     */
    Model.prototype.hasParent = () => {
        return !this.isRoot();
    };

    /**
     * Get previous sibling of the node
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getPrevSibling = async function () {
        const sibling = await this.findOne({
            where: {
                rgt: this.lft - 1,
                rootId: this.rootId,
            },
        });

        return sibling || false;
    };

    /**
     * Get next sibling of the node
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getNextSibling = async function () {
        const sibling = await this.findOne({
            where: {
                lft: this.rgt + 1,
                rootId: this.rootId,
            },
        });

        return sibling || false;
    };

    /**
     * Get siblings for the node
     * @param {boolean} withCurrentNode
     * @returns {Promise<*>}
     */
    Model.prototype.getSiblings = async function (withCurrentNode = false) {
        const parent = await this.getParent();
        if (!parent) {
            const children = await parent.getChildren();
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
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getFirstChild = async function () {
        const child = await this.findOne({
            where: {
                lft: this.lft + 1,
                rootId: this.rootId,
            },
        });

        return child || false;
    };

    /**
     * Get last child of the node
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getLastChild = async function () {
        const child = await this.findOne({
            where: {
                rgt: this.rgt - 1,
                rootId: this.rootId,
            },
        });

        return child || false;
    };

    /**
     * Get children for the node
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getChildren = async function () {
        return await this.getDescendants(1);
    };

    /**
     * Get descendants for the node
     * @param {int} depth 0 to get all descendants
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getDescendants = async function (depth = 0) {
        depth = parseInt(depth, 10);
        let descendants;
        if (depth === 0) {
            descendants = await this.findAll({
                where: {
                    lft: {
                        [Op.gt]: this.lft,
                    },
                    rgt: {
                        [Op.lt]: this.rgt,
                    },
                    level: {
                        [Op.gte]: this.level + 1,
                    },
                    rootId: this.rootId,
                },
            });
        } else {
            descendants = await this.findAll({
                where: {
                    lft: {
                        [Op.gt]: this.lft,
                    },
                    rgt: {
                        [Op.lt]: this.rgt,
                    },
                    level: {
                        [Op.between]: [this.level + 1, this.level + depth],
                    },
                    rootId: this.rootId,
                },
            });
        }
        return descendants || false;
    };

    /**
     * Get parent
     * @returns {Promise<Model|boolean>}
     */
    Model.prototype.getParent = async function () {
        if (this.isRoot()) {
            return false;
        }
        const parent = await this.findOne({
            where: {
                lft: {
                    [Op.lt]: this.lft,
                },
                rgt: {
                    [Op.gt]: this.rgt,
                },
                level: {
                    [Op.gte]: this.level - 1,
                },
                rootId: this.rootId,
            },
            order: [
                'rgt',
            ],
        });

        return parent || false;
    };

    /**
     * Get ancestors for the node
     * @param {int} depth use 0 to get all ancestors
     * @returns {Promise<Array<Model>|boolean>}
     */
    Model.prototype.getAncestors = async function (depth = 0) {
        if (this.isRoot()) {
            return false;
        }
        depth = parseInt(depth, 10);
        let ancestors;
        if (depth === 0) {
            ancestors = await this.findAll({
                where: {
                    lft: {
                        [Op.lt]: this.lft,
                    },
                    rgt: {
                        [Op.gt]: this.rgt,
                    },
                    level: {
                        [Op.lte]: this.level - 1,
                    },
                    rootId: this.rootId,
                },
            });
        } else {
            ancestors = await this.findAll({
                where: {
                    lft: {
                        [Op.lt]: this.lft,
                    },
                    rgt: {
                        [Op.gt]: this.rgt,
                    },
                    level: {
                        [Op.between]: [this.level - 1, this.level - depth],
                    },
                    rootId: this.rootId,
                },
            });
        }
        return ancestors || false;
    };

    /**
     * Get number of children
     * @returns {Promise<number>}
     */
    Model.prototype.getNumberChildren = async function () {
        const children = await this.getChildren();
        return children === false ? 0 : children.length;
    };

    /**
     * Get number of descendants (children and their children)
     * @returns {number}
     */
    Model.prototype.getNumberDescendants = () => {
        return (this.rgt - this.lft - 1) / 2;
    };

    /**
     * Insert the node as parent of destination node
     * @param {Model} destNode
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    Model.prototype.insertAsParentOf = async function (destNode, transaction = null) {
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
            // make space for new node
            await this.shiftRlValues(destNode.rgt + 1, 2, newRootId, transaction);

            // update children
            await this.increment({
                lft: 1,
                rgt: 1,
                level: 1,
            }, {
                where: {
                    lft: {
                        [Op.gte]: newLft,
                    },
                    rgt: {
                        [Op.lte]: newRgt,
                    },
                    rootId: newRootId,
                },
                transaction: transaction,
            });

            this.level = newLevel;
            await this.insertNode(newLft, newRgt, newRootId, transaction);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as previous sibling of the destination node
     * @param {Model} destNode
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    Model.prototype.insertAsPrevSiblingOf = async function (destNode, transaction = null) {
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
            await this.shiftRlValues(newLft, 2, newRootId, transaction);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, transaction);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as next sibling of the destination node
     * @param {Model} destNode
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    Model.prototype.insertAsNextSiblingOf = async function (destNode, transaction = null) {
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
            await this.shiftRlValues(newLft, 2, newRootId, transaction);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, transaction);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as first child of the destination node
     * @param {Model} destNode
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    Model.prototype.insertAsFirstChildOf = async function (destNode, transaction = null) {
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
            await this.shiftRlValues(newLft, 2, newRootId, transaction);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, transaction);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Insert the node as last child of the destination node
     * @param {Model} destNode
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    Model.prototype.insertAsLastChildOf = async function (destNode, transaction = null) {
        if (this.isValidNode()) {
            throw 'Cannot insert the node that has its place in the tree';
        }
        if (destNode === this || this.isEqualTo(destNode)) {
            throw 'Cannot insert node as child of itself';
        }

        const newLft = destNode.rgt;
        const newRgt = destNode.lft + 1;
        const newRootId = destNode.rootId;

        const lambda = async (transaction) => {
            await this.shiftRlValues(newLft, 2, newRootId, transaction);
            this.level = destNode.level + 1;
            await this.insertNode(newLft, newRgt, newRootId, transaction);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    /**
     * Move the node between different trees
     * @param {Model} destNode
     * @param {int} newLft
     * @param {string} moveType
     * @returns {Promise}
     */
    // private
    Model.prototype.moveBetweenTrees = async function (destNode, newLft, moveType) {
        await sequelize.transaction(async (transaction) => {
            const newRootId = destNode.rootId;
            const oldRootId = this.rootId;
            const oldLft = this.lft;
            const oldRgt = this.rgt;
            const oldLevel = this.level;

            // prepare destination tree => free up some space
            await this.shiftRlValues(newLft, oldRgt - oldLft - 1, newRootId, transaction);

            this.rootId = newRootId;
            await this.save({
                transaction: transaction,
            });

            switch (moveType) {
                case 'moveAsPrevSiblingOf':
                    await this.insertAsPrevSiblingOf(destNode, transaction);
                    break;
                case 'moveAsFirstChildOf':
                    await this.insertAsFirstChildOf(destNode, transaction);
                    break;
                case 'moveAsNextSiblingOf':
                    await this.insertAsNextSiblingOf(destNode, transaction);
                    break;
                case 'moveAsLastChildOf':
                    await this.insertAsLastChildOf(destNode, transaction);
                    break;
                default:
                    throw `Unknown move operation: ${moveType}.`;
            }

            let diff = oldRgt - oldLft;
            this.rgt = this.lft + diff;
            await this.save({
                transaction: transaction,
            });

            const newLevel = this.level;
            const levelDiff = newLevel - oldLevel;

            // move children nodes
            diff = this.lft - oldLft;
            await this.update({
                lft: sequelize.literal(`lft + ${diff}`),
                rgt: sequelize.literal(`rgt + ${diff}`),
                level: sequelize.literal(`level + ${levelDiff}`),
                rootId: newRootId,
            }, {
                where: {
                    lft: {
                        [Op.gt]: oldLft,
                    },
                    rgt: {
                        [Op.lt]: oldRgt,
                    },
                    rootId: oldRootId,
                },
                transaction: transaction,
            });

            // fix gap in the old tree
            const first = oldRgt + 1;
            const delta = oldLft - oldRgt - 1;
            await this.shiftRlValues(first, delta, oldRootId, transaction);
        });
    };

    /**
     * Move the node as previous sibling of the destination node
     * @param {Model} destNode
     * @returns {Promise}
     */
    Model.prototype.moveAsPrevSiblingOf = async function (destNode) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as previous sibling of itself';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.lft, 'moveAsPrevSiblingOf');
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level;
            await this.updateNode(destNode.lft, this.level - oldLevel);
        }
    };

    /**
     * Move the node as next sibling of the destination node
     * @param {Model} destNode
     * @returns {Promise}
     */
    Model.prototype.moveAsNextSiblingOf = async function (destNode) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as next sibling of itself';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.rgt + 1, 'moveAsNextSiblingOf');
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level;
            await this.updateNode(destNode.rgt + 1, this.level - oldLevel);
        }
    };

    /**
     * Move the node as first child of the destination node
     * @param {Model} destNode
     * @returns {Promise}
     */
    Model.prototype.moveAsFirstChildOf = async function (destNode) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as first child of itself or into a descendant';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.lft + 1, 'moveAsFirstChildOf');
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level + 1;
            await this.updateNode(destNode.lft + 1, this.level - oldLevel);
        }
    };

    /**
     * Move the node as last child of the destination node
     * @param {Model} destNode
     * @returns {Promise}
     */
    Model.prototype.moveAsLastChildOf = async function (destNode) {
        if (destNode === this || this.isAncestorOf(destNode) || this.isEqualTo(destNode)) {
            throw 'Cannot move node as last child of itself or into a descendant';
        }

        if (destNode.rootId != this.rootId) {
            // move between trees
            await this.moveBetweenTrees(destNode, destNode.rgt, 'moveAsLastChildOf');
        } else {
            // move within tree
            const oldLevel = this.level;
            this.level = destNode.level + 1;
            await this.updateNode(destNode.rgt, this.level - oldLevel);
        }
    };

    /**
     * Make this node a root node. Only for multiple-root trees
     * @param {int} newRootId
     * @returns {Promise}
     */
    Model.prototype.makeRoot = async function (newRootId) {
        if (this.isRoot() || !nsOptions.hasManyRoots) {
            throw 'Cannot make the node root because it is already root or you have disabled hasManyRoots';
        }

        const oldRgt = this.rgt;
        const oldLft = this.lft;
        const oldRoot = this.rootId;
        const oldLevel = this.level;

        await sequelize.transaction(async (transaction) => {
            const diff = 1 - oldLft;

            await this.update({
                lft: sequelize.literal(`lft + ${diff}`),
                rgt: sequelize.literal(`rgt + ${diff}`),
                level: sequelize.literal(`level - ${oldLevel}`),
                rootId: newRootId,
            }, {
                where: {
                    lft: {
                        [Op.gt]: oldLft,
                    },
                    rgt: {
                        [Op.lt]: oldRgt,
                    },
                    rootId: oldRoot,
                },
                transaction: transaction,
            });

            // fix gap in the old tree
            const first = oldRgt + 1;
            const delta = oldLft - oldRgt - 1;
            await this.shiftRlValues(first, delta, this.rootId, transaction);

            this.lft = 1;
            this.rgt = oldRgt - oldLft + 1;
            this.rootId = newRootId;
            this.level = 0;
            await this.save({
                transaction: transaction,
            });
        });
    };

    /**
     * Add the node as last child of the supplied node
     * @param {Model} node
     * @returns {Promise}
     */
    Model.prototype.addChild = async function (node) {
        await node.insertAsLastChildOf(this);
    };

    /**
     * Check if the node is leaf
     * @returns {boolean}
     */
    Model.prototype.isLeaf = () => {
        return this.rgt - this.lft === 1;
    };

    /**
     * Check if the node is root
     * @returns {boolean}
     */
    Model.prototype.isRoot = () => {
        return parseInt(this.lft) === 1;
    };

    /**
     * Check if the node is equal to the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isEqualTo = (node) => {
        return parseInt(node.lft) === parseInt(this.lft) && parseInt(node.rgt) === parseInt(this.rgt) &&
            node.rootId == this.rootId;
    };

    /**
     * Check if the node is child of the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isDescendantOf = (node) => {
        return node.lft < this.lft && node.rgt > this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is child or sibling to supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isDescendantOfOrEqualTo = (node) => {
        return node.lft <= this.lft && node.rgt >= this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is ancestor of the supplied node
     * @param {Model} node
     * @returns {boolean}
     */
    Model.prototype.isAncestorOf = (node) => {
        return node.lft > this.lft && node.rgt < this.rgt && node.rootId == this.rootId;
    };

    /**
     * Check if the node is valid
     * @param {Model?} node
     * @returns {boolean}
     */
    Model.prototype.isValidNode = (node = null) => {
        if (node !== null) {
            return node.rgt > node.lft;
        } else {
            return this.rgt > this.lft;
        }
    };

    /**
     * Detach the node from the tree by invalidating its left and right values
     */
    Model.prototype.detach = () => {
        this.lft = 0;
        this.rgt = 0;
    };

    /**
     * Delete the node with all its children
     * @returns {Promise<void>}
     */
    Model.prototype.delete = async function () {
        await sequelize.transaction(async (transaction) => {
            const rootId = this.rootId;

            await this.destroy({
                where: {
                    lft: {
                        [Op.gte]: this.lft,
                    },
                    rgt: {
                        [Op.lte]: this.rgt,
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });

            const first = this.rgt + 1;
            const delta = this.lft - this.rgt - 1;
            await this.shiftRlValues(first, delta, rootId, transaction);
        });
    };

    /**
     * Set node's left, right and root values, then save it
     * @param {int} destLeft
     * @param {int} destRight
     * @param {int} destRoot
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    // private
    Model.prototype.insertNode = async function (destLeft = 0, destRight = 0, destRoot = 1, transaction = null) {
        this.lft = destLeft;
        this.rgt = destRight;
        this.rootId = destRoot;
        await this.save({
            transaction: transaction,
        });
    };

    /**
     * Move node and its children to destLeft and updates the rest of tree
     * @param {int} destLeft
     * @param {int} levelDiff
     * @returns {Promise}
     */
    // private
    Model.prototype.updateNode = async function (destLeft, levelDiff) {
        let left = this.lft;
        let right = this.rgt;
        const rootId = this.rootId;

        const treeSize = right - left + 1;

        await sequelize.transaction(async (transaction) => {
            // free up some space
            await this.shiftRlValues(destLeft, treeSize, rootId, transaction);

            if (left >= destLeft) {
                left += treeSize;
                right += treeSize;
            }

            await this.increment('level', {
                by: levelDiff,
                where: {
                    lft: {
                        [Op.gt]: left,
                    },
                    rgt: {
                        [Op.lt]: right,
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });

            await this.shiftRlRange(left, right, destLeft - left, rootId, transaction);

            await this.shiftRlValues(right + 1, -treeSize, rootId, transaction);

            await this.save({
                transaction: transaction,
            });
        });
    };

    /**
     * Add delta to all left and right values >= first.
     * @param {int} first
     * @param {int} delta may be negative
     * @param {int} rootId
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    // private
    Model.prototype.shiftRlValues = async function (first, delta, rootId = 1, transaction = null) {
        const lambda = async (transaction) => {
            const promise1 = this.increment('lft', {
                by: delta,
                where: {
                    lft: {
                        [Op.gte]: first,
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });
            const promise2 = this.increment('rgt', {
                by: delta,
                where: {
                    rgt: {
                        [Op.gte]: first,
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });
            return Promise.all([
                promise1,
                promise2,
            ]);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
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
     * @param {Transaction} transaction
     * @returns {Promise}
     */
    // private
    Model.prototype.shiftRlRange = async function (first, last, delta, rootId = 1, transaction = null) {
        const lambda = async (transaction) => {
            const promise1 = this.increment('lft', {
                by: delta,
                where: {
                    lft: {
                        [Op.between]: [first, last],
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });
            const promise2 = this.increment('rgt', {
                by: delta,
                where: {
                    rgt: {
                        [Op.between]: [first, last],
                    },
                    rootId: rootId,
                },
                transaction: transaction,
            });
            return Promise.all([
                promise1,
                promise2,
            ]);
        };

        // run queries in the given transaction or create a new transaction
        if (transaction) {
            return lambda(transaction);
        } else {
            return sequelize.transaction(lambda);
        }
    };

    return Model;
};
