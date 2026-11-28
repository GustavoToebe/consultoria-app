import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput, type ViewStyle } from 'react-native';

import { salvarRegrasDeAtencao } from '../../api/rotas';
import type { RegrasDeAtencaoResposta, TipoDeRegraDeAtencao } from '../../api/tipos';
import { respiroLateralDaTela } from '../../dominio/larguraDoConteudo';
import {
  alternarModelo, arranjoDasRegras, corpoDoLote, errosDasRegras, errosDoLoteDaApi, MODELOS_DE_REGRA, modeloLigado, motivoDoTeto,
  novaRegra, rascunhoDasRegras, rascunhoMudou, regrasDoModelo, resumoDasRegras, temErros, TEXTOS_DAS_REGRAS, textoDaLeitura,
  TIPOS_DE_REGRA, type ErrosDaRegra, type RegraEmEdicao,
} from '../../dominio/regrasDeAtencao';
import { novoUid } from '../../dominio/uid';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Alvenaria, type PecaDaAlvenaria } from '../../ui/Alvenaria';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Alerta } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { RodapeDeAcoes } from '../../ui/LinhaDeAcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAreaDaTela } from '../../ui/useAreaDaTela';
import { useFocoAcimaDoRodape } from '../../ui/focoAcimaDoRodape';
import { Vidro } from '../../ui/Vidro';
import { useDuasColunas } from '../configuracoes/comum';
import { ExcecoesPorAluno } from './ExcecoesPorAluno';
import { CascaDaRegra, ModeloDaRegra } from './ModeloDaRegra';

const CONFIRA_OS_CAMPOS = 'Confira os campos marcados.';
const TEXTO_SEM_INTERNET = 'Não foi possível salvar. Confira a internet e tente de novo.';
/** Largura da coluna "Como funciona" ao lado da grade. */
const LARGURA_DA_LATERAL = 360;
/** Quanto o rodapé de salvar (uma linha no PC) tira da altura da lateral fixa enquanto aparece. */
const ALTURA_DO_RODAPE = espaco(10);

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo da `LateralDosMembros`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), overflowY: 'auto' } : {}) as unknown as ViewStyle;
const GRUDADA_EMBAIXO = (Platform.OS === 'web' ? { position: 'sticky', bottom: 0, zIndex: 10 } : {}) as unknown as ViewStyle;

/**
 * O corpo de Configurações › Regras de atenção (28/11): os 6 modelos numa grade de cartões (`ui/Alvenaria`: 1 coluna, 2 a
 * partir de 1280 de área e 3 na ultralarga, `arranjoDasRegras`) e, ao lado, fixa ao rolar, a coluna com "Como funciona" e
 * "Exceções por aluno" (embaixo da grade quando não cabe). Com `REGRA_ATENCAO_ALTERAR` edita um rascunho e salva o lote
 * inteiro (C1, `corpoDoLote`) pelo rodapé fixo, que só aparece com alteração; sem ela, só leitura. O rascunho mora aqui; a
 * validação, o lote, os textos e o arranjo são de `dominio/regrasDeAtencao`.
 */
export function FormularioDasRegras({ dados, podeAlterar, aoSalvar, aoRecarregar }: {
  dados: RegrasDeAtencaoResposta;
  podeAlterar: boolean;
  aoSalvar: (novo: RegrasDeAtencaoResposta) => void;
  aoRecarregar: () => void;
}) {
  const apoio = <><ComoFunciona /><ExcecoesPorAluno dados={dados} /></>;
  return podeAlterar
    ? <Edicao dados={dados} aoSalvar={aoSalvar} aoRecarregar={aoRecarregar} apoio={apoio} />
    : <Leitura dados={dados} apoio={apoio} />;
}

/**
 * Grade e lateral pela área da `Tela` (4.10). A mesma árvore nos dois arranjos (só o estilo muda): cruzar 1280 não remonta
 * os campos nem perde o que foi digitado. No DOM a grade vem antes da lateral (Tab e leitor de tela leem as regras primeiro).
 */
function GradeComLateral({ cabeca, pecas, apoio, folgaEmbaixo }: {
  cabeca: ReactNode;
  pecas: readonly PecaDaAlvenaria[];
  apoio: ReactNode;
  /** Altura do rodapé fixo que aparece embaixo (a lateral fixa não passa por baixo dele). */
  folgaEmbaixo: number;
}) {
  const { faixa, largura } = useAreaDaTela();
  const janela = useWindowDimensions();
  const { lado, colunas } = arranjoDasRegras(faixa, largura);
  return (
    // Antes da medida da `Tela` (largura 0), invisível: sem isso a lateral nascia embaixo e saltava para o lado.
    <View style={[lado ? estilos.ladoALado : estilos.empilhado, largura === 0 ? estilos.semMedida : null]}>
      <View style={estilos.principal}>
        {cabeca}
        <Alvenaria colunas={() => colunas} vao={espaco(2)} pecas={pecas} />
      </View>
      <View role="complementary" aria-label="Como funciona e exceções por aluno"
        style={lado
          ? [estilos.lateral, GRUDADA, Platform.OS === 'web' && { maxHeight: janela.height - espaco(4) - folgaEmbaixo }]
          : estilos.lateralEmbaixo}>
        {apoio}
      </View>
    </View>
  );
}

