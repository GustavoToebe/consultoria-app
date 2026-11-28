import { Info } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LARGURA_TEXTO_CORRIDO, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';
import { blocosDoTexto, type Trecho } from './blocos';

/** Entrelinha de leitura (texto corrido longo): 1,6 da fonte do corpo, em vez dos 1,4 da interface. */
const ENTRELINHA = 24;

function Trechos({ trechos }: { trechos: readonly Trecho[] }) {
  return trechos.map((t, i) => (t.negrito ? <Texto key={i} style={estilos.negrito}>{t.texto}</Texto> : t.texto));
}

/**
 * O texto de um tópico da Ajuda em blocos (`blocos.ts`): parágrafos curtos, passos numerados, marcadores e nota com
 * ícone, tudo na largura de leitura (~72 caracteres). As listas são listas para o leitor de tela (`ul`/`li`); o número
 * do passo é lido (a lista não diz que é ordenada), o marcador "•" não.
 */
export function TextoDaAjuda({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.blocos}>
      {blocosDoTexto(texto).map((b, i) => {
        if (b.tipo === 'p') return <Texto key={i} style={estilos.paragrafo}><Trechos trechos={b.trechos} /></Texto>;
        if (b.tipo === 'nota') {
          return (
            <View key={i} style={[estilos.nota, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Info size={18} color={cores.textoSuave} aria-hidden style={estilos.iconeDaNota} />
              <Texto style={[estilos.paragrafo, estilos.textoDaNota]}><Trechos trechos={b.trechos} /></Texto>
            </View>
          );
        }
        return (
          <View key={i} role="list" style={estilos.lista}>
            {b.itens.map((item, n) => (
              <View key={n} role="listitem" style={estilos.itemDaLista}>
                <Texto numerico={b.tipo === 'passos'} aria-hidden={b.tipo === 'lista'} style={[estilos.marca, { color: cores.textoSuave }]}>
                  {b.tipo === 'passos' ? `${n + 1}.` : '•'}
                </Texto>
                <Texto style={[estilos.paragrafo, estilos.textoDoItem]}><Trechos trechos={item} /></Texto>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(1.5), maxWidth: LARGURA_TEXTO_CORRIDO },
  paragrafo: { lineHeight: ENTRELINHA },
  negrito: { fontFamily: fontes.semi, lineHeight: ENTRELINHA },
  lista: { gap: espaco(1) },
  itemDaLista: { flexDirection: 'row', gap: espaco(1) },
  // Largura fixa: os textos dos passos ficam alinhados de 1 a 12.
  marca: { minWidth: 22, fontFamily: fontes.semi, lineHeight: ENTRELINHA, textAlign: 'right' },
  textoDoItem: { flex: 1, minWidth: 0 },
  nota: { flexDirection: 'row', gap: espaco(1), padding: espaco(1.5), borderRadius: RAIO, borderWidth: 1 },
  iconeDaNota: { marginTop: 3 },
  textoDaNota: { flex: 1, minWidth: 0 },
});
