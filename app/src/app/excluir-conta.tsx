import { StyleSheet } from 'react-native';

import { EMAIL_DE_CONTATO } from '../dominio/contato';
import { EXPLICACAO_DA_EXCLUSAO, PALAVRA_DE_CONFIRMACAO } from '../dominio/excluirConta';
import { fontes } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { LinksDosTermos } from '../ui/LinksDosTermos';
import { TelaPublica } from '../ui/TelaPublica';
import { Texto } from '../ui/Texto';

/**
 * Como excluir a conta, público (sem login): o endereço que as lojas pedem. Só explica o caminho; a exclusão em si é a
 * do aluno logado (Conta › "Excluir minha conta", que confere a senha). Nada aqui apaga nem pede exclusão.
 */
export default function ExcluirConta() {
  return (
    <TelaPublica titulo="Excluir sua conta" subtitulo="Como pedir que os seus dados sejam apagados.">
      <Cartao titulo="Se você é aluno">
        <Texto>
          No app ou na web (overtraining.app), entre com o seu e-mail e a sua senha e vá em{' '}
          <Texto style={estilos.destaque}>Conta › Excluir minha conta</Texto>. Para confirmar, você digita{' '}
          <Texto style={estilos.destaque}>{PALAVRA_DE_CONFIRMACAO}</Texto> e a sua senha.
        </Texto>
        <Texto variante="bloco" nivel={3}>O que é apagado e o que fica</Texto>
        <Texto>{EXPLICACAO_DA_EXCLUSAO}</Texto>
      </Cartao>
      <Cartao titulo="Se você não consegue mais entrar">
        <Texto>
          Fale com o seu treinador ou escreva para <Texto selectable style={estilos.destaque}>{EMAIL_DE_CONTATO}</Texto>.
        </Texto>
      </Cartao>
      <Cartao titulo="Se você é treinador">
        <Texto>
          O cancelamento da consultoria passa pela Central, onde fica o contrato com a plataforma: escreva para{' '}
          <Texto selectable style={estilos.destaque}>{EMAIL_DE_CONTATO}</Texto>.
        </Texto>
      </Cartao>
      <LinksDosTermos todas />
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  destaque: { fontFamily: fontes.semi },
});
