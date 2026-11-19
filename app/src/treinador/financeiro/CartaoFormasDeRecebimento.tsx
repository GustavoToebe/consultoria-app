import { Trash2 } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type KeyboardTypeOptions, type TextInput, type TextInputProps } from 'react-native';

import type { FormasDeRecebimento, TipoDeChavePix } from '../../api/financeiroTipos';
import { apagarDadosDoPix } from '../../api/financeiroF1';
import { buscarFormasDeRecebimento, salvarFormasDeRecebimento } from '../../api/rotas';
import {
  contadorDoPix, corpoDasFormas, DICA_DA_CHAVE_ALEATORIA, estadoDasFormas, formasAlteradas, LIMITES_DO_PIX, mascaraDaChavePix, MENSAGEM_APAGAR_PIX,
  MENSAGEM_CAMPOS_DAS_FORMAS, MENSAGEM_PIX_APAGADO, notaDoCelular, podeApagarPix, previaDoAluno, TIPOS_DE_CHAVE_PIX, traduzirErroDasFormas,
  traduzirErroDoApagarPix, type CampoDasFormas, type ErrosDasFormas, type EstadoDasFormas,
} from '../../dominio/formasDeRecebimento';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_FORMULARIO, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { BarraDeSalvar, ColunasDeAjustes, GrupoDeOpcoes, LinhaDeOpcao, LinkDeAba } from './AjustesDaAba';

const TITULO = 'Formas de recebimento';
const DESCRICAO = 'Como o aluno pode pagar as cobranças, na Conta dele.';
const TEXTO_MANUAL = 'Você combina com o aluno e registra o pagamento à mão. É o que ele vê quando nenhuma outra forma vale para a cobrança.';
const TEXTO_PIX = 'O aluno copia um código Pix com o valor da cobrança e paga no app do banco. Você confere o extrato e registra o pagamento à mão.';
// A recomendação (chave aleatória) fica uma vez só, na ajuda do campo da chave (`DICA_DA_CHAVE_ALEATORIA`).
const AVISO_DA_CHAVE = 'A chave Pix vai dentro do código que o aluno copia: quem tiver o código consegue ver a chave.';
const SEM_DINHEIRO = 'O app não recebe nem guarda dinheiro.';

/** O link próprio, com "Planos › Link de pagamento" levando à aba Planos (onde o link de cada plano é posto). */
const textoDoLinkProprio = (
  <>O aluno abre o link que você põe no plano (<LinkDeAba aba="planos" texto="Planos › Link de pagamento" />). Vale só para a mensalidade; você registra o pagamento à mão.</>
);

/** Teclado e ajuda por tipo de chave (os exemplos são fictícios). */
const DO_TIPO: Readonly<Record<TipoDeChavePix, { teclado: KeyboardTypeOptions; modo: TextInputProps['inputMode']; ajuda: string }>> = {
  CPF: { teclado: 'number-pad', modo: 'numeric', ajuda: 'Só os números; os pontos e o traço entram sozinhos.' },
  CNPJ: { teclado: 'default', modo: 'text', ajuda: 'Números e letras do CNPJ; a pontuação entra sozinha.' },
  EMAIL: { teclado: 'email-address', modo: 'email', ajuda: 'O e-mail cadastrado como chave no seu banco.' },
  TELEFONE: { teclado: 'phone-pad', modo: 'tel', ajuda: 'Com DDD, como (45) 99999-8888.' },
  ALEATORIA: { teclado: 'default', modo: 'text', ajuda: 'Cole a chave de 36 caracteres que o seu banco mostra.' },
};

const rotuloDoTipo = (t: TipoDeChavePix | null) => TIPOS_DE_CHAVE_PIX.find((o) => o.valor === t)?.rotulo ?? null;
const ligada = (v: boolean) => (v ? 'Ligado' : 'Desligado');

