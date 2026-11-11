import { agrupar } from '../../dominio/agrupamento';
import { adicionarSerie, alterarGrupo, mudarQuantidade, novoExercicio, tecnicaVazia } from '../../dominio/editorTreino';
import { previaDoGrupo } from '../../dominio/resumoDaSerie';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { cargaDoBloco, cargaPendente, escolhaDeCargaDoPapel, modoAoEscolher, OPCOES_DO_RIR, percentuaisNoGrupo, textoParaOAluno } from './cargaDaSerie';

jest.mock('../../dominio/uid', () => { let n = 0; return { novoUid: () => `u${++n}` }; });

const cfg = CONFIGURACAO_PADRAO;
const codigo = (papel: string) => cfg.tipos.find((t) => t.papel === papel)!.codigo;
const valores = (e: ReturnType<typeof escolhaDeCargaDoPapel>) => e.opcoes.map((o) => o.valor);

describe('seletor binário da carga', () => {
  test('aquecimento, FS e back off: % da WS | carga fixa; WS: carga de trabalho | carga fixa', () => {
    expect(valores(escolhaDeCargaDoPapel(cfg, 'AQUECIMENTO', 'NENHUMA', 'kg', 'serie'))).toEqual(['PERCENTUAL_WS', 'CARGA_FIXA']);
    expect(valores(escolhaDeCargaDoPapel(cfg, 'PREPARACAO', 'PERCENTUAL_WS', 'kg', 'serie'))).toEqual(['PERCENTUAL_WS', 'CARGA_FIXA']);
    expect(valores(escolhaDeCargaDoPapel(cfg, 'POS_TRABALHO', 'PERCENTUAL_WS', 'kg', 'serie'))).toEqual(['PERCENTUAL_WS', 'CARGA_FIXA']);
    expect(valores(escolhaDeCargaDoPapel(cfg, 'TRABALHO', 'CARGA_TRABALHO', 'kg', 'serie'))).toEqual(['CARGA_TRABALHO', 'CARGA_FIXA']);
  });
  test('aquecimento sem sugestão aparece como % da WS em branco, e escolher % volta a gravar sem sugestão', () => {
    expect(escolhaDeCargaDoPapel(cfg, 'AQUECIMENTO', 'NENHUMA', 'kg', 'serie').marcado).toBe('PERCENTUAL_WS');
    expect(modoAoEscolher('AQUECIMENTO', 'PERCENTUAL_WS')).toBe('NENHUMA');
    expect(modoAoEscolher('PREPARACAO', 'PERCENTUAL_WS')).toBe('PERCENTUAL_WS');
  });
  test('forma gravada fora do papel continua marcada', () => {
    const e = escolhaDeCargaDoPapel(cfg, 'PREPARACAO', 'NENHUMA', 'kg', 'serie');
    expect(e.marcado).toBe('NENHUMA');
    expect(valores(e)).toEqual(['PERCENTUAL_WS', 'CARGA_FIXA', 'NENHUMA']);
  });
  test('no padrão do tipo: carga fixa em todos e sem sugestão em todo papel menos o de trabalho', () => {
    for (const papel of ['AQUECIMENTO', 'PREPARACAO', 'POS_TRABALHO'] as const) {
      expect(valores(escolhaDeCargaDoPapel(cfg, papel, 'PERCENTUAL_WS', 'kg', 'padrao'))).toEqual(['PERCENTUAL_WS', 'CARGA_FIXA', 'NENHUMA']);
    }
    expect(valores(escolhaDeCargaDoPapel(cfg, 'TRABALHO', 'CARGA_TRABALHO', 'kg', 'padrao'))).toEqual(['CARGA_TRABALHO', 'CARGA_FIXA']);
    expect(escolhaDeCargaDoPapel(cfg, 'TRABALHO', 'CARGA_FIXA', 'kg', 'padrao').marcado).toBe('CARGA_FIXA');
  });
  test('RIR: não prescrito, falha e 1 a 10', () => {
    expect(OPCOES_DO_RIR.map((o) => o.valor)).toEqual([null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(OPCOES_DO_RIR.slice(0, 2).map((o) => o.rotulo)).toEqual(['— (Não prescrito)', '0 (Falha)']);
  });
});

describe('percentual do aquecimento', () => {
  const tres = () => { const s = adicionarSerie([], cfg, codigo('AQUECIMENTO')); return mudarQuantidade(s, agrupar(s)[0], 3, cfg); };
  test('o % de uma série só muda o modo dela, as vazias ficam sem sugestão (sem erro) e o grupo continua um só', () => {
    const s = tres();
    const novas = percentuaisNoGrupo(s, agrupar(s)[0], 0, 40, null, cfg);
    expect(novas.map((x) => x.carga?.modo ?? 'NENHUMA')).toEqual(['PERCENTUAL_WS', 'NENHUMA', 'NENHUMA']);
    expect(novas.map((x) => x.carga?.percentualMin ?? null)).toEqual([40, null, null]);
    expect(agrupar(novas)).toHaveLength(1);
    const r = validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: adicionarSerie(novas, cfg) }, cfg);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    // Preencher outra série em seguida também não parte o grupo.
    const duas = percentuaisNoGrupo(novas, agrupar(novas)[0], 2, 60, 70, cfg);
    expect(duas.map((x) => x.carga?.modo ?? 'NENHUMA')).toEqual(['PERCENTUAL_WS', 'NENHUMA', 'PERCENTUAL_WS']);
    expect(agrupar(duas)).toHaveLength(1);
  });
  test('limpar o % de uma série troca só o modo dela de volta para sem sugestão', () => {
    const s = tres();
    const duas = percentuaisNoGrupo(percentuaisNoGrupo(s, agrupar(s)[0], 0, 40, null, cfg), agrupar(s)[0], 1, 50, 60, cfg);
    const limpa = percentuaisNoGrupo(duas, agrupar(duas)[0], 0, null, null, cfg);
    expect(limpa.map((x) => x.carga?.modo ?? 'NENHUMA')).toEqual(['NENHUMA', 'PERCENTUAL_WS', 'NENHUMA']);
    expect(limpa[1].carga).toMatchObject({ percentualMin: 50, percentualMax: 60 });
    expect(agrupar(limpa)).toHaveLength(1);
    expect(validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: limpa }, cfg).erros).toEqual([]);
  });
  test('só o Máx preenchido sem o Mín continua erro (a série é % e falta o mínimo)', () => {
    const s = tres();
    const novas = percentuaisNoGrupo(s, agrupar(s)[0], 1, null, 50, cfg);
    expect(novas[1].carga?.modo).toBe('PERCENTUAL_WS');
    const erros = validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: novas }, cfg).erros.map((e) => e.caminho);
    expect(erros).toEqual(['series[1].carga.percentualMin']);
  });
  test('apagar só o Máx com o Mín preenchido segue em % com máximo vazio (a API e a validação aceitam), sem erro', () => {
    const s = tres();
    const faixa = percentuaisNoGrupo(s, agrupar(s)[0], 0, 50, 60, cfg);
    const semMax = percentuaisNoGrupo(faixa, agrupar(faixa)[0], 0, 50, null, cfg);
    expect(semMax[0].carga).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 50, percentualMax: null });
    expect(agrupar(semMax)).toHaveLength(1);
    expect(validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: adicionarSerie(semMax, cfg) }, cfg).erros).toEqual([]);
  });
  test('apagar só o Mín com o Máx preenchido dá o erro normal no Mín, sem virar sem sugestão', () => {
    const s = tres();
    const faixa = percentuaisNoGrupo(s, agrupar(s)[0], 0, 50, 60, cfg);
    const semMin = percentuaisNoGrupo(faixa, agrupar(faixa)[0], 0, null, 60, cfg);
    expect(semMin[0].carga?.modo).toBe('PERCENTUAL_WS');
    const erros = validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: semMin }, cfg).erros.map((e) => e.caminho);
    expect(erros).toEqual(['series[0].carga.percentualMin']);
  });
  test('todas em branco voltam a sem sugestão', () => {
    const s = tres();
    const com = percentuaisNoGrupo(s, agrupar(s)[0], 0, 40, null, cfg);
    const sem = percentuaisNoGrupo(com, agrupar(com)[0], 0, null, null, cfg);
    expect(sem.map((x) => x.carga)).toEqual([null, null, null]);
  });
  test('Aquecimento com "% da WS" e os campos em branco: grava sem carga, sem erro nem aviso, e o "% da WS" segue marcado', () => {
    const s = tres();
    const com = percentuaisNoGrupo(s, agrupar(s)[0], 0, 40, 50, cfg);
    const sem = percentuaisNoGrupo(com, agrupar(com)[0], 0, null, null, cfg);
    const r = validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: sem }, cfg);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(escolhaDeCargaDoPapel(cfg, 'AQUECIMENTO', sem[0].carga?.modo ?? 'NENHUMA', 'kg', 'serie')).toMatchObject({ marcado: 'PERCENTUAL_WS' });
    // Escolher "% da WS" no Aquecimento grava "sem sugestão" até vir um número.
    const escolhido = alterarGrupo(s, agrupar(s)[0], { modo: modoAoEscolher('AQUECIMENTO', 'PERCENTUAL_WS') }, cfg);
    expect(escolhido.map((x) => x.carga)).toEqual([null, null, null]);
  });
  test('trocar Aquecimento e FS não deixa erro escondido: a carga é a do tipo novo, e o % vazio da FS continua erro', () => {
    const [aq] = agrupar(adicionarSerie([], cfg, codigo('AQUECIMENTO')));
    const fs = alterarGrupo(aq.series, aq, { tipo: codigo('PREPARACAO') }, cfg);
    expect(fs[0].carga?.modo).toBe('PERCENTUAL_WS');
    expect(validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: fs }, cfg).erros).toEqual([]);
    const fsVazia = percentuaisNoGrupo(fs, agrupar(fs)[0], 0, null, null, cfg);
    const erros = validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: fsVazia }, cfg).erros.map((e) => e.caminho);
    expect(erros).toContain('series[0].carga.percentualMin');
    const deVolta = alterarGrupo(fsVazia, agrupar(fsVazia)[0], { tipo: codigo('AQUECIMENTO') }, cfg);
    expect(deVolta[0].carga).toBeNull();
    expect(validarExercicio({ ...novoExercicio(), nome: 'Exercício', series: deVolta }, cfg).erros).toEqual([]);
  });
  test('FS em branco continua em % (a validação cobra)', () => {
    const s = adicionarSerie([], cfg, codigo('PREPARACAO'));
    const novas = percentuaisNoGrupo(s, agrupar(s)[0], 0, null, null, cfg);
    expect(novas[0].carga?.modo).toBe('PERCENTUAL_WS');
  });
});

