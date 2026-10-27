import { useLocalSearchParams } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { enviarInscricao, inscricaoPublica } from '../../api/rotas';
import {
  corpoDaInscricao,
  errosDaInscricao,
  INSCRICAO_VAZIA,
  LIMITES_INSCRICAO,
  mascaraWhatsapp,
  type DadosDaInscricao,
} from '../../dominio/inscricoes';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../../dominio/verificacaoHumana';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { OPCOES_DE_SEXO } from '../../dominio/sexo';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { BotaoPublico, LARGURA_PUBLICA, TelaPublica } from '../../ui/TelaPublica';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useVerificacaoHumana } from '../../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../../ui/VerificacaoHumana';

/**
 * Inscrição pública pelo link da consultoria (`/inscricao/<codigo>`), sem conta: nome, WhatsApp, e-mail, objetivo e
 * observação, mais a ciência do texto da consultoria quando ela tem um. O código fica no endereço (é o link que a
 * consultoria divulga, não um segredo de uso único). Fora das áreas logadas: segue o tema do aparelho e mostra a marca
 * da consultoria. Depois do envio só a mensagem neutra; nada da fila nem de outras pessoas aparece.
 */
export default function Inscricao() {
  const { codigo: bruto } = useLocalSearchParams<{ codigo?: string }>();
  const codigo = typeof bruto === 'string' ? bruto : '';
  const pagina = useCarregar(codigo ? `inscricao-publica:${codigo}` : null, () => inscricaoPublica(codigo));
  const verificacao = useVerificacaoHumana();
  const [dados, setDados] = useState<DadosDaInscricao>(INSCRICAO_VAZIA);
  const [ciencia, setCiencia] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recebida, setRecebida] = useState<string | null>(null);

  const mudar = (campo: keyof DadosDaInscricao) => (valor: string) =>
    setDados((d) => ({ ...d, [campo]: campo === 'whatsapp' ? mascaraWhatsapp(valor) : valor }));

  const texto = pagina.dados?.texto ?? null;
  // Aba do navegador com o nome da consultoria (o layout raiz não a conhece: aqui não há sessão).
  const nomeDaConsultoria = pagina.dados?.consultoria.nome;
  useEffect(() => {
    if (Platform.OS === 'web' && nomeDaConsultoria) document.title = `Inscrição · ${nomeDaConsultoria}`;
  }, [nomeDaConsultoria]);

  const enviar = async () => {
    const locais = errosDaInscricao(dados, !!texto, ciencia);
    setCampos(locais);
    if (Object.keys(locais).length) {
      setErro('Confira os campos destacados.');
      return;
    }
    // O Enter nos campos chama `enviar` sem passar pelo botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      const resposta = await enviarInscricao(codigo, corpoDaInscricao(dados, !!texto && ciencia, verificacao.token));
      setRecebida(resposta.mensagem);
    } catch (e) {
      falha = e;
      setErro(mensagemDaVerificacao(e) ?? textoDoErro(e));
      setCampos(errosPorCampo(e));
    } finally {
      setEnviando(false);
      // Token de uso único: gasto com a tentativa (sucesso ou erro).
      verificacao.depoisDoEnvio(falha);
    }
  };

  if (!codigo || pagina.erro) {
    return (
      <TelaPublica titulo="Inscrição">
        <MensagemErro texto={codigo ? textoDoErro(pagina.erro) : 'Link de inscrição incompleto. Peça o link à consultoria.'}
          tentarDeNovo={codigo ? pagina.recarregar : undefined} erro={pagina.erro ?? undefined} />
        <Texto variante="suave">Confira o link com a consultoria. Já é aluno? Entre no app.</Texto>
        <View style={estilos.links}>
          <LinkTexto href="/entrar" texto="Ir para Entrar" />
        </View>
      </TelaPublica>
    );
  }
  if (!pagina.dados) {
    return <Tela largura={LARGURA_PUBLICA}><Carregando /></Tela>;
  }
  const consultoria = pagina.dados.consultoria;

  if (recebida) {
    return (
      <TelaPublica titulo="Inscrição enviada" marca={consultoria}>
        <Recebida mensagem={recebida} />
      </TelaPublica>
    );
  }

  return (
    <TelaPublica titulo="Quero ser aluno" marca={consultoria}
      subtitulo={`Deixe seus dados para a equipe de ${consultoria.nome} conversar com você pelo WhatsApp. Não precisa criar conta.`}>
      <Cartao>
        <Campo rotulo="Nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={LIMITES_INSCRICAO.nome}
          autoComplete="name" textContentType="name" />
        <Campo rotulo="WhatsApp com DDD" valor={dados.whatsapp} aoMudar={mudar('whatsapp')} erro={campos.whatsapp}
          keyboardType="phone-pad" inputMode="tel" autoComplete="tel" textContentType="telephoneNumber" maxLength={20}
          placeholder="DDD + número" />
        <Campo rotulo="E-mail (opcional)" valor={dados.email} aoMudar={mudar('email')} erro={campos.email}
          autoCapitalize="none" keyboardType="email-address" inputMode="email" autoComplete="email"
          maxLength={LIMITES_INSCRICAO.email} ajuda="Usado só para o convite de acesso ao app, se você virar aluno." />
        <Escolha rotulo="Sexo (opcional)" valor={dados.sexo} aoMudar={mudar('sexo')} distribuida
          opcoes={[{ valor: '', rotulo: 'Não informar' }, ...OPCOES_DE_SEXO]} />
        <Campo rotulo="Objetivo (opcional)" valor={dados.objetivo} aoMudar={mudar('objetivo')} erro={campos.objetivo}
          linhas={3} maxLength={LIMITES_INSCRICAO.objetivo}
          ajuda="Em poucas palavras. Informações de saúde ficam para depois, se a inscrição for aceita." />
        <Campo rotulo="Observação (opcional)" valor={dados.observacao} aoMudar={mudar('observacao')} erro={campos.observacao}
          linhas={3} maxLength={LIMITES_INSCRICAO.observacao} />
      </Cartao>
      {texto ? (
        <Cartao titulo="Antes de enviar" descricao={`Texto de ${consultoria.nome}.`}>
          <Texto selectable>{texto}</Texto>
          <CaixaSelecao rotulo="Li e estou ciente" marcado={ciencia} aoMudar={setCiencia} />
          {campos.cienciaPrivacidade ? <MensagemErro texto={campos.cienciaPrivacidade} /> : null}
        </Cartao>
      ) : null}
      {/* O envio fica dentro de um cartão, junto do que confirma, e na cor da consultoria (antes ficava solto e cinza). */}
      <Cartao>
        {erro ? <MensagemErro texto={erro} /> : null}
        {verificacao.exigida ? (
          <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave}
            aoReconferir={verificacao.reconferir} />
        ) : null}
        <BotaoPublico rotulo={rotuloDoEnvio('Enviar inscrição', verificacao.aguardando, enviando)} aoTocar={enviar}
          carregando={enviando} desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} cor={consultoria.corPrimaria} />
      </Cartao>
    </TelaPublica>
  );
}

function Recebida({ mensagem }: { mensagem: string }) {
  const { cores } = useTema();
  return (
    <Cartao>
      <View style={estilos.recebida} accessibilityLiveRegion="polite">
        <CircleCheck size={32} color={cores.sucesso} />
        <Texto>{mensagem}</Texto>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center' },
  recebida: { gap: espaco(1.5), alignItems: 'flex-start' },
});
