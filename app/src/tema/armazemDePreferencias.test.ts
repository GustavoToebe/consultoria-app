import { PREFERENCIAS_PADRAO, type Preferencias } from '../dominio/preferencias';
import { criarArmazemDePreferencias } from './armazemDePreferencias';

const SALVAS: Preferencias = { ...PREFERENCIAS_PADRAO, tema: 'CLARO', tamanhoTexto: 'GRANDE', diasSemRegistro: 14 };

/** Promessa que o teste resolve na hora que quiser, para controlar quando a leitura termina. */
function adiavel<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('armazém de preferências', () => {
  it('escolha feita antes da leitura terminar sobrevive e não apaga o resto do que estava salvo', async () => {
    const leitura = adiavel<Preferencias>();
    const gravadas: Preferencias[] = [];
    const armazem = criarArmazemDePreferencias(() => leitura.promessa, async (p) => void gravadas.push(p));
    armazem.iniciar();

    armazem.escolher({ contraste: 'ALTO' });
    expect(armazem.obter().contraste).toBe('ALTO');
    expect(gravadas).toHaveLength(0); // ainda não sabe o que estava salvo: não grava por cima

    leitura.resolver(SALVAS);
    await esperar();
    expect(armazem.obter()).toEqual({ ...SALVAS, contraste: 'ALTO' });
    expect(gravadas).toEqual([{ ...SALVAS, contraste: 'ALTO' }]);
  });

  it('duas escolhas seguidas somam, e a última de cada campo vence', async () => {
    const gravadas: Preferencias[] = [];
    const armazem = criarArmazemDePreferencias(async () => SALVAS, async (p) => void gravadas.push(p));
    armazem.iniciar();
    await esperar();

    armazem.escolher({ vibracao: false });
    armazem.escolher({ graficos: false });
    armazem.escolher({ vibracao: true });
    expect(armazem.obter()).toEqual({ ...SALVAS, vibracao: true, graficos: false });
    await esperar();
    expect(gravadas[gravadas.length - 1]).toEqual({ ...SALVAS, vibracao: true, graficos: false });
    expect(gravadas).toHaveLength(3);
  });

  it('as gravações saem na ordem, mesmo se a primeira demora', async () => {
    const primeira = adiavel<void>();
    const ordem: string[] = [];
    let chamada = 0;
    const armazem = criarArmazemDePreferencias(async () => SALVAS, async (p) => {
      const n = ++chamada;
      if (n === 1) await primeira.promessa;
      ordem.push(p.tema);
    });
    armazem.iniciar();
    await esperar();
    armazem.escolher({ tema: 'ESCURO' });
    armazem.escolher({ tema: 'SISTEMA' });
    primeira.resolver();
    await esperar();
    expect(ordem).toEqual(['ESCURO', 'SISTEMA']);
  });

  it('leitura que falha vale como nada salvo e mantém a escolha da pessoa', async () => {
    const gravadas: Preferencias[] = [];
    const armazem = criarArmazemDePreferencias(() => Promise.reject(new Error('sem acesso')), async (p) => void gravadas.push(p));
    armazem.iniciar();
    armazem.escolher({ tema: 'ESCURO' });
    await esperar();
    expect(armazem.obter()).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'ESCURO' });
  });

  it('falha ao gravar não derruba as gravações seguintes', async () => {
    const gravadas: Preferencias[] = [];
    let chamada = 0;
    const armazem = criarArmazemDePreferencias(async () => SALVAS, async (p) => {
      if (++chamada === 1) throw new Error('disco cheio');
      gravadas.push(p);
    });
    armazem.iniciar();
    await esperar();
    armazem.escolher({ vibracao: false });
    armazem.escolher({ graficos: false });
    await esperar();
    expect(gravadas).toEqual([{ ...SALVAS, vibracao: false, graficos: false }]);
  });

  it('trocar de usuário descarta a leitura antiga: nada dela aparece nem é gravado', async () => {
    const leitura = adiavel<Preferencias>();
    const gravadas: Preferencias[] = [];
    const antigo = criarArmazemDePreferencias(() => leitura.promessa, async (p) => void gravadas.push(p));
    antigo.iniciar();
    antigo.escolher({ tema: 'ESCURO' });
    antigo.parar();
    leitura.resolver(SALVAS);
    await esperar();
    expect(antigo.obter()).toEqual({ ...PREFERENCIAS_PADRAO, tema: 'ESCURO' });
    expect(gravadas).toHaveLength(0);
  });

  it('iniciar de novo depois de parar lê outra vez (montagem dupla do modo estrito)', async () => {
    const ler = jest.fn(async () => SALVAS);
    const armazem = criarArmazemDePreferencias(ler, async () => undefined);
    armazem.iniciar();
    armazem.parar();
    armazem.iniciar();
    await esperar();
    expect(armazem.obter()).toEqual(SALVAS);
  });

  it('avisa quem assinou e para de avisar depois de cancelar', async () => {
    const armazem = criarArmazemDePreferencias(async () => SALVAS, async () => undefined);
    const aviso = jest.fn();
    const cancelar = armazem.assinar(aviso);
    armazem.iniciar();
    await esperar();
    expect(aviso).toHaveBeenCalledTimes(1);
    cancelar();
    armazem.escolher({ vibracao: false });
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('apagar espera a fila, remove o que estava salvo e não deixa escolha tardia recriar', async () => {
    const primeira = adiavel<void>();
    const ordem: string[] = [];
    let chamada = 0;
    const armazem = criarArmazemDePreferencias(
      async () => SALVAS,
      async (p) => {
        if (++chamada === 1) await primeira.promessa;
        ordem.push(`gravou:${p.tema}`);
      },
      async () => void ordem.push('removeu'),
    );
    armazem.iniciar();
    await esperar();
    armazem.escolher({ tema: 'ESCURO' });
    const apagando = armazem.apagar();
    armazem.escolher({ tema: 'SISTEMA' }); // depois de sair: vale na tela, mas não é gravado
    expect(ordem).toEqual([]);
    primeira.resolver();
    await apagando;
    await esperar();
    expect(ordem).toEqual(['gravou:ESCURO', 'removeu']);
  });

  it('apagar falhando não estoura e a leitura em andamento é descartada', async () => {
    const leitura = adiavel<Preferencias>();
    const armazem = criarArmazemDePreferencias(
      () => leitura.promessa,
      async () => undefined,
      () => Promise.reject(new Error('sem acesso')),
    );
    armazem.iniciar();
    await expect(armazem.apagar()).resolves.toBeUndefined();
    leitura.resolver(SALVAS);
    await esperar();
    expect(armazem.obter()).toEqual(PREFERENCIAS_PADRAO);
  });
});
