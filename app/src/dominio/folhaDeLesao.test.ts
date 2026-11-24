import type { Lesao } from '../api/tipos';
import {
  analisarLesao, AVISO_FIM_ANTES_DO_INICIO, comporRegiao, formularioDaLesao, LADOS, LESAO_EM_BRANCO, LIMITE_DA_REGIAO, lerRegiao,
  lesaoAlterada, REGIOES, temFim,
} from './folhaDeLesao';

// ficha: folha de lesão (24/11)

describe('comporRegiao', () => {
  it('sem região escolhida não preenche nada, nem com o lado marcado', () => {
    expect(comporRegiao(null, null)).toBe('');
    expect(comporRegiao(null, 'DIREITO')).toBe('');
    expect(comporRegiao(null, 'AMBOS')).toBe('');
  });

  it('região sem lado é só a região', () => {
    for (const r of REGIOES) expect(comporRegiao(r, null)).toBe(r);
  });

  it('as 24 combinações, com a concordância de Cervical e Lombar', () => {
    expect(comporRegiao('Ombro', 'DIREITO')).toBe('Ombro direito');
    expect(comporRegiao('Joelho', 'ESQUERDO')).toBe('Joelho esquerdo');
    expect(comporRegiao('Quadril', 'AMBOS')).toBe('Quadril (ambos os lados)');
    expect(comporRegiao('Lombar', 'DIREITO')).toBe('Lombar direita');
    expect(comporRegiao('Cervical', 'ESQUERDO')).toBe('Cervical esquerda');
    expect(comporRegiao('Cervical', 'AMBOS')).toBe('Cervical (ambos os lados)');
    expect(comporRegiao('Tornozelo', 'DIREITO')).toBe('Tornozelo direito');
  });

  it('trocar o atalho recompõe com o mesmo lado, sem duplicá-lo', () => {
    const antes = comporRegiao('Ombro', 'DIREITO');
    const depois = comporRegiao('Joelho', 'DIREITO');
    expect(antes).toBe('Ombro direito');
    expect(depois).toBe('Joelho direito');
    expect(depois.match(/direit/g)).toHaveLength(1);
  });

  it('nenhuma combinação passa de 80 caracteres (limite da API)', () => {
    for (const r of REGIOES) for (const l of [null, ...LADOS.map((x) => x.valor)] as const) {
      expect(comporRegiao(r, l).length).toBeLessThanOrEqual(LIMITE_DA_REGIAO);
    }
  });
});

describe('lerRegiao', () => {
  it('reconhece só o que o atalho produz, de ida e volta', () => {
    for (const r of REGIOES) for (const l of [null, ...LADOS.map((x) => x.valor)] as const) {
      expect(lerRegiao(comporRegiao(r, l))).toEqual({ regiao: r, lado: l });
    }
  });

  it('texto livre não tem atalho', () => {
    expect(lerRegiao('')).toEqual({ regiao: null, lado: null });
    expect(lerRegiao('Ombro direito (pós-cirurgia)')).toEqual({ regiao: null, lado: null });
    expect(lerRegiao('Costas')).toEqual({ regiao: null, lado: null });
  });
});

