import {
  abaDoMontador,
  agruparPorSecao,
  filtrarExemplos,
  resumoDaBusca,
  resumoDoGrupo,
  SECOES_DO_CATALOGO,
  tituloDoExemplo,
  type ExemploDoCatalogo,
} from './catalogoDeComponentes';

const exemplos: ExemploDoCatalogo[] = [
  { id: 'botao-primario', componente: 'Botao', estado: 'primário', secao: 'botoes', caminho: 'ui/Botao', props: 'tipo="primario"' },
  { id: 'campo-vazio', componente: 'Campo', estado: 'vazio', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo' },
  { id: 'campo-erro', componente: 'Campo', estado: 'com erro', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'erro' },
  { id: 'senha', componente: 'CampoSenha', estado: 'com o olho', secao: 'camposDeTexto', caminho: 'ui/CampoSenha', props: '' },
  { id: 'grafico', componente: 'GraficoLinha', estado: 'peso em kg', secao: 'numerosEGraficos', caminho: 'ui/GraficoLinha', props: '' },
  { id: 'selo', componente: 'Selo', estado: 'atenção', secao: 'avisosEEstados', caminho: 'ui/Selo', props: 'tipo="atencao"' },
];

describe('tituloDoExemplo', () => {
  it('junta componente e estado com travessão', () => {
    expect(tituloDoExemplo({ componente: 'Campo', estado: 'com erro' })).toBe('Campo — com erro');
  });
});

describe('filtrarExemplos', () => {
  it('busca vazia ou só espaços devolve tudo, na mesma ordem e numa cópia', () => {
    const r = filtrarExemplos(exemplos, '   ');
    expect(r.map((e) => e.id)).toEqual(exemplos.map((e) => e.id));
    expect(r).not.toBe(exemplos);
  });

  it('ignora acento e maiúsculas no termo e no exemplo', () => {
    expect(filtrarExemplos(exemplos, 'PRIMARIO').map((e) => e.id)).toEqual(['botao-primario']);
    expect(filtrarExemplos(exemplos, 'atenção').map((e) => e.id)).toEqual(['selo']);
    expect(filtrarExemplos(exemplos, 'gráfico').map((e) => e.id)).toEqual(['grafico']);
  });

  it('"Campo" acha o Campo e o CampoSenha', () => {
    expect(filtrarExemplos(exemplos, 'Campo').map((e) => e.id)).toEqual(['campo-vazio', 'campo-erro', 'senha']);
  });

  it('cada palavra precisa aparecer no componente, no estado ou no caminho', () => {
    expect(filtrarExemplos(exemplos, 'campo erro').map((e) => e.id)).toEqual(['campo-erro']);
    expect(filtrarExemplos(exemplos, 'ui/selo').map((e) => e.id)).toEqual(['selo']);
  });

  it('não procura nas props', () => {
    expect(filtrarExemplos(exemplos, 'rotulo')).toEqual([]);
  });

  it('sem resultado devolve lista vazia', () => {
    expect(filtrarExemplos(exemplos, 'inexistente')).toEqual([]);
  });
});

describe('agruparPorSecao', () => {
  it('segue a ordem das seções, mantém a ordem dentro da seção e tira seção vazia', () => {
    const grupos = agruparPorSecao(exemplos);
    expect(grupos.map((g) => g.secao)).toEqual(['camposDeTexto', 'botoes', 'avisosEEstados', 'numerosEGraficos']);
    expect(grupos[0].titulo).toBe('Campos de texto');
    expect(grupos[0].exemplos.map((e) => e.id)).toEqual(['campo-vazio', 'campo-erro', 'senha']);
  });

  it('lista vazia não tem grupo', () => {
    expect(agruparPorSecao([])).toEqual([]);
  });

  it('as sete seções têm título e chave única', () => {
    expect(SECOES_DO_CATALOGO).toHaveLength(7);
    expect(new Set(SECOES_DO_CATALOGO.map((s) => s.chave)).size).toBe(7);
  });
});

describe('resumos', () => {
  it('resumoDoGrupo no singular e no plural', () => {
    expect(resumoDoGrupo(1)).toBe('1 exemplo');
    expect(resumoDoGrupo(3)).toBe('3 exemplos');
  });

  it('resumoDaBusca: tudo, parte e nada', () => {
    expect(resumoDaBusca(10, 10)).toBe('10 exemplos');
    expect(resumoDaBusca(3, 10)).toBe('3 de 10 exemplos');
    expect(resumoDaBusca(0, 10)).toBe('Nenhum componente encontrado');
  });
});

describe('abaDoMontador', () => {
  it('"catalogo" abre o Catálogo; o resto, Montar', () => {
    expect(abaDoMontador('catalogo')).toBe('catalogo');
    expect(abaDoMontador(['catalogo'])).toBe('catalogo');
    expect(abaDoMontador(undefined)).toBe('montar');
    expect(abaDoMontador('montar')).toBe('montar');
    expect(abaDoMontador('Catalogo')).toBe('montar');
  });
});
