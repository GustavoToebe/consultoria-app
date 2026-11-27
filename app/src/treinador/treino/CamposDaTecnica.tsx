import { Minus, Plus } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CargaDaEtapa, RegiaoDasParciais, Retomada, Tecnica } from '../../api/tipos';
import { blocosIguais, blocosQueChegaram, blocosSeValidos, blocosValidos, comRepsIguais, lerBlocos, maisUmBloco, MAXIMO_DE_BLOCOS, MAXIMO_REPS_POR_BLOCO, menosUmBloco, MINIMO_DE_BLOCOS, modoInicialDosBlocos, rascunhoInicialDosBlocos, textoDeBlocos, type ModoDosBlocos } from '../../dominio/blocos';
import { REGIOES_DAS_PARCIAIS } from '../../dominio/metodologia';
import { aoTrocarUnidade, outraUnidade, pausaEmDuasUnidades, unidadeVisivel, type UnidadeDaPausa } from '../../dominio/pausaDaTecnica';
import { escalar } from '../../dominio/preferencias';
import { problemasDaTecnica, type Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir, BotaoDeTexto } from './BotaoDeAbrir';
import { AvisoDoCampo, CampoSozinho, CamposDasRepeticoes, ErroDoCampo, LinhaDeCampos, useCamposLadoALado } from './CamposBasicos';
import { ajustarCargasDosBlocos, ajustarRetomadas, CARGA_DA_SERIE, cargaDaEtapaNoModo, opcoesDaCargaDaEtapa } from './opcoesDoEditor';

/**
 * Campos próprios de cada técnica (blocos do Cluster, pausas, quedas, etapas), que a série e a metodologia dividem. Cada
 * campo recebe os problemas do próprio trecho (chaves relativas: `blocos`, `pausaSegundos`...) e mostra o erro no lugar.
 */

/**
 * Blocos do Cluster (27/11): a escolha "Blocos iguais | Blocos diferentes" e, numa linha, os campos pequenos dos blocos
 * (B1, B2…; nos iguais um campo só, com a quantidade ao lado) e os botões − e + no fim. A notação ("4+2", "5×5") fica
 * atrás de "Digitar como texto", nos dois sentidos com os campos. O campo é dono do rascunho e do modo: o eco do que ele
 * mesmo gravou não refaz nada (`blocosQueChegaram`, a causa do defeito do "Mais um bloco"); só lista de fora (desfazer,
 * receita) troca os campos.
 */
