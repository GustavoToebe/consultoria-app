import type { Lesao } from '../api/tipos';
import {
  analisarLesao, AVISO_FIM_ANTES_DO_INICIO, colunasDaGrade, comporRegiao, escolherRegiao, formularioDaLesao, LADOS, LESAO_EM_BRANCO,
  LIMITE_DA_OUTRA, LIMITE_DA_REGIAO, lerRegiao, lesaoAlterada, OPCOES_DE_REGIAO, OUTRA, REGIOES, temFim, temLado, textoDaRegiao,
  trocarSituacao, type FormularioDeLesao,
} from './folhaDeLesao';

// ficha: folha de lesão (24/11; grade de regiões, lado e datas, 26/11)

const LADOS_OU_NADA = [null, ...LADOS.map((x) => x.valor)] as const;

describe('temLado', () => {
  it('Cervical e Lombar não têm lado; as outras (e "Outra") têm; sem região, não', () => {
    expect(OPCOES_DE_REGIAO.filter((r) => !temLado(r))).toEqual(['Cervical', 'Lombar']);
    expect(temLado(OUTRA)).toBe(true);
    expect(temLado(null)).toBe(false);
  });
});

describe('comporRegiao', () => {
  it('sem região escolhida não preenche nada, nem com o lado', () => {
    expect(comporRegiao(null, null)).toBe('');
    expect(comporRegiao(null, 'DIREITO')).toBe('');
  });

  it('região sem lado é só a região', () => {
    for (const r of REGIOES) expect(comporRegiao(r, null)).toBe(r);
  });

  it('o texto de sempre, e Cervical e Lombar nunca levam lado', () => {
    expect(comporRegiao('Ombro', 'DIREITO')).toBe('Ombro direito');
    expect(comporRegiao('Joelho', 'ESQUERDO')).toBe('Joelho esquerdo');
    expect(comporRegiao('Cotovelo', 'AMBOS')).toBe('Cotovelo (ambos os lados)');
    expect(comporRegiao('Tornozelo', 'DIREITO')).toBe('Tornozelo direito');
    expect(comporRegiao('Lombar', 'DIREITO')).toBe('Lombar');
    expect(comporRegiao('Cervical', 'AMBOS')).toBe('Cervical');
  });

  it('nenhuma combinação passa de 80 caracteres (limite da API)', () => {
    for (const r of REGIOES) for (const l of LADOS_OU_NADA) expect(comporRegiao(r, l).length).toBeLessThanOrEqual(LIMITE_DA_REGIAO);
  });
});

describe('textoDaRegiao', () => {
  it('"Outra": o texto digitado (aparado) com o lado sem flexionar; sem texto, nada', () => {
    expect(textoDaRegiao({ regiao: OUTRA, lado: null, outra: '  Antebraço ' })).toBe('Antebraço');
    expect(textoDaRegiao({ regiao: OUTRA, lado: 'DIREITO', outra: 'Antebraço' })).toBe('Antebraço (lado direito)');
    expect(textoDaRegiao({ regiao: OUTRA, lado: 'ESQUERDO', outra: 'Mão' })).toBe('Mão (lado esquerdo)');
    expect(textoDaRegiao({ regiao: OUTRA, lado: 'AMBOS', outra: 'Mão' })).toBe('Mão (ambos os lados)');
    expect(textoDaRegiao({ regiao: OUTRA, lado: 'DIREITO', outra: '   ' })).toBe('');
  });

  it('região da grade ignora o texto de "Outra" guardado', () => {
    expect(textoDaRegiao({ regiao: 'Joelho', lado: 'DIREITO', outra: 'Costas' })).toBe('Joelho direito');
  });

  it('o "Qual região?" mais o maior sufixo cabe nos 80', () => {
    expect(textoDaRegiao({ regiao: OUTRA, lado: 'AMBOS', outra: 'x'.repeat(LIMITE_DA_OUTRA) }).length).toBe(LIMITE_DA_REGIAO);
  });
});

