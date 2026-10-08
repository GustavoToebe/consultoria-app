import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { Texto } from './Texto';

interface Props {
  visivel: boolean;
  titulo: string;
  mensagem?: string;
  children?: ReactNode;
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  perigo?: boolean;
  carregando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Confirmação na própria tela. Nada de `alert()`/`confirm()` do navegador nem `Alert.alert` (não funciona na web).
 */
export function PainelConfirmacao(props: Props) {
  const { cores } = useTema();
  return (
    <Modal transparent visible={props.visivel} animationType="fade" onRequestClose={props.aoCancelar}>
      <Pressable style={estilos.fundo} onPress={props.aoCancelar} accessibilityLabel="Fechar">
        <Pressable
          onPress={() => undefined}
          accessibilityViewIsModal
          style={[estilos.painel, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Texto variante="subtitulo">{props.titulo}</Texto>
          {props.mensagem ? <Texto cor="suave">{props.mensagem}</Texto> : null}
          {props.children}
          <View style={estilos.botoes}>
            <Botao rotulo={props.rotuloCancelar ?? 'Cancelar'} tipo="secundario" aoTocar={props.aoCancelar} />
            <Botao
              rotulo={props.rotuloConfirmar}
              tipo={props.perigo ? 'perigo' : 'primario'}
              carregando={props.carregando}
              aoTocar={props.aoConfirmar}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: espaco(2) },
  painel: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(2.5),
    gap: espaco(1.5),
  },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: espaco(1), flexWrap: 'wrap', marginTop: espaco(1) },
});