/**
 * Formas de recebimento da consultoria (`GET/PUT /financeiro/formas-de-recebimento`) e a aba Recebimento em duas colunas
 * (lembretes e recebimento, 19/11): à esquerda o cartão das formas e, embaixo dele, `maisAjustes` (a conta InfinitePay); à
 * direita "O que o aluno vê", montada com o que está na tela. O treinador liga InfinitePay, link próprio e Pix; o Manual está
 * sempre ligado. Com o Pix, tipo e chave, nome do recebedor e cidade. A chave é DADO PESSOAL: a API só devolve `chaveMascarada`;
 * o que se digita vive só no estado deste formulário (e no da prévia, em memória) e some ao salvar (o formulário nasce de novo
 * pela `versao`). Ler exige `FINANCEIRO_LER` e `ALUNO_LER`; sem `FINANCEIRO_ALTERAR`, só leitura. `comInfinitePay` falso
 * (módulo da InfinitePay desligado na instalação): a linha some e o valor gravado segue igual no `PUT`.
 * "Apagar dados do Pix" (D12) só com `FINANCEIRO_ALTERAR` e chave gravada: confirma no painel e grava na hora, fora do "Salvar".
 */
export function CartaoFormasDeRecebimento({ podeAlterar, comInfinitePay, infinitePayConfigurada, maisAjustes }: {
  podeAlterar: boolean;
  comInfinitePay: boolean;
  /** A InfiniteTag está salva (o "Pagar" da InfinitePay só aparece ao aluno com ela); `undefined` enquanto carrega. */
  infinitePayConfigurada: boolean | undefined;
  /** Outros cartões da coluna de ajustes, embaixo deste (a conta InfinitePay). Ficam no mesmo lugar da árvore em todo estado. */
  maisAjustes?: ReactNode;
}) {
  const { pode } = useSessao();
  const podeLer = pode('ALUNO_LER');
  const carga = useCarregar(podeLer ? 'formas-de-recebimento' : null, () => buscarFormasDeRecebimento());
  const { dados, erro, recarregar, definir } = carga;
  // O que o formulário tem na tela, para a prévia. Vale só para a versão em que foi digitado: salvar ou recarregar traz outra.
  const [naTela, setNaTela] = useState<{ versao: number | null; estado: EstadoDasFormas } | null>(null);
  const estadoDaPrevia = dados ? (naTela && naTela.versao === dados.versao ? naTela.estado : estadoDasFormas(dados)) : null;

  let cartao: ReactNode;
  if (!podeLer) {
    cartao = (
      <Cartao titulo={TITULO}>
        <Texto variante="suave">Para ver as formas de recebimento, o seu perfil precisa também da permissão de ver alunos. Peça a um administrador da consultoria.</Texto>
      </Cartao>
    );
  } else if (!dados) {
    cartao = (
      <Cartao titulo={TITULO} descricao={DESCRICAO}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : <Esqueleto />}
      </Cartao>
    );
  } else if (!podeAlterar) {
    cartao = <Leitura dados={dados} comInfinitePay={comInfinitePay} />;
  } else {
    // A chave do formulário é a versão: salvar ou recarregar traz outra versão e o formulário nasce de novo, sem resto de digitação.
    cartao = <Formulario key={dados.versao ?? 'novo'} dados={dados} comInfinitePay={comInfinitePay} infinitePayConfigurada={infinitePayConfigurada}
      // Salvar ou recarregar esquece o que estava na tela (a chave digitada inclusive): a prévia volta ao gravado.
      aoSalvar={(novo) => { setNaTela(null); definir(novo); }} aoRecarregar={() => { setNaTela(null); recarregar(); }}
      aoMudarEstado={(estado) => setNaTela({ versao: dados.versao, estado })} />;
  }
  return (
    <ColunasDeAjustes
      ajustes={<>{cartao}{maisAjustes}</>}
      apoio={podeLer ? <PreviaDoAluno estado={estadoDaPrevia} comInfinitePay={comInfinitePay} infinitePayConfigurada={infinitePayConfigurada === true} /> : null}
    />
  );
}

/**
 * "O que o aluno vê": uma cobrança em aberto como a Conta do aluno na web a mostra, com as formas ligadas na tela. Não é clicável
 * nem focável (os "botões" são só desenho com texto). Embaixo, o que ainda falta, a regra das lojas no celular e a frase de sempre.
 */
