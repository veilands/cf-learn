declare global {
  var jest: typeof import('@jest/globals')['jest'];
  var describe: typeof import('@jest/globals')['describe'];
  var it: typeof import('@jest/globals')['it'];
  var expect: typeof import('@jest/globals')['expect'];
  var beforeEach: typeof import('@jest/globals')['beforeEach'];
  var afterEach: typeof import('@jest/globals')['afterEach'];
  var beforeAll: typeof import('@jest/globals')['beforeAll'];
  var afterAll: typeof import('@jest/globals')['afterAll'];
  var fetch: typeof import('undici')['fetch'];
}
