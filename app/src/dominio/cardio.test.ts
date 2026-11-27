import type { Cardio } from '../api/tipos';
import {
  anuncioDaFase, avisoForaDaFaixa, blocoContinuo, definicaoDoProtocolo, erroDoBloco, esforcoDaFase, fasesDoBloco, iniciarTimer,
  modoDoBloco, mostraMedida, nomeDaFase, padraoDoProtocolo, partesDaPrevia, pausarTimer, previaDoBloco, previaParaOAluno,
  PROTOCOLOS, pularFase, relogioDoTimer, resumoDaLista, resumoDoBloco, retomarTimer, ritmoTexto, segundosDoTexto, tempoCurto,
  tempoTotalDoBloco, tempoTotalDoCardio, textoDoAquecimento, voltaDaFase,
} from './cardio';

const continuo = (parte: Partial<Cardio> = {}): Cardio => ({ ...blocoContinuo(), ...parte });
const comIntervalos = (c: Cardio, trabalhoSeg: number | null, descansoSeg: number | null, voltas: number | null = c.intervalos?.voltas ?? null): Cardio => ({
  ...c, intervalos: { trabalhoSeg, descansoSeg, voltas },
});

describe('protocolos', () => {
  it('traz os cinco, com as definições do pedido', () => {
    expect(PROTOCOLOS.map((p) => p.codigo)).toEqual(['CURTO', 'LONGO', 'SIT', 'RST', 'PERSONALIZADO']);
    expect(PROTOCOLOS.map((p) => p.rotulo)).toEqual([
      'HIIT de intervalo curto', 'HIIT de intervalo longo', 'SIT (Sprint Interval Training)', 'RST (Repeated Sprint Training)', 'Personalizado',
    ]);
    expect(definicaoDoProtocolo('SIT').definicao).toBe('Tiros all-out de 20–30 s com descansos longos de 2–4 min para recuperação total.');
    expect(definicaoDoProtocolo(null).codigo).toBe('PERSONALIZADO');
  });

  it('o padrão de cada protocolo fica dentro da própria faixa e não tem erro', () => {
    for (const p of PROTOCOLOS) {
      const b = padraoDoProtocolo(p.codigo);
      expect(avisoForaDaFaixa(b)).toBeNull();
      if (p.padrao) expect(erroDoBloco(b)).toEqual({});
    }
  });

  it('preenche os valores típicos e limpa o contínuo', () => {
    const b = padraoDoProtocolo('LONGO', continuo({ duracaoMin: 30, ritmo: '6 min/km' }));
    expect(b).toMatchObject({ modo: 'INTERVALADO', protocolo: 'LONGO', duracaoMin: null, ritmo: null, zona: 4, intervalos: { trabalhoSeg: 180, descansoSeg: 120, voltas: 5 } });
  });

  it('personalizado guarda o que já havia', () => {
    const sit = padraoDoProtocolo('SIT');
    expect(padraoDoProtocolo('PERSONALIZADO', sit)).toMatchObject({ protocolo: 'PERSONALIZADO', esforcoMaximo: true, intervalos: sit.intervalos });
  });
});

