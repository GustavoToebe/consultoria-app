import type { ConteudoDieta, ConteudoQuestionario, ConteudoTreino, ItemDieta, PerguntaAtualizacao, Refeicao } from '../api/tipos';
import { type EntradaDosItens, fontesDoQuestionario, itensDaFonte, itensDoQuestionario, rotuloDoDia } from './itensDoPlano';
import { errosRespostasAtualizacao, respostaDeItens, respostasParaEnviar } from './respostasAtualizacao';

const item = (uid: string, nome: string) => ({ uid, nome }) as ItemDieta;
const refeicao = (uid: string, ...opcoes: ItemDieta[][]): Refeicao =>
  ({ uid, nome: uid, horario: null, observacao: null, opcoes: opcoes.map((itens, k) => ({ uid: `${uid}-o${k}`, rotulo: `Opção ${k + 1}`, itens })) });
const dieta = (parcial: Partial<ConteudoDieta>) => ({ refeicoes: [], variacoes: [], ...parcial }) as ConteudoDieta;
const exercicio = (uid: string, nome: string) => ({ uid, nome, alternativas: [{ exercicioId: 'x', nome: 'Alternativa', videoUrl: null }] });
const treino = (inicio: string | null, ...sessoes: { uid: string; nome: string; exercicios?: ReturnType<typeof exercicio>[] }[]) =>
  ({ inicio, conteudo: { sessoes: sessoes.map((s) => ({ exercicios: [], ...s })) } as unknown as ConteudoTreino });

const entrada = (parcial: Partial<EntradaDosItens>): EntradaDosItens => ({ treino: null, dieta: null, registros: [], dataDaAtualizacao: '2026-11-25', ...parcial });
const serie = (data: string, sessaoUid: string, concluida = true) => ({ data, sessaoUid, concluida });

describe('itensDoPlano: alimentos da dieta', () => {
  it('um item por nome (o primeiro na ordem), de todas as opções e das variações', () => {
    const c = dieta({
      variacoes: [
        { uid: 'v1', rotulo: 'Treino', dias: [1, 3], refeicoes: [refeicao('r1', [item('a1', 'Frango grelhado'), item('a2', 'Arroz')], [item('a3', 'Ovo')])] },
        { uid: 'v2', rotulo: 'Descanso', dias: [2], refeicoes: [refeicao('r2', [item('a4', '  frango   GRELHADO '), item('a5', 'Batata-doce')])] },
      ],
    });
    expect(itensDaFonte('ALIMENTOS_DA_DIETA', entrada({ dieta: { inicio: null, conteudo: c } }))).toEqual([
      { id: 'a1', nome: 'Frango grelhado' }, { id: 'a2', nome: 'Arroz' }, { id: 'a3', nome: 'Ovo' }, { id: 'a5', nome: 'Batata-doce' },
    ]);
  });

  it('usa as refeições da raiz quando não há variação e ignora item sem nome ou sem uid', () => {
    const c = dieta({ refeicoes: [refeicao('r1', [item('a1', 'Pão'), item('a2', '   '), item('', 'Sem uid'), item('a3', 'Pão')])] });
    expect(itensDaFonte('ALIMENTOS_DA_DIETA', entrada({ dieta: { inicio: null, conteudo: c } }))).toEqual([{ id: 'a1', nome: 'Pão' }]);
  });

  it('sem dieta, a lista é vazia', () => {
    expect(itensDaFonte('ALIMENTOS_DA_DIETA', entrada({}))).toEqual([]);
  });
});

describe('itensDoPlano: exercícios do treino', () => {
  it('só os principais (alternativa não entra) e um por nome', () => {
    const t = treino('2026-11-01',
      { uid: 's1', nome: 'Treino A', exercicios: [exercicio('e1', 'Supino reto'), exercicio('e2', 'Remada')] },
      { uid: 's2', nome: 'Treino B', exercicios: [exercicio('e3', 'supino  RETO'), exercicio('e4', 'Agachamento')] });
    expect(itensDaFonte('EXERCICIOS_DO_TREINO', entrada({ treino: t }))).toEqual([
      { id: 'e1', nome: 'Supino reto' }, { id: 'e2', nome: 'Remada' }, { id: 'e4', nome: 'Agachamento' },
    ]);
  });
});

