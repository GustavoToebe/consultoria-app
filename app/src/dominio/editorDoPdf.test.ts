import { definir, resolver, trocarModelo } from './configuracaoPdf';
import {
  arranjoDoEditor,
  configDaMarca,
  estadoDaBarra,
  folhaNaTela,
  mensagemDoErroDeCampo,
  mesmaConfig,
  modeloDoEndereco,
  rascunhoDepoisDeSalvar,
  resumoDoGrupo,
} from './editorDoPdf';

describe('arranjoDoEditor (pela área de conteúdo)', () => {
  it('abaixo de 1024 só confirma o modelo', () => {
    expect(arranjoDoEditor(0)).toEqual({ tipo: 'compacto' });
    expect(arranjoDoEditor(1023)).toEqual({ tipo: 'compacto' });
  });
  it('janela abaixo de 1280 (área de 1024 em diante): opções em cima e prévia embaixo', () => {
    expect(arranjoDoEditor(1024)).toEqual({ tipo: 'empilhado' });
    expect(arranjoDoEditor(1279)).toEqual({ tipo: 'empilhado' });
    expect(arranjoDoEditor(1112, 1200)).toEqual({ tipo: 'empilhado' });
  });
  it('a partir de 1280 de janela: painel de 420 e a prévia no resto (quantas prévias é de previasDaLargura)', () => {
    // 1280 de janela com o menu aberto: ~1040 de área, ainda em colunas (a janela decide, não a área).
    expect(arranjoDoEditor(1040, 1280)).toEqual({ tipo: 'colunas', painel: 420 });
    expect(arranjoDoEditor(1280)).toEqual({ tipo: 'colunas', painel: 420 });
    expect(arranjoDoEditor(3200)).toEqual({ tipo: 'colunas', painel: 420 });
  });
});

describe('folhaNaTela', () => {
  it('Ajustar acompanha o espaço, com piso de 60% e teto de 125%', () => {
    expect(folhaNaTela(600, 'AJUSTAR')).toEqual({ largura: 600, rolaDeLado: false, zoomMuda: true });
    expect(folhaNaTela(300, 'AJUSTAR')).toEqual({ largura: 476, rolaDeLado: true, zoomMuda: true });
    expect(folhaNaTela(900, 'AJUSTAR')).toEqual({ largura: 900, rolaDeLado: false, zoomMuda: false });
    expect(folhaNaTela(1200, 'AJUSTAR')).toEqual({ largura: 993, rolaDeLado: false, zoomMuda: false });
  });
  it('100% é a A4 real só quando a ajustada encolhe; com sobra, a escolha antiga é ignorada', () => {
    expect(folhaNaTela(600, 'CEM')).toEqual({ largura: 794, rolaDeLado: true, zoomMuda: true });
    expect(folhaNaTela(794, 'CEM')).toEqual({ largura: 794, rolaDeLado: false, zoomMuda: false });
    expect(folhaNaTela(1200, 'CEM')).toEqual({ largura: 993, rolaDeLado: false, zoomMuda: false });
  });
});

describe('estadoDaBarra (um estado só)', () => {
  const salvo = trocarModelo('CLASSICO');
  const parado = { salvando: false, erro: false };
  it('sem mudança: "Em uso nos PDFs · <modelo> · Sem alterações", também com personalizações gravadas', () => {
    expect(estadoDaBarra(salvo, salvo, parado)).toEqual({ selo: { texto: 'Em uso nos PDFs', tipo: 'sucesso' }, info: 'Clássico · Sem alterações' });
    const personalizado = definir(salvo, 'texto', 'fonte', 'SERIFADA');
    expect(estadoDaBarra(personalizado, personalizado, parado).info).toBe('Clássico · Sem alterações');
  });
  it('modelo trocado sem mexer em nada não diz "Sem alterações" ao lado de "Alterações não salvas"', () => {
    const r = estadoDaBarra(trocarModelo('ESPORTIVO'), salvo, parado);
    expect(r.selo).toEqual({ texto: 'Alterações não salvas', tipo: 'neutro', naoSalvo: true });
    expect(r.info).toBe('Esportivo · os PDFs ainda usam Clássico');
  });
  it('mesmo modelo: conta as opções diferentes do gravado (não do modelo)', () => {
    const gravado = definir(salvo, 'texto', 'fonte', 'SERIFADA');
    expect(estadoDaBarra(definir(gravado, 'tabelas', 'estilo', 'CARTOES'), gravado, parado).info).toBe('Clássico · 1 opção mudada');
    expect(estadoDaBarra(definir(definir(gravado, 'tabelas', 'estilo', 'CARTOES'), 'texto', 'tamanho', 'G'), gravado, parado).info).toBe('Clássico · 2 opções mudadas');
    expect(estadoDaBarra(salvo, gravado, parado).info).toBe('Clássico · 1 opção mudada');
    expect(estadoDaBarra(salvo, { modelo: 'CLASSICO', sobrescritas: { cores: { destaque: 'MARCA' } } }, parado).info).toBe('Clássico · valores do modelo');
  });
  it('salvando e falha vencem o resto', () => {
    const mexido = definir(salvo, 'texto', 'fonte', 'SERIFADA');
    expect(estadoDaBarra(mexido, salvo, { salvando: true, erro: true })).toEqual({ selo: { texto: 'Salvando…', tipo: 'neutro' }, info: 'Clássico' });
    expect(estadoDaBarra(mexido, salvo, { salvando: false, erro: true })).toEqual({ selo: { texto: 'Falha ao salvar', tipo: 'perigo' }, info: 'Clássico' });
  });
});