describe('coluna Carga da tabela dos blocos', () => {
  test('% da WS, carga de trabalho, sem carga e carga fixa igual ou diferente', () => {
    let s = adicionarSerie([], cfg, codigo('PREPARACAO'));
    s = mudarQuantidade(s, agrupar(s)[0], 3, cfg);
    s = adicionarSerie(s, cfg);
    s = adicionarSerie(s, cfg, codigo('AQUECIMENTO'));
    const [fs, ws, aq] = agrupar(s);
    expect(cargaDoBloco(fs, cfg, 'kg')).toBe('50% · 70% · 85% a 90% da WS');
    expect(cargaDoBloco(ws, cfg, 'kg')).toBe('Carga de trabalho');
    expect(cargaDoBloco(aq, cfg, 'kg')).toBe('—');
    const fixa = (kg: number) => ({ ...ws.series[0], carga: { modo: 'CARGA_FIXA' as const, valorKg: kg, percentualMin: null, percentualMax: null } });
    expect(cargaDoBloco({ inicio: 0, series: [fixa(60), fixa(60)] }, cfg, 'kg')).toBe('60 kg');
    expect(cargaDoBloco({ inicio: 0, series: [fixa(60), fixa(70)] }, cfg, 'kg')).toBe('60 kg · 70 kg');
  });
});

