import { chaveDeTipo, codigoDoNome, codigoDoNovoTipo, codigoValido, mensagemTipoECombinacao, mensagemTipoETecnica, nomeDeCombinacao, nomeDeTecnica } from './tiposDeSerie';

describe('tiposDeSerie', () => {
  it('reconhece nome de técnica, sem caixa, hífen, espaço repetido ou acento', () => {
    for (const nome of ['Cluster', 'rest-pause', 'Rest  pause', 'DROP SET', 'Drop-set', 'Clúster', 'Restpause', 'Myo-reps', 'Partial reps', 'Forced reps', 'Negativa', 'Super-slow', '21s', 'Pirâmide crescente', 'GVT (10×10)', 'FST-7', 'EMOM']) {
      expect(nomeDeTecnica(nome)).toBe(true);
    }
  });

  it('não confunde tipo de série com técnica', () => {
    for (const nome of ['Top set', 'Back off', 'Cardio', 'WS', 'Drop', 'Cluster A', 'Pirâmide']) {
      expect(nomeDeTecnica(nome)).toBe(false);
    }
  });

  it('reconhece nome de combinação de exercícios', () => {
    for (const nome of ['Superset', 'Super-set', 'Agonista/antagonista'.replace('/', ' '), 'Tri-set', 'Giant set', 'Circuito', 'Pré-exaustão', 'Pós exaustão']) {
      expect(nomeDeCombinacao(nome)).toBe(true);
    }
    expect(nomeDeCombinacao('Back off')).toBe(false);
  });

  it('chave de comparação ignora caixa, hífen e espaços extras', () => {
    expect(chaveDeTipo('Rest-Pause')).toBe('rest pause');
    expect(chaveDeTipo('  Drop   set ')).toBe('drop set');
  });

  it('as mensagens de recusa nomeiam o tipo sem espaço sobrando', () => {
    expect(mensagemTipoETecnica(' Cluster ')).toMatch(/^"Cluster" é uma técnica/);
    expect(mensagemTipoECombinacao(' Circuito ')).toMatch(/^"Circuito" é uma combinação/);
  });

  it('código: formato válido, gerado do nome e único', () => {
    expect(codigoValido('BACK_OFF')).toBe(true);
    for (const ruim of ['', 'back off', 'A-B', 'a'.repeat(31), null, undefined]) expect(codigoValido(ruim)).toBe(false);
    expect(codigoDoNome('Série de ação')).toBe('SERIE_DE_ACAO');
    expect(codigoDoNome('---')).toBe('TIPO');
    expect(codigoDoNome('x'.repeat(40))).toHaveLength(30);
    expect(codigoDoNovoTipo('Back off', ['BACK_OFF'])).toBe('BACK_OFF_2');
    expect(codigoDoNovoTipo('Back off', ['BACK_OFF', 'BACK_OFF_2'])).toBe('BACK_OFF_3');
    expect(codigoDoNovoTipo('x'.repeat(40), ['X'.repeat(30)])).toHaveLength(30);
  });
});
