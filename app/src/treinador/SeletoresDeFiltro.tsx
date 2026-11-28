import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { atalhosQueCabem, periodoDoAtalho } from '../dominio/atalhosDePeriodo';
import { type RegraDeData, dataDaTelaNaFaixa } from '../dominio/datasValidas';
import { hojeEmBrasilia } from '../dominio/financeiro';
import { periodoDigitado, type Periodo } from '../dominio/filtrosComuns';
import { dataDaTela, dataParaTela } from '../dominio/formatos';
import { errosDoPeriodoDigitado } from '../dominio/painelDeFiltros';
import { espaco } from '../tema/tokens';
import { useProblemaNoPainel } from '../ui/BarraDeFiltros';
import { Botao } from '../ui/Botao';
import { CampoData } from '../ui/Campos';
import { ChipsDeUmaOpcao, type OpcaoDoChip } from '../ui/ChipsDeFiltro';
import { ParDeDatas } from '../ui/CamposEmLinha';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

/**
 * Peças dos painéis de filtros das listas (`ui/BarraDeFiltros`, `docs/planos/filtros-laterais.md`; regra única dos
 * filtros de 28/11 em `docs/design-e-front.md` P2): a escolha de uma opção e o período De/Até com atalhos.
 */

/** Rótulo curto o bastante para o segmento (que nunca quebra linha). */
const ROTULO_CURTO = 16;

/**
 * Escolha de uma opção num filtro, pela regra única: 2 ou 3 opções curtas = segmento na largura toda (nunca quebra a
 * linha); mais opções ou rótulos longos = chips de uma escolha sem o chip "Todos" (`todos`, por padrão a primeira opção,
 * é o valor de nada escolhido, e tocar no escolhido volta a ele); acima de oito, a folha com busca (`EscolhaEmFolha`).
 */
export function UmaOpcao<T extends string>({ rotulo, valor, opcoes, aoMudar, todos }: {
  rotulo: string; valor: T; opcoes: readonly OpcaoDoChip<T>[]; aoMudar: (v: T) => void;
  /** O valor de "nada filtrado" (a opção "Todos", "Todas", "Qualquer"); sem ele, a primeira opção. */
  todos?: T;
}) {
  if (opcoes.length > OPCOES_PARA_BUSCAR) return <EscolhaEmFolha rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} />;
  const vazio = todos ?? opcoes[0]?.valor ?? ('' as T);
  // O segmento precisa da opção "Todos" à vista; os chips a tiram (nada escolhido = todos).
  if (opcoes.some((o) => o.valor === vazio) && opcoes.length <= 3 && opcoes.every((o) => o.rotulo.length <= ROTULO_CURTO && !o.tom && !o.cor)) {
    return <Escolha rotulo={rotulo} opcoes={[...opcoes]} valor={valor} aoMudar={aoMudar} segmentosIguais />;
  }
  return <ChipsDeUmaOpcao rotulo={rotulo} opcoes={opcoes.filter((o) => o.valor !== vazio)} valor={valor} todos={vazio} aoMudar={aoMudar} />;
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
 * O par De/Até digitado de um filtro, para as peças de período (`CamposDePeriodo` e o período do financeiro). O texto fica aqui; o período só vai para quem usa quando os dois campos fazem sentido (vazio ou data
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

/**
 * Período de um filtro (P2 de `docs/design-e-front.md` 4.6): o rótulo do filtro à vista ("Entrada"), as duas datas no
 * `ParDeDatas` de filtro, cada uma com o rótulo "De" ou "Até" à vista (WCAG 3.3.2), e embaixo os atalhos Hoje · 7 dias ·
 * 30 dias · Este mês · Mês passado (`dominio/atalhosDePeriodo`, hoje de Brasília). Regra 17 do Gustavo (28/11): atalho que
 * preenche campo é **botão comum** (`Botao secundario pequeno`, alvo de 44, sem `aria-pressed`, sem ✓ e sem estado de
 * escolhido): o valor mora nos campos; tocar preenche De e Até e leva o foco ao De. Com `maximoDias`, o atalho mais longo
 * que o limite não aparece. `nomeUnico`: vários períodos no mesmo painel ganham nomes para o leitor de tela "De
 * (Entrada)" e "Até (Entrada)", que seguem começando pelo texto visível. Texto, sincronização e erros são os de
 * `usePeriodoDoFiltro`; aqui só o desenho.
 */
export function CamposDePeriodo({ rotulo = 'Período', valor, aoMudar, osDois, maximoDias, regra, nomeUnico }: RegrasDoCampo & {
  rotulo?: string; valor: Periodo; aoMudar: (p: Periodo) => void; nomeUnico?: boolean;
}) {
  const p = usePeriodoDoFiltro({ rotulo, valor, aoMudar, osDois, maximoDias, regra });
  const campoDe = useRef<TextInput>(null);
  const hoje = hojeEmBrasilia();
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <ParDeDatas variante="filtro">
        <CampoData ref={campoDe} rotulo="De" rotuloDiscreto rotuloAcessivel={nomeUnico ? `De (${rotulo})` : undefined} nome={`${rotulo}, data inicial`} regra={regra} valor={p.texto.de} aoMudar={(t) => p.mudar('de', t)} erro={p.erroDe} />
        {/* Data impossível ou fora da faixa o próprio campo avisa ("Entrada, data final: use uma data entre…"). */}
        <CampoData rotulo="Até" rotuloDiscreto rotuloAcessivel={nomeUnico ? `Até (${rotulo})` : undefined} nome={`${rotulo}, data final`} regra={regra} valor={p.texto.ate} aoMudar={(t) => p.mudar('ate', t)} erro={p.erroAte} />
      </ParDeDatas>
      {p.aviso ? <Texto variante="pequeno">{p.aviso}</Texto> : null}
      {/* O nome acessível começa pelo texto à vista (WCAG 2.5.3) e diz de qual período é ("7 dias (Entrada)"). */}
      <View style={estilos.atalhos} role="group" aria-label={`Atalhos de ${rotulo}`}>
        {atalhosQueCabem(maximoDias, hoje).map((a) => (
          <Botao key={a.valor} rotulo={a.rotulo} rotuloAcessivel={`${a.rotulo} (${rotulo})`} tipo="secundario" tamanho="pequeno"
            aoTocar={() => { aoMudar(periodoDoAtalho(a.valor, hoje)); campoDe.current?.focus(); }} />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  periodo: { gap: espaco(1) },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(0.75) },
});
