import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../components/ui/alert-dialog';
import { ESTILOS_TEXTO } from './tipografia';
import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from './Botao';
import { usePortalDaFolha, type PortalDaFolhaValor } from './Folha';
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
  /** Confirmar fica bloqueado (ex.: digitar o nome ainda não conferiu); `motivo` diz o porquê ao leitor de tela. */
  desabilitado?: boolean;
  motivo?: string;
  /** Folha por cima da qual o diálogo deve aparecer, quando ele não está dentro dela (ex.: o "Sair sem salvar?" da guarda). */
  portal?: PortalDaFolhaValor;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Confirmação na própria tela. Nada de `alert()`/`confirm()` do navegador nem `Alert.alert` (não funciona na web).
 * Para o leitor de tela é um `alertdialog` com o título como nome; ao fechar, o foco volta a quem abriu.
 */
export function PainelConfirmacao(props: Props) {
  const { cores } = useTema();
  const focoAnterior = useRef<HTMLElement | null>(null);
  // Dentro de uma Folha o diálogo vai para o portal dela; no da raiz ficaria escondido atrás do Modal.
  const portalDeQuemContem = usePortalDaFolha();
  const portal = props.portal ?? portalDeQuemContem;
  return (
    <AlertDialog style={{position:'absolute'}} open={props.visivel} onOpenChange={(aberto) => { if (!aberto) props.aoCancelar(); }}>
      <AlertDialogContent aoFechar={props.aoCancelar} portalHost={portal?.nome} container={portal?.elemento}
        role="alertdialog"
        aria-modal
        aria-label={props.titulo}
        accessibilityViewIsModal
        onOpenAutoFocus={() => { if (Platform.OS === 'web') focoAnterior.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={evento => { if (Platform.OS === 'web' && focoAnterior.current?.isConnected) { evento.preventDefault(); focoAnterior.current.focus(); } }} style={[estilos.painel, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <AlertDialogTitle style={[ESTILOS_TEXTO.subtitulo, {color:cores.texto}]}>{props.titulo}</AlertDialogTitle>
          {props.mensagem ? <AlertDialogDescription style={[ESTILOS_TEXTO.suave, {color:cores.textoSuave}]}>{props.mensagem}</AlertDialogDescription> : null}
          {props.children}
          <View style={estilos.botoes}>
            <AlertDialogCancel style={[estilos.cancelar, { borderColor: cores.borda }]}><Texto style={estilos.textoCancelar}>{props.rotuloCancelar ?? 'Cancelar'}</Texto></AlertDialogCancel>
            <Botao
              rotulo={props.rotuloConfirmar}
              tipo={props.perigo ? 'perigo' : 'primario'}
              carregando={props.carregando}
              desabilitado={props.desabilitado}
              motivo={props.motivo}
              aoTocar={props.aoConfirmar}
            />
          </View>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const estilos = StyleSheet.create({
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
  cancelar: { minHeight: ALVO_TOQUE, borderRadius: RAIO, borderWidth: 1, paddingHorizontal: espaco(2), alignItems: 'center', justifyContent: 'center' },
  textoCancelar: { fontFamily: fontes.semi },
});
