const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const authSettings = require('./config/auth-settings');
const uploadSettings = require('./config/upload-settings');
const serverSettings = require('./config/server-settings');

module.exports = { ...serverSettings, ...authSettings, ...uploadSettings };
