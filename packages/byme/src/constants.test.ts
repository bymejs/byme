import {
  BUILD_COMMANDS,
  DEFAULT_CONFIG_FILES,
  DEV_COMMAND,
  FRAMEWORK_NAME,
  MIN_NODE_VERSION,
  WATCH_DEBOUNCE_STEP,
} from './constants';

describe('constants', () => {
  it('should have the correct minimum node version', () => {
    expect(MIN_NODE_VERSION).toBe(14);
  });

  it('should have the correct default config files', () => {
    expect(DEFAULT_CONFIG_FILES).toEqual([
      '.byme.ts',
      '.byme.js',
      'config/config.ts',
      'config/config.js',
    ]);
  });

  it('should have the correct framework name', () => {
    expect(FRAMEWORK_NAME).toBe('byme');
  });

  it('should have the correct watch debounce step', () => {
    expect(WATCH_DEBOUNCE_STEP).toBe(300);
  });

  it('should have the correct dev command', () => {
    expect(DEV_COMMAND).toBe('dev');
  });

  it('should have the correct build commands', () => {
    expect(BUILD_COMMANDS).toEqual(['build']);
  });
});
