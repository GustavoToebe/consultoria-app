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
        descricao="PDFs, DOCX, planilhas e texto colado num lote só. Você confere tudo antes de gravar."
      />
      {/* Tela larga (25/11): o conteúdo ocupa a largura toda; da faixa larga em diante o resumo vai para a coluna ao lado. */}
      <PainelImportacaoAssistida sessaoIdInicial={typeof sessaoId === 'string' && sessaoId ? sessaoId : undefined} />
    </Tela>
  );
}