function PreviaDoAluno({ estado, comInfinitePay, infinitePayConfigurada }: { estado: EstadoDasFormas | null; comInfinitePay: boolean; infinitePayConfigurada: boolean }) {
  const { cores } = useTema();
  const { pagarNoIos, pagarNoAndroid } = useSessao();
  if (!estado) {
    return <Cartao titulo="O que o aluno vê"><Esqueleto /></Cartao>;
  }
  const previa = previaDoAluno(estado, { naInstalacao: comInfinitePay, configurada: infinitePayConfigurada });
  const celular = notaDoCelular(pagarNoIos, pagarNoAndroid);
  return (
    <Cartao titulo="O que o aluno vê" descricao="Uma cobrança em aberto na Conta do aluno, na web, com o que está ligado aqui.">
      <View style={[estilos.poco, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
        <Texto variante="secao">Em aberto</Texto>
        {previa.botoes.length > 0 ? (
          <View role="list" aria-label="Botões que o aluno vê" style={estilos.botoes}>
            {previa.botoes.map((b) => (
              <View key={b} role="listitem" style={[estilos.botaoDeMentira, { backgroundColor: cores.superficie, borderColor: cores.bordaCampo }]}>
                <Texto style={[estilos.textoDoBotao, { color: cores.texto }]}>{b}</Texto>
              </View>
            ))}
          </View>
        ) : null}
        {previa.combinar ? <Texto variante="pequeno" cor={cores.texto}>{previa.combinar}</Texto> : null}
      </View>
      {previa.notaDoLinkProprio || previa.faltam.length > 0 || celular ? (
        <View style={estilos.notas}>
          {previa.faltam.map((f) => <Texto key={f} variante="pequeno">{f}</Texto>)}
          {previa.notaDoLinkProprio ? <Texto variante="pequeno">O link próprio só aparece na mensalidade de plano com link.</Texto> : null}
          {celular ? <Texto variante="pequeno">{celular}</Texto> : null}
        </View>
      ) : null}
      <Texto variante="pequeno">{SEM_DINHEIRO}</Texto>
    </Cartao>
  );
}

function Leitura({ dados, comInfinitePay }: { dados: FormasDeRecebimento; comInfinitePay: boolean }) {
  const p = dados.pixConfig;
  const valor = (texto: string) => <Texto variante="suave">{texto}</Texto>;
  return (
    <Cartao titulo={TITULO} descricao={DESCRICAO}>
      <GrupoDeOpcoes>
        {comInfinitePay ? <LinhaDeOpcao titulo="InfinitePay" controle={valor(ligada(dados.infinitePay))} /> : null}
        <LinhaDeOpcao titulo="Link de pagamento próprio" controle={valor(ligada(dados.linkProprio))} />
        <LinhaDeOpcao titulo="Pix copia e cola" controle={valor(ligada(dados.pix))} />
        <LinhaDeOpcao titulo="Manual" controle={<Selo texto="Sempre ligado" tipo="neutro" />} />
      </GrupoDeOpcoes>
      {p ? (
        <View style={estilos.secao}>
          <Texto variante="secao">Dados do Pix</Texto>
          <CamposEmLinha minimo={160}>
            <CampoLeitura rotulo="Tipo da chave" valor={rotuloDoTipo(p.tipoChave)} />
            <CampoLeitura rotulo="Chave Pix" valor={p.chaveMascarada} />
            <CampoLeitura rotulo="Nome do recebedor" valor={p.nomeRecebedor} />
            <CampoLeitura rotulo="Cidade" valor={p.cidade} />
          </CamposEmLinha>
        </View>
      ) : null}
      <Texto variante="suave">Para mudar as formas de recebimento, peça a quem administra o financeiro.</Texto>
    </Cartao>
  );
}

function Formulario({ dados, comInfinitePay, infinitePayConfigurada, aoSalvar, aoRecarregar, aoMudarEstado }: {
  dados: FormasDeRecebimento;
  comInfinitePay: boolean;
  infinitePayConfigurada: boolean | undefined;
  aoSalvar: (novo: FormasDeRecebimento) => void;
  aoRecarregar: () => void;
  /** Cada mudança (e o descartar) vai para a prévia, ao lado. */
  aoMudarEstado: (estado: EstadoDasFormas) => void;
}) {
  const { avisar } = useAviso();
  const gravado = estadoDasFormas(dados);
  const [estado, setEstado] = useState<EstadoDasFormas>(gravado);
  const [trocando, setTrocando] = useState(false);
  const [erros, setErros] = useState<ErrosDasFormas>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erroDoApagar, setErroDoApagar] = useState<string | null>(null);
  const refTipo = useRef<{ focus: () => void } | null>(null);
  const refChave = useRef<TextInput>(null);
  const refNome = useRef<TextInput>(null);
  const refCidade = useRef<TextInput>(null);
  const refTrocar = useRef<View>(null);

  // Trocar o tipo da chave gravada pede a chave nova (o servidor recusa sem ela): o campo aparece sozinho. Erro na chave (do
  // servidor, com a gravada) também abre o campo: o erro precisa de um lugar e a saída é digitar outra.
  const campoDaChave = !estado.chaveConfigurada || trocando || estado.tipoChave !== estado.tipoChaveGravado || !!erros.chave;
  const mudou = formasAlteradas(estado, gravado);
  useGuardaDeSaida(mudou);
  const mudar = (parcial: Partial<EstadoDasFormas>, campo?: CampoDasFormas) => {
    const novo = { ...estado, ...parcial };
    setEstado(novo);
    aoMudarEstado(novo);
    if (campo) setErros((e) => ({ ...e, [campo]: undefined }));
    setMensagem(null);
  };

  const descartar = () => {
    setEstado(gravado);
    aoMudarEstado(gravado);
    setTrocando(false);
    setErros({});
    setMensagem(null);
    setErroGeral(null);
  };

  const focarPrimeiro = (e: ErrosDasFormas) => {
    if (e.tipoChave) refTipo.current?.focus();
    else if (e.chave) refChave.current?.focus();
    else if (e.nomeRecebedor) refNome.current?.focus();
    else if (e.cidade) refCidade.current?.focus();
  };

  const salvar = () => {
    const r = corpoDasFormas(estado);
    if (!r.ok) {
      setErros(r.erros);
      setMensagem(MENSAGEM_CAMPOS_DAS_FORMAS);
      focarPrimeiro(r.erros);
      return;
    }
    setEnviando(true);
    setErros({});
    setMensagem(null);
    setErroGeral(null);
    salvarFormasDeRecebimento(r.corpo).then(
      (novo) => {
        setEnviando(false);
        avisar('Formas de recebimento salvas.', 'sucesso');
        aoSalvar(novo);
      },
      (e: unknown) => {
        setEnviando(false);
        const t = traduzirErroDasFormas(e);
        if (t.recarregar) {
          avisar(t.mensagem, 'neutro');
          aoRecarregar();
          return;
        }
        setErros(t.campos);
        setMensagem(t.mensagem);
        setErroGeral(Object.keys(t.campos).length === 0 ? e : null);
        focarPrimeiro(t.campos);
      },
    );
  };

  const apagarPix = () => {
    if (dados.versao === null) return;
    setApagando(true);
    setErroDoApagar(null);
    apagarDadosDoPix(dados.versao).then(
      (novo) => {
        setApagando(false);
        setConfirmandoApagar(false);
        avisar(MENSAGEM_PIX_APAGADO, 'sucesso');
        aoSalvar(novo);
      },
      (e: unknown) => {
        setApagando(false);
        const t = traduzirErroDoApagarPix(e);
        if (t.recarregar) {
          setConfirmandoApagar(false);
          avisar(t.mensagem, 'neutro');
          aoRecarregar();
          return;
        }
        setErroDoApagar(t.mensagem);
      },
    );
  };
  const botaoApagarPix = podeApagarPix(dados) ? (
    <LinhaDeAcoes>
      <Botao rotulo="Apagar dados do Pix" tipo="perigoTexto" Icone={Trash2} style={estilos.fantasmaNaColuna}
        aoTocar={() => { setErroDoApagar(null); setConfirmandoApagar(true); }} />
    </LinhaDeAcoes>
  ) : null;

  const doTipo = estado.tipoChave ? DO_TIPO[estado.tipoChave] : null;
  // A dica da chave aleatória some quando ela já é a escolhida.
  const ajudaDaChave = estado.tipoChave === 'ALEATORIA'
    ? doTipo?.ajuda
    : `${doTipo?.ajuda ?? 'Escolha antes o tipo da chave.'} ${DICA_DA_CHAVE_ALEATORIA}`;
  const ajudaDaInfinitePay = infinitePayConfigurada === false
    ? 'O aluno paga por Pix ou cartão no link da InfinitePay. Ele só vê este "Pagar" depois que a sua InfiniteTag estiver salva, logo abaixo.'
    : 'O aluno paga por Pix ou cartão no link da InfinitePay, e o pagamento é registrado sozinho.';

  return (
    <Cartao titulo={TITULO} descricao={DESCRICAO}
      rodape={(
        <BarraDeSalvar mudou={mudou} enviando={enviando} aoSalvar={salvar} aoDescartar={descartar}
          rotuloAcessivelSalvar="Salvar formas de recebimento" rotuloAcessivelDescartar="Descartar alterações das formas de recebimento"
          erro={mensagem ? <MensagemErro texto={mensagem} erro={erroGeral ?? undefined} /> : null} />
      )}>
      <GrupoDeOpcoes>
        {comInfinitePay ? (
          <LinhaDeOpcao titulo="InfinitePay" descricao={ajudaDaInfinitePay} interruptor={{ valor: estado.infinitePay, aoMudar: (v) => mudar({ infinitePay: v }) }} />
        ) : null}
        <LinhaDeOpcao titulo="Link de pagamento próprio" descricao={textoDoLinkProprio}
          interruptor={{ valor: estado.linkProprio, aoMudar: (v) => mudar({ linkProprio: v }) }} />
        <LinhaDeOpcao titulo="Pix copia e cola" descricao={TEXTO_PIX} interruptor={{ valor: estado.pix, aoMudar: (v) => mudar({ pix: v }) }}>
          {/* Ligado sem chave gravada: o aluno não vê o Pix até os dados abaixo serem salvos (o Pix só vale ligado e configurado). */}
          {estado.pix && !estado.chaveConfigurada ? <Selo texto="Falta salvar a chave e os dados para o aluno ver o Pix" tipo="atencao" /> : null}
          {estado.pix ? (
            <View style={estilos.secaoDoPix}>
              <Texto variante="secao">Dados do Pix</Texto>
              <Alerta tom="atencao" texto={AVISO_DA_CHAVE} />
              <Escolha ref={refTipo} rotulo="Tipo da chave" compacta distribuida valor={estado.tipoChave} erro={erros.tipoChave ?? null}
                opcoes={TIPOS_DE_CHAVE_PIX.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                aoMudar={(t) => { mudar({ tipoChave: t, chave: '' }, 'tipoChave'); setErros((e) => ({ ...e, chave: undefined })); }} />
              {campoDaChave ? (
                <View style={estilos.chave}>
                  <Campo ref={refChave} rotulo={estado.chaveConfigurada ? 'Nova chave Pix' : 'Chave Pix'} valor={estado.chave}
                    aoMudar={(t) => mudar({ chave: mascaraDaChavePix(estado.tipoChave, t) }, 'chave')} erro={erros.chave ?? null}
                    ajuda={ajudaDaChave} editable={!!estado.tipoChave}
                    keyboardType={doTipo?.teclado} inputMode={doTipo?.modo} autoCapitalize={estado.tipoChave === 'CNPJ' ? 'characters' : 'none'}
                    autoCorrect={false} autoComplete="off" spellCheck={false} maxLength={LIMITES_DO_PIX.chave} />
                  {estado.chaveConfigurada && estado.tipoChave === estado.tipoChaveGravado ? (
                    <LinhaDeAcoes>
                      {/* O campo some ao tocar: o foco vai ao "Trocar a chave", que volta no lugar dele (senão cairia no início da página). */}
                      <Botao rotulo="Manter a chave gravada" tipo="fantasma" style={estilos.fantasmaNaColuna}
                        aoTocar={() => { setTrocando(false); mudar({ chave: '' }, 'chave'); requestAnimationFrame(() => refTrocar.current?.focus()); }} />
                    </LinhaDeAcoes>
                  ) : null}
                </View>
              ) : (
                <View style={estilos.chave}>
                  <CampoLeitura rotulo="Chave Pix" valor={estado.chaveMascarada ?? 'Chave gravada'} />
                  <LinhaDeAcoes>
                    <Botao ref={refTrocar} rotulo="Trocar a chave" tipo="secundario" aoTocar={() => { setTrocando(true); requestAnimationFrame(() => refChave.current?.focus()); }} />
                  </LinhaDeAcoes>
                </View>
              )}
              <CamposEmLinha minimo={220}>
                <Campo ref={refNome} rotulo="Nome do recebedor" valor={estado.nomeRecebedor} aoMudar={(t) => mudar({ nomeRecebedor: t }, 'nomeRecebedor')}
                  erro={erros.nomeRecebedor ?? null} maxLength={LIMITES_DO_PIX.nomeRecebedor} autoComplete="off"
                  ajuda={`Aparece para o aluno no app do banco. ${contadorDoPix(estado.nomeRecebedor, LIMITES_DO_PIX.nomeRecebedor)}.`} />
                <Campo ref={refCidade} rotulo="Cidade" valor={estado.cidade} aoMudar={(t) => mudar({ cidade: t }, 'cidade')}
                  erro={erros.cidade ?? null} maxLength={LIMITES_DO_PIX.cidade} autoComplete="off"
                  ajuda={`A cidade da sua conta. ${contadorDoPix(estado.cidade, LIMITES_DO_PIX.cidade)}.`} />
              </CamposEmLinha>
              {botaoApagarPix}
            </View>
          ) : estado.chaveConfigurada ? (
            <View style={estilos.chave}>
              <Texto variante="suave">O Pix está desligado. A chave e os dados gravados continuam guardados para quando você ligar de novo.</Texto>
              {botaoApagarPix}
            </View>
          ) : null}
        </LinhaDeOpcao>
        {/* Sempre ligado: não é um interruptor apagado (que pareceria quebrado), é um selo na mesma coluna dos interruptores. */}
        <LinhaDeOpcao titulo="Manual" descricao={TEXTO_MANUAL} controle={<Selo texto="Sempre ligado" tipo="neutro" />} />
      </GrupoDeOpcoes>
      <PainelConfirmacao visivel={confirmandoApagar} titulo="Apagar os dados do Pix?" mensagem={MENSAGEM_APAGAR_PIX}
        rotuloConfirmar="Apagar dados do Pix" rotuloCancelar="Voltar" perigo carregando={apagando}
        aoConfirmar={apagarPix} aoCancelar={() => setConfirmandoApagar(false)}>
        {/* Apagar grava na hora e o formulário nasce de novo com a resposta: o que não foi salvo some junto. */}
        {mudou ? <Texto variante="suave">As alterações ainda não salvas neste cartão também serão descartadas.</Texto> : null}
        {erroDoApagar ? <MensagemErro texto={erroDoApagar} /> : null}
      </PainelConfirmacao>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1.5) },
  // Os dados do Pix são o conteúdo da linha do Pix, embaixo dela, numa coluna de formulário (no PC largo não esticam).
  secaoDoPix: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
  chave: { gap: espaco(0.5) },
  // O fantasma não tem contorno: sem o recuo do preenchimento, o texto dele começa na mesma borda dos rótulos dos campos.
  fantasmaNaColuna: { marginLeft: -espaco(2) },
  poco: { borderWidth: 1, borderRadius: RAIO_CONTROLE, padding: espaco(1.5), gap: espaco(1) },
  botoes: { gap: espaco(1) },
  // Desenho do botão da Conta do aluno, sem ser botão: contorno, texto do rótulo e altura de controle.
  botaoDeMentira: { borderWidth: 1, borderRadius: RAIO_CONTROLE, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco(1.5) },
  textoDoBotao: { fontFamily: fontes.semi },
  notas: { gap: espaco(0.75) },
});
