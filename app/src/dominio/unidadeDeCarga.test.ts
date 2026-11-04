import { ajustarCarga, passoDaCarga } from './cargas';
import { numeroDaTela } from './formatos';
import {
  CASAS_EM_LIBRA,
  KG_POR_LIBRA,
  kgParaTela,
  mascaraDaCarga,
  nomeDaUnidade,
  telaParaKg,
  textoDaCarga,
  textoDoPasso,
  unidadeEfetiva,
} from './unidadeDeCarga';

describe('conversão e arredondamento', () => {
  it('usa o fator exato de 0,45359237 kg por libra', () => {
    expect(KG_POR_LIBRA).toBe(0.45359237);
    expect(telaParaKg(100, 'lb')).toBe(45.35); // 45,35 e 45,36 mostram 100,0 lb; vale o múltiplo de 0,05
    expect(kgParaTela(45.35, 'lb')).toBe(100);
    expect(kgParaTela(45.36, 'lb')).toBe(100);
  });

  it('em kg não converte nem arredonda nada', () => {
    expect(kgParaTela(62.5, 'kg')).toBe(62.5);
    expect(kgParaTela(62.123, 'kg')).toBe(62.123);
    expect(telaParaKg(62.123, 'kg')).toBe(62.123);
  });

  it('mostra libra com 1 casa sem trocar o valor guardado', () => {
    const guardado = 62.5;
    expect(kgParaTela(guardado, 'lb')).toBe(137.8);
    expect(textoDaCarga(guardado, 'lb')).toBe('137,8 lb');
    expect(guardado).toBe(62.5);
    expect(textoDaCarga(62.5, 'kg')).toBe('62,5 kg');
  });

  it('ida e volta não deriva: todo valor de 0,1 lb até o teto do banco volta igual', () => {
    // 2000 kg (teto de `numeric(7,2)`) = 4409,2 lb.
    for (let decimos = 0; decimos <= 44092; decimos++) {
      const lb = decimos / 10;
      const kg = telaParaKg(lb, 'lb') as number;
      expect(Math.abs(Math.round(kg * 100) - kg * 100)).toBeLessThan(1e-6); // o guardado tem no máximo 2 casas
      expect(kgParaTela(kg, 'lb')).toBe(lb);
    }
  });

  it('digitar 100 lb, guardar e ler de volta em lb dá 100', () => {
    for (const digitado of ['100', '100,5', '62,5', '0,1', '225', '1000,9']) {
      const lb = numeroDaTela(digitado) as number;
      expect(kgParaTela(telaParaKg(lb, 'lb'), 'lb')).toBe(lb);
    }
  });

  it('a volta kg → lb → kg não deriva: digitar o que se vê grava o mesmo kg (sem 60,01, sem recorde falso)', () => {
    // Última vez 60 kg, a dica mostra 132,3 lb; o aluno digita 132,3 e o guardado continua 60.
    expect(kgParaTela(60, 'lb')).toBe(132.3);
    expect(telaParaKg(132.3, 'lb')).toBe(60);
    expect(telaParaKg(137.8, 'lb')).toBe(62.5); // 62,5 kg = 137,8 lb
    expect(kgParaTela(62.5, 'lb')).toBe(137.8);
    expect(telaParaKg(kgParaTela(62.25, 'lb') as number, 'lb')).toBe(62.25);
    expect(telaParaKg(kgParaTela(62.5, 'lb') as number, 'lb')).toBe(62.5);
  });

  it('todo kg múltiplo de 0,05 (o arredondamento da metodologia) até o teto do banco volta igual', () => {
    for (let vinteavos = 0; vinteavos <= 40000; vinteavos++) {
      const kg = vinteavos / 20;
      const lb = kgParaTela(kg, 'lb') as number;
      expect(telaParaKg(lb, 'lb')).toBe(kg);
    }
  });

  it('sem múltiplo de 0,05 na janela do número, vale o arredondamento normal de 2 casas (e ainda lê o mesmo número)', () => {
    // 0,1 lb ≈ 0,045 kg < 0,05: às vezes nenhum múltiplo cabe. 30,7 lb = 13,9253 kg (janela 13,9026 a 13,9480, entre 13,90 e 13,95).
    expect(telaParaKg(30.7, 'lb')).toBe(13.93);
    expect(kgParaTela(13.93, 'lb')).toBe(30.7);
  });

  it('zero, vazio e inválidos', () => {
    expect(kgParaTela(0, 'lb')).toBe(0);
    expect(telaParaKg(0, 'lb')).toBe(0);
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(kgParaTela(v, 'lb')).toBeNull();
      expect(telaParaKg(v, 'lb')).toBeNull();
      expect(kgParaTela(v, 'kg')).toBeNull();
      expect(telaParaKg(v, 'kg')).toBeNull();
    }
    expect(textoDaCarga(null, 'lb')).toBe('— lb');
    expect(textoDaCarga(null, 'kg')).toBe('— kg');
  });

  it('valores enormes seguem finitos e negativos mantêm o sinal (quem rejeita é a validação, não a conversão)', () => {
    expect(Number.isFinite(kgParaTela(1e12, 'lb'))).toBe(true);
    expect(kgParaTela(1e9, 'lb')).toBe(2204622621.8);
    expect(kgParaTela(-10, 'lb')).toBe(-22);
    expect(telaParaKg(-22, 'lb')).toBe(-10);
  });

  it('texto com vírgula "62,5" vira 62,5 e converte', () => {
    expect(numeroDaTela('62,5')).toBe(62.5);
    expect(telaParaKg(numeroDaTela('62,5') as number, 'lb')).toBe(28.35);
    expect(telaParaKg(numeroDaTela('62,5') as number, 'kg')).toBe(62.5);
  });

  it('a máscara do campo em libra aceita 1 casa (o ida e volta depende disso)', () => {
    expect(CASAS_EM_LIBRA).toBe(1);
    const mascara = mascaraDaCarga('lb')!;
    expect(mascara('62,55')).toBe('62,5');
    expect(mascara('100.77')).toBe('100,7');
    expect(mascara('100')).toBe('100');
    // O que não é número fica como foi digitado: o campo marca "Número inválido." e trava o ✓, como em kg.
    expect(mascara('abc12')).toBe('abc12');
    expect(mascara('6x2')).toBe('6x2');
    expect(numeroDaTela(mascara('abc12'))).toBeUndefined();
    expect(numeroDaTela(mascara('6x2'))).toBeUndefined();
    expect(mascaraDaCarga('kg')).toBeUndefined();
  });
});

