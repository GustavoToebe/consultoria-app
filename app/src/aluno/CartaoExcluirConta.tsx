import { router } from 'expo-router';
import { UserX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';

import { entradaDoPublico } from '../dominio/entradaPorPublico';
import { avisoDeNaoEnviados, EXPLICACAO_DA_EXCLUSAO, motivoParaNaoExcluir, PALAVRA_DE_CONFIRMACAO } from '../dominio/excluirConta';
import { diasDeAguaNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from '../dominio/treinosNaoEnviados';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoSenha } from '../ui/CampoSenha';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';

/**
 * "Excluir minha conta" (App Store 5.1.1(v), LGPD): o último bloco da Conta do aluno, separado das seções (23/11: sem
 * cartão, o botão de perigo com texto e a frase do que acontece). O painel explica o que se apaga
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
        router.replace(entradaDoPublico('ALUNO'));
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
    <View style={estilos.bloco} testID="excluir-minha-conta">
      <View style={estilos.linha}>
        <Botao rotulo="Excluir minha conta" tipo="perigoTexto" Icone={UserX} aoTocar={() => setAberto(true)} />
      </View>
      <Texto variante="pequeno" style={estilos.texto}>Apaga os seus dados pessoais desta consultoria. Não tem volta.</Texto>
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
    </View>
  );
}

const estilos = StyleSheet.create({
  // Respiro maior que o das seções: é outra coisa, destrutiva, e não deve parecer parte do grupo App.
  bloco: { marginTop: espaco(3), gap: espaco(0.5) },
  // O ícone do botão fantasma fica na borda dos títulos das seções (o botão tem 16 de recuo interno; os títulos, 4).
  linha: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -espaco(1.5) },
  texto: { paddingHorizontal: espaco(0.5) },
});
