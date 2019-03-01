const path = require('path');
const glob = require('glob');

module.exports = class FalconNormalModuleOverridePlugin {
  constructor(moduleReplacementMap) {
    this.name = 'FalconNormalModuleOverridePlugin';
    this.moduleReplacementMap = moduleReplacementMap;
    this.context = path.resolve(process.cwd());
  }

  requireResolveIfExists(id, options = undefined) {
    try {
      return require.resolve(id, options);
    } catch (e) {
      return false;
    }
  }

  resolveModulePath(context, request) {
    const filePathWithoutExtension = path.resolve(context, request);
    const files = glob.sync(`${filePathWithoutExtension}@(|.*)`);
    if (files.length === 0) {
      throw new Error(`There is no file '${filePathWithoutExtension}'`);
    }
    if (files.length > 1) {
      throw new Error(`There is more that one file '${filePathWithoutExtension}'`);
    }

    return require.resolve(files[0]);
  }

  apply(compiler) {
    const { moduleReplacementMap } = this;
    const moduleMap = Object.keys(moduleReplacementMap).reduce(
      (result, x) => ({
        ...result,
        [require.resolve(x)]:
          this.requireResolveIfExists(moduleReplacementMap[x]) ||
          this.resolveModulePath(this.context, moduleReplacementMap[x])
      }),
      {}
    );

    compiler.hooks.normalModuleFactory.tap(this.name, nmf => {
      nmf.hooks.beforeResolve.tap(this.name, e => {
        if (!e) {
          return;
        }

        const moduleToReplace = this.requireResolveIfExists(e.request, { paths: [e.context] });
        if (moduleToReplace && moduleMap[moduleToReplace]) {
          e.request = moduleMap[moduleToReplace];
        }

        return e;
      });
    });
  }
};
