const fs = require('fs-extra')
const Table = require('cli-table')
const { yellow } = require('colors')
const argv = require('yargs-parser')(process.argv.slice(2))
const path = require('path')

/*
    By default, this assumes production mode
    you can disable that by using --include-dev
    or by passing includeDev to setup
*/
let productionModifier = '--production'

let setup = includeDev => {
  console.log()

  if (argv.includeDev || includeDev) productionModifier = ''

  /*
        Check if package.json exists
        Need it to build dependency tree
    */
  let packageJSONExists = fs.existsSync('package.json')
  if (!packageJSONExists) {
    console.log('package.json not found!')
    console.log()
    process.exit()
  }
}

/*
    Get dependency tree with npm -ls
    Ignore devDependencies/bundledDependencies by default
    Adds them with --include-dev
*/
let getDependencyTree = async () => {
  const exec = require('child_process').exec;
  let result = await new Promise((resolve) => {
   exec(`npm ls --json ${productionModifier}`, (error, stdout, stderr) => {
    if (error) {
     console.warn(error);
    }
    resolve(stdout? stdout : stderr)
   })
  })
  return JSON.parse(result).dependencies
}

/*
    Get root dependencies from tree
    These are the ones declared as dependendies in package.json
    [a, b, c, d]
*/
let getRootDependencies = async () => {
  let dependencyTree = await getDependencyTree()
  if (!dependencyTree) {
    console.log('There are no dependencies!')
    console.log()
    process.exit(1)
  }
  return Object.keys(dependencyTree).sort()
}

/* to fix the missing du problem on windows */

let dirSize = root => {
  let out = 0
  let getDirSizeRecursively
  ;(getDirSizeRecursively = rootLocal => {
    let itemStats = fs.lstatSync(rootLocal)
    if (itemStats.isDirectory()) {
      let allSubs = fs.readdirSync(rootLocal)
      allSubs.forEach(file => {
        getDirSizeRecursively(path.join(rootLocal, file))
      })
    } else {
      out += itemStats.size
    }
  })(root)

  return Math.floor(out / 1024) /* in KB */
}
/*
    Get scoped modules
*/
let getScopedModules = scope => {
  let modules = {}
  let allScopes = fs.readdirSync(path.join('node_modules', scope))
  allScopes.forEach(name => {
    let itemStats = fs.lstatSync(path.join('node_modules', scope, name))
    if (itemStats.isDirectory()) {
      let size = dirSize(path.join('node_modules', scope, name))
      if (name) {
        modules[`${scope}/${name}`] = size
      }
    }
  })
  return modules
}

let getSizeForNodeModules = () => {
  let modules = {}
  let allModules = fs.readdirSync('node_modules')
  allModules.forEach(name => {
    let itemStats = fs.lstatSync(path.join('node_modules', name))
    if (itemStats.isDirectory()) {
      if (name && name[0] === '@') {
        let scopedModules = getScopedModules(name)
        Object.assign(modules, scopedModules)
      } else if (name) {
        let size = dirSize(path.join('node_modules', name))
        modules[name] = size
      }
    }
  })
  return modules
}
/*
    Get all nested dependencies for a root dependency
    Traverse recursively through the tree
    and return all the nested dependendies in a flat array
*/
let getDependenciesRecursively = (modules = [], tree) => {
  let deps = Object.keys(tree)
  for (let i = 0; i < deps.length; i++) {
    let dep = deps[i]

    if (typeof tree[dep] === 'object' && tree[dep] !== null) {
      if (tree[dep].dependencies !== null) {
        if (dep !== 'dependencies') modules.push(dep)
        getDependenciesRecursively(modules, tree[dep])
      } else if (tree[dep].version !== null) modules.push(dep)
    }
  }
  return modules
}

/*
    Attach the flat array from getDependenciesRecursively
    to it's parent
    [{
        name: rootDependency,
        children: [a, b, c, d]
    }]
*/
let attachNestedDependencies = async rootDependencies => {
  let flatDependencies = []
  let dependencyTree = await getDependencyTree()
  for (let i = 0; i < rootDependencies.length; i++) {
    let dep = rootDependencies[i]

    flatDependencies.push({
      name: dep,
      /* Get flat child dependencies array */
      children: getDependenciesRecursively([], dependencyTree[dep]),
    })
  }
  return flatDependencies.sort()
}

/*
    Get all dependencies in a flat array:
    Root dependencies +  all their children
    Deduplicate
*/
let getAllDependencies = flatDependencies => {
  let allDependencies = []
  for (let i = 0; i < flatDependencies.length; i++) {
    let dep = flatDependencies[i]

    allDependencies.push(dep.name) // Root dependency
    allDependencies = allDependencies.concat(dep.children) // Children
  }
  /* Deduplicate */
  allDependencies = allDependencies.filter((dep, index) => {
    return allDependencies.indexOf(dep) === index
  })
  return allDependencies.sort()
}

let displayResults = (flatDependencies, allDependencies, totalSize) => {
  /* Sort by size */
  let sortedDependencies = flatDependencies.sort(
    (a, b) => b.actualSize - a.actualSize
  )

  let table = new Table({ head: ['name', 'children', 'size'] })

  for (let i = 0; i < sortedDependencies.length; i++) {
    let dep = sortedDependencies[i]

    /* Showing only top 10 results in less mode */
    if (argv.less && i === 10) {
      table.push([`+ ${sortedDependencies.length - 10} modules`, null, null])
      break
    }

    table.push([
      dep.name,
      dep.numberOfChildren,
      `${(dep.actualSize / 1024).toFixed(2)}M`, // Converting to M
    ])
  }

  /* Total */
  table.push([
    yellow(`${sortedDependencies.length} modules`),
    yellow(`${allDependencies.length - sortedDependencies.length} children`),
    yellow(`${(totalSize / 1024).toFixed(2)}M`),
  ]) // Converting to M

  /* Print the table with some padding */
  console.log()
  console.log(table.toString())
  console.log()
}

module.exports = {
  setup,
  getSizeForNodeModules,
  getRootDependencies,
  attachNestedDependencies,
  getAllDependencies,
  displayResults,
}
