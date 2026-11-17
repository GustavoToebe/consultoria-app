import { useRef, useState } from 'react';
import { StyleSheet, View, type KeyboardTypeOptions, type TextInput, type TextInputProps } from 'react-native';

import type { FormasDeRecebimento, TipoDeChavePix } from '../../api/financeiroTipos';
import { buscarFormasDeRecebimento, salvarFormasDeRecebimento } from '../../api/rotas';
import {
  contadorDoPix, corpoDasFormas, estadoDasFormas, formasAlteradas, LIMITES_DO_PIX, mascaraDaChavePix, MENSAGEM_CAMPOS_DAS_FORMAS,
  TIPOS_DE_CHAVE_PIX, traduzirErroDasFormas, type CampoDasFormas, type ErrosDasFormas, type EstadoDasFormas,
} from '../../dominio/formasDeRecebimento';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const TITULO = 'Formas de recebimento';
const DESCRICAO = 'Como o aluno pode pagar as cobranças, na Conta dele. O app não recebe nem guarda dinheiro.';
const TEXTO_MANUAL = 'Você combina com o aluno e registra o pagamento à mão. É o que ele vê quando nenhuma outra forma vale para a cobrança.';
const TEXTO_LINK_PROPRIO = 'O aluno abre o link que você põe no plano (Planos › Link de pagamento). Vale só para a mensalidade; você registra o pagamento à mão.';
const TEXTO_PIX = 'O aluno copia um código Pix com o valor da cobrança e paga no app do banco. Você confere o extrato e registra o pagamento à mão.';
const AVISO_DA_CHAVE = 'A chave Pix vai dentro do código que o aluno copia: quem tiver o código consegue ver a chave. Se não quiser mostrar o seu CPF, use uma chave aleatória ou o e-mail.';

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
 * Formas de recebimento da consultoria (`GET/PUT /financeiro/formas-de-recebimento`): o treinador liga InfinitePay, link
 * próprio e Pix; o Manual está sempre ligado. Com o Pix, tipo e chave, nome do recebedor e cidade. A chave é DADO PESSOAL:
 * a API só devolve `chaveMascarada`; o que se digita vive só no estado deste formulário e some ao salvar (o formulário
 * nasce de novo pela `versao`). Ler exige `FINANCEIRO_LER` e `ALUNO_LER`; sem `FINANCEIRO_ALTERAR`, só leitura.
 * `comInfinitePay` falso (módulo da InfinitePay desligado na instalação): a linha some e o valor gravado segue igual no `PUT`.
 */
export function CartaoFormasDeRecebimento({ podeAlterar, comInfinitePay, infinitePayConfigurada }: {
  podeAlterar: boolean;
  comInfinitePay: boolean;
  /** A InfiniteTag está salva (o "Pagar" da InfinitePay só aparece ao aluno com ela); `undefined` enquanto carrega. */
  infinitePayConfigurada: boolean | undefined;
}) {
  const { pode } = useSessao();
  const podeLer = pode('ALUNO_LER');
  const carga = useCarregar(podeLer ? 'formas-de-recebimento' : null, () => buscarFormasDeRecebimento());
  const { dados, erro, recarregar, definir } = carga;
  if (!podeLer) {
    return (
      <Cartao titulo={TITULO}>
        <Texto variante="suave">Para ver as formas de recebimento, o seu perfil precisa também da permissão de ver alunos. Peça a um administrador da consultoria.</Texto>
      </Cartao>
    );
  }
  if (!dados) {
    return (
      <Cartao titulo={TITULO} descricao={DESCRICAO}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : <Esqueleto />}
      </Cartao>
    );
  }
  if (!podeAlterar) return <Leitura dados={dados} comInfinitePay={comInfinitePay} />;
  // A chave do formulário é a versão: salvar ou recarregar traz outra versão e o formulário nasce de novo, sem resto de digitação.
  return <Formulario key={dados.versao ?? 'novo'} dados={dados} comInfinitePay={comInfinitePay} infinitePayConfigurada={infinitePayConfigurada}
    aoSalvar={definir} aoRecarregar={recarregar} />;
}

