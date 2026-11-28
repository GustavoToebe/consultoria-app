import { idDoTopico } from '../ajuda/blocos';
import { GUIAS } from '../ajuda/conteudo';
import { artigoDaTela, TELAS_COM_ARTIGO } from './ajudaDaTela';

describe('artigoDaTela', () => {
  it('toda seção (e todo tópico) mapeada existe no guia da área', () => {
    for (const [tela, secao, topico] of TELAS_COM_ARTIGO) {
      const publico = tela.startsWith('/aluno') ? 'aluno' : 'treinador';
      const achada = GUIAS[publico].secoes.find((s) => s.id === secao);
      const temTopico = !topico || !!achada?.itens.some((i) => idDoTopico(i.titulo) === topico);
      expect({ tela, existe: !!achada, temTopico }).toEqual({ tela, existe: true, temTopico: true });
    }
  });

  it('a tela que é um tópico do artigo abre nele', () => {
    expect(artigoDaTela('/treinador/equipe')).toBe('/treinador/ajuda?secao=consultoria&topico=equipe');
    expect(artigoDaTela('/treinador/alunos/tags')).toBe('/treinador/ajuda?secao=alunos&topico=tags-dos-alunos');
    expect(artigoDaTela('/treinador/importacao/planilha-completa')).toBe('/treinador/ajuda?secao=importacao&topico=planilha-completa');
  });

  it('abre a seção da Ajuda da própria área', () => {
    expect(artigoDaTela('/treinador/biblioteca')).toBe('/treinador/ajuda?secao=biblioteca');
    expect(artigoDaTela('/aluno/treino')).toBe('/aluno/ajuda?secao=treino');
  });

  it('a subtela herda o artigo; prefixo sem barra não casa', () => {
    expect(artigoDaTela('/treinador/importacao/nova')).toBe('/treinador/ajuda?secao=importacao');
    expect(artigoDaTela('/treinador/equipes')).toBeNull();
  });

  it('telas principais e de edição do treinador abrem a seção certa', () => {
    const esperado: Record<string, string> = {
      '/treinador': 'inicio',
      '/treinador/alunos': 'alunos',
      '/treinador/alunos/abc': 'alunos',
      '/treinador/alunos/novo': 'alunos',
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
