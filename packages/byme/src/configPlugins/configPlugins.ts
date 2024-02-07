import type { IApi } from '../types';
import { getSchemas as getExtraSchemas } from './schema';

export default (api: IApi) => {
  const configDefaults: Record<string, any> = {
    alias: {
      umi: '@@/exports',
    },
    autoCSSModules: true,
    publicPath: '/',
    mountElementId: 'root',
    base: '/',
    history: { type: 'browser' },
    routeLoader: { moduleType: 'esm' },
  };

  const extraSchemas = getExtraSchemas();
  const schemas = {
    ...extraSchemas,
  };
  for (const key of Object.keys(schemas)) {
    const config: Record<string, any> = {
      schema: schemas[key] || ((Joi: any) => Joi.any()),
    };
    if (key in configDefaults) {
      config.default = configDefaults[key];
    }

    // when routes change, not need restart server
    // routes data will auto update in `onGenerateFiles` (../tmpFiles/tmpFiles.ts)
    if (['routes'].includes(key)) {
      config.onChange = api.ConfigChangeType.regenerateTmpFiles;
    }

    api.registerPlugins([
      {
        id: `virtual: config-${key}`,
        key: key,
        config,
      },
    ]);
  }

  // api.paths is ready after register
  api.modifyConfig((memo, args) => {
    memo.alias = {
      ...memo.alias,
      '@': args.paths.absSrcPath,
      '@@': args.paths.absTmpPath,
    };
    return memo;
  });
};
