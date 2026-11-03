import type { ConteudoDieta, ConteudoTreino, FatoresDoAlimento, ItemDieta, Refeicao } from '../api/tipos';
import { normalizarDieta } from './dieta';
import { exercicio, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { alimentosDaDieta } from './listaDeCompras';
import { configDoTreino } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { dietaDaPrevia, treinoDaPrevia, type PlanoNoEditor } from './previaDoAluno';

jest.mock('./uid', () => ({ novoUid: () => 'uid-novo' }));

/** Tudo fictício. */
const AGORA = new Date('2026-11-03T12:00:00.000Z');

const treinoBase = (extra: Partial<ConteudoTreino> = {}): ConteudoTreino => ({ objetivo: null, orientacoes: null, sessoes: [], ...extra });
const editor = <C>(conteudo: C, extra: Partial<PlanoNoEditor<C>> = {}): PlanoNoEditor<C> => ({
  plano: { id: 'plano-1', versaoPublicada: 2 },
  titulo: 'Treino de Fulana',
  inicio: '03/11/2026',
  fim: '30/11/2026',
  conteudo,
  ...extra,
});

describe('treinoDaPrevia', () => {
  it('monta o TreinoAtual do aluno com o que está na tela: título, período e conteúdo ainda não salvos', () => {
    const conteudo = treinoBase({
      objetivo: 'Hipertrofia (ainda não salvo)',
      sessoes: [sessao('a', [exercicio('e1', { nome: 'Supino', series: [serie('s1'), serie('s2')] })], [], { nome: 'Treino A', diaSemana: 1 })],
    });
    const t = treinoDaPrevia(editor(conteudo, { titulo: '  Novo título ainda sem salvar  ' }), AGORA);
    expect(t).toMatchObject({
      planoId: 'plano-1',
      versaoId: 'previa-plano-1',
      numero: 3, // a versão que a publicação criaria
      titulo: 'Novo título ainda sem salvar',
      inicio: '2026-11-03',
      fim: '2026-11-30',
      publicadoEm: '2026-11-03T12:00:00.000Z',
    });
    expect(t.conteudo.objetivo).toBe('Hipertrofia (ainda não salvo)');
    expect(t.conteudo.sessoes[0].exercicios[0].series.map((s) => s.uid)).toEqual(['s1', 's2']);
  });

  it('nunca publicado: a versão da prévia é a 1', () => {
    expect(treinoDaPrevia(editor(treinoBase(), { plano: { id: 'p', versaoPublicada: 0 } }), AGORA).numero).toBe(1);
  });

  it('data em branco ou inválida na caixa vira nula (não inventa período) e título vazio cai no padrão', () => {
    const t = treinoDaPrevia(editor(treinoBase(), { inicio: '', fim: '31/02/2026', titulo: '   ' }), AGORA);
    expect(t).toMatchObject({ inicio: null, fim: null, titulo: 'Treino' });
  });

  it('divisão sem exercício continua na lista (descanso ou rascunho vazio) e não quebra', () => {
    const t = treinoDaPrevia(editor(treinoBase({ sessoes: [sessao('vazia'), sessao('descanso', [], [], { tipo: 'DESCANSO' })] })), AGORA);
    expect(t.conteudo.sessoes.map((s) => [s.uid, s.exercicios.length])).toEqual([['vazia', 0], ['descanso', 0]]);
  });

  it('conteúdo parcial do editor sai normalizado (listas e campos que as telas do aluno esperam)', () => {
    const parcial = { sessoes: [{ uid: 'x', nome: 'A', exercicios: [{ uid: 'e', nome: 'Remada', series: [{ uid: 's' }] }] }] } as unknown as ConteudoTreino;
    const [s] = treinoDaPrevia(editor(parcial), AGORA).conteudo.sessoes;
    expect(s).toMatchObject({ diaSemana: null, cardio: null, observacao: null, grupos: [] });
    expect(s.exercicios[0]).toMatchObject({ unidade: 'kg', progressao: true, grupoUid: null });
  });

  it('não muda o que o editor tem', () => {
    const conteudo = treinoBase({ sessoes: [sessao('a', [exercicio('e')])] });
    const antes = JSON.stringify(conteudo);
    treinoDaPrevia(editor(conteudo), AGORA);
    expect(JSON.stringify(conteudo)).toBe(antes);
  });
});

describe('configDoTreino (o que a execução do aluno lê da metodologia da versão)', () => {
  it('usa a metodologia copiada no treino; sem ela, a padrão e a reserva do pacote', () => {
    expect(configDoTreino(treinoBase(), { arredondamentoKg: 0.5, tipoTrabalho: 'WS' }).metodologia).toBe(CONFIGURACAO_PADRAO);
    const propria = { ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => (t.papel === 'TRABALHO' ? { ...t, nome: 'Série válida' } : t)) };
    const config = configDoTreino(treinoBase({ metodologia: { id: 'm', nome: 'Minha', configuracao: propria } }), { arredondamentoKg: 2, tipoTrabalho: 'WS' });
    expect(config).toMatchObject({ arredondamentoKg: 2, tipoTrabalho: 'Série válida' });
    expect(config.metodologia).toBe(propria);
  });
});

