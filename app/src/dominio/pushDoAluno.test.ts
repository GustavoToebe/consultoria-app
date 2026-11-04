import {
  deveRegistrarAoAbrir, oferecerAvisoNoCelular, plataformaDoPush, tokenDePushValido,
} from './pushDoAluno';

describe('plataformaDoPush', () => {
  it('traduz para o nome da API e deixa a web sem push', () => {
    expect(plataformaDoPush('android')).toBe('ANDROID');
    expect(plataformaDoPush('ios')).toBe('IOS');
    expect(plataformaDoPush('web')).toBeNull();
    expect(plataformaDoPush('windows')).toBeNull();
  });
});

describe('tokenDePushValido', () => {
  it('aceita o formato do Expo, igual ao da API', () => {
    expect(tokenDePushValido('ExponentPushToken[abcdefgh12345678]')).toBe(true);
    expect(tokenDePushValido('ExpoPushToken[abc-def_ghi123]')).toBe(true);
  });
  it('recusa o que a API recusaria', () => {
    expect(tokenDePushValido('ExponentPushToken[curto]')).toBe(false);
    expect(tokenDePushValido('ExponentPushToken[abcdefgh 1234]')).toBe(false);
    expect(tokenDePushValido('fcm-token-qualquer')).toBe(false);
    expect(tokenDePushValido(`ExponentPushToken[${'a'.repeat(200)}]`)).toBe(false);
    expect(tokenDePushValido(null)).toBe(false);
    expect(tokenDePushValido(42)).toBe(false);
  });
});

describe('oferecerAvisoNoCelular', () => {
  it('só no celular e só com a chave da plataforma ligada', () => {
    expect(oferecerAvisoNoCelular('android', true)).toBe(true);
    expect(oferecerAvisoNoCelular('ios', true)).toBe(true);
    expect(oferecerAvisoNoCelular('android', false)).toBe(false);
    expect(oferecerAvisoNoCelular('web', true)).toBe(false);
  });
});

describe('deveRegistrarAoAbrir', () => {
  const base = { preferenciaLigada: true, pushHabilitado: true, os: 'android', permitido: true as boolean | null };
  it('registra quando tudo está ligado e o aparelho deixa notificar', () => {
    expect(deveRegistrarAoAbrir(base)).toBe(true);
  });
  it('não registra sem preferência, sem a chave, na web, sem permissão ou sem suporte', () => {
    expect(deveRegistrarAoAbrir({ ...base, preferenciaLigada: false })).toBe(false);
    expect(deveRegistrarAoAbrir({ ...base, pushHabilitado: false })).toBe(false);
    expect(deveRegistrarAoAbrir({ ...base, os: 'web' })).toBe(false);
    expect(deveRegistrarAoAbrir({ ...base, permitido: false })).toBe(false);
    expect(deveRegistrarAoAbrir({ ...base, permitido: null })).toBe(false);
  });
});
