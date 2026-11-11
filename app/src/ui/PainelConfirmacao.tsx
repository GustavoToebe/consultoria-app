import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../components/ui/alert-dialog';
import { ESTILOS_TEXTO } from './tipografia';
import { TriangleAlert } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { Botao } from './Botao';
import { usePortalDaFolha, type PortalDaFolhaValor } from './Folha';
import { RodapeDeAcoes } from './LinhaDeAcoes';
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
 * Visual de bloco (passo 1 da atualização visual, 30/10): borda do bloco e o título numa faixa `superficie3` com a linha
 * de 3 px embaixo, como o topo da `Folha`; a pergunta e os botões ficam no corpo. O botão destrutivo leva ícone (D10 de
 * `docs/planos/auditoria-cores.md`): com a marca vermelha ele e o primário ficam da mesma cor, e a forma é que os distingue.
 */
export function PainelConfirmacao(props: Props) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
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
        onCloseAutoFocus={evento => { if (Platform.OS === 'web' && focoAnterior.current?.isConnected) { evento.preventDefault(); focoAnterior.current.focus(); } }}
        style={[estilos.painel, { backgroundColor: cores.superficie, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
          <View style={[estilos.faixa, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo }]}>
            <AlertDialogTitle style={[ESTILOS_TEXTO.bloco, { color: cores.texto }]}>{props.titulo}</AlertDialogTitle>
          </View>
          <View style={estilos.corpo}>
            {props.mensagem ? <AlertDialogDescription style={[ESTILOS_TEXTO.suave, {color:cores.textoSuave}]}>{props.mensagem}</AlertDialogDescription> : null}
            {props.children}
            {/* Mesmo rodapé da `Folha`: Cancelar e a ação à direita; no celular em coluna, a ação em cima e cheia. O motivo
                fica colado sob a ação, alinhado à direita (o `Botao` o põe; antes ficava solto embaixo da linha). */}
            <View style={estilos.botoes}><RodapeDeAcoes empilhar={width < LARGURA_MENU_LATERAL}>
              <AlertDialogCancel style={[estilos.cancelar, { borderColor: cores.bordaCampo }]}>
                <Texto style={estilos.textoCancelar}>{props.rotuloCancelar ?? 'Cancelar'}</Texto>
              </AlertDialogCancel>
              <Botao
                rotulo={props.rotuloConfirmar}
                tipo={props.perigo ? 'perigo' : 'primario'}
                Icone={props.perigo ? TriangleAlert : undefined}
                carregando={props.carregando}
                desabilitado={props.desabilitado}
                rotuloAcessivel={props.desabilitado && props.motivo ? `${props.rotuloConfirmar}. ${props.motivo}` : undefined}
                motivo={props.motivo}
                aoTocar={props.aoConfirmar}
              />
            </RodapeDeAcoes></View>
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
    borderRadius: RAIO,
    overflow: 'hidden',
    padding: 0,
    gap: 0,
  },
  faixa: { paddingHorizontal: espaco(2.5), paddingVertical: espaco(1.5), borderBottomWidth: LINHA_DA_FAIXA },
  corpo: { padding: espaco(2.5), gap: espaco(1.5) },
  botoes: { marginTop: espaco(0.5) },
  cancelar: { minHeight: ALVO_TOQUE, borderRadius: RAIO_CONTROLE, borderWidth: 1, paddingHorizontal: espaco(2), alignItems: 'center', justifyContent: 'center' },
  textoCancelar: { fontFamily: fontes.semi },
});
