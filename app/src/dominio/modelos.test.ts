import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import type { Configuracao, ConteudoTreino } from '../api/tipos';
import { aplicarReceitaDePlano, normalizarTreino, novaSerie, novaSessao } from './editorTreino';
import { destinosParaAplicar, resumoDoDestino, detalheDoModelo, podeAplicarModelo, podeSalvarPastaComoModelo, SEM_PASTA_PARA_APLICAR, temAcaoNoMenuDaPasta, descricaoDoModelo, LIMITE_DESCRICAO_DO_MODELO } from './modelos';
import { nomeDoTipo } from './metodologia';
import { conteudoInicial } from '../treinador/planejamento/modelos';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `modelo-uid-${++mockContador}` }));

const configuracao: Configuracao = { ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => ({ ...t, nome: t.nome === 'WS' ? 'Trabalho' : t.nome, repeticoes: null })), arredondamentoKg: 1, instrucoesTreino: 'Instrução fictícia', rodapePdf: 'Modelo fictício' };

test('normalizar e aplicar semana preservam metodologia independente e renovam os identificadores', () => {
  const origem: ConteudoTreino = { ...normalizarTreino(null), sessoes: [novaSessao(1)], metodologia: { id: 'metodo', nome: 'Método', configuracao } };
  const atual = { ...normalizarTreino(null), objetivo: 'Objetivo do aluno' };
  const a = aplicarReceitaDePlano(atual, origem);
  const b = aplicarReceitaDePlano(atual, origem);
  expect(a.objetivo).toBe('Objetivo do aluno');
  expect(a.metodologia).toEqual(origem.metodologia);
  expect(a.metodologia).not.toBe(origem.metodologia);
  expect(a.sessoes[0].uid).not.toBe(b.sessoes[0].uid);
  expect(a.sessoes[0].uid).not.toBe(origem.sessoes[0].uid);
  a.metodologia!.configuracao.tipos[1].regraPercentuais!['1'][0].min = 90;
  expect(origem.metodologia!.configuracao.tipos[1].regraPercentuais!['1']).toEqual([{ min: 85, max: null }]);
  const nova = novaSerie(b.metodologia!.configuracao);
  expect(nova.tipo).toBe('WORKING');
  expect(nomeDoTipo(b.metodologia!.configuracao, nova.tipo)).toBe('Trabalho');
});

test('modelo sem metodologia mantém a metodologia já vinculada ao aluno', () => {
  const atual = { ...normalizarTreino(null), metodologia: { id: 'metodo', nome: 'Método', configuracao } };
  expect(aplicarReceitaDePlano(atual, { sessoes: [] }).metodologia).toEqual(atual.metodologia);
});

test('conteúdos iniciais não inventam prescrições e modelos avulsos têm exatamente uma seção', () => {
  expect(conteudoInicial('SESSAO_TREINO', configuracao)).toMatchObject({ sessoes: [{ exercicios: [] }] });
  expect(conteudoInicial('REFEICAO', configuracao)).toMatchObject({ refeicoes: [expect.any(Object)] });
  expect(conteudoInicial('SERIES', configuracao)).toMatchObject({ series: [{ repsMin: null, repsMax: null }] });
  const copia = conteudoInicial('METODOLOGIA', configuracao) as Configuracao;
  copia.tipos[0].nome = 'Novo';
  expect(configuracao.tipos[0].nome).not.toBe('Novo');
});

test('adapter conserva revisão otimista sem simular publicação nem associar aluno', () => {
  const detalhe = detalheDoModelo({ id: 'modelo', tipo: 'PLANO_TREINO', nome: 'Semana', descricao: null, pastaId: null, ordem: 1, versao: 7, conteudo: normalizarTreino(null) });
  expect(detalhe.plano).toMatchObject({ titulo: 'Semana', versao: 7, versaoPublicada: 0, ativo: false, alunoId: '', inicio: null, fim: null });
  expect(detalhe.versoes).toEqual([]);
});

test('aplicar modelo pede a permissão de alterar o que ele cria (como a API)', () => {
  const tem = (...codigos: string[]) => (c: string) => codigos.includes(c);
  const nutricionista = tem('MODELO_APLICAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR');
  expect(podeAplicarModelo('PLANO_DIETA', nutricionista)).toBe(true);
  expect(podeAplicarModelo('REFEICAO', nutricionista)).toBe(true);
  expect(podeAplicarModelo('PLANO_TREINO', nutricionista)).toBe(false);
  expect(podeAplicarModelo('MOBILIDADE', nutricionista)).toBe(false);
  expect(podeAplicarModelo('PASTA_PLANO', nutricionista)).toBe(true);
  expect(podeAplicarModelo('METODOLOGIA', tem('MODELO_APLICAR', 'ALUNO_LER', 'TREINO_ALTERAR'))).toBe(false);
  expect(podeAplicarModelo('PLANO_TREINO', tem('MODELO_APLICAR', 'TREINO_ALTERAR'))).toBe(false);
  expect(podeAplicarModelo('PLANO_TREINO', tem('ALUNO_LER', 'TREINO_ALTERAR'))).toBe(false);
});