describe('tempo e resumos (exemplos do pedido)', () => {
  it('HIIT curto padrão: "10 × 30 s / 30 s · ~20 min no total"', () => {
    const b = padraoDoProtocolo('CURTO');
    // 5 min + 10 × 30 s + 9 × 30 s + 5 min = 1170 s (19,5 min → ~20)
    expect(tempoTotalDoBloco(b)).toBe(1170);
    expect(resumoDoBloco(b)).toBe('10 × 30 s / 30 s · ~20 min no total');
  });

  it('SIT padrão: lista e prévia com ~25 min', () => {
    const b = padraoDoProtocolo('SIT');
    // 4 min + 6 × 30 s + 5 × 3 min + 3 min = 1500 s
    expect(tempoTotalDoBloco(b)).toBe(1500);
    expect(resumoDaLista([b])).toBe('SIT · 6 × 30 s · ~25 min');
    expect(previaDoBloco(b)).toBe('SIT · 6 × 30 s all-out / 3 min · ~25 min');
  });

  it('dois blocos: "2 blocos · ~30 min"', () => {
    const blocos = [continuo({ duracaoMin: 10, zona: 2 }), padraoDoProtocolo('CURTO')];
    expect(tempoTotalDoCardio(blocos)).toBe(1770);
    expect(resumoDaLista(blocos)).toBe('2 blocos · ~30 min');
    expect(previaParaOAluno(blocos)).toEqual(['Contínuo · 10 min · Zona 2', 'HIIT curto · 10 × 30 s / 30 s · Zona 5 · ~20 min']);
  });

  it('bloco sem tempo tira o total (nunca um total parcial)', () => {
    const blocos = [continuo({ distanciaKm: 5 }), padraoDoProtocolo('CURTO')];
    expect(tempoTotalDoCardio(blocos)).toBeNull();
    expect(resumoDaLista(blocos)).toBe('2 blocos');
    expect(tempoTotalDoCardio([])).toBeNull();
  });

  it('contínuo', () => {
    const b = continuo({ duracaoMin: 30, distanciaKm: 5.5, ritmo: '6 min/km', zona: 2 });
    expect(resumoDoBloco(b)).toBe('30 min · 5,5 km');
    expect(resumoDaLista([b])).toBe('Contínuo · 30 min · 5,5 km');
    expect(previaDoBloco(b)).toBe('Contínuo · 30 min · 5,5 km · 6 min/km · Zona 2');
    expect(resumoDoBloco(continuo())).toBeNull();
  });

  it('tipo da recuperação só na prévia do aluno', () => {
    const b = { ...padraoDoProtocolo('SIT'), recuperacaoTipo: 'PASSIVA' as const };
    expect(previaDoBloco(b)).toBe('SIT · 6 × 30 s all-out / 3 min (passiva) · ~25 min');
    expect(resumoDoBloco(b)).toBe('6 × 30 s / 3 min · ~25 min no total');
  });

  it('timer: sem recuperação depois do último estímulo e sem fase de 0 s', () => {
    const b = { ...comIntervalos(padraoDoProtocolo('RST'), 6, 30, 2), aquecimentoSeg: 0 };
    expect(fasesDoBloco(b)).toEqual([
      { fase: 'ESTIMULO', segundos: 6, volta: 1 },
      { fase: 'RECUPERACAO', segundos: 30, volta: 1 },
      { fase: 'ESTIMULO', segundos: 6, volta: 2 },
      { fase: 'DESAQUECIMENTO', segundos: 300 },
    ]);
    expect(fasesDoBloco(comIntervalos(b, null, 30))).toEqual([]);
  });

  it('formato curto do tempo', () => {
    expect([30, 60, 90, 180].map(tempoCurto)).toEqual(['30 s', '1 min', '1 min 30 s', '3 min']);
  });
});

describe('dado antigo (sem modo)', () => {
  const antigo: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: 4, intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 8 } };

  it('com intervalos é intervalado personalizado, sem aviso', () => {
    expect(modoDoBloco(antigo)).toBe('INTERVALADO');
    expect(avisoForaDaFaixa(antigo)).toBeNull();
    expect(resumoDaLista([antigo])).toBe('Intervalado · 8 × 30 s · ~11 min');
  });

  it('com duração junto dos intervalos usa a duração no total', () => {
    expect(tempoTotalDoBloco({ ...antigo, duracaoMin: 30 })).toBe(1800);
  });

  it('intervalado antigo segue as regras antigas; sem intervalos é o contínuo de sempre', () => {
    expect(erroDoBloco({ ...antigo, duracaoMin: 30, intervalos: { trabalhoSeg: 0, descansoSeg: null, voltas: 8 } })).toEqual({ 'intervalos.trabalhoSeg': 'Tempo de esforço de 1 a 3600 segundos.' });
    expect(erroDoBloco({ duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null })).toEqual({ duracaoMin: 'Informe a duração ou a distância.' });
    expect(modoDoBloco({ duracaoMin: 20 })).toBe('CONTINUO');
  });

  it('o bloco contínuo novo não leva modo (o pacote do app instalado continua aceitando)', () => {
    expect(Object.keys(blocoContinuo()).sort()).toEqual(['distanciaKm', 'duracaoMin', 'intervalos', 'ritmo', 'zona']);
  });

  it('modo CONTINUO explícito com intervalos é recusado', () => {
    expect(erroDoBloco({ ...antigo, modo: 'CONTINUO', duracaoMin: 20 })).toEqual({ intervalos: 'Só vale no intervalado.' });
  });
});

