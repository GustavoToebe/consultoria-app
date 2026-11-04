import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CircleCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { enviarInscricao, inscricaoPublica } from '../../api/rotas';
import type { RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import type { CampoDaInscricao } from '../../api/inscricoesTipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import { errosRespostasAtualizacao } from '../../dominio/respostasAtualizacao';
import {
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
import { mensagemDaVerificacao, MOTIVO_VERIFICANDO, rotuloDoEnvio } from '../../dominio/verificacaoHumana';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { OPCOES_DE_SEXO } from '../../dominio/sexo';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { codigoApi, errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { LinksDosTermos } from '../../ui/LinksDosTermos';
import { LinkTexto } from '../../ui/LinkTexto';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Tela } from '../../ui/Tela';
import { BotaoPublico, LARGURA_PUBLICA, TelaPublica } from '../../ui/TelaPublica';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';
import { useVerificacaoHumana } from '../../ui/useVerificacaoHumana';
import { VerificacaoHumana } from '../../ui/VerificacaoHumana';

/**
 * Inscrição pública pelo link da consultoria (`/inscricao/<codigo>`), sem conta: nome e WhatsApp sempre, os campos fixos
 * que o treinador não escondeu (e-mail, sexo, objetivo e as perguntas rápidas), as perguntas do treinador (o padrão de
 * inscrição publicado, no mesmo formulário da anamnese) e a ciência do texto da consultoria quando ela tem um. O código
 * fica no endereço (é o link que a consultoria divulga, não um segredo de uso único). Fora das áreas logadas: segue o
 * tema do aparelho e mostra a marca da consultoria. Depois do envio só a mensagem neutra; nada da fila nem de outras
 * pessoas aparece.
 */
export default function Inscricao() {
  const { codigo: bruto, origem } = useLocalSearchParams<{ codigo?: string; origem?: string }>();
  const codigo = typeof bruto === 'string' ? bruto : '';
  // `?origem=instagram` no link divulgado: só letras, números, - e _ (outro valor é ignorado, nunca recusa a inscrição).
  const origemLink = origemDoLink(origem);
  const pagina = useCarregar(codigo ? `inscricao-publica:${codigo}` : null, () => inscricaoPublica(codigo));
  const verificacao = useVerificacaoHumana();
  const [dados, setDados] = useState<DadosDaInscricao>(INSCRICAO_VAZIA);
  const [ciencia, setCiencia] = useState(false);
  const [respostas, setRespostas] = useState<RespostasAtualizacao>({});
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recebida, setRecebida] = useState<string | null>(null);
  const refNome = useRef<TextInput>(null);
  const refWhatsapp = useRef<TextInput>(null);
  const refEmail = useRef<TextInput>(null);
  const refSexo = useRef<{ focus: () => void } | null>(null);
  const refObjetivo = useRef<TextInput>(null);
  const refInteresse = useRef<{ focus: () => void } | null>(null);
  const refModalidade = useRef<{ focus: () => void } | null>(null);
  const refPrevisao = useRef<{ focus: () => void } | null>(null);
  const refOrigem = useRef<{ focus: () => void } | null>(null);
  // Duas partes antes de um envio só (D6): o que foi digitado fica neste estado ao ir e voltar; nada vai ao aparelho.
  const [parte, setParte] = useState<ParteDaInscricao>(1);
  // Conta as trocas de parte feitas pela pessoa: o topo da parte rola e recebe o foco a cada uma.
  const [trocas, setTrocas] = useState(0);
  // Erros a focar depois de a parte deles aparecer (o campo da outra parte não está montado na hora do erro).
  const [paraFocar, setParaFocar] = useState<Record<string, string> | null>(null);
  const focarErros = useCallback((locais: Record<string, string>) => focarPrimeiroComErro(locais, [
    ['nome', refNome], ['whatsapp', refWhatsapp], ['email', refEmail], ['sexo', refSexo], ['objetivo', refObjetivo],
    ['interesse', refInteresse], ['modalidade', refModalidade], ['previsaoInicio', refPrevisao], ['origem', refOrigem],
  ]), []);
  useEffect(() => {
    if (paraFocar) focarErros(paraFocar);
  }, [paraFocar, focarErros]);
  const irPara = (p: ParteDaInscricao) => {
    setParte(p);
    setTrocas((t) => t + 1);
    setErro(null);
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
  // Na web o voltar do navegador na parte 2 sairia da página e perderia o digitado: o navegador pergunta antes
  // (`beforeunload`), como na guarda de saída dos editores. Depois do envio não pergunta mais.
  useEffect(() => {
    if (Platform.OS !== 'web' || !duasPartes || parte !== 2 || recebida) return;
    const perguntar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', perguntar);
    return () => window.removeEventListener('beforeunload', perguntar);
  }, [duasPartes, parte, recebida]);
  const responder = (id: string, valor: RespostaAtualizacao) => {
    setRespostas((r) => ({ ...r, [id]: valor }));
    setCampos((c) => {
      if (!(id in c)) return c;
      const resto = { ...c };
      delete resto[id];
      return resto;
    });
  };
  // Aba do navegador com o nome da consultoria (o layout raiz não a conhece: aqui não há sessão).
  const nomeDaConsultoria = pagina.dados?.consultoria.nome;
  useEffect(() => {
    if (Platform.OS === 'web' && nomeDaConsultoria) document.title = `Inscrição · ${nomeDaConsultoria}`;
  }, [nomeDaConsultoria]);

  const enviar = async () => {
    const locais = {
      ...errosDaInscricao(dados, !!texto, ciencia, visiveis),
      ...(perguntas ? errosRespostasAtualizacao(perguntas.conteudo, respostas) : {}),
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
          perguntas ? { versaoId: perguntas.versaoId, respostas: respostasDaPagina(perguntas.conteudo, respostas) } : null));
      setRecebida(resposta.mensagem);
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
  const voltar = () => irPara(1);

  if (!codigo || pagina.erro) {
    return (
      <TelaPublica titulo="Inscrição">
        <MensagemErro texto={codigo ? textoDoErro(pagina.erro) : 'Link de inscrição incompleto. Peça o link à consultoria.'}
          tentarDeNovo={codigo ? pagina.recarregar : undefined} erro={pagina.erro ?? undefined} />
        {/* Um texto só (o da API ou o do link incompleto já diz o que fazer); quem já é aluno tem o link abaixo. */}
        <View style={estilos.links}>
          <LinkTexto href="/entrar" texto="Já sou aluno: entrar no app" />
        </View>
        <LinksDosTermos />
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
        <LinksDosTermos />
      </TelaPublica>
    );
  }

  const naParte1 = !duasPartes || parte === 1;
  const naParte2 = !duasPartes || parte === 2;
  const contato = [dados.nome.trim(), dados.whatsapp.trim(), mostra('EMAIL') ? dados.email.trim() : ''].filter(Boolean).join(' · ');

  return (
    <TelaPublica titulo="Quero ser aluno" marca={consultoria}
      subtitulo={`Deixe seus dados para a equipe de ${consultoria.nome} conversar com você pelo WhatsApp. Não precisa criar conta.`}>
      {duasPartes ? (
        <CabecalhoDaParte numero={parte} titulo={parte === 1 ? 'Seu contato' : 'Sobre você'} aviso={trocas}>
          {parte === 2 ? (
            <View style={estilos.resumo}>
              <Texto variante="suave" style={estilos.resumoTexto}>{contato}</Texto>
              <Botao rotulo="Voltar" rotuloAcessivel="Voltar ao contato" tipo="fantasma" Icone={ChevronLeft} aoTocar={voltar} />
            </View>
          ) : null}
        </CabecalhoDaParte>
      ) : null}
      {naParte1 ? (
        <Cartao>
          <Campo ref={refNome} rotulo="Nome" valor={dados.nome} aoMudar={mudar('nome')} erro={campos.nome} maxLength={LIMITES_INSCRICAO.nome}
            autoComplete="name" textContentType="name" />
          <Campo ref={refWhatsapp} rotulo="WhatsApp com DDD" valor={dados.whatsapp} aoMudar={mudar('whatsapp')} erro={campos.whatsapp}
            keyboardType="phone-pad" inputMode="tel" autoComplete="tel" textContentType="telephoneNumber" maxLength={20}
            placeholder="DDD + número" />
          {mostra('EMAIL') ? <Campo ref={refEmail} rotulo="E-mail (opcional)" valor={dados.email} aoMudar={mudar('email')} erro={campos.email}
            autoCapitalize="none" autoCorrect={false} spellCheck={false} keyboardType="email-address" inputMode="email" autoComplete="email"
            maxLength={LIMITES_INSCRICAO.email} ajuda="Usado só para o convite de acesso ao app, se você virar aluno." /> : null}
          {/* Parte 1 de 2: o "Continuar" confere só o contato e fica no mesmo bloco (são dois ou três campos). */}
          {duasPartes ? (
            <>
              {erro ? <MensagemErro texto={erro} /> : null}
              <BotaoPublico rotulo="Continuar" aoTocar={continuar} cor={consultoria.corPrimaria} />
            </>
          ) : null}
        </Cartao>
      ) : null}
      {naParte2 && (mostra('SEXO') || mostra('OBJETIVO')) ? (
        <Cartao>
          {mostra('SEXO') ? <Escolha ref={refSexo} rotulo="Sexo (opcional)" valor={dados.sexo} aoMudar={mudar('sexo')} erro={campos.sexo} distribuida
            opcoes={[{ valor: '', rotulo: 'Não informar' }, ...OPCOES_DE_SEXO]} /> : null}
          {mostra('OBJETIVO') ? <Campo ref={refObjetivo} rotulo="Objetivo (opcional)" valor={dados.objetivo} aoMudar={mudar('objetivo')} erro={campos.objetivo}
            linhas={3} maxLength={LIMITES_INSCRICAO.objetivo}
            ajuda="Em poucas palavras. Informações de saúde ficam para depois, se a inscrição for aceita." /> : null}
        </Cartao>
      ) : null}
      {/* Perguntas rápidas, todas opcionais: ajudam a equipe a direcionar o primeiro contato. Some se o treinador esconder as quatro. */}
      {naParte2 && (mostra('INTERESSE') || mostra('MODALIDADE') || mostra('PREVISAO_INICIO') || mostra('ORIGEM')) ? (
        <Cartao titulo="Perguntas rápidas" descricao="Opcionais. Ajudam a equipe a falar com você sobre o que importa.">
          {mostra('INTERESSE') ? <Escolha ref={refInteresse} rotulo="O que você procura?" valor={dados.interesse} aoMudar={escolher('interesse')} erro={campos.interesse} distribuida
            opcoes={opcoesOpcionais(INTERESSES)} /> : null}
          {mostra('MODALIDADE') ? <Escolha ref={refModalidade} rotulo="Como prefere o acompanhamento?" valor={dados.modalidade} aoMudar={escolher('modalidade')} erro={campos.modalidade} distribuida
            opcoes={opcoesOpcionais(MODALIDADES_DESEJADAS)} /> : null}
          {mostra('PREVISAO_INICIO') ? <Escolha ref={refPrevisao} rotulo="Quando quer começar?" valor={dados.previsaoInicio} aoMudar={escolher('previsaoInicio')} erro={campos.previsaoInicio} distribuida
            opcoes={opcoesOpcionais(PREVISOES)} /> : null}
          {mostra('ORIGEM') ? <Escolha ref={refOrigem} rotulo="Como conheceu a consultoria?" valor={dados.origem} aoMudar={escolher('origem')} erro={campos.origem} distribuida
            opcoes={opcoesOpcionais(ORIGENS_INFORMADAS)} /> : null}
        </Cartao>
      ) : null}
      {/* Perguntas do treinador (o padrão de inscrição publicado), no mesmo formulário da anamnese, uma seção por cartão.
          Ficam inteiras na parte 2: podem ter obrigatória e a condição aponta para perguntas anteriores. */}
      {naParte2 && perguntas ? (
        <QuestionarioAtualizacao modelo={perguntas.conteudo} respostas={respostas} aoMudar={responder} erros={campos} />
      ) : null}
      {naParte2 && texto ? (
        <Cartao titulo="Antes de enviar" descricao={`Texto de ${consultoria.nome}.`}>
          {/* Mesmo formato do questionário (`**negrito**`, `__sublinhado__`, quebras): o texto do link é escrito pelo treinador. */}
          <TextoFormatado texto={texto} selecionavel />
          <CaixaSelecao rotulo="Li e estou ciente" marcado={ciencia} aoMudar={setCiencia} />
          {campos.cienciaPrivacidade ? <MensagemErro texto={campos.cienciaPrivacidade} /> : null}
        </Cartao>
      ) : null}
      {/* O envio fica dentro de um cartão, junto do que confirma, e na cor da consultoria (antes ficava solto e cinza). */}
      {naParte2 ? (
        <Cartao>
          {erro ? <MensagemErro texto={erro} /> : null}
          {verificacao.exigida ? (
            <VerificacaoHumana siteKey={verificacao.siteKey} onToken={verificacao.aoReceberToken} chave={verificacao.chave}
              aoReconferir={verificacao.reconferir} />
          ) : null}
          <BotaoPublico rotulo={rotuloDoEnvio('Enviar inscrição', verificacao.aguardando, enviando)} aoTocar={enviar}
            carregando={enviando} desabilitado={verificacao.aguardando} motivo={MOTIVO_VERIFICANDO} cor={consultoria.corPrimaria} />
        </Cartao>
      ) : null}
      <LinksDosTermos />
    </TelaPublica>
  );
}

const ALVO_DA_PARTE = 'parte-da-inscricao';

/**
 * Topo de cada parte ("Parte 1 de 2" e o título, h2). Ao trocar de parte (`aviso` muda) a tela rola até ele e o foco
 * vai para ele, como no resultado da importação: quem usa teclado ou leitor de tela não fica num botão que sumiu.
 */
function CabecalhoDaParte({ numero, titulo, aviso, children }: {
  numero: ParteDaInscricao; titulo: string; aviso: number; children?: ReactNode;
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
      <View ref={inicio} accessible tabIndex={-1} style={estilos.tituloDaParte}>
        <Texto variante="secao" numerico>{`Parte ${numero} de 2`}</Texto>
        <Texto variante="subtitulo" nivel={2}>{titulo}</Texto>
      </View>
      {children}
    </AlvoDeRolagem>
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
  parte: { gap: espaco(1) },
  tituloDaParte: { gap: espaco(0.5), borderRadius: RAIO },
  resumo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  resumoTexto: { flexShrink: 1 },
  recebida: { gap: espaco(1.5), alignItems: 'flex-start' },
});
