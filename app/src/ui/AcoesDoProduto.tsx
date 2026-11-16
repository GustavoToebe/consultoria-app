import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { abrirLinkExterno } from './abrirLinkExterno';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Texto } from './Texto';

/** Abre o link do produto fora do app, sem token. Dieta (suplemento) e vitrine do aluno. */
export function VerProduto({ link }: { link: string | null }) {
  const { avisar } = useAviso();
  return (
    <View style={estilos.produto}>
      <Botao
        rotulo="Ver produto"
        tipo="secundario"
        Icone={ExternalLink}
        aoTocar={() => { void abrirLinkExterno(link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }}
      />
    </View>
  );
}

/** Cupom do produto, como o treinador escreveu, com o botão de copiar. Nada é calculado nem aplicado pelo app; copiar também vale na prévia (não grava nem chama a API). */
export function CupomDoProduto({ uid, nome, cupom }: { uid: string; nome: string; cupom: string }) {
  const { avisar } = useAviso();
  const copiar = async () => {
    try {
      await Clipboard.setStringAsync(cupom);
      avisar('Copiado.', 'sucesso');
    } catch {
      avisar('Selecione o texto e copie à mão.', 'neutro');
    }
  };
  return (
    <View style={estilos.produto}>
      <Texto numerico selectable>Cupom: {cupom}</Texto>
      <Botao
        rotulo="Copiar cupom"
        rotuloAcessivel={`Copiar cupom${nome ? ` de ${nome}` : ''}`}
        testID={`copiar-cupom-${uid}`}
        tipo="secundario"
        Icone={Copy}
        aoTocar={() => { void copiar(); }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  produto: { alignItems: 'flex-start', paddingTop: espaco(0.5), gap: espaco(0.5) },
});
