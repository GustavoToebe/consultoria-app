import { AssistenteDaPlanilha } from '../../../treinador/importacao/planilhaCompleta/AssistenteDaPlanilha';

/**
 * Importação da planilha completa (várias abas ligadas) em tela inteira. O arquivo, a leitura e as respostas ficam só na
 * memória desta tela; sair no meio pergunta antes.
 */
export default function PlanilhaCompleta() {
  return <AssistenteDaPlanilha />;
}
