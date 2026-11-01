import type { TipoReceita } from '../../api/tipos';
import { ABA_ANAMNESE, ABA_ATUALIZACAO, ABA_INSCRICAO, abaDoPlanejamento, avisoModeloSalvo, CATEGORIAS, GRUPOS_DE_MODELOS, gruposLiberados, metadadosDoModelo, nomeDoModelo, rotuloNovoModelo, rotuloSalvarComo, slugDaAba, usoDoModelo } from './modelos';

describe('organização da tela Planejamento', () => {
  it('cada tipo aparece uma vez, no grupo certo e na ordem pedida', () => {
    expect(GRUPOS_DE_MODELOS.map((g) => [g.rotulo, g.tipos])).toEqual([
      ['Treino', ['PLANO_TREINO', 'SESSAO_TREINO', 'SERIES', 'METODOLOGIA']],
      ['Dieta', ['PLANO_DIETA', 'REFEICAO']],
      ['Pacotes', ['PASTA_PLANO']],
      ['Mobilidade', ['MOBILIDADE']],
    ]);
    expect(CATEGORIAS).toHaveLength(8);
  });
  it('rótulos novos', () => {
    const rotulo = (t: TipoReceita) => CATEGORIAS.find((c) => c.valor === t)?.rotulo;
    expect(rotulo('SERIES')).toBe('Receitas de séries');
    expect(rotulo('SESSAO_TREINO')).toBe('Dias de treino');
    expect(rotulo('PASTA_PLANO')).toBe('Pacotes (treino, dieta e mobilidade)');
    expect(rotulo('REFEICAO')).toBe('Refeições');
  });
  it('semanas, dietas, pacotes e mobilidade são aplicados ao aluno; peças dizem onde usar, sem inventar uso', () => {
    expect(CATEGORIAS.filter((c) => usoDoModelo(c.valor).aplicavel).map((c) => c.valor)).toEqual(['PLANO_TREINO', 'PLANO_DIETA', 'PASTA_PLANO', 'MOBILIDADE']);
    expect(usoDoModelo('SERIES').linha).toMatch(/editor de treino/);
    expect(usoDoModelo('REFEICAO').linha).toMatch(/editor de dieta/);
    expect(usoDoModelo('MOBILIDADE').linha).toBeNull();
    expect(usoDoModelo('PLANO_TREINO').linha).toBeNull();
  });
});

describe('aba do Planejamento pelo endereço', () => {
  it('o valor de ?aba= é o rótulo sem acento nem maiúscula', () => {
    expect([...GRUPOS_DE_MODELOS.map((g) => g.rotulo), ABA_ATUALIZACAO].map(slugDaAba)).toEqual(['treino', 'dieta', 'pacotes', 'mobilidade', 'atualizacao']);
  });

  it('abre a aba pedida e, sem pedido ou com pedido inválido, a primeira que o perfil vê', () => {
    expect(abaDoPlanejamento('dieta', true, true)).toBe('Dieta');
    expect(abaDoPlanejamento('atualizacao', true, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento('anamnese', true, true)).toBe(ABA_ANAMNESE);
    expect(abaDoPlanejamento('anamnese', true, false)).toBe('Treino');
    expect(abaDoPlanejamento('inscricao', true, true)).toBe(ABA_INSCRICAO);
    expect(abaDoPlanejamento('inscricao', false, true)).toBe(ABA_INSCRICAO);
    expect(slugDaAba(ABA_INSCRICAO)).toBe('inscricao');
    expect(abaDoPlanejamento(undefined, true, true)).toBe('Treino');
    expect(abaDoPlanejamento('qualquer', true, true)).toBe('Treino');
    expect(abaDoPlanejamento(['mobilidade', 'dieta'], true, false)).toBe('Mobilidade');
  });

  it('não abre aba que o perfil não vê', () => {
    expect(abaDoPlanejamento('dieta', false, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento(undefined, false, true)).toBe(ABA_ATUALIZACAO);
    expect(abaDoPlanejamento('atualizacao', true, false)).toBe('Treino');
  });
});

describe('Planejamento e as funcionalidades do plano', () => {
  it('sem a lista, todos os grupos aparecem', () => {
    expect(gruposLiberados(undefined).map((g) => g.rotulo)).toEqual(['Treino', 'Dieta', 'Pacotes', 'Mobilidade']);
  });

  it('Mobilidade desligada tira só a aba Mobilidade', () => {
    expect(gruposLiberados(['PDF', 'EQUIPE']).map((g) => g.rotulo)).toEqual(['Treino', 'Dieta', 'Pacotes']);
    expect(gruposLiberados(['MOBILIDADE']).map((g) => g.rotulo)).toContain('Mobilidade');
  });

  it('o endereço ?aba=mobilidade não abre a aba desligada', () => {
    expect(abaDoPlanejamento('mobilidade', true, true, ['PDF'])).toBe('Treino');
    expect(abaDoPlanejamento('mobilidade', true, true, ['MOBILIDADE'])).toBe('Mobilidade');
    expect(abaDoPlanejamento('atualizacao', true, true, [])).toBe(ABA_ATUALIZACAO);
  });
  it('um nome por tipo no botão, na folha e no aviso', () => {
    expect(nomeDoModelo('SESSAO_TREINO')).toBe('dia de treino');
    expect(rotuloNovoModelo('PLANO_TREINO')).toBe('Nova semana de treino');
    expect(rotuloNovoModelo('SESSAO_TREINO')).toBe('Novo dia de treino');
    expect(rotuloNovoModelo('PASTA_PLANO')).toBe('Novo pacote');
    expect(rotuloSalvarComo('SERIES')).toBe('Salvar como receita de séries');
    expect(avisoModeloSalvo('SESSAO_TREINO')).toBe('Dia de treino salvo no Planejamento.');
    expect(avisoModeloSalvo('REFEICAO')).toBe('Modelo de refeição salvo no Planejamento.');
    expect(rotuloNovoModelo('PLANO_DIETA')).toBe('Novo modelo de dieta');
  });
  it('metadados do cartão contam o que o modelo tem', () => {
    expect(metadadosDoModelo('PLANO_TREINO', { sessoes: [{ nome: 'A', exercicios: [{ nome: 'x', series: [] }, { nome: 'y', series: [] }] }] })).toBe('1 sessão · 2 exercícios');
    expect(metadadosDoModelo('PLANO_TREINO', { sessoes: [{ nome: 'A', exercicios: [] }] })).toBe('1 sessão · sem exercícios');
    expect(metadadosDoModelo('PASTA_PLANO', { planos: [{}, {}] })).toBe('2 planos');
    expect(metadadosDoModelo('PLANO_DIETA', { refeicoes: [] })).toBe('0 refeições');
    expect(metadadosDoModelo('METODOLOGIA', { tipos: [{nome:'FS'}, {nome:'WS'}] })).toBe('2 tipos de série');
    expect(metadadosDoModelo('MOBILIDADE', { orientacoes: '', secoes: [{ titulo: 'A', itens: [{ nome: 'x', prescricao: '', videoUrl: '' }] }] })).toBe('1 seção · 1 item');
  });
});
