import { definir, resolver, trocarModelo } from './configuracaoPdf';
import {
  arranjoDoEditor,
  configDaMarca,
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
  it('1024 a < 1600: painel 360 e folha ajustada', () => {
    expect(arranjoDoEditor(1024)).toEqual({ tipo: 'editor', painel: 360, zoomPadrao: 'AJUSTAR' });
    expect(arranjoDoEditor(1599)).toEqual({ tipo: 'editor', painel: 360, zoomPadrao: 'AJUSTAR' });
  });
  it('1600 a < 2400: painel 400 e 100%; a partir de 2400: painel 440 e 100%', () => {
    expect(arranjoDoEditor(1600)).toEqual({ tipo: 'editor', painel: 400, zoomPadrao: 'CEM' });
    expect(arranjoDoEditor(2399)).toEqual({ tipo: 'editor', painel: 400, zoomPadrao: 'CEM' });
    expect(arranjoDoEditor(2400)).toEqual({ tipo: 'editor', painel: 440, zoomPadrao: 'CEM' });
  });
});

describe('folhaNaTela', () => {
  it('Ajustar acompanha o espaço, com piso de 60% e teto de 100%', () => {
    expect(folhaNaTela(600, 'AJUSTAR')).toEqual({ largura: 600, rolaDeLado: false, zoomMuda: true });
    expect(folhaNaTela(300, 'AJUSTAR')).toEqual({ largura: 476, rolaDeLado: true, zoomMuda: true });
    expect(folhaNaTela(1200, 'AJUSTAR')).toEqual({ largura: 794, rolaDeLado: false, zoomMuda: false });
  });
  it('100% é sempre a A4 real; num espaço menor, rola de lado', () => {
    expect(folhaNaTela(600, 'CEM')).toEqual({ largura: 794, rolaDeLado: true, zoomMuda: true });
    expect(folhaNaTela(794, 'CEM')).toEqual({ largura: 794, rolaDeLado: false, zoomMuda: false });
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
