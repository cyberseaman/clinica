const path = require('path');

const { createDatabase } = require('../../../shared/postgres');

module.exports = createDatabase({
  migrationsDir: path.join(__dirname, '../migrations'),
});
