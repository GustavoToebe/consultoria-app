import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CircleCheck } from 'lucide-react-native';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { enviarInscricao, inscricaoPublica } from '../../api/rotas';
import type { RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import type { CampoDaInscricao } from '../../api/inscricoesTipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { apagarIndicacao, guardarIndicacao, indicacaoGuardada, lerIndicacaoDoFragmento } from '../../dominio/indicacaoNoLink';
import { errosRespostasAtualizacao, tamanhoDoTexto } from '../../dominio/respostasAtualizacao';
import {
  contatoGuardado,
  contatoParaGuardar,
  corpoDaInscricao,
  errosDaInscricao,
  errosDoContato,
  INSCRICAO_VAZIA,
  INTERESSES,
  LIMITES_INSCRICAO,
  mascaraWhatsapp,
  MODALIDADES_DESEJADAS,
  opcoesOpcionais,
  origemDoLink,
  parteComErro,
  ORIGENS_INFORMADAS,
  PREVISOES,
  respostasDaPagina,
  TEXTO_LIMITE_DA_INSCRICAO,
  temSegundaParte,
  type DadosDaInscricao,
  type ParteDaInscricao,
} from '../../dominio/inscricoes';
import {
  errosDoOutro,
  escolhaEfetiva,
  ID_DA_PERGUNTA_DO_PLANO,
  LIMITE_DO_TEXTO_DO_OUTRO,
  perguntaDoPlano,
  planoDoEnvio,
  respostasComPlano,
  ROTULO_DA_ESCOLHA_SEM_PERGUNTA,
  semAPerguntaDoPlano,
  textoDoOutroDoEnvio,
} from '../../dominio/planosDaInscricao';
import { redesPreenchidas, usuarioDaRede } from '../../dominio/redesSociais';
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../../dominio/verificacaoHumana';
import { EscolhaDoPlano } from '../../publico/inscricao/EscolhaDoPlano';
import { LayoutDaInscricao, SecaoDoFormulario } from '../../publico/inscricao/LayoutDaInscricao';
import { PassosDaInscricao } from '../../publico/inscricao/PassosDaInscricao';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { OPCOES_DE_SEXO } from '../../dominio/sexo';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { LinksDosTermos } from '../../ui/LinksDosTermos';
import { LinkTexto } from '../../ui/LinkTexto';
import { useRolagem } from '../../ui/RolagemComTopo';
import { RedesSociais } from '../../ui/RedesSociais';
import { Tela } from '../../ui/Tela';
import { BotaoPublico, LARGURA_PUBLICA, TelaPublica } from '../../ui/TelaPublica';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';
import { useSemFragmentoNoEndereco } from '../../ui/useSemFragmentoNoEndereco';
import { useVerificacaoHumana } from '../../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../../ui/VerificacaoHumana';

/**
 * Inscrição pública pelo link da consultoria (`/inscricao/<codigo>`), sem conta: nome, WhatsApp e Instagram (opcional) sempre, os campos fixos
 * que o treinador não escondeu (e-mail, sexo, objetivo e as perguntas rápidas), os planos comerciais ativos em cartões
 * (27/11), as perguntas do treinador (o padrão de inscrição publicado, no mesmo formulário da anamnese) e a ciência do texto
 * da consultoria quando ela tem um. A Ficha rápida é o mesmo endereço com outro formulário (contato + "Qual plano
 * combinou?"), numa página só. O código fica no endereço (é o link que a consultoria divulga, não um segredo de uso único).
 * Fora das áreas logadas: segue o tema do aparelho e mostra a marca da consultoria (`LayoutDaInscricao`). Depois do envio só
 * a mensagem neutra; nada da fila nem de outras pessoas aparece.
 */
// Contato guardado na guia (só nome, WhatsApp, e-mail e Instagram; `contatoParaGuardar`). Chave por link.
const chaveDoContato = (codigo: string) => `inscricao_${codigo}`;
// O próprio acesso ao `sessionStorage` lança em navegador com armazenamento bloqueado: sem guarda, a página funciona igual.
const guardaDaGuia = () => {
  try { return Platform.OS === 'web' && typeof window !== 'undefined' ? window.sessionStorage ?? null : null; } catch { return null; }
};
function contatoSalvo(codigo: string) {
  try { return codigo ? contatoGuardado(guardaDaGuia()?.getItem(chaveDoContato(codigo)) ?? null) : {}; } catch { return {}; }
}

const PARTES = ['Seu contato', 'Sobre você'] as const;

export default function Inscricao() {
  const { codigo: bruto, origem } = useLocalSearchParams<{ codigo?: string; origem?: string }>();
  const codigo = typeof bruto === 'string' ? bruto : '';
  // `?origem=instagram` no link divulgado: só letras, números, - e _ (outro valor é ignorado, nunca recusa a inscrição).
  const origemLink = origemDoLink(origem);
  const pagina = useCarregar(codigo ? `inscricao-publica:${codigo}` : null, () => inscricaoPublica(codigo));
  const verificacao = useVerificacaoHumana();
  const [dados, setDados] = useState<DadosDaInscricao>(() => ({ ...INSCRICAO_VAZIA, ...contatoSalvo(codigo) }));
  const [ciencia, setCiencia] = useState(false);
  const [respostas, setRespostas] = useState<RespostasAtualizacao>({});
  // Só a escolha que a pessoa fez nos cartões; a que vale (com um plano só, ele já vem marcado) é calculada.
  const [escolhaDoPlano, setEscolhaDoPlano] = useState<string | null>(null);
  // Texto de "Outro" da página completa (`planoOutroTexto`); na Ficha rápida ele é a resposta da pergunta do plano.
  const [textoDoOutroPlano, setTextoDoOutroPlano] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recebida, setRecebida] = useState<string | null>(null);
  const [proximoCodigo, setProximoCodigo] = useState<string | null>(null);
  const refNome = useRef<TextInput>(null);
  const refWhatsapp = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refInstagram = useRef<TextInput>(null);
  const refSexo = useRef<{ focus: () => void } | null>(null);
  const refObjetivo = useRef<TextInput>(null);
  const refInteresse = useRef<{ focus: () => void } | null>(null);
  const refModalidade = useRef<{ focus: () => void } | null>(null);
  const refPrevisao = useRef<{ focus: () => void } | null>(null);
  const refOrigem = useRef<{ focus: () => void } | null>(null);
  const refIndicadoPor = useRef<TextInput>(null);
  const refPlano = useRef<{ focus: () => void } | null>(null);
  const refOutroPlano = useRef<TextInput>(null);
  // Duas partes antes de um envio só (D6): o que foi digitado fica neste estado ao ir e voltar. Na web, só o contato
  // (nome, WhatsApp, e-mail e Instagram) também fica no `sessionStorage` desta guia, para recarregar sem redigitar: some ao fechar a
  // guia e é apagado ao enviar com sucesso. As respostas, a ciência e os outros campos ficam só na memória da página.
  const [parte, setParte] = useState<ParteDaInscricao>(1);
  // Conta as trocas de parte feitas pela pessoa: o topo da parte rola e recebe o foco a cada uma.
  const [trocas, setTrocas] = useState(0);
  // Erros a focar depois de a parte deles aparecer (o campo da outra parte não está montado na hora do erro).
  const [paraFocar, setParaFocar] = useState<Record<string, string> | null>(null);
  const focarErros = useCallback((locais: Record<string, string>) => focarPrimeiroComErro(locais, [
    ['nome', refNome], ['whatsapp', refWhatsapp], ['email', refEmail], ['instagram', refInstagram], ['sexo', refSexo], ['objetivo', refObjetivo],
    ['interesse', refInteresse], ['modalidade', refModalidade], ['previsaoInicio', refPrevisao], ['origem', refOrigem], ['indicadoPor', refIndicadoPor],
    ['planoComercialId', refPlano], [ID_DA_PERGUNTA_DO_PLANO, refOutroPlano], ['planoOutroTexto', refOutroPlano],
  ]), []);
  useEffect(() => {
    if (paraFocar) focarErros(paraFocar);
  }, [paraFocar, focarErros]);
  const irPara = (p: ParteDaInscricao) => {
    setParte(p);
    setTrocas((t) => t + 1);
    setErro(null);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (p === 2) window.history.pushState({ parte: 2 }, '');
    }
  };
  /** Mostra os erros: volta à parte 1 se algum é do contato e foca o primeiro campo marcado. */
  const mostrarErros = (locais: Record<string, string>) => {
    const destino = parteComErro(locais);
    if (duasPartes && destino) setParte(destino);
    setParaFocar(locais);
  };

  const mudar = (campo: keyof DadosDaInscricao) => (valor: string) =>
    setDados((d) => ({ ...d, [campo]: campo === 'whatsapp' ? mascaraWhatsapp(valor) : valor }));
  const escolher = <K extends 'interesse' | 'modalidade' | 'previsaoInicio' | 'origem'>(campo: K) => (valor: DadosDaInscricao[K]) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const texto = pagina.dados?.texto ?? null;
  const visiveis = pagina.dados?.campos ?? [];
  const mostra = (c: CampoDaInscricao) => visiveis.includes(c);
  const perguntas = pagina.dados?.perguntas ?? null;
  const planos = pagina.dados?.planos ?? [];
  const doPlano = perguntaDoPlano(perguntas?.conteudo);
  // A pergunta do plano é desenhada à parte (cartões ou o campo de texto); as outras seguem no formulário da anamnese.
  const outrasPerguntas = semAPerguntaDoPlano(perguntas?.conteudo);
  const planoEscolhido = escolhaEfetiva(escolhaDoPlano, planos);
  // Sem nada além do contato (campos escondidos, sem perguntas) a página fica numa parte só, como antes.
  const duasPartes = temSegundaParte(visiveis, perguntas?.conteudo ?? null);
  // No Android o voltar do aparelho, na parte 2, volta à parte 1 em vez de sair da página (e perder o que foi digitado).
  useEffect(() => {
    if (Platform.OS !== 'android' || !duasPartes || parte !== 2) return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      setParte(1);
      setTrocas((t) => t + 1);
      return true;
    });
    return () => assinatura.remove();
  }, [duasPartes, parte]);
  // Na web o botão voltar do navegador na parte 2 volta à parte 1 sem sair da página e sem perder os dados digitados.
  useEffect(() => {
    if (Platform.OS !== 'web' || !duasPartes) return;
    const aoNavegarVoltar = () => {
      if (parte === 2) {
        setParte(1);
        setTrocas((t) => t + 1);
      }
    };
    window.addEventListener('popstate', aoNavegarVoltar);
    return () => window.removeEventListener('popstate', aoNavegarVoltar);
  }, [duasPartes, parte]);

  // Link de indicação de um aluno (`#indicacao=<uuid>`): guarda na guia e tira o fragmento do endereço (histórico, captura de
  // tela, link copiado; `useSemFragmentoNoEndereco`), mantendo o `?origem=`. Nunca é exibido; a API confere em silêncio e a tela não muda por isso.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.hash) return;
    const indicacao = lerIndicacaoDoFragmento(window.location.hash);
    if (indicacao) guardarIndicacao(guardaDaGuia(), indicacao);
  }, []);
  useSemFragmentoNoEndereco();

  const { nome, whatsapp, email, instagram } = dados;
  useEffect(() => {
    const guarda = guardaDaGuia();
    if (!guarda || !codigo) return;
    try {
      if (recebida) guarda.removeItem(chaveDoContato(codigo));
      else guarda.setItem(chaveDoContato(codigo), JSON.stringify(contatoParaGuardar({ ...INSCRICAO_VAZIA, nome, whatsapp, email, instagram })));
    } catch { /* guia sem armazenamento (modo privado): só não guarda */ }
  }, [nome, whatsapp, email, instagram, codigo, recebida]);

  // Se fechar a aba/janela na parte 2 sem enviar, avisa antes para não perder o digitado.
  useEffect(() => {
    if (Platform.OS !== 'web' || !duasPartes || parte !== 2 || recebida) return;
    const perguntar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', perguntar);
    return () => window.removeEventListener('beforeunload', perguntar);
  }, [duasPartes, parte, recebida]);
  const limparErro = (chave: string) => setCampos((c) => {
    if (!(chave in c)) return c;
    const resto = { ...c };
    delete resto[chave];
    return resto;
  });
  const responder = (id: string, valor: RespostaAtualizacao) => {
    setRespostas((r) => ({ ...r, [id]: valor }));
    limparErro(id);
  };
  const escolherPlano = (valor: string) => {
    setEscolhaDoPlano(valor);
    limparErro('planoComercialId');
  };
  // Aba do navegador com o nome da consultoria (o layout raiz não a conhece: aqui não há sessão).
  const nomeDaConsultoria = pagina.dados?.consultoria.nome;
  useEffect(() => {
    if (Platform.OS === 'web' && nomeDaConsultoria) document.title = `Inscrição · ${nomeDaConsultoria}`;
  }, [nomeDaConsultoria]);

  const enviar = async () => {
    // Com um plano escolhido o texto de "Outro" não vai nem é conferido.
    const doEnvio = respostasComPlano(respostas, planoEscolhido);
    const locais = {
      ...errosDaInscricao(dados, !!texto, ciencia, visiveis),
      ...(perguntas ? errosRespostasAtualizacao(perguntas.conteudo, doEnvio) : {}),
      ...errosDoOutro(planoEscolhido, textoDoOutroPlano, !!doPlano),
    };
    setCampos(locais);
    if (Object.keys(locais).length) {
      setErro('Confira os campos destacados.');
      mostrarErros(locais);
      return;
    }
    // Sem o token da verificação humana não envia, mesmo que `enviar` seja chamado fora do botão desabilitado.
    if (verificacao.aguardando) return;
    setEnviando(true);
    setErro(null);
    let falha: unknown;
    try {
      const resposta = await enviarInscricao(codigo,
        corpoDaInscricao(dados, !!texto && ciencia, verificacao.token, pagina.dados?.textoVersao ?? null, origemLink, visiveis,
          perguntas ? { versaoId: perguntas.versaoId, respostas: respostasDaPagina(perguntas.conteudo, doEnvio) } : null,
          indicacaoGuardada(guardaDaGuia()), planoDoEnvio(planoEscolhido),
          textoDoOutroDoEnvio(planoEscolhido, textoDoOutroPlano, !!doPlano)));
      apagarIndicacao(guardaDaGuia());
      setRecebida(resposta.mensagem);
      if (resposta.proximoQuestionarioCodigo) setProximoCodigo(resposta.proximoQuestionarioCodigo);
    } catch (e) {
      falha = e;
      if (codigoApi(e) === 'TEXTO_ALTERADO') {
        // A consultoria trocou o texto enquanto a pessoa preenchia: mostra o novo e pede a ciência de novo.
        // Os dados digitados ficam.
        setCiencia(false);
        pagina.recarregar();
        setErro('O texto da consultoria mudou. Leia o texto novo, marque a ciência e envie de novo.');
        setCampos({});
        return;
      }
      if (codigoApi(e) === 'PERGUNTAS_ALTERADAS') {
        // A consultoria trocou as perguntas: mostra as novas. O que foi digitado fica (o que não existe mais não vai).
        pagina.recarregar();
        setErro('As perguntas da consultoria mudaram. Confira as perguntas e envie de novo.');
        setCampos({});
        return;
      }
      setErro(e instanceof ErroApi && e.status === 429 ? TEXTO_LIMITE_DA_INSCRICAO : mensagemDaVerificacao(e) ?? textoDoErro(e));
      const daApi = errosPorCampo(e);
      // O plano escolhido saiu (arquivado enquanto a pessoa preenchia): recarrega a lista; a escolha que sumiu volta ao padrão.
      if (daApi.planoComercialId) pagina.recarregar();
      setCampos(daApi);
      mostrarErros(daApi);
    } finally {
      setEnviando(false);
      // Token de uso único: gasto com a tentativa (sucesso ou erro).
      verificacao.depoisDoEnvio(falha);
    }
  };

  /** Parte 1 → 2: confere só o contato (a ciência e as perguntas ficam para o envio). */
  const continuar = () => {
    const locais = errosDoContato(dados, visiveis);
    setCampos(locais);
    if (Object.keys(locais).length) {
      setErro('Confira os campos destacados.');
      setParaFocar(locais);
      return;
    }
    irPara(2);
  };
  const voltar = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.state?.parte === 2) {
      window.history.back();
    } else {
      irPara(1);
    }
  };

  if (!codigo || pagina.erro) {
    return (
      <TelaPublica titulo="Inscrição">
        <MensagemErro texto={codigo ? textoDoErro(pagina.erro) : 'Link de inscrição incompleto. Peça o link à consultoria.'}
          tentarDeNovo={codigo ? pagina.recarregar : undefined} erro={pagina.erro ?? undefined} />
        {/* Um texto só (o da API ou o do link incompleto já diz o que fazer); quem já é aluno tem o link abaixo. */}
        <View style={estilos.links}>
          <LinkTexto href="/aluno/entrar" texto="Já sou aluno: entrar no app" />
        </View>
        <LinksDosTermos />
      </TelaPublica>
    );
  }
  if (!pagina.dados) {
    return <Tela largura={LARGURA_PUBLICA}><Carregando /></Tela>;
  }
  const consultoria = pagina.dados.consultoria;
  const frase = `Deixe seus dados para a equipe de ${consultoria.nome} conversar com você pelo WhatsApp. Não precisa criar conta.`;
  // Redes da consultoria (só https; sem nenhuma, a fileira não aparece).
  const links = redesPreenchidas(consultoria.redes);
  const redes = links.length ? <RedesSociais modo="leitura" redes={links} de={consultoria.nome} /> : null;

  if (recebida) {
    return (
      <LayoutDaInscricao titulo="Inscrição enviada" marca={consultoria} frase={frase} redes={redes}>
        <Recebida mensagem={recebida} proximoCodigo={proximoCodigo} />
      </LayoutDaInscricao>
    );
  }

  const naParte1 = !duasPartes || parte === 1;
  const naParte2 = !duasPartes || parte === 2;
  // O Instagram no resumo como "@usuario" (o link do perfil inteiro quebraria a linha no celular).
  const usuarioDoInstagram = usuarioDaRede('instagram', dados.instagram);
  const contato = [dados.nome.trim(), dados.whatsapp.trim(), mostra('EMAIL') ? dados.email.trim() : '',
    usuarioDoInstagram ? `@${usuarioDoInstagram}` : dados.instagram.trim()].filter(Boolean).join(' · ');
  const textoDoOutro = typeof respostas[ID_DA_PERGUNTA_DO_PLANO] === 'string' ? (respostas[ID_DA_PERGUNTA_DO_PLANO] as string) : '';
  const limiteDoOutro = doPlano ? tamanhoDoTexto(doPlano.pergunta) : 0;
  const rotuloDoPlano = doPlano?.pergunta.rotulo ?? ROTULO_DA_ESCOLHA_SEM_PERGUNTA;

  // Seções do cartão, na ordem: cada uma com subtítulo e divisória (nunca cartão dentro do cartão).
  // `solta`: o conteúdo já traz as próprias seções (as perguntas do treinador) e entra no cartão sem outra casca.
  const secoes: { chave: string; titulo?: string; descricao?: string; solta?: boolean; conteudo: ReactNode }[] = [];
  if (naParte1) {
    secoes.push({
      chave: 'contato', titulo: duasPartes ? undefined : PARTES[0], conteudo: <>
        <Campo ref={refNome} rotulo="Nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={LIMITES_INSCRICAO.nome}
          autoComplete="name" textContentType="name" />
        <Campo ref={refWhatsapp} rotulo="WhatsApp com DDD" valor={dados.whatsapp} aoMudar={mudar('whatsapp')} erro={campos.whatsapp}
          keyboardType="phone-pad" inputMode="tel" autoComplete="tel-national" textContentType="telephoneNumber" maxLength={20}
          placeholder="DDD + número" />
        {mostra('EMAIL') ? <Campo ref={refEmail} rotulo="E-mail (opcional)" valor={dados.email} aoMudar={mudar('email')} erro={campos.email}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" inputMode="email" autoComplete="email"
          maxLength={LIMITES_INSCRICAO.email} ajuda="Usado só para o convite de acesso ao app, se você virar aluno." /> : null}
        {/* Fixo e sempre visível (D4): vai para as redes do cadastro se a inscrição for aceita. A API guarda só o usuário. */}
        <Campo ref={refInstagram} rotulo="Instagram (opcional)" valor={dados.instagram} aoMudar={mudar('instagram')} erro={campos.instagram}
          autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" maxLength={LIMITES_INSCRICAO.instagram}
          ajuda="@usuario ou link do perfil." />
        {/* Parte 1 de 2: o "Continuar" confere só o contato e fica no mesmo bloco (são de três a quatro campos). */}
        {duasPartes ? (
          <>
            {erro ? <MensagemErro texto={erro} /> : null}
            <BotaoPublico rotulo="Continuar" aoTocar={continuar} cor={consultoria.corPrimaria} />
          </>
        ) : null}
      </>,
    });
  }
  if (naParte2 && (mostra('SEXO') || mostra('OBJETIVO'))) {
    secoes.push({
      chave: 'sobre', conteudo: <>
        {mostra('SEXO') ? <Escolha ref={refSexo} rotulo="Sexo (opcional)" valor={dados.sexo} aoMudar={mudar('sexo')} erro={campos.sexo} distribuida
          opcoes={[{ valor: '', rotulo: 'Não informar' }, ...OPCOES_DE_SEXO]} /> : null}
        {mostra('OBJETIVO') ? <Campo ref={refObjetivo} rotulo="Objetivo (opcional)" valor={dados.objetivo} aoMudar={mudar('objetivo')} erro={campos.objetivo}
          linhas={3} maxLength={LIMITES_INSCRICAO.objetivo}
          ajuda="Em poucas palavras. Informações de saúde ficam para depois, se a inscrição for aceita." /> : null}
      </>,
    });
  }
  // Perguntas rápidas, todas opcionais: ajudam a equipe a direcionar o primeiro contato. Some se o treinador esconder as quatro.
  if (naParte2 && (mostra('INTERESSE') || mostra('MODALIDADE') || mostra('PREVISAO_INICIO') || mostra('ORIGEM'))) {
    secoes.push({
      chave: 'rapidas', titulo: 'Perguntas rápidas', descricao: 'Opcionais. Ajudam a equipe a falar com você sobre o que importa.', conteudo: <>
        {mostra('INTERESSE') ? <Escolha ref={refInteresse} rotulo="O que você procura?" valor={dados.interesse} aoMudar={escolher('interesse')} erro={campos.interesse} distribuida
          opcoes={opcoesOpcionais(INTERESSES)} /> : null}
        {mostra('MODALIDADE') ? <Escolha ref={refModalidade} rotulo="Como prefere o acompanhamento?" valor={dados.modalidade} aoMudar={escolher('modalidade')} erro={campos.modalidade} distribuida
          opcoes={opcoesOpcionais(MODALIDADES_DESEJADAS)} /> : null}
        {mostra('PREVISAO_INICIO') ? <Escolha ref={refPrevisao} rotulo="Quando quer começar?" valor={dados.previsaoInicio} aoMudar={escolher('previsaoInicio')} erro={campos.previsaoInicio} distribuida
          opcoes={opcoesOpcionais(PREVISOES)} /> : null}
        {mostra('ORIGEM') ? <Escolha ref={refOrigem} rotulo="Como conheceu a consultoria?" valor={dados.origem} aoMudar={escolher('origem')} erro={campos.origem} distribuida
          opcoes={opcoesOpcionais(ORIGENS_INFORMADAS)} /> : null}
        {mostra('ORIGEM') && (dados.origem === 'ALUNO_DO_TIME' || dados.origem === 'INFLUENCIADOR') ? (
          <Campo ref={refIndicadoPor} rotulo="Quem indicou? (opcional)" ajuda="Nome do aluno ou do influenciador." valor={dados.indicadoPor}
            aoMudar={mudar('indicadoPor')} erro={campos.indicadoPor} maxLength={120} />
        ) : null}
      </>,
    });
  }
  // Planos (27/11): cartões com os planos ativos; sem planos, a pergunta do plano (Ficha rápida) fica no campo de texto de antes.
  if (naParte2 && (planos.length > 0 || doPlano)) {
    secoes.push({
      chave: 'plano', titulo: doPlano?.secao || 'Plano', conteudo: planos.length > 0 ? (
        <EscolhaDoPlano ref={refPlano} rotulo={rotuloDoPlano} planos={planos} mostrarPreco={pagina.dados.mostrarPrecoDosPlanos}
          valor={planoEscolhido} aoMudar={escolherPlano} cor={consultoria.corPrimaria} erro={campos.planoComercialId}
          outro={doPlano ? {
            valor: textoDoOutro, aoMudar: (t) => responder(ID_DA_PERGUNTA_DO_PLANO, t), erro: campos[ID_DA_PERGUNTA_DO_PLANO],
            maxLength: limiteDoOutro,
          } : {
            valor: textoDoOutroPlano, aoMudar: (t) => { setTextoDoOutroPlano(t); limparErro('planoOutroTexto'); },
            erro: campos.planoOutroTexto, maxLength: LIMITE_DO_TEXTO_DO_OUTRO, obrigatorio: true,
          }} refDoOutro={refOutroPlano} />
      ) : doPlano ? (
        <Campo ref={refOutroPlano} rotulo={doPlano.pergunta.obrigatoria ? doPlano.pergunta.rotulo : `${doPlano.pergunta.rotulo} (opcional)`}
          valor={textoDoOutro} aoMudar={(t) => responder(ID_DA_PERGUNTA_DO_PLANO, t)} erro={campos[ID_DA_PERGUNTA_DO_PLANO]}
          maxLength={limiteDoOutro} ajuda={doPlano.pergunta.ajuda} />
      ) : null,
    });
  }
  // Perguntas do treinador (o padrão de inscrição publicado), no mesmo formulário da anamnese. Cada seção dele vira uma seção
  // do cartão (subtítulo e divisória, `cascaDaSecao`), nunca um cartão dentro do cartão. Ficam inteiras na parte 2: podem ter
  // obrigatória e a condição aponta para perguntas anteriores.
  if (naParte2 && outrasPerguntas) {
    const noTopo = secoes.length === 0;
    secoes.push({
      chave: 'perguntas', solta: true, conteudo: <QuestionarioAtualizacao modelo={outrasPerguntas} respostas={respostas} aoMudar={responder} erros={campos}
        cascaDaSecao={({ titulo, posicao, conteudo }) => (
          <SecaoDoFormulario titulo={titulo} primeira={noTopo && posicao === 0}>{conteudo}</SecaoDoFormulario>
        )} />,
    });
  }
  if (naParte2 && texto) {
    secoes.push({
      chave: 'texto', titulo: 'Antes de enviar', descricao: `Texto de ${consultoria.nome}.`, conteudo: <>
        {/* Mesmo formato do questionário (`**negrito**`, `__sublinhado__`, quebras): o texto do link é escrito pelo treinador. */}
        <TextoFormatado texto={texto} selecionavel />
        <CaixaSelecao rotulo="Li e estou ciente" marcado={ciencia} aoMudar={setCiencia} />
        {campos.cienciaPrivacidade ? <MensagemErro texto={campos.cienciaPrivacidade} /> : null}
      </>,
    });
  }
  // O envio fecha o cartão: a verificação humana e o botão na cor da consultoria, na largura toda.
  if (naParte2) {
    secoes.push({
      chave: 'envio', conteudo: <>
        {erro ? <MensagemErro texto={erro} /> : null}
        {verificacao.exigida ? (
          <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave}
            aoReconferir={verificacao.reconferir} />
        ) : null}
        <BotaoPublico rotulo={rotuloDoEnvio('Enviar inscrição', verificacao.aguardando, enviando)} aoTocar={enviar}
          carregando={enviando} desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} cor={consultoria.corPrimaria} />
      </>,
    });
  }

  return (
    <LayoutDaInscricao titulo="Quero ser aluno" marca={consultoria} frase={frase} redes={redes}>
      {duasPartes ? (
        <CabecalhoDaParte numero={parte} aviso={trocas} cor={consultoria.corPrimaria}
          voltar={parte === 2 ? <Botao rotulo="Voltar" rotuloAcessivel="Voltar ao contato" tipo="secundario" tamanho="pequeno" Icone={ChevronLeft} aoTocar={voltar} /> : null}>
          {parte === 2 ? <Texto variante="suave" style={estilos.resumoTexto}>{contato}</Texto> : null}
        </CabecalhoDaParte>
      ) : null}
      {secoes.map((s, i) => (s.solta ? <Fragment key={s.chave}>{s.conteudo}</Fragment> : (
        <SecaoDoFormulario key={s.chave} titulo={s.titulo} descricao={s.descricao} primeira={i === 0}>{s.conteudo}</SecaoDoFormulario>
      )))}
    </LayoutDaInscricao>
  );
}

