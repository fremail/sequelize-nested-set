const expect = require('chai').expect;
const ns = require('../');
const Sequelize = require('sequelize');
const config = require('./config');
const data = require('./data/many-roots');
const Op = Sequelize.Op;
const { LAST, FIRST, ALONE, MANY, ONE } = require('./constants');
let sequelize, Tag, tag, helpers;

describe('Nested Set with many roots', () => {
    before(async () => {
        sequelize = new Sequelize(config);

        Tag = ns(sequelize, Sequelize.DataTypes, 'Tag', {
            label: Sequelize.DataTypes.STRING,
        }, {
            tableName: 'tag',
            timestamps: false,
            hasManyRoots: true,
        });

        Tag.sync();

        helpers = require('./helpers')(sequelize, Tag);

        await Tag.bulkCreate(data);
    });

    after(async () => {
        await Tag.truncate();
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
                describe('Add real level to where', () => {
                    it('It returns true', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasPrevSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns true', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.hasNextSibling({
                            where: {
                                level: tag.level + 1,
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
                const tag = await Tag.findOne({
                    where: {
                        rgt: {
                            [Op.gt]: 2,
                        },
                        level: 0,
                    },
                });
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
            let tag;
            before(async () => {
                tag = await helpers.getTagHavingSiblings(LAST);
            });

            describe('Call without options', () => {
                it('It returns valid node which is sibling', async () => {
                    const sibling = await tag.getPrevSibling();
                    expect(tag.isValidNode(sibling)).to.be.true;
                    expect(sibling.level == tag.level && sibling.rootId == tag.rootId).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns valid node which is sibling', async () => {
                        const sibling = await tag.getPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(tag.isValidNode(sibling)).to.be.true;
                        expect(sibling.level == tag.level && sibling.rootId == tag.rootId).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getPrevSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getPrevSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getPrevSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getPrevSibling({
                            where: {
                                level: tag.level + 1,
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
            let tag;
            before(async () => {
                tag = await helpers.getTagHavingSiblings(FIRST);
            });

            describe('Call without options', () => {
                it('It returns valid node which is sibling', async () => {
                    const sibling = await tag.getNextSibling();
                    expect(tag.isValidNode(sibling)).to.be.true;
                    expect(sibling.level == tag.level && sibling.rootId == tag.rootId).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns valid node which is sibling', async () => {
                        const sibling = await tag.getNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(tag.isValidNode(sibling)).to.be.true;
                        expect(sibling.level == tag.level && sibling.rootId == tag.rootId).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getNextSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getNextSibling({
                            where: {
                                level: tag.level + 1,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getNextSibling({
                            where: {
                                level: tag.level,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getNextSibling({
                            where: {
                                level: tag.level + 1,
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
            let tag;
            before(async () => {
                tag = await helpers.getTagHavingSiblings(FIRST);
            });

            describe('Call with default params', () => {
                it('It returns a list with valid sibling nodes without current one', async () => {
                    const siblings = await tag.getSiblings();
                    expect(siblings).to.be.an('array');
                    siblings.forEach((node) => {
                        expect(
                            node.isValidNode() &&
                            node.level == tag.level &&
                            node.rootId == tag.rootId &&
                            node.id != tag.id
                        ).to.be.true;
                    });
                });
            });

            describe('Call withCurrentNode = true', () => {
                it('It returns a list with valid sibling nodes with current node', async () => {
                    const siblings = await tag.getSiblings(true);
                    expect(siblings).to.be.an('array');
                    let hasCurrent = false;
                    siblings.forEach((node) => {
                        expect(
                            node.isValidNode() &&
                            node.level == tag.level &&
                            node.rootId == tag.rootId
                        ).to.be.true;
                        if (!hasCurrent && node.id == tag.id) {
                            hasCurrent = true;
                        }
                    });
                    expect(hasCurrent).to.be.true;
                });
            });

            describe('Call withCurrentNode = false and possible where in options', () => {
                it('It returns a list with valid sibling nodes with current node', async () => {
                    const siblings = await tag.getSiblings(false, {
                        where: {
                            rootId: tag.rootId
                        }
                    });
                    expect(siblings).to.be.an('array');
                    siblings.forEach((node) => {
                        expect(
                            node.isValidNode() &&
                            node.level == tag.level &&
                            node.rootId == tag.rootId &&
                            node.id != tag.id
                        ).to.be.true;
                    });
                });
            });

            describe('Call withCurrentNode = true and possible where in options', () => {
                it('It returns a list with valid sibling nodes with current node', async () => {
                    const siblings = await tag.getSiblings(true, {
                        where: {
                            rootId: tag.rootId
                        }
                    });
                    expect(siblings).to.be.an('array');
                    let hasCurrent = false;
                    siblings.forEach((node) => {
                        expect(
                            node.isValidNode() &&
                            node.level == tag.level &&
                            node.rootId == tag.rootId
                        ).to.be.true;
                        if (!hasCurrent && node.id == tag.id) {
                            hasCurrent = true;
                        }
                    });
                    expect(hasCurrent).to.be.true;
                });
            });

            describe('Call withCurrentNode = false and impossible where in options', () => {
                it('It returns an empty array', async () => {
                    const result = await tag.getSiblings(false, {
                        where: {
                            id: -tag.id
                        }
                    });
                    expect(result).to.be.an('array');
                    expect(result).to.be.empty;
                });
            });

            describe('Call withCurrentNode = true and impossible where in options', () => {
                it('It returns an array with only one node - current', async () => {
                    const siblings = await tag.getSiblings(true, {
                        where: {
                            id: -tag.id
                        }
                    });
                    expect(siblings).to.be.an('array');
                    expect(siblings.length === 1).to.be.true;
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
                    expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns valid first child node', async () => {
                        const child = await tag.getFirstChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(tag.isValidNode(child)).to.be.true;
                        expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getFirstChild({
                            where: {
                                level: tag.level,
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
                    expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns a valid child node', async () => {
                        const child = await tag.getFirstChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(tag.isValidNode(child)).to.be.true;
                        expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getFirstChild({
                            where: {
                                level: tag.level,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getFirstChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getFirstChild({
                            where: {
                                level: tag.level,
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
                    expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.rgt + 1 == tag.rgt).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns valid last child node', async () => {
                        const child = await tag.getLastChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(tag.isValidNode(child)).to.be.true;
                        expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.rgt + 1 == tag.rgt).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getLastChild({
                            where: {
                                level: tag.level,
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
                    expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                });
            });
            describe('Call with options', () => {
                describe('Add real level to where', () => {
                    it('It returns a valid child node', async () => {
                        const child = await tag.getLastChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(tag.isValidNode(child)).to.be.true;
                        expect(child.level - 1 == tag.level && child.rootId == tag.rootId && child.lft - 1 == tag.lft).to.be.true;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getLastChild({
                            where: {
                                level: tag.level,
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
                describe('Add real level to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getLastChild({
                            where: {
                                level: tag.level + 1,
                            },
                        });
                        expect(result).to.be.false;
                    });
                });

                describe('Add impossible level clause to where', () => {
                    it('It returns false', async () => {
                        const result = await tag.getLastChild({
                            where: {
                                level: tag.level,
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
});
