import { LARGURA_LISTA } from '../../../tema/tokens';
import { TelaImportacao } from '../../../treinador/importacao/TelaImportacao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';

/** Importação por planilhas; a importação assistida por IA tem rota própria (`importacao/assistida`), aberta pelo botão da lista. */
export default function Importacao() {
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Importação"
        subtitulo="Alunos, pesos, exercícios, alimentos e biblioteca. Planilhas completas ou leitura assistida de documentos."
      />
      <TelaImportacao />
    </Tela>
  );
}
