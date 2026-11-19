import { useLocalSearchParams } from 'expo-router';

import { LARGURA_LISTA } from '../../../tema/tokens';
import { PainelImportacaoAssistida } from '../../../treinador/importacao/PainelImportacaoAssistida';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

export default function ImportacaoAssistidaTela() {
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Importação assistida"
        subtitulo="PDFs, DOCX, planilhas e texto colado num lote só. Você confere tudo antes de gravar."
      />
      <PainelImportacaoAssistida sessaoIdInicial={typeof sessaoId === 'string' && sessaoId ? sessaoId : undefined} />
    </Tela>
  );
}