function CampoBlocos({ valor, aoMudar, erro }: {
  valor: number[] | null | undefined; aoMudar: (v: number[] | null) => void; erro?: string | null;
}) {
  const { fatorTexto } = useTema();
  const [modo, setModo] = useState<ModoDosBlocos>(() => modoInicialDosBlocos(valor));
  const [rascunho, setRascunho] = useState<(number | null)[]>(() => rascunhoInicialDosBlocos(valor));
  const [invalidos, setInvalidos] = useState<ReadonlySet<number>>(() => new Set());
  const [publicado, setPublicado] = useState<number[] | null>(valor ?? null);
  const [texto, setTexto] = useState(textoDeBlocos(valor ?? null));
  const [notacao, setNotacao] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  // O bloco que acabou de entrar recebe o foco (ele nasce editável, com as repetições do anterior).
  const [focar, setFocar] = useState<number | null>(null);
  const chegou = blocosQueChegaram(valor, publicado, modo);
  if (chegou.mudou) {
    setPublicado(valor ?? null);
    setRascunho(chegou.rascunho);
    setModo(chegou.modo);
    setInvalidos(new Set());
    setConfirmar(false);
    if (JSON.stringify(lerBlocos(texto)) !== JSON.stringify(valor ?? null)) setTexto(textoDeBlocos(valor));
  }
  const publicar = (lista: (number | null)[], aindaInvalidos: ReadonlySet<number>) => {
    const gravar = blocosSeValidos(lista, aindaInvalidos.size > 0);
    setRascunho(lista);
    setInvalidos(aindaInvalidos);
    setPublicado(gravar);
    if (gravar) setTexto(textoDeBlocos(gravar));
    aoMudar(gravar);
  };
  const invalidar = (indice: number, ok: boolean) => {
    if (ok) return;
    setInvalidos((atual) => new Set(atual).add(indice));
    setPublicado(null);
    aoMudar(null);
  };
  const alterarBloco = (indice: number, reps: number | null) => {
    const ainda = new Set(invalidos);
    ainda.delete(indice);
    publicar(rascunho.map((r, i) => (i === indice ? reps : r)), ainda);
  };
  const mais = () => {
    const proximo = maisUmBloco(rascunho);
    if (modo === 'diferentes') setFocar(proximo.length - 1);
    publicar(proximo, invalidos);
  };
  const menos = () => {
    const ainda = new Set(invalidos);
    ainda.delete(rascunho.length - 1);
    publicar(menosUmBloco(rascunho), ainda);
  };
  const escolher = (proximo: ModoDosBlocos) => {
    if (proximo === modo) return;
    if (proximo === 'iguais' && !blocosIguais(rascunho.filter((r): r is number => r != null)) && rascunho.some((r) => r != null)) {
      setConfirmar(true);
      return;
    }
    setConfirmar(false);
    setModo(proximo);
  };
  const corrigir = invalidos.size > 0;
  const noMaximo = rascunho.length >= MAXIMO_DE_BLOCOS;
  const caixa = { width: escalar(LARGURA_DO_BLOCO, fatorTexto) };
  const foraDaFaixa = (reps: number | null) => (reps != null && (reps < 1 || reps > MAXIMO_REPS_POR_BLOCO) ? 'De 1 a 50 repetições.' : null);
  const botoes = <View style={estilos.botoesDosBlocos}>
    <IconeBotao moldura Icone={Minus} rotulo="Remover um bloco" desabilitado={rascunho.length <= MINIMO_DE_BLOCOS} aoTocar={menos} />
    <IconeBotao moldura Icone={Plus} rotulo="Adicionar um bloco" desabilitado={noMaximo || corrigir} aoTocar={mais} />
  </View>;
  const erroDosCampos = rascunho.map(foraDaFaixa).find(Boolean) ?? null;
  return <View style={estilos.bloco}>
    <Escolha descricao="Distribuição dos blocos" compacta opcoes={[{ valor: 'iguais', rotulo: 'Blocos iguais' }, { valor: 'diferentes', rotulo: 'Blocos diferentes' }]} valor={modo} aoMudar={escolher} />
    {confirmar ? <View style={estilos.bloco}>
      <Texto variante="pequeno">Todos os blocos ficam com as repetições do primeiro.</Texto>
      <LinhaDeAcoes>
        <Botao tipo="secundario" rotulo="Converter para blocos iguais" aoTocar={() => {
          const primeiro = rascunho.find((r) => r != null) ?? null;
          setModo('iguais');
          setConfirmar(false);
          publicar(comRepsIguais(rascunho, primeiro), new Set());
        }} />
        <Botao tipo="fantasma" rotulo="Manter blocos diferentes" aoTocar={() => setConfirmar(false)} />
      </LinhaDeAcoes>
    </View> : null}
    {modo === 'iguais' && !confirmar ? <View style={estilos.linhaDosBlocos}>
      <View style={caixa}>
        <CampoNumerico rotulo="Reps" rotuloAcessivel="Repetições em cada bloco" inteiro valor={rascunho[0] ?? null} erro={foraDaFaixa(rascunho[0] ?? null)} erroSemTexto
          aoMudar={(reps) => publicar(comRepsIguais(rascunho, reps), new Set())} aoValidade={(ok) => invalidar(0, ok)} />
      </View>
      <Texto numerico style={estilos.vezes} accessibilityLiveRegion="polite">{`× ${rascunho.length} blocos`}</Texto>
      {botoes}
    </View> : null}
    {modo === 'diferentes' ? <View style={estilos.linhaDosBlocos} role="group" aria-label="Repetições de cada bloco">
      {rascunho.map((reps, i) => <View key={i} style={caixa}>
        <CampoNumerico rotulo={`B${i + 1}`} rotuloAcessivel={`Bloco ${i + 1}`} inteiro valor={reps} erro={foraDaFaixa(reps)} erroSemTexto autoFocus={focar === i}
          aoMudar={(v) => alterarBloco(i, v)} aoValidade={(ok) => invalidar(i, ok)} />
      </View>)}
      {botoes}
    </View> : null}
    {erroDosCampos ? <ErroDoCampo mensagem={erroDosCampos} /> : corrigir ? <ErroDoCampo mensagem="Use só números inteiros." /> : null}
    {noMaximo && !confirmar ? <Texto variante="pequeno">Máximo de 10 blocos.</Texto> : null}
    <BotaoDeAbrir texto="Digitar como texto" aberto={notacao} aoAlternar={() => setNotacao(!notacao)} pequeno />
    {notacao ? <View style={estilos.notacao}><Campo rotulo="Blocos de repetições" valor={texto} maxLength={60} placeholder="4+2 ou 5×5"
      erro={texto && !blocosValidos(lerBlocos(texto)) ? 'De 2 a 10 blocos, cada um com 1 a 50 repetições.' : null}
      aoMudar={(t) => {
        setTexto(t);
        const lidos = lerBlocos(t);
        const gravados = blocosSeValidos(lidos, false);
        if (lidos && lidos.length >= MINIMO_DE_BLOCOS && lidos.length <= MAXIMO_DE_BLOCOS) {
          setRascunho(lidos);
          setInvalidos(new Set());
          setConfirmar(false);
          if (!blocosIguais(lidos)) setModo('diferentes');
        }
        setPublicado(gravados);
        aoMudar(gravados);
      }} /></View> : null}
    {/* O erro da publicação (blocos que faltam), quando os campos não dizem outro. */}
    {!erroDosCampos && !corrigir ? <ErroDoCampo mensagem={erro} /> : null}
  </View>;
}

