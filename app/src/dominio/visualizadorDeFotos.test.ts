import type { FotoDaLinha } from '../api/tipos';
import {
  alturaComum,
  caixaQueCabe,
  fotosEmOrdem,
  grupoDaFoto,
  indiceDaFoto,
  parPadrao,
  passoDoDeslize,
  pesoDaFoto,
  quemEnviou,
  textoDaDiferencaDoPar,
  textoDaPosicao,
  vizinho,
} from './visualizadorDeFotos';

const foto = (fotoId: string, data: string, extra: Partial<FotoDaLinha> = {}): FotoDaLinha => ({
  fotoId, origem: 'ATUALIZACAO', origemId: `u-${data}`, data, perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 80, ...extra,
});

describe('ordem e navegação', () => {
  const fotos = fotosEmOrdem([
    foto('c', '2026-03-01'),
    foto('b2', '2026-02-01', { ordem: 1, perguntaId: 'lado', posicao: 'Lado' }),
    foto('a', '2026-01-01', { origem: 'ANAMNESE' }),
    foto('b1', '2026-02-01'),
  ]);

  it('vai da mais antiga à mais nova, na ordem do envio dentro da data', () => {
    expect(fotos.map((f) => f.fotoId)).toEqual(['a', 'b1', 'b2', 'c']);
  });

  it('acha o índice e volta para a primeira se a foto sumiu', () => {
    expect(indiceDaFoto(fotos, 'b2')).toBe(2);
    expect(indiceDaFoto(fotos, 'nao-existe')).toBe(0);
  });

  it('não dá a volta nas pontas', () => {
    expect(vizinho(0, 4, -1)).toBeNull();
    expect(vizinho(0, 4, 1)).toBe(1);
    expect(vizinho(3, 4, 1)).toBeNull();
    expect(vizinho(3, 4, -1)).toBe(2);
  });

  it('mostra a posição contando de 1', () => {
    expect(textoDaPosicao(2, 12)).toBe('3 de 12');
  });

  it('deslize curto não troca; para a esquerda vai à próxima', () => {
    expect(passoDoDeslize(-20)).toBe(0);
    expect(passoDoDeslize(-60)).toBe(1);
    expect(passoDoDeslize(60)).toBe(-1);
  });

  it('diz quem enviou e o peso, com traço sem peso', () => {
    expect(quemEnviou(fotos[0])).toBe('Aluno, na anamnese');
    expect(quemEnviou(fotos[1])).toBe('Aluno, na atualização');
    expect(pesoDaFoto(foto('x', '2026-01-01', { pesoKg: 79.5 }))).toBe('79,5 kg');
    expect(pesoDaFoto(foto('x', '2026-01-01', { pesoKg: null }))).toBe('—');
  });

  it('o par padrão é a primeira e a mais recente data do mesmo ângulo', () => {
    const grupo = grupoDaFoto(fotos, 'b1');
    expect(grupo?.rotulo).toBe('Frente');
    expect(parPadrao(grupo)).toEqual({ antes: '2026-01-01', depois: '2026-03-01' });
    expect(parPadrao(grupoDaFoto(fotos, 'b2'))).toBeNull();
    expect(parPadrao(undefined)).toBeNull();
  });
});

describe('textoDaDiferencaDoPar', () => {
  it('conta os dias e a variação do peso da mais antiga para a mais nova', () => {
    const antes = foto('a', '2026-01-01', { pesoKg: 80 });
    const depois = foto('b', '2026-03-04', { pesoKg: 77.6 });
    expect(textoDaDiferencaDoPar(antes, depois)).toBe('62 dias · peso −2,4 kg');
    expect(textoDaDiferencaDoPar(depois, antes)).toBe('62 dias · peso −2,4 kg');
  });

  it('singular, ganho, sem variação e sem peso', () => {
    expect(textoDaDiferencaDoPar(foto('a', '2026-01-01', { pesoKg: 80 }), foto('b', '2026-01-02', { pesoKg: 80.3 }))).toBe('1 dia · peso +0,3 kg');
    expect(textoDaDiferencaDoPar(foto('a', '2026-01-01', { pesoKg: 79.3 }), foto('b', '2026-01-11', { pesoKg: 79.3 }))).toBe('10 dias · peso 0,0 kg');
    expect(textoDaDiferencaDoPar(foto('a', '2026-01-01', { pesoKg: null }), foto('b', '2026-01-11'))).toBe('10 dias · peso —');
    expect(textoDaDiferencaDoPar(foto('a', '2026-01-01'), foto('b', '2026-01-01'))).toBe('Mesma data · peso 0,0 kg');
  });
});

describe('caixas da foto', () => {
  it('a foto em retrato cabe pela altura e a de paisagem pela largura', () => {
    expect(caixaQueCabe(1000, 600, 3 / 4)).toEqual({ largura: 450, altura: 600 });
    expect(caixaQueCabe(300, 600, 4 / 3)).toEqual({ largura: 300, altura: 225 });
    expect(caixaQueCabe(300, 600, null)).toEqual({ largura: 300, altura: 400 });
  });

  it('o par fica da mesma altura, limitado pela foto mais larga', () => {
    expect(alturaComum(300, 1000, [3 / 4, 3 / 4])).toBe(400);
    expect(alturaComum(300, 1000, [3 / 4, 1])).toBe(300);
    expect(alturaComum(300, 200, [null, null])).toBe(200);
  });
});
