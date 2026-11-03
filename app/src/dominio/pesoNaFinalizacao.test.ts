import { numeroDaTela } from './formatos';
import {
  corpoDaFinalizacao,
  dataDoPesoDaAtualizacao,
  dataInicialDoPeso,
  type FormularioDaFinalizacao,
  notaDoPesoJaRegistrado,
  pesoDaAtualizacao,
  pesoSugeridoSemEdicao,
  substituiPesoDaAtualizacao,
  sugestaoParaPreencher,
  textoDoPesoDaAtualizacao,
} from './pesoNaFinalizacao';

// Pesos fictícios.
const PESOS = [
  { id: 'r1', data: '2026-10-05', pesoKg: 83.1, variacao: null, observacao: null },
  { id: 'r2', data: '2026-10-20', pesoKg: 82.4, variacao: -0.7, observacao: null },
];

describe('dataDoPesoDaAtualizacao', () => {
  it('é a data da atualização depois de enviada', () => {
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: '2026-10-20', enviadaEm: '2026-10-20T10:00:00Z' })).toBe('2026-10-20');
  });

  it('não existe com a atualização aberta, sem data ou sem atualização', () => {
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: '2026-10-20', enviadaEm: null })).toBeNull();
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: null, enviadaEm: '2026-10-20T10:00:00Z' })).toBeNull();
    expect(dataDoPesoDaAtualizacao(null)).toBeNull();
    expect(dataDoPesoDaAtualizacao(undefined)).toBeNull();
  });
});

describe('pesoDaAtualizacao', () => {
  it('acha o peso registrado na data da atualização', () => {
    expect(pesoDaAtualizacao(PESOS, '2026-10-20')).toBe(PESOS[1]);
  });

  it('sem peso naquele dia, sem data ou sem lista: null', () => {
    expect(pesoDaAtualizacao(PESOS, '2026-10-21')).toBeNull();
    expect(pesoDaAtualizacao(PESOS, null)).toBeNull();
    expect(pesoDaAtualizacao([], '2026-10-20')).toBeNull();
    expect(pesoDaAtualizacao(undefined, '2026-10-20')).toBeNull();
  });
});

describe('textoDoPesoDaAtualizacao', () => {
  it('peso com vírgula e data curta no ano corrente', () => {
    expect(textoDoPesoDaAtualizacao(PESOS[1], '2026-10-31')).toBe('Peso já registrado na data da atualização: 82,4 kg em 20/10');
  });

  it('leva o ano quando é outro', () => {
    expect(textoDoPesoDaAtualizacao({ data: '2025-12-30', pesoKg: 80 }, '2026-01-05')).toBe('Peso já registrado na data da atualização: 80 kg em 30/12/2025');
  });
});

