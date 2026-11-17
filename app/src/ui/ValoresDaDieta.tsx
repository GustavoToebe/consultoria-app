import { StyleSheet, View } from 'react-native';

import type { Totais } from '../dominio/dieta';
import { numeroParaTela, SEM_DADO } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import type { ChaveDeIdentificacao } from '../tema/tokens';
import { espaco, fontes } from '../tema/tokens';
import { CampoNumerico } from './Campos';
import { Texto } from './Texto';

/**
 * Os três macros com a marca de cor (guia premium pág. 10): proteína ciano, carboidrato azul, gordura violeta, das cores de
 * identificação (`useTema().identificacao`), nunca o verde e o vermelho de situação. A marca é decorativa: o nome (ou a
 * letra, nas linhas curtas) está sempre escrito ao lado. Uma peça só para o aluno e o treinador (editor e Biblioteca, guia
 * de 13/11 págs. 5 e 10): mesma cor, sigla e significado nos dois lados.
 */
export const MACROS = [
  { chave: 'proteina', nome: 'Proteína', curto: 'P', cor: 'CIANO' },
  { chave: 'carboidrato', nome: 'Carboidrato', curto: 'C', cor: 'AZUL' },
  { chave: 'gordura', nome: 'Gordura', curto: 'G', cor: 'VIOLETA' },
] as const satisfies readonly { chave: keyof Totais; nome: string; curto: string; cor: ChaveDeIdentificacao }[];

/** kcal sem casas; "—" sem valor (nunca zero inventado). */
export const kcalNaTela = (v: number | null) => (v === null ? SEM_DADO : numeroParaTela(v, 0));
/** Gramas sempre com uma casa ("30,0 g"), para a coluna alinhar; "—" sem valor, sem unidade. */
export const gramasNaTela = (v: number | null) => (v === null ? SEM_DADO : `${v.toFixed(1).replace('.', ',')} g`);
/** O que o leitor de tela diz no lugar da letra: "Proteína 4,0 g", "Gordura sem dado". */
export const macroPorExtenso = (nome: string, v: number | null) => `${nome} ${v === null ? 'sem dado' : gramasNaTela(v)}`;
/** A linha inteira para o leitor de tela, na ordem da tela: "233 kcal, proteína 10,2 g, carboidrato 34,8 g, gordura sem dado". */
export const valoresPorExtenso = (t: Totais) =>
  [t.kcal === null ? 'kcal sem dado' : `${kcalNaTela(t.kcal)} kcal`, ...MACROS.map((m) => macroPorExtenso(m.nome.toLowerCase(), t[m.chave]))].join(', ');

/**
 * Um total (subtotal da refeição, total da opção) numa frase só para o leitor de tela, "Total da opção A: 233 kcal,
 * proteína…", em vez de números soltos. Quem usa esconde do leitor o rótulo visível e a linha dos valores (`aria-hidden`).
 */
export function TotalParaLeitor({ rotulo, totais }: { rotulo: string; totais: Totais }) {
  return <Texto style={estilos.soParaLeitor}>{`${rotulo}: ${valoresPorExtenso(totais)}`}</Texto>;
}

/** Quadradinho de 8 px na cor do macro; sem a cor (tema de teste), não aparece. */
export function MarcaDoMacro({ cor }: { cor: ChaveDeIdentificacao }) {
  const { identificacao } = useTema();
  const c = identificacao?.[cor]?.cor;
  return c ? <View aria-hidden style={[estilos.marca, { backgroundColor: c }]} /> : null;
}

/**
 * Linha dos valores de um item ou de uma opção: kcal e P, C e G, números tabulares, cada macro com a marca. À direita no
 * editor (coluna), à esquerda (`inicio`) embaixo do nome na dieta do aluno. Sem espaço, os macros descem juntos.
 * A letra é só visual: o leitor de tela ouve o nome inteiro, num texto que não aparece (`aria-label` num texto solto não
 * é lido de forma confiável na web).
 */
export function ValoresDaDieta({ totais: t, forte = false, inicio = false }: { totais: Totais; forte?: boolean; inicio?: boolean }) {
  const estilo = forte ? estilos.forte : undefined;
  const variante = forte ? 'corpo' : 'pequeno';
  const lado = inicio ? estilos.inicio : null;
  return (
    <View style={[estilos.valores, lado]}>
      <Texto variante={variante} numerico style={estilo}>{`${kcalNaTela(t.kcal)} kcal`}</Texto>
      <View style={[estilos.macros, lado]}>
        {MACROS.map((m) => (
          <View key={m.chave} style={estilos.macro}>
            <MarcaDoMacro cor={m.cor} />
            <Texto variante={variante} numerico style={estilo} numberOfLines={1} aria-hidden>{`${m.curto} ${gramasNaTela(t[m.chave])}`}</Texto>
            <Texto style={estilos.soParaLeitor}>{macroPorExtenso(m.nome, t[m.chave])}</Texto>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Legenda das siglas com as marcas, uma vez por lista (nunca por linha): o mesmo texto da dieta do aluno. */
export function LegendaDosMacros() {
  return (
    <View style={[estilos.macros, estilos.inicio]}>
      {MACROS.map((m) => (
        <View key={m.chave} style={estilos.macro}>
          <MarcaDoMacro cor={m.cor} />
          <Texto variante="pequeno">{`${m.curto} = ${m.nome.toLowerCase()}`}</Texto>
        </View>
      ))}
    </View>
  );
}

/**
 * Campo de um macro com a marca da cor antes do rótulo ("P (g)" no item manual, "Proteína (g)" no alimento). O nome
 * acessível começa pelo texto visível (WCAG 2.5.3, quem fala "P (g)" acha o campo) e traz o nome inteiro quando o rótulo é
 * só a sigla: "P (g), proteína". A cor não entra na caixa nem no número.
 */
export function CampoDoMacro({ macro, rotulo, valor, aoMudar, erro }: {
  macro: (typeof MACROS)[number]; rotulo: string; valor: number | null; aoMudar: (v: number | null) => void; erro?: string | null;
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.campo}>
      <View style={estilos.macro} aria-hidden>
        <MarcaDoMacro cor={macro.cor} />
        <Texto variante="rotulo" cor={cores.texto} numberOfLines={1}>{rotulo}</Texto>
      </View>
      <CampoNumerico rotulo={rotulo} rotuloOculto rotuloAcessivel={rotulo.includes(macro.nome) ? rotulo : `${rotulo}, ${macro.nome.toLowerCase()}`} valor={valor} aoMudar={aoMudar} erro={erro} />
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  valores: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, minWidth: 0, justifyContent: 'flex-end', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  // `flexShrink: 1` e `minWidth: 0`: sem eles a linha dos macros não quebra e passa por baixo do botão ao lado (390 px).
  macros: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, minWidth: 0, justifyContent: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  inicio: { justifyContent: 'flex-start' },
  // Marca e "P 2,5 g" andam juntas: o macro inteiro passa para a linha de baixo, nunca se parte.
  macro: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: espaco(0.5) },
  marca: { width: 8, height: 8, borderRadius: 2 },
  forte: { fontFamily: fontes.semi },
  // Fora da vista e sem ocupar lugar, mas na árvore de acessibilidade (opacidade 0 continua sendo lida).
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
