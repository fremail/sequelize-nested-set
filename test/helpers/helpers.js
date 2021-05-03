const { LAST, FIRST, ALONE, MANY, ONE } = require('./constants');
const { Op } = require('sequelize');

module.exports = (sequelize, Tag, tableName) => ({
    getCountOfNodesPerLevel: (nodes) => {
        if (nodes && nodes[0] && typeof nodes[0].level === 'undefined') {
            nodes = Tag.generateAdditionalFields(nodes);
        }
        let levels = {};
        for (let i = 0; i < nodes.length; i++) {
            const level = nodes[i].level;
            if (!levels[level]) {
                levels[level] = 0;
            }
            levels[level]++;
        }
        return levels;
    },

    getTagHavingSiblings: async (betweenSiblings = null) => {
        let result;
        switch (betweenSiblings) {
            case LAST:
                result = await sequelize.query(
                        `SELECT child.id
                        FROM ${tableName} child
                        INNER JOIN ${tableName} parent
                            ON child.lft > parent.lft + 1 
                                AND child.rgt = parent.rgt - 1
                                AND parent.root_id = child.root_id
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            case FIRST:
                result = await sequelize.query(
                        `SELECT child.id
                        FROM ${tableName} child
                        INNER JOIN ${tableName} parent
                            ON child.lft = parent.lft + 1 
                                AND child.rgt < parent.rgt - 1
                                AND parent.root_id = child.root_id
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            default:
            case ALONE:
                result = await sequelize.query(
                        `SELECT child.id
                        FROM ${tableName} child
                        INNER JOIN ${tableName} parent
                            ON child.lft = parent.lft + 1 
                                AND child.rgt = parent.rgt - 1
                                AND parent.root_id = child.root_id
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
        }
        return await Tag.findByPk(result[0].id);
    },

    getTagHavingChildren: async (childrenCount = null, excludeRoots = false) => {
        let result;
        let where = '';
        if (excludeRoots) {
            where = 'WHERE parent.root_id <> parent.id'
        }
        switch (childrenCount) {
            case ONE:
                result = await sequelize.query(
                        `SELECT parent.id
                        FROM ${tableName} parent
                        INNER JOIN ${tableName} child
                            ON child.lft = parent.lft + 1
                                AND child.rgt = parent.rgt - 1
                                AND parent.root_id = child.root_id
                        ${where}
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            case MANY:
                result = await sequelize.query(
                        `SELECT parent.id
                        FROM ${tableName} parent
                        INNER JOIN ${tableName} child
                            ON ((child.lft = parent.lft + 1 AND child.rgt < parent.rgt - 1)
                                OR (child.lft > parent.lft + 1 AND child.rgt = parent.rgt - 1))
                                AND parent.root_id = child.root_id
                        ${where}
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
        }
        return await Tag.findByPk(result[0].id);
    },

    getTagWithoutChildren: async () => {
        return await Tag.findOne({
            where: {
                rgt: {
                    [Op.eq]: sequelize.literal(`lft + 1`),
                },
            },
        });
    },

    getTagWithAncestors: async (ancestorsCount) => {
        let result;
        switch (ancestorsCount) {
            case ONE:
                result = await sequelize.query(
                        `SELECT child.id
                        FROM ${tableName} child
                        INNER JOIN ${tableName} parent 
                            ON parent.root_id = child.root_id
                                AND parent.lft = child.lft - 1
                        WHERE parent.id = parent.root_id
                        LIMIT 1`,
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            case MANY:
                result = await sequelize.query(
                        `SELECT child.id
                        FROM ${tableName} child
                        INNER JOIN ${tableName} parent 
                            ON parent.root_id = child.root_id
                                AND parent.lft = child.lft - 1
                        WHERE parent.id <> parent.root_id
                        LIMIT 1`,
                        {
                            type: sequelize.QueryTypes.SELECT,
                        }
                );
                break;
        }
        return await Tag.findByPk(result[0].id);
    },
});