describe('config da marca e do endereço', () => {
  it('lê o gravado conferindo modelo e chaves', () => {
    expect(configDaMarca({ temaPdf: 'ELEGANTE', opcoesPdf: { cores: { destaque: 'AZUL', outra: 1 }, lixo: {} } })).toEqual({
      modelo: 'ELEGANTE',
      sobrescritas: { cores: { destaque: 'AZUL' } },
    });
    expect(configDaMarca({ temaPdf: null, opcoesPdf: null })).toEqual({ modelo: 'CLASSICO', sobrescritas: {} });
  });
  it('?modelo= só aceita um id da lista', () => {
    expect(modeloDoEndereco('ESPORTIVO')).toBe('ESPORTIVO');
    expect(modeloDoEndereco('esportivo')).toBeNull();
    expect(modeloDoEndereco(undefined)).toBeNull();
    expect(modeloDoEndereco(['CLASSICO'])).toBeNull();
  });
  it('mesmaConfig não depende da ordem das chaves e vê a troca de modelo', () => {
    const a = { modelo: 'CLASSICO' as const, sobrescritas: { texto: { tamanho: 'G' as const, fonte: 'SERIFADA' as const } } };
    const b = { modelo: 'CLASSICO' as const, sobrescritas: { texto: { fonte: 'SERIFADA' as const, tamanho: 'G' as const } } };
    expect(mesmaConfig(a, b)).toBe(true);
    expect(mesmaConfig(a, { ...b, modelo: 'COMPACTO' })).toBe(false);
    expect(mesmaConfig(trocarModelo('CLASSICO'), definir(trocarModelo('CLASSICO'), 'tabelas', 'estilo', 'LINHAS'))).toBe(true);
  });
});

describe('rascunhoDepoisDeSalvar', () => {
  const alvo = definir(trocarModelo('CLASSICO'), 'texto', 'tamanho', 'G');
  it('rascunho igual ao que foi salvo some', () => {
    expect(rascunhoDepoisDeSalvar(definir(trocarModelo('CLASSICO'), 'texto', 'tamanho', 'G'), alvo)).toBeNull();
  });
  it('rascunho que mudou durante o salvar continua', () => {
    const mexido = definir(alvo, 'texto', 'fonte', 'SERIFADA');
    expect(rascunhoDepoisDeSalvar(mexido, alvo)).toBe(mexido);
    expect(rascunhoDepoisDeSalvar(trocarModelo('COMPACTO'), alvo)).toEqual(trocarModelo('COMPACTO'));
  });
  it('sem rascunho continua sem rascunho', () => {
    expect(rascunhoDepoisDeSalvar(null, alvo)).toBeNull();
  });
});

describe('resumoDoGrupo', () => {
  it('descreve o valor escolhido de cada grupo', () => {
    const config = trocarModelo('CLASSICO');
    const valores = resolver(config.modelo, config.sobrescritas);
    expect(resumoDoGrupo('modelo', config, valores)).toBe('Clássico');
    expect(resumoDoGrupo('cores', config, valores)).toBe('Destaque: Cor da marca');
    expect(resumoDoGrupo('texto', config, valores)).toBe('Sem serifa · texto médio');
    expect(resumoDoGrupo('cabecalho', config, valores)).toBe('Faixa cheia · logo à esquerda · média');
    expect(resumoDoGrupo('tabelas', config, valores)).toBe('Linhas · normal');
  });
  it('avisa quando o nome da consultoria sai do cabeçalho', () => {
    const config = definir(trocarModelo('ESPORTIVO'), 'cabecalho', 'mostrarNome', false);
    expect(resumoDoGrupo('cabecalho', config, resolver(config.modelo, config.sobrescritas))).toBe('Cartão · logo à esquerda · grande · sem o nome');
  });
});

describe('mensagemDoErroDeCampo', () => {
  it('põe o grupo na frente da mensagem do primeiro campo', () => {
    expect(mensagemDoErroDeCampo([{ field: 'opcoes.cabecalho.estilo', message: 'Valor não aceito.' }], 'Geral.')).toBe('Cabeçalho: Valor não aceito.');
    expect(mensagemDoErroDeCampo([{ field: 'modelo', message: 'Modelo desconhecido.' }], 'Geral.')).toBe('Modelo desconhecido.');
    expect(mensagemDoErroDeCampo([], 'Geral.')).toBe('Geral.');
  });
});
