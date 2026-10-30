import { Plus } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Cardio, Carga, CargaDaEtapa, Configuracao, Esforco, ModoDeCarga, PapelDaSerie, RegiaoDasParciais, Retomada, Tecnica } from '../../api/tipos';
import { blocosIguais, blocosSeValidos, blocosValidos, lerBlocos, listaDeBlocosIguaisSeValidos, rascunhoDoModoDiferente, textoDeBlocos } from '../../dominio/blocos';
import { modosDeCarga } from '../../dominio/editorTreino';
import { REGIOES_DAS_PARCIAIS } from '../../dominio/metodologia';
import { aoTrocarUnidade, outraUnidade, pausaEmDuasUnidades, unidadeVisivel, type UnidadeDaPausa } from '../../dominio/pausaDaTecnica';
import { problemasDaTecnica, type Problemas } from '../../dominio/validacaoDeSerie';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir, BotaoDeTexto } from './BotaoDeAbrir';
import {
  ajudaDaCarga, ajustarCargasDosBlocos, ajustarRetomadas, CARGA_DA_SERIE, cargaDaEtapaNoModo, formaDoEsforco, FORMAS_DAS_REPETICOES, opcoesDaCargaDaEtapa, FORMAS_DE_ESFORCO, formaVisivel, OPCOES_DE_RIR, repeticoesNaForma, rotulosDaFaixa,
  type FormaDasRepeticoes, type FormaDeEsforco, type Repeticoes,
} from './opcoesDoEditor';

/**
 * Os campos de prescrição que a série e a metodologia dividem: forma de carga e faixa, esforço (RIR ou RPE), técnica e
 * cardio. Cada um recebe os problemas do próprio trecho (chaves relativas: `percentualMin`, `rir`, `blocos`...) e mostra o
 * erro no campo; quem decide o que bloqueia é a tela.
 */

/** PC (a partir do menu lateral): campos curtos lado a lado. Celular: um embaixo do outro, na largura toda. */
export function useCamposLadoALado(): boolean {
  return useWindowDimensions().width >= LARGURA_MENU_LATERAL;
}

/** Campos curtos (números) numa linha que quebra no PC; empilhados no celular. Cada filho vira uma célula. */
export function LinhaDeCampos({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.linha : estilos.bloco}>
    {Children.toArray(children).map((filho, i) => <View key={i} style={largo ? estilos.campo : null}>{filho}</View>)}
  </View>;
}

/** Um campo curto sozinho: no PC não estica além de uma célula; no celular, largura toda como os outros. */
export function CampoSozinho({ children }: { children: ReactNode }) {
  const largo = useCamposLadoALado();
  return <View style={largo ? estilos.sozinho : null}>{children}</View>;
}

/** Erro de um campo que não é de digitar (escolha de chips). */
export function ErroDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{mensagem}</Texto> : null;
}

/** Aviso de um campo: aparece, mas não bloqueia. */
export function AvisoDoCampo({ mensagem }: { mensagem?: string | null }) {
  const { cores } = useTema();
  return mensagem ? <Texto variante="pequeno" cor={cores.atencao}>{mensagem}</Texto> : null;
}

// ---- Carga ----

/** A forma de carga (carga de trabalho, % da WS, mesma carga, acima da anterior, abaixo da referência, sem carga). */
export function EscolhaDeCarga({ carga, config, papel, aoMudarModo, erro, rotulo = 'Carga', rotuloVisivel = true, ajuda: ajudaPropria }: {
  carga: Carga | null | undefined; config: Configuracao | null; papel?: PapelDaSerie | null;
  aoMudarModo: (modo: ModoDeCarga) => void; erro?: string | null; rotulo?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
  /** Ajuda no lugar da padrão da forma de carga (o Cluster junta a dele numa linha só). */
  ajuda?: string;
}) {
  const modo = carga?.modo ?? 'NENHUMA';
  const ajuda = ajudaPropria ?? ajudaDaCarga(modo, config);
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={modosDeCarga(config, papel)} valor={modo} aoMudar={aoMudarModo} />
    {ajuda ? <Texto variante="pequeno">{ajuda}</Texto> : null}
    <ErroDoCampo mensagem={erro} />
  </View>;
}

/**
 * O percentual (mínimo e máximo opcional) das formas de carga que têm faixa; nada nas outras. Com várias séries, quem
 * chama passa `semAjuda` e mostra a ajuda uma vez só, embaixo de todas (teste local de 30/10).
 */
export function FaixaDeCarga({ carga, config, prefixo = '', aoMudar, erros, semAjuda = false }: {
  carga: Carga | null | undefined; config: Configuracao | null; prefixo?: string;
  aoMudar: (min: number | null, max: number | null) => void; erros: Problemas; semAjuda?: boolean;
}) {
  const rotulos = rotulosDaFaixa(carga?.modo, config);
  if (!rotulos) return null;
  // Alinhados pela base: o rótulo do máximo quebra em duas linhas e os campos ficavam desencontrados.
  return <View style={[estilos.linha, estilos.linhaPelaBase]}>
    <View style={estilos.campo}><CampoNumerico rotulo={`${prefixo}${rotulos.minimo}`} sufixo="%" valor={carga?.percentualMin ?? null}
      aoMudar={(v) => aoMudar(v, carga?.percentualMax ?? null)} erro={erros.percentualMin} ajuda={semAjuda ? undefined : rotulos.ajuda} /></View>
    <View style={estilos.campo}><CampoNumerico rotulo={`${prefixo}${rotulos.maximo}`} sufixo="%" valor={carga?.percentualMax ?? null}
      aoMudar={(v) => aoMudar(carga?.percentualMin ?? null, v)} erro={erros.percentualMax} /></View>
  </View>;
}

