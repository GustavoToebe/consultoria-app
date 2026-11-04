import {
  criarRenovacaoDoPush, deveRegistrarAoAbrir, INTERVALO_RENOVACAO_DO_PUSH_MS, oferecerAvisoNoCelular, plataformaDoPush,
  tokenDePushValido,
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

describe('criarRenovacaoDoPush', () => {
  it('renova na abertura e, ao voltar para a frente, só depois de 24 h da última tentativa', async () => {
    let agora = 1_000;
    const renovar = jest.fn(async () => undefined);
    const renovacao = criarRenovacaoDoPush(renovar, () => agora);

    expect(await renovacao.talvez()).toBe(true);
    agora += INTERVALO_RENOVACAO_DO_PUSH_MS - 1;
    expect(await renovacao.talvez()).toBe(false);
    agora += 1;
    expect(await renovacao.talvez()).toBe(true);
    expect(renovar).toHaveBeenCalledTimes(2);
  });

  it('falha conta como tentativa (não repete a cada volta) e não escapa', async () => {
    let agora = 0;
    const renovar = jest.fn(async () => { throw new Error('sem internet'); });
    const renovacao = criarRenovacaoDoPush(renovar, () => agora);

    expect(await renovacao.talvez()).toBe(true);
    agora += 60_000;
    expect(await renovacao.talvez()).toBe(false);
    expect(renovar).toHaveBeenCalledTimes(1);
  });

  it('uma por vez: a volta que chega durante a renovação espera e não renova de novo', async () => {
    let soltar!: () => void;
    const renovar = jest.fn(() => new Promise<void>((r) => { soltar = r; }));
    const renovacao = criarRenovacaoDoPush(renovar, () => 0, 0);

    const primeira = renovacao.talvez();
    const segunda = renovacao.talvez();
    soltar();
    expect(await primeira).toBe(true);
    expect(await segunda).toBe(false);
    expect(renovar).toHaveBeenCalledTimes(1);
  });
});
