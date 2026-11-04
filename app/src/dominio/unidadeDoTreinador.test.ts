import { agrupar, descreverGrupo, descreverSeries } from './agrupamento';
import { modosDeCarga } from './editorTreino';
import { carga, serie } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { folhaRecordes } from './painelDoInicio';
import { previaDoGrupo } from './resumoDaSerie';
import { textoDaSerieComRecorde } from './retornoDoTreinador';
import { kgParaTela, telaParaKg } from './unidadeDeCarga';
import { mensagemDaCargaFixa, problemasDaCarga } from './validacaoDeSerie';
import { ajudaDaCarga } from '../treinador/treino/opcoesDoEditor';

/** Fase 2 das libras: o treinador lê e digita a carga na unidade dele; o plano continua em kg. */
const fixa = (kg: number) => serie('x', { tipo: 'WARM_UP', repsMin: 10, repsMax: 10, carga: { ...carga('CARGA_FIXA'), valorKg: kg } });

describe('carga fixa na unidade do treinador', () => {
  it('o resumo do grupo e do exercício saem em libra só quando pedido; o padrão é kg', () => {
    const series = [fixa(12)];
    const grupo = agrupar(series)[0];
    expect(descreverGrupo(grupo, CONFIGURACAO_PADRAO)).toContain('12 kg');
    expect(descreverGrupo(grupo, CONFIGURACAO_PADRAO, { unidade: 'lb' })).toContain('26,5 lb');
    expect(descreverSeries(series, CONFIGURACAO_PADRAO)[0]).toContain('12 kg');
    expect(descreverSeries(series, CONFIGURACAO_PADRAO, 'lb')[0]).toContain('26,5 lb');
  });

  it('a prévia "Para o aluno" do editor usa a mesma unidade', () => {
    const series = [fixa(12)];
    const grupo = agrupar(series)[0];
    expect(previaDoGrupo(grupo, CONFIGURACAO_PADRAO, {}).linhas).toContain('Carga: 12 kg');
    expect(previaDoGrupo(grupo, CONFIGURACAO_PADRAO, { unidade: 'lb' }).linhas).toContain('Carga: 26,5 lb');
  });

  it('o rótulo e a ajuda da forma "Carga fixa" falam a unidade; o valor da opção não muda', () => {
    const rotulos = (u?: 'kg' | 'lb') => {
      return modosDeCarga(CONFIGURACAO_PADRAO, 'TRABALHO', u).filter((o) => o.valor === 'CARGA_FIXA').map((o) => o.rotulo);
    };
    expect(rotulos()).toEqual(['Carga fixa (kg)']);
    expect(rotulos('lb')).toEqual(['Carga fixa (lb)']);
    expect(ajudaDaCarga('CARGA_FIXA', CONFIGURACAO_PADRAO)).toMatch(/^Os kg que você escreve/);
    expect(ajudaDaCarga('CARGA_FIXA', CONFIGURACAO_PADRAO, 'lb')).toMatch(/^Os lb que você escreve/);
  });

  it('o limite da carga fixa: a regra é a mesma, a mensagem sai no número que a pessoa lê', () => {
    expect(mensagemDaCargaFixa()).toBe('Carga fixa: maior que zero e até 1000 kg.');
    expect(mensagemDaCargaFixa('lb')).toBe('Carga fixa: maior que zero e até 2204,6 lb.');
    expect(problemasDaCarga({ modo: 'CARGA_FIXA', valorKg: 1000.01 }).valorKg).toBe(mensagemDaCargaFixa());
  });

  it('digitar em libra grava kg sem deriva (100 lb = 45,35 kg e volta 100; 60 kg mostra 132,3 e volta 60)', () => {
    expect(telaParaKg(100, 'lb')).toBe(45.35);
    expect(kgParaTela(45.35, 'lb')).toBe(100);
    expect(telaParaKg(kgParaTela(60, 'lb'), 'lb')).toBe(60);
    // O teto de 1000 kg digitado em libra cabe no que a API aceita (grade de 0,05 kg ou 2 casas).
    const kg = telaParaKg(2204.6, 'lb')!;
    expect(problemasDaCarga({ modo: 'CARGA_FIXA', valorKg: kg }).valorKg).toBeUndefined();
  });
});

describe('recordes e Início do treinador na unidade dele', () => {
  const recordes = [
    { tipo: 'MAIOR_CARGA' as const, carga: 70, repeticoes: 10, valor: 70 },
    { tipo: 'MAIOR_VOLUME' as const, carga: 70, repeticoes: 10, valor: 700 },
  ];
  it('textoDaSerieComRecorde', () => {
    expect(textoDaSerieComRecorde({ exercicioNome: 'Supino', recordes })).toBe('Supino: Maior carga · 70 kg · Maior volume · 700 kg');
    expect(textoDaSerieComRecorde({ exercicioNome: 'Supino', recordes }, 'lb')).toBe('Supino: Maior carga · 154,3 lb · Maior volume · 1543,2 lb');
  });
  it('folha de recordes do Início', () => {
    const r = { total: 1, series: [{ alunoId: 'a', alunoNome: 'Aluno Fictício', exercicioId: 'e', exercicioNome: 'Supino', data: '2026-11-03', recordes }] };
    expect(folhaRecordes(r, { meus: false, hoje: '2026-11-04' }).itens[0].detalhes).toEqual(['Maior carga · 70 kg', 'Maior volume · 700 kg']);
    expect(folhaRecordes(r, { meus: false, hoje: '2026-11-04', unidade: 'lb' }).itens[0].detalhes).toEqual(['Maior carga · 154,3 lb', 'Maior volume · 1543,2 lb']);
  });
});