/** Série de referência do "abaixo da referência": só as anteriores do exercício. */
export function ReferenciaDaCarga({ opcoes, valor, aoMudar, erro }: {
  opcoes: { valor: string; rotulo: string }[]; valor: string | null | undefined; aoMudar: (uid: string) => void; erro?: string | null;
}) {
  if (opcoes.length === 0) return <ErroDoCampo mensagem={erro ?? 'Não há série anterior para servir de referência.'} />;
  return <View style={estilos.bloco}>
    <Escolha rotulo="Série de referência" opcoes={opcoes} valor={valor ?? null} aoMudar={(uid) => { if (uid) aoMudar(uid); }} />
    <ErroDoCampo mensagem={erro} />
  </View>;
}

// ---- Repetições ----

/**
 * Quantidade exata, faixa ou AMRAP. A escolha fica com a tela enquanto o valor não a distingue (faixa 8 a 8, ou vazio).
 * `semRepeticoes` explica o vazio quando ele vale (série por tempo); sem ele, o vazio é só incompleto.
 */
export function CamposDasRepeticoes({ valor, aoMudar, erros, rotulo = 'Repetições', semRepeticoes }: {
  valor: { repsMin?: number | null; repsMax?: number | null; amrap?: boolean | null }; aoMudar: (r: Repeticoes) => void;
  erros: Problemas; rotulo?: string; semRepeticoes?: string;
}) {
  const [escolhida, setEscolhida] = useState<FormaDasRepeticoes>(formaVisivel('EXATA', valor));
  const forma = formaVisivel(escolhida, valor);
  const mudarForma = (f: FormaDasRepeticoes) => {
    setEscolhida(f);
    if (f !== forma) aoMudar(repeticoesNaForma(f, valor));
  };
  const vazio = valor.repsMin == null && valor.repsMax == null && !valor.amrap;
  // Com rótulo próprio (uma retomada), os campos ganham o nome dela no leitor de tela: "Retomada 1: reps mín.".
  const proprio = rotulo !== 'Repetições';
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotulo} opcoes={FORMAS_DAS_REPETICOES} valor={forma} aoMudar={mudarForma} />
    {forma === 'EXATA' ? <CampoSozinho>
      <CampoNumerico rotulo="Repetições" rotuloAcessivel={proprio ? `${rotulo}: repetições` : undefined} inteiro valor={valor.repsMin ?? valor.repsMax ?? null}
        aoMudar={(n) => aoMudar({ repsMin: n, repsMax: n, amrap: false })} erro={erros.repsMin ?? erros.repsMax} />
    </CampoSozinho> : null}
    {forma === 'FAIXA' ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps mín." rotuloAcessivel={proprio ? `${rotulo}: reps mín.` : undefined} inteiro valor={valor.repsMin ?? null}
        aoMudar={(repsMin) => aoMudar({ repsMin, repsMax: valor.repsMax ?? null, amrap: false })} erro={erros.repsMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Reps máx." rotuloAcessivel={proprio ? `${rotulo}: reps máx.` : undefined} inteiro valor={valor.repsMax ?? null}
        aoMudar={(repsMax) => aoMudar({ repsMin: valor.repsMin ?? null, repsMax, amrap: false })} erro={erros.repsMax} /></View>
    </View> : null}
    {forma === 'AMRAP' ? <Texto variante="pequeno">O aluno faz o máximo de repetições que conseguir e anota quantas fez.</Texto> : null}
    <ErroDoCampo mensagem={forma === 'AMRAP' ? erros.amrap : null} />
    {vazio && forma !== 'AMRAP' && semRepeticoes ? <Texto variante="pequeno">{semRepeticoes}</Texto> : null}
  </View>;
}

// ---- Esforço ----

/**
 * Esforço percebido: RIR (0 a 5) ou RPE (1 a 10, de meio em meio), nunca os dois. A forma escolhida fica com a tela
 * enquanto o esforço ainda está vazio ("RIR" sem número não seria lembrado só pelo valor).
 */
