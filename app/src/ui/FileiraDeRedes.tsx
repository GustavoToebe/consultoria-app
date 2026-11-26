import { RedesSociais, type PropsDaLeitura } from './RedesSociais';

/**
 * Contrato antigo (T-107, 25/11) mantido enquanto Dados do aluno e a Conta do aluno não migram para `RedesSociais`
 * (modo leitura): mesma fileira, mesmos nomes acessíveis. Apagar quando ninguém mais importar.
 */
export function FileiraDeRedes(props: Omit<PropsDaLeitura, 'modo' | 'whatsapp'>) {
  return <RedesSociais modo="leitura" {...props} />;
}