const item = (nome: string, extra: Partial<ItemDieta> = {}): ItemDieta => ({
  uid: `i-${nome}`,
  alimentoId: null,
  nome,
  quantidade: 100,
  unidade: 'g',
  kcal: 100,
  proteina: null,
  carboidrato: null,
  gordura: null,
  manual: true,
  ...extra,
});
const refeicao = (uid: string, itens: ItemDieta[]): Refeicao => ({ uid, nome: uid, horario: null, observacao: null, modoDePreparo: null, opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens }] });
const dietaBase = (extra: Partial<ConteudoDieta> = {}): ConteudoDieta => ({ ...normalizarDieta(null), ...extra });
const fator = (alimentoId: string, extra: Partial<FatoresDoAlimento> = {}): FatoresDoAlimento => ({ alimentoId, fatorCorrecao: null, fatorCoccao: null, grupo: null, ...extra });

describe('dietaDaPrevia', () => {
  it('copia fatores e grupo da biblioteca para os itens, como a publicação (D7), e ignora o que o rascunho trazia', () => {
    const arroz = item('Arroz', { alimentoId: 'arroz', manual: false, fatorCoccao: 9, grupo: 'velho' }); // lixo do rascunho
    const conteudo = dietaBase({ refeicoes: [refeicao('almoco', [arroz, item('Receita da casa')])] });
    const d = dietaDaPrevia(editor(conteudo, { titulo: 'Dieta de Fulana' }), [fator('arroz', { fatorCoccao: 2.5, fatorCorrecao: 1, grupo: 'Cereais' })], AGORA);
    const [comAlimento, manual] = d.conteudo.refeicoes[0].opcoes[0].itens;
    expect(comAlimento).toMatchObject({ fatorCoccao: 2.5, fatorCorrecao: 1, grupo: 'Cereais' });
    expect(manual).toMatchObject({ fatorCoccao: null, fatorCorrecao: null, grupo: null });
    expect(d).toMatchObject({ id: 'previa-plano-1', planoId: 'plano-1', numero: 3, titulo: 'Dieta de Fulana', inicio: '2026-11-03', fim: '2026-11-30' });
  });

  it('alimento que a biblioteca não achou (inativado fora, de outra consultoria) fica sem fator e sem grupo', () => {
    const conteudo = dietaBase({ refeicoes: [refeicao('r', [item('Fantasma', { alimentoId: 'sumiu', manual: false, fatorCorrecao: 3 })])] });
    const [i] = dietaDaPrevia(editor(conteudo), [], AGORA).conteudo.refeicoes[0].opcoes[0].itens;
    expect(i).toMatchObject({ fatorCorrecao: null, fatorCoccao: null, grupo: null });
  });

  it('os ids que a Folha busca em GET /alimentos/fatores são os da dieta na tela, de todas as opções', () => {
    const r = refeicao('r', [item('A', { alimentoId: 'a', manual: false })]);
    r.opcoes.push({ uid: 'b', rotulo: 'B', itens: [item('B', { alimentoId: 'b', manual: false }), item('A2', { alimentoId: 'a', manual: false })] });
    expect(alimentosDaDieta(dietaBase({ refeicoes: [r] })).sort()).toEqual(['a', 'b']);
  });

  it('refeição sem opção e opção sem item aparecem como o aluno veria (vazias), sem quebrar', () => {
    const semOpcao: Refeicao = { ...refeicao('r1', []), opcoes: [] };
    const d = dietaDaPrevia(editor(dietaBase({ refeicoes: [semOpcao, refeicao('r2', [])] })), [], AGORA);
    expect(d.conteudo.refeicoes.map((r) => [r.uid, r.opcoes.map((o) => o.itens.length)])).toEqual([['r1', []], ['r2', [0]]]);
  });

  it('suplementação, água, orientações e ergogênicos acompanham o rascunho; ergogênicos nulos (sem permissão) seguem nulos', () => {
    const conteudo = dietaBase({
      aguaLitros: 3,
      orientacoes: [{ titulo: 'Sono', texto: 'Dormir cedo' }],
      suplementacao: [{ uid: 'sup', nome: 'Creatina', dose: '5 g', horario: 'manhã', observacao: '', link: null }],
    });
    const d = dietaDaPrevia(editor(conteudo), [], AGORA).conteudo;
    expect(d.suplementacao).toEqual([{ uid: 'sup', nome: 'Creatina', dose: '5 g', horario: 'manhã', observacao: '', link: null }]);
    expect(d.aguaLitros).toBe(3);
    expect(d.orientacoes).toEqual([{ titulo: 'Sono', texto: 'Dormir cedo' }]);
    expect(d.ergogenicos).toBeNull();
    expect(dietaDaPrevia(editor({ ...conteudo, ergogenicos: [{ uid: 'e', nome: 'X', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '' }] }), [], AGORA).conteudo.ergogenicos).toHaveLength(1);
  });

  it('mudança não salva vale: o texto da tela é o que sai, e o conteúdo recebido não é alterado', () => {
    const conteudo = dietaBase({ objetivo: 'Mudou agora', refeicoes: [refeicao('r', [item('Ovo', { alimentoId: 'ovo', manual: false })])] });
    const antes = JSON.stringify(conteudo);
    const d = dietaDaPrevia(editor(conteudo), [fator('ovo', { grupo: 'Carnes e ovos' })], AGORA);
    expect(d.conteudo.objetivo).toBe('Mudou agora');
    expect(JSON.stringify(conteudo)).toBe(antes);
  });
});