export function CamposDoEsforco({ esforco, aoMudar, erros, rotulo = 'Esforço', rotuloVisivel = true }: {
  esforco: Esforco | null | undefined; aoMudar: (e: Esforco | null) => void; erros: Problemas; rotulo?: string;
  /** Falso quando o título da seção já diz o mesmo: o rótulo fica só para o leitor de tela. */
  rotuloVisivel?: boolean;
}) {
  const [escolhida, setEscolhida] = useState<FormaDeEsforco>(formaDoEsforco(esforco));
  const doValor = formaDoEsforco(esforco);
  const forma = doValor === 'NENHUM' ? escolhida : doValor;
  const mudarForma = (f: FormaDeEsforco) => {
    setEscolhida(f);
    if (f !== forma || f === 'NENHUM') aoMudar(null);
  };
  return <View style={estilos.bloco}>
    <Escolha rotulo={rotuloVisivel ? rotulo : undefined} descricao={rotulo} opcoes={FORMAS_DE_ESFORCO} valor={forma} aoMudar={mudarForma} />
    {forma === 'RIR' ? <>
      <Escolha rotulo="RIR (repetições na reserva)" opcoes={OPCOES_DE_RIR} valor={esforco?.rir ?? null} aoMudar={(rir) => aoMudar({ rir, rpe: null })} />
      {esforco?.rir === 0 ? <Texto variante="pequeno">RIR 0: o aluno vai até a falha.</Texto> : null}
      <ErroDoCampo mensagem={erros.rir} />
    </> : null}
    {forma === 'RPE' ? <CampoSozinho>
      <CampoNumerico rotulo="RPE (1 a 10, de meio em meio)" valor={esforco?.rpe ?? null} aoMudar={(rpe) => aoMudar({ rir: null, rpe })} erro={erros.rpe} ajuda="Esforço percebido. Ex.: 8 ou 8,5." />
    </CampoSozinho> : null}
  </View>;
}

// ---- Técnica ----

/**
 * Blocos do Cluster. "Blocos iguais" pede só os dois números; a notação compacta ("4+2", "4×4") fica em "Blocos
 * diferentes", junto das células, ou atrás de "Digitar como 4+2". O campo da notação mora sempre no mesmo lugar da
 * árvore: digitar troca o modo sem tirar o foco dele. O resumo vai para "Para o aluno", não aqui.
 */
