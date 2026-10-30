import type { EuResponse } from '../api/tipos';
import { criarRecargaDoPerfil, INTERVALO_RECARGA_DO_PERFIL_MS, perfilAtualizado, perfilDoEu } from './perfilDaSessao';

const EU: EuResponse = {
  usuario: { id: 'u1', nome: 'Aluno Fictício', email: 'aluno@exemplo.test', papel: 'ALUNO' } as EuResponse['usuario'],
  marca: { id: 'c1', nome: 'Consultoria Fictícia', corPrimaria: '#123456', fonteTitulo: 'PADRAO', temaPadrao: 'CLARO', logoUrl: null },
  funcionalidadesDoPlano: ['PDF'],
  pagamentosHabilitados: false,
  retornoHabilitado: false,
  cicloHabilitado: false,
  termosPendentes: false,
  termosVersao: '1',
};

describe('perfilAtualizado', () => {
  it('nada mudou: nulo (a sessão não troca o estado)', () => {
    const atual = perfilDoEu(EU);
    expect(perfilAtualizado(atual, perfilDoEu({ ...EU }))).toBeNull();
  });

  it('chave da plataforma ligada durante o uso aparece, e o resto mantém o mesmo objeto', () => {
    const atual = perfilDoEu(EU);
    const novo = perfilAtualizado(atual, perfilDoEu({ ...EU, usuario: { ...EU.usuario }, marca: { ...EU.marca }, retornoHabilitado: true, pagamentosHabilitados: true }));
    expect(novo?.retornoHabilitado).toBe(true);
    expect(novo?.pagamentosHabilitados).toBe(true);
    expect(novo?.usuario).toBe(atual.usuario);
    expect(novo?.marca).toBe(atual.marca);
    expect(novo?.funcionalidadesDoPlano).toBe(atual.funcionalidadesDoPlano);
  });

  it('funcionalidade tirada do plano e marca nova trocam só o que mudou', () => {
    const atual = perfilDoEu(EU);
    const novo = perfilAtualizado(atual, perfilDoEu({ ...EU, funcionalidadesDoPlano: [], marca: { ...EU.marca, corPrimaria: '#654321' } }));
    expect(novo?.funcionalidadesDoPlano).toEqual([]);
    expect(novo?.marca).not.toBe(atual.marca);
    expect(novo?.usuario).toBe(atual.usuario);
  });
});

describe('criarRecargaDoPerfil', () => {
  function relogio(inicio = 1_000_000) {
    let t = inicio;
    return { agora: () => t, andar: (ms: number) => { t += ms; } };
  }

  it('busca na primeira vez e depois só passado o intervalo', async () => {
    const r = relogio();
    const recarregar = jest.fn(async () => undefined);
    const recarga = criarRecargaDoPerfil(recarregar, r.agora);
    expect(await recarga.talvez()).toBe(true);
    r.andar(INTERVALO_RECARGA_DO_PERFIL_MS - 1);
    expect(await recarga.talvez()).toBe(false);
    r.andar(1);
    expect(await recarga.talvez()).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it('a sessão recém-aberta conta como busca (marcar)', async () => {
    const r = relogio();
    const recarregar = jest.fn(async () => undefined);
    const recarga = criarRecargaDoPerfil(recarregar, r.agora);
    recarga.marcar();
    r.andar(60_000);
    expect(await recarga.talvez()).toBe(false);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('uma por vez: duas voltas seguidas fazem uma busca só', async () => {
    const r = relogio();
    let soltar!: () => void;
    const recarregar = jest.fn(() => new Promise<void>((ok) => { soltar = ok; }));
    const recarga = criarRecargaDoPerfil(recarregar, r.agora);
    const primeira = recarga.talvez();
    r.andar(INTERVALO_RECARGA_DO_PERFIL_MS * 2);
    const segunda = recarga.talvez();
    soltar();
    expect(await primeira).toBe(true);
    expect(await segunda).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('sem conexão: o erro é engolido e não vira busca a cada volta do app', async () => {
    const r = relogio();
    const recarregar = jest.fn(async () => { throw new Error('sem conexão'); });
    const recarga = criarRecargaDoPerfil(recarregar, r.agora);
    expect(await recarga.talvez()).toBe(true);
    r.andar(1_000);
    expect(await recarga.talvez()).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
