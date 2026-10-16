import { esperarImagensTerminarem, LIMITE_IMAGENS_MS, type ImagemParaEsperar } from './imprimir.web';

/** Imagem falsa: guarda os ouvintes e deixa o teste disparar `load`/`error`. */
function imagemFalsa(complete = false) {
  const ouvintes: Record<string, () => void> = {};
  const imagem: ImagemParaEsperar & { disparar: (tipo: 'load' | 'error') => void } = {
    complete,
    addEventListener: (tipo, ouvinte) => {
      ouvintes[tipo] = ouvinte;
    },
    disparar: (tipo) => ouvintes[tipo]?.(),
  };
  return imagem;
}

/** Marca se a promessa já foi resolvida, sem esperar por ela. */
function acompanhar(promessa: Promise<void>) {
  const estado = { resolvida: false };
  void promessa.then(() => {
    estado.resolvida = true;
  });
  return estado;
}

describe('esperarImagensTerminarem', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('não espera por imagem já completa nem arma o relógio', async () => {
    const espera = esperarImagensTerminarem([imagemFalsa(true), imagemFalsa(true)]);
    await expect(espera).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('termina quando todas carregam e limpa o relógio', async () => {
    const a = imagemFalsa();
    const b = imagemFalsa();
    const estado = acompanhar(esperarImagensTerminarem([a, b]));
    a.disparar('load');
    await Promise.resolve();
    expect(estado.resolvida).toBe(false);
    b.disparar('load');
    await jest.advanceTimersByTimeAsync(0);
    expect(estado.resolvida).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('imagem com erro conta como terminada', async () => {
    const a = imagemFalsa();
    const b = imagemFalsa();
    const estado = acompanhar(esperarImagensTerminarem([a, b]));
    a.disparar('error');
    b.disparar('load');
    await jest.advanceTimersByTimeAsync(0);
    expect(estado.resolvida).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passado o limite, segue mesmo com imagem pendurada', async () => {
    const estado = acompanhar(esperarImagensTerminarem([imagemFalsa(), imagemFalsa()]));
    await jest.advanceTimersByTimeAsync(LIMITE_IMAGENS_MS - 1);
    expect(estado.resolvida).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(estado.resolvida).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('o limite padrão é de 5 segundos', () => {
    expect(LIMITE_IMAGENS_MS).toBe(5000);
  });
});