function CampoBlocos({ valor, aoMudar, erro }: {
  valor: number[] | null | undefined; aoMudar: (v: number[] | null) => void; erro?: string | null;
}) {
  const [texto, setTexto] = useState(textoDeBlocos(valor ?? null));
  const [notacao, setNotacao] = useState(false);
  const [modo, setModo] = useState<'iguais' | 'diferentes'>(blocosIguais(valor) || !valor?.length ? 'iguais' : 'diferentes');
  const [confirmar, setConfirmar] = useState(false);
  const [quantidade, setQuantidade] = useState<number | null>(blocosIguais(valor) ? valor!.length : null);
  const [repsCada, setRepsCada] = useState<number | null>(blocosIguais(valor) ? valor![0] : null);
  const [quantidadeInvalida, setQuantidadeInvalida] = useState(false);
  const [repsInvalidas, setRepsInvalidas] = useState(false);
  const [rascunho, setRascunho] = useState<(number | null)[]>(valor && !blocosIguais(valor) ? [...valor] : []);
  const [invalidos, setInvalidos] = useState<ReadonlySet<number>>(() => new Set());
  const chave = JSON.stringify(valor ?? null);
  const [anterior, setAnterior] = useState(chave);
  if (anterior !== chave) {
    setAnterior(chave);
    setConfirmar(false);
    // Lista inválida zera o gravado e deixa o que a pessoa digitou. Só uma lista válida puxa os campos de volta.
    if (valor && blocosValidos(valor)) {
      setQuantidadeInvalida(false);
      setRepsInvalidas(false);
      setInvalidos(new Set());
      setRascunho([...valor]);
      if (blocosIguais(valor)) {
        setModo('iguais');
        setQuantidade(valor.length);
        setRepsCada(valor[0]);
      } else setModo('diferentes');
      if (JSON.stringify(lerBlocos(texto)) !== chave) setTexto(textoDeBlocos(valor));
    }
  }
  const erroFaixa = quantidade != null && (quantidade < 2 || quantidade > 10) ? 'De 2 a 10 blocos.' : null;
  const erroReps = repsCada != null && (repsCada < 1 || repsCada > 50) ? 'De 1 a 50 repetições.' : null;
  const aplicarIguais = (q: number | null, reps: number | null, qInvalida: boolean, rInvalida: boolean) => {
    const lista = listaDeBlocosIguaisSeValidos(q, reps, qInvalida, rInvalida);
    if (!qInvalida && !rInvalida && q != null && reps != null) setTexto(lista ? textoDeBlocos(lista) : `${q}×${reps}`);
    else if (!qInvalida && !rInvalida && q == null && reps == null) setTexto('');
    if (lista) setRascunho(lista);
    aoMudar(lista);
  };
  const invalidarQuantidade = (ok: boolean) => {
    if (ok) return;
    setQuantidadeInvalida(true);
    setRascunho([]);
    setTexto('');
    aoMudar(null);
  };
  const invalidarReps = (ok: boolean) => {
    if (ok) return;
    setRepsInvalidas(true);
    setRascunho([]);
    setTexto('');
    aoMudar(null);
  };
  const escolher = (proximo: 'iguais' | 'diferentes') => {
    if (proximo === 'iguais' && valor && !blocosIguais(valor)) {
      setConfirmar(true);
      return;
    }
    setConfirmar(false);
    if (proximo === 'diferentes') setRascunho(rascunhoDoModoDiferente(valor, rascunho));
    setModo(proximo);
  };
  const celulas = rascunho.length >= 2 ? rascunho : valor && valor.length >= 2 ? [...valor] : [];
  const publicarCelulas = (lista: readonly (number | null)[], aindaInvalidos: ReadonlySet<number>) => {
    setRascunho([...lista]);
    setInvalidos(aindaInvalidos);
    aoMudar(blocosSeValidos(lista, aindaInvalidos.size > 0));
  };
  const alterarBloco = (indice: number, reps: number | null) => {
    const proximo = [...celulas];
    proximo[indice] = reps;
    const ainda = new Set(invalidos);
    ainda.delete(indice);
    publicarCelulas(proximo, ainda);
  };
  const invalidarBloco = (indice: number, ok: boolean) => {
    if (ok) return;
    setInvalidos((atual) => new Set(atual).add(indice));
    aoMudar(null);
  };
  return <View style={estilos.bloco}>
    <Escolha rotulo="Distribuição dos blocos" opcoes={[{ valor: 'iguais', rotulo: 'Blocos iguais' }, { valor: 'diferentes', rotulo: 'Blocos diferentes' }]} valor={modo} aoMudar={escolher} />
    {confirmar ? <View style={estilos.bloco}>
      <Texto variante="pequeno">Todos os blocos ficam com as repetições do primeiro.</Texto>
      <Botao tipo="secundario" rotulo="Converter para blocos iguais" aoTocar={() => {
        const primeiro = valor?.[0];
        if (valor && primeiro != null) {
          const iguais = Array.from({ length: valor.length }, () => primeiro);
          setRascunho(iguais);
          setQuantidade(iguais.length);
          setRepsCada(primeiro);
          setQuantidadeInvalida(false);
          setRepsInvalidas(false);
          setInvalidos(new Set());
          aoMudar(iguais);
        }
        setModo('iguais');
        setConfirmar(false);
      }} />
    </View> : null}
    {modo === 'iguais' && !confirmar ? <LinhaDeCampos>
      <CampoNumerico rotulo="Quantos blocos" inteiro valor={quantidade} erro={erroFaixa}
        aoMudar={(q) => { setQuantidade(q); setQuantidadeInvalida(false); aplicarIguais(q, repsCada, false, repsInvalidas); }} aoValidade={invalidarQuantidade} />
      <CampoNumerico rotulo="Repetições em cada bloco" inteiro valor={repsCada} erro={erroReps}
        aoMudar={(reps) => { setRepsCada(reps); setRepsInvalidas(false); aplicarIguais(quantidade, reps, quantidadeInvalida, false); }} aoValidade={invalidarReps} />
    </LinhaDeCampos> : null}
    {modo === 'diferentes' && celulas.length >= 2 ? <View style={estilos.bloco}>
      <LinhaDeCampos>
        {celulas.map((reps, indice) => <CampoNumerico key={indice} rotulo={`Bloco ${indice + 1}`} inteiro valor={reps} erro={reps != null && (reps < 1 || reps > 50) ? 'De 1 a 50 repetições.' : null}
          aoMudar={(v) => alterarBloco(indice, v)} aoValidade={(ok) => invalidarBloco(indice, ok)} />)}
      </LinhaDeCampos>
      <View style={estilos.linha}>
        <Botao tipo="secundario" rotulo="Mais um bloco" desabilitado={celulas.length >= 10 || invalidos.size > 0} motivo={invalidos.size > 0 ? 'Corrija o bloco com número inválido.' : celulas.length >= 10 ? 'Máximo de 10 blocos.' : undefined} aoTocar={() => publicarCelulas([...celulas, celulas[celulas.length - 1]], invalidos)} />
        <Botao tipo="fantasma" rotulo="Menos um bloco" desabilitado={celulas.length <= 2 || invalidos.size > 0} motivo={invalidos.size > 0 ? 'Corrija o bloco com número inválido.' : celulas.length <= 2 ? 'Mínimo de 2 blocos.' : undefined} aoTocar={() => publicarCelulas(celulas.slice(0, -1), invalidos)} />
      </View>
    </View> : null}
    {modo === 'iguais' && !confirmar ? <BotaoDeAbrir texto="Digitar como 4+2" aberto={notacao} aoAlternar={() => setNotacao(!notacao)} /> : null}
    {modo === 'diferentes' || notacao ? <Campo rotulo="Blocos de repetições" valor={texto} maxLength={60} placeholder="4+2 ou 4×4"
      erro={erro ?? (texto && !blocosValidos(lerBlocos(texto)) ? 'De 2 a 10 blocos, cada um com 1 a 50 repetições.' : null)}
      aoMudar={(t) => {
        // Quem digitou aqui continua vendo o campo, mesmo que a notação faça o modo voltar para "Blocos iguais".
        setNotacao(true);
        setTexto(t);
        const lidos = lerBlocos(t);
        const gravados = blocosSeValidos(lidos, false);
        aoMudar(gravados);
        setQuantidadeInvalida(false);
        setRepsInvalidas(false);
        setInvalidos(new Set());
        if (lidos && lidos.length >= 2 && !blocosIguais(lidos)) {
          setModo('diferentes');
          setRascunho(lidos);
        } else if (gravados && blocosIguais(gravados)) {
          setModo('iguais');
          setQuantidade(gravados.length);
          setRepsCada(gravados[0]);
          setRascunho(gravados);
        }
      }} /> : null}
    {/* Sem o campo da notação na tela, o erro dos blocos (o da publicação) aparece aqui. */}
    {modo === 'diferentes' || notacao ? null : <ErroDoCampo mensagem={erro} />}
  </View>;
}