describe('aviso fora da faixa', () => {
  it('SIT com estímulo longo', () => {
    expect(avisoForaDaFaixa(comIntervalos(padraoDoProtocolo('SIT'), 45, 180))).toBe('Fora da faixa do SIT (estímulo de 20 a 30 s)');
  });

  it('junta as partes num aviso só', () => {
    const b = { ...comIntervalos(padraoDoProtocolo('RST'), 15, 90), esforcoMaximo: null, zona: 5 };
    expect(avisoForaDaFaixa(b)).toBe('Fora da faixa do RST (estímulo de 3 a 10 s; recuperação abaixo de 60 s; esforço máximo)');
  });

  it('HIIT curto e longo', () => {
    expect(avisoForaDaFaixa(comIntervalos(padraoDoProtocolo('CURTO'), 90, 30))).toBe('Fora da faixa do HIIT curto (estímulo de até 60 s)');
    expect(avisoForaDaFaixa(comIntervalos(padraoDoProtocolo('CURTO'), 60, 60))).toBeNull();
    expect(avisoForaDaFaixa(comIntervalos(padraoDoProtocolo('LONGO'), 60, 60))).toBe('Fora da faixa do HIIT longo (estímulo acima de 1 min; recuperação acima de 60 s)');
  });

  it('personalizado, contínuo e campo vazio não avisam', () => {
    expect(avisoForaDaFaixa(comIntervalos(padraoDoProtocolo('PERSONALIZADO'), 600, 0, 1))).toBeNull();
    expect(avisoForaDaFaixa(continuo({ duracaoMin: 30 }))).toBeNull();
    expect(avisoForaDaFaixa(comIntervalos({ ...padraoDoProtocolo('SIT') }, null, null))).toBeNull();
  });
});

describe('erroDoBloco', () => {
  it('contínuo: basta duração ou distância, erro só na duração', () => {
    expect(erroDoBloco(continuo())).toEqual({ duracaoMin: 'Informe a duração ou a distância.' });
    expect(erroDoBloco(continuo({ distanciaKm: 5 }))).toEqual({});
    expect(erroDoBloco(continuo({ duracaoMin: 20 }))).toEqual({});
  });

  it('contínuo: limites e campos do intervalado', () => {
    expect(erroDoBloco(continuo({ duracaoMin: 601, distanciaKm: 0, zona: 6, protocolo: 'SIT', esforcoMaximo: true }))).toEqual({
      duracaoMin: 'Duração de 1 a 600 minutos.',
      distanciaKm: 'Distância maior que zero e até 1000 km.',
      zona: 'Zona de 1 a 5.',
      protocolo: 'Só vale no intervalado.',
      esforcoMaximo: 'Só vale no intervalado.',
    });
  });

  it('intervalado: estímulo, voltas, recuperação, aquecimento e esforço', () => {
    const b: Cardio = { ...padraoDoProtocolo('CURTO'), aquecimentoSeg: 3601, duracaoMin: 10, esforcoMaximo: true, intervalos: { trabalhoSeg: 0, descansoSeg: -1, voltas: 0 } };
    expect(erroDoBloco(b)).toEqual({
      duracaoMin: 'Só vale no contínuo.',
      'intervalos.trabalhoSeg': 'Estímulo de 1 s a 60 min.',
      'intervalos.descansoSeg': 'Recuperação de 0 a 60 min.',
      'intervalos.voltas': 'Voltas de 1 a 100.',
      aquecimentoSeg: 'Aquecimento de 0 a 60 min.',
      esforcoMaximo: 'Use a zona ou o esforço máximo, não os dois.',
    });
  });

  it('intervalado: recuperação 0 ou vazia vale', () => {
    expect(erroDoBloco(comIntervalos(padraoDoProtocolo('CURTO'), 30, 0))).toEqual({});
    expect(erroDoBloco(comIntervalos(padraoDoProtocolo('CURTO'), 30, null))).toEqual({});
  });
});

