import type { Atualizacao, ConteudoQuestionario, TipoPergunta } from '../api/tipos';
import { atualizacaoAnterior, mudancasDaAtualizacao } from './mudancasDaAtualizacao';

const modelo: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [{ uid: 's', titulo: 'Fictícia', perguntas: [
    { id: 'peso', tipo: 'PESO', rotulo: 'Peso em jejum', obrigatoria: true },
    { id: 'sono', tipo: 'NOTA', rotulo: 'Como foi o sono', rotuloCurto: 'Sono', obrigatoria: false },
    { id: 'dor', tipo: 'SIM_NAO', rotulo: 'Sentiu dores', obrigatoria: false },
    { id: 'agua', tipo: 'NUMERO', rotulo: 'Água por dia', unidade: 'L', casas: 1, obrigatoria: false },
    { id: 'obs', tipo: 'TEXTO', rotulo: 'Observação', obrigatoria: false },
    { id: 'novo', tipo: 'ITENS_DO_PLANO' as TipoPergunta, rotulo: 'Quer trocar', obrigatoria: false },
  ] }],
};

const base = (id: string, data: string, respostas: Atualizacao['respostas'], extra: Partial<Atualizacao> = {}) => ({
  id, dataAtualizacao: data, enviadaEm: `${data}T12:00:00Z`, fase: 'ENVIADA' as const, modelo, respostas,
  resumo: { diasComTreino: 9, mediaDiasPorSemana: 3, pesoAnterior: null }, ...extra,
});

describe('atualizacaoAnterior', () => {
  const atual = { id: 'c', dataAtualizacao: '2026-11-20' };
  it('pega a enviada ou revisada mais recente antes da data, ignorando a própria, as abertas e as de depois', () => {
    const lista = [
      base('c', '2026-11-20', {}),
      base('futura', '2026-12-20', {}),
      base('aberta', '2026-11-10', {}, { fase: 'ABERTA', enviadaEm: null }),
      base('b', '2026-10-20', {}, { fase: 'REVISADA' }),
      base('a', '2026-09-20', {}),
    ];
    expect(atualizacaoAnterior(lista, atual)?.id).toBe('b');
  });
  it('mesma data: a de envio mais recente', () => {
    const lista = [base('x', '2026-10-20', {}, { enviadaEm: '2026-10-20T08:00:00Z' }), base('y', '2026-10-20', {}, { enviadaEm: '2026-10-21T08:00:00Z' })];
    expect(atualizacaoAnterior(lista, atual)?.id).toBe('y');
  });
  it('sem anterior ou sem data na atual: null', () => {
    expect(atualizacaoAnterior([base('c', '2026-11-20', {})], atual)).toBeNull();
    expect(atualizacaoAnterior([base('b', '2026-10-20', {})], { id: 'c', dataAtualizacao: null })).toBeNull();
  });
});

describe('mudancasDaAtualizacao', () => {
  it('sem anterior: primeira atualização', () => {
    expect(mudancasDaAtualizacao(base('c', '2026-11-20', {}), null)).toEqual({ tipo: 'primeira' });
  });
  it('só o que mudou, na ordem do questionário, com os dias de treino por último', () => {
    const antes = base('b', '2026-10-20', { peso: 82, sono: 7, dor: false, agua: 2.5, obs: 'a', novo: 'x' });
    const agora = base('c', '2026-11-20', { peso: 80, sono: 4, dor: true, agua: 2.5, obs: 'b', novo: 'y' }, { resumo: { diasComTreino: 3, mediaDiasPorSemana: 1, pesoAnterior: 82 } });
    expect(mudancasDaAtualizacao(agora, antes)).toEqual({ tipo: 'comparada', dataAnterior: '2026-10-20', mudancas: [
      { chave: 'peso', rotulo: 'Peso em jejum', anterior: '82,0 kg', atual: '80,0 kg' },
      { chave: 'sono', rotulo: 'Sono', anterior: '7', atual: '4' },
      { chave: 'dor', rotulo: 'Sentiu dores', anterior: 'Não', atual: 'Sim' },
      { chave: 'dias-com-treino', rotulo: 'Dias com treino registrado', anterior: '9', atual: '3' },
    ] });
  });
  it('número com unidade e casas; sem resposta de um dos lados não compara', () => {
    const antes = base('b', '2026-10-20', { agua: 2, sono: 5 });
    const agora = base('c', '2026-11-20', { agua: 2.5 });
    expect(mudancasDaAtualizacao(agora, antes)).toMatchObject({ mudancas: [{ chave: 'agua', anterior: '2 L', atual: '2,5 L' }] });
  });
  it('mesmo id com tipo diferente na versão anterior não compara', () => {
    const outro: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'x', perguntas: [{ id: 'sono', tipo: 'NUMERO', rotulo: 'Horas', obrigatoria: false }] }] };
    const antes = { ...base('b', '2026-10-20', { sono: 6 }), modelo: outro };
    expect(mudancasDaAtualizacao(base('c', '2026-11-20', { sono: 4 }), antes)).toMatchObject({ mudancas: [] });
  });
  it('nada mudou: lista vazia (a tela diz que nada comparável mudou)', () => {
    const r = mudancasDaAtualizacao(base('c', '2026-11-20', { sono: 5 }), base('b', '2026-10-20', { sono: 5 }));
    expect(r).toEqual({ tipo: 'comparada', dataAnterior: '2026-10-20', mudancas: [] });
  });
});
