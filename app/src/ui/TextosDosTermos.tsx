import { StyleSheet, View } from 'react-native';

import type { TermosVigentes } from '../api/tipos';
import { blocosDoTexto, type Trecho } from '../dominio/termos';
import { espaco, fontes } from '../tema/tokens';
import { Cartao } from './Cartao';
import { Selo } from './Selo';
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

/** Termo de uso e aviso de privacidade, um cartão por documento. Texto em rascunho leva o selo "Rascunho". */
export function TextosDosTermos({ termos }: { termos: TermosVigentes }) {
  return (
    <>
      {termos.rascunho ? <Selo texto="Rascunho em revisão" tipo="atencao" /> : null}
      {termos.documentos.map((d) => (
        <Cartao key={d.id} titulo={d.titulo}>
          {blocosDoTexto(d.texto).map((b, i) =>
            b.tipo === 'secao' ? (
              <Texto key={i} variante="rotulo" nivel={3}>{b.trechos.map((t) => t.texto).join('')}</Texto>
            ) : b.tipo === 'item' ? (
              <View key={i} style={estilos.item}>
                <Texto>•</Texto>
                <Linha trechos={b.trechos} estilo={estilos.textoDoItem} />
              </View>
            ) : (
              <Linha key={i} trechos={b.trechos} />
            ),
          )}
        </Cartao>
      ))}
    </>
  );
}

const estilos = StyleSheet.create({
  item: { flexDirection: 'row', gap: espaco(1), paddingLeft: espaco(1) },
  textoDoItem: { flex: 1 },
  negrito: { fontFamily: fontes.semi },
});
