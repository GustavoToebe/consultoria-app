import { Platform, StyleSheet, View } from 'react-native';

import type { DocumentoDeTermos, TermosVigentes } from '../api/tipos';
import { blocosDoDocumento, textoDosTrechos, type Trecho } from '../dominio/termos';
import { espaco, fontes, LARGURA_TEXTO_CORRIDO } from '../tema/tokens';
import { AlvoDeRolagem } from './AlvoDeRolagem';
import { Texto } from './Texto';

function Linha({ trechos, estilo }: { trechos: Trecho[]; estilo?: object }) {
  return (
    <Texto style={estilo}>
      {trechos.map((t, i) => (
        <Texto key={i} style={t.negrito ? estilos.negrito : undefined}>{t.texto}</Texto>
      ))}
    </Texto>
  );
}

/**
 * Termo de uso e aviso de privacidade um depois do outro (tela de aceite). Sem selo de rascunho: o aviso "Rascunho em
 * revisão" é só da equipe, na página de releitura (`TelaDosTermos`).
 */
export function TextosDosTermos({ termos }: { termos: TermosVigentes }) {
  return (
    <>
      {termos.documentos.map((d) => <DocumentoDosTermos key={d.id} documento={d} />)}
    </>
  );
}

/**
 * Um documento direto na página (sem cartão, 28/11): título em h2 e as seções em h3, em largura de leitura (~72
 * caracteres). Cada seção é destino do índice "Nesta página" (`AlvoDeRolagem`) e leva o `nativeID` (o `id` na web) que o
 * índice observa para destacar a seção visível. Também nas páginas públicas.
 */
export function DocumentoDosTermos({ documento: d }: { documento: DocumentoDeTermos }) {
  return (
    <View style={estilos.documento}>
      <Texto variante="subtitulo" nivel={2}>{d.titulo}</Texto>
      {blocosDoDocumento(d.id, d.texto).map((b, i) => {
        if (b.tipo === 'secao') {
          return (
            <AlvoDeRolagem key={i} chave={b.id ?? String(i)} style={estilos.secao}>
              <Texto variante="bloco" nivel={3} nativeID={b.id}>{textoDosTrechos(b.trechos)}</Texto>
            </AlvoDeRolagem>
          );
        }
        return b.tipo === 'item' ? (
          <View key={i} style={estilos.item}>
            <Texto aria-hidden>•</Texto>
            <Linha trechos={b.trechos} estilo={estilos.textoDoItem} />
          </View>
        ) : (
          <Linha key={i} trechos={b.trechos} />
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  documento: { gap: espaco(1), maxWidth: LARGURA_TEXTO_CORRIDO, width: '100%' },
  item: { flexDirection: 'row', gap: espaco(1), paddingLeft: espaco(1) },
  // O e-mail do contato (escrito pela equipe) é uma palavra só: na web quebra em qualquer ponto para não vazar em 390 px.
  textoDoItem: { flex: 1, minWidth: 0, ...(Platform.OS === 'web' ? ({ overflowWrap: 'anywhere' } as object) : null) },
  negrito: { fontFamily: fontes.semi },
  secao: { marginTop: espaco(2) },
});
