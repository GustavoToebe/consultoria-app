import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { ErroApi } from '../api/cliente';
import * as rotas from '../api/rotas';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Botao } from './Botao';
import { Carregando, MensagemErro } from './Estados';
import { erroDeConexao, textoDoErro } from './erros';
import { Tela } from './Tela';
import { TextosDosTermos } from './TextosDosTermos';
import { Texto } from './Texto';
import { useCarregar } from './useCarregar';

/**
 * Enquanto o termo de uso e o aviso de privacidade da versão vigente não forem aceitos, só a tela de aceite aparece
 * (treinador e aluno). A API grava versão e data; versão nova pede novo aceite. Sem internet não dá para aceitar.
 */
export function GuardaDeTermos({ children }: { children: ReactNode }) {
  const { termosPendentes } = useSessao();
  return termosPendentes ? <AceiteDeTermos /> : <>{children}</>;
}

function AceiteDeTermos() {
  const { aceitarTermos, offline, sair } = useSessao();
  const termos = useCarregar('termos', () => rotas.termos());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const semConexao = offline || erroDeConexao(termos.erro) || erroDeConexao(erro);

  const aceitar = () => {
    if (!termos.dados) return;
    setEnviando(true);
    setErro(null);
    aceitarTermos(termos.dados.versao).then(
      () => undefined,
      (e: unknown) => {
        setErro(e);
        setEnviando(false);
        // Versão nova no meio da leitura: recarrega os textos para a pessoa ler antes de aceitar.
        if (e instanceof ErroApi && e.codigo === 'TERMOS_DESATUALIZADOS') termos.recarregar();
      },
    );
  };

  return (
    <Tela largura={720}>
      <Texto variante="titulo" nivel={1}>Termo de uso e privacidade</Texto>
      <Texto variante="suave">Leia e aceite para continuar usando o aplicativo.</Texto>
      {semConexao ? (
        <MensagemErro texto="Conecte-se à internet para ler e aceitar os termos." tentarDeNovo={termos.recarregar} />
      ) : termos.erro ? (
        <MensagemErro texto={textoDoErro(termos.erro)} erro={termos.erro} tentarDeNovo={termos.recarregar} />
      ) : !termos.dados ? (
        <Carregando />
      ) : (
        <>
          <TextosDosTermos termos={termos.dados} />
          {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
          <Botao rotulo="Li e aceito" cheio carregando={enviando} aoTocar={aceitar} />
        </>
      )}
      <Botao rotulo="Sair" tipo="fantasma" style={estilos.sair} aoTocar={() => void sair()} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  sair: { alignSelf: 'center', marginTop: espaco(1) },
});
