const expect = require('chai').expect;
const ns = require('../');
const Sequelize = require('sequelize');
const config = require('./helpers/config');
const data = require('./data/many-roots');
const Op = Sequelize.Op;
const { LAST, FIRST, ALONE, MANY, ONE } = require('./helpers/constants');
let sequelize, Tag, tag, helpers;
let currentEnv = {
    level: false,
    parentId: false,
};

describe('Nested Set with many roots', () => {
    [
        {
            title: 'Without level and parentId',
            beforeFunc: async () => {
                sequelize = new Sequelize(config);

                const tableName = `tag_${Math.random().
                        toString(36).
                        substring(2, 15)}`;

                Tag = ns(sequelize, Sequelize.DataTypes, 'Tag', {
                    label: Sequelize.DataTypes.STRING,
                }, {
                    tableName: tableName,
                    freezeTableName: true,
                    timestamps: false,
                    hasManyRoots: true,
                    levelColumnName: false,
                });

                await Tag.sync();

                helpers = require('./helpers/helpers')(sequelize, Tag, tableName);
                currentEnv = {
                    level: false,
                    parentId: false,
                };

                await Tag.bulkCreate(data);
            },
        },
        {
            title: 'With level and without parentId',
            beforeFunc: async () => {
                sequelize = new Sequelize(config);

                const tableName = `tag_${Math.random().
                        toString(36).
                        substring(2, 15)}`;

                Tag = ns(sequelize, Sequelize.DataTypes, 'Tag', {
                    label: Sequelize.DataTypes.STRING,
                }, {
                    tableName: tableName,
                    freezeTableName: true,
                    timestamps: false,
                    hasManyRoots: true,
                    levelColumnName: 'level',
                });

                await Tag.sync();

                helpers = require('./helpers/helpers')(sequelize, Tag, tableName);
                currentEnv = {
                    level: true,
                    parentId: false,
                };

                await Tag.bulkCreate(data);
            },
        },
        {
            title: 'With parentId and without level',
            beforeFunc: async () => {
                sequelize = new Sequelize(config);

                const tableName = `tag_${Math.random().
                        toString(36).
                        substring(2, 15)}`;

                Tag = ns(sequelize, Sequelize.DataTypes, 'Tag', {
                    label: Sequelize.DataTypes.STRING,
                }, {
                    tableName: tableName,
                    freezeTableName: true,
                    timestamps: false,
                    hasManyRoots: true,
                    levelColumnName: false,
                    parentIdColumnName: 'parent_id',
                });

                await Tag.sync();

                helpers = require('./helpers/helpers')(sequelize, Tag, tableName);
                currentEnv = {
                    level: false,
                    parentId: true,
                };

                await Tag.bulkCreate(data);
            },
        },
    ].forEach(({title, beforeFunc}) => {
        describe(title, () => {
            before(beforeFunc);

            after(async () => {
                await Tag.drop();
            });

            describe('#createRoot()', () => {
                it('New entry is a valid node, is root and w/o children', async () => {
                    // get any tag which is not root (all root tags have lft: 1)
                    tag = new Tag();
                    tag.label = 'New root tag';

                    tag = await Tag.createRoot(tag);

                    expect(tag.isValidNode()).to.be.true;
                    expect(tag.isRoot()).to.be.true;
                    expect(tag.isLeaf()).to.be.true;

                    await tag.delete();
                });
            });

            describe('#fetchRoot()', () => {
                describe('Get root node with default params', () => {
                    it('The gotten node is root, id of the node is equal to rootId', async () => {
                        tag = await Tag.fetchRoot();

                        expect(tag.isRoot()).to.be.true;
                        expect(tag.id).to.be.equal(tag.rootId);
                    });
                });

                describe('Get root node with selected rootId', () => {
                    it('The gotten node is root and equal to the root from fetchRoots()', async () => {
                        const roots = await Tag.fetchRoots();
                        const root = roots[Math.floor(Math.random() * roots.length)];
                        tag = await Tag.fetchRoot(root.rootId);

                        expect(tag.isRoot()).to.be.true;
                        expect(tag.id).to.be.equal(tag.rootId);
                        expect(tag.isEqualTo(root)).to.be.true;
                    });
                });

                describe('Get root node with selected rootId and additional options', () => {
                    let root;

                    before(async () => {
                        const roots = await Tag.fetchRoots();
                        let i = 0;
                        do {
                            root = roots[i];
                        } while (parseInt(root.rootId) === 1 && ++i < roots.length);
                        if (parseInt(root.rootId) === 1) {
                            console.warn('There is no root nodes with rootId not equal to 1');
                        }
                    });

                    describe('Add real rgt to where', () => {
                        it('The gotten node is root and equal to the root from fetchRoots()', async () => {
                            tag = await Tag.fetchRoot(root.rootId, {
                                where: {
                                    rgt: root.rgt,
                                },
                            });

                            expect(tag).to.be.instanceOf(Tag);
                            expect(tag.isRoot()).to.be.true;
                            expect(tag.isEqualTo(root)).to.be.true;
                        });
                    });

                    describe('Add unreal rgt to where', () => {
                        it('We got nothing', async () => {
                            tag = await Tag.fetchRoot(root.rootId, {
                                where: {
                                    rgt: root.rgt - root.lft,
                                },
                            });

                            expect(tag).to.be.false;
                        });
                    });
                });
            });

            describe('#fetchTree()', () => {
                describe('Call with depth = 0 (full tree)', () => {
                    it('We got a tree with several levels, where the greatest level is greater than 1, the first node is root', async () => {
                        const tree = await Tag.fetchTree(0);
                        const levels = helpers.getCountOfNodesPerLevel(tree);
                        const keys = Object.keys(levels);
                        keys.sort();

                        expect(keys.length > 1).to.be.true;
                        expect(keys[keys.length - 1] > 1).to.be.true;
                        expect(tree[0].isRoot()).to.be.true;
                    });
                });

                describe('Call with depth = 1 (only root and 1st level nodes)', () => {
                    it('We got a tree with only 2 levels, where the greatest level is 1, the first node is root', async () => {
                        const tree = await Tag.fetchTree(1);
                        const levels = helpers.getCountOfNodesPerLevel(tree);
                        const keys = Object.keys(levels);
                        keys.sort();

                        expect(keys.length).to.be.equal(2);
                        expect(parseInt(keys[keys.length - 1], 10)).to.be.equal(1);
                        expect(tree[0].isRoot()).to.be.true;
                    });
                });

                describe('Call with depth = 0 (full tree) and selected rootId', () => {
                    it('We got a tree only with selected rootId, with several levels starting from root', async () => {
                        const roots = await Tag.fetchRoots();
                        const rootId = roots[Math.floor(Math.random() * roots.length)].rootId;
                        const tree = await Tag.fetchTree(0, rootId);
                        const levels = helpers.getCountOfNodesPerLevel(tree);
                        const keys = Object.keys(levels);
                        keys.sort();

                        tree.forEach((node) => {
                            expect(node.rootId).to.be.equal(rootId);
                        });
                        expect(keys.length > 1).to.be.true;
                        expect(keys[keys.length - 1] > 1).to.be.true;
                        expect(tree[0].isRoot()).to.be.true;
                    });
                });

                describe('Call with depth = 1 (only root and 1st level nodes) and selected rootId', () => {
                    it('We got a tree only with selected rootId, where nodes from root and first levels', async () => {
                        const roots = await Tag.fetchRoots();
                        const rootId = roots[Math.floor(Math.random() * roots.length)].rootId;
                        const tree = await Tag.fetchTree(1, rootId);
                        const levels = helpers.getCountOfNodesPerLevel(tree);
                        const keys = Object.keys(levels);
                        keys.sort();

                        tree.forEach((node) => {
                            expect(node.rootId).to.be.equal(rootId);
                        });
                        expect(keys.length).to.be.equal(2);
                        expect(parseInt(keys[keys.length - 1], 10)).to.be.equal(1);
                        expect(tree[0].isRoot()).to.be.true;
                    });
                });

                describe('Call with depth = 0 (full tree), selected rootId and additional options', () => {
                    let root;

                    before(async () => {
                        const roots = await Tag.fetchRoots();
                        root = roots[Math.floor(Math.random() * roots.length)];
                    });

                    describe('Add real rgt to where', () => {
                        it('We got a tree only with selected rootId, with several levels starting from root', async () => {
                            const tree = await Tag.fetchTree(0, root.rootId, {
                                where: {
                                    rgt: {
                                        [Op.lte]: root.rgt,
                                    },
                                },
                            });
                            const levels = helpers.getCountOfNodesPerLevel(tree);
                            const keys = Object.keys(levels);
                            keys.sort();

                            tree.forEach((node) => {
                                expect(node.rootId).to.be.equal(root.rootId);
                            });
                            expect(keys.length > 1).to.be.true;
                            expect(keys[keys.length - 1] > 1).to.be.true;
                            expect(tree[0].isRoot()).to.be.true;
                        });
                    });

                    describe('Add impossible rgt clause to where', () => {
                        it('It returns nothing (empty array)', async () => {
                            const tree = await Tag.fetchTree(0, root.rootId, {
                                where: {
                                    rgt: {
                                        [Op.gt]: root.rgt, // impossible
                                    },
                                },
                            });

                            expect(tree).to.be.an('array').that.is.empty;
                        });
                    });
                });

                describe('Call with depth = 1 (only root and 1st level nodes), selected rootId and additional options', () => {
                    let tree = [];
                    let levels = {}; // {level: count of nodes}
                    let root;

                    before(async () => {
                        const roots = await Tag.fetchRoots();
                        root = roots[Math.floor(Math.random() * roots.length)];
                    });

                    describe('Add real rgt to where', () => {
                        it('We got a tree only with selected rootId, only 2 levels, the greatest level is 1', async () => {
                            tree = await Tag.fetchTree(1, root.rootId, {
                                where: {
                                    rgt: {
                                        [Op.lte]: root.rgt,
                                    },
                                },
                            });
                            levels = helpers.getCountOfNodesPerLevel(tree);
                            const keys = Object.keys(levels);
                            keys.sort();
                            tree.forEach((node) => {
                                expect(node.rootId).to.be.equal(root.rootId);
                            });
                            expect(keys.length).to.be.equal(2);
                            expect(parseInt(keys[keys.length - 1], 10)).to.be.equal(1);
                            expect(tree[0].isRoot()).to.be.true;
                        });
                    });

                    describe('Add impossible rgt clause to where', () => {
                        it('We got nothing (empty array)', async () => {
                            tree = await Tag.fetchTree(1, root.rootId, {
                                where: {
                                    rgt: {
                                        [Op.gt]: root.rgt, // impossible
                                    },
                                },
                            });
                            expect(tree).to.be.an('array').that.is.empty;
                        });
                    });
                });
            });

            describe('#fetchRoots()', () => {
                describe('Call without options', () => {
                    it('We get all roots', async () => {
                        const roots = await Tag.fetchRoots();

                        expect(roots).to.be.an('array');
                        expect(roots.length > 1).to.be.true;
                        roots.forEach((node) => {
                            expect(node.isRoot()).to.be.true
                        });
                    });
                });
                describe('Call with options', () => {
                    describe('Add real rgt to where', () => {
                        it('We got all root nodes', async () => {
                            const roots = await Tag.fetchRoots({
                                where: {
                                    rgt: {
                                        [Op.gte]: 1,
                                    },
                                },
                            });

                            expect(roots).to.be.an('array');
                            expect(roots.length > 1).to.be.true;
                            roots.forEach((node) => {
                                expect(node.isRoot()).to.be.true
                            });
                        });
                    });

                    describe('Add impossible rgt clause to where', () => {
                        it('It returns nothing (empty array)', async () => {
                            const roots = await Tag.fetchRoots({
                                where: {
                                    rgt: {
                                        [Op.lt]: 1,
                                    },
                                },
                            });

                            expect(roots).to.be.an('array').that.is.empty;
                        });
                    });
                });
            });

            describe('#hasPrevSibling()', () => {
                describe('For tag with previous siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(LAST);
                    });

                    describe('Call without options', () => {
                        it('It returns true', async () => {
                            expect(await tag.hasPrevSibling()).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns true', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with next siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(FIRST);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.hasPrevSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(ALONE);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.hasPrevSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#hasNextSibling()', () => {
                describe('For tag with previous siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(FIRST);
                    });

                    describe('Call without options', () => {
                        it('It returns true', async () => {
                            expect(await tag.hasNextSibling()).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns true', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with next siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(LAST);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.hasNextSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(ALONE);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.hasNextSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.hasNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#hasChildren()', () => {
                describe('For tag with children', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        expect(await tag.hasChildren()).to.be.true;
                    });
                });

                describe('For tag without children', () => {
                    it('It returns false', async () => {
                        const tag = await Tag.findOne({
                            where: {
                                rgt: {
                                    [Op.eq]: sequelize.literal(`lft + 1`),
                                },
                            },
                        });
                        expect(await tag.hasChildren()).to.be.false;
                    });
                });
            });

            describe('#hasParent()', () => {
                describe('For tag with parents', () => {
                    it('It returns true', async () => {
                        const tag = await Tag.findOne({
                            where: {
                                lft: {
                                    [Op.gt]: 1,
                                },
                            },
                        });
                        expect(await tag.hasParent()).to.be.true;
                    });
                });

                describe('For tag without parents', () => {
                    it('It returns false', async () => {
                        const tag = await Tag.findOne({
                            where: {
                                lft: 1,
                            },
                        });
                        expect(await tag.hasParent()).to.be.false;
                    });
                });
            });

            describe('#getPrevSibling()', () => {
                describe('For tag with previous siblings', () => {
                    let tag, parent;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(LAST);
                        parent = await tag.getParent();
                    });

                    describe('Call without options', () => {
                        it('It returns valid node which is sibling', async () => {
                            const sibling = await tag.getPrevSibling();
                            expect(tag.isValidNode(sibling)).to.be.true;
                            const siblingParent = await sibling.getParent();
                            expect(parent.isEqualTo(siblingParent)).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns valid node which is sibling', async () => {
                                const sibling = await tag.getPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(sibling)).to.be.true;
                                const siblingParent = await sibling.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with next siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(FIRST);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getPrevSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(ALONE);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getPrevSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getPrevSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        }
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getPrevSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#getNextSibling()', () => {
                describe('For tag with next siblings', () => {
                    let tag, parent;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(FIRST);
                        parent = await tag.getParent();
                    });

                    describe('Call without options', () => {
                        it('It returns valid node which is sibling', async () => {
                            const sibling = await tag.getNextSibling();
                            expect(tag.isValidNode(sibling)).to.be.true;
                            const siblingParent = await sibling.getParent();
                            expect(parent.isEqualTo(siblingParent)).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns valid node which is sibling', async () => {
                                const sibling = await tag.getNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(sibling)).to.be.true;
                                const siblingParent = await sibling.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with previous siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(LAST);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getNextSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(ALONE);
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getNextSibling()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getNextSibling({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getNextSibling({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#getSiblings()', () => {
                describe('For tag with siblings', () => {
                    let tag, parent;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(FIRST);
                        parent = await tag.getParent();
                    });

                    describe('Call with default params', () => {
                        it('It returns a list with valid sibling nodes without current one', async () => {
                            const siblings = await tag.getSiblings();
                            expect(siblings).to.be.an('array');
                            await Promise.all(siblings.map(async (sibling) => {
                                expect(tag.isValidNode(sibling)).to.be.true;
                                expect(tag.isEqualTo(sibling)).to.be.false;
                                const siblingParent = await sibling.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;
                            }));
                        });
                    });

                    describe('Call withCurrentNode = true', () => {
                        it('It returns a list with valid sibling nodes with current node', async () => {
                            const siblings = await tag.getSiblings(true);
                            expect(siblings).to.be.an('array');
                            let hasCurrent = false;
                            await Promise.all(siblings.map(async (node) => {
                                expect(tag.isValidNode(node)).to.be.true;
                                const siblingParent = await node.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;

                                if (!hasCurrent && tag.isEqualTo(node)) {
                                    hasCurrent = true;
                                }
                            }));
                            expect(hasCurrent).to.be.true;
                        });
                    });

                    describe('Call withCurrentNode = false and possible where in options', () => {
                        it('It returns a list with valid sibling nodes with current node', async () => {
                            const siblings = await tag.getSiblings(false, {
                                where: {
                                    rootId: tag.rootId,
                                },
                            });
                            expect(siblings).to.be.an('array');
                            await Promise.all(siblings.map(async (node) => {
                                expect(tag.isValidNode(node)).to.be.true;
                                expect(tag.isEqualTo(node)).to.be.false;
                                const siblingParent = await node.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;
                            }));
                        });
                    });

                    describe('Call withCurrentNode = true and possible where in options', () => {
                        it('It returns a list with valid sibling nodes with current node', async () => {
                            const siblings = await tag.getSiblings(true, {
                                where: {
                                    rootId: tag.rootId,
                                },
                            });
                            expect(siblings).to.be.an('array');
                            let hasCurrent = false;
                            await Promise.all(siblings.map(async (node) => {
                                expect(tag.isValidNode(node)).to.be.true;
                                const siblingParent = await node.getParent();
                                expect(parent.isEqualTo(siblingParent)).to.be.true;

                                if (!hasCurrent && tag.isEqualTo(node)) {
                                    hasCurrent = true;
                                }
                            }));
                            expect(hasCurrent).to.be.true;
                        });
                    });

                    describe('Call withCurrentNode = false and impossible where in options', () => {
                        it('It returns an empty array', async () => {
                            const result = await tag.getSiblings(false, {
                                where: {
                                    id: -tag.id,
                                },
                            });
                            expect(result).to.be.an('array');
                            expect(result).to.be.empty;
                        });
                    });

                    describe('Call withCurrentNode = true and impossible where in options', () => {
                        it('It returns an array with only one node - current', async () => {
                            const siblings = await tag.getSiblings(true, {
                                where: {
                                    id: -tag.id,
                                },
                            });
                            expect(siblings).to.be.an('array');
                            expect(siblings.length).to.be.equal(1);
                            expect(tag.isEqualTo(siblings[0])).to.be.true;
                        });
                    });
                });

                describe('For tag without siblings', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingSiblings(ALONE);
                    });

                    describe('Call with default params', () => {
                        it('It returns an empty array', async () => {
                            const result = await tag.getSiblings();
                            expect(result).to.be.an('array');
                            expect(result).to.be.empty;
                        });
                    });
                });
            });

            describe('#getFirstChild()', () => {
                describe('For tag with several children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(MANY);
                    });

                    describe('Call without options', () => {
                        it('It returns valid first child node', async () => {
                            const child = await tag.getFirstChild();
                            expect(tag.isValidNode(child)).to.be.true;
                            expect(child.rgt < tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns valid first child node', async () => {
                                const child = await tag.getFirstChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(child)).to.be.true;
                                expect(child.rgt < tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getFirstChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with one child', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(ONE);
                    });

                    describe('Call without options', () => {
                        it('It returns a valid child node', async () => {
                            const child = await tag.getFirstChild();
                            expect(tag.isValidNode(child)).to.be.true;
                            expect(child.rgt < tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns a valid child node', async () => {
                                const child = await tag.getFirstChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(child)).to.be.true;
                                expect(child.rgt < tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getFirstChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getFirstChild()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getFirstChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getFirstChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#getLastChild()', () => {
                describe('For tag with several children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(MANY);
                    });

                    describe('Call without options', () => {
                        it('It returns valid last child node', async () => {
                            const child = await tag.getLastChild();
                            expect(tag.isValidNode(child)).to.be.true;
                            expect(child.lft > tag.lft && child.rootId == tag.rootId && child.rgt + 1 == tag.rgt).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns valid last child node', async () => {
                                const child = await tag.getLastChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(child)).to.be.true;
                                expect(child.lft > tag.lft && child.rootId == tag.rootId && child.rgt + 1 == tag.rgt).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getLastChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag with one child', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(ONE);
                    });

                    describe('Call without options', () => {
                        it('It returns a valid child node', async () => {
                            const child = await tag.getLastChild();
                            expect(tag.isValidNode(child)).to.be.true;
                            expect(child.rgt + 1 == tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns a valid child node', async () => {
                                const child = await tag.getLastChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(tag.isValidNode(child)).to.be.true;
                                expect(child.rgt + 1 == tag.rgt && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getLastChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });

                describe('For tag without children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getLastChild()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real id to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getLastChild({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible id clause to where', () => {
                            it('It returns false', async () => {
                                const result = await tag.getLastChild({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#getChildren', () => {
                describe('For tag with several children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(MANY);
                    });

                    describe('Call without options', () => {
                        it('It returns valid children', async () => {
                            const children = await tag.getChildren();
                            const levels = helpers.getCountOfNodesPerLevel(children);
                            const keys = Object.keys(levels);

                            expect(keys.length).to.be.equal(1);
                            expect(children.length > 1).to.be.true;
                            children.forEach((child) => {
                                expect(tag.isValidNode(child));
                                expect(child.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real where clause', () => {
                            it('It returns valid children', async () => {
                                const children = await tag.getChildren({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                const levels = helpers.getCountOfNodesPerLevel(children);
                                const keys = Object.keys(levels);

                                expect(keys.length).to.be.equal(1);
                                expect(children.length > 1).to.be.true;
                                children.forEach((child) => {
                                    expect(tag.isValidNode(child));
                                    expect(child.isDescendantOf(tag));
                                });
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getChildren({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });

                describe('For tag with one child', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(ONE);
                    });

                    describe('Call without options', () => {
                        it('It returns an array with one child', async () => {
                            const children = await tag.getChildren();
                            const levels = helpers.getCountOfNodesPerLevel(children);
                            const keys = Object.keys(levels);

                            expect(keys.length).to.be.equal(1);
                            expect(children.length).to.be.equal(1);
                            children.forEach((child) => {
                                expect(tag.isValidNode(child));
                                expect(child.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real where clause', () => {
                            it('It returns an array with one child', async () => {
                                const children = await tag.getChildren({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                const levels = helpers.getCountOfNodesPerLevel(children);
                                const keys = Object.keys(levels);

                                expect(keys.length).to.be.equal(1);
                                expect(children.length).to.be.equal(1);
                                children.forEach((child) => {
                                    expect(tag.isValidNode(child));
                                    expect(child.isDescendantOf(tag));
                                });
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getChildren({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });

                describe('For tag without children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It returns empty array', async () => {
                            expect(await tag.getChildren()).to.be.an('array').empty;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getChildren({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getChildren({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });
            });

            describe('#getDescendants', () => {
                describe('For tag with several descendants', () => {
                    let tag;
                    before(async () => {
                        const roots = await Tag.fetchRoots();
                        for (let i = 0; i < roots.length; i++) {
                            tag = roots[i];
                            const tree = await Tag.fetchTree(0, roots[i].rootId);
                            const levels = helpers.getCountOfNodesPerLevel(tree);
                            const keys = Object.keys(levels);
                            if (keys.length > 1) {
                                break;
                            }
                        }
                    });

                    describe('Call without params', () => {
                        it('It returns all descendants', async () => {
                            const newTree = await tag.getDescendants();
                            const levels = helpers.getCountOfNodesPerLevel(newTree);
                            const keys = Object.keys(levels);

                            expect(keys.length > 1).to.be.true;
                            newTree.forEach((node) => {
                                expect(tag.isValidNode(node));
                                expect(node.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 1', () => {
                        it('It returns only direct children', async () => {
                            const newTree = await tag.getDescendants(1);
                            const levels = helpers.getCountOfNodesPerLevel(newTree);
                            const keys = Object.keys(levels);

                            expect(keys.length).to.be.equal(1);
                            newTree.forEach((node) => {
                                expect(tag.isValidNode(node));
                                expect(node.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 2', () => {
                        it('It returns children and grandchildren', async () => {
                            const newTree = await tag.getDescendants(2);
                            const levels = helpers.getCountOfNodesPerLevel(newTree);
                            const keys = Object.keys(levels);

                            expect(keys.length).to.be.equal(2);
                            newTree.forEach((node) => {
                                expect(tag.isValidNode(node));
                                expect(node.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 100 though there are no such many levels', () => {
                        it('It returns all possible descendants', async () => {
                            const newTree = await tag.getDescendants(100);
                            const levels = helpers.getCountOfNodesPerLevel(newTree);
                            const keys = Object.keys(levels);

                            expect(keys.length).to.be.gt(0);
                            newTree.forEach((node) => {
                                expect(tag.isValidNode(node));
                                expect(node.isDescendantOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 0 and options', () => {
                        describe('Add real where clause', () => {
                            it('It returns valid descendants', async () => {
                                const newTree = await tag.getDescendants(0, {
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                const levels = helpers.getCountOfNodesPerLevel(newTree);
                                const keys = Object.keys(levels);

                                expect(keys.length > 1).to.be.true;
                                newTree.forEach((node) => {
                                    expect(tag.isValidNode(node));
                                    expect(node.isDescendantOf(tag));
                                });
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getDescendants(0, {
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });

                describe('For tag without descendants', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without params', () => {
                        it('It returns empty array', async () => {
                            expect(await tag.getDescendants()).to.be.an('array').empty;
                        });
                    });
                    describe('Call with depth = 1', () => {
                        it('It returns empty array', async () => {
                            expect(await tag.getDescendants(1)).to.be.an('array').empty;
                        });
                    });
                    describe('Call with depth = 0 and options', () => {
                        describe('Add real where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getDescendants(0, {
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getDescendants(0, {
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });
            });

            describe('#getParent', () => {
                describe('For tag with parent', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithAncestors(MANY);
                    });

                    describe('Call without options', () => {
                        it('It returns valid parent node', async () => {
                            const parent = await tag.getParent();

                            expect(tag.isValidNode(parent)).to.be.true;
                            expect(parent.isAncestorOf(tag)).to.be.true;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real where clause', () => {
                            it('It returns valid parent node', async () => {
                                const parent = await tag.getParent({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });

                                expect(tag.isValidNode(parent)).to.be.true;
                                expect(parent.isAncestorOf(tag)).to.be.true;
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns false', async function () {
                                if (!currentEnv.parentId) {
                                    const result = await tag.getParent({
                                        where: {
                                            id: tag.id,
                                        },
                                    });
                                    expect(result).to.be.false;
                                } else {
                                    this.skip();
                                }
                            });
                        });
                    });
                });

                describe('For tag without parent (root node)', () => {
                    let tag;
                    before(async () => {
                        tag = await Tag.fetchRoot();
                    });

                    describe('Call without options', () => {
                        it('It returns false', async () => {
                            expect(await tag.getParent()).to.be.false;
                        });
                    });
                    describe('Call with options', () => {
                        describe('Add real where clause', () => {
                            it('It returns false', async () => {
                                const result = await tag.getParent({
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns false', async () => {
                                const result = await tag.getParent({
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#getAncestors', () => {
                describe('For tag with several ancestors', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithAncestors(MANY);
                    });

                    describe('Call without params', () => {
                        it('It returns all ancestors', async () => {
                            const ancestors = await tag.getAncestors();

                            currentEnv.level && expect(ancestors.length).to.be.equal(tag.level);
                            ancestors.forEach((node) => {
                                expect(tag.isValidNode(node));
                                expect(node.isAncestorOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 1', () => {
                        it('It returns only a parent', async () => {
                            const ancestors = await tag.getAncestors(1);

                            expect(ancestors.length).to.be.equal(1);
                            ancestors.forEach((node) => {
                                currentEnv.level && expect(node.level).to.be.equal(tag.level - 1);
                                expect(tag.isValidNode(node));
                                expect(node.isAncestorOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 2', () => {
                        it('It returns a parent and a grandparent', async () => {
                            const ancestors = await tag.getAncestors(2);

                            expect(ancestors.length).to.be.equal(2);
                            ancestors.forEach((node) => {
                                currentEnv.level && expect(node.level).to.be.lt(tag.level);
                                expect(tag.isValidNode(node));
                                expect(node.isAncestorOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 100 though there are no such many levels', () => {
                        it('It returns all possible ancestors', async () => {
                            const ancestors = await tag.getAncestors(100);

                            expect(ancestors.length).to.be.gt(0);
                            ancestors.forEach((node) => {
                                currentEnv.level && expect(node.level).to.be.lt(tag.level);
                                expect(tag.isValidNode(node));
                                expect(node.isAncestorOf(tag));
                            });
                        });
                    });
                    describe('Call with depth = 0 and options', () => {
                        describe('Add real where clause', () => {
                            it('It returns valid ancestors', async () => {
                                const ancestors = await tag.getAncestors(0, {
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });

                                currentEnv.level && expect(ancestors.length).to.be.equal(tag.level);
                                ancestors.forEach((node) => {
                                    expect(tag.isValidNode(node));
                                    expect(node.isAncestorOf(tag));
                                });
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns empty array', async () => {
                                const result = await tag.getAncestors(0, {
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.an('array').empty;
                            });
                        });
                    });
                });

                describe('For tag without ancestors', () => {
                    let tag;
                    before(async () => {
                        const tags = await Tag.fetchRoots();
                        tag = tags[0];
                    });

                    describe('Call without params', () => {
                        it('It returns false', async () => {
                            expect(await tag.getAncestors()).to.be.false;
                        });
                    });
                    describe('Call with depth = 1', () => {
                        it('It returns false', async () => {
                            expect(await tag.getAncestors(1)).to.be.false;
                        });
                    });
                    describe('Call with depth = 0 and options', () => {
                        describe('Add real where clause', () => {
                            it('It returns false', async () => {
                                const result = await tag.getAncestors(0, {
                                    where: {
                                        id: {
                                            [Op.ne]: tag.id,
                                        },
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });

                        describe('Add impossible where clause', () => {
                            it('It returns false', async () => {
                                const result = await tag.getAncestors(0, {
                                    where: {
                                        id: tag.id,
                                    },
                                });
                                expect(result).to.be.false;
                            });
                        });
                    });
                });
            });

            describe('#addChild', () => {
                describe('For tag with children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagHavingChildren(MANY);
                    });

                    describe('Add new tag without options', () => {
                        it('It adds the child', async () => {
                            const tagValue = 'new child 1';
                            await tag.addChild(new Tag({
                                label: tagValue,
                            }));

                            const child = await Tag.findOne({
                                where: {
                                    label: tagValue,
                                }
                            });
                            await tag.reload();

                            expect(tag.isValidNode(child)).to.be.true;
                            expect(tag.isAncestorOf(child)).to.be.true;
                        });
                    });

                    describe('Try to add existing tag without options', () => {
                        it('It throws an exception', async () => {
                            const child = await Tag.findOne({
                                where: {
                                    id: {
                                        [Op.ne]: tag.id,
                                    }
                                }
                            });

                            // weird way to catch the async exception https://github.com/chaijs/chai/issues/415
                            await tag.addChild(child).catch((err) => {
                                expect(() => {throw err}).to.throw();
                            });
                        });
                    });

                    describe('Try to add the same tag as children of itself without options', () => {
                        it('It throws an exception', async () => {
                            await tag.addChild(tag).catch((err) => {
                                expect(() => {throw err}).to.throw();
                            });
                        });
                    });
                });

                describe('For tag without children', () => {
                    let tag;
                    before(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It adds the child', async () => {
                            const tagValue = 'new child 2';
                            await tag.addChild(new Tag({
                                label: tagValue,
                            }));

                            const child = await Tag.findOne({
                                where: {
                                    label: tagValue,
                                }
                            });
                            await tag.reload();

                            expect(tag.isValidNode(child)).to.be.true;
                            expect(tag.isAncestorOf(child)).to.be.true;
                        });
                    });
                });
            });

            describe('#isValidNode', () => {
                describe('Call from instance', () => {
                    describe('Instance of real existing node', () => {
                        it('It returns true', async () => {
                            const node = await Tag.findOne();
                            expect(node.isValidNode()).to.be.true;
                        });
                    });
                    describe('Instance of non existing node', () => {
                        it('It returns false', async () => {
                            const node = new Tag({
                                label: 'new node',
                            });
                            expect(node.isValidNode()).to.be.false;
                        });
                    });
                });
                describe('Call with node as param', () => {
                    describe('for real existing node', () => {
                        it('It returns true', async () => {
                            const node = await Tag.findOne();
                            const node2 = await Tag.findOne({
                                where: {
                                    id: {
                                        [Op.ne]: node.id,
                                    }
                                }
                            });
                            expect(node.isValidNode(node2)).to.be.true;
                        });
                    });
                    describe('for non existing node', () => {
                        it('It returns false', async () => {
                            const node = await Tag.findOne();
                            const node2 = new Tag({
                                label: 'new node',
                            });
                            expect(node.isValidNode(node2)).to.be.false;
                        });
                    });
                });
            });

            describe('#isLeaf', () => {
                describe('Call from leaf node', () => {
                    it('It returns true', async () => {
                        const node = await helpers.getTagWithoutChildren();
                        expect(node.isLeaf()).to.be.true;
                    });
                });
                describe('Call from node having children', () => {
                    it('It returns false', async () => {
                        const node = await helpers.getTagHavingChildren(MANY);
                        expect(node.isLeaf()).to.be.false;
                    });
                });
            });

            describe('#isRoot', () => {
                describe('Call from root node', () => {
                    it('It returns true', async () => {
                        const roots = await Tag.fetchRoots();
                        const node = roots[0];
                        expect(node.isRoot()).to.be.true;
                    });
                });
                describe('Call from non root node', () => {
                    it('It returns false', async () => {
                        const node = await helpers.getTagWithAncestors(MANY);
                        expect(node.isRoot()).to.be.false;
                    });
                });
            });

            describe('#makeRoot', () => {
                describe('Call from node with children', () => {
                    let tag;
                    beforeEach(async () => {
                        tag = await helpers.getTagHavingChildren(MANY, true);
                    });

                    describe('Call without options', () => {
                        it('It moves self and all children to the new tree', async () => {
                            const rootId = tag.id;
                            await tag.makeRoot();
                            const tree = await Tag.fetchTree(0, rootId);

                            expect(tree).to.be.an('array');
                            expect(tree.length > 2).to.be.true;
                            tree.forEach((node) => {
                                expect(node.rootId).to.be.equal(rootId);
                            });
                        });
                    });
                });

                describe('Call from node without children', () => {
                    let tag;
                    beforeEach(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It moves self to the new tree', async () => {
                            const rootId = tag.id;
                            await tag.makeRoot();
                            const tree = await Tag.fetchTree(0, rootId);

                            expect(tree).to.be.an('array');
                            expect(tree.length === 1).to.be.true;
                            tree.forEach((node) => {
                                expect(node.rootId).to.be.equal(rootId);
                            });
                        });
                    });
                });

                describe('Call from root node', () => {
                    let tag;
                    beforeEach(async () => {
                        const tags = await Tag.fetchRoots();
                        tag = tags[0];
                    });

                    describe('Call without options', () => {
                        it('It throws an exception', async () => {
                            await tag.makeRoot().catch((err) => {
                                expect(() => {throw err}).to.throw();
                            });
                        });
                    });
                });
            });

            describe('#generateAdditionalFields()', () => {
                it('Result of function is an array of nodes with level', async () => {
                    const tags = await Tag.fetchRoots();
                    await Promise.all(tags.map(async (rootTag) => {
                        const rootId = rootTag.rootId;
                        const origNodes = await Tag.fetchTree(0, rootId);
                        const nodes = Tag.generateAdditionalFields(origNodes.map(node => {
                            node.level = null;
                            return node;
                        }));

                        expect(nodes).to.be.an('array');
                        await Promise.all(nodes.map(async (node) => {
                            const origNode = await Tag.findByPk(node.id);
                            const ancestors = await origNode.getAncestors();
                            expect(node.level).to.be.equal(ancestors ? ancestors.length : 0);
                        }));
                    }));
                });
                it('Result of function is an array of nodes with parentId', async () => {
                    const tags = await Tag.fetchRoots();
                    await Promise.all(tags.map(async (rootTag) => {
                        const rootId = rootTag.rootId;
                        const origNodes = await Tag.fetchTree(0, rootId);
                        const nodes = Tag.generateAdditionalFields(origNodes.map(node => {
                            node.parentId = null;
                            return node;
                        }));

                        expect(nodes).to.be.an('array');
                        await Promise.all(nodes.map(async tag => {
                            const parent = await tag.getParent();
                            expect(tag.parentId).to.be.equal(parseInt(parent ? parent.id : 0));
                        }));
                    }));
                });
            });

            describe('#isEqualTo', () => {
                describe('Call with same nodes', () => {
                    it('It returns true', async () => {
                        const node = await Tag.findOne();
                        const sameNode = await Tag.findByPk(node.id);
                        expect(node.isEqualTo(sameNode)).to.be.true;
                    });
                });
                describe('Call with different nodes', () => {
                    it('It returns false', async () => {
                        const node = await Tag.findOne();
                        const anotherNode = await Tag.findOne({
                            where: {
                                id: {
                                    [Op.ne]: node.id,
                                },
                            },
                        });
                        expect(node.isEqualTo(anotherNode)).to.be.false;
                    });
                });
            });

            describe('#isDescendantOf', () => {
                describe('Call with a parent', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        const parent = await tag.getParent();
                        expect(tag.isDescendantOf(parent)).to.be.true;
                    });
                });
                describe('Call with a grandparent', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        const parents = await tag.getAncestors(2);
                        expect(tag.isDescendantOf(parents[1])).to.be.true;
                    });
                });
                describe('Call with self', () => {
                    it('It returns false', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        expect(tag.isDescendantOf(tag)).to.be.false;
                    });
                });
                describe('Call with a child', () => {
                    it('It returns false', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const children = await tag.getChildren();
                        children.forEach((child) => {
                            expect(tag.isDescendantOf(child)).to.be.false;
                        });
                    });
                });
            });

            describe('#isDescendantOfOrEqualTo', () => {
                describe('Call with a parent', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        const parent = await tag.getParent();
                        expect(tag.isDescendantOfOrEqualTo(parent)).to.be.true;
                    });
                });
                describe('Call with a grandparent', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        const parents = await tag.getAncestors(2);
                        expect(tag.isDescendantOfOrEqualTo(parents[1])).to.be.true;
                    });
                });
                describe('Call with self', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        expect(tag.isDescendantOfOrEqualTo(tag)).to.be.true;
                    });
                });
                describe('Call with a child', () => {
                    it('It returns false', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const children = await tag.getChildren();
                        children.forEach((child) => {
                            expect(tag.isDescendantOfOrEqualTo(child)).to.be.false;
                        });
                    });
                });
            });

            describe('#isAncestorOf', () => {
                describe('Call with a child', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const children = await tag.getChildren();
                        children.forEach((child) => {
                            expect(tag.isAncestorOf(child)).to.be.true;
                        });
                    });
                });
                describe('Call with a grandchildren', () => {
                    it('It returns true', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const children = await tag.getDescendants(2);
                        children.forEach((child) => {
                            expect(tag.isAncestorOf(child)).to.be.true;
                        });
                    });
                });
                describe('Call with self', () => {
                    it('It returns false', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        expect(tag.isAncestorOf(tag)).to.be.false;
                    });
                });
                describe('Call with a parent', () => {
                    it('It returns false', async () => {
                        const tag = await helpers.getTagWithAncestors(MANY);
                        const parent = await tag.getParent();
                        expect(tag.isAncestorOf(parent)).to.be.false;
                    });
                });
            });

            describe('#getNumberChildren', () => {
                describe('For node with a child', () => {
                    let tag;
                    beforeEach(async () => {
                        tag = await helpers.getTagHavingChildren(ONE);
                    });

                    describe('Call without options', () => {
                        it('It returns 1', async () => {
                            const number = await tag.getNumberChildren();
                            expect(number).to.be.equal(1);
                        });
                    });
                    describe('Call with real where clause', () => {
                        it('It returns 1', async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: {
                                        [Op.ne]: tag.id,
                                    },
                                },
                            });
                            expect(number).to.be.equal(1);
                        });
                    });
                    describe('Call with impossible where clause', () => {
                        it('It returns 0', async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: tag.id,
                                },
                            });
                            expect(number).to.be.equal(0);
                        });
                    });
                });
                describe('For node with many children', () => {
                    let tag, childrenCount;
                    beforeEach(async () => {
                        tag = await helpers.getTagHavingChildren(MANY);
                        const children = await tag.getChildren();
                        childrenCount = children.length;
                    });

                    describe('Call without options', () => {
                        it(`It returns ${childrenCount}`, async () => {
                            const number = await tag.getNumberChildren();
                            expect(number).to.be.equal(childrenCount);
                        });
                    });
                    describe('Call with real where clause', () => {
                        it(`It returns ${childrenCount}`, async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: {
                                        [Op.ne]: tag.id,
                                    },
                                },
                            });
                            expect(number).to.be.equal(childrenCount);
                        });
                    });
                    describe('Call with impossible where clause', () => {
                        it('It returns 0', async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: tag.id,
                                },
                            });
                            expect(number).to.be.equal(0);
                        });
                    });
                });
                describe('For node without children', () => {
                    let tag;
                    beforeEach(async () => {
                        tag = await helpers.getTagWithoutChildren();
                    });

                    describe('Call without options', () => {
                        it('It returns 0', async () => {
                            const number = await tag.getNumberChildren();
                            expect(number).to.be.equal(0);
                        });
                    });
                    describe('Call with real where clause', () => {
                        it('It returns 0', async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: {
                                        [Op.ne]: tag.id,
                                    },
                                },
                            });
                            expect(number).to.be.equal(0);
                        });
                    });
                    describe('Call with impossible where clause', () => {
                        it('It returns 0', async () => {
                            const number = await tag.getNumberChildren({
                                where: {
                                    id: tag.id,
                                },
                            });
                            expect(number).to.be.equal(0);
                        });
                    });
                });
            });

            describe('#getNumberDescendants', () => {
                describe('Call it for node with many children', () => {
                    it(`It returns a correct number of all their descendants`, async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const descendants = await tag.getDescendants();
                        const count = descendants.length;
                        const number = await tag.getNumberDescendants();
                        expect(number).to.be.equal(count);
                    });
                });
                describe('Call it for node without children', () => {
                    it(`It returns 0`, async () => {
                        const tag = await helpers.getTagWithoutChildren();
                        const number = await tag.getNumberDescendants();
                        expect(number).to.be.equal(0);
                    });
                });
            });

            describe('#detach', () => {
                describe('Call it', () => {
                    it(`It makes the node invalid`, async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        tag.detach();
                        expect(tag.isValidNode()).to.be.false;
                    });
                });
                describe('Call it', () => {
                    it(`The changes aren't saved`, async () => {
                        const tag = await helpers.getTagWithoutChildren();
                        const params = {
                            id: tag.id,
                            lft: tag.lft,
                            rgt: tag.rgt,
                            rootId: tag.rootId,
                        };
                        tag.detach();
                        const tagFromDB = await Tag.findOne({
                            where: params,
                        });
                        expect(tag.isValidNode()).to.be.false;
                        expect(tagFromDB.isValidNode()).to.be.true;
                    });
                });
            });

            describe('#delete', () => {
                describe('Call it', () => {
                    it(`It deletes the node from DB`, async () => {
                        const tag = await helpers.getTagWithoutChildren();
                        const params = {
                            id: tag.id,
                        };
                        await tag.delete();
                        const tagFromDB = await Tag.findOne({
                            where: params,
                        });
                        expect(tagFromDB).to.be.null;
                    });
                });
                describe('For node with siblings', () => {
                    it('It shifts next siblings lft and rgt values', async () => {
                        const tag = await helpers.getTagHavingSiblings(FIRST);
                        const siblings = await tag.getSiblings();
                        const myLft = tag.lft;
                        await tag.delete();
                        let hasTagWithMyLft = false;
                        await Promise.all(siblings.map(async (node) => {
                            await node.reload();
                            hasTagWithMyLft = hasTagWithMyLft || parseInt(node.lft) === parseInt(myLft);
                        }));
                        expect(hasTagWithMyLft).to.be.true;
                    });
                });
                describe('For node with children', () => {
                    it('It deletes all descendants too', async () => {
                        const tag = await helpers.getTagHavingChildren(MANY);
                        const descendants = await tag.getDescendants();
                        await tag.delete();
                        await Promise.all(descendants.map(async (node) => {
                            const nodeFromDB = await Tag.findByPk(node.id);
                            expect(nodeFromDB).to.be.null;
                        }));
                    });
                });
            });

            describe('#moveAsNextSiblingOf', () => {
                describe('For node without children', () => {
                    let tag, origData;
                    beforeEach(async () => {
                        tag = await helpers.getTagWithoutChildren();
                        origData = {
                            lft: tag.lft,
                            rgt: tag.rgt,
                            rootId: tag.rootId,
                        };
                    });
                    describe('Try to move it to another tree', () => {
                        it('It moves the node to the destination', async () => {
                            const roots = await Tag.fetchRoots({
                                where: {
                                    id: {
                                        [Op.ne]: tag.rootId,
                                    },
                                },
                            });
                            const destRootId = roots[0].rootId;
                            const dest = await Tag.findOne({
                                where: {
                                    rootId: destRootId,
                                    lft: {
                                        [Op.gt]: 1,
                                    },
                                },
                            });
                            await tag.moveAsNextSiblingOf(dest);

                            expect(origData.rootId).to.be.not.eq(tag.rootId);
                            const parent1 = await tag.getParent();
                            const parent2 = await dest.getParent();
                            expect(parent1.isEqualTo(parent2)).to.be.true;
                            expect(tag.lft - 1).to.be.eq(dest.rgt);
                            const oldNeighbor = await Tag.findOne({
                                where: {
                                    lft: origData.lft,
                                },
                            });
                            expect(tag.isValidNode(oldNeighbor)).to.be.true;
                        });
                    });
                    describe('Try to move it inside the tree', () => {
                        it('It moves the node to the destination', async () => {
                            const dest = await Tag.findOne({
                                where: {
                                    id: {
                                        [Op.notIn]: [tag.id, tag.rootId],
                                    },
                                    rootId: tag.rootId,
                                    lft: {
                                        [Op.notBetween]: [tag.lft, tag.rgt],
                                    },
                                },
                            });
                            await tag.moveAsNextSiblingOf(dest);

                            expect(origData.rootId).to.be.eq(tag.rootId);
                            const parent1 = await tag.getParent();
                            const parent2 = await dest.getParent();
                            expect(parent1.isEqualTo(parent2)).to.be.true;
                            expect(tag.lft - 1).to.be.eq(dest.rgt);
                        });
                    });
                    describe('Try to move it to self', () => {
                        it('It throws an exception', async () => {
                            const dest = await Tag.findByPk(tag.id);
                            await tag.moveAsNextSiblingOf(dest).catch((err) => {
                                expect(() => {throw err}).to.throw();
                            });
                        });
                    });
                });
                describe('For node with children', () => {
                    let tag, origData;
                    beforeEach(async () => {
                        tag = await helpers.getTagHavingChildren(MANY, true);
                        const descendants = await tag.getDescendants();
                        origData = {
                            lft: tag.lft,
                            rgt: tag.rgt,
                            rootId: tag.rootId,
                            descendantIds: descendants.map((node) => node.id),
                        };
                    });
                    describe('Try to move it to another tree', () => {
                        it('It moves the node with descendents to the destination', async () => {
                            const roots = await Tag.fetchRoots({
                                where: {
                                    id: {
                                        [Op.ne]: tag.rootId,
                                    },
                                },
                            });
                            const destRootId = roots[0].rootId;
                            const dest = await Tag.findOne({
                                where: {
                                    rootId: destRootId,
                                    lft: {
                                        [Op.gt]: 1,
                                    },
                                },
                            });
                            await tag.moveAsNextSiblingOf(dest);

                            expect(origData.rootId).to.be.not.eq(tag.rootId);
                            const parent1 = await tag.getParent();
                            const parent2 = await dest.getParent();
                            expect(parent1.isEqualTo(parent2)).to.be.true;
                            expect(tag.lft - 1).to.be.eq(dest.rgt);

                            const descendants = await tag.getDescendants();
                            expect(descendants.length).to.be.eq(origData.descendantIds.length);
                            descendants.forEach((descendant) => {
                                expect(origData.descendantIds.includes(descendant.id)).to.be.true;
                            });

                            const oldNeighbor = await Tag.findOne({
                                where: {
                                    lft: origData.lft,
                                },
                            });
                            expect(tag.isValidNode(oldNeighbor)).to.be.true;
                        });
                    });
                    describe('Try to move it inside the tree', () => {
                        it('It moves the node to the destination', async () => {
                            const dest = await Tag.findOne({
                                where: {
                                    id: {
                                        [Op.notIn]: [tag.id, tag.rootId],
                                    },
                                    rootId: tag.rootId,
                                    lft: {
                                        [Op.notBetween]: [tag.lft, tag.rgt],
                                    },
                                },
                            });
                            await tag.moveAsNextSiblingOf(dest);

                            expect(origData.rootId).to.be.eq(tag.rootId);
                            const parent1 = await tag.getParent();
                            const parent2 = await dest.getParent();
                            expect(parent1.isEqualTo(parent2)).to.be.true;
                            expect(tag.lft - 1).to.be.eq(dest.rgt);

                            const descendants = await tag.getDescendants();
                            expect(descendants.length).to.be.eq(origData.descendantIds.length);
                            descendants.forEach((descendant) => {
                                expect(origData.descendantIds.includes(descendant.id)).to.be.true;
                            });
                        });
                    });
                    describe('Try to move it to self', () => {
                        it('It throws an exception', async () => {
                            const dest = await Tag.findByPk(tag.id);
                            await tag.moveAsNextSiblingOf(dest).catch((err) => {
                                expect(() => {throw err}).to.throw();
                            });
                        });
                    });
                });
            });
        });
    });
});