describe('entrada de tempo e ritmo', () => {
  it.each([
    ['75', 's', 75], ['75', 'min', 4500], ['1:30', 's', 90], ['2 min', 's', 120], ['2min', 's', 120],
    ['90 s', 'min', 90], ['1 min 30 s', 's', 90], ['1min30', 's', 90], ['1,5 min', 's', 90], ['5', 'min', 300],
  ] as const)('"%s" (%s) = %d s', (texto, unidade, esperado) => {
    expect(segundosDoTexto(texto, unidade)).toBe(esperado);
  });

  it('vazio e ilegível = nulo', () => {
    expect(segundosDoTexto('  ', 's')).toBeNull();
    expect(segundosDoTexto('abc', 's')).toBeNull();
    expect(segundosDoTexto('1:75', 's')).toBeNull();
  });

  it('ritmo', () => {
    expect(ritmoTexto('6')).toBe('6 min/km');
    expect(ritmoTexto(' 5:30 ')).toBe('5:30 min/km');
    expect(ritmoTexto('6 min/km')).toBe('6 min/km');
    expect(ritmoTexto('leve')).toBe('leve');
    expect(ritmoTexto('')).toBeNull();
  });
});

describe('medidas da biblioteca', () => {
  it('esconde a medida desmarcada, nunca um valor já gravado', () => {
    expect(mostraMedida('DISTANCIA', ['RITMO'], continuo())).toBe(false);
    expect(mostraMedida('DISTANCIA', ['RITMO'], continuo({ distanciaKm: 3 }))).toBe(true);
    expect(mostraMedida('RITMO', undefined, continuo())).toBe(true);
  });
});

describe('cartão do aluno', () => {
  it('a primeira parte da prévia é o protocolo (vai no cabeçalho do bloco)', () => {
    const sit = { ...padraoDoProtocolo('SIT'), recuperacaoTipo: 'PASSIVA' as const };
    expect(partesDaPrevia(sit)).toEqual(['SIT', '6 × 30 s all-out / 3 min (passiva)', '~25 min']);
    expect(partesDaPrevia(continuo({ duracaoMin: 30 }))).toEqual(['Contínuo', '30 min']);
  });

  it('aquecimento e desaquecimento só no intervalado, sem a fase de 0 s', () => {
    expect(textoDoAquecimento(padraoDoProtocolo('SIT'))).toBe('Aquecimento 4 min · Desaquecimento 3 min');
    expect(textoDoAquecimento({ ...padraoDoProtocolo('SIT'), aquecimentoSeg: 0 })).toBe('Desaquecimento 3 min');
    expect(textoDoAquecimento({ ...padraoDoProtocolo('SIT'), aquecimentoSeg: null, desaquecimentoSeg: null })).toBeNull();
    expect(textoDoAquecimento(continuo({ duracaoMin: 30 }))).toBeNull();
  });
});

