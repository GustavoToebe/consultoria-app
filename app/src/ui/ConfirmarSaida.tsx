import { router } from 'expo-router';
import { useState } from 'react';

import { entradaDoPublico } from '../dominio/entradaPorPublico';
import { useSessao } from '../sessao/SessaoProvider';
import { useSaidaGuardada } from './GuardaDeSaida';
import { PainelConfirmacao } from './PainelConfirmacao';

/** O `router.replace` do logout chega depois do `await`: a liberação dura até ele (e o `beforeRemove` dele) passar. */
const TEMPO_DA_LIBERACAO_MS = 1000;

/**
 * Confirmação de sair da conta (treinador e aluno), a única pergunta da saída: com alteração não salva num editor ela
 * mesma avisa (o editor não pergunta de novo, porque a saída fica liberada até o logout terminar). `aviso` troca o
 * texto quando há outro o que perder, como registros ainda não enviados do aluno; nesses casos o botão vira de perigo.
 */
export function ConfirmarSaida({ visivel, aoFechar, aviso }: { visivel: boolean; aoFechar: () => void; aviso?: string | null }) {
  const sessao = useSessao();
  const { pendente, liberar } = useSaidaGuardada();
  const [saindo, setSaindo] = useState(false);
  const sair = async () => {
    setSaindo(true);
    const soltar = liberar();
    // Lido antes de sair: depois o usuário é nulo. Volta à entrada do público que saiu.
    const entrada = sessao.usuario ? entradaDoPublico(sessao.usuario.papel) : '/entrar';
    try {
      await sessao.sair();
      setSaindo(false);
      aoFechar();
      router.replace(entrada);
    } finally {
      setTimeout(soltar, TEMPO_DA_LIBERACAO_MS);
    }
  };
  const naoSalvo = visivel && pendente();
  const mensagem = [naoSalvo ? 'Há alterações que ainda não foram salvas; se sair agora, elas serão perdidas.' : null, aviso]
    .filter(Boolean)
    .join(' ');
  return (
    <PainelConfirmacao
      visivel={visivel}
      titulo="Sair da conta?"
      mensagem={mensagem || 'Você vai precisar entrar de novo com e-mail e senha.'}
      rotuloConfirmar="Sair"
      perigo={!!aviso || naoSalvo}
      carregando={saindo}
      aoConfirmar={sair}
      aoCancelar={aoFechar}
    />
  );
}