describe('lerRegiao', () => {
  it('ida e volta de toda região da grade com os lados que ela aceita', () => {
    for (const r of REGIOES) for (const l of LADOS_OU_NADA) {
      if (l !== null && !temLado(r)) continue;
      expect(lerRegiao(comporRegiao(r, l))).toEqual({ regiao: r, lado: l, outra: '' });
    }
  });

  it('texto fora da grade abre em "Outra" com o texto inteiro', () => {
    expect(lerRegiao('Costas')).toEqual({ regiao: OUTRA, lado: null, outra: 'Costas' });
    expect(lerRegiao('Ombro direito (pós-cirurgia)')).toEqual({ regiao: OUTRA, lado: null, outra: 'Ombro direito (pós-cirurgia)' });
    // Lombar com lado, gravada antes da grade: o lado não some, o texto fica igual.
    expect(lerRegiao('Lombar direita')).toEqual({ regiao: OUTRA, lado: null, outra: 'Lombar direita' });
  });

  it('"Outra" com sufixo de lado volta com o lado; o texto montado é o mesmo', () => {
    for (const texto of ['Antebraço (lado direito)', 'Mão (lado esquerdo)', 'Costela (ambos os lados)', 'Lombar direita', 'Costas']) {
      expect(textoDaRegiao(lerRegiao(texto))).toBe(texto);
    }
    expect(lerRegiao('Mão (lado esquerdo)')).toEqual({ regiao: OUTRA, lado: 'ESQUERDO', outra: 'Mão' });
  });

  it('vazio não tem região', () => {
    expect(lerRegiao('')).toEqual({ regiao: null, lado: null, outra: '' });
  });
});

describe('escolherRegiao', () => {
  const f: FormularioDeLesao = { ...LESAO_EM_BRANCO, regiao: 'Ombro', lado: 'DIREITO', outra: 'Costas' };

  it('trocar para outra região com lado mantém o lado; para Cervical ou Lombar o descarta', () => {
    expect(escolherRegiao(f, 'Joelho')).toMatchObject({ regiao: 'Joelho', lado: 'DIREITO' });
    expect(escolherRegiao(f, 'Lombar')).toMatchObject({ regiao: 'Lombar', lado: null });
    expect(textoDaRegiao(escolherRegiao(f, 'Cervical'))).toBe('Cervical');
  });

  it('o texto de "Outra" fica guardado ao passar por outra região', () => {
    expect(escolherRegiao(escolherRegiao(f, 'Punho'), OUTRA)).toMatchObject({ regiao: OUTRA, outra: 'Costas', lado: 'DIREITO' });
  });
});

describe('trocarSituacao', () => {
  const base: FormularioDeLesao = { ...LESAO_EM_BRANCO, regiao: 'Joelho', inicio: '01/10/2026' };

  it('entrar em Recuperada sugere o fim (hoje ou o que a lesão tinha); a pessoa pode apagar', () => {
    const r = trocarSituacao(base, 'RECUPERADA', '19/10/2026');
    expect(r).toMatchObject({ situacao: 'RECUPERADA', fim: '19/10/2026' });
    expect(trocarSituacao({ ...r, fim: '' }, 'RECUPERADA', '19/10/2026').fim).toBe('');
  });

  it('sair de Recuperada limpa o Fim; entre Ativa e Em recuperação nada muda nele', () => {
    const recuperada = { ...base, situacao: 'RECUPERADA' as const, fim: '15/10/2026' };
    expect(trocarSituacao(recuperada, 'ATIVA', '19/10/2026')).toMatchObject({ situacao: 'ATIVA', fim: '' });
    expect(trocarSituacao(base, 'EM_RECUPERACAO', '19/10/2026')).toMatchObject({ situacao: 'EM_RECUPERACAO', fim: '' });
  });
});

