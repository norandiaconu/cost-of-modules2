const test = require('ava');
const helpers = require('../../../src/helpers');

let tests = (testData) => {
    let moduleSizes, rootDependencies, flatDependencies, allDependencies;

    test('get size for node_modules', t => {
        moduleSizes = helpers.getSizeForNodeModules();
        let names = Object.keys(moduleSizes).sort();
        let moduleSizesArray = [];
        for (let name of names) moduleSizesArray.push({name, size: moduleSizes[name]});
        t.deepEqual(moduleSizesArray, testData.moduleSizesArray);
    });

    test('get root dependencies', async t => {
        rootDependencies = await helpers.getRootDependencies();
        t.deepEqual(rootDependencies, testData.rootDependencies);
    });

    test('attach nested dependencies', async t => {
        rootDependencies = await helpers.getRootDependencies();
        flatDependencies = await helpers.attachNestedDependencies(rootDependencies);
        t.deepEqual(flatDependencies, testData.flatDependencies);
    });

    test('get all dependencies', async t => {
        rootDependencies = await helpers.getRootDependencies();
        flatDependencies = await helpers.attachNestedDependencies(rootDependencies);
        allDependencies = await helpers.getAllDependencies(flatDependencies);
        console.dir(allDependencies, {'maxArrayLength': null});
        t.deepEqual(allDependencies, testData.allDependencies);
    });
};

module.exports = tests;