describe('Para o aluno numa linha', () => {
  test('Aquecimento com % só na Série 1: um grupo, com o % dela e "—" nas outras', () => {
    const s = adicionarSerie([], cfg, codigo('AQUECIMENTO'));
    const tres = mudarQuantidade(s, agrupar(s)[0], 3, cfg);
    const novas = percentuaisNoGrupo(tres, agrupar(tres)[0], 0, 40, null, cfg);
    const grupos = agrupar(novas);
    expect(grupos).toHaveLength(1);
    expect(textoParaOAluno(grupos[0], cfg, 'kg')).toBe('3×10 a 15 · Aquecimento · 40% · — · — da WS');
    expect(previaDoGrupo(grupos[0], cfg, {}).linhas).toContain('Carga: 40% · — · — da WS');
  });
  test('3 FS e a WS', () => {
    let s = adicionarSerie([], cfg, codigo('PREPARACAO'));
    s = mudarQuantidade(s, agrupar(s)[0], 3, cfg);
    s = adicionarSerie(s, cfg);
    s = adicionarSerie(s, cfg, undefined, 'CLUSTER');
    const [fs, ws, cluster] = agrupar(s);
    expect(textoParaOAluno(fs, cfg, 'kg')).toBe('3×3 a 5 · FS · 50% · 70% · 85% a 90% da WS');
    expect(textoParaOAluno(ws, cfg, 'kg')).toBe('1×3 a 6 · WS · até a falha');
    expect(textoParaOAluno(cluster, cfg, 'kg')).toBe('1 série · WS com Cluster 15 s · até a falha');
  });
  test('Cluster com carga por bloco e Rest pause com retomadas: as etapas entram na linha', () => {
    const [ws] = agrupar(adicionarSerie([], cfg));
    const base = ws.series[0];
    const cluster = { ...base, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 4], pausaSegundos: 15, cargasDosBlocos: [{ modo: 'DA_SERIE' as const, percentual: null }, { modo: 'PERCENTUAL_WS' as const, percentual: 90 }] } };
    const texto = textoParaOAluno({ inicio: 0, series: [cluster] }, cfg, 'kg');
    expect(texto).toMatch(/ · Bloco 1: carga da série · Bloco 2: 90% da WS$/);
    const rest = { ...base, tecnica: { ...tecnicaVazia('REST_PAUSE'), pausaSegundos: 20, pausas: 2, retomadas: [
      { repsMin: 2, repsMax: 3, amrap: false, carga: { modo: 'DA_SERIE' as const, percentual: null } },
      { repsMin: null, repsMax: null, amrap: true, carga: { modo: 'PERCENTUAL_WS' as const, percentual: 85 } },
    ] } };
    expect(textoParaOAluno({ inicio: 0, series: [rest] }, cfg, 'kg')).toMatch(/ · Retomada 1: 2 a 3 reps, carga da série · Retomada 2: AMRAP, 85% da WS$/);
  });
  test('nome do tipo com " - " não quebra o resumo para o aluno', () => {
    const cfgComHifen = {
      ...cfg,
      tipos: cfg.tipos.map((t) => (t.codigo === codigo('PREPARACAO') ? { ...t, nome: 'FS - Força Especial' } : t)),
    };
    const s = adicionarSerie([], cfgComHifen, codigo('PREPARACAO'));
    const grupo = agrupar(s)[0];
    expect(textoParaOAluno(grupo, cfgComHifen, 'kg')).toBe('1×3 a 5 · FS - Força Especial · 85% da WS');
  });
});

