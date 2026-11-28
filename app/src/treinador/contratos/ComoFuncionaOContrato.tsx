import * as Clipboard from 'expo-clipboard';
import { Copy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CAMPOS_DO_CONTRATO } from '../../dominio/contratos';
import { espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

/**
 * "Como funciona" (apoio de Configurações › Contratos): os campos que o app preenche no texto do modelo, da lista real
 * (`CAMPOS_DO_CONTRATO`, com paridade com `CamposDoContrato.java`), cada um com "Copiar" (o mesmo `expo-clipboard` +
 * aviso do link do responsável), e o lembrete de revisar com o advogado.
 */
export function CartaoComoFunciona() {
  const { avisar } = useAviso();
  const copiar = (codigo: string, rotulo: string) => {
    Clipboard.setStringAsync(`{${codigo}}`).then(
      () => avisar(`Campo ${rotulo} copiado.`, 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };
  return (
    <Cartao titulo="Como funciona">
      <Texto variante="suave">Use estes campos no texto do modelo. Ao gerar o contrato, o app troca cada um pelos dados do aluno e da contratação.</Texto>
      <View role="list" accessibilityLabel="Campos do contrato" style={estilos.lista}>
        {CAMPOS_DO_CONTRATO.map((c) => (
          <View key={c.codigo} role="listitem" style={estilos.campo}>
            <View style={estilos.textos}>
              <Texto selectable style={estilos.codigo}>{`{${c.codigo}}`}</Texto>
              <Texto variante="pequeno">{c.rotulo}</Texto>
            </View>
            <IconeBotao Icone={Copy} rotulo={`Copiar campo ${c.rotulo}`} aoTocar={() => copiar(c.codigo, c.rotulo)} />
          </View>
        ))}
      </View>
      <Texto>Revise o texto com o seu advogado antes de usar o modelo.</Texto>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(0.5) },
  campo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  textos: { flex: 1, minWidth: 0 },
  codigo: { fontFamily: fontes.mono, fontSize: 14 },
});