describe('substituiPesoDaAtualizacao', () => {
  const registrado = PESOS[1];

  it('avisa com peso digitado na mesma data do peso da atualização', () => {
    expect(substituiPesoDaAtualizacao('2026-10-20', registrado, 81.9)).toBe(true);
  });

  it('não avisa em outra data, sem peso digitado, sem peso registrado ou sem data', () => {
    expect(substituiPesoDaAtualizacao('2026-10-31', registrado, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao('2026-10-20', registrado, null)).toBe(false);
    expect(substituiPesoDaAtualizacao('2026-10-20', null, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao(null, registrado, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao(undefined, registrado, 81.9)).toBe(false);
  });
});

describe('dataInicialDoPeso', () => {
  it('com peso sugerido, nasce com a data da atualização', () => {
    expect(dataInicialDoPeso({ pesoKg: 90, data: '2026-10-20' }, '2026-11-02')).toBe('2026-10-20');
    expect(dataInicialDoPeso({ pesoKg: 90, data: '2026-10-20T00:00:00' }, '2026-11-02')).toBe('2026-10-20');
  });

  it('sem sugestão (ou sem peso, ou sem data), nasce hoje', () => {
    expect(dataInicialDoPeso(null, '2026-11-02')).toBe('2026-11-02');
    expect(dataInicialDoPeso(undefined, '2026-11-02')).toBe('2026-11-02');
    expect(dataInicialDoPeso({ pesoKg: null, data: '2026-10-20' }, '2026-11-02')).toBe('2026-11-02');
    expect(dataInicialDoPeso({ pesoKg: 90, data: null }, '2026-11-02')).toBe('2026-11-02');
  });
});

describe('corpoDaFinalizacao (D8: peso sugerido sem edição não é gravado de novo)', () => {
  // Formulário como nasce com sugestão: peso da atualização (90 kg), data da atualização, sem observação.
  const intacto: FormularioDaFinalizacao = {
    podeGravarPeso: true,
    sugerido: 90,
    peso: 90,
    dataIso: '2026-10-20',
    dataInicial: '2026-10-20',
    observacao: '',
  };
  const SEM_PESO = { data: null, pesoKg: null, observacao: null };

  it('sem edição: finaliza sem peso (a atualização já o gravou)', () => {
    expect(pesoSugeridoSemEdicao(intacto)).toBe(true);
    expect(corpoDaFinalizacao(intacto)).toEqual(SEM_PESO);
  });

  it('"90" e "90,0" são o mesmo valor: continua sem edição', () => {
    const digitado = numeroDaTela('90,0');
    expect(digitado).toBe(90);
    expect(corpoDaFinalizacao({ ...intacto, peso: digitado ?? null })).toEqual(SEM_PESO);
    expect(corpoDaFinalizacao({ ...intacto, sugerido: 82.4, peso: numeroDaTela('82,40') ?? null })).toEqual(SEM_PESO);
  });

  it('valor editado: grava o peso na data do campo (a da atualização: substitui o registro dela)', () => {
    expect(pesoSugeridoSemEdicao({ ...intacto, peso: 89.5 })).toBe(false);
    expect(corpoDaFinalizacao({ ...intacto, peso: 89.5 })).toEqual({ data: '2026-10-20', pesoKg: 89.5, observacao: null });
    expect(substituiPesoDaAtualizacao('2026-10-20', PESOS[1], 89.5)).toBe(true);
  });

  it('só a data editada: grava o mesmo peso na data nova, sem substituir', () => {
    expect(corpoDaFinalizacao({ ...intacto, dataIso: '2026-10-31' })).toEqual({ data: '2026-10-31', pesoKg: 90, observacao: null });
    expect(substituiPesoDaAtualizacao('2026-10-31', PESOS[1], 90)).toBe(false);
  });

  it('só a observação editada: grava na data da atualização, substituindo o registro dela', () => {
    const comObservacao = { ...intacto, observacao: '  Em jejum  ' };
    expect(pesoSugeridoSemEdicao(comObservacao)).toBe(false);
    expect(corpoDaFinalizacao(comObservacao)).toEqual({ data: '2026-10-20', pesoKg: 90, observacao: 'Em jejum' });
    expect(substituiPesoDaAtualizacao(comObservacao.dataIso, PESOS[1], comObservacao.peso)).toBe(true);
  });

  it('observação só com espaços não conta como edição', () => {
    expect(corpoDaFinalizacao({ ...intacto, observacao: '   ' })).toEqual(SEM_PESO);
  });

  it('sem sugestão: igual a antes (data nasce hoje; peso digitado vai; campo vazio não)', () => {
    const semSugestao = { ...intacto, sugerido: null, dataIso: '2026-11-02', dataInicial: dataInicialDoPeso(null, '2026-11-02') };
    expect(pesoSugeridoSemEdicao(semSugestao)).toBe(false);
    expect(corpoDaFinalizacao(semSugestao)).toEqual({ data: '2026-11-02', pesoKg: 90, observacao: null });
    expect(corpoDaFinalizacao({ ...semSugestao, peso: null })).toEqual(SEM_PESO);
  });

  it('campo apagado ou sem permissão para gravar: sem peso', () => {
    expect(corpoDaFinalizacao({ ...intacto, peso: null })).toEqual(SEM_PESO);
    expect(corpoDaFinalizacao({ ...intacto, peso: 89.5, podeGravarPeso: false })).toEqual(SEM_PESO);
  });
});

describe('sugestaoParaPreencher (a sugestão que chega depois não sobrescreve o que a pessoa já digitou)', () => {
  const sugestao = { pesoKg: 90, data: '2026-10-20' };

  it('sem ter mexido antes de ela chegar, preenche', () => {
    expect(sugestaoParaPreencher(sugestao, false)).toBe(sugestao);
  });

  it('mexeu em peso, data ou observação antes: nenhum campo recebe a sugestão', () => {
    expect(sugestaoParaPreencher(sugestao, true)).toBeNull();
  });

  it('sem sugestão, nada a preencher', () => {
    expect(sugestaoParaPreencher(null, false)).toBeNull();
    expect(sugestaoParaPreencher(undefined, false)).toBeNull();
  });

  it('peso digitado antes: a data nasce hoje (não pula para a da atualização) e o peso digitado vai como peso novo', () => {
    const aplicada = sugestaoParaPreencher(sugestao, true);
    const dataInicial = dataInicialDoPeso(aplicada, '2026-11-02');
    expect(dataInicial).toBe('2026-11-02');
    const f: FormularioDaFinalizacao = {
      podeGravarPeso: true, sugerido: aplicada?.pesoKg ?? null, peso: 88, dataIso: dataInicial, dataInicial, observacao: '',
    };
    expect(pesoSugeridoSemEdicao(f)).toBe(false);
    expect(corpoDaFinalizacao(f)).toEqual({ data: '2026-11-02', pesoKg: 88, observacao: null });
  });
});

describe('notaDoPesoJaRegistrado', () => {
  it('peso e data curta no ano corrente', () => {
    expect(notaDoPesoJaRegistrado(90, '2026-10-20', '2026-11-02')).toBe('90 kg, da atualização de 20/10 (já registrado)');
    expect(notaDoPesoJaRegistrado(82.4, '2026-10-20T00:00:00', '2026-11-02')).toBe('82,4 kg, da atualização de 20/10 (já registrado)');
  });

  it('leva o ano quando é outro; sem data, só "da atualização"', () => {
    expect(notaDoPesoJaRegistrado(90, '2025-12-30', '2026-01-05')).toBe('90 kg, da atualização de 30/12/2025 (já registrado)');
    expect(notaDoPesoJaRegistrado(90, null, '2026-11-02')).toBe('90 kg, da atualização (já registrado)');
  });
});
