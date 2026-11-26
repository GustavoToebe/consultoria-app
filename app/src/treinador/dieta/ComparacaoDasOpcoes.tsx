import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OpcaoRefeicao } from '../../api/tipos';
import type { TotaisComFibra } from '../../dominio/dieta';
import { CONTA_NO_TOTAL, gramasSemUnidade, letraDoMarcador, tituloDaOpcao, totaisDaOpcao } from '../../dominio/opcoesDaRefeicao';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, LARGURA_DA_ALCA, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { MarcadorDeOpcao } from '../../ui/MarcadorDeOpcao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { FIBRA, fibraParcial, kcalNaTela, MACROS, MarcaDoMacro, type CorDoMacro, valoresPorExtenso } from '../../ui/ValoresDaDieta';
import type { ReordenarOpcoes } from './AbasDeOpcao';

/**
 * Colunas dos números, na ordem da tabela de alimentos: kcal, P, C, G e a fibra (cada uma com a marca, menos a kcal). No
 * celular (colunas de ~45 px) o título vai sem o "(g)" (`curto`), para caber numa linha como os outros (25/11: "Fibras
 * (g)" quebrava em duas).
 */
const COLUNAS: readonly { chave: keyof TotaisComFibra & ('kcal' | 'proteina' | 'carboidrato' | 'gordura' | 'fibra'); rotulo: string; curto: string; cor?: CorDoMacro }[] = [
  { chave: 'kcal', rotulo: 'Kcal', curto: 'Kcal' },
  ...MACROS.map((m) => ({ chave: m.chave, rotulo: `${m.curto} (g)`, curto: m.curto, cor: m.cor })),
  { chave: 'fibra', rotulo: 'Fibras (g)', curto: 'Fibra', cor: FIBRA.cor },
];
/** Abaixo disto (celular) a primeira coluna fica só com a letra e o selo da primeira opção desce para baixo da linha. */
const LARGURA_COMPACTA = 520;
const RECUO = espaco(1) + 1;

/** Medidas da tabela de alimentos, para os números da comparação caírem embaixo das mesmas colunas (opção larga). */
export interface ColunasDaTabela {
  /** Larguras das colunas Kcal, P, C, G e Fibras, na ordem. */
  larguras: readonly number[];
  /** Largura das ações no fim da linha (o ⋯). */
  fim: number;
  /** O vão entre as colunas da tabela de alimentos. */
  vao: number;
}

/**
 * Faixa de comparação das opções (19/11, só com duas ou mais): uma linha por opção com o total de cada uma, os números à
 * direita e as marcas de macro no cabeçalho. Só mostra o total de cada opção (nada é calculado entre elas). A linha é o
 * atalho para abrir a aba da opção; a aberta fica marcada pelo fundo neutro (`superficie2`) e pelo círculo preenchido, o
 * mesmo da aba. Com `colunas` (a
 * opção em tabela), cada número fica embaixo da coluna dele na tabela de alimentos; sem, as colunas se dividem. Com
 * `reordenar` (26/11), cada linha tem a alça ⠿ antes dela, fora do botão (a mesma peça e a mesma ordem das abas).
 */
