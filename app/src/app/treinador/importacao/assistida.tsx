import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LARGURA_EDITOR_DE_CAMPOS, LARGURA_LISTA } from '../../../tema/tokens';
import { PainelImportacaoAssistida } from '../../../treinador/importacao/PainelImportacaoAssistida';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

export default function ImportacaoAssistidaTela() {
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Importação assistida"
        descricao="PDFs, DOCX, planilhas e texto colado num lote só. Você confere tudo antes de gravar."
      />
      {/* Tela larga (24/11): envio e conferência são um editor de campos; param em `LARGURA_EDITOR_DE_CAMPOS`, à esquerda. */}
      <View style={estilos.limite}>
        <PainelImportacaoAssistida sessaoIdInicial={typeof sessaoId === 'string' && sessaoId ? sessaoId : undefined} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  limite: { width: '100%', maxWidth: LARGURA_EDITOR_DE_CAMPOS },
});
