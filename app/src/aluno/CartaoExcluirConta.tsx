import { router } from 'expo-router';
import { UserX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { avisoDeNaoEnviados, EXPLICACAO_DA_EXCLUSAO, motivoParaNaoExcluir, PALAVRA_DE_CONFIRMACAO } from '../dominio/excluirConta';
import { diasDeAguaNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from '../dominio/treinosNaoEnviados';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';

/**
 * "Excluir minha conta" (App Store 5.1.1(v), LGPD): o último cartão da Conta do aluno. O painel explica o que se apaga
 * e o que fica, pede a senha e a palavra EXCLUIR (a API confere as duas) e, ao concluir, apaga tudo do aparelho como o
 * "Sair" (inclusive a fila de envio) e volta ao Entrar. Some sem conexão, como a troca de senha: a exclusão é no servidor.
 */
export function CartaoExcluirConta() {
  const sessao = useSessao();
  const { registros, mobilidadeNoAparelho, sessoesConcluidasNoAparelho, aguaNoAparelho } = useAluno();
  const { avisar } = useAviso();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [palavra, setPalavra] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  if (sessao.offline) return null;

  const fechar = () => {
    setAberto(false);
    setSenha('');
    setPalavra('');
    setErro(null);
  };

  const excluir = () => {
    setExcluindo(true);
    setErro(null);
    sessao.excluirConta(senha, palavra).then(
      () => {
        avisar('Conta excluída.', 'sucesso');
        router.replace('/entrar');
      },
      (e: unknown) => {
        setExcluindo(false);
        setErro(textoDoErro(e));
      },
    );
  };

  const motivo = motivoParaNaoExcluir(senha, palavra);
  const mensagem = [EXPLICACAO_DA_EXCLUSAO, avisoDeNaoEnviados(treinosNaoEnviados(registros, sessoesConcluidasNoAparelho), diasDeMobilidadeNaoEnviados(mobilidadeNoAparelho), diasDeAguaNaoEnviados(aguaNoAparelho))].filter(Boolean).join(' ');

  return (
    <Cartao titulo="Excluir minha conta" descricao="Apaga os seus dados pessoais desta consultoria. Não tem volta.">
      <View style={estilos.linha}>
        <Botao rotulo="Excluir minha conta" tipo="perigoTexto" Icone={UserX} aoTocar={() => setAberto(true)} />
      </View>
      <PainelConfirmacao
        visivel={aberto}
        titulo="Excluir a sua conta?"
        mensagem={mensagem}
        rotuloConfirmar="Excluir minha conta"
        perigo
        carregando={excluindo}
        desabilitado={!!motivo}
        motivo={motivo ?? undefined}
        aoConfirmar={excluir}
        aoCancelar={fechar}>
        <CampoSenha rotulo="Sua senha" valor={senha} aoMudar={setSenha} autoComplete="current-password" />
        <Campo rotulo={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`} valor={palavra} aoMudar={setPalavra}
          autoCapitalize="characters" autoCorrect={false} autoComplete="off" />
        {erro ? <MensagemErro texto={erro} /> : null}
      </PainelConfirmacao>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