const UNIDADES_DA_PAUSA: { valor: UnidadeDaPausa; rotulo: string }[] = [{ valor: 'SEGUNDOS', rotulo: 'Segundos' }, { valor: 'RESPIRACOES', rotulo: 'Respirações' }];

/**
 * Pausa interna num controle só: o número e a unidade (segundos ou respirações). Trocar a unidade com um valor escrito
 * limpa o valor (15 s não são 15 respirações). Com os dois valores gravados, ou depois de "Informar também em …", os
 * dois campos. A falta de pausa chega em `pausaSegundos`: aparece no campo que estiver na tela. `antes` são os campos
 * curtos da técnica que dividem a linha com a pausa no PC (no celular, empilhados acima dela).
 */
function CamposDePausa({ t, mudar, e, rotulo = 'Pausa', antes = [] }: {
  t: Tecnica; mudar: (parte: Partial<Tecnica>) => void; e: Problemas; rotulo?: string; antes?: ReactNode[];
}) {
  const largo = useCamposLadoALado();
  const [escolhida, setEscolhida] = useState<UnidadeDaPausa>(unidadeVisivel('SEGUNDOS', t));
  const [pediuAsDuas, setPediuAsDuas] = useState(false);
  // Depois de "Informar também em …", o campo novo recebe o foco (o botão some da tela).
  const [focar, setFocar] = useState<UnidadeDaPausa | null>(null);
  const unidade = unidadeVisivel(escolhida, t);
  // O nome acessível sempre diz a unidade ("Pausa (s)", "Pausa em respirações"). O rótulo visível só a diz com os dois
  // campos na tela; com um só, quem diz a unidade é a escolha Segundos | Respirações ao lado.
  const segundos = (erro: string | null | undefined, aoMudar: (parte: Partial<Tecnica>) => void, comUnidade: boolean) => <CampoNumerico
    rotulo={comUnidade ? `${rotulo} (s)` : rotulo} rotuloAcessivel={`${rotulo} (s)`} inteiro valor={t.pausaSegundos ?? null}
    aoMudar={(pausaSegundos) => aoMudar({ pausaSegundos })} erro={erro} autoFocus={focar === 'SEGUNDOS'} />;
  const respiracoes = (erro: string | null | undefined, aoMudar: (parte: Partial<Tecnica>) => void, comUnidade: boolean) => <CampoNumerico
    rotulo={comUnidade ? `${rotulo} em respirações` : rotulo} rotuloAcessivel={`${rotulo} em respirações`} inteiro valor={t.pausaRespiracoes ?? null}
    aoMudar={(pausaRespiracoes) => aoMudar({ pausaRespiracoes })} erro={erro} autoFocus={focar === 'RESPIRACOES'} />;
  if (pausaEmDuasUnidades(t, pediuAsDuas)) {
    // Com os dois campos na tela, eles ficam: apagar um deles não pode desmontar o campo em que a pessoa está digitando.
    const nasDuas = (parte: Partial<Tecnica>) => { setPediuAsDuas(true); mudar(parte); };
    return <LinhaDeCampos>
      {antes}
      {segundos(e.pausaSegundos, nasDuas, true)}
      {respiracoes(e.pausaRespiracoes, nasDuas, true)}
    </LinhaDeCampos>;
  }
  const trocar = (nova: UnidadeDaPausa) => {
    const limpar = aoTrocarUnidade(t, unidade, nova);
    setEscolhida(nova);
    if (limpar) mudar(limpar);
  };
  const outra = outraUnidade(unidade) === 'SEGUNDOS' ? 'segundos' : 'respirações';
  return <View style={estilos.bloco}>
    <View style={largo ? estilos.linha : estilos.bloco}>
      {Children.toArray(antes).map((filho, i) => <View key={i} style={largo ? estilos.campo : null}>{filho}</View>)}
      {/* O número e a unidade andam juntos: se a linha quebrar no PC, os dois descem juntos. */}
      <View style={largo ? estilos.pausaComUnidade : estilos.bloco}>
        {/* A chave troca com a unidade: o texto digitado numa não passa para a outra. */}
        <View key={unidade} style={largo ? estilos.campo : null}>
          {unidade === 'SEGUNDOS' ? segundos(e.pausaSegundos, mudar, false) : respiracoes(e.pausaRespiracoes ?? e.pausaSegundos, mudar, false)}
        </View>
        {/* No PC a escolha fica à direita, na altura da caixa (descontado o rótulo do campo). */}
        <View style={largo ? estilos.unidadeAoLado : null}>
          <Escolha descricao={`Unidade da ${rotulo.toLowerCase()}`} compacta opcoes={UNIDADES_DA_PAUSA} valor={unidade} aoMudar={trocar} />
        </View>
      </View>
    </View>
    {/* O nome acessível começa pelo texto visível e diz de qual pausa é (a metodologia tem várias na mesma tela). */}
    <BotaoDeTexto Icone={Plus} texto={`Informar também em ${outra}`} rotuloAcessivel={`Informar também em ${outra} (${rotulo.toLowerCase()})`}
      aoTocar={() => { setFocar(outraUnidade(unidade)); setPediuAsDuas(true); }} />
  </View>;
}