describe('unidade em uso', () => {
  it('só o aluno com a chave ligada e lb escolhido vê libra', () => {
    expect(unidadeEfetiva({ chaveLigada: true, ehAluno: true, preferida: 'lb' })).toBe('lb');
    expect(unidadeEfetiva({ chaveLigada: true, ehAluno: true, preferida: 'kg' })).toBe('kg');
  });
  it('chave desligada com lb salvo de antes, treinador e "Ver como aluno" ficam em kg', () => {
    expect(unidadeEfetiva({ chaveLigada: false, ehAluno: true, preferida: 'lb' })).toBe('kg');
    expect(unidadeEfetiva({ chaveLigada: true, ehAluno: false, preferida: 'lb' })).toBe('kg');
  });
});

describe('passo dos botões − e + na unidade do aluno', () => {
  it('o rótulo converte o arredondamento da metodologia, com 2 casas', () => {
    expect(textoDoPasso(0.5, 'kg')).toBe('0,5 kg');
    expect(textoDoPasso(0.5, 'lb')).toBe('1,1 lb');
    expect(textoDoPasso(0.25, 'lb')).toBe('0,55 lb');
    expect(textoDoPasso(1, 'lb')).toBe('2,2 lb');
    expect(textoDoPasso(2.5, 'lb')).toBe('5,51 lb');
  });

  it('o passo continua o arredondamentoKg: o valor novo é kg + passo, sem passo novo em libra', () => {
    const passo = passoDaCarga({ unidade: 'kg' }, 0.5) as number;
    expect(passo).toBe(0.5);
    // Aluno em lb digitou 100 lb = 45,35 kg; "+" soma 0,5 kg e o campo passa a mostrar 101,1 lb.
    const depois = ajustarCarga(45.35, null, passo, 1);
    expect(depois).toBe(45.85);
    expect(kgParaTela(depois, 'lb')).toBe(101.1);
    // "−" volta ao kg exato: os botões não derivam.
    expect(ajustarCarga(depois, null, passo, -1)).toBe(45.35);
    expect(kgParaTela(ajustarCarga(depois, null, passo, -1), 'lb')).toBe(100);
  });

  it('nunca abaixo de zero e, sem número digitado, parte da sugestão e depois do zero', () => {
    expect(ajustarCarga(0.2, null, 0.5, -1)).toBe(0);
    expect(kgParaTela(ajustarCarga(0, null, 0.5, -1), 'lb')).toBe(0);
    expect(ajustarCarga(null, 62.5, 0.5, 1)).toBe(63);
    expect(kgParaTela(ajustarCarga(null, 62.5, 0.5, 1), 'lb')).toBe(138.9);
    expect(ajustarCarga(null, null, 0.5, 1)).toBe(0.5);
  });

  it('exercício sem carga ou passo inválido não tem botões, em qualquer unidade', () => {
    expect(passoDaCarga({ unidade: 'nenhuma' }, 0.5)).toBeNull();
    expect(passoDaCarga({ unidade: 'kg' }, 0)).toBeNull();
  });
});

describe('nome por extenso', () => {
  it('quilos e libras', () => {
    expect(nomeDaUnidade('kg')).toBe('quilos');
    expect(nomeDaUnidade('lb')).toBe('libras');
  });
});