describe('analisarLesao', () => {
  const base: FormularioDeLesao = { ...LESAO_EM_BRANCO, regiao: 'Ombro', lado: 'DIREITO' };

  it('sem região: o motivo diz o que falta e não há corpo', () => {
    expect(analisarLesao(LESAO_EM_BRANCO)).toMatchObject({ corpo: null, motivo: 'Escolha a região do corpo' });
    expect(analisarLesao({ ...base, regiao: OUTRA, outra: '   ' }).motivo).toBe('Escreva qual é a região');
  });

  it('só a região basta; o resto vai nulo', () => {
    expect(analisarLesao(base)).toEqual({
      corpo: { regiao: 'Ombro direito', descricao: null, dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null },
      motivo: null, erroDoFim: null,
    });
  });

  it('aparar espaços e levar descrição, observação e início', () => {
    const r = analisarLesao({ ...base, regiao: OUTRA, lado: null, outra: '  Costas  ', descricao: ' Tendinite ', observacao: ' Evitar agachar fundo ', inicio: '05/03/2025' });
    expect(r.corpo).toEqual({
      regiao: 'Costas', descricao: 'Tendinite', dataInicio: '2025-03-05', dataFim: null, situacao: 'ATIVA', observacao: 'Evitar agachar fundo',
    });
  });

  it('região com lado acima de 80 (texto antigo longo) trava com o motivo', () => {
    expect(analisarLesao({ ...base, regiao: OUTRA, outra: 'x'.repeat(70), lado: 'AMBOS' }).motivo).toMatch(/^Encurte a região/);
    expect(analisarLesao({ ...base, regiao: OUTRA, outra: 'x'.repeat(80), lado: null }).motivo).toBeNull();
  });

  it('o Fim só vale com Recuperada: nas outras situações o corpo leva dataFim nulo', () => {
    for (const situacao of ['ATIVA', 'EM_RECUPERACAO'] as const) {
      const r = analisarLesao({ ...base, situacao, inicio: '05/03/2025', fim: '01/01/2025' });
      expect(r.motivo).toBeNull();
      expect(r.corpo?.dataFim).toBeNull();
    }
    expect(analisarLesao({ ...base, situacao: 'RECUPERADA', inicio: '05/03/2025', fim: '15/05/2025' }).corpo?.dataFim).toBe('2025-05-15');
    expect(analisarLesao({ ...base, situacao: 'RECUPERADA' }).corpo?.dataFim).toBeNull();
  });

  it('fim antes do início: erro fixo no Fim, motivo e sem corpo; no mesmo dia vale', () => {
    const f = { ...base, situacao: 'RECUPERADA' as const, inicio: '10/05/2025', fim: '09/05/2025' };
    expect(AVISO_FIM_ANTES_DO_INICIO).toBe('O fim não pode ser antes do início.');
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

describe('formularioDaLesao e lesaoAlterada', () => {
  const lesao: Lesao = {
    id: 'l1', regiao: 'Ombro direito', descricao: 'Tendinite', dataInicio: '2025-03-05', dataFim: '2025-05-15', situacao: 'RECUPERADA', observacao: null,
  };

  it('a edição abre com a grade marcada e o fim; fora de Recuperada o fim gravado não entra', () => {
    expect(formularioDaLesao(lesao)).toEqual({
      regiao: 'Ombro', lado: 'DIREITO', outra: '', descricao: 'Tendinite', inicio: '05/03/2025', fim: '15/05/2025', situacao: 'RECUPERADA', observacao: '',
    });
    expect(formularioDaLesao({ ...lesao, situacao: 'ATIVA' }).fim).toBe('');
    expect(formularioDaLesao({ ...lesao, regiao: 'Costas' })).toMatchObject({ regiao: OUTRA, outra: 'Costas', lado: null });
    expect(temFim('RECUPERADA')).toBe(true);
    expect(temFim('EM_RECUPERACAO')).toBe(false);
  });

  it('igual ao que abriu não é alteração (nova ou em edição); abrir e salvar sem mexer grava o mesmo texto', () => {
    expect(lesaoAlterada(LESAO_EM_BRANCO, LESAO_EM_BRANCO)).toBe(false);
    expect(lesaoAlterada(formularioDaLesao(lesao), formularioDaLesao(lesao))).toBe(false);
    expect(analisarLesao(formularioDaLesao({ ...lesao, regiao: 'Lombar direita' })).corpo?.regiao).toBe('Lombar direita');
  });

  it('qualquer campo diferente é alteração; ir e voltar no lado não é', () => {
    const f = formularioDaLesao(lesao);
    expect(lesaoAlterada(f, { ...f, lado: 'ESQUERDO' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, descricao: '' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, observacao: 'x' })).toBe(true);
    expect(lesaoAlterada(f, { ...f, fim: '16/05/2025' })).toBe(true);
    expect(lesaoAlterada(f, trocarSituacao(f, 'ATIVA', ''))).toBe(true);
    expect(lesaoAlterada(f, { ...f, outra: 'qualquer' })).toBe(false);
  });
});

describe('colunasDaGrade', () => {
  it('3 colunas na folha do PC e na de 390 (também com o texto EXTRA); mais estreito, a reserva (2 nas regiões, 1 no lado)', () => {
    expect(colunasDaGrade(552, 1, 2, 6)).toBe(3);
    expect(colunasDaGrade(358, 1, 2, 6)).toBe(3);
    expect(colunasDaGrade(358, 1.4, 2, 6)).toBe(3);
    expect(colunasDaGrade(300, 1.4, 2, 6)).toBe(2);
    expect(colunasDaGrade(300, 1.4, 1, 6)).toBe(1);
    expect(colunasDaGrade(150, 1, 2, 6)).toBe(1);
  });
});