/** "Me avise quando" e o resumo ("2 de 6 ligadas"), que é região viva: ligar e desligar se anuncia sem mover o foco. */
function CabecaDaGrade({ resumo, foco }: { resumo: string; foco?: RefObject<View | null> }) {
  return (
    <View ref={foco} tabIndex={-1} style={estilos.cabecaDaGrade}>
      <Texto variante="bloco" nivel={2}>{TEXTOS_DAS_REGRAS.cartao}</Texto>
      <View aria-live="polite"><Texto variante="suave">{resumo}</Texto></View>
    </View>
  );
}

/** Campo da regra que a pessoa já deixou (o erro local só aparece depois disso, ou depois de tentar salvar). */
const chaveDoCampo = (chave: string, campo: keyof ErrosDaRegra) => `${chave}:${campo}`;

function Edicao({ dados, aoSalvar, aoRecarregar, apoio }: {
  dados: RegrasDeAtencaoResposta;
  aoSalvar: (novo: RegrasDeAtencaoResposta) => void;
  aoRecarregar: () => void;
  apoio: ReactNode;
}) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [rascunho, setRascunho] = useState<RegraEmEdicao[]>(() => rascunhoDasRegras(dados.regras));
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set());
  const [tentou, setTentou] = useState(false);
  // Os erros do 422, já na linha certa; somem do campo que a pessoa muda.
  const [doServidor, setDoServidor] = useState<Record<string, ErrosDaRegra>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const numeros = useRef(new Map<string, TextInput | null>());
  const topo = useRef<View>(null);

  const locais = errosDasRegras(rascunho, dados.perguntas);
  const mudou = rascunhoMudou(rascunho, dados.regras);
  useGuardaDeSaida(mudou);

  const erro = (chave: string, campo: keyof ErrosDaRegra) =>
    doServidor[chave]?.[campo] ?? (tentou || tocados.has(chaveDoCampo(chave, campo)) ? locais[chave]?.[campo] : undefined);

  const tirarDoServidor = (chave: string, campos: readonly (keyof ErrosDaRegra)[]) => setDoServidor((atual) => {
    if (!atual[chave]) return atual;
    const resto = { ...atual[chave] };
    for (const c of campos) delete resto[c];
    return { ...atual, [chave]: resto };
  });

  const acoesDo = (tipo: TipoDeRegraDeAtencao) => ({
    alternar: (ligar: boolean) => setRascunho((r) => alternarModelo(r, tipo, ligar, novoUid())),
    mudar: (chave: string, parcial: Partial<Pick<RegraEmEdicao, 'perguntaId' | 'limite'>>) => {
      setRascunho((r) => r.map((x) => (x.chave === chave ? { ...x, ...parcial } : x)));
      const campos = Object.keys(parcial) as (keyof ErrosDaRegra)[];
      tirarDoServidor(chave, campos);
      // Escolher a pergunta é deixar o campo; a escala nova pode mudar o erro do número.
      if (parcial.perguntaId !== undefined) setTocados((t) => new Set(t).add(chaveDoCampo(chave, 'perguntaId')));
    },
    sairDoNumero: (chave: string) => setTocados((t) => new Set(t).add(chaveDoCampo(chave, 'limite'))),
    adicionar: () => setRascunho((r) => [...r, novaRegra(tipo, novoUid())]),
    remover: (chave: string) => setRascunho((r) => r.filter((x) => x.chave !== chave)),
    erro,
    refDoNumero: (chave: string) => (campo: TextInput | null) => { numeros.current.set(chave, campo); },
  });

  /** Cancelar: volta ao gravado. O rodapé some com os botões; o foco vai ao topo da grade. */
  const cancelar = () => {
    setRascunho(rascunhoDasRegras(dados.regras));
    setTocados(new Set());
    setTentou(false);
    setDoServidor({});
    setErroGeral(null);
    requestAnimationFrame(() => topo.current?.focus());
  };

  /** Foco no primeiro número com erro, na ordem da tela (a pergunta não recebe foco: o erro dela é anunciado). */
  const focarNoPrimeiroNumero = (erros: Readonly<Record<string, ErrosDaRegra>>) => {
    const primeira = TIPOS_DE_REGRA.flatMap((t) => regrasDoModelo(rascunho, t)).find((r) => erros[r.chave]?.limite);
    if (primeira) setTimeout(() => numeros.current.get(primeira.chave)?.focus(), 0);
  };

  const salvar = () => {
    if (enviando) return;
    if (temErros(locais)) {
      setTentou(true);
      setErroGeral(CONFIRA_OS_CAMPOS);
      focarNoPrimeiroNumero(locais);
      return;
    }
    const { corpo, chaves } = corpoDoLote(dados.versao, rascunho, dados.regras);
    setEnviando(true);
    setErroGeral(null);
    setDoServidor({});
    salvarRegrasDeAtencao(corpo).then(
      (novo) => {
        setEnviando(false);
        avisar(TEXTOS_DAS_REGRAS.salvas, 'sucesso');
        aoSalvar(novo);
      },
      (e: unknown) => {
        setEnviando(false);
        if (codigoApi(e) === 'CONFLITO_EDICAO') {
          avisar(TEXTOS_DAS_REGRAS.conflito, 'neutro');
          aoRecarregar();
          return;
        }
        const campos = errosPorCampo(e);
        if (Object.keys(campos).length > 0) {
          // 422 `REGRA_INVALIDA`: a mensagem da API vai, sem reescrever, para a linha e o campo que ela aponta.
          const { porRegra, geral } = errosDoLoteDaApi(campos, chaves);
          setDoServidor(porRegra);
          setErroGeral(geral ?? CONFIRA_OS_CAMPOS);
          focarNoPrimeiroNumero(porRegra);
          return;
        }
        setErroGeral(erroDeConexao(e) ? TEXTO_SEM_INTERNET : textoDoErro(e));
      },
    );
  };

  const teto = motivoDoTeto(rascunho, dados.teto);
  const podeVerQuestionarios = pode('QUESTIONARIO_LER');
  // Uma regra gravada desligada também vai no lote e é validada: com erro a corrigir, os campos do modelo aparecem.
  const comErroVisivel = (tipo: TipoDeRegraDeAtencao) => regrasDoModelo(rascunho, tipo).some((r) => erro(r.chave, 'perguntaId') || erro(r.chave, 'limite'));
  // Peso igual em todos: ligar ou desligar um modelo nunca o leva para outra coluna.
  const pecas = TIPOS_DE_REGRA.map((tipo) => {
    const ligado = modeloLigado(rascunho, tipo);
    return {
      chave: tipo, peso: 1,
      conteudo: (
        <ModeloDaRegra modelo={MODELOS_DE_REGRA[tipo]} regras={regrasDoModelo(rascunho, tipo)} ligado={ligado}
          aberto={ligado || comErroVisivel(tipo)} perguntas={dados.perguntas} teto={teto} acoes={acoesDo(tipo)}
          podeVerQuestionarios={podeVerQuestionarios} />
      ),
    };
  });

  return (
    <View style={estilos.formulario}>
      <GradeComLateral cabeca={<CabecaDaGrade resumo={resumoDasRegras(rascunho)} foco={topo} />} pecas={pecas} apoio={apoio}
        folgaEmbaixo={mudou ? ALTURA_DO_RODAPE : 0} />
      <RodapeDasRegras mudou={mudou} enviando={enviando} erro={erroGeral} aoSalvar={salvar} aoCancelar={cancelar} />
    </View>
  );
}

