import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { forcaDaSenha, motivoDaTrocaDeSenha, PARTES_DO_NIVEL, problemaNoCampoDaNovaSenha, textoDaForca, type NivelDaSenha } from '../dominio/trocaDeSenha';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { CampoSenha } from './CampoSenha';
import { Cartao } from './Cartao';
import { DicaDoBotao } from './DicaDoBotao';
import { MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { LinhaDeAcoes } from './LinhaDeAcoes';
import { Texto } from './Texto';

/**
 * Cartão de trocar a senha do treinador (Meus dados; some sem conexão). Encerra as outras sessões. "Trocar senha" só
 * habilita com as duas senhas e a nova dentro da `RegrasSenha` (`dominio/trocaDeSenha`), com o indicador de força embaixo
 * da nova. A Conta do aluno usa as mesmas peças numa folha (`aluno/conta/FolhaTrocarSenha`).
 */
export function TrocarSenha({ style }: { style?: StyleProp<ViewStyle> }) {
  const sessao = useSessao();
  const { avisar } = useAviso();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const email = sessao.usuario?.email;
  const motivo = motivoDaTrocaDeSenha(senhaAtual, senhaNova, email);

  const trocarSenha = async () => {
    if (motivo || trocando) return;
    setTrocando(true);
    setErroSenha(null);
    try {
      await sessao.trocarSenha(senhaAtual, senhaNova);
      setSenhaAtual('');
      setSenhaNova('');
      avisar('Senha alterada. As outras sessões foram encerradas.', 'sucesso');
    } catch (e) {
      setErroSenha(textoDoErro(e));
    } finally {
      setTrocando(false);
    }
  };

  if (sessao.offline) return null;
  return (
    <Cartao titulo="Trocar senha" descricao="Ao trocar, as outras sessões são encerradas." style={style}
      rodape={(
        <AcaoDoCartao rotulo="Trocar senha" motivo={motivo}>
          {(m, cheio) => <Botao rotulo="Trocar senha" tipo="secundario" cheio={cheio} aoTocar={() => void trocarSenha()} carregando={trocando} desabilitado={!!motivo} motivo={m} />}
        </AcaoDoCartao>
      )}>
      <CamposDaTrocaDeSenha email={email} senhaAtual={senhaAtual} senhaNova={senhaNova} aoMudarAtual={setSenhaAtual} aoMudarNova={setSenhaNova}
        aoEnviar={() => void trocarSenha()} />
      {erroSenha ? <MensagemErro texto={erroSenha} /> : null}
    </Cartao>
  );
}

/**
 * A ação no rodapé dos cartões de Meus dados (P5): à direita no PC, com o motivo na dica (`DicaDoBotao`); no celular,
 * abaixo de 768 px, cheia e com o motivo escrito embaixo, como antes.
 */
export function AcaoDoCartao({ rotulo, motivo, children }: {
  rotulo: string; motivo: string | null; children: (motivo: string | undefined, cheio: boolean) => ReactNode;
}) {
  const { width } = useWindowDimensions();
  if (width < LARGURA_MENU_LATERAL) return <>{children(motivo ?? undefined, true)}</>;
  return (
    <LinhaDeAcoes alinhar="fim">
      <DicaDoBotao rotulo={rotulo} motivo={motivo ?? undefined}>{(m) => children(m, false)}</DicaDoBotao>
    </LinhaDeAcoes>
  );
}

/**
 * Os campos da troca, iguais no cartão do treinador e na folha do aluno: o usuário oculto para o gerenciador de senhas, a
 * atual (`current-password`), a nova (`new-password`, para o gerenciador sugerir uma sem preencher a atual) e a força.
 * O problema da nova além do tamanho (72 bytes, igual ao e-mail) aparece no campo; o tamanho, no indicador.
 */
export function CamposDaTrocaDeSenha({ email, senhaAtual, senhaNova, aoMudarAtual, aoMudarNova, aoEnviar }: {
  email: string | null | undefined; senhaAtual: string; senhaNova: string;
  aoMudarAtual: (v: string) => void; aoMudarNova: (v: string) => void; aoEnviar: () => void;
}) {
  const nivel = forcaDaSenha(senhaNova);
  const problema = problemaNoCampoDaNovaSenha(senhaNova, email);
  return (
    <>
      <CampoSenha rotulo="Senha atual" valor={senhaAtual} aoMudar={aoMudarAtual} autoComplete="current-password" textContentType="password" />
      {/* Depois da atual, não antes: a `Folha` põe o foco no primeiro `input` e um oculto ali deixaria a folha sem foco. */}
      <UsuarioParaOGerenciador email={email} />
      <View style={estilos.nova}>
        <CampoSenha rotulo="Nova senha" valor={senhaNova} aoMudar={aoMudarNova} erro={problema} ajuda={senhaNova ? undefined : 'Mínimo de 8 caracteres.'}
          autoComplete="new-password" textContentType="newPassword" onSubmitEditing={aoEnviar} returnKeyType="go" />
        {nivel ? <ForcaDaSenha nivel={nivel} /> : null}
      </View>
    </>
  );
}

/**
 * Sem `<form>` na web, o Chrome toma o último campo de texto antes da senha como o usuário e punha o e-mail no Telefone
 * (defeito de 28/11). Um campo oculto `autocomplete="username"` com o e-mail da sessão junto das senhas é o desenho de
 * troca de senha que o Chromium entende ("Password Form Styles"; com as senhas marcadas `current-password`/`new-password`
 * ele lê os campos pelo atributo, não pela ordem): ele também diz a que conta a senha nova pertence ao salvar. Fora da leitura e do Tab (`display: none`); só na web. Também no "Crie sua senha" do primeiro acesso.
 */
export function UsuarioParaOGerenciador({ email }: { email: string | null | undefined }) {
  if (Platform.OS !== 'web' || !email) return null;
  return <TextInput value={email} autoComplete="username" style={estilos.oculto} />;
}

/** Barra de três partes (só apoio visual) e a frase, que é quem diz o nível; a frase só muda quando o nível muda. */
function ForcaDaSenha({ nivel }: { nivel: NivelDaSenha }) {
  const { cores } = useTema();
  const cor = nivel === 'forte' ? cores.sucesso : nivel === 'media' ? cores.atencao : cores.perigo;
  return (
    <View style={estilos.forca}>
      <View aria-hidden style={estilos.partes}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[estilos.parte, { backgroundColor: i <= PARTES_DO_NIVEL[nivel] ? cor : cores.superficie2 }]} />
        ))}
      </View>
      <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoDaForca(nivel)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  nova: { gap: espaco(1) },
  forca: { gap: espaco(0.5) },
  partes: { flexDirection: 'row', gap: espaco(0.5) },
  parte: { flex: 1, height: 4, borderRadius: 2 },
  oculto: { display: 'none' },
});
