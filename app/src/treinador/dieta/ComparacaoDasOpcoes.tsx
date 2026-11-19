import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OpcaoRefeicao } from '../../api/tipos';
import type { TotaisComFibra } from '../../dominio/dieta';
import { CONTA_NO_TOTAL, gramasSemUnidade, tituloDaOpcao, totaisDaOpcao } from '../../dominio/opcoesDaRefeicao';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { FIBRA, fibraParcial, kcalNaTela, MACROS, MarcaDoMacro, type CorDoMacro, valoresPorExtenso } from '../../ui/ValoresDaDieta';

/** Colunas dos números, na ordem da tabela de alimentos: kcal, P, C, G e a fibra (cada uma com a marca, menos a kcal). */
const COLUNAS: readonly { chave: keyof TotaisComFibra & ('kcal' | 'proteina' | 'carboidrato' | 'gordura' | 'fibra'); rotulo: string; cor?: CorDoMacro }[] = [
  { chave: 'kcal', rotulo: 'Kcal' },
  ...MACROS.map((m) => ({ chave: m.chave, rotulo: `${m.curto} (g)`, cor: m.cor })),
  { chave: 'fibra', rotulo: 'Fibras (g)', cor: FIBRA.cor },
];
/** Abaixo disto (celular) a primeira coluna fica só com a letra e o selo da primeira opção desce para baixo da linha. */
const LARGURA_COMPACTA = 520;
const RECUO = espaco(1) + 1;

/** Medidas da tabela de alimentos, para os números da comparação caírem embaixo das mesmas colunas (opção larga). */
export interface ColunasDaTabela {
  /** Larguras das colunas Kcal, P, C, G e Fibras, na ordem. */
  larguras: readonly number[];
  /** Largura das ações no fim da linha (o ⋯ e a lixeira). */
  fim: number;
}

/**
 * Faixa de comparação das opções (19/11, só com duas ou mais): uma linha por opção com o total de cada uma, os números à
 * direita e as marcas de macro no cabeçalho. Só mostra o total de cada opção (nada é calculado entre elas). A linha é o
 * atalho para abrir a aba da opção; a aberta fica marcada em neutro (`superficie2`), sem cor de ação. Com `colunas` (a
 * opção em tabela), cada número fica embaixo da coluna dele na tabela de alimentos; sem, as colunas se dividem.
 */
export function ComparacaoDasOpcoes({ opcoes, aberta, aoAbrir, colunas }: {
  opcoes: OpcaoRefeicao[]; aberta: string; aoAbrir: (uid: string) => void; colunas?: ColunasDaTabela;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const compacta = largura > 0 && largura < LARGURA_COMPACTA;
  const coluna = (i: number) => (colunas ? { width: colunas.larguras[i] } : estilos.numero);
  const fim = colunas ? <View style={{ width: colunas.fim }} /> : null;
  return (
    <View role="group" aria-label="Comparação das opções" style={estilos.tabela} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {/* O cabeçalho é só visual: cada linha diz ao leitor de tela os valores por extenso. */}
      <View aria-hidden style={[estilos.linha, compacta && estilos.linhaJusta, estilos.cabecalho, { borderBottomColor: cores.divisor }]}>
        <View style={compacta ? estilos.letra : estilos.nome}><Texto variante="rotulo">Opção</Texto></View>
        {COLUNAS.map((c, ci) => (
          <View key={c.chave} style={[coluna(ci), estilos.celulaDoCabecalho]}>
            {c.cor ? <MarcaDoMacro cor={c.cor} /> : null}
            <Texto variante="rotulo" style={estilos.aDireita}>{c.rotulo}</Texto>
          </View>
        ))}
        {fim}
      </View>
      {opcoes.map((o, i) => {
        const t = totaisDaOpcao(o);
        const sel = o.uid === aberta;
        const selo = i === 0 ? <Selo texto={CONTA_NO_TOTAL} /> : null;
        const nome = `${tituloDaOpcao(o)}: ${t ? valoresPorExtenso(t) : 'vazia'}${i === 0 ? `, ${CONTA_NO_TOTAL.toLowerCase()}` : ''}`;
        return (
          <Pressable key={o.uid} accessibilityRole="button" accessibilityLabel={nome} accessibilityHint="Abre a opção nas abas."
            aria-current={sel ? 'true' : undefined} onPress={() => aoAbrir(o.uid)}
            style={(st) => [estilos.opcao, { backgroundColor: sel ? cores.superficie2 : sobre(st) ? cores.sobre : 'transparent' }]}>
            <View style={[estilos.linha, compacta && estilos.linhaJusta]}>
              <View style={compacta ? estilos.letra : estilos.nome}>
                <Texto style={[estilos.textoDoNome, { fontFamily: sel ? fontes.semi : fontes.medio }]}>{compacta ? o.rotulo : tituloDaOpcao(o)}</Texto>
                {compacta ? null : selo}
              </View>
              {COLUNAS.map((c, ci) => {
                const v = t ? t[c.chave] ?? null : null;
                return (
                  <View key={c.chave} style={[coluna(ci), estilos.aoFim]}>
                    <Texto numerico cor={cores.texto} style={[estilos.valor, estilos.aDireita]}>{c.chave === 'kcal' ? kcalNaTela(v) : gramasSemUnidade(v)}</Texto>
                    {c.chave === 'fibra' && t && fibraParcial(t) ? <Texto variante="pequeno" style={estilos.aDireita}>parcial</Texto> : null}
                  </View>
                );
              })}
              {fim}
            </View>
            {compacta && selo ? <View style={estilos.seloAbaixo}>{selo}</View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: 2 },
  // O vão da tabela de alimentos (8), para as colunas baterem; no celular, 6.
  linha: { flexDirection: 'row', alignItems: 'center', columnGap: espaco(1) },
  linhaJusta: { columnGap: espaco(0.75) },
  // O recuo é o da faixa do item (8 + o contorno de 1), para as colunas baterem com as da tabela de alimentos.
  cabecalho: { paddingHorizontal: RECUO, paddingBottom: espaco(0.5), borderBottomWidth: 1 },
  celulaDoCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(0.5) },
  opcao: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: RECUO, paddingVertical: espaco(0.5), borderRadius: RAIO_CONTROLE },
  // O nome cresce; cada número fica numa coluna de 48 a 96 px, alinhada à direita.
  nome: { flexGrow: 3, flexBasis: 0, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2 },
  // "Opção" inteiro no cabeçalho; no celular (~300 px úteis) sobram 5 colunas de 40 px ou mais.
  letra: { width: 48 },
  numero: { flexGrow: 1, flexBasis: 0, minWidth: 40, maxWidth: 96 },
  aoFim: { alignItems: 'flex-end' },
  textoDoNome: { fontSize: 15 },
  valor: { fontSize: 14, lineHeight: 20 },
  aDireita: { textAlign: 'right' },
  seloAbaixo: { flexDirection: 'row', marginTop: 2 },
});
