import type { EstadoEnvio } from '../offline/AlunoProvider';
import { ATRASO_SEM_CONEXAO_MS, SeloSincronizacao } from './SeloSincronizacao';

/** N28 (auditoria 03/11): o "Sem conexão" do rodapé só aparece depois de 2,5 s seguidos sem rede; pendente e falha, na hora. */
const estado = { pendentes: 0, falhas: [] as unknown[], falhasDeMobilidade: [] as unknown[], falhasDeConclusao: [] as unknown[], falhasDeAgua: [] as unknown[], envio: 'ocioso' as EstadoEnvio, online: true, tentarDeNovo: () => undefined };
let mockAtual = { ...estado };
jest.mock('../offline/AlunoProvider', () => ({ useAluno: () => mockAtual }));
jest.mock('../ui/SeloAnimado', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SeloAnimado: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

let arvore: Arvore;
const montar = async () => {
  await Renderer.act(async () => {
    arvore = Renderer.create(<SeloSincronizacao noRodape />);
  });
};
const remontar = async (mudanca: Partial<typeof estado>) => {
  mockAtual = { ...mockAtual, ...mudanca };
  await Renderer.act(async () => arvore.update(<SeloSincronizacao noRodape />));
};
const avancar = (ms: number) => Renderer.act(async () => { jest.advanceTimersByTime(ms); });
const texto = () => JSON.stringify(arvore.toJSON() ?? '');

beforeEach(() => {
  jest.useFakeTimers();
  mockAtual = { ...estado };
});
afterEach(async () => {
  await Renderer.act(async () => arvore.unmount());
  jest.useRealTimers();
});

describe('SeloSincronizacao no rodapé', () => {
  it('tudo enviado: sem selo', async () => {
    await montar();
    expect(arvore.toJSON()).toBeNull();
  });

  it('sem rede por menos de 2,5 s: não aparece; depois de 2,5 s: aparece', async () => {
    mockAtual = { ...estado, online: false };
    await montar();
    await avancar(ATRASO_SEM_CONEXAO_MS - 1);
    expect(arvore.toJSON()).toBeNull();
    await avancar(1);
    expect(texto()).toContain('Sem conexão');
  });

  it('a rede volta antes do tempo: nada aparece, e o tempo recomeça na próxima queda', async () => {
    mockAtual = { ...estado, online: false };
    await montar();
    await avancar(2000);
    await remontar({ online: true });
    await avancar(ATRASO_SEM_CONEXAO_MS);
    expect(arvore.toJSON()).toBeNull();
    await remontar({ online: false });
    await avancar(2000);
    expect(arvore.toJSON()).toBeNull(); // contou do zero, não dos 2 s de antes
    await avancar(500);
    expect(texto()).toContain('Sem conexão');
  });

  it('o selo some quando a rede volta depois de aparecer', async () => {
    mockAtual = { ...estado, online: false };
    await montar();
    await avancar(ATRASO_SEM_CONEXAO_MS);
    await remontar({ online: true });
    expect(arvore.toJSON()).toBeNull();
  });

  it('pendente e falha aparecem na hora, mesmo sem rede', async () => {
    mockAtual = { ...estado, online: false, pendentes: 2 };
    await montar();
    expect(texto()).toContain('Sem conexão — 2 salvo(s) no aparelho');
    await remontar({ online: true, pendentes: 0, falhas: [{}] });
    expect(texto()).toContain('Falha ao enviar');
  });
});
