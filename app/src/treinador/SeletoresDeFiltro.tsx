import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type RegraDeData, dataDaTelaNaFaixa } from '../dominio/datasValidas';
import { periodoDigitado, type Periodo } from '../dominio/filtrosComuns';
import { dataDaTela, dataParaTela } from '../dominio/formatos';
import { errosDoPeriodoDigitado } from '../dominio/painelDeFiltros';
import { espaco } from '../tema/tokens';
import { useProblemaNoPainel } from '../ui/BarraDeFiltros';
import { CampoData } from '../ui/Campos';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

/**
 * Peças dos painéis de filtros das listas (`ui/BarraDeFiltros`, `docs/planos/filtros-laterais.md`): a escolha de uma
 * opção (chips até oito, folha com busca acima disso) e o período De/Até.
 */

/** Escolha de uma opção num filtro: `Escolha` até oito opções, `EscolhaEmFolha` (com busca) acima disso. */
export function UmaOpcao<T extends string>({ rotulo, valor, opcoes, aoMudar }: {
  rotulo: string; valor: T; opcoes: readonly { valor: T; rotulo: string }[]; aoMudar: (v: T) => void;
}) {
  return opcoes.length > OPCOES_PARA_BUSCAR
    ? <EscolhaEmFolha rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} />
    : <Escolha rotulo={rotulo} opcoes={[...opcoes]} valor={valor} aoMudar={aoMudar} />;
}

interface RegrasDoCampo {
  /** As duas datas ou nenhuma (intervalo aberto não vale; só onde a tela já pedia isso, como Atualizações). */
  osDois?: boolean;
  maximoDias?: number;
  /**
   * Faixa das duas datas (`dominio/datasValidas`): fora dela o campo mostra a mensagem e o filtro em vigor não muda.
   * Sem `regra` as datas não são conferidas (os filtros do financeiro ficam como estão).
   */
  regra?: RegraDeData;
}

/**
 * O par De/Até digitado de um filtro, para as peças de período (`CamposDePeriodo`, o período do financeiro e o dos
 * Interessados). O texto fica aqui; o período só vai para quem usa quando os dois campos fazem sentido (vazio ou data
 * válida, fim depois do início; com `osDois`, as duas datas ou nenhuma; até `maximoDias`), então uma data pela metade não
 * apaga o filtro em vigor. Quando o período muda por fora (✕ do chip, "Limpar filtros"), os campos acompanham.
 *
 * Fora do painel lateral, e nele antes do primeiro "Aplicar filtros", os avisos são os de sempre: o fim antes do início no
 * Até, a data impossível ou fora da faixa pelo próprio campo e `aviso` (par, longo) como frase. No painel cada problema
 * (data pela metade, impossível ou fora da faixa, ordem, par, longo) conta para segurar o Aplicar (`useProblemaNoPainel`)
 * e, depois dele, aparece no campo dele (`aria-invalid`, que recebe o foco), sem a frase.
 */
export function usePeriodoDoFiltro({ rotulo, valor, aoMudar, osDois = false, maximoDias, regra }: RegrasDoCampo & {
  rotulo: string; valor: Periodo; aoMudar: (p: Periodo) => void;
}) {
  const ler = (t: string) => (regra ? dataDaTelaNaFaixa(t, regra) : dataDaTela(t));
  const chave = `${valor.de ?? ''}|${valor.ate ?? ''}`;
  const [texto, setTexto] = useState({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  // O período mudou por fora: os campos passam a mostrar o novo (padrão "ajustar o estado quando a prop muda").
  if (texto.chave !== chave) setTexto({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  const resultado = periodoDigitado(ler(texto.de), ler(texto.ate), osDois, maximoDias);
  const problema = 'problema' in resultado ? resultado.problema : null;
  const erros = errosDoPeriodoDigitado(texto.de, texto.ate, { osDois, maximoDias, regra, nomes: { de: `${rotulo}, data inicial`, ate: `${rotulo}, data final` } });
  const { mostrar } = useProblemaNoPainel((erros.de ? 1 : 0) + (erros.ate ? 1 : 0));
  const mudar = (campo: 'de' | 'ate', t: string) => {
    const novo = { ...texto, [campo]: t };
    setTexto(novo);
    const r = periodoDigitado(ler(novo.de), ler(novo.ate), osDois, maximoDias);
    if ('periodo' in r && (r.periodo.de !== valor.de || r.periodo.ate !== valor.ate)) aoMudar(r.periodo);
  };
  const aviso = mostrar ? null : problema === 'par' ? 'Preencha as duas datas.' : problema === 'longo' ? `Escolha um período de até ${maximoDias} dias.` : null;
  return {
    texto,
    mudar,
    erroDe: mostrar ? erros.de : null,
    erroAte: mostrar ? erros.ate : problema === 'ordem' ? 'Fim antes do início.' : null,
    aviso,
  };
}

/** Período De/Até de um filtro, De e Até empilhados quando não cabem lado a lado (`usePeriodoDoFiltro`). */
export function CamposDePeriodo({ rotulo = 'Período', valor, aoMudar, osDois, maximoDias, regra }: RegrasDoCampo & {
  rotulo?: string; valor: Periodo; aoMudar: (p: Periodo) => void;
}) {
  const p = usePeriodoDoFiltro({ rotulo, valor, aoMudar, osDois, maximoDias, regra });
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="De" nome={`${rotulo}, data inicial`} regra={regra} valor={p.texto.de} aoMudar={(t) => p.mudar('de', t)} erro={p.erroDe} />
        </View>
        <View style={estilos.data}>
          {/* Data impossível o próprio campo avisa ("Data inválida."). */}
          <CampoData rotulo="Até" nome={`${rotulo}, data final`} regra={regra} valor={p.texto.ate} aoMudar={(t) => p.mudar('ate', t)} erro={p.erroAte} />
        </View>
      </View>
      {p.aviso ? <Texto variante="pequeno">{p.aviso}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  periodo: { gap: espaco(1) },
  datas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  data: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
});
