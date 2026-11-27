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

describe('perfilDoEu', () => {
  it('guarda a chave da unidade da carga (sem ela o valor salvo no aparelho chegaria vazio)', () => {
    expect(perfilDoEu({ ...EU, unidadeDeCargaHabilitada: true }).unidadeDeCargaHabilitada).toBe(true);
    expect(perfilDoEu(EU).unidadeDeCargaHabilitada).toBeUndefined();
  });

  it('guarda a chave do contrato digital; ausente fica ausente (a sessão a lê como desligada)', () => {
    expect(perfilDoEu({ ...EU, contratosHabilitados: true }).contratosHabilitados).toBe(true);
    expect(perfilDoEu(EU).contratosHabilitados).toBeUndefined();
  });

  it('guarda o WhatsApp da consultoria do aluno; ausente fica ausente', () => {
    expect(perfilDoEu({ ...EU, whatsappDaConsultoria: '45999998888' }).whatsappDaConsultoria).toBe('45999998888');
    expect(perfilDoEu(EU).whatsappDaConsultoria).toBeUndefined();
  });

  it('guarda as redes da consultoria do aluno; ausentes ficam ausentes', () => {
    const redes = { instagram: 'https://www.instagram.com/exemplo', facebook: 'https://www.facebook.com/exemplo', telegram: 'https://t.me/exemplo', site: 'https://exemplo.test' };
    expect(perfilDoEu({ ...EU, redesSociaisDaConsultoria: redes }).redesSociaisDaConsultoria).toEqual(redes);
    expect(perfilDoEu(EU).redesSociaisDaConsultoria).toBeUndefined();
  });

  it('acessoPausado vem só do motivo ATRASO do aluno (26/11: o acessoPausado da raiz saiu do /eu)', () => {
    expect(perfilDoEu(EU).acessoPausado).toBe(false);
    expect(perfilDoEu({ ...EU, aluno: { id: 'a1', nome: 'Aluno', acessoDesativadoMotivo: 'ATRASO' } }).acessoPausado).toBe(true);
    expect(perfilDoEu({ ...EU, aluno: { id: 'a1', nome: 'Aluno', acessoDesativadoMotivo: null } }).acessoPausado).toBe(false);
    expect(perfilDoEu({ ...EU, aluno: { id: 'a1', nome: 'Aluno' } }).acessoPausado).toBe(false);
  });

  it('contratoPendenteVencido só com o verdadeiro do /eu do aluno; ausente vale falso', () => {
    expect(perfilDoEu(EU).contratoPendenteVencido).toBe(false);
    expect(perfilDoEu({ ...EU, aluno: { id: 'a1', nome: 'Aluno', contratoPendenteVencido: true } }).contratoPendenteVencido).toBe(true);
    expect(perfilDoEu({ ...EU, aluno: { id: 'a1', nome: 'Aluno', contratoPendenteVencido: false } }).contratoPendenteVencido).toBe(false);
  });
});

describe('perfilAtualizado', () => {
  it('nada mudou: nulo (a sessão não troca o estado)', () => {
    const atual = perfilDoEu(EU);
    expect(perfilAtualizado(atual, perfilDoEu({ ...EU }))).toBeNull();
  });

  it('chave da plataforma ligada durante o uso aparece, e o resto mantém o mesmo objeto', () => {
    const atual = perfilDoEu(EU);
    const novo = perfilAtualizado(atual, perfilDoEu({ ...EU, usuario: { ...EU.usuario }, marca: { ...EU.marca }, retornoHabilitado: true, pagamentosHabilitados: true }));
    expect(novo?.retornoHabilitado).toBe(true);
    expect(novo?.migracaoAssistidaHabilitada).toBeUndefined();
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
