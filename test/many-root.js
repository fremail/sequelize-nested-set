const expect = require('chai').expect;
const ns = require('../');
const Sequelize = require('sequelize');
const config = require('./config');
const helpers = require('./helpers');
const data = require('./data/many-roots');
const Op = Sequelize.Op;
let sequelize, Tag, tag;

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
                const result = await sequelize.query(
                    "SELECT MAX(`id`) as `max_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].max_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MIN(`id`) as `min_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].min_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MAX(`id`) `max_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` = 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].max_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MIN(`id`) as `min_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].min_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MAX(`id`) as `max_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].max_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MIN(`id`) `min_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` = 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].min_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MAX(`id`) as `max_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].max_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MIN(`id`) as `min_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].min_id,
                    },
                });
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
                const result = await sequelize.query(
                    "SELECT MAX(`id`) `max_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` = 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                tag = await Tag.findOne({
                    where: {
                        id: result[0].max_id,
                    },
                });
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
});
