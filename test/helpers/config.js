
module.exports = {
    username: process.env.SNS_USER || 'nested_set_test',
    password: process.env.SNS_PW || null,
    database: process.env.SNS_DB || 'nested_set_test',
    host: process.env.SNS_HOST || '127.0.0.1',
    port: process.env.SNS_PORT || 3306,
    pool: {
        maxConnections: process.env.SNS_POOL_MAX || 5,
        maxIdleTime: process.env.SNS_POOL_IDLE || 30000,
    },
    dialect: process.env.SNS_DIALECT || 'mysql',
};
