import { useRef } from 'react';

import { lembretesDoAluno, definirLembretesDoAluno } from '../../api/rotas';
import { ErroApi } from '../../api/cliente';
import { useAviso } from '../../ui/Aviso';
import { Interruptor } from '../../ui/Campos';
import { MensagemErro } from '../../ui/Estados';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { useSessao } from '../../sessao/SessaoProvider';

/**
 * "Receber lembretes de pagamento por e-mail" no cartão "Meu plano": o aluno desliga (e liga de novo) os lembretes só
 * para si. Só existe com o financeiro ligado e com internet (quem monta é o cartão, que já confere as duas coisas); nada
 * fica no aparelho. Atualiza na hora e volta ao valor anterior, com aviso, se a API recusar. Sem conexão ou com o módulo
 * desligado no servidor (503 `FINANCEIRO_INDISPONIVEL`), não aparece.
 */
export function InterruptorDeLembretes() {
  const { usuario } = useSessao();
  const { avisar } = useAviso();
  const { dados, erro, recarregar, definir } = useCarregar(`lembretes-do-aluno:${usuario?.id ?? ''}`, () => lembretesDoAluno());
  // Dois toques seguidos chegam antes de a tela redesenhar: o segundo esperaria o primeiro terminar.
  const ocupado = useRef(false);

  if (erro instanceof ErroApi && erro.semConexao) return null;
  if (codigoApi(erro) === 'FINANCEIRO_INDISPONIVEL') return null;
  if (erro && !dados) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (!dados) return null;

  const mudar = (receber: boolean) => {
    if (ocupado.current) return;
    ocupado.current = true;
    const anterior = dados.receber;
    definir({ receber });
    definirLembretesDoAluno(receber)
      .then(definir)
      .catch((e: unknown) => {
        definir({ receber: anterior });
        avisar(textoDoErro(e), 'perigo');
      })
      .finally(() => {
        ocupado.current = false;
      });
  };
  return (
    <Interruptor
      rotulo="Receber lembretes de pagamento por e-mail"
      valor={dados.receber}
      aoMudar={mudar}
      ajuda="Vale só para você e dá para mudar quando quiser."
    />
  );
}
