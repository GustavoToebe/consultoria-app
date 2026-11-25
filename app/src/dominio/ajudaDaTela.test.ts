import { GUIAS } from '../ajuda/conteudo';
import { artigoDaTela, TELAS_COM_ARTIGO } from './ajudaDaTela';

describe('artigoDaTela', () => {
  it('toda seção mapeada existe no guia da área', () => {
    for (const [tela, secao] of TELAS_COM_ARTIGO) {
      const publico = tela.startsWith('/aluno') ? 'aluno' : 'treinador';
      expect({ tela, existe: GUIAS[publico].secoes.some((s) => s.id === secao) }).toEqual({ tela, existe: true });
    }
  });

  it('abre a seção da Ajuda da própria área', () => {
    expect(artigoDaTela('/treinador/biblioteca')).toBe('/treinador/ajuda?secao=biblioteca');
    expect(artigoDaTela('/treinador/equipe')).toBe('/treinador/ajuda?secao=consultoria');
    expect(artigoDaTela('/aluno/treino')).toBe('/aluno/ajuda?secao=treino');
  });

  it('a subtela herda o artigo; prefixo sem barra não casa', () => {
    expect(artigoDaTela('/treinador/importacao/planilha-completa')).toBe('/treinador/ajuda?secao=importacao');
    expect(artigoDaTela('/treinador/equipes')).toBeNull();
  });

  it('telas principais e de edição do treinador abrem a seção certa', () => {
    const esperado: Record<string, string> = {
      '/treinador': 'inicio',
      '/treinador/alunos': 'alunos',
      '/treinador/alunos/abc': 'alunos',
      '/treinador/alunos/novo': 'alunos',
      '/treinador/alunos/tags': 'alunos',
      '/treinador/agenda': 'agenda',
      '/treinador/atualizacoes/abc': 'atualizacoes',
      '/treinador/planejamento': 'planos',
      '/treinador/planejamento/modelo/abc': 'planos',
      '/treinador/treinos/abc': 'planos',
      '/treinador/dietas/abc': 'planos',
      '/treinador/mobilidades/abc': 'planos',
      '/treinador/termos': 'privacidade',
    };
    for (const [tela, secao] of Object.entries(esperado)) expect(artigoDaTela(tela)).toBe(`/treinador/ajuda?secao=${secao}`);
  });

  it('o Início não passa o artigo às outras telas; o editor de questionário não tem artigo', () => {
    for (const tela of ['/treinador/perfil', '/treinador/seguranca', '/treinador/meus-dados', '/treinador/minha-conta', '/treinador/documentos', '/treinador/whatsapp', '/treinador/ajustes']) {
      expect(artigoDaTela(tela)).toBeNull();
    }
    expect(artigoDaTela('/treinador/planejamento/questionario/abc')).toBeNull();
    expect(artigoDaTela('/aluno/termos')).toBeNull();
  });

  it('tela sem artigo e fora das áreas: nulo', () => {
    expect(artigoDaTela('/treinador/numeros')).toBeNull();
    expect(artigoDaTela('/treinador/ajuda')).toBeNull();
    expect(artigoDaTela('/entrar')).toBeNull();
  });
});
