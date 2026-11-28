import { useState } from 'react';

import { motivoDaTrocaDeSenha } from '../../dominio/trocaDeSenha';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { CamposDaTrocaDeSenha } from '../../ui/TrocarSenha';

/**
 * "Trocar senha" da Conta (23/11) numa folha, com as regras do cartão de antes (`ui/TrocarSenha`, que o treinador continua
 * usando): senha atual e nova, a nova pela `RegrasSenha` conferida no aparelho (`dominio/trocaDeSenha`, com o indicador de
 * força, 28/11), e a API confere de novo. Encerra as outras sessões. A ação fica no rodapé da folha; fechar apaga o que foi
 * digitado (a folha desmonta). Os campos são os do cartão (`CamposDaTrocaDeSenha`, com o usuário oculto do gerenciador).
 */
export function FolhaTrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const sessao = useSessao();
  const { avisar } = useAviso();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const email = sessao.usuario?.email;
  const motivo = sessao.offline ? 'Sem conexão.' : motivoDaTrocaDeSenha(senhaAtual, senhaNova, email);

  const trocar = async () => {
    if (motivo || trocando) return;
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
        <Botao rotulo="Trocar senha" carregando={trocando} desabilitado={!!motivo}
          motivo={motivo ?? undefined} aoTocar={() => void trocar()} />
      )}>
      <CamposDaTrocaDeSenha email={email} senhaAtual={senhaAtual} senhaNova={senhaNova} aoMudarAtual={setSenhaAtual} aoMudarNova={setSenhaNova}
        aoEnviar={() => void trocar()} />
      <Texto variante="pequeno">Ao trocar, as outras sessões são encerradas.</Texto>
      {erro ? <MensagemErro texto={erro} /> : null}
    </Folha>
  );
}
