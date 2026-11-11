import { StyleSheet, View } from 'react-native';

import type { Totais } from '../dominio/dieta';
import { numeroParaTela, SEM_DADO } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import type { ChaveDeIdentificacao } from '../tema/tokens';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Os três macros com a marca de cor (guia premium pág. 10): proteína ciano, carboidrato azul, gordura violeta, das cores de
 * identificação (`useTema().identificacao`), nunca o verde e o vermelho de situação. A marca é decorativa: o nome (ou a
 * letra, nas linhas curtas) está sempre escrito ao lado. Uma peça só para o editor da dieta e a dieta do aluno.
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
            <Texto variante={variante} numerico style={estilo} aria-hidden>{`${m.curto} ${gramasNaTela(t[m.chave])}`}</Texto>
            <Texto style={estilos.soParaLeitor}>{macroPorExtenso(m.nome, t[m.chave])}</Texto>
          </View>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  valores: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  macros: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  inicio: { justifyContent: 'flex-start' },
  macro: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  marca: { width: 8, height: 8, borderRadius: 2 },
  forte: { fontFamily: fontes.semi },
  // Fora da vista e sem ocupar lugar, mas na árvore de acessibilidade (opacidade 0 continua sendo lida).
  soParaLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