describe('timer do intervalado', () => {
  // CURTO padrão: 300 s de aquecimento, 10 × (30 s + 30 s) sem a última recuperação, 300 s de desaquecimento.
  const curto = padraoDoProtocolo('CURTO');
  const fases = fasesDoBloco(curto);
  const s = (n: number) => n * 1000;

  it('acha a fase pelo tempo decorrido no relógio de parede', () => {
    const t = iniciarTimer(0);
    expect(relogioDoTimer(t, fases, 0)).toMatchObject({ indice: 0, fase: { fase: 'AQUECIMENTO' }, segundos: 300, texto: '5:00', proporcao: 1, terminado: false });
    expect(relogioDoTimer(t, fases, s(299.2))).toMatchObject({ indice: 0, segundos: 1, texto: '0:01' });
    // 300 s de aquecimento + 2 voltas (60 s cada) = estímulo da volta 3.
    const r = relogioDoTimer(t, fases, s(420));
    expect(r).toMatchObject({ fase: { fase: 'ESTIMULO', volta: 3 }, segundos: 30, proxima: { fase: 'RECUPERACAO', volta: 3 } });
    expect(voltaDaFase(r.fase!, curto)).toBe('3 de 10');
    expect(relogioDoTimer(t, fases, s(465))).toMatchObject({ fase: { fase: 'RECUPERACAO', volta: 3 }, segundos: 15, proporcao: 0.5 });
    // Depois do último estímulo vem o desaquecimento, sem recuperação.
    expect(relogioDoTimer(t, fases, s(300 + 9 * 60 + 30))).toMatchObject({ fase: { fase: 'DESAQUECIMENTO' }, proxima: null });
    expect(relogioDoTimer(t, fases, s(1170))).toMatchObject({ terminado: true, fase: null, segundos: 0, indice: fases.length });
  });

  it('pausado não anda; retomar empurra o início pelo tempo parado', () => {
    const pausado = pausarTimer(iniciarTimer(0), s(100));
    expect(pausarTimer(pausado, s(150))).toBe(pausado);
    expect(relogioDoTimer(pausado, fases, s(5000))).toMatchObject({ indice: 0, segundos: 200, pausado: true });
    const retomado = retomarTimer(pausado, s(160));
    expect(retomado).toEqual({ inicioEm: s(60), pausadoEm: null });
    expect(relogioDoTimer(retomado, fases, s(160))).toMatchObject({ segundos: 200, pausado: false });
    expect(retomarTimer(retomado, s(200))).toBe(retomado);
  });

  it('pular vai ao começo da próxima fase, também pausado; depois da última, acaba', () => {
    const t = pularFase(iniciarTimer(0), fases, s(10));
    expect(relogioDoTimer(t, fases, s(10))).toMatchObject({ fase: { fase: 'ESTIMULO', volta: 1 }, segundos: 30 });
    const pausado = pularFase(pausarTimer(iniciarTimer(0), s(10)), fases, s(50));
    expect(relogioDoTimer(pausado, fases, s(90))).toMatchObject({ fase: { fase: 'ESTIMULO', volta: 1 }, segundos: 30, pausado: true });
    let fim = iniciarTimer(0);
    for (let i = 0; i < fases.length; i++) fim = pularFase(fim, fases, 0);
    expect(relogioDoTimer(fim, fases, 0).terminado).toBe(true);
    expect(pularFase(fim, fases, 0)).toBe(fim);
  });

  it('nomes, esforço e anúncio da fase vêm só do que o treinador escreveu', () => {
    const sit = { ...padraoDoProtocolo('SIT'), recuperacaoTipo: 'PASSIVA' as const };
    const [aquecimento, estimulo, recuperacao] = fasesDoBloco(sit);
    expect(nomeDaFase(aquecimento, sit)).toBe('Aquecimento');
    expect(nomeDaFase(recuperacao, sit)).toBe('Recuperação passiva');
    expect(esforcoDaFase(estimulo, sit)).toBe('All-out');
    expect(esforcoDaFase(recuperacao, sit)).toBeNull();
    expect(esforcoDaFase(fases[1], curto)).toBe('Zona 5');
    expect(esforcoDaFase(fases[1], { ...curto, zona: null })).toBeNull();
    expect(voltaDaFase(aquecimento, sit)).toBeNull();
    expect(anuncioDaFase(estimulo, sit)).toBe('Estímulo, All-out, volta 1 de 6, 30 s');
    expect(anuncioDaFase(aquecimento, sit)).toBe('Aquecimento, 4 min');
  });

  it('intervalado antigo (sem modo) também tem timer, sem aquecimento', () => {
    const antigo: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: { trabalhoSeg: 30, descansoSeg: 60, voltas: 2 } };
    expect(fasesDoBloco(antigo).map((f) => f.fase)).toEqual(['ESTIMULO', 'RECUPERACAO', 'ESTIMULO']);
    expect(nomeDaFase(fasesDoBloco(antigo)[1], antigo)).toBe('Recuperação');
  });
});
