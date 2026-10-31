import { ErroApi } from '@plataforma/web';
import type { PaginaInadimplentes, Painel as PainelFinanceiro } from '../api/financeiroTipos';
import type { ContagensInscricoes } from '../api/inscricoesTipos';
import type { PainelTreinador, RecordesDaSemana } from '../api/tipos';
import { periodoDoCalendario } from './agendaCalendario';
import {
  alternarBloco, barrasDoRecebido, blocoDisponivel, BLOCOS_DO_PAINEL, blocosParaEditar, blocosPermitidos, blocosVisiveis,
  chaveDaConsulta, compromissosDaSemana, consultaDaAgenda, consultasDoBloco, enderecoDoBloco, FONTE_CARREGANDO, FONTE_DESLIGADA,
  FONTE_FALHOU, fontePronta, folhaPastasARenovar, folhaRecordes, folhaSemRegistro, fonteDaConsulta, inicioSemAlunos, moverBloco,
  montarBloco, PAINEL_DO_INICIO_PADRAO, periodoDoFinanceiroNoPainel, reaisSemCentavos, resumoDaFolha, roscaDosAlunos,
  type BlocoDoPainel, type BlocoDoPainelId, type ContextoDoPainel, type FontesDoPainel, type OpcoesDoBloco, type PainelDoInicioPreferido,
} from './painelDoInicio';

const TODAS = [
  'PAINEL_VER', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER', 'INSCRICAO_LER', 'REGISTRO_LER', 'ALUNO_LER', 'TREINO_LER', 'AGENDA_LER', 'FINANCEIRO_LER',
];
const ctxCom = (permissoes: readonly string[] = TODAS, extra: Partial<ContextoDoPainel> = {}): ContextoDoPainel => ({
  pode: (c) => permissoes.includes(c), pagamentosHabilitados: true, retornoHabilitado: true, ...extra,
});
const HOJE = '2026-10-31'; // sábado
const opcoes = (extra: Partial<OpcoesDoBloco> = {}): OpcoesDoBloco => ({ meus: false, dias: 7, graficos: true, hoje: HOJE, usuarioId: 'u1', ...extra });

const painel = (extra: Partial<PainelTreinador> = {}): PainelTreinador => ({
  atualizacoesParaRevisar: 3, atualizacoesAtrasadas: 2, atualizacoesAvisaramAtraso: 1, atualizacoesProximas: 5,
  alunosAtivos: 10, alunosInativos: 4, alunosSemAcesso: 3,
  alunosSemRegistro: [{ id: 'a1', nome: 'Aluno Um', ultimoRegistro: '2026-10-20' }, { id: 'a2', nome: 'Aluno Dois', ultimoRegistro: null }],
  ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 2,
  pastasParaRenovar: [{ pasta: { id: 'p1', titulo: 'Hipertrofia' }, aluno: { id: 'a1', nome: 'Aluno Um' }, fim: '2026-11-03' }],
  alunosSemPastaComPeriodo: 4, alunosSemRegistroTotal: 2, sessoesConcluidas7Dias: 12,
  ...extra,
} as unknown as PainelTreinador);

const contagens = (extra: Partial<ContagensInscricoes> = {}): ContagensInscricoes => ({
  porSituacao: { NOVA: 6, EM_CONTATO: 3, EM_NEGOCIACAO: 2, CONVERTIDA: 1, PERDIDA: 0 },
  abertas: 11, todas: 12, retornosAtrasados: 1, retornosHoje: 2, ...extra,
} as unknown as ContagensInscricoes);

const financeiro = (extra: Record<string, unknown> = {}): PainelFinanceiro => ({
  serie: [
    { mes: '2026-09', parcial: false, recebidoCentavos: 500000, previstoCentavos: null, entradasAvulsasCentavos: 20000, saidasAvulsasCentavos: 10000, resultadoCentavos: null },
    { mes: '2026-10', parcial: true, recebidoCentavos: null, previstoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null },
  ],
  // O cartão do período soma 6 meses: não pode ser lido como "recebido no mês".
  cartoes: { recebidoCentavos: 9_999_900 },
  proximosRecebimentos: { fonte: 'ABERTAS', em7Dias: { valorCentavos: 124060, cobrancas: 4 }, em30Dias: { valorCentavos: 300000, cobrancas: 9 } },
  resultadoDoMes: { rotulo: 'out/2026', mes: '2026-10', recebidoCentavos: 350000, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0 },
  ...extra,
} as unknown as PainelFinanceiro);

const inadimplentes = (extra: Partial<PaginaInadimplentes> = {}): PaginaInadimplentes => ({ itens: [], total: 3, valorTotalCentavos: 45050, pagina: 0, ...extra });
const recordes = (total = 2): RecordesDaSemana => ({
  de: '2026-10-25', ate: '2026-10-31', total,
  series: [{ alunoId: 'a1', alunoNome: 'Aluno Um', data: '2026-10-30', exercicioId: 'e1', exercicioNome: 'Supino', recordes: [{ tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 8, valor: 70 }] }],
});

const fontes = (extra: FontesDoPainel = {}): FontesDoPainel => ({
  painel: fontePronta(painel()), interessados: fontePronta(contagens()), recordes: fontePronta(recordes()),
  agenda: fontePronta({ dias: [{ data: '2026-10-26', compromissos: 2, eventos: 0 }, { data: '2026-10-28', compromissos: 3, eventos: 1 }] }),
  inadimplentes: fontePronta(inadimplentes()), financeiro: fontePronta(financeiro()), ...extra,
});

function bloco(id: BlocoDoPainelId, f: FontesDoPainel = fontes(), ctx = ctxCom(), o: Partial<OpcoesDoBloco> = {}): BlocoDoPainel {
  const b = montarBloco(id, ctx, { ...opcoes(o), fontes: f });
  if (!b) throw new Error(`bloco ${id} não existe`);
  return b;
}
const cartaoDe = (b: BlocoDoPainel, chave: string) => {
  const c = [...b.cartoes, ...(b.linha ? [b.linha] : [])].find((x) => x.chave === chave);
  if (!c) throw new Error(`cartão ${chave} não existe em ${b.id}`);
  return c;
};
const href = (d: { tipo: string; href?: string } | null) => (d && d.tipo === 'endereco' ? d.href : null);

