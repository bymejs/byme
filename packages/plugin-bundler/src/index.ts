import {
  address,
  chalk,
  lodash,
  logger,
  portfinder,
  rimraf,
  winPath,
} from '@umijs/utils';
import type { GenerateFilesFn, IApi } from 'byme';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Worker } from 'worker_threads';
import { DEFAULT_HOST, DEFAULT_PORT } from './constants';
import { printMemoryUsage } from './printMemoryUsage';
import {
  addUnWatch,
  createDebouncedHandler,
  expandCSSPaths,
  expandJSPaths,
  unwatch,
  watch,
} from './watch';

export default (api: IApi) => {
  api.describe({
    key: 'bundler',
    config: {
      schema({ zod }) {
        return zod
          .object({
            path: zod.string(),
            entry: zod.string(),
          })
          .deepPartial();
      },
    },
    enableBy() {
      return api.name === 'dev';
    },
  });

  api.registerCommand({
    name: 'dev',
    description: 'dev server for development',
    details: `
byme dev

# dev byme specified port
PORT=8888 byme dev
`,
    async fn() {
      logger.info(chalk.cyan.bold(`Byme v${api.appData.umi.version}`));
      const { path } = api.config.bundler;
      if (!path) {
        // TODO: 这里会有默认行为，后续补充
        logger.error('dev bundler 必须指定路径');
      }

      // clear tmp
      rimraf.sync(api.paths.absTmpPath);

      // check package.json
      await api.applyPlugins({
        key: 'onCheckPkgJSON',
        args: {
          origin: null,
          current: api.appData.pkg,
        },
      });

      // generate files
      const generate: GenerateFilesFn = async (opts) => {
        await api.applyPlugins({
          key: 'onGenerateFiles',
          args: {
            files: opts.files || null,
            isFirstTime: opts.isFirstTime,
          },
        });
      };

      await generate({
        isFirstTime: true,
      });
      const { absPagesPath, absSrcPath } = api.paths;
      const watcherPaths: string[] = await api.applyPlugins({
        key: 'addTmpGenerateWatcherPaths',
        initialValue: [
          absPagesPath,
          !api.config.routes && api.config.conventionRoutes?.base,
          join(absSrcPath, 'layouts'),
          ...expandJSPaths(join(absSrcPath, 'loading')),
          ...expandJSPaths(join(absSrcPath, 'app')),
          ...expandJSPaths(join(absSrcPath, 'global')),
          ...expandCSSPaths(join(absSrcPath, 'global')),
          ...expandCSSPaths(join(absSrcPath, 'overrides')),
        ].filter(Boolean),
      });
      lodash.uniq<string>(watcherPaths.map(winPath)).forEach((p: string) => {
        watch({
          path: p,
          addToUnWatches: true,
          onChange: createDebouncedHandler({
            timeout: 2000,
            async onChange(opts) {
              await generate({ files: opts.files, isFirstTime: false });
            },
          }),
        });
      });

      // watch package.json change
      const pkgPath = join(api.cwd, 'package.json');
      watch({
        path: pkgPath,
        addToUnWatches: true,
        onChange() {
          // Why try catch?
          // ref: https://github.com/umijs/umi/issues/8608
          try {
            const origin = api.appData.pkg;
            api.appData.pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            api.applyPlugins({
              key: 'onCheckPkgJSON',
              args: {
                origin,
                current: api.appData.pkg,
              },
            });
            api.applyPlugins({
              key: 'onPkgJSONChanged',
              args: {
                origin,
                current: api.appData.pkg,
              },
            });
          } catch (e) {
            logger.error(e);
          }
        },
      });

      // watch config change
      addUnWatch(
        api.service.configManager!.watch({
          schemas: api.service.configSchemas,
          onChangeTypes: api.service.configOnChanges,
          async onChange(opts) {
            await api.applyPlugins({
              key: 'onCheckConfig',
              args: {
                config: api.config,
                userConfig: api.userConfig,
              },
            });
            const { data } = opts;
            if (data.changes[api.ConfigChangeType.reload]) {
              logger.event(
                `config ${data.changes[api.ConfigChangeType.reload].join(
                  ', ',
                )} changed, restart server...`,
              );
              api.restartServer();
              return;
            }
            await api.service.resolveConfig();
            if (data.changes[api.ConfigChangeType.regenerateTmpFiles]) {
              logger.event(
                `config ${data.changes[
                  api.ConfigChangeType.regenerateTmpFiles
                ].join(', ')} changed, regenerate tmp files...`,
              );
              await generate({ isFirstTime: false });
            }
            for await (const fn of data.fns) {
              await fn();
            }
          },
        }),
      );
      // watch public dir change and restart server
      function watchPublicDirChange() {
        const publicDir = join(api.cwd, 'public');
        const isPublicAvailable =
          existsSync(publicDir) && readdirSync(publicDir).length;
        let restarted = false;
        const restartServer = () => {
          if (restarted) return;
          restarted = true;
          logger.event(`public dir changed, restart server...`);
          api.restartServer();
        };
        watch({
          path: publicDir,
          addToUnWatches: true,
          onChange(event, path) {
            if (isPublicAvailable) {
              // listen public dir delete event
              if (event === 'unlinkDir' && path === publicDir) {
                restartServer();
              } else if (
                // listen public files all deleted
                event === 'unlink' &&
                existsSync(publicDir) &&
                readdirSync(publicDir).length === 0
              ) {
                restartServer();
              }
            } else {
              // listen public dir add first file event
              if (
                event === 'add' &&
                existsSync(publicDir) &&
                readdirSync(publicDir).length === 1
              ) {
                restartServer();
              }
            }
          },
        });
      }
      watchPublicDirChange();

      const debouncedPrintMemoryUsage = lodash.debounce(printMemoryUsage, 5000);

      let startBuildWorker: (deps: any[]) => Worker = (() => {}) as any;

      const opts: any = {
        config: api.config,
        pkg: api.pkg,
        cwd: api.cwd,
        rootDir: process.cwd(),
        entry: api.config.dev?.entry ?? '',
        port: api.appData.port,
        host: api.appData.host,
        ip: api.appData.ip,
        onDevCompileDone(opts: any) {
          debouncedPrintMemoryUsage;
          // debouncedPrintMemoryUsage();
          api.appData.bundleStatus.done = true;
          api.applyPlugins({
            key: 'onDevCompileDone',
            args: opts,
          });
        },
        onProgress(opts: any) {
          api.appData.bundleStatus.progresses = opts.progresses;
        },
        cache: {
          buildDependencies: [
            api.pkgPath,
            api.service.configManager!.mainConfigFile || '',
          ].filter(Boolean),
        },
        startBuildWorker,
        onBeforeMiddleware(app: any) {
          api.applyPlugins({
            key: 'onBeforeMiddleware',
            args: {
              app,
            },
          });
        },
      };
      const dev = require(path);

      await api.applyPlugins({
        key: 'onBeforeCompiler',
        args: { compiler: dev, opts },
      });

      await dev(opts);
    },
  });

  api.modifyAppData(async (memo) => {
    memo.port = await portfinder.getPortPromise({
      port: parseInt(String(process.env.PORT || DEFAULT_PORT), 10),
    });
    memo.host = process.env.HOST || DEFAULT_HOST;
    memo.ip = address.ip();
    return memo;
  });

  api.registerMethod({
    name: 'restartServer',
    fn() {
      logger.info(`Restart dev server with port ${api.appData.port}...`);
      unwatch();

      process.send?.({
        type: 'RESTART',
        payload: {
          port: api.appData.port,
        },
      });
    },
  });
};
