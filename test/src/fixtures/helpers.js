const helpers = require('../../../src/helpers');
const tests = require('./tests.js');

let setup = (includeDev) => {
    helpers.setup(includeDev);
};

module.exports = {
    setup, tests
};