test('sem PASTA_ALTERAR não há "criar nova pasta" ao aplicar um modelo', () => {
  const pastas = [{ id: 'p1', titulo: 'Pasta 1' }, { id: 'p2', titulo: 'Pasta 2' }];
  const quemCria = destinosParaAplicar(true, pastas, '2026-10-30');
  expect(quemCria.opcoes.map((o) => o.valor)).toEqual(['p1', 'p2', '']);
  const quemNaoCria = destinosParaAplicar(false, pastas, '2026-10-30');
  expect(quemNaoCria.opcoes.map((o) => o.valor)).toEqual(['p1', 'p2']);
  expect(quemNaoCria.semDestino).toBe(false);
  expect(destinosParaAplicar(false, []).semDestino).toBe(true);
  expect(destinosParaAplicar(false, null).semDestino).toBe(false);
  expect(destinosParaAplicar(true, []).semDestino).toBe(false);
  expect(SEM_PASTA_PARA_APLICAR).toBe('Peça a quem pode criar pastas para criar uma para este aluno.');
});

test('aluno com pasta: ninguém escolhe o destino pelo treinador (reunião de 29/10)', () => {
  const pastas = [
    { id: 'p1', titulo: 'Plano 16', inicio: '2026-10-01', fim: '2026-10-15', concluidaEm: '2026-10-16T12:00:00Z' },
    { id: 'p2', titulo: 'Plano 17', inicio: '2026-10-16', fim: '2026-10-30', concluidaEm: null },
  ];
  const d = destinosParaAplicar(true, pastas, '2026-10-30');
  expect(d.padrao).toBeNull();
  // Abertas primeiro, depois a nova, e as concluídas por último; cada uma com o período.
  expect(d.opcoes).toEqual([
    { valor: 'p2', rotulo: 'Plano 17 · 16/10 a 30/10' },
    { valor: '', rotulo: 'Criar nova pasta' },
    { valor: 'p1', rotulo: 'Plano 16 · 01/10 a 15/10 (concluída)' },
  ]);
  // Sem pasta nenhuma, a nova já vem marcada; ainda carregando, nada.
  expect(destinosParaAplicar(true, []).padrao).toBe('');
  expect(destinosParaAplicar(true, null).padrao).toBeNull();
  // Quem não cria pasta: com uma só, fica nela; com duas, escolhe.
  expect(destinosParaAplicar(false, [pastas[1]], '2026-10-30').padrao).toBe('p2');
  expect(destinosParaAplicar(false, pastas, '2026-10-30').padrao).toBeNull();
  expect(destinosParaAplicar(false, [], '2026-10-30').padrao).toBeNull();
});

test('salvar pasta como pacote segue as permissões da rota e o ⋯ some sem ação', () => {
  const tem = (...codigos: string[]) => (c: string) => codigos.includes(c);
  // Perfis padrão: Treinador e Nutricionista têm as quatro; o Assistente não tem MODELO_ALTERAR.
  const treinador = tem('PASTA_ALTERAR', 'MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER');
  const nutricionista = tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER', 'DIETA_LER');
  const assistente = tem('ALUNO_LER', 'TREINO_LER', 'DIETA_LER', 'MODELO_LER');
  expect(podeSalvarPastaComoModelo(treinador)).toBe(true);
  expect(podeSalvarPastaComoModelo(nutricionista)).toBe(true);
  expect(podeSalvarPastaComoModelo(assistente)).toBe(false);
  expect(podeSalvarPastaComoModelo(tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER'))).toBe(false);
  expect(podeSalvarPastaComoModelo(tem('MODELO_ALTERAR', 'TREINO_LER', 'DIETA_LER'))).toBe(false);
  expect(temAcaoNoMenuDaPasta(nutricionista)).toBe(true);
  expect(temAcaoNoMenuDaPasta(tem('PASTA_ALTERAR'))).toBe(true);
  expect(temAcaoNoMenuDaPasta(tem('MODELO_ALTERAR', 'ALUNO_LER', 'TREINO_LER'))).toBe(false);
});

test('descrição do modelo: texto aparado ou "—", e o limite é o da API', () => {
  expect(descricaoDoModelo({ descricao: '  Semana de força  ' })).toBe('Semana de força');
  expect(descricaoDoModelo({ descricao: null })).toBe('—');
  expect(descricaoDoModelo({ descricao: '   ' })).toBe('—');
  expect(LIMITE_DESCRICAO_DO_MODELO).toBe(300);
});

test('resumo do destino diz onde a cópia entra e que fica em rascunho', () => {
  const opcoes = [{ valor: 'p2', rotulo: 'Plano 17 · 16/10 a 30/10' }, { valor: '', rotulo: 'Criar nova pasta' }];
  expect(resumoDoDestino(false, '', opcoes, 'Dieta base')).toBeNull();
  expect(resumoDoDestino(true, 'p2', opcoes, 'Dieta base')).toBe('A cópia entra em rascunho na pasta “Plano 17”. O aluno só vê depois que você publicar.');
  expect(resumoDoDestino(true, '', opcoes, 'Dieta base')).toBe('Cria a pasta nova “Dieta base” com a cópia em rascunho. O aluno só vê depois que você publicar.');
});