/**
 * O rodapé de salvar (28/11), no molde do rodapé fixo da `TelaDoEditor`: só com alteração, "Alterações não salvas" à
 * esquerda e "Cancelar" e "Salvar regras" à direita (em coluna no celular, a principal em cima); o erro do salvar fica
 * acima, perto da ação. Na web gruda na base da rolagem, em vidro (o toast sobe acima dele, `ui/rodapeFixoDaPagina`); o
 * contêiner e o status ficam sempre montados (vazios, sem altura) para o "Alterações não salvas" ser anunciado.
 * shortcut: no celular nativo fica no fim do conteúdo, sem grudar; levar para fora da rolagem (como a `TelaDoEditor`) se o
 * Gustavo pedir o rodapé fixo também no aparelho.
 */
function RodapeDasRegras({ mudou, enviando, erro, aoSalvar, aoCancelar }: {
  mudou: boolean;
  enviando: boolean;
  erro: string | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const recuo = respiroLateralDaTela(useFaixaDaTela()) ?? espaco(2);
  const empilhar = width < LARGURA_MENU_LATERAL;
  // Tab no último campo não fica escondido atrás do rodapé grudado (WCAG 2.4.11).
  const ref = useFocoAcimaDoRodape(mudou);
  return (
    <Vidro ref={ref} estilo={mudou
      ? [GRUDADA_EMBAIXO, estilos.rodape, { borderTopWidth: bordas.item, borderTopColor: cores.divisor, marginHorizontal: -recuo, paddingHorizontal: recuo }]
      : null}>
      {mudou && erro ? <Alerta tom="perigo" texto={erro} /> : null}
      <View style={[estilos.linhaDoRodape, empilhar ? estilos.linhaEmpilhada : null]}>
        <View aria-live="polite" style={estilos.status}>
          {mudou ? <Texto cor={cores.texto}>Alterações não salvas</Texto> : null}
        </View>
        {mudou ? (
          <RodapeDeAcoes empilhar={empilhar}>
            <Botao rotulo="Cancelar" rotuloAcessivel="Cancelar as alterações das regras de atenção" tipo="secundario" desabilitado={enviando} aoTocar={aoCancelar} />
            <Botao rotulo="Salvar regras" carregando={enviando} aoTocar={aoSalvar} />
          </RodapeDeAcoes>
        ) : null}
      </View>
    </Vidro>
  );
}

/** Sem `REGRA_ATENCAO_ALTERAR`: a mesma grade, sem interruptores, com o que cada modelo faz hoje. */
function Leitura({ dados, apoio }: { dados: RegrasDeAtencaoResposta; apoio: ReactNode }) {
  const rascunho = rascunhoDasRegras(dados.regras);
  const pecas = TIPOS_DE_REGRA.map((tipo) => {
    const regras = regrasDoModelo(rascunho, tipo);
    const textos = regras.length ? regras.map((r) => textoDaLeitura(r, dados.perguntas)) : [TEXTOS_DAS_REGRAS.desligada];
    return {
      chave: tipo, peso: 1,
      conteudo: (
        <CascaDaRegra modelo={MODELOS_DE_REGRA[tipo]} ligado={modeloLigado(rascunho, tipo)}>
          <View style={estilos.leitura}>{textos.map((t, i) => <Texto key={i}>{t}</Texto>)}</View>
        </CascaDaRegra>
      ),
    };
  });
  return (
    <GradeComLateral folgaEmbaixo={0} pecas={pecas} apoio={apoio}
      cabeca={(
        <View style={estilos.cabecaDaLeitura}>
          <CabecaDaGrade resumo={resumoDasRegras(rascunho)} />
          <Texto variante="suave">{TEXTOS_DAS_REGRAS.soLeitura}</Texto>
        </View>
      )} />
  );
}

/** Apoio: o que a regra faz e o que não faz (texto menor), e onde ligar o aviso no celular. */
function ComoFunciona() {
  const { pode } = useSessao();
  const duas = useDuasColunas();
  // O aviso no celular só vai a quem lê as atualizações e os dados sensíveis (R8): o atalho só aparece para quem o vê.
  const comAviso = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
  return (
    <Cartao titulo={TEXTOS_DAS_REGRAS.comoFunciona}>
      <View role="list" style={estilos.itens}>
        {TEXTOS_DAS_REGRAS.itensDoComoFunciona.map((t) => (
          <View key={t} role="listitem" style={estilos.item}>
            <Texto variante="pequeno" aria-hidden>•</Texto>
            <Texto variante="pequeno" style={estilos.textoDoItem}>{t}</Texto>
          </View>
        ))}
      </View>
      {comAviso ? (
        // No PC, Aparência e preferências abre aqui mesmo, na coluna da direita de Configurações.
        <Texto variante="pequeno">Avisos no celular: <LinkTexto href={duas ? '/treinador/configuracoes/ajustes' : '/treinador/ajustes'} texto="Aparência e preferências" />.</Texto>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espaco(3) },
  // `flex-start`: sem ele a lateral estica até a altura da grade e o `sticky` não tem para onde andar.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(4) },
  empilhado: { gap: espaco(3) },
  principal: { flex: 1, minWidth: 0, gap: espaco(2) },
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0, gap: espaco(3) },
  lateralEmbaixo: { gap: espaco(3) },
  semMedida: { opacity: 0 },
  cabecaDaGrade: { gap: 2 },
  cabecaDaLeitura: { gap: espaco(1) },
  leitura: { gap: espaco(0.5) },
  rodape: { paddingVertical: espaco(1.5), marginBottom: -espaco(2), gap: espaco(1.5) },
  linhaDoRodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(2) },
  linhaEmpilhada: { flexDirection: 'column', alignItems: 'stretch', gap: espaco(1.5) },
  status: { flexGrow: 1, flexShrink: 1 },
  itens: { gap: espaco(1) },
  item: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDoItem: { flex: 1 },
});
