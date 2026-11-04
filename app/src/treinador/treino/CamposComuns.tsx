import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';
import { FORMAS_DAS_REPETICOES, formaVisivel, repeticoesNaForma, type FormaDasRepeticoes, type Repeticoes } from './opcoesDoEditor';

/** As peças de layout e de erro que os campos de prescrição dividem, e as repetições (série, metodologia e retomada). */

/** PC (a partir do menu lateral): campos curtos lado a lado. Celular: um embaixo do outro, na largura toda. */
export function useCamposLadoALado(): boolean {
  return useWindowDimensions().width >= LARGURA_MENU_LATERAL;
}

/** Campos curtos (números) numa linha que quebra no PC; empilhados no celular. Cada filho vira uma célula. */
export function LinhaDeCampos({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.linha : estilos.bloco}>
    {Children.toArray(children).map((filho, i) => <View key={i} style={largo ? estilos.campo : null}>{filho}</View>)}
  </View>;
}

/** Um campo curto sozinho: no PC não estica além de uma célula; no celular, largura toda como os outros. */
export function CampoSozinho({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.sozinho : null}>{children}</View>;
}

/** Erro de um campo que não é de digitar (escolha de chips). */
export function ErroDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{mensagem}</Texto> : null;
}

/** Aviso de um campo: aparece, mas não bloqueia. */
export function AvisoDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.atencao}>{mensagem}</Texto> : null;
}

// ---- Repetições ----

/**
 * Quantidade exata, faixa ou AMRAP. A escolha fica com a tela enquanto o valor não a distingue (faixa 8 a 8, ou vazio).
 * `semRepeticoes` explica o vazio quando ele vale (série por tempo); sem ele, o vazio é só incompleto.
 */
export function CamposDasRepeticoes({ valor, aoMudar, erros, rotulo = 'Repetições', rotuloVisivel = true, semRepeticoes }: {
  valor: { repsMin?: number | null; repsMax?: number | null; amrap?: boolean | null }; aoMudar: (r: Repeticoes) => void;
  erros: Problemas; rotulo?: string; semRepeticoes?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
}) {
  const [escolhida, setEscolhida] = useState<FormaDasRepeticoes>(formaVisivel('EXATA', valor));
  const forma = formaVisivel(escolhida, valor);
  const mudarForma = (f: FormaDasRepeticoes) => {
    setEscolhida(f);
    if (f !== forma) aoMudar(repeticoesNaForma(f, valor));
  };
  const vazio = valor.repsMin == null && valor.repsMax == null && !valor.amrap;
  // Com rótulo próprio (uma retomada), os campos ganham o nome dela no leitor de tela: "Retomada 1: reps mín.".
  const proprio = rotulo !== 'Repetições';
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={FORMAS_DAS_REPETICOES} valor={forma} aoMudar={mudarForma} />
    {forma === 'EXATA' ? <CampoSozinho>
      <CampoNumerico rotulo="Repetições" rotuloAcessivel={proprio ? `${rotulo}: repetições` : undefined} inteiro valor={valor.repsMin ?? valor.repsMax ?? null}
        aoMudar={(n) => aoMudar({ repsMin: n, repsMax: n, amrap: false })} erro={erros.repsMin ?? erros.repsMax} />
    </CampoSozinho> : null}
    {forma === 'FAIXA' ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps mín." rotuloAcessivel={proprio ? `${rotulo}: reps mín.` : undefined} inteiro valor={valor.repsMin ?? null}
        aoMudar={(repsMin) => aoMudar({ repsMin, repsMax: valor.repsMax ?? null, amrap: false })} erro={erros.repsMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." rotuloAcessivel={proprio ? `${rotulo}: reps máx.` : undefined} inteiro valor={valor.repsMax ?? null}
        aoMudar={(repsMax) => aoMudar({ repsMin: valor.repsMin ?? null, repsMax, amrap: false })} erro={erros.repsMax} /></View>
    </View> : null}
    {forma === 'AMRAP' ? <Texto variante="pequeno">O aluno faz o máximo de repetições que conseguir e anota quantas fez.</Texto> : null}
    <ErroDoCampo mensagem={forma === 'AMRAP' ? erros.amrap : null} />
    {vazio && forma !== 'AMRAP' && semRepeticoes ? <Texto variante="pequeno">{semRepeticoes}</Texto> : null}
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  sozinho: { width: '100%', maxWidth: 220 },
});
