const constants = require('./constants');

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
            case constants.LAST:
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
            case constants.FIRST:
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
            case constants.ALONE:
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
});