export function ComparacaoDasOpcoes({ opcoes, aberta, aoAbrir, colunas, reordenar }: {
  opcoes: OpcaoRefeicao[]; aberta: string; aoAbrir: (uid: string) => void; colunas?: ColunasDaTabela; reordenar?: ReordenarOpcoes;
}) {
  const { cores } = useTema();
  // O vão entre as linhas é de 2 px: a linha guia fica no meio dele.
  const arraste = useArrasteDaLista({ total: reordenar ? opcoes.length : 0, folga: 1, aoSoltar: (de, para) => reordenar?.aoSoltar(de, para), mensagem: reordenar?.mensagem });
  const comAlca = !!arraste.ativo;
  // Mouse em cima ou apertada: o fundo vai na linha inteira (com a alça), como o da aberta.
  const [sobreUid, setSobreUid] = useState<string | null>(null);
  const sair = (uid: string) => setSobreUid((u) => (u === uid ? null : u));
  const [largura, setLargura] = useState(0);
  const compacta = largura > 0 && largura < LARGURA_COMPACTA;
  const coluna = (i: number) => (colunas ? { width: colunas.larguras[i] } : estilos.numero);
  const fim = colunas ? <View style={{ width: colunas.fim }} /> : null;
  const vao = colunas ? { columnGap: colunas.vao } : null;
  return (
    <View role="group" aria-label="Comparação das opções" style={estilos.tabela} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {/* O cabeçalho é só visual: cada linha diz ao leitor de tela os valores por extenso. */}
      <View aria-hidden style={[estilos.linha, compacta && estilos.linhaJusta, vao, estilos.cabecalho,
        comAlca ? (compacta ? estilos.cabecalhoJustoComAlca : estilos.cabecalhoComAlca) : null, { borderBottomColor: cores.divisor }]}>
        <View style={compacta ? estilos.letra : estilos.nome}><Texto variante="rotulo">Opção</Texto></View>
        {COLUNAS.map((c, ci) => (
          <View key={c.chave} style={[coluna(ci), estilos.celulaDoCabecalho]}>
            {c.cor ? <MarcaDoMacro cor={c.cor} /> : null}
            <Texto variante="rotulo" numberOfLines={1} style={estilos.encolhe}>{compacta ? c.curto : c.rotulo}</Texto>
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
          <ItemArrastavel key={o.uid} arraste={arraste} indice={i}
            style={[estilos.comAlca, { backgroundColor: sel ? cores.superficie2 : sobreUid === o.uid ? cores.sobre : 'transparent' }]}>
          <AlcaDeArraste arraste={arraste} indice={i} />
          <Pressable accessibilityRole="button" accessibilityLabel={nome} accessibilityHint="Abre a opção nas abas."
            aria-current={sel ? 'true' : undefined} onPress={() => aoAbrir(o.uid)}
            onHoverIn={() => setSobreUid(o.uid)} onHoverOut={() => sair(o.uid)} onPressIn={() => setSobreUid(o.uid)} onPressOut={() => sair(o.uid)}
            style={[estilos.opcao, comAlca ? estilos.opcaoComAlca : null]}>
            <View style={[estilos.linha, compacta && estilos.linhaJusta, vao]}>
              <View style={compacta ? (comAlca ? estilos.letraComAlca : estilos.letra) : estilos.nome}>
                {/* O círculo com a letra, como nas abas (preenchido na aberta); no celular, só ele. */}
                <MarcadorDeOpcao letra={letraDoMarcador(o.rotulo)} selecionado={sel} />
                {compacta ? null : <Texto style={[estilos.textoDoNome, { fontFamily: sel ? fontes.negrito : fontes.medio }]}>{tituloDaOpcao(o)}</Texto>}
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
          </ItemArrastavel>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: 2 },
  // Sem a tabela, 8 de vão; no celular, 6; com ela, o vão da tabela de alimentos (`colunas.vao`), para as colunas baterem.
  linha: { flexDirection: 'row', alignItems: 'center', columnGap: espaco(1) },
  linhaJusta: { columnGap: espaco(0.75) },
  // O recuo é o da faixa do item (8 + o contorno de 1), para as colunas baterem com as da tabela de alimentos.
  cabecalho: { paddingHorizontal: RECUO, paddingBottom: espaco(0.5), borderBottomWidth: 1 },
  celulaDoCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(0.5) },
  opcao: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: RECUO, paddingVertical: espaco(0.5), borderRadius: RAIO_CONTROLE },
  // Com a alça (24) antes do botão, o começo do cabeçalho anda o mesmo para "Opção" ficar sobre as letras; o botão perde o
  // recuo da esquerda (a alça já afasta) e a linha inteira leva o fundo da aberta.
  comAlca: { flexDirection: 'row', alignItems: 'stretch', borderRadius: RAIO_CONTROLE },
  opcaoComAlca: { flex: 1, minWidth: 0, paddingLeft: 0 },
  cabecalhoComAlca: { paddingLeft: LARGURA_DA_ALCA },
  // No celular, "Opção" fica sobre a alça e o círculo (48 = 24 + 24): os números não perdem largura para a alça.
  cabecalhoJustoComAlca: { paddingLeft: 0 },
  letraComAlca: { width: LARGURA_DA_ALCA },
  // O nome cresce; cada número fica numa coluna de 48 a 96 px, alinhada à direita.
  nome: { flexGrow: 3, flexBasis: 0, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2 },
  // "Opção" inteiro no cabeçalho; no celular (~300 px úteis) sobram 5 colunas de 40 px ou mais.
  letra: { width: 48 },
  numero: { flexGrow: 1, flexBasis: 0, minWidth: 40, maxWidth: 96 },
  aoFim: { alignItems: 'flex-end' },
  textoDoNome: { fontSize: 15 },
  valor: { fontSize: 14, lineHeight: 20 },
  aDireita: { textAlign: 'right' },
  // Uma linha, colada à marca (como na tabela de alimentos).
  encolhe: { flexShrink: 1, textAlign: 'left' },
  seloAbaixo: { flexDirection: 'row', marginTop: 2 },
});