describe('itensDoPlano: dias treinados', () => {
  const t = treino('2026-11-15', { uid: 's1', nome: 'Treino A' }, { uid: 's2', nome: 'Treino B' });

  it('rotula o dia como o servidor', () => {
    expect(rotuloDoDia('2026-11-16')).toBe('Seg 16/11');
    expect(rotuloDoDia('2026-11-22')).toBe('Dom 22/11');
    expect(rotuloDoDia('2026-11-21')).toBe('Sáb 21/11');
  });

  it('lista só as datas com série concluída no período, em ordem, com as sessões', () => {
    const registros = [
      serie('2026-11-18', 's2'), serie('2026-11-16', 's1'), serie('2026-11-16', 's1'), serie('2026-11-16', 's2'),
      serie('2026-11-17', 's1', false), // não concluída
      serie('2026-11-10', 's1'), // antes do início da pasta
      serie('2026-11-26', 's1'), // depois da atualização
      serie('2026-11-20', 'sessao-que-sumiu'),
    ];
    expect(itensDaFonte('DIAS_TREINADOS', entrada({ treino: t, registros }))).toEqual([
      { id: '2026-11-16', nome: 'Seg 16/11 · Treino A, Treino B' },
      { id: '2026-11-18', nome: 'Qua 18/11 · Treino B' },
      { id: '2026-11-20', nome: 'Sex 20/11' },
    ]);
  });

  it('sem nenhum registro no período, a semana (1 a 7)', () => {
    const lista = itensDaFonte('DIAS_TREINADOS', entrada({ treino: t, registros: [serie('2026-11-17', 's1', false), serie('2026-10-01', 's1')] }));
    expect(lista).toHaveLength(7);
    expect(lista[0]).toEqual({ id: '1', nome: 'Segunda-feira' });
    expect(lista[6]).toEqual({ id: '7', nome: 'Domingo' });
  });

  it('período sem início ou invertido cai para a semana mesmo com registro', () => {
    const registros = [serie('2026-11-16', 's1')];
    expect(itensDaFonte('DIAS_TREINADOS', entrada({ treino: treino(null), registros }))[0].id).toBe('1');
    expect(itensDaFonte('DIAS_TREINADOS', entrada({ treino: t, registros, dataDaAtualizacao: '2026-11-01' }))[0].id).toBe('1');
  });

  it('sem treino, o início vem da dieta', () => {
    const lista = itensDaFonte('DIAS_TREINADOS', entrada({ dieta: { inicio: '2026-11-15', conteudo: dieta({}) }, registros: [serie('2026-11-16', 's1')] }));
    expect(lista).toEqual([{ id: '2026-11-16', nome: 'Seg 16/11' }]);
  });
});

describe('itensDoPlano: do questionário à validação', () => {
  const pergunta = (parcial: Partial<PerguntaAtualizacao>): PerguntaAtualizacao => ({ id: 'p', tipo: 'ITENS_DO_PLANO', rotulo: 'Qual?', obrigatoria: false, ...parcial });
  const modelo = (...perguntas: PerguntaAtualizacao[]): ConteudoQuestionario => ({ formato: 2, instrucoes: [], secoes: [{ uid: 's', titulo: 'Geral', perguntas }] });

  it('monta só as fontes que o questionário usa', () => {
    const m = modelo(pergunta({ id: 'a', fonte: 'ALIMENTOS_DA_DIETA' }), pergunta({ id: 'b', fonte: 'ALIMENTOS_DA_DIETA' }), { id: 'c', tipo: 'TEXTO', rotulo: 'x', obrigatoria: false });
    expect(fontesDoQuestionario(m)).toEqual(['ALIMENTOS_DA_DIETA']);
    const itens = itensDoQuestionario(m, entrada({ dieta: { inicio: null, conteudo: dieta({ refeicoes: [refeicao('r', [item('a1', 'Arroz')])] }) } }));
    expect(Object.keys(itens)).toEqual(['ALIMENTOS_DA_DIETA']);
  });

  it('a lista do aparelho aceita a escolha, o envio leva só id e motivo e o nome de outro item é recusado', () => {
    const m = modelo(pergunta({ fonte: 'ALIMENTOS_DA_DIETA', motivo: 'OBRIGATORIO', max: 1 }));
    const itens = itensDoQuestionario(m, entrada({ dieta: { inicio: null, conteudo: dieta({ refeicoes: [refeicao('r', [item('a1', 'Arroz'), item('a2', 'Feijão')])] }) } }));
    const respostas = { p: respostaDeItens([{ id: 'a1', motivo: 'enjoei' }]) };
    expect(errosRespostasAtualizacao(m, respostas, false, {}, '2026-11-25', itens)).toEqual({});
    expect(errosRespostasAtualizacao(m, { p: respostaDeItens([{ id: 'a1' }]) }, false, {}, '2026-11-25', itens)).toHaveProperty('p');
    expect(errosRespostasAtualizacao(m, { p: respostaDeItens([{ id: 'a1', motivo: 'x' }, { id: 'a2', motivo: 'y' }]) }, false, {}, '2026-11-25', itens)).toHaveProperty('p');
    // o nome vem da lista e nunca do cliente: se vier junto, o envio o tira e a conferência o recusa antes
    expect(errosRespostasAtualizacao(m, { p: respostaDeItens([{ id: 'a1', motivo: 'x', nome: 'Outro' }]) }, false, {}, '2026-11-25', itens)).toHaveProperty('p');
    expect(respostasParaEnviar(m, { p: respostaDeItens([{ id: 'a1', motivo: 'x', nome: 'Arroz' }]) })).toEqual({ p: respostaDeItens([{ id: 'a1', motivo: 'x' }]) });
  });
});
