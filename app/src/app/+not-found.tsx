import { router } from 'expo-router';

import { useSessao } from '../sessao/SessaoProvider';
import { LARGURA_FORMULARIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cabecalho } from '../ui/Cabecalho';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

/**
 * Endereço que não existe. Sem esta tela o Expo mostrava a página padrão em inglês, com a lista de todas as rotas
 * ("Sitemap"). Aqui só uma explicação e a saída para o início do papel logado (ou Entrar, sem sessão).
 */
export default function NaoEncontrada() {
  const { usuario } = useSessao();
  const inicio = usuario?.papel === 'TREINADOR' ? '/treinador' : usuario?.papel === 'ALUNO' ? '/aluno' : '/entrar';
  return (
    <Tela largura={LARGURA_FORMULARIO}>
      <Cabecalho titulo="Página não encontrada" subtitulo="O endereço não existe ou mudou." />
      <Texto>Confira o endereço ou volte ao início e siga pelo menu.</Texto>
      <Botao rotulo={usuario ? 'Voltar ao início' : 'Ir para Entrar'} aoTocar={() => router.replace(inicio)} />
    </Tela>
  );
}
