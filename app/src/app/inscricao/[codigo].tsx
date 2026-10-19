import { useLocalSearchParams } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { MarcaTitulo } from '../../ui/MarcaTitulo';
import { Tela } from '../../ui/Tela';
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
      <Tela largura={560}>
        <View style={estilos.topo}>
          <Texto variante="titulo" nivel={1}>Inscrição</Texto>
        </View>
        <MensagemErro texto={codigo ? textoDoErro(pagina.erro) : 'Link de inscrição incompleto. Peça o link à consultoria.'}
          tentarDeNovo={codigo ? pagina.recarregar : undefined} erro={pagina.erro ?? undefined} />
      </Tela>
    );
  }
  if (!pagina.dados) {
    return <Tela largura={560}><Carregando /></Tela>;
  }
  const consultoria = pagina.dados.consultoria;

  if (recebida) {
    return (
      <Tela largura={560}>
        <View style={estilos.topo}>
          <MarcaTitulo marca={consultoria} tamanho="grande" />
        </View>
        <Recebida mensagem={recebida} />
      </Tela>
    );
  }

  return (
    <Tela largura={560}>
      <View style={estilos.topo}>
        <MarcaTitulo marca={consultoria} tamanho="grande" />
        <Texto variante="titulo" nivel={1}>Quero ser aluno</Texto>
        <Texto variante="suave">
          Deixe seus dados para a equipe de {consultoria.nome} conversar com você pelo WhatsApp. Não precisa criar conta.
        </Texto>
      </View>
      <Cartao>
        <Campo rotulo="Nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={LIMITES_INSCRICAO.nome}
          autoComplete="name" textContentType="name" />
        <Campo rotulo="WhatsApp com DDD" valor={dados.whatsapp} aoMudar={mudar('whatsapp')} erro={campos.whatsapp}
          keyboardType="phone-pad" inputMode="tel" autoComplete="tel" textContentType="telephoneNumber" maxLength={20}
          placeholder="(11) 98765-4321" />
        <Campo rotulo="E-mail (opcional)" valor={dados.email} aoMudar={mudar('email')} erro={campos.email}
          autoCapitalize="none" keyboardType="email-address" inputMode="email" autoComplete="email"
          maxLength={LIMITES_INSCRICAO.email} ajuda="Usado só para o convite de acesso ao app, se você virar aluno." />
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
      {erro ? <MensagemErro texto={erro} /> : null}
      {verificacao.exigida ? (
        <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave}
          aoReconferir={verificacao.reconferir} />
      ) : null}
      <Botao rotulo={rotuloDoEnvio('Enviar inscrição', verificacao.aguardando, enviando)} aoTocar={enviar}
        carregando={enviando} desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} cheio />
    </Tela>
  );
}

function Recebida({ mensagem }: { mensagem: string }) {
  const { cores } = useTema();
  return (
    <Cartao>
      <View style={estilos.recebida} accessibilityLiveRegion="polite">
        <CircleCheck size={32} color={cores.sucesso} />
        <Texto variante="titulo" nivel={1}>Inscrição enviada</Texto>
        <Texto>{mensagem}</Texto>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(1), marginTop: espaco(4) },
  recebida: { gap: espaco(1.5), alignItems: 'flex-start' },
});