const OPCOES_DE_REGIAO: { valor: RegiaoDasParciais | null; rotulo: string }[] = REGIOES_DAS_PARCIAIS;

/**
 * Campos próprios de cada uma das seis técnicas. `completa` é a técnica da série (cobra o que falta); falso é o padrão
 * parcial da metodologia, em que só os valores presentes são conferidos. Sem `erros`, calcula os da própria técnica.
 */
/**
 * Campos da técnica. Na série (`completa`), o Cluster pode ter a carga de cada bloco e o Rest-pause a meta e a carga de
 * cada retomada; no padrão da metodologia, não (dependem dos blocos e das pausas de cada série). `semCarga` = exercício
 * sem carga: sem carga por bloco nem retomada em %. `ws` é o nome da série de trabalho ("% da WS").
 */
export function CamposDaTecnica({ tecnica: t, aoMudar, completa = true, erros, semCarga = false, ws = 'WS' }: {
  tecnica: Tecnica; aoMudar: (t: Tecnica) => void; completa?: boolean; erros?: Problemas; semCarga?: boolean; ws?: string;
}) {
  const e = erros ?? problemasDaTecnica(t, completa);
  const mudar = (parte: Partial<Tecnica>) => aoMudar({ ...t, ...parte });
  switch (t.tipo) {
    case 'REST_PAUSE':
      return <View style={estilos.bloco}>
        <CamposDePausa t={t} mudar={mudar} e={e} antes={[
          <CampoNumerico key="pausas" rotulo="Quantas pausas" inteiro valor={t.pausas ?? null}
            aoMudar={(pausas) => mudar({ pausas, retomadas: ajustarRetomadas(t.retomadas, pausas) })} erro={e.pausas} />,
        ]} />
        {completa ? <CamposDasRetomadas t={t} mudar={mudar} e={e} semCarga={semCarga} ws={ws} /> : null}
      </View>;
    case 'CLUSTER':
      return <View style={estilos.bloco}>
        <CampoBlocos valor={t.blocos} aoMudar={(blocos) => mudar({ blocos, cargasDosBlocos: ajustarCargasDosBlocos(t.cargasDosBlocos, blocos) })} erro={e.blocos} />
        <CamposDePausa t={t} mudar={mudar} e={e} rotulo="Pausa entre blocos" />
        {completa && !semCarga ? <CamposDasCargasDosBlocos t={t} mudar={mudar} e={e} ws={ws} /> : null}
      </View>;
    case 'DROP_SET':
      // O descanso entre quedas é o mesmo `pausaSegundos`, mas só em segundos e de 0 a 600: fica fora do controle da pausa.
      return <LinhaDeCampos>
        <CampoNumerico rotulo="Quedas" inteiro valor={t.quedas ?? null} aoMudar={(quedas) => mudar({ quedas })} erro={e.quedas} />
        <CampoNumerico rotulo="Reduzir a carga" inteiro sufixo="%" valor={t.reducaoPercentual ?? null} aoMudar={(reducaoPercentual) => mudar({ reducaoPercentual })}
          erro={e.reducaoPercentual} ajuda="Vazio = sem fixar." />
        <CampoNumerico rotulo="Reps por queda" inteiro valor={t.repsPorQueda ?? null} aoMudar={(repsPorQueda) => mudar({ repsPorQueda })}
          erro={e.repsPorQueda} ajuda="Vazio = até a falha." />
        <CampoNumerico rotulo="Descanso entre quedas" inteiro sufixo="s" valor={t.pausaSegundos ?? null} aoMudar={(pausaSegundos) => mudar({ pausaSegundos })}
          erro={e.pausaSegundos} ajuda="0 ou vazio = sem descanso." />
      </LinhaDeCampos>;
    case 'MYO_REPS':
      return <View style={estilos.bloco}>
        <CamposDePausa t={t} mudar={mudar} e={e} antes={[
          <CampoNumerico key="mini" rotulo="Mini-séries" inteiro valor={t.miniSeries ?? null} aoMudar={(miniSeries) => mudar({ miniSeries })} erro={e.miniSeries} />,
          <CampoNumerico key="reps" rotulo="Reps por mini-série" inteiro valor={t.repsPorMiniSerie ?? null} aoMudar={(repsPorMiniSerie) => mudar({ repsPorMiniSerie })} erro={e.repsPorMiniSerie} />,
        ]} />
      </View>;
    case 'PARTIAL_REPS':
      return <View style={estilos.bloco}>
        <CampoSozinho><CampoNumerico rotulo="Repetições parciais" inteiro valor={t.repsParciais ?? null} aoMudar={(repsParciais) => mudar({ repsParciais })} erro={e.repsParciais} /></CampoSozinho>
        <Escolha rotulo="Região das parciais" opcoes={OPCOES_DE_REGIAO} valor={t.regiao ?? null} aoMudar={(regiao) => mudar({ regiao })} />
        <ErroDoCampo mensagem={e.regiao} />
      </View>;
    case 'FORCED_REPS':
      return <View style={estilos.bloco}>
        <CampoSozinho><CampoNumerico rotulo="Repetições assistidas" inteiro valor={t.repsAssistidas ?? null} aoMudar={(repsAssistidas) => mudar({ repsAssistidas })} erro={e.repsAssistidas} /></CampoSozinho>
        <AvisoDoCampo mensagem="Forced reps precisa de um parceiro para ajudar nas repetições." />
      </View>;
    default:
      return <ErroDoCampo mensagem={e.tipo} />;
  }
}

