import { ajustarCarga, passoDaCarga } from './cargas';
import { numeroDaTela } from './formatos';
import {
  CASAS_EM_LIBRA,
  KG_POR_LIBRA,
  kgParaTela,
  mascaraDaCarga,
  nomeDaUnidade,
  passoNaTela,
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
  it('com a chave ligada vale a escolha de quem vê, aluno ou treinador', () => {
    expect(unidadeEfetiva({ chaveLigada: true, preferida: 'lb' })).toBe('lb');
    expect(unidadeEfetiva({ chaveLigada: true, preferida: 'kg' })).toBe('kg');
  });
  it('chave desligada com lb salvo de antes fica em kg', () => {
    expect(unidadeEfetiva({ chaveLigada: false, preferida: 'lb' })).toBe('kg');
  });
});

describe('passo dos botões − e + na unidade do aluno', () => {
  it('em kg o passo é o arredondamentoKg como é; em libra, o convertido no múltiplo de 2,5 lb mais próximo (mínimo 2,5 lb)', () => {
    expect(passoNaTela(0.5, 'kg')).toBe(0.5);
    expect(passoNaTela(2.5, 'kg')).toBe(2.5);
    expect(passoNaTela(2.5, 'lb')).toBe(5);
    expect(passoNaTela(1, 'lb')).toBe(2.5);
    expect(passoNaTela(1.25, 'lb')).toBe(2.5);
    expect(passoNaTela(5, 'lb')).toBe(10);
    expect(passoNaTela(0.25, 'lb')).toBe(2.5); // nunca abaixo de 2,5 lb
    expect(passoNaTela(0.5, 'lb')).toBe(2.5);
  });

  it('o rótulo mostra o passo da tela: kg como é, libra em múltiplo de 2,5', () => {
    expect(textoDoPasso(0.5, 'kg')).toBe('0,5 kg');
    expect(textoDoPasso(2.5, 'kg')).toBe('2,5 kg');
    expect(textoDoPasso(2.5, 'lb')).toBe('5 lb');
    expect(textoDoPasso(1, 'lb')).toBe('2,5 lb');
    expect(textoDoPasso(5, 'lb')).toBe('10 lb');
  });

  it('em libra o −/+ anda sobre o número da tela: 100 lb + 5 lb = 105 lb, nunca 105,5', () => {
    const cem = telaParaKg(100, 'lb') as number; // 45,35 kg
    expect(kgParaTela(ajustarCarga(cem, null, 2.5, 1, 'lb'), 'lb')).toBe(105);
    expect(kgParaTela(ajustarCarga(cem, null, 2.5, -1, 'lb'), 'lb')).toBe(95);
    expect(kgParaTela(ajustarCarga(cem, null, 1, 1, 'lb'), 'lb')).toBe(102.5);
    expect(kgParaTela(ajustarCarga(cem, null, 1.25, 1, 'lb'), 'lb')).toBe(102.5);
    expect(kgParaTela(ajustarCarga(cem, null, 5, 1, 'lb'), 'lb')).toBe(110);
    // Sempre devolve kg guardável (2 casas).
    expect(ajustarCarga(cem, null, 2.5, 1, 'lb')).toBe(telaParaKg(105, 'lb'));
  });

  it('em kg nada mudou, mesmo passando a unidade', () => {
    expect(ajustarCarga(45.35, null, 0.5, 1, 'kg')).toBe(45.85);
    expect(ajustarCarga(45.85, null, 0.5, -1)).toBe(45.35);
  });

  it('a ida e volta lb → kg → lb não altera o número da tela: de 0,1 em 0,1 lb, +passo e −passo', () => {
    for (const passoKg of [1, 1.25, 2.5, 5]) {
      const passoLb = passoNaTela(passoKg, 'lb');
      for (let decimos = 0; decimos <= 20000; decimos++) {
        const lb = decimos / 10;
        const kg = telaParaKg(lb, 'lb') as number;
        const mais = ajustarCarga(kg, null, passoKg, 1, 'lb');
        expect(Math.abs(Math.round(mais * 100) - mais * 100)).toBeLessThan(1e-6); // guardável em 2 casas
        expect(kgParaTela(mais, 'lb')).toBe(Math.round((lb + passoLb) * 10) / 10);
        expect(kgParaTela(ajustarCarga(kg, null, passoKg, -1, 'lb'), 'lb')).toBe(Math.max(0, Math.round((lb - passoLb) * 10) / 10));
      }
    }
  });

  it('nunca abaixo de zero e, sem número digitado, parte da sugestão e depois do zero', () => {
    expect(ajustarCarga(0.2, null, 0.5, -1)).toBe(0);
    expect(ajustarCarga(null, 62.5, 0.5, 1)).toBe(63);
    expect(ajustarCarga(null, null, 0.5, 1)).toBe(0.5);
    // Em libra: 2 lb − 5 lb = 0; do zero, o passo; sem número parte da sugestão (62,5 kg = 137,8 lb + 5 lb = 142,8 lb).
    expect(ajustarCarga(telaParaKg(2, 'lb'), null, 2.5, -1, 'lb')).toBe(0);
    expect(ajustarCarga(0, null, 2.5, -1, 'lb')).toBe(0);
    expect(kgParaTela(ajustarCarga(null, null, 2.5, 1, 'lb'), 'lb')).toBe(5);
    expect(kgParaTela(ajustarCarga(null, 62.5, 2.5, 1, 'lb'), 'lb')).toBe(142.8);
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
