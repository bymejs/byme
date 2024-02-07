import {
  checkLocal,
  checkVersion as checkNodeVersion,
  deepmerge,
  logger,
  setNoDeprecation,
  setNodeTitle,
  yParser,
} from '@umijs/utils';
import { BUILD_COMMANDS, DEV_COMMAND, MIN_NODE_VERSION } from './constants';
import { Service } from './service';

interface IOpts {
  args?: yParser.Arguments;
}

export async function run(_opts?: IOpts) {
  checkNodeVersion(MIN_NODE_VERSION);
  checkLocal();
  setNodeTitle('byme');
  setNoDeprecation();

  const args =
    _opts?.args ||
    yParser(process.argv.slice(2), {
      alias: {
        version: ['v'],
        help: ['h'],
      },
      boolean: ['version'],
    });
  const command = args._[0];

  if (command === DEV_COMMAND) {
    process.env.NODE_ENV = 'development';
  } else if (BUILD_COMMANDS.includes(command)) {
    process.env.NODE_ENV = 'production';
  }

  try {
    const service = new Service();

    await service.run2({
      name: command,
      args: deepmerge({}, args),
    });

    // handle restart for dev command
    if (command === DEV_COMMAND) {
      async function listener(data: any) {
        if (data?.type === 'RESTART') {
          // off self
          process.off('message', listener);

          // restart
          run({ args });
        }
      }

      process.on('message', listener);
    }
  } catch (e: any) {
    logger.error(e);
    process.exit(1);
  }
}
