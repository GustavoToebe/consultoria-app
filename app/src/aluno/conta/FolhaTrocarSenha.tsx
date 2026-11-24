import { useState } from 'react';

import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { CampoSenha } from '../../ui/CampoSenha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';

/**
 * "Trocar senha" da Conta (23/11) numa folha, com as regras do cartão de antes (`ui/TrocarSenha`, que o treinador continua
 * usando): senha atual e nova, no mínimo 8 caracteres conferidos no aparelho, e a API confere de novo. Encerra as outras
 * sessões. A ação fica no rodapé da folha; fechar apaga o que foi digitado (a folha desmonta).
 */
export function FolhaTrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const sessao = useSessao();
  const { avisar } = useAviso();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const trocar = async () => {
    if (senhaNova.length < 8) {
      setErro('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setTrocando(true);
    setErro(null);
    try {
      await sessao.trocarSenha(senhaAtual, senhaNova);
      avisar('Senha alterada. As outras sessões foram encerradas.', 'sucesso');
      aoFechar();
    } catch (e) {
      setErro(textoDoErro(e));
      setTrocando(false);
    }
  };

  return (
    <Folha visivel lateral detalhe titulo="Trocar senha" aoFechar={aoFechar}
      rodape={(
        <Botao rotulo="Trocar senha" carregando={trocando} desabilitado={!senhaAtual || !senhaNova || sessao.offline}
          motivo={sessao.offline ? 'Sem conexão.' : 'Preencha a senha atual e a nova.'} aoTocar={() => void trocar()} />
      )}>
      <CampoSenha rotulo="Senha atual" valor={senhaAtual} aoMudar={setSenhaAtual} autoComplete="current-password" />
      <CampoSenha rotulo="Nova senha" valor={senhaNova} aoMudar={setSenhaNova} autoComplete="new-password"
        ajuda="Mínimo de 8 caracteres. As outras sessões são encerradas." />
      {erro ? <MensagemErro texto={erro} /> : null}
    </Folha>
  );
}