const ALVO_DA_PARTE = 'parte-da-inscricao';

/**
 * Topo de cada parte: a barrinha de passos, o título (h2) com o "Voltar" ao lado na parte 2 e o resumo do contato. Ao
 * trocar de parte (`aviso` muda) a tela rola até ele e o foco vai para ele, como no resultado da importação: quem usa
 * teclado ou leitor de tela não fica num botão que sumiu.
 */
function CabecalhoDaParte({ numero, aviso, cor, voltar, children }: {
  numero: ParteDaInscricao; aviso: number; cor: string; voltar?: ReactNode; children?: ReactNode;
}) {
  const { rolarAte } = useRolagem();
  const inicio = useRef<View>(null);
  useEffect(() => {
    if (!aviso) return; // Na abertura da página o foco fica onde o navegador o deixou.
    rolarAte([ALVO_DA_PARTE]);
    if (Platform.OS === 'web') (inicio.current as unknown as { focus?: (o?: { preventScroll?: boolean }) => void } | null)?.focus?.({ preventScroll: true });
    else {
      const no = findNodeHandle(inicio.current);
      if (no) AccessibilityInfo.setAccessibilityFocus(no);
    }
  }, [aviso, rolarAte]);
  return (
    <AlvoDeRolagem chave={ALVO_DA_PARTE} style={estilos.parte}>
      <View ref={inicio} accessible tabIndex={-1} aria-label={`Parte ${numero} de 2: ${PARTES[numero - 1]}`} style={estilos.tituloDaParte}>
        <PassosDaInscricao partes={PARTES} atual={numero} cor={cor} />
      </View>
      <View style={estilos.linhaDoTitulo}>
        <Texto variante="subtitulo" nivel={2} style={estilos.titulo}>{PARTES[numero - 1]}</Texto>
        {voltar}
      </View>
      {children}
    </AlvoDeRolagem>
  );
}

function Recebida({ mensagem }: { mensagem: string; proximoCodigo?: string | null }) {
  const { cores } = useTema();
  return (
    <View style={estilos.recebida} accessibilityLiveRegion="polite">
      <CircleCheck size={32} color={cores.sucesso} />
      <Texto>{mensagem}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  links: { alignItems: 'center' },
  parte: { gap: espaco(1.5) },
  tituloDaParte: { borderRadius: RAIO },
  linhaDoTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: espaco(1) },
  titulo: { flexShrink: 1, fontSize: 20, lineHeight: 26 },
  resumoTexto: { flexShrink: 1 },
  recebida: { gap: espaco(1.5), alignItems: 'flex-start' },
});
