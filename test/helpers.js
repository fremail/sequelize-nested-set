const { LAST, FIRST, ALONE, MANY, ONE } = require('./constants');
const { Op } = require('sequelize');

module.exports = (sequelize, Tag) => ({
    getCountOfNodesPerLevel: (nodes) => {
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
                    "SELECT MAX(`id`) as `_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            case FIRST:
                result = await sequelize.query(
                    "SELECT MIN(`id`) as `_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            default:
            case ALONE:
                result = await sequelize.query(
                    "SELECT MAX(`id`) as `_id`, `level`, `root_id`, COUNT(`level`) as `per_lvl` \
                    FROM `tag` \
                    GROUP BY `level`, `root_id` \
                    HAVING `per_lvl` = 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
        }
        return await Tag.findOne({
            where: {
                id: result[0]._id,
            },
        });
    },

    getTagHavingChildren: async (childrenCount = null) => {
        let result;
        switch (childrenCount) {
            case ONE:
                result = await sequelize.query(
                    "SELECT \
                        t.id, \
                        (SELECT count(*) \
                           FROM tag t2 \
                           WHERE t2.lft > t.lft \
                             AND t2.rgt < t.rgt \
                             AND t.root_id = t2.root_id \
                             AND t2.level = t.level + 1) AS cc \
                    FROM tag t \
                    HAVING cc = 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
                break;
            case MANY:
                result = await sequelize.query(
                    "SELECT \
                        t.id, \
                        (SELECT count(*) \
                           FROM tag t2 \
                           WHERE t2.lft > t.lft \
                             AND t2.rgt < t.rgt \
                             AND t.root_id = t2.root_id \
                             AND t2.level = t.level + 1) AS cc \
                    FROM tag t \
                    HAVING cc > 1 \
                    LIMIT 1",
                    {
                        type: sequelize.QueryTypes.SELECT,
                    }
                );
        }
        return await Tag.findOne({
            where: {
                id: result[0].id,
            },
        });
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
        let level;
        switch (ancestorsCount) {
            case ONE:
                level = 0;
                break;
            case MANY:
                level = 1;
                break;
        }
        return await Tag.findOne({
            where: {
                level: {
                    [Op.gt]: level,
                },
            },
        });
    },
});
