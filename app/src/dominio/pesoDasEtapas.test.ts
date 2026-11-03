import type { EtapaRegistrada } from '../api/tipos';
import { aplicarAcao } from './etapas';
import { chaveDaCarga, decidirCheckDaEtapa, dicaDaEtapa, pesoDoCampo, pesoJaDado, primeiroCheckFeito, type EtapaDaCarga } from './pesoDasEtapas';

const feita = (posicao: number, carga: number | null, repeticoes: number | null = 4): EtapaRegistrada => ({ posicao, repeticoes, carga, situacao: 'FEITA' });
const naoFeita = (posicao: number): EtapaRegistrada => ({ posicao, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' });
/** Cluster 4+4+4 sem carga própria (o caso comum). */
const tresBlocos: EtapaDaCarga[] = [1, 2, 3].map((posicao) => ({ posicao, carga: null }));

/** O ✓ de uma etapa pendente, como o cartão faz: o campo mostra `pesoDoCampo` e o painel olha `primeiroCheckFeito`. */
function check(posicao: number, etapas: EtapaRegistrada[], digitado?: number | null, previstas = tresBlocos, sugestaoKg: number | null = 60) {
  const carga = pesoDoCampo(digitado, pesoJaDado(posicao, previstas, etapas));
  return decidirCheckDaEtapa({ carga, repeticoes: 4, sugestaoKg, semCampoDePeso: false, primeiroCheckFeito: primeiroCheckFeito(posicao, previstas, etapas) });
}

describe('peso das etapas (Frente G, D17)', () => {
  it('a primeira etapa nasce vazia e o ✓ com o peso vazio abre o painel com a sugestão', () => {
    expect(pesoDoCampo(undefined, pesoJaDado(1, tresBlocos, []))).toBeNull();
    expect(check(1, [])).toEqual({ acao: 'PAINEL', sugestaoKg: 60 });
  });

  it('a segunda etapa da mesma série não abre o painel de novo, mesmo depois de "Sem carga"', () => {
    // Confirmou 60 kg no painel: o bloco 2 já mostra 60 e marca direto.
    expect(check(2, [feita(1, 60)])).toEqual({ acao: 'MARCAR', carga: 60, repeticoes: 4 });
    // Respondeu "Sem carga": o bloco 2 continua vazio e marca sem carga (nunca grava peso sem confirmação).
    expect(check(2, [feita(1, null)])).toEqual({ acao: 'MARCAR', carga: null, repeticoes: 4 });
  });

  it('confirmar preenche só as etapas vazias: o que o aluno digitou numa etapa não é sobrescrito', () => {
    const etapas = [feita(1, 60)];
    expect(pesoDoCampo(undefined, pesoJaDado(3, tresBlocos, etapas))).toBe(60);
    expect(pesoDoCampo(62.5, pesoJaDado(3, tresBlocos, etapas))).toBe(62.5);
    // Apagar o campo de propósito também vale: fica vazio, sem painel.
    expect(check(3, etapas, null)).toEqual({ acao: 'MARCAR', carga: null, repeticoes: 4 });
    // A etapa feita com outro peso (62,5) passa a ser a referência das seguintes; a feita antes não muda.
    const depois = [feita(1, 60), feita(2, 62.5)];
    expect(pesoJaDado(3, tresBlocos, depois)).toBe(62.5);
    expect(depois[0].carga).toBe(60);
  });

  it('digitar o peso no primeiro ✓ não abre o painel e preenche as seguintes', () => {
    expect(check(1, [], 55)).toEqual({ acao: 'MARCAR', carga: 55, repeticoes: 4 });
    expect(check(2, [feita(1, 55)])).toEqual({ acao: 'MARCAR', carga: 55, repeticoes: 4 });
  });

  it('"Não fiz" não é o primeiro ✓: a etapa seguinte com o peso vazio ainda pergunta', () => {
    expect(check(2, [naoFeita(1)])).toEqual({ acao: 'PAINEL', sugestaoKg: 60 });
  });

  it('reabrir a série concluída não reabre o painel; desfazer a única etapa feita recomeça a série', () => {
    const concluida = aplicarAcao({ etapas: [feita(1, 60), feita(2, 60), naoFeita(3)], concluida: true }, { tipo: 'REABRIR' }, 3, null)!;
    expect(check(3, concluida.etapas.filter((e) => e.posicao !== 3))).toEqual({ acao: 'MARCAR', carga: 60, repeticoes: 4 });
    // Desfazer o bloco 2 com o bloco 1 ainda feito: continua sem painel e com 60 kg no campo.
    const semOBloco2 = aplicarAcao({ etapas: [feita(1, 60), feita(2, 60)] }, { tipo: 'DESFAZER', posicao: 2 }, 3, null)!;
    expect(check(2, semOBloco2.etapas)).toEqual({ acao: 'MARCAR', carga: 60, repeticoes: 4 });
    // Desfazer a única etapa feita: a série volta ao começo e o próximo ✓ vazio pergunta de novo.
    const vazia = aplicarAcao({ etapas: [feita(1, 60)] }, { tipo: 'DESFAZER', posicao: 1 }, 3, null)!;
    expect(check(1, vazia.etapas)).toEqual({ acao: 'PAINEL', sugestaoKg: 60 });
  });

  it('sem sugestão ou sem campo de peso: nunca abre o painel nem grava peso', () => {
    expect(check(1, [], undefined, tresBlocos, null)).toEqual({ acao: 'MARCAR', carga: null, repeticoes: 4 });
    expect(decidirCheckDaEtapa({ carga: 40, repeticoes: 4, sugestaoKg: 60, semCampoDePeso: true, primeiroCheckFeito: false })).toEqual({ acao: 'MARCAR', carga: null, repeticoes: 4 });
  });

  it('etapa com carga própria em % da WS é outra carga: o primeiro ✓ dela pergunta, e o peso da série não a preenche', () => {
    const previstas: EtapaDaCarga[] = [{ posicao: 1, carga: null }, { posicao: 2, carga: { modo: 'PERCENTUAL_WS', percentual: 90 } }];
    expect(chaveDaCarga(previstas[1].carga)).toBe('PERCENTUAL:90');
    expect(chaveDaCarga({ modo: 'DA_SERIE', percentual: null })).toBe('SERIE');
    expect(pesoJaDado(2, previstas, [feita(1, 40)])).toBeNull();
    expect(check(2, [feita(1, 40)], undefined, previstas, 36)).toEqual({ acao: 'PAINEL', sugestaoKg: 36 });
  });

  it('dica ao lado do campo só com o campo vazio', () => {
    expect(dicaDaEtapa({ campoVazio: true, sugestaoKg: 60, cargaPropria: false, semCampoDePeso: false })).toBe('Sugestão: 60 kg');
    expect(dicaDaEtapa({ campoVazio: false, sugestaoKg: 60, cargaPropria: false, semCampoDePeso: false })).toBeNull();
    expect(dicaDaEtapa({ campoVazio: true, sugestaoKg: null, cargaPropria: true, semCampoDePeso: false })).toBe('Sem sugestão: informe a carga de trabalho');
    expect(dicaDaEtapa({ campoVazio: true, sugestaoKg: null, cargaPropria: false, semCampoDePeso: false })).toBeNull();
    expect(dicaDaEtapa({ campoVazio: true, sugestaoKg: 60, cargaPropria: false, semCampoDePeso: true })).toBeNull();
  });
});
