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

  it('tela sem artigo e fora das áreas: nulo', () => {
    expect(artigoDaTela('/treinador/numeros')).toBeNull();
    expect(artigoDaTela('/treinador/ajuda')).toBeNull();
    expect(artigoDaTela('/entrar')).toBeNull();
  });
});