// ---- Etapas: carga por bloco e retomadas ----

/**
 * A carga de uma etapa numa linha só: o nome da etapa e, abaixo, "Carga da série" ou "% da WS" com o número logo ao lado
 * (o "%" vem dentro da caixa, depois do número). A lista de blocos fica curta mesmo com dez blocos no celular. O erro
 * fica embaixo da linha inteira: na caixa estreita a frase quebraria em várias linhas.
 */
/** Cabe "200" e o "%"; estreito o bastante para ficar ao lado dos dois chips no celular (390 px). */
const LARGURA_DO_PERCENTUAL = 80;

function CampoDaCargaDaEtapa({ rotulo, nomeDoPercentual, carga, aoMudar, e, prefixo, ws }: {
  rotulo: string; nomeDoPercentual: string; carga: CargaDaEtapa | null | undefined; aoMudar: (c: CargaDaEtapa) => void; e: Problemas; prefixo: string; ws: string;
}) {
  const { fatorTexto } = useTema();
  const [numeroValido, setNumeroValido] = useState(true);
  const modo = carga?.modo ?? 'DA_SERIE';
  const erro = e[`${prefixo}.percentual`] ?? e[`${prefixo}.modo`] ?? e[prefixo];
  const percentual = modo === 'PERCENTUAL_WS';
  return <View style={estilos.etapa}>
    <Texto variante="rotulo">{rotulo}</Texto>
    <View style={estilos.linhaDaEtapa}>
      <Escolha descricao={rotulo} compacta opcoes={opcoesDaCargaDaEtapa(ws)} valor={modo} aoMudar={(m) => { setNumeroValido(true); aoMudar(cargaDaEtapaNoModo(m, carga)); }} />
      {/* A largura acompanha o tamanho do texto da pessoa (o "%" dentro da caixa também cresce). */}
      {percentual ? <View style={{ width: escalar(LARGURA_DO_PERCENTUAL, fatorTexto) }}>
        <CampoNumerico rotulo={nomeDoPercentual} rotuloOculto sufixo="%" sufixoNaCaixa erroSemTexto inteiro valor={carga?.percentual ?? null}
          aoMudar={(p) => aoMudar({ modo: 'PERCENTUAL_WS', percentual: p })} erro={erro} aoValidade={setNumeroValido} />
      </View> : null}
    </View>
    <ErroDoCampo mensagem={erro ?? (percentual && !numeroValido ? 'Use só números inteiros.' : null)} />
  </View>;
}

/** Cluster: desligado, todos os blocos com a carga da série; ligado, a carga de cada bloco. */
function CamposDasCargasDosBlocos({ t, mudar, e, ws }: { t: Tecnica; mudar: (p: Partial<Tecnica>) => void; e: Problemas; ws: string }) {
  const blocos = blocosValidos(t.blocos) ? t.blocos! : null;
  const cargas = t.cargasDosBlocos;
  if (!blocos && !cargas) return null;
  return <View style={estilos.bloco}>
    <Interruptor rotulo="Personalizar carga por bloco" valor={!!cargas}
      ajuda={cargas ? undefined : 'Desligado, todos usam a carga da série.'}
      aoMudar={(ligado) => mudar({ cargasDosBlocos: ligado ? (blocos ?? []).map(() => CARGA_DA_SERIE) : null })} />
    {cargas && !blocos ? <Texto variante="pequeno">Complete os blocos para escolher a carga de cada um.</Texto> : null}
    {cargas && blocos ? blocos.map((reps, i) => (
      <CampoDaCargaDaEtapa key={i} rotulo={`Bloco ${i + 1} (${reps} ${reps === 1 ? 'rep' : 'reps'})`} nomeDoPercentual={`Percentual da ${ws}, bloco ${i + 1}`} carga={cargas[i]} e={e} prefixo={`cargasDosBlocos[${i}]`} ws={ws}
        aoMudar={(c) => mudar({ cargasDosBlocos: cargas.map((x, j) => (j === i ? c : x)) })} />
    )) : null}
    <ErroDoCampo mensagem={e.cargasDosBlocos} />
  </View>;
}