describe('carga pendente (âmbar) × carga inválida (vermelho)', () => {
  const serie = (carga: object | null, tecnica?: object) => ({ carga, tecnica });
  it('o % vazio da carga em % da WS e os kg vazios da carga fixa são pendência', () => {
    expect(cargaPendente(serie({ modo: 'PERCENTUAL_WS', percentualMin: null }), 'carga.percentualMin')).toBe(true);
    expect(cargaPendente(serie({ modo: 'CARGA_FIXA', valorKg: null }), 'carga.valorKg')).toBe(true);
  });
  it('valor preenchido e fora da faixa continua erro', () => {
    expect(cargaPendente(serie({ modo: 'PERCENTUAL_WS', percentualMin: 0 }), 'carga.percentualMin')).toBe(false);
    expect(cargaPendente(serie({ modo: 'CARGA_FIXA', valorKg: -1 }), 'carga.valorKg')).toBe(false);
  });
  it('"carga fixa não leva percentual" (mínimo vazio, máximo preenchido) não é pendência', () => {
    expect(cargaPendente(serie({ modo: 'CARGA_FIXA', valorKg: 50, percentualMin: null, percentualMax: 80 }), 'carga.percentualMin')).toBe(false);
  });
  it('bloco do cluster e retomada sem carga são pendência, também pelo caminho do plano', () => {
    expect(cargaPendente(serie(null, { cargasDosBlocos: [{ modo: 'DA_SERIE' }, null] }), 'tecnica.cargasDosBlocos[1]')).toBe(true);
    expect(cargaPendente(serie(null, { retomadas: [{ carga: null }] }), 'tecnica.retomadas[0].carga')).toBe(true);
    expect(cargaPendente(serie(null, { cargasDosBlocos: [{ modo: 'PERCENTUAL_WS', percentual: null }] }), 'tecnica.cargasDosBlocos[0].percentual')).toBe(true);
    const plano = { sessoes: [{ exercicios: [{ series: [serie({ modo: 'CARGA_FIXA', valorKg: null })] }] }] };
    expect(cargaPendente(plano, 'sessoes[0].exercicios[0].series[0].carga.valorKg')).toBe(true);
  });
  it('outros campos vazios (tipo, repetições) não viram "Falta a carga"', () => {
    expect(cargaPendente({ tipo: null }, 'tipo')).toBe(false);
    expect(cargaPendente({ repsMin: null }, 'repsMin')).toBe(false);
  });
});
