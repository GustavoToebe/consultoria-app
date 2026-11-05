import { agrupar } from '../../dominio/agrupamento';
import { adicionarSerie, alterarGrupo, mudarQuantidade, novoExercicio, tecnicaVazia } from '../../dominio/editorTreino';
import { validarExercicio } from '../../dominio/validacaoDoTreino';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { escolhaDeCargaDoPapel, modoAoEscolher, OPCOES_DO_RIR, percentuaisNoGrupo, textoParaOAluno } from './cargaDaSerie';

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
  test('o primeiro % passa o grupo todo para % da WS, sem partir o grupo', () => {
    const s = tres();
    const novas = percentuaisNoGrupo(s, agrupar(s)[0], 1, 40, null, cfg);
    expect(novas.map((x) => x.carga?.modo)).toEqual(['PERCENTUAL_WS', 'PERCENTUAL_WS', 'PERCENTUAL_WS']);
    expect(novas.map((x) => x.carga?.percentualMin)).toEqual([null, 40, null]);
    expect(agrupar(novas)).toHaveLength(1);
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

describe('Para o aluno numa linha', () => {
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
});