/** Rest-pause: desligado, "continue com a mesma carga até a falha"; ligado, a meta e a carga de cada retomada. */
function CamposDasRetomadas({ t, mudar, e, semCarga, ws }: { t: Tecnica; mudar: (p: Partial<Tecnica>) => void; e: Problemas; semCarga: boolean; ws: string }) {
  const { cores } = useTema();
  const retomadas = t.retomadas;
  const quantas = t.pausas != null && t.pausas >= 1 ? t.pausas : 1;
  const mudarRetomada = (i: number, parte: Partial<Retomada>) => mudar({ retomadas: (retomadas ?? []).map((r, j) => (j === i ? { ...r, ...parte } : r)) });
  return <View style={estilos.bloco}>
    <Interruptor rotulo="Definir a meta das retomadas" valor={!!retomadas}
      ajuda={retomadas ? 'A primeira etapa é a própria série.' : 'Desligado, mesma carga até a falha.'}
      aoMudar={(ligado) => mudar({ retomadas: ligado ? ajustarRetomadas([], quantas) : null })} />
    {retomadas ? retomadas.map((r, i) => {
      const nome = retomadas.length === 1 ? 'Retomada' : `Retomada ${i + 1}`;
      const prefixo = `retomadas[${i}]`;
      return <View key={i} style={[estilos.retomada, { borderColor: cores.borda }]}>
        <CamposDasRepeticoes rotulo={nome} valor={r} erros={subProblemas(e, prefixo)} aoMudar={(reps) => mudarRetomada(i, reps)} />
        {semCarga ? null : <CampoDaCargaDaEtapa rotulo={`Carga da ${nome.toLowerCase()}`} nomeDoPercentual={`Percentual da ${ws}, ${nome.toLowerCase()}`} carga={r.carga} e={e} prefixo={`${prefixo}.carga`} ws={ws}
          aoMudar={(carga) => mudarRetomada(i, { carga })} />}
      </View>;
    }) : null}
    <ErroDoCampo mensagem={e.retomadas} />
  </View>;
}

/** Os problemas de um trecho (`retomadas[0]`), com as chaves relativas a ele. */
function subProblemas(p: Problemas, prefixo: string): Problemas {
  const inicio = `${prefixo}.`;
  return Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith(inicio)).map(([k, v]) => [k.slice(inicio.length), v]));
}

// ---- Cardio ----

const CARDIO_VAZIO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null };
const ZONAS = [1, 2, 3, 4, 5].map((valor) => ({ valor: valor as number | null, rotulo: `Zona ${valor}` }));

/** Prescrição de cardio: duração, distância, ritmo, zona e, se quiser, intervalos de esforço e descanso em voltas. */
export function CamposDoCardio({ cardio, aoMudar, erros }: { cardio: Cardio | null | undefined; aoMudar: (c: Cardio) => void; erros: Problemas }) {
  const c = cardio ?? CARDIO_VAZIO;
  const mudar = (parte: Partial<Cardio>) => aoMudar({ ...CARDIO_VAZIO, ...c, ...parte });
  const i = c.intervalos;
  const mudarIntervalos = (parte: Partial<NonNullable<Cardio['intervalos']>>) => mudar({ intervalos: { trabalhoSeg: i?.trabalhoSeg ?? null, descansoSeg: i?.descansoSeg ?? null, voltas: i?.voltas ?? null, ...parte } });
  return <View style={estilos.bloco}>
    <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Duração" inteiro sufixo="min" valor={c.duracaoMin ?? null} aoMudar={(duracaoMin) => mudar({ duracaoMin })} erro={erros.duracaoMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Distância" sufixo="km" valor={c.distanciaKm ?? null} aoMudar={(distanciaKm) => mudar({ distanciaKm })} erro={erros.distanciaKm} /></View>
      <View style={estilos.campo}><Campo rotulo="Ritmo" valor={c.ritmo ?? ''} maxLength={40} placeholder="Ex.: 6 min/km"
        aoMudar={(t) => mudar({ ritmo: t.trim() ? t : null })} erro={erros.ritmo} /></View>
    </View>
    <Escolha rotulo="Zona de esforço" opcoes={ZONAS} valor={c.zona ?? null} aoMudar={(zona) => mudar({ zona })} limpavel />
    <ErroDoCampo mensagem={erros.zona} />
    <Interruptor rotulo="Intervalado" ajuda="Voltas de esforço e descanso." valor={!!i} aoMudar={(ligado) => mudar({ intervalos: ligado ? { trabalhoSeg: null, descansoSeg: null, voltas: null } : null })} />
    {i ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Esforço" inteiro sufixo="s" valor={i.trabalhoSeg ?? null} aoMudar={(trabalhoSeg) => mudarIntervalos({ trabalhoSeg })} erro={erros['intervalos.trabalhoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Descanso" inteiro sufixo="s" valor={i.descansoSeg ?? null} aoMudar={(descansoSeg) => mudarIntervalos({ descansoSeg })} erro={erros['intervalos.descansoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Voltas" inteiro valor={i.voltas ?? null} aoMudar={(voltas) => mudarIntervalos({ voltas })} erro={erros['intervalos.voltas']} /></View>
    </View> : null}
    <ErroDoCampo mensagem={erros.cardio} />
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  linhaPelaBase: { alignItems: 'flex-end' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  sozinho: { width: '100%', maxWidth: 220 },
  // Altura do rótulo do campo (13/18) mais o vão até a caixa: a escolha da unidade fica na linha da caixa.
  unidadeAoLado: { paddingTop: 18 + espaco(0.5) },
  pausaComUnidade: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start', flexGrow: 1, flexBasis: 300, maxWidth: 440 },
  etapa: { gap: espaco(0.5) },
  linhaDaEtapa: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  retomada: { gap: espaco(1), borderLeftWidth: 2, paddingLeft: espaco(1.5) },
});
