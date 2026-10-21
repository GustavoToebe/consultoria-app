import { chaveDeTipo, mensagemTipoETecnica, nomeDeTecnica, tecnicaHomonima } from './tiposDeSerie';

describe('tiposDeSerie', () => {
  it('reconhece nome de técnica, sem caixa, hífen, espaço repetido ou acento', () => {
    for (const nome of ['Cluster', 'rest-pause', 'Rest  pause', 'DROP SET', 'Drop-set', 'Clúster', 'Restpause']) {
      expect(nomeDeTecnica(nome)).toBe(true);
    }
  });

  it('não confunde tipo de série com técnica', () => {
    for (const nome of ['Top set', 'Back off', 'Cardio', 'WS', 'Drop', 'Cluster A']) {
      expect(nomeDeTecnica(nome)).toBe(false);
    }
  });

  it('chave de comparação ignora caixa, hífen e espaços extras', () => {
    expect(chaveDeTipo('Rest-Pause')).toBe('rest pause');
    expect(chaveDeTipo('  Drop   set ')).toBe('drop set');
  });

  it('diz a técnica de um nome homônimo, ou nada', () => {
    expect(tecnicaHomonima('Drop-set')).toBe('DROP_SET');
    expect(tecnicaHomonima('rest pause')).toBe('REST_PAUSE');
    expect(tecnicaHomonima('WS')).toBeNull();
  });

  it('a mensagem de recusa nomeia o tipo sem espaço sobrando', () => {
    expect(mensagemTipoETecnica(' Cluster ')).toMatch(/^"Cluster" é uma técnica/);
  });
});