describe('analisarLesao', () => {
  const base = { ...LESAO_EM_BRANCO, regiao: 'Ombro direito' };

  it('sem região: o motivo diz o que falta e não há corpo', () => {
    expect(analisarLesao(LESAO_EM_BRANCO)).toMatchObject({ corpo: null, motivo: 'Informe a região do corpo' });
    expect(analisarLesao({ ...base, regiao: '   ' }).motivo).toBe('Informe a região do corpo');
  });

  it('só a região basta; o resto vai nulo', () => {
    expect(analisarLesao(base)).toEqual({
      corpo: { regiao: 'Ombro direito', descricao: null, dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null },
      motivo: null, erroDoFim: null,
    });
  });

  it('aparar espaços e levar descrição, observação e início', () => {
    const r = analisarLesao({ ...base, regiao: '  Joelho  ', descricao: ' Tendinite ', observacao: ' Evitar agachar fundo ', inicio: '05/03/2025' });
    expect(r.corpo).toEqual({
      regiao: 'Joelho', descricao: 'Tendinite', dataInicio: '2025-03-05', dataFim: null, situacao: 'ATIVA', observacao: 'Evitar agachar fundo',
    });
  });

  it('o Fim só vale com Recuperada: nas outras situações o corpo leva dataFim nulo e o Fim digitado não trava', () => {
    for (const situacao of ['ATIVA', 'EM_RECUPERACAO'] as const) {
      const r = analisarLesao({ ...base, situacao, inicio: '05/03/2025', fim: '01/01/2025' });
      expect(r.motivo).toBeNull();
      expect(r.corpo?.dataFim).toBeNull();
    }
    expect(analisarLesao({ ...base, situacao: 'RECUPERADA', inicio: '05/03/2025', fim: '15/05/2025' }).corpo?.dataFim).toBe('2025-05-15');
    expect(analisarLesao({ ...base, situacao: 'RECUPERADA' }).corpo?.dataFim).toBeNull();
  });

  it('fim antes do início: erro no Fim, motivo e sem corpo; no mesmo dia vale', () => {
    const f = { ...base, situacao: 'RECUPERADA' as const, inicio: '10/05/2025', fim: '09/05/2025' };
    expect(analisarLesao(f)).toEqual({ corpo: null, motivo: 'Corrija a data de fim', erroDoFim: AVISO_FIM_ANTES_DO_INICIO });
    expect(analisarLesao({ ...f, fim: '10/05/2025' }).motivo).toBeNull();
  });

  it('data incompleta, inexistente ou fora da faixa trava com o motivo da data certa', () => {
    expect(analisarLesao({ ...base, inicio: '10/05' }).motivo).toBe('Corrija a data de início');
    expect(analisarLesao({ ...base, inicio: '31/02/2025' }).motivo).toBe('Corrija a data de início');
    expect(analisarLesao({ ...base, inicio: '05/05/0261' }).motivo).toBe('Corrija a data de início');
    expect(analisarLesao({ ...base, situacao: 'RECUPERADA', fim: '10/05' }).motivo).toBe('Corrija a data de fim');
  });
});

describe('lesaoAlterada', () => {
  const lesao: Lesao = {
    id: 'l1', regiao: 'Ombro direito', descricao: 'Tendinite', dataInicio: '2025-03-05', dataFim: '2025-05-15', situacao: 'RECUPERADA', observacao: null,
  };

  it('igual ao que abriu não é alteração (nova ou em edição)', () => {
    expect(lesaoAlterada(LESAO_EM_BRANCO, LESAO_EM_BRANCO)).toBe(false);
    expect(lesaoAlterada(formularioDaLesao(lesao), formularioDaLesao(lesao))).toBe(false);
  });

  it('qualquer campo diferente é alteração', () => {
    const f = formularioDaLesao(lesao);
    expect(lesaoAlterada(f, { ...f, regiao: 'Ombro esquerdo' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, descricao: '' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, observacao: 'x' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, fim: '16/05/2025' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, situacao: 'ATIVA' })).toBe(true);
  });

  it('o Fim escondido não conta', () => {
    const nova = { ...LESAO_EM_BRANCO, fim: '10/10/2025' };
    expect(lesaoAlterada(LESAO_EM_BRANCO, nova)).toBe(false);
  });

  it('formularioDaLesao e temFim', () => {
    expect(formularioDaLesao(lesao)).toEqual({
      regiao: 'Ombro direito', descricao: 'Tendinite', inicio: '05/03/2025', fim: '15/05/2025', situacao: 'RECUPERADA', observacao: '',
    });
    expect(temFim('RECUPERADA')).toBe(true);
    expect(temFim('EM_RECUPERACAO')).toBe(false);
  });
});
