import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alterarMeuPerfil } from '../../api/rotas';
import { mascaraTelefone } from '../../dominio/cadastroDoAluno';
import { avisoSemEmail, fraseDoEmailDeEntrada, mailtoDoSuporte } from '../../dominio/emailDeEntrada';
import { entradaDoTelefone, erroDoCampoTelefone } from '../../dominio/entradaDoTelefone';
import { CONTATO_DO_SUPORTE, NOME_DO_PRODUTO } from '../../dominio/produto';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { abrirEmailDoSuporte } from '../../ui/abrirEmailDoSuporte';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { AcaoDoCartao } from '../../ui/TrocarSenha';

/**
 * "Seus dados" do treinador (Configurações › Meus dados, 28/11): o e-mail de entrada só leitura na primeira linha (não há
 * fluxo para o próprio treinador trocá-lo: o administrador fala com o suporte do produto, os outros com o administrador,
 * `dominio/emailDeEntrada`), o nome que a equipe vê e o telefone; o perfil de permissões vira selo neutro colado ao título.
 * "Salvar seus dados" só habilita com alteração. O telefone recusa texto que não é telefone (o navegador já pôs
 * o e-mail ali: `dominio/entradaDoTelefone`) e usa a máscara do `@plataforma/web`.
 */
export function MeuPerfilEquipe({ style }: { style?: StyleProp<ViewStyle> }) {
  const { usuario, perfilEquipe, recarregarPerfil, offline } = useSessao();
  const { avisar } = useAviso();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [telefone, setTelefone] = useState(mascaraTelefone(usuario?.telefone ?? ''));
  const [recusa, setRecusa] = useState<string | null>(null);
  const [conferirTelefone, setConferirTelefone] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);
  const administrador = !!perfilEquipe?.acessoTotal;
  // Só com um endereço válido (`mailtoDoSuporte`): o botão nunca aparece sem levar a lugar nenhum.
  const contato = mailtoDoSuporte(CONTATO_DO_SUPORTE) ? CONTATO_DO_SUPORTE : null;

  // A base é o que a sessão tem agora: depois de salvar, `recarregarPerfil` a atualiza e o botão volta a desabilitar.
  const mudou = nome.trim() !== (usuario?.nome ?? '').trim() || telefone !== mascaraTelefone(usuario?.telefone ?? '');
  // Nome ou telefone digitado e não salvo: sair da tela pergunta antes (o mesmo guarda dos editores).
  useGuardaDeSaida(mudou);
  const erroDoTelefone = erroDoCampoTelefone(recusa, telefone, conferirTelefone);
  const telefoneInvalido = !!erroDoCampoTelefone(null, telefone, true);
  // O texto do campo diz o que falta; o motivo do botão só aponta o campo (no celular os dois ficam à vista).
  const motivo = !nome.trim() ? 'Corrija o nome.'
    : !mudou ? 'Nenhuma alteração para salvar.'
      : telefoneInvalido ? 'Corrija o telefone.'
        : offline ? 'Sem conexão. Tente de novo quando a internet voltar.' : null;

  const mudarTelefone = (texto: string) => {
    const entrada = entradaDoTelefone(texto, telefone);
    setRecusa(entrada.erro);
    setTelefone(entrada.valor);
  };

  const salvar = async () => {
    if (motivo || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await alterarMeuPerfil(nome.trim(), telefone.trim() || null);
      await recarregarPerfil();
      setConferirTelefone(false);
      avisar('Seus dados foram salvos.', 'sucesso');
    } catch (e) {
      setErro(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Cartao titulo="Seus dados" style={style}
      aoLadoDoTitulo={perfilEquipe?.nome ? <Selo texto={`Perfil: ${perfilEquipe.nome}`} /> : undefined}
      rodape={(
        <AcaoDoCartao rotulo="Salvar seus dados" motivo={motivo}>
          {(m, cheio) => <Botao rotulo="Salvar seus dados" cheio={cheio} carregando={ocupado} desabilitado={!!motivo} motivo={m} aoTocar={() => void salvar()} />}
        </AcaoDoCartao>
      )}>
      <View style={estilos.email}>
        <CampoLeitura rotulo="E-mail de entrada" valor={usuario?.email} />
        <Texto variante="pequeno">{fraseDoEmailDeEntrada(administrador)}</Texto>
        {/* Sem contato definido (`null`) o botão não aparece (nada que não leve a lugar nenhum). */}
        {administrador && contato ? (
          <View style={estilos.contato}>
            <Botao rotulo={`Fale com o suporte do ${NOME_DO_PRODUTO}`} rotuloAcessivel={`Fale com o suporte do ${NOME_DO_PRODUTO} (abre o seu e-mail)`} tipo="fantasma"
              aoTocar={() => void abrirEmailDoSuporte().then((ok) => { if (!ok) avisar(avisoSemEmail(contato), 'perigo'); })} />
          </View>
        ) : null}
      </View>
      <Campo rotulo="Seu nome" valor={nome} aoMudar={setNome} maxLength={120} editable={!ocupado}
        erro={!nome.trim() ? 'Informe o seu nome.' : null}
        autoComplete="name" textContentType="name" autoCapitalize="words" />
      {/* 30, não 15: o "+55 (45) 99999-9999" colado precisa chegar inteiro à máscara, que tira o +55. */}
      <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={mudarTelefone} maxLength={30} editable={!ocupado} numerico
        erro={erroDoTelefone} ajuda="Com DDD, como (45) 99999-9999."
        onBlur={() => setConferirTelefone(true)}
        keyboardType="phone-pad" inputMode="tel" autoComplete="tel-national" textContentType="telephoneNumber" />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({ email: { gap: espaco(0.5) }, contato: { flexDirection: 'row' } });
