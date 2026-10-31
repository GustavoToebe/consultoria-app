import { AssistenteDaImportacao } from '../../../treinador/importacao/TelaImportacao';

/**
 * Nova importação em tela inteira (reunião de 30/10: na Folha cabiam só quatro colunas da planilha). O arquivo, o
 * mapeamento e as correções da tabela ficam só na memória desta tela; sair no meio pergunta antes.
 */
export default function NovaImportacao() {
  return <AssistenteDaImportacao />;
}
