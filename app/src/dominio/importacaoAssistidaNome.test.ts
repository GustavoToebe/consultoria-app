import type { ArquivoResumo, GrupoImportavel } from '../servicos/importacaoAssistida';
import {
  avisoDoNome,
  idsSelecionaveisProntos,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  nomeNoCampo,
  nomeTravado,
  partesParaJuntar,
  textoDosTravados,
} from './importacaoAssistida';

/** Trava do nome substituto e "Juntar as N partes" (28/11), só com dados fictícios. */
const grupo = (extra: Partial<GrupoImportavel> = {}): GrupoImportavel => ({
  id: 'g1', identificadorOrigem: 'plano.pdf', nomeDetectado: 'Aluno 1', destino: 'CRIAR_ALUNO', arquivosOrigem: ['plano.pdf'],
  cadastro: { nome: 'Aluno 1' }, pesos: [], treino: null, dieta: null, pendenciasIds: [], estado: 'PRONTO',
  origemDoNome: 'AUSENTE', ...extra,
});
const arquivo = (nomeOriginal: string) => ({ id: nomeOriginal, nomeOriginal }) as ArquivoResumo;
const pode = () => true;

describe('nome não encontrado no documento', () => {
  test('só o aluno novo com o substituto trava; lido, digitado, vinculado, modelo e ignorado não', () => {
    expect(nomeTravado(grupo())).toBe(true);
    expect(nomeTravado(grupo({ origemDoNome: 'NOME_DO_ARQUIVO' }))).toBe(true);
    expect(nomeTravado(grupo({ origemDoNome: 'TITULO_DO_TEXTO' }))).toBe(true);
    expect(nomeTravado(grupo({ origemDoNome: 'CONTEUDO' }))).toBe(false);
    expect(nomeTravado(grupo({ origemDoNome: 'DIGITADO' }))).toBe(false);
    expect(nomeTravado(grupo({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' }))).toBe(false);
    expect(nomeTravado(grupo({ destino: 'MODELO_BIBLIOTECA' }))).toBe(false);
    expect(nomeTravado(grupo({ destino: 'IGNORAR' }))).toBe(false);
    expect(nomeTravado(grupo({ estado: 'IMPORTADO' }))).toBe(false);
  });

  test('aviso: diz que usou o nome do arquivo só quando usou; o campo vem vazio sem fonte', () => {
    expect(avisoDoNome(grupo({ origemDoNome: 'NOME_DO_ARQUIVO' }))?.texto).toContain('nome do arquivo');
    expect(avisoDoNome(grupo())).toEqual({ titulo: 'Nome não encontrado no documento', texto: 'Digite o nome, vincule a um aluno já cadastrado ou ignore.' });
    expect(avisoDoNome(grupo({ origemDoNome: 'CONTEUDO' }))).toBeNull();
    expect(avisoDoNome(grupo({ origemDoNome: 'DIGITADO' }))).toBeNull();
    expect(nomeNoCampo(grupo())).toBe('');
    expect(nomeNoCampo(grupo({ origemDoNome: 'TITULO_DO_TEXTO' }))).toBe('');
    expect(nomeNoCampo(grupo({ origemDoNome: 'NOME_DO_ARQUIVO', cadastro: { nome: 'Joana Ficticia' } }))).toBe('Joana Ficticia');
    // Vinculado ou ignorado: só o título, e o campo volta ao nome que há (não cobra o nome).
    expect(avisoDoNome(grupo({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' }))).toEqual({ titulo: 'Nome não encontrado no documento', texto: null });
    expect(nomeNoCampo(grupo({ destino: 'VINCULAR_EXISTENTE', alunoExistenteId: 'a1' }))).toBe('Aluno 1');
  });

  test('o travado não entra nos prontos, trava o "Gravar" com o motivo e é contado junto dele', () => {
    const grupos = [grupo(), grupo({ id: 'g2', origemDoNome: 'CONTEUDO', nomeDetectado: 'Ana Ficticia' })];
    expect(idsSelecionaveisProntos(grupos, pode)).toEqual(['g2']);
    expect(motivoParaNaoConfirmar(grupos, pode, new Set(), new Set(['g1', 'g2']), 'h')).toBe(
      'Aluno 1 está sem nome. Informe o nome do aluno, vincule a um existente ou ignore.');
    expect(motivoParaNaoConfirmar(grupos, pode, new Set(), new Set(['g2']), 'h')).toBeNull();
    expect(textoDosTravados(grupos)).toBe('1 aluno novo sem nome não entra na gravação até receber o nome, ser vinculado ou ignorado.');
    expect(textoDosTravados([grupos[1]])).toBeNull();
    expect(motivoDoErroDoGrupo('NOME_DO_ALUNO_PENDENTE')).toBe('Informe o nome do aluno, vincule a um existente ou ignore.');
  });
});

describe('juntar as partes do mesmo arquivo', () => {
  test('oferece na primeira parte as outras, só com um arquivo daquele nome e alguma travada', () => {
    const grupos = [grupo(), grupo({ id: 'g2', nomeDetectado: 'Aluno 2' }), grupo({ id: 'g3', origemDoNome: 'DIGITADO' })];
    expect(partesParaJuntar({ arquivos: [arquivo('plano.pdf')], grupos })).toEqual(new Map([['g1', ['g2', 'g3']]]));
    // Dois arquivos com o mesmo nome podem ser alunos diferentes.
    expect(partesParaJuntar({ arquivos: [arquivo('plano.pdf'), arquivo('plano.pdf')], grupos }).size).toBe(0);
    // Nenhuma travada (todas com nome digitado): nada a oferecer.
    const digitados = grupos.map((g) => ({ ...g, origemDoNome: 'DIGITADO' as const }));
    expect(partesParaJuntar({ arquivos: [arquivo('plano.pdf')], grupos: digitados }).size).toBe(0);
  });

  test('fora das partes: nome lido, outro arquivo, ignorado, gravado e uma parte só', () => {
    const arquivos = [arquivo('plano.pdf'), arquivo('outro.pdf')];
    expect(partesParaJuntar({ arquivos, grupos: [grupo(), grupo({ id: 'g2', origemDoNome: 'CONTEUDO' })] }).size).toBe(0);
    expect(partesParaJuntar({ arquivos, grupos: [grupo(), grupo({ id: 'g2', arquivosOrigem: ['outro.pdf'] })] }).size).toBe(0);
    expect(partesParaJuntar({ arquivos, grupos: [grupo(), grupo({ id: 'g2', destino: 'IGNORAR' })] }).size).toBe(0);
    expect(partesParaJuntar({ arquivos, grupos: [grupo(), grupo({ id: 'g2', estado: 'IMPORTADO' })] }).size).toBe(0);
    expect(partesParaJuntar({ arquivos, grupos: [grupo()] }).size).toBe(0);
  });
});