function Leitura({ dados, comInfinitePay }: { dados: FormasDeRecebimento; comInfinitePay: boolean }) {
  const p = dados.pixConfig;
  return (
    <Cartao titulo={TITULO} descricao={DESCRICAO}>
      <CamposEmLinha minimo={160}>
        {comInfinitePay ? <CampoLeitura rotulo="InfinitePay" valor={ligada(dados.infinitePay)} /> : null}
        <CampoLeitura rotulo="Link de pagamento próprio" valor={ligada(dados.linkProprio)} />
        <CampoLeitura rotulo="Pix copia e cola" valor={ligada(dados.pix)} />
        <CampoLeitura rotulo="Manual" valor="Sempre ligado" />
      </CamposEmLinha>
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

function Formulario({ dados, comInfinitePay, infinitePayConfigurada, aoSalvar, aoRecarregar }: {
  dados: FormasDeRecebimento;
  comInfinitePay: boolean;
  infinitePayConfigurada: boolean | undefined;
  aoSalvar: (novo: FormasDeRecebimento) => void;
  aoRecarregar: () => void;
}) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const gravado = estadoDasFormas(dados);
  const [estado, setEstado] = useState<EstadoDasFormas>(gravado);
  const [trocando, setTrocando] = useState(false);
  const [erros, setErros] = useState<ErrosDasFormas>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const refTipo = useRef<{ focus: () => void } | null>(null);
  const refChave = useRef<TextInput>(null);
  const refNome = useRef<TextInput>(null);
  const refCidade = useRef<TextInput>(null);
  const refTrocar = useRef<View>(null);

  // Trocar o tipo da chave gravada pede a chave nova (o servidor recusa sem ela): o campo aparece sozinho. Erro na chave (do
  // servidor, com a gravada) também abre o campo: o erro precisa de um lugar e a saída é digitar outra.
  const campoDaChave = !estado.chaveConfigurada || trocando || estado.tipoChave !== estado.tipoChaveGravado || !!erros.chave;
  const mudou = formasAlteradas(estado, gravado);
  const mudar = (parcial: Partial<EstadoDasFormas>, campo?: CampoDasFormas) => {
    setEstado((e) => ({ ...e, ...parcial }));
    if (campo) setErros((e) => ({ ...e, [campo]: undefined }));
    setMensagem(null);
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

  const doTipo = estado.tipoChave ? DO_TIPO[estado.tipoChave] : null;
  const ajudaDaInfinitePay = infinitePayConfigurada === false
    ? 'O aluno paga por Pix ou cartão no link da InfinitePay. Ele só vê este "Pagar" depois que a sua InfiniteTag estiver salva, logo abaixo.'
    : 'O aluno paga por Pix ou cartão no link da InfinitePay, e o pagamento é registrado sozinho.';

  return (
    <Cartao titulo={TITULO} descricao={DESCRICAO}
      rodape={(
        <LinhaDeAcoes alinhar="fim">
          <Botao rotulo="Salvar" rotuloAcessivel="Salvar formas de recebimento" carregando={enviando} desabilitado={!mudou}
            motivo="Nada foi alterado." aoTocar={salvar} />
        </LinhaDeAcoes>
      )}>
      <View style={estilos.formas}>
        {comInfinitePay ? (
          <Interruptor rotulo="InfinitePay" valor={estado.infinitePay} aoMudar={(v) => mudar({ infinitePay: v })} ajuda={ajudaDaInfinitePay} />
        ) : null}
        <Interruptor rotulo="Link de pagamento próprio" valor={estado.linkProprio} aoMudar={(v) => mudar({ linkProprio: v })} ajuda={TEXTO_LINK_PROPRIO} />
        <Interruptor rotulo="Pix copia e cola" valor={estado.pix} aoMudar={(v) => mudar({ pix: v })} ajuda={TEXTO_PIX} />
        {/* Sempre ligado: não é um interruptor apagado (que pareceria quebrado), é uma linha que diz por quê. */}
        <View style={estilos.fixa} accessible accessibilityLabel={`Manual, sempre ligado. ${TEXTO_MANUAL}`}>
          <View style={estilos.textosDaFixa}>
            <Texto variante="rotulo" cor={cores.texto}>Manual</Texto>
            <Texto variante="pequeno">{TEXTO_MANUAL}</Texto>
          </View>
          <Texto variante="pequeno">Sempre ligado</Texto>
        </View>
      </View>

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
                ajuda={doTipo?.ajuda ?? 'Escolha antes o tipo da chave.'} editable={!!estado.tipoChave}
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
        </View>
      ) : estado.chaveConfigurada ? (
        <Texto variante="suave">O Pix está desligado. A chave e os dados gravados continuam guardados para quando você ligar de novo.</Texto>
      ) : null}

      {mensagem ? <MensagemErro texto={mensagem} erro={erroGeral ?? undefined} /> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  formas: { gap: espaco(1.5) },
  fixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE },
  textosDaFixa: { flex: 1, gap: 2 },
  secao: { gap: espaco(1.5) },
  // Os dados do Pix são outro grupo: o dobro do espaço entre as formas.
  secaoDoPix: { gap: espaco(1.5), marginTop: espaco(1) },
  chave: { gap: espaco(0.5) },
  // O fantasma não tem contorno: sem o recuo do preenchimento, o texto dele começa na mesma borda dos rótulos dos campos.
  fantasmaNaColuna: { marginLeft: -espaco(2) },
});