describe('permissões e chaves do /eu decidem quais blocos existem', () => {
  it('com tudo liberado, os 8 blocos existem', () => {
    expect(BLOCOS_DO_PAINEL.filter((id) => blocoDisponivel(id, ctxCom()))).toHaveLength(8);
  });

  it.each<[BlocoDoPainelId, string]>([
    ['atualizacoes', 'ATUALIZACAO_LER'], ['atualizacoes', 'ALUNO_SENSIVEL_LER'], ['interessados', 'INSCRICAO_LER'], ['treinos', 'REGISTRO_LER'],
    ['treinos', 'ALUNO_LER'], ['pastas', 'TREINO_LER'], ['agenda', 'AGENDA_LER'], ['financeiro', 'FINANCEIRO_LER'], ['recebido', 'FINANCEIRO_LER'],
    ['alunos', 'ALUNO_LER'], ['alunos', 'PAINEL_VER'],
  ])('sem %s faltando %s o bloco some', (id, codigo) => {
    const ctx = ctxCom(TODAS.filter((c) => c !== codigo));
    expect(blocoDisponivel(id, ctx)).toBe(false);
    expect(montarBloco(id, ctx, { ...opcoes(), fontes: fontes() })).toBeNull();
    expect(consultasDoBloco(id, ctx, opcoes())).toEqual([]);
  });

  it('financeiro desligado na plataforma (/eu) esconde Financeiro e Recebido, mesmo com a permissão', () => {
    const ctx = ctxCom(TODAS, { pagamentosHabilitados: false });
    expect(blocoDisponivel('financeiro', ctx)).toBe(false);
    expect(blocoDisponivel('recebido', ctx)).toBe(false);
    expect(blocoDisponivel('atualizacoes', ctx)).toBe(true);
  });

  it('o Treinos continua existindo com o "Concluir treino" desligado (só perde dois cartões)', () => {
    expect(blocoDisponivel('treinos', ctxCom(TODAS, { retornoHabilitado: false }))).toBe(true);
  });

  it('atualizações sem permissão não aparecem como "0" vindo do /painel: o bloco some', () => {
    const ctx = ctxCom(TODAS.filter((c) => c !== 'ATUALIZACAO_LER'));
    expect(blocosVisiveis(ctx)).not.toContain('atualizacoes');
  });
});

