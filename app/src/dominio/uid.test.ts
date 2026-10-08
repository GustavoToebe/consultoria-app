import { novoUid } from './uid';

describe('novoUid', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
  afterEach(() => {
    if (original) Object.defineProperty(globalThis.crypto, 'randomUUID', original);
  });

  it('gera UUID v4 mesmo sem crypto.randomUUID (web em http)', () => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    const a = novoUid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(novoUid()).not.toBe(a);
  });
});