const UNIDADES_DA_PAUSA: { valor: UnidadeDaPausa; rotulo: string }[] = [{ valor: 'SEGUNDOS', rotulo: 'Segundos (s)' }, { valor: 'RESPIRACOES', rotulo: 'Respirações' }];
/** No Cluster (27/11) a unidade é curta, "s · respirações", para a pausa caber na linha dos blocos. */
const UNIDADES_CURTAS: { valor: UnidadeDaPausa; rotulo: string }[] = [{ valor: 'SEGUNDOS', rotulo: 's' }, { valor: 'RESPIRACOES', rotulo: 'respirações' }];
/** Caixa de um bloco e da pausa curta: três dígitos e o padding. */
const LARGURA_DO_BLOCO = 64;

/**
 * Pausa interna num controle só: o número e a unidade (segundos ou respirações). Trocar a unidade com um valor escrito
 * limpa o valor (15 s não são 15 respirações). Com os dois valores gravados, ou depois de "Informar também em …", os
 * dois campos. A falta de pausa chega em `pausaSegundos`: aparece no campo que estiver na tela. `antes` são os campos
 * curtos da técnica que dividem a linha com a pausa no PC (no celular, empilhados acima dela).
 */
function CamposDePausa({ t, mudar, e, rotulo = 'Pausa', antes = [], curta = false }: {
  t: Tecnica; mudar: (parte: Partial<Tecnica>) => void; e: Problemas; rotulo?: string; antes?: ReactNode[];
  /** Cluster: caixa estreita com a unidade curta ao lado, e "Informar também em respirações" só a partir dos segundos. */
  curta?: boolean;
}) {
  const largo = useCamposLadoALado() || curta;
  const { fatorTexto } = useTema();
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
        <View key={unidade} style={curta ? { width: escalar(150, fatorTexto) } : largo ? estilos.campo : null}>
          {unidade === 'SEGUNDOS' ? segundos(e.pausaSegundos, mudar, false) : respiracoes(e.pausaRespiracoes ?? e.pausaSegundos, mudar, false)}
        </View>
        {/* No PC a escolha fica à direita, na altura da caixa (descontado o rótulo do campo). */}
        <View style={largo ? estilos.unidadeAoLado : null}>
          <Escolha descricao={`Unidade da ${rotulo.toLowerCase()}`} compacta opcoes={curta ? UNIDADES_CURTAS : UNIDADES_DA_PAUSA} valor={unidade} aoMudar={trocar} />
        </View>
      </View>
    </View>
    {/* O nome acessível começa pelo texto visível e diz de qual pausa é (a metodologia tem várias na mesma tela). */}
    {curta && unidade !== 'SEGUNDOS' ? null : <BotaoDeTexto Icone={Plus} texto={`Informar também em ${outra}`} rotuloAcessivel={`Informar também em ${outra} (${rotulo.toLowerCase()})`}
      aoTocar={() => { setFocar(outraUnidade(unidade)); setPediuAsDuas(true); }} />}
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
        <CamposDePausa t={t} mudar={mudar} e={e} rotulo="Pausa entre blocos" curta />
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
      {/* Limitada à largura da faixa: no celular os dois botões quebram em vez de empurrar o cartão para o lado. */}
      <View style={estilos.limitada}>
        <Escolha descricao={rotulo} compacta opcoes={opcoesDaCargaDaEtapa(ws)} valor={modo} aoMudar={(m) => { setNumeroValido(true); aoMudar(cargaDaEtapaNoModo(m, carga)); }} />
      </View>
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

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
  // Altura do rótulo do campo (13/18) mais o vão até a caixa: a escolha da unidade fica na linha da caixa.
  unidadeAoLado: { paddingTop: 18 + espaco(0.5) },
  linhaDosBlocos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: espaco(1) },
  botoesDosBlocos: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.25) },
  vezes: { minHeight: 44, textAlignVertical: 'center', paddingTop: espaco(1.25) },
  notacao: { maxWidth: 320 },
  pausaComUnidade: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start', flexGrow: 1, flexBasis: 300, maxWidth: 440 },
  etapa: { gap: espaco(0.5) },
  linhaDaEtapa: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  limitada: { maxWidth: '100%', flexShrink: 1 },
  retomada: { gap: espaco(1), borderLeftWidth: 2, paddingLeft: espaco(1.5) },
});
