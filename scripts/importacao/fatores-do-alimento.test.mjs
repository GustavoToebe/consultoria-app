import assert from 'node:assert/strict';
import test from 'node:test';

import { completarFatores, estimarFatoresDoAlimento } from './fatores-do-alimento.mjs';

test('estima pelo nome e só preenche o fator que veio nulo', () => {
  assert.deepEqual(estimarFatoresDoAlimento('Peito de frango grelhado', 'Carnes e derivados', 159, 100, 'g'), {
    fatorCorrecao: 1.12, fatorCoccao: 0.78,
  });
  assert.deepEqual(estimarFatoresDoAlimento('Arroz branco', 'Cereais e derivados', 128, 100, 'g').fatorCoccao, 2.6);
  assert.deepEqual(estimarFatoresDoAlimento('Arroz branco', 'Cereais e derivados', 358, 100, 'g').fatorCoccao, 1);
  assert.deepEqual(estimarFatoresDoAlimento('Banana prata', 'Frutas e derivados'), { fatorCorrecao: 1.45, fatorCoccao: 1 });
  assert.deepEqual(completarFatores(1.75, null, 'Abacaxi', null, 48, 100, 'g'), { fatorCorrecao: 1.75, fatorCoccao: 1 });
});
