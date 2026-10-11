import { router } from 'expo-router';
import { useState } from 'react';

import { useSessao } from '../sessao/SessaoProvider';
import { PainelConfirmacao } from './PainelConfirmacao';

/**
 * Confirmação de sair da conta (treinador e aluno). `aviso` troca o texto quando há o que perder, como registros
 * ainda não enviados do aluno; nesse caso o botão vira de perigo.
 */
export function ConfirmarSaida({ visivel, aoFechar, aviso }: { visivel: boolean; aoFechar: () => void; aviso?: string | null }) {
  const sessao = useSessao();
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    setSaindo(true);
    await sessao.sair();
    setSaindo(false);
    aoFechar();
    router.replace('/entrar');
  };
  return (
    <PainelConfirmacao
      visivel={visivel}
      titulo="Sair da conta?"
      mensagem={aviso ?? 'Você vai precisar entrar de novo com e-mail e senha.'}
      rotuloConfirmar="Sair"
      perigo={!!aviso}
      carregando={saindo}
      aoConfirmar={sair}
      aoCancelar={aoFechar}
    />
  );
}
