
module.exports = {
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
};
