import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { LARGURA_LISTA } from '../../../tema/tokens';
import { PainelImportacaoAssistida } from '../../../treinador/importacao/PainelImportacaoAssistida';
import { TelaImportacao } from '../../../treinador/importacao/TelaImportacao';
import { Abas } from '../../../ui/Abas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

type AbaImportacao = 'planilhas' | 'assistida';

/** Importação: planilhas tradicionais ou assistida por IA (lote misto). */
export default function Importacao() {
  const params = useLocalSearchParams<{ aba?: string }>();
  const [aba, setAba] = useState<AbaImportacao>(params.aba === 'assistida' ? 'assistida' : 'planilhas');

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Importação"
        subtitulo="Alunos, pesos, exercícios, alimentos e biblioteca. Planilhas completas ou reconhecimento com IA."
      />
      <Abas
        abas={[
          { valor: 'planilhas', rotulo: 'Planilhas e Histórico' },
          { valor: 'assistida', rotulo: 'Importação com IA (Lote Misto)' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'assistida' ? <PainelImportacaoAssistida /> : <TelaImportacao />}
    </Tela>
  );
}