describe('ordem e escondidos (Editar)', () => {
  it('padrão: a ordem do protótipo e nenhum escondido', () => {
    expect(blocosVisiveis(ctxCom())).toEqual(['atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'financeiro', 'recebido', 'alunos']);
  });

  it('preferência reordena e esconde; bloco sem permissão não entra nem na lista do Editar', () => {
    const pref: PainelDoInicioPreferido = { ordem: ['alunos', 'agenda', ...BLOCOS_DO_PAINEL.filter((b) => b !== 'alunos' && b !== 'agenda')], escondidos: ['agenda'], meus: {} };
    const ctx = ctxCom(TODAS.filter((c) => c !== 'INSCRICAO_LER'));
    expect(blocosVisiveis(ctx, pref)).toEqual(['alunos', 'atualizacoes', 'treinos', 'pastas', 'financeiro', 'recebido']);
    expect(blocosPermitidos(ctx, pref)).toEqual(['alunos', 'agenda', 'atualizacoes', 'treinos', 'pastas', 'financeiro', 'recebido']);
    const lista = blocosParaEditar(ctx, pref);
    expect(lista.map((b) => b.id)).not.toContain('interessados');
    expect(lista.find((b) => b.id === 'agenda')?.ligado).toBe(false);
    expect(lista[0]).toMatchObject({ id: 'alunos', posicao: 1, total: 7, podeSubir: false, podeDescer: true });
    expect(lista[6]).toMatchObject({ posicao: 7, podeSubir: true, podeDescer: false });
  });

  it('tudo escondido: nenhum bloco visível', () => {
    expect(blocosVisiveis(ctxCom(), { ordem: [...BLOCOS_DO_PAINEL], escondidos: [...BLOCOS_DO_PAINEL], meus: {} })).toEqual([]);
  });

  it('ligar, desligar e mover no Editar não perdem o Todos/Meus gravado de cada bloco', () => {
    const pref = { ...PAINEL_DO_INICIO_PADRAO, meus: { agenda: true } };
    expect(alternarBloco(pref, 'treinos').meus).toEqual({ agenda: true });
    expect(moverBloco(pref, 'agenda', -1, BLOCOS_DO_PAINEL).meus).toEqual({ agenda: true });
    expect(PAINEL_DO_INICIO_PADRAO.meus).toEqual({});
  });

  it('alternarBloco liga e desliga sem mexer na ordem nem no original', () => {
    const a = alternarBloco(PAINEL_DO_INICIO_PADRAO, 'agenda');
    expect(a.escondidos).toEqual(['agenda']);
    expect(a.ordem).toEqual([...BLOCOS_DO_PAINEL]);
    expect(alternarBloco(a, 'agenda').escondidos).toEqual([]);
    expect(PAINEL_DO_INICIO_PADRAO.escondidos).toEqual([]);
  });

  it('moverBloco troca com o vizinho permitido e deixa os não permitidos no lugar', () => {
    const permitidos = BLOCOS_DO_PAINEL.filter((b) => b !== 'interessados');
    // Descer "atualizacoes" passa por cima de "interessados" (não permitido) e cai depois de "treinos".
    const r = moverBloco(PAINEL_DO_INICIO_PADRAO, 'atualizacoes', 1, permitidos);
    expect(r.ordem).toEqual(['treinos', 'interessados', 'atualizacoes', 'pastas', 'agenda', 'financeiro', 'recebido', 'alunos']);
    expect(moverBloco(PAINEL_DO_INICIO_PADRAO, 'atualizacoes', -1, permitidos)).toBe(PAINEL_DO_INICIO_PADRAO);
    expect(moverBloco(PAINEL_DO_INICIO_PADRAO, 'alunos', 1, permitidos)).toBe(PAINEL_DO_INICIO_PADRAO);
  });
});

describe('fonteDaConsulta', () => {
  it('dados viram pronta; 503 RETORNO_INDISPONIVEL vira desligada; outro erro vira falhou', () => {
    expect(fonteDaConsulta({ dados: { a: 1 } })).toEqual(fontePronta({ a: 1 }));
    expect(fonteDaConsulta({ erro: new ErroApi(503, 'RETORNO_INDISPONIVEL', 'x') })).toEqual(FONTE_DESLIGADA);
    expect(fonteDaConsulta({ erro: new ErroApi(500, 'ERRO', 'x') })).toEqual(FONTE_FALHOU);
    expect(fonteDaConsulta({ erro: new Error('rede') })).toEqual(FONTE_FALHOU);
  });

  it('sem dados: carregando enquanto carrega, falhou se a consulta veio nula', () => {
    expect(fonteDaConsulta({ dados: undefined, carregando: true })).toEqual(FONTE_CARREGANDO);
    expect(fonteDaConsulta({ dados: null, carregando: false })).toEqual(FONTE_FALHOU);
    expect(fonteDaConsulta({ dados: undefined, carregando: false })).toEqual(FONTE_FALHOU);
  });
});

describe('Atualizações', () => {
  it('cartões, cores, números e destinos com meus=true quando o bloco está em Meus', () => {
    const b = bloco('atualizacoes');
    expect(b.cartoes.map((c) => c.texto)).toEqual(['3', '2']);
    expect(cartaoDe(b, 'atualizacoes.paraRevisar').tom).toBe('atencao');
    expect(cartaoDe(b, 'atualizacoes.atrasadas').tom).toBe('perigo');
    expect(href(cartaoDe(b, 'atualizacoes.paraRevisar').destino)).toBe('/treinador/atualizacoes?situacao=PARA_REVISAR');
    expect(b.meus).toBe(false);
    expect(b.escopo).toBeNull();

    const m = bloco('atualizacoes', fontes(), ctxCom(), { meus: true });
    expect(href(cartaoDe(m, 'atualizacoes.atrasadas').destino)).toBe('/treinador/atualizacoes?situacao=ATRASADAS&meus=true');
    expect(href(m.linha?.destino ?? null)).toBe('/treinador/atualizacoes?situacao=PROXIMAS&meus=true');
    expect(m.abrir).toBe('/treinador/atualizacoes?meus=true');
    expect(m.escopo).toBe('Só os meus alunos');
  });

  it('a linha "Nos próximos 7 dias" é neutra, com número e sem cor de alerta', () => {
    const b = bloco('atualizacoes');
    expect(b.linha).toMatchObject({ rotulo: 'Nos próximos 7 dias', texto: '5', tom: 'neutro', estado: 'valor' });
    expect(b.linha?.falado).toBe('Atualizações nos próximos 7 dias: 5');
  });

  it('zero fica cinza, mas continua número', () => {
    const b = bloco('atualizacoes', fontes({ painel: fontePronta(painel({ atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 0 })) }));
    expect(cartaoDe(b, 'atualizacoes.atrasadas')).toMatchObject({ texto: '0', tom: 'neutro', estado: 'valor', valor: 0 });
    expect(cartaoDe(b, 'atualizacoes.paraRevisar').tom).toBe('neutro');
  });

  it('/painel falhou: todos os cartões "Não carregou" (nunca 0) e o bloco avisa que falhou', () => {
    const b = bloco('atualizacoes', fontes({ painel: FONTE_FALHOU }));
    for (const c of [...b.cartoes, b.linha!]) expect(c).toMatchObject({ estado: 'naoCarregou', texto: 'Não carregou', valor: null, tom: 'neutro' });
    expect(b.falhou).toBe(true);
    expect(cartaoDe(b, 'atualizacoes.atrasadas').falado).toBe('Atualizações atrasadas: não carregou');
  });

  it('campo nulo numa resposta ok também é "Não carregou", não 0', () => {
    const b = bloco('atualizacoes', fontes({ painel: fontePronta(painel({ atualizacoesAtrasadas: null as unknown as number })) }));
    expect(cartaoDe(b, 'atualizacoes.atrasadas').estado).toBe('naoCarregou');
    expect(cartaoDe(b, 'atualizacoes.paraRevisar').estado).toBe('valor');
    expect(b.falhou).toBe(false);
  });

  it('carregando: cartões em "…", sem tom de alerta', () => {
    const b = bloco('atualizacoes', fontes({ painel: FONTE_CARREGANDO }));
    expect(b.carregando).toBe(true);
    expect(b.cartoes[0]).toMatchObject({ estado: 'carregando', texto: '…', tom: 'neutro', valor: null });
  });
});

describe('Interessados', () => {
  it('Novos, Retornos e Em contato ou negociação, com os filtros certos e meus=true', () => {
    const b = bloco('interessados');
    expect(b.cartoes.map((c) => c.texto)).toEqual(['6', '3', '5']);
    expect(href(cartaoDe(b, 'interessados.novos').destino)).toBe('/treinador/interessados?situacao=NOVA');
    expect(href(cartaoDe(b, 'interessados.retornos').destino)).toBe('/treinador/interessados?retornos=ATE_HOJE');
    expect(href(cartaoDe(b, 'interessados.contato').destino)).toBe('/treinador/interessados?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO');
    expect(cartaoDe(b, 'interessados.contato').largo).toBe(true);

    const m = bloco('interessados', fontes(), ctxCom(), { meus: true });
    expect(href(cartaoDe(m, 'interessados.novos').destino)).toBe('/treinador/interessados?situacao=NOVA&meus=true');
    expect(href(cartaoDe(m, 'interessados.retornos').destino)).toBe('/treinador/interessados?retornos=ATE_HOJE&meus=true');
    expect(href(cartaoDe(m, 'interessados.contato').destino)).toBe('/treinador/interessados?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO&meus=true');
  });

  it('retornos: soma atrasados e de hoje, vermelho se houver atrasado, âmbar só de hoje; o leitor de tela diz a quebra', () => {
    const b = bloco('interessados');
    const r = cartaoDe(b, 'interessados.retornos');
    expect(r).toMatchObject({ texto: '3', tom: 'perigo' });
    expect(r.detalhe).toBe('1 atrasado · 2 para hoje');
    expect(r.falado).toContain('1 atrasado e 2 de hoje');
    const hoje = bloco('interessados', fontes({ interessados: fontePronta(contagens({ retornosAtrasados: 0, retornosHoje: 2 })) }));
    expect(cartaoDe(hoje, 'interessados.retornos').tom).toBe('atencao');
    const zero = bloco('interessados', fontes({ interessados: fontePronta(contagens({ retornosAtrasados: 0, retornosHoje: 0 })) }));
    expect(cartaoDe(zero, 'interessados.retornos')).toMatchObject({ texto: '0', tom: 'neutro' });
  });

  it('consulta falhou: "Não carregou" nos três; a soma nunca esconde um null', () => {
    const b = bloco('interessados', fontes({ interessados: FONTE_FALHOU }));
    expect(b.cartoes.every((c) => c.estado === 'naoCarregou')).toBe(true);
    const parcial = bloco('interessados', fontes({ interessados: fontePronta(contagens({ porSituacao: { NOVA: 1, EM_CONTATO: 2 } as never })) }));
    expect(cartaoDe(parcial, 'interessados.contato').estado).toBe('naoCarregou');
    expect(cartaoDe(parcial, 'interessados.novos').texto).toBe('1');
  });
});

describe('Treinos', () => {
  it('com o retorno ligado: Concluídos, Recordes e Sem registro (Últimos 7 dias)', () => {
    const b = bloco('treinos');
    expect(b.periodo).toBe('Últimos 7 dias');
    expect(b.cartoes.map((c) => c.chave)).toEqual(['treinos.concluidos', 'treinos.recordes', 'treinos.semRegistro']);
    expect(b.cartoes.map((c) => c.texto)).toEqual(['12', '2', '2']);
    expect(cartaoDe(b, 'treinos.concluidos')).toMatchObject({ tom: 'sucesso' });
    expect(cartaoDe(b, 'treinos.recordes')).toMatchObject({ tom: 'sucesso' });
    expect(cartaoDe(b, 'treinos.semRegistro')).toMatchObject({ tom: 'atencao', rotulo: 'Sem registro há 7 dias', largo: true });
    expect(cartaoDe(b, 'treinos.recordes').destino).toEqual({ tipo: 'folha', folha: 'recordes' });
    expect(cartaoDe(b, 'treinos.semRegistro').destino).toEqual({ tipo: 'folha', folha: 'semRegistro' });
    // Meus/Todos explícito: quem não tem acesso total abriria a lista nos seus sem o meus=false.
    expect(href(cartaoDe(b, 'treinos.concluidos').destino)).toBe('/treinador/alunos?meus=false');
    expect(cartaoDe(b, 'treinos.semRegistro').falado).toMatch(/Abre a lista$/);
  });

  it('o rótulo de "Sem registro" segue a preferência de dias', () => {
    expect(cartaoDe(bloco('treinos', fontes(), ctxCom(), { dias: 14 }), 'treinos.semRegistro').rotulo).toBe('Sem registro há 14 dias');
  });

  it('retornoHabilitado falso (chave do /eu): Concluídos e Recordes SOMEM, fica só Sem registro, com a nota', () => {
    const b = bloco('treinos', fontes(), ctxCom(TODAS, { retornoHabilitado: false }));
    expect(b.cartoes.map((c) => c.chave)).toEqual(['treinos.semRegistro']);
    expect(b.periodo).toBeNull();
    expect(b.nota).toMatch(/Concluir treino/);
    expect(cartaoDe(b, 'treinos.semRegistro').largo).toBe(false);
    expect(consultasDoBloco('treinos', ctxCom(TODAS, { retornoHabilitado: false }), opcoes()).map((c) => c.fonte)).toEqual(['painel']);
  });

  it('/recordes/semana com 503 (desligada): os cartões do retorno somem, não viram "Não carregou"', () => {
    const b = bloco('treinos', fontes({ recordes: FONTE_DESLIGADA }));
    expect(b.cartoes.map((c) => c.chave)).toEqual(['treinos.semRegistro']);
    expect(b.cartoes.some((c) => c.estado === 'naoCarregou')).toBe(false);
  });

  it('visível mas a consulta falhou: "Não carregou" (caso b), e zero de verdade fica cinza', () => {
    const b = bloco('treinos', fontes({ recordes: FONTE_FALHOU, painel: fontePronta(painel({ sessoesConcluidas7Dias: null, alunosSemRegistroTotal: 0 })) }));
    expect(cartaoDe(b, 'treinos.recordes')).toMatchObject({ estado: 'naoCarregou', texto: 'Não carregou' });
    expect(cartaoDe(b, 'treinos.concluidos')).toMatchObject({ estado: 'naoCarregou', valor: null });
    expect(cartaoDe(b, 'treinos.semRegistro')).toMatchObject({ estado: 'valor', texto: '0', tom: 'neutro' });
    expect(cartaoDe(b, 'treinos.recordes').destino).toBeNull();
  });
});

describe('Pastas', () => {
  it('A renovar em 7 dias (Folha) e Sem pasta com período (lista de alunos), com meus=true', () => {
    const b = bloco('pastas', fontes(), ctxCom(), { meus: true });
    expect(b.cartoes.map((c) => c.texto)).toEqual(['2', '4']);
    expect(cartaoDe(b, 'pastas.aRenovar')).toMatchObject({ tom: 'atencao', destino: { tipo: 'folha', folha: 'pastasARenovar' } });
    expect(cartaoDe(b, 'pastas.semPasta').tom).toBe('neutro');
    expect(href(cartaoDe(b, 'pastas.semPasta').destino)).toBe('/treinador/alunos?atualizacao=SEM_PASTA&meus=true');
  });

  it('sem ver atualizações, "Sem pasta com período" abre a lista sem o filtro (que daria 403)', () => {
    const b = bloco('pastas', fontes(), ctxCom(TODAS.filter((c) => c !== 'ATUALIZACAO_LER')), { meus: false });
    expect(href(cartaoDe(b, 'pastas.semPasta').destino)).toBe('/treinador/alunos?meus=false');
  });

  it('campo nulo (sem permissão de leitura na API) é "Não carregou", não 0', () => {
    const b = bloco('pastas', fontes({ painel: fontePronta(painel({ pastasARenovar: null, alunosSemPastaComPeriodo: null })) }));
    expect(b.cartoes.every((c) => c.estado === 'naoCarregou')).toBe(true);
    expect(cartaoDe(b, 'pastas.aRenovar').destino).toBeNull();
  });
});

describe('Agenda', () => {
  it('consulta é a semana (segunda a domingo) e "Meus" vira responsavel; "Todos" vai sem responsavel', () => {
    const semana = periodoDoCalendario('semana', HOJE);
    expect(semana).toEqual({ de: '2026-10-26', ate: '2026-11-01' });
    expect(consultaDaAgenda({ hoje: HOJE, meus: false, usuarioId: 'u1' })).toEqual({ fonte: 'agenda', ...semana, responsavel: null });
    expect(consultaDaAgenda({ hoje: HOJE, meus: true, usuarioId: 'u1' })).toEqual({ fonte: 'agenda', ...semana, responsavel: 'u1' });
    expect(consultaDaAgenda({ hoje: HOJE, meus: true, usuarioId: null })).toBeNull();
  });

  it('soma os compromissos da semana; resposta vazia é zero em cinza', () => {
    expect(compromissosDaSemana({ dias: [{ data: 'a', compromissos: 2, eventos: 4 }, { data: 'b', compromissos: 3, eventos: 0 }] })).toBe(5);
    const b = bloco('agenda');
    expect(cartaoDe(b, 'agenda.semana')).toMatchObject({ texto: '5', tom: 'neutro', estado: 'valor', largo: true });
    expect(href(cartaoDe(b, 'agenda.semana').destino)).toBe('/treinador/agenda?visao=semana');
    const vazio = bloco('agenda', fontes({ agenda: fontePronta({ dias: [] }) }));
    expect(cartaoDe(vazio, 'agenda.semana')).toMatchObject({ texto: '0', estado: 'valor' });
  });

  it('em Meus o destino leva meus=true, a consulta leva responsavel e a chave difere da de Todos', () => {
    const m = bloco('agenda', fontes(), ctxCom(), { meus: true });
    expect(href(cartaoDe(m, 'agenda.semana').destino)).toBe('/treinador/agenda?visao=semana&meus=true');
    const [cm] = consultasDoBloco('agenda', ctxCom(), opcoes({ meus: true }));
    const [ct] = consultasDoBloco('agenda', ctxCom(), opcoes({ meus: false }));
    expect(chaveDaConsulta(cm)).not.toBe(chaveDaConsulta(ct));
  });

  it('Meus sem id do usuário: "Não carregou" em vez de contar a equipe toda', () => {
    const b = bloco('agenda', fontes(), ctxCom(), { meus: true, usuarioId: null });
    expect(cartaoDe(b, 'agenda.semana').estado).toBe('naoCarregou');
  });

  it('consulta falhou: "Não carregou"', () => {
    expect(cartaoDe(bloco('agenda', fontes({ agenda: FONTE_FALHOU })), 'agenda.semana').estado).toBe('naoCarregou');
  });
});

describe('Financeiro', () => {
  it('Vencidas, Vencendo em 7 dias e Recebido no mês: cores, texto sem centavos e valor completo para o leitor de tela', () => {
    const b = bloco('financeiro');
    const v = cartaoDe(b, 'financeiro.vencidas');
    expect(v).toMatchObject({ texto: 'R$ 451', tom: 'perigo', moeda: true, detalhe: '3 cobranças', estado: 'valor' });
    expect(v.falado).toContain('R$ 450,50');
    expect(v.falado).toContain('3 cobranças');
    const c = cartaoDe(b, 'financeiro.vencendo');
    expect(c).toMatchObject({ texto: 'R$ 1.241', tom: 'atencao', detalhe: '4 cobranças' });
    expect(c.falado).toContain('R$ 1.240,60');
    expect(cartaoDe(b, 'financeiro.recebido')).toMatchObject({ texto: 'R$ 3.500', tom: 'sucesso', largo: true, rotulo: 'Recebido no mês (bruto)' });
  });

  it('Recebido no mês vem do resultadoDoMes, nunca do cartão do período de 6 meses', () => {
    const b = bloco('financeiro');
    expect(cartaoDe(b, 'financeiro.recebido').valor).toBe(350000);
    expect(JSON.stringify(b)).not.toContain('99.999');
  });

  it('destinos: Vencidas, Vencendo e Recebido; meus=true em Meus', () => {
    const t = bloco('financeiro');
    expect(href(cartaoDe(t, 'financeiro.vencidas').destino)).toBe('/treinador/financeiro?aba=cobrancas&situacao=VENCIDA');
    expect(href(cartaoDe(t, 'financeiro.vencendo').destino)).toBe('/treinador/financeiro?aba=cobrancas&situacao=ABERTA&vencimento=PROXIMOS_7_DIAS');
    const m = bloco('financeiro', fontes(), ctxCom(), { meus: true });
    expect(href(cartaoDe(m, 'financeiro.vencidas').destino)).toBe('/treinador/financeiro?aba=cobrancas&situacao=VENCIDA&meus=true');
    expect(href(cartaoDe(m, 'financeiro.vencendo').destino)).toBe('/treinador/financeiro?aba=cobrancas&situacao=ABERTA&vencimento=PROXIMOS_7_DIAS&meus=true');
    expect(href(cartaoDe(m, 'financeiro.recebido').destino)).toContain('meus=true');
  });

  it('soma vazia (valor nulo com 0 cobranças) é zero em cinza, não "Não carregou"', () => {
    const b = bloco('financeiro', fontes({
      inadimplentes: fontePronta(inadimplentes({ total: 0, valorTotalCentavos: null })),
      financeiro: fontePronta(financeiro({ proximosRecebimentos: { fonte: 'ABERTAS', em7Dias: { valorCentavos: null, cobrancas: 0 }, em30Dias: { valorCentavos: null, cobrancas: 0 } } })),
    }));
    expect(cartaoDe(b, 'financeiro.vencidas')).toMatchObject({ estado: 'valor', texto: 'R$ 0', tom: 'neutro', detalhe: null });
    expect(cartaoDe(b, 'financeiro.vencendo')).toMatchObject({ estado: 'valor', texto: 'R$ 0', tom: 'neutro' });
  });

  it('há cobranças mas o valor veio nulo: "Não carregou", nunca R$ 0', () => {
    const b = bloco('financeiro', fontes({ inadimplentes: fontePronta(inadimplentes({ total: 2, valorTotalCentavos: null })) }));
    expect(cartaoDe(b, 'financeiro.vencidas')).toMatchObject({ estado: 'naoCarregou', valor: null });
  });

  it('nada recebido no mês (soma nula): "—", não R$ 0', () => {
    const b = bloco('financeiro', fontes({ financeiro: fontePronta(financeiro({ resultadoDoMes: { rotulo: 'out/2026', mes: '2026-10', recebidoCentavos: null } })) }));
    expect(cartaoDe(b, 'financeiro.recebido')).toMatchObject({ estado: 'semDado', texto: '—', valor: null, tom: 'neutro' });
  });

  it('recebido igual a zero de verdade fica cinza', () => {
    const b = bloco('financeiro', fontes({ financeiro: fontePronta(financeiro({ resultadoDoMes: { rotulo: 'out/2026', mes: '2026-10', recebidoCentavos: 0 } })) }));
    expect(cartaoDe(b, 'financeiro.recebido')).toMatchObject({ estado: 'valor', texto: 'R$ 0', tom: 'neutro' });
  });

  it('consultas falharam: Vencidas e Vencendo "Não carregou" (caso b)', () => {
    const b = bloco('financeiro', fontes({ inadimplentes: FONTE_FALHOU, financeiro: FONTE_FALHOU }));
    expect(b.cartoes.every((c) => c.estado === 'naoCarregou')).toBe(true);
    expect(b.falhou).toBe(true);
  });

  it('sem ALUNO_LER o cartão Vencidas some (a API pede a permissão), os outros ficam', () => {
    const ctx = ctxCom(TODAS.filter((c) => c !== 'ALUNO_LER'));
    const b = bloco('financeiro', fontes(), ctx);
    expect(b.cartoes.map((c) => c.chave)).toEqual(['financeiro.vencendo', 'financeiro.recebido']);
    expect(consultasDoBloco('financeiro', ctx, opcoes()).map((c) => c.fonte)).toEqual(['financeiro']);
  });

  it('consultas: Financeiro e Recebido compartilham a mesma chamada de 6 meses', () => {
    const f = consultasDoBloco('financeiro', ctxCom(), opcoes())[0];
    const r = consultasDoBloco('recebido', ctxCom(), opcoes())[0];
    expect(chaveDaConsulta(f)).toBe(chaveDaConsulta(r));
    expect(f).toMatchObject({ fonte: 'financeiro', ...periodoDoFinanceiroNoPainel(HOJE) });
    expect(periodoDoFinanceiroNoPainel(HOJE).ate >= HOJE.slice(0, 7)).toBe(true);
  });
});

describe('reaisSemCentavos', () => {
  it('arredonda, separa milhar com ponto e trata zero e negativo', () => {
    expect(reaisSemCentavos(0)).toBe('R$ 0');
    expect(reaisSemCentavos(124060)).toBe('R$ 1.241');
    expect(reaisSemCentavos(99)).toBe('R$ 1');
    expect(reaisSemCentavos(49)).toBe('R$ 0');
    expect(reaisSemCentavos(123456789)).toBe('R$ 1.234.568');
    expect(reaisSemCentavos(-250000)).toBe('-R$ 2.500');
  });
});

describe('Recebido e lançamentos (barras)', () => {
  it('uma barra por mês, rótulos de mês, parcial marcado e mês sem dado como "—"', () => {
    const b = bloco('recebido');
    const g = b.grafico;
    if (!g || g.tipo !== 'barras') throw new Error('esperava barras');
    expect(g.desenhar).toBe(true);
    expect(g.meses.map((m) => m.rotulo)).toEqual(['set/2026', 'out/2026']);
    expect(g.meses[0]).toMatchObject({ recebido: 500000, lancamentos: 20000, recebidoTexto: 'R$ 5.000', parcial: false });
    expect(g.meses[1]).toMatchObject({ recebido: null, lancamentos: null, recebidoTexto: '—', parcial: true });
    expect(g.maximo).toBe(500000);
    expect(g.semDados).toBe(false);
    expect(g.notas.join(' ')).toContain('em andamento');
    expect(g.descricao).toContain('set/2026: recebido R$ 5.000,00');
    expect(g.descricao).toContain('out/2026: recebido sem dado');
  });

  it('com Meus avisa que os lançamentos avulsos ficam de fora', () => {
    const g = barrasDoRecebido(financeiro().serie, true, true);
    expect(g.notas.join(' ')).toMatch(/Meus/);
    expect(barrasDoRecebido(financeiro().serie, false, true).notas.join(' ')).not.toMatch(/Meus/);
  });

  it('gráficos desligados (preferência): os dados vêm, sem desenho', () => {
    const b = bloco('recebido', fontes(), ctxCom(), { graficos: false });
    expect(b.grafico).toMatchObject({ tipo: 'barras', desenhar: false });
    if (b.grafico?.tipo === 'barras') expect(b.grafico.meses).toHaveLength(2);
  });

  it('todos os meses sem valor: semDados; /financeiro/painel falhou: bloco falhou, carregando: carregando', () => {
    const vazio = barrasDoRecebido([{ mes: '2026-10', parcial: true, recebidoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null }] as never, false, true);
    expect(vazio).toMatchObject({ semDados: true, maximo: 0 });
    expect(bloco('recebido', fontes({ financeiro: FONTE_FALHOU })).falhou).toBe(true);
    expect(bloco('recebido', fontes({ financeiro: FONTE_FALHOU })).grafico).toBeNull();
    expect(bloco('recebido', fontes({ financeiro: FONTE_CARREGANDO })).carregando).toBe(true);
  });
});

describe('Alunos (rosca)', () => {
  it('ativos com acesso, ativos sem acesso e inativos; nenhum aluno conta duas vezes', () => {
    const g = roscaDosAlunos({ alunosAtivos: 10, alunosInativos: 4, alunosSemAcesso: 3 }, true);
    expect(g.total).toBe(14);
    expect(g.fatias.map((f) => [f.chave, f.valor, f.cor])).toEqual([['comAcesso', 7, 'sucesso'], ['semAcesso', 3, 'atencao'], ['inativos', 4, 'neutro']]);
    expect(g.fatias.reduce((s, f) => s + f.fracao, 0)).toBeCloseTo(1);
    expect(g.fatias[1].inicio).toBeCloseTo(0.5);
    expect(g.vazia).toBe(false);
    expect(g.descricao).toContain('Ativos com acesso, 7');
    expect(g.resumo).toBe('10 ativos, 3 sem acesso ao app · 4 inativos');
  });

  it('cada fatia abre a lista de alunos filtrada, com o Meus/Todos do bloco', () => {
    expect(roscaDosAlunos({ alunosAtivos: 1, alunosInativos: 1, alunosSemAcesso: 0 }, true).fatias.map((f) => f.href)).toEqual([
      '/treinador/alunos?acesso=COM&meus=false', '/treinador/alunos?acesso=SEM&meus=false', '/treinador/alunos?situacao=INATIVO&meus=false',
    ]);
    expect(roscaDosAlunos({ alunosAtivos: 1, alunosInativos: 1, alunosSemAcesso: 0 }, true, true).fatias[1].href).toBe('/treinador/alunos?acesso=SEM&meus=true');
  });

  it('sem acesso nunca passa dos ativos; sem alunos é vazia', () => {
    expect(roscaDosAlunos({ alunosAtivos: 2, alunosInativos: 0, alunosSemAcesso: 5 }, true).fatias.map((f) => f.valor)).toEqual([0, 2, 0]);
    const v = roscaDosAlunos({ alunosAtivos: 0, alunosInativos: 0, alunosSemAcesso: 0 }, true);
    expect(v).toMatchObject({ vazia: true, total: 0 });
    expect(v.fatias.every((f) => f.fracao === 0)).toBe(true);
  });

  it('gráficos desligados: os números continuam, sem desenhar', () => {
    const b = bloco('alunos', fontes(), ctxCom(), { graficos: false });
    expect(b.grafico).toMatchObject({ tipo: 'rosca', desenhar: false, total: 14 });
  });

  it('só falha se o /painel falhar (os campos nunca são nulos)', () => {
    expect(bloco('alunos', fontes({ painel: FONTE_FALHOU })).falhou).toBe(true);
    expect(bloco('alunos', fontes({ painel: FONTE_FALHOU })).grafico).toBeNull();
    expect(bloco('alunos', fontes({ painel: FONTE_CARREGANDO })).carregando).toBe(true);
    expect(bloco('alunos').falhou).toBe(false);
  });

  it('resposta sem as contagens (campo faltando) não vira rosca com NaN: o bloco falha', () => {
    const incompleto = fontePronta({ atualizacoesParaRevisar: 0 } as unknown as PainelTreinador);
    const b = bloco('alunos', fontes({ painel: incompleto }));
    expect(b.falhou).toBe(true);
    expect(b.grafico).toBeNull();
  });
});

describe('faixa de cada bloco (Todos/Meus e abrir)', () => {
  it('todos os blocos têm o filtro Todos/Meus; o rótulo do leitor de tela diz o estado e a ação', () => {
    for (const id of BLOCOS_DO_PAINEL) {
      const t = bloco(id);
      const m = bloco(id, fontes(), ctxCom(), { meus: true });
      expect(t.temFiltro && m.temFiltro).toBe(true);
      expect(t.rotuloDoFiltro).toContain('Mostrar só os meus');
      expect(m.rotuloDoFiltro).toContain('Mostrar todos');
      expect(m.escopo).toBe('Só os meus alunos');
    }
  });

  it('endereços de "abrir a tela"', () => {
    expect(enderecoDoBloco('interessados', true)).toBe('/treinador/interessados?meus=true');
    expect(enderecoDoBloco('agenda', false)).toBe('/treinador/agenda?visao=semana');
    expect(enderecoDoBloco('financeiro', true)).toBe('/treinador/financeiro?meus=true');
    expect(enderecoDoBloco('treinos', false)).toBe('/treinador/alunos?meus=false');
    expect(enderecoDoBloco('alunos', true)).toBe('/treinador/alunos?meus=true');
    expect(enderecoDoBloco('recebido', false)).toBe('/treinador/financeiro?aba=visao');
    expect(enderecoDoBloco('recebido', true)).toBe('/treinador/financeiro?aba=visao&meus=true');
  });

  it('consultas do /painel são compartilhadas entre os blocos que usam o mesmo escopo e dias', () => {
    const chaves = (['atualizacoes', 'pastas', 'alunos', 'treinos'] as const).map((id) => chaveDaConsulta(consultasDoBloco(id, ctxCom(), opcoes())[0]));
    expect(new Set(chaves).size).toBe(1);
    expect(chaveDaConsulta(consultasDoBloco('alunos', ctxCom(), opcoes({ dias: 14 }))[0])).not.toBe(chaves[0]);
  });
});

describe('Folhas', () => {
  const muitos = Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, nome: `Aluno ${i}`, ultimoRegistro: '2026-10-01' }));

  it('Sem registro: "Mostrando 20 de 34 alunos." e ficha de cada aluno', () => {
    const f = folhaSemRegistro({ alunosSemRegistro: muitos, alunosSemRegistroTotal: 34 }, { dias: 7, meus: false, hoje: HOJE })!;
    expect(f.resumo).toBe('Mostrando 20 de 34 alunos.');
    expect(f.itens).toHaveLength(20);
    expect(f.itens[0]).toMatchObject({ href: '/treinador/alunos/a0', direita: '30 dias', descricao: 'Último registro em 01/10' });
    expect(f.titulo).toBe('Sem registro há 7 dias');
    expect(f.escopo).toBeNull();
  });

  it('lista completa: só o total; nunca registrou; Meus mostra o escopo; vazia traz a frase', () => {
    const f = folhaSemRegistro(painel(), { dias: 14, meus: true, hoje: HOJE })!;
    expect(f.resumo).toBe('2 alunos.');
    expect(f.escopo).toBe('Só os meus alunos');
    expect(f.itens[1]).toMatchObject({ descricao: 'Nunca registrou', direita: null });
    const vazia = folhaSemRegistro({ alunosSemRegistro: [], alunosSemRegistroTotal: 0 }, { dias: 7, meus: false, hoje: HOJE })!;
    expect(vazia).toMatchObject({ resumo: null, vazio: 'Nenhum aluno sem registro há 7 dias.' });
  });

  it('total nulo: sem Folha (o cartão está "Não carregou")', () => {
    expect(folhaSemRegistro({ alunosSemRegistro: [], alunosSemRegistroTotal: null }, { dias: 7, meus: false, hoje: HOJE })).toBeNull();
    expect(folhaPastasARenovar({ pastasParaRenovar: [], pastasARenovar: null }, { meus: false, hoje: HOJE })).toBeNull();
  });

  it('Pastas a renovar: aluno, pasta e fim; "Mostrando" quando passa do teto; singular', () => {
    const f = folhaPastasARenovar(painel(), { meus: false, hoje: HOJE })!;
    expect(f.itens[0]).toMatchObject({ nome: 'Aluno Um', descricao: 'Hipertrofia · termina em 03/11', href: '/treinador/alunos/a1' });
    expect(f.resumo).toBe('Mostrando 1 de 2 pastas.');
    const muitas = painel({ pastasARenovar: 25, pastasParaRenovar: Array.from({ length: 20 }, (_, i) => ({ pasta: { id: `p${i}`, titulo: 'T' }, aluno: { id: `a${i}`, nome: 'N' }, fim: '2026-11-02' })) });
    expect(folhaPastasARenovar(muitas, { meus: false, hoje: HOJE })!.resumo).toBe('Mostrando 20 de 25 pastas.');
    expect(folhaPastasARenovar(painel({ pastasARenovar: 1 }), { meus: false, hoje: HOJE })!.resumo).toBe('1 pasta.');
  });

  it('Recordes: lista as séries com o recorde batido; o total vem da API', () => {
    const f = folhaRecordes(recordes(2), { meus: true, hoje: HOJE })!;
    expect(f.itens[0]).toMatchObject({ nome: 'Aluno Um', descricao: 'Supino', detalhes: ['Maior carga · 70 kg'], href: '/treinador/alunos/a1' });
    expect(f.resumo).toBe('Mostrando 1 de 2 séries com recorde.');
    expect(f.escopo).toBe('Só os meus alunos');
    expect(folhaRecordes({ total: 0, series: [] }, { meus: false, hoje: HOJE }).vazio).toBe('Nenhum recorde nos últimos 7 dias.');
  });

  it('resumoDaFolha: total nunca abaixo do mostrado e milhar com ponto', () => {
    expect(resumoDaFolha(1, 1, ['aluno', 'alunos'])).toBe('1 aluno.');
    expect(resumoDaFolha(3, 5, ['aluno', 'alunos'])).toBe('5 alunos.');
    expect(resumoDaFolha(1234, 20, ['aluno', 'alunos'])).toBe('Mostrando 20 de 1.234 alunos.');
  });
});

describe('cartões não vazam nomes de alunos', () => {
  it('só contagens nos blocos: nenhum nome fictício aparece nos cartões nem nos gráficos', () => {
    const todos = BLOCOS_DO_PAINEL.map((id) => bloco(id));
    const json = JSON.stringify(todos);
    for (const nome of ['Aluno Um', 'Aluno Dois', 'Supino', 'Hipertrofia']) expect(json).not.toContain(nome);
  });
});

describe('inicioSemAlunos', () => {
  it('sem alunos ativos nem inativos no painel de Todos', () => {
    expect(inicioSemAlunos({ alunosAtivos: 0, alunosInativos: 0 })).toBe(true);
  });

  it('com qualquer aluno, ativo ou inativo, não é "sem alunos"', () => {
    expect(inicioSemAlunos({ alunosAtivos: 1, alunosInativos: 0 })).toBe(false);
    expect(inicioSemAlunos({ alunosAtivos: 0, alunosInativos: 2 })).toBe(false);
  });

  it('/painel que falhou, carregando ou nulo nunca é "sem alunos"', () => {
    expect(inicioSemAlunos(null)).toBe(false);
    expect(inicioSemAlunos(undefined)).toBe(false);
  });
});
