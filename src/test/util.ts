import { readFileSync } from 'fs';
import upath from 'upath';

function getCallerFileName(): string {
  let result = '';

  const prepareStackTrace = Error.prepareStackTrace;
  const stackTraceLimit = Error.stackTraceLimit;

  Error.prepareStackTrace = (_err, stack) => stack;
  Error.stackTraceLimit = 5; // max calls inside this file + 1

  try {
    const err = new Error();

    const stack = err.stack as unknown as NodeJS.CallSite[];

    let currentFile = null;
    for (const frame of stack) {
      const fileName = frame.getFileName();
      if (!currentFile) {
        currentFile = fileName;
      } else if (currentFile !== fileName && fileName != null) {
        result = fileName;
        break;
      }
    }
  } catch (e) {
    // no-op
  }

  Error.prepareStackTrace = prepareStackTrace;
  Error.stackTraceLimit = stackTraceLimit;

  return result;
}

export function getFixturePath(fixtureFile: string, fixtureRoot = '.'): string {
  const callerDir = upath.dirname(getCallerFileName());
  return upath.join(callerDir, fixtureRoot, '__fixtures__', fixtureFile);
}

export function loadFixture(fixtureFile: string, fixtureRoot = '.'): string {
  const fixtureAbsFile = getFixturePath(fixtureFile, fixtureRoot);
  return readFileSync(fixtureAbsFile, { encoding: 'utf8' });
}
