import * as DocumentPicker from 'expo-document-picker';
import { Apple, Check, Download, Dumbbell, FileSpreadsheet, FileUp, FlaskConical, Pill, Scale, Trash2, Undo2, Users, type LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useId, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { colunasDaImportacao, confirmarImportacao, csvDeErrosDaImportacao, detalheDaImportacao, listarImportacoes, previaDaImportacao } from '../../api/rotas';
import type { ColunasDaImportacao, DetalheDeImportacao, PreviaDeImportacao } from '../../api/tipos';
import {
  ETAPAS_DA_IMPORTACAO, LINHA_DO_CABECALHO_PADRAO, SEM_AJUSTES, agruparErros, ajustarCelula, avisoDeTituloDeDado, colunasComTituloDeDado, ondeDoErro, textoDoGrupoDeErros, ajustesParaApi, alternarRemovida, avisoDoCorte, campoDaColuna, camposPermitidos,
  celulaAjustada, errosNaTabela, escolherCampoDaColuna, explicacaoDosExistentes, linhasDaPlanilha, motivoParaNaoContinuar,
  opcoesDaLinhaDoCabecalho, opcoesDoCampoDaColuna, paginaDaPlanilha, primeiraLinhaDeDados, resumoDaValidacao, tamanhoParaTela, textoDoQueVaiAcontecer, tipoDoArquivo,
  totalDeAjustes, type AjustesDaTabela, type EtapaDaImportacao, type MapaDaImportacao,
} from '../../dominio/assistenteDaImportacao';
import { DESTINOS, destinosPermitidos, faltandoColuna, sugerirMapeamento, type Destino, type DestinoDaImportacao } from '../../dominio/mapeamentoDaImportacao';
import { paraSetParams } from '../../dominio/filtrosComuns';
import {
  ARQUIVOS, CHAVES_DO_ENDERECO, chipsDosFiltros, lerDoEndereco, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro, SITUACOES,
  type ChaveDoFiltro, type FiltrosDaImportacao, type ParametrosDoEndereco,
} from '../../dominio/filtrosDaImportacao';
import { dataHoraParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, LARGURA_MAXIMA, RAIO, espaco, fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../../ui/EscolhaSuspensa';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { useGuardaDeSaida, useSaidaGuardada } from '../../ui/GuardaDeSaida';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { textoDoErro as textoDoErroDaApi } from '../../ui/erros';
import { CelulaDoFiltro, UmaOpcao } from '../SeletoresDeFiltro';
import { useCarregar } from '../../ui/useCarregar';
import { baixarCsv } from '../financeiro/baixarCsv';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { formulario, type ArquivoEscolhido } from './formularioDaImportacao';

const SITUACAO: Record<string, { texto: string; tipo: TipoSelo }> = {
  CONCLUIDA: { texto: 'Concluída', tipo: 'sucesso' },
  CONCLUIDA_COM_ERROS: { texto: 'Concluída com erros', tipo: 'atencao' },
  FALHOU: { texto: 'Falhou', tipo: 'perigo' },
};

const BASE_MODELO = 'https://consultoria.servirea.com.br/modelos/importacao';
/** Colunas fixas da tabela do mapeamento: o número da linha e a lixeira. */
const LARGURA_DO_NUMERO = 72;
const LARGURA_DA_ACAO = 56;
/** Abaixo desta largura o indicador de etapas vira "Etapa N de 5" e as colunas da tabela ficam mais estreitas. */
const LARGURA_ESTREITA = 600;
const ERROS_NA_TELA = 50;

function abrirModelo(nome: string) {
  const caminho = `/modelos/importacao/${nome}`;
  if (Platform.OS === 'web') {
    const abrir = (globalThis as { open?: (url: string, alvo: string, recursos: string) => void }).open;
    abrir?.(caminho, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(`${BASE_MODELO}/${nome}`);
}

/** Rótulo do destino ("Alunos"), ou o próprio id se a versão da API trouxer um destino que o app não conhece. */
const rotuloDoDestino = (id: string) => DESTINOS.find((d) => d.id === id)?.rotulo ?? id;

/**
 * Lista do que já foi importado; "Nova importação" abre o assistente em etapas numa tela inteira
 * (`/treinador/importacao/nova`). O arquivo não fica guardado: o histórico guarda só a extensão, por isso cada
 * importação é identificada pelo destino e pela data. Destino, situação e tipo do arquivo ficam na barra de filtros, no
 * endereço (`?destino=&situacao=&arquivo=`; `docs/planos/filtros-nas-listas.md`, D10).
 */
export function TelaImportacao() {
  const { pode } = useSessao();
  const router = useRouter();
  const permitidos = destinosPermitidos(pode);
  const filtros = lerDoEndereco(useLocalSearchParams<Record<keyof ParametrosDoEndereco, string>>(), permitidos);
  const [pagina, setPagina] = useState(0);
  const [modelos, setModelos] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const filtro = { ...pedidoDaApi(filtros), pagina };
  const lista = useCarregar(JSON.stringify(filtro), () => listarImportacoes(filtro));
  // Trocar um filtro troca o endereço sem empilhar histórico e volta à página 1.
  const aplicar = (novos: FiltrosDaImportacao) => {
    setPagina(0);
    router.setParams(paraSetParams(CHAVES_DO_ENDERECO, paraEndereco(novos)));
  };
  const chips = chipsDosFiltros(filtros, rotuloDoDestino);

  return (
    <>
      <LinhaDeAcoes>
        <Botao rotulo="Nova importação" Icone={FileUp} aoTocar={() => router.push('/treinador/importacao/nova')} />
        <Botao rotulo="Modelos de planilha" tipo="secundario" aoTocar={() => setModelos(true)} />
      </LinhaDeAcoes>
      <BarraDeFiltros valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS} chips={chips}
        aoTirar={(chave) => aplicar(semOFiltro(filtros, chave as ChaveDoFiltro))} rotuloDoResultado="Ver importações"
        seletores={(atuais, mudar) => <>
          <CelulaDoFiltro>
            <UmaOpcao rotulo="Destino" valor={atuais.destino} aoMudar={(destino) => mudar({ ...atuais, destino })}
              opcoes={[{ valor: '', rotulo: 'Todos' }, ...permitidos.map((d) => ({ valor: d.id, rotulo: d.rotulo }))]} />
          </CelulaDoFiltro>
          <CelulaDoFiltro>
            <UmaOpcao rotulo="Situação" valor={atuais.situacao} aoMudar={(situacao) => mudar({ ...atuais, situacao })}
              opcoes={[{ valor: '' as const, rotulo: 'Todas' }, ...SITUACOES]} />
          </CelulaDoFiltro>
          <CelulaDoFiltro>
            <UmaOpcao rotulo="Arquivo" valor={atuais.arquivo} aoMudar={(arquivo) => mudar({ ...atuais, arquivo })}
              opcoes={[{ valor: '' as const, rotulo: 'Todos' }, ...ARQUIVOS]} />
          </CelulaDoFiltro>
        </>} />
      {lista.erro ? <MensagemErro texto={textoDoErroDaApi(lista.erro)} tentarDeNovo={lista.recarregar} /> : null}
      {lista.carregando && !lista.dados ? <Esqueleto /> : null}
      {lista.dados?.itens.length === 0 ? (chips.length
        ? <Vazio titulo="Nenhuma importação com esses filtros" texto="Tire algum filtro para ver mais." acao={{ rotulo: 'Limpar filtros', aoTocar: () => aplicar(SEM_FILTROS) }} />
        : <Vazio titulo="Nenhuma importação" texto="Quando você confirmar uma planilha, ela aparece aqui. O arquivo em si não fica guardado." />) : null}
      {lista.dados && lista.dados.itens.length > 0 ? (
        <Cartao titulo="Histórico" descricao={`${lista.dados.total} ${lista.dados.total === 1 ? 'importação' : 'importações'}.`}>
          <Tabela rotulo="Importações" linhas={lista.dados.itens} chave={(i) => i.id} aoTocarLinha={(i) => setDetalheId(i.id)}
            rotuloDaLinha={(i) => `Abrir a importação de ${rotuloDoDestino(i.destino)} de ${dataHoraParaTela(i.criadoEm)}`} colunas={[
            { chave: 'destino', titulo: 'Destino', flex: 1.5, principal: true, render: (i) => <Texto variante="bloco">{rotuloDoDestino(i.destino)}</Texto> },
            { chave: 'quando', titulo: 'Quando', flex: 1.2, render: (i) => <Texto numerico>{dataHoraParaTela(i.criadoEm)}</Texto> },
            { chave: 'arquivo', titulo: 'Arquivo', flex: 0.8, render: (i) => <Texto variante="suave">{i.nomeArquivo}</Texto> },
            { chave: 'situacao', titulo: 'Situação', flex: 1.3, render: (i) => <Selo texto={SITUACAO[i.situacao]?.texto ?? i.situacao} tipo={SITUACAO[i.situacao]?.tipo ?? 'neutro'} /> },
          ]} />
          {lista.dados.total > 30 ? (
            <View style={estilos.linha}>
              <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
              <Texto>Página {pagina + 1} de {Math.ceil(lista.dados.total / 30)}</Texto>
              <Botao rotulo="Próxima" tipo="secundario" desabilitado={(pagina + 1) * 30 >= lista.dados.total} aoTocar={() => setPagina(pagina + 1)} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      {modelos ? <FolhaModelos destinos={permitidos} aoFechar={() => setModelos(false)} /> : null}
      {detalheId ? <FolhaDetalhe id={detalheId} aoFechar={() => setDetalheId(null)} /> : null}
    </>
  );
}

function FolhaModelos({ destinos, aoFechar }: { destinos: Destino[]; aoFechar: () => void }) {
  return (
    <Folha visivel titulo="Modelos de planilha" aoFechar={aoFechar}>
      <Texto variante="suave">Três linhas fictícias em cada arquivo. CPF, telefone e CEP vão como texto. Baixe, troque pelos seus dados e envie em Nova importação.</Texto>
      {destinos.map((d) => (
        <View key={d.id} style={estilos.linha}>
          <Texto variante="bloco">{d.rotulo}</Texto>
          <Botao rotulo={`CSV de ${d.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${d.id}.csv`)} />
          <Botao rotulo={`Excel de ${d.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${d.id}.xlsx`)} />
        </View>
      ))}
    </Folha>
  );
}

/**
 * Novos, atualizados, ignorados e com erro, cada um no seu número, e o CSV dos erros. Os erros vêm agrupados por campo e
 * motivo ("E-mail inválido · 62 linhas: …"), em vez de uma linha por erro (reunião de 30/10).
 */
function ResultadoDaImportacao({ dados }: { dados: DetalheDeImportacao }) {
  const [baixando, setBaixando] = useState(false);
  const baixar = () => {
    setBaixando(true);
    csvDeErrosDaImportacao(dados.id).then((texto) => baixarCsv('erros.csv', texto)).finally(() => setBaixando(false));
  };
  return (
    <>
      <Texto variante="suave">{`${rotuloDoDestino(dados.destino)} · ${dataHoraParaTela(dados.criadoEm)} · arquivo ${dados.nomeArquivo}`}</Texto>
      <Numeros itens={[
        { rotulo: 'Novos', valor: dados.novos },
        { rotulo: 'Atualizados', valor: dados.atualizados },
        { rotulo: 'Já existiam (ficaram como estavam)', valor: dados.ignorados },
        { rotulo: 'Com erro (ficaram de fora)', valor: dados.comErro, tipo: dados.comErro > 0 ? 'perigo' : undefined },
      ]} />
      {dados.erros.length > 0 ? (
        <Cartao titulo="Linhas que ficaram de fora" descricao="Corrija na planilha e importe só essas linhas de novo. O CSV traz linha, campo e motivo de cada uma."
          acoes={<Botao rotulo="Baixar CSV de erros" tipo="secundario" Icone={Download} carregando={baixando} aoTocar={baixar} />}>
          <ListaDeErros erros={dados.erros} onde={(campo) => DESTINOS.find((d) => d.id === dados.destino)?.campos.find((c) => c.id === campo)?.rotulo ?? campo} />
        </Cartao>
      ) : null}
    </>
  );
}

/** Os erros agrupados, um item por campo e motivo; até `ERROS_NA_TELA` grupos (o resto está no CSV). */
function ListaDeErros({ erros, onde }: { erros: readonly { linha: number; campo: string; motivo: string }[]; onde: (campo: string) => string }) {
  const { cores } = useTema();
  const grupos = agruparErros(erros);
  return (
    <View style={estilos.erros}>
      {grupos.slice(0, ERROS_NA_TELA).map((g) => (
        <View key={`${g.campo}-${g.motivo}`} style={[estilos.grupoDeErro, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <Texto>{textoDoGrupoDeErros(g, onde(g.campo))}</Texto>
        </View>
      ))}
      {grupos.length > ERROS_NA_TELA ? <Texto variante="suave">{`E mais ${grupos.length - ERROS_NA_TELA} tipos de erro no CSV.`}</Texto> : null}
    </View>
  );
}

function FolhaDetalhe({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(`importacao:${id}`, () => detalheDaImportacao(id));
  const selo = dados ? SITUACAO[dados.situacao] : undefined;
  return (
    <Folha visivel titulo={dados ? `Importação de ${rotuloDoDestino(dados.destino)}` : 'Importação'} aoFechar={aoFechar}
      acaoNoTopo={selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : undefined}>
      {erro ? <MensagemErro texto={textoDoErroDaApi(erro)} tentarDeNovo={recarregar} /> : null}
      {carregando && !dados ? <Esqueleto cartoes={1} /> : null}
      {dados ? <ResultadoDaImportacao dados={dados} /> : null}
    </Folha>
  );
}

/** Números lado a lado (quebram linha no celular), como o resumo da validação. */
function Numeros({ itens }: { itens: { rotulo: string; valor: number; tipo?: 'perigo' | 'sucesso' }[] }) {
  const { cores } = useTema();
  return (
    <View style={estilos.numeros}>
      {itens.map((i) => (
        <View key={i.rotulo} style={[estilos.numero, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}
          accessible accessibilityLabel={`${i.rotulo}: ${i.valor}`}>
          <Texto variante="destaque" cor={i.tipo === 'perigo' ? cores.perigo : i.tipo === 'sucesso' ? cores.sucesso : undefined}>{i.valor}</Texto>
          <Texto variante="suave">{i.rotulo}</Texto>
        </View>
      ))}
    </View>
  );
}

/** Indicador das etapas: número e nome; estreito, só "Etapa N de 5 · Nome". */
function Etapas({ etapa, estreita }: { etapa: EtapaDaImportacao; estreita: boolean }) {
  const { cores } = useTema();
  const nome = ETAPAS_DA_IMPORTACAO[etapa - 1];
  if (estreita) {
    return <Texto variante="secao" accessibilityLabel={`Etapa ${etapa} de 5: ${nome}`}>{`Etapa ${etapa} de 5 · ${nome}`}</Texto>;
  }
  return (
    <View style={estilos.etapas} accessible accessibilityLabel={`Etapa ${etapa} de 5: ${nome}`}>
      {ETAPAS_DA_IMPORTACAO.map((rotulo, i) => {
        const n = i + 1;
        const atual = n === etapa;
        const feita = n < etapa;
        return (
          <View key={rotulo} style={[estilos.etapa, { borderBottomColor: atual ? cores.texto : cores.borda }]}>
            <View style={[estilos.bolinha, { borderColor: atual || feita ? cores.texto : cores.bordaCampo, backgroundColor: atual ? cores.texto : 'transparent' }]}>
              {feita ? <Check size={14} color={cores.texto} /> : <Texto variante="pequeno" cor={atual ? cores.fundo : cores.textoSuave}>{n}</Texto>}
            </View>
            <Texto variante={atual ? 'rotulo' : 'pequeno'} cor={atual ? cores.texto : cores.textoSuave} numberOfLines={2} style={estilos.nomeDaEtapa}>{rotulo}</Texto>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Nova importação em tela inteira (reunião de 30/10: na Folha cabiam quatro colunas da planilha e o treinador rolava
 * para os lados sem ver o todo). As etapas ficam presas no topo e Voltar/Validar na base. O arquivo, o mapeamento e as
 * correções da tabela ficam só na memória desta tela: sair no meio (menu, seta, voltar do navegador, Cancelar) pergunta
 * antes, pela guarda de saída dos editores.
 */
export function AssistenteDaImportacao() {
  const { pode } = useSessao();
  const { cores } = useTema();
  const router = useRouter();
  const { avisar } = useAviso();
  const { confirmar: confirmarSaida } = useSaidaGuardada();
  const destinos = destinosPermitidos(pode);
  const podeSensivel = pode('ALUNO_SENSIVEL_ALTERAR');
  const [etapa, setEtapa] = useState<EtapaDaImportacao>(1);
  const [largura, setLargura] = useState<number>(LARGURA_MAXIMA);
  const [destino, setDestino] = useState<Destino | null>(destinos.length === 1 ? destinos[0] : null);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [colunas, setColunas] = useState<ColunasDaImportacao | null>(null);
  const [aba, setAba] = useState(0);
  const [linhaDoCabecalho, setLinhaDoCabecalho] = useState(LINHA_DO_CABECALHO_PADRAO);
  const [chave, setChave] = useState(destinos.length === 1 ? destinos[0].chaves[0].valor : 'email');
  const [existentes, setExistentes] = useState(destinos.length === 1 ? destinos[0].existentes[0].valor : 'IGNORAR');
  const [mapa, setMapa] = useState<MapaDaImportacao>({});
  const [previa, setPrevia] = useState<PreviaDeImportacao | null>(null);
  const [resultado, setResultado] = useState<DetalheDeImportacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  /** Correções feitas na tabela, só em memória: fechar o assistente as descarta. */
  const [ajustes, setAjustes] = useState<AjustesDaTabela>(SEM_AJUSTES);
  /** Erros da última validação, com o mapeamento de então, para marcar as células na tabela. */
  const [ultimaValidacao, setUltimaValidacao] = useState<{ erros: PreviaDeImportacao['erros']; mapa: MapaDaImportacao } | null>(null);
  const [soComErro, setSoComErro] = useState(false);
  /** Só a resposta do último pedido vale: trocar a aba duas vezes depressa não deixa a primeira resposta vencer. */
  const pedido = useRef(0);
  const estreita = largura < LARGURA_ESTREITA;

  const descartarAjustes = () => {
    setAjustes(SEM_AJUSTES);
    setUltimaValidacao(null);
    setSoComErro(false);
  };

  /** Corrigir ou tirar linha descarta a prévia, como mudar o mapeamento: precisa validar de novo. */
  const mudarAjustes = (novos: AjustesDaTabela) => {
    setAjustes(novos);
    setPrevia(null);
  };

  const escolherDestino = (id: string | null) => {
    const d = destinos.find((x) => x.id === id) ?? null;
    setDestino(d);
    if (d) {
      setChave(d.chaves[0].valor);
      setExistentes(d.existentes[0].valor);
    }
    setColunas(null);
    setMapa({});
    setPrevia(null);
    descartarAjustes();
  };

  const escolherArquivo = (a: ArquivoEscolhido) => {
    setArquivo(a);
    setAba(0);
    setColunas(null);
    setMapa({});
    setPrevia(null);
    setErro(null);
    descartarAjustes();
  };

  const lerColunas = (proxAba: number, proximaLinhaDoCabecalho: number) => {
    if (!destino || !arquivo) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    setPrevia(null);
    formulario(arquivo).then((dados) => colunasDaImportacao(destino.id, dados, proxAba, proximaLinhaDoCabecalho)).then((c) => {
      if (meu !== pedido.current) return;
      setColunas(c);
      setAba(c.aba);
      // Outra aba ou outro cabeçalho: as linhas mudam, e os ajustes e erros antigos não valem mais.
      descartarAjustes();
      const sugerido = sugerirMapeamento(c.colunas, destino.campos);
      if (!podeSensivel) {
        for (const campo of destino.campos) if (campo.sensivel) sugerido[campo.id] = null;
      }
      setMapa(sugerido);
      setOcupado(false);
    }, (e: unknown) => {
      if (meu !== pedido.current) return;
      setColunas(null);
      setOcupado(false);
      setErro(e);
    });
  };

  const configuracao = () => {
    const { celulas, removidas } = ajustesParaApi(ajustes);
    return {
      aba, linhaDoCabecalho, chave, existentes,
      mapeamento: Object.fromEntries(Object.entries(mapa).filter(([, v]) => v !== null && v >= 0)),
      ...(celulas.length > 0 || removidas.length > 0 ? { ajustes: { celulas, removidas } } : {}),
    };
  };

  const validar = () => {
    if (!destino || !arquivo) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    formulario(arquivo, configuracao()).then((dados) => previaDaImportacao(destino.id, dados)).then((p) => {
      if (meu !== pedido.current) return;
      setPrevia(p);
      setUltimaValidacao({ erros: p.erros, mapa });
      setSoComErro(false);
      setOcupado(false);
    }, (e: unknown) => {
      if (meu !== pedido.current) return;
      setOcupado(false);
      setErro(e);
    });
  };

  const confirmar = () => {
    if (!destino || !arquivo || !previa) return;
    setOcupado(true);
    setErro(null);
    formulario(arquivo, configuracao()).then((dados) => confirmarImportacao(destino.id, dados, previa.hash)).then((r) => {
      setResultado(r);
      setOcupado(false);
      setEtapa(5);
    }, (e: unknown) => {
      setOcupado(false);
      setErro(e);
    });
  };

  const avancar = () => {
    setErro(null);
    if (etapa === 1) {
      setEtapa(2);
      if (!colunas) lerColunas(aba, linhaDoCabecalho);
    } else if (etapa === 2) {
      setEtapa(3);
    } else if (etapa === 3) {
      setEtapa(4);
      if (!previa) validar();
    }
  };

  const voltar = () => {
    setErro(null);
    if (etapa > 1 && etapa < 5) setEtapa((etapa - 1) as EtapaDaImportacao);
  };

  // Há o que perder a partir do destino ou do arquivo escolhido, até a importação ser confirmada.
  useGuardaDeSaida(etapa < 5 && (!!arquivo || (destino !== null && destinos.length > 1)));
  const aoFechar = () => confirmarSaida(() => router.replace('/treinador/importacao'));
  const aoConcluir = () => {
    avisar('Importação registrada.');
    router.replace('/treinador/importacao');
  };

  const motivo = motivoParaNaoContinuar(etapa, { destino, arquivo, lendo: ocupado, temColunas: !!colunas, chave, mapa });
  const resumo = previa ? resumoDaValidacao(previa) : null;
  const titulo = destino ? `Nova importação · ${destino.rotulo}` : 'Nova importação';
  const tituloDeDado = colunas ? avisoDeTituloDeDado(colunasComTituloDeDado(colunas.colunas)) : null;

  const rodape = etapa === 5 ? (
    <Botao rotulo="Concluir" aoTocar={aoConcluir} />
  ) : (
    <>
      <Botao rotulo={etapa === 1 ? 'Cancelar' : 'Voltar'} tipo="secundario" aoTocar={etapa === 1 ? aoFechar : voltar} desabilitado={ocupado && etapa === 4} />
      {etapa < 4 ? (
        <Botao rotulo={etapa === 3 ? 'Validar' : 'Continuar'} carregando={ocupado && etapa === 2} desabilitado={motivo !== null} motivo={motivo ?? undefined} aoTocar={avancar} />
      ) : (
        <Botao rotulo="Confirmar importação" carregando={ocupado} desabilitado={!previa || !resumo || resumo.corretas === 0}
          motivo={!previa ? 'Aguarde a validação.' : 'Nenhuma linha correta para importar.'} aoTocar={confirmar} />
      )}
    </>
  );

  return (
    <TelaDoEditor largura={LARGURA_MAXIMA} rodape={rodape}
      cabecalho={<Cabecalho titulo={titulo} subtitulo="Nada é gravado antes de Confirmar importação. O arquivo não fica guardado."
        trilha={[{ rotulo: 'Importação', href: '/treinador/importacao' }]} />}
      barra={<Etapas etapa={etapa} estreita={estreita} />}>
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={estilos.coluna}>
        {erro ? <MensagemErro texto={textoDoErroDaApi(erro)} /> : null}

        {etapa === 1 ? (
          <>
            <CartoesDeDestino destinos={destinos} valor={destino?.id ?? null} aoMudar={escolherDestino} />
            <Cartao titulo="Carregue seu arquivo de dados (.xlsx, .csv)" descricao="Nada é gravado antes de você confirmar no fim.">
              <ZonaDeArquivo arquivo={arquivo} aoEscolher={escolherArquivo} />
            </Cartao>
            {destino ? (
              <View style={estilos.linha}>
                <Texto variante="suave">Ainda não tem a planilha?</Texto>
                <Botao rotulo="Baixar modelo Excel" tipo="fantasma" Icone={Download} aoTocar={() => abrirModelo(`${destino.id}.xlsx`)} />
                <Botao rotulo="Baixar modelo CSV" tipo="fantasma" Icone={Download} aoTocar={() => abrirModelo(`${destino.id}.csv`)} />
              </View>
            ) : null}
          </>
        ) : null}

        {etapa === 2 && destino ? (
          <>
            <Texto variante="suave">
              {arquivo?.nome}{colunas ? ` · ${colunas.linhas} ${colunas.linhas === 1 ? 'linha' : 'linhas'} de dados${colunas.abas.length > 1 ? ` na aba “${colunas.abas[colunas.aba]}”` : ''}` : ''}
            </Texto>
            {ocupado && !colunas ? <Esqueleto cartoes={1} /> : null}
            <Cartao titulo="Leitura da planilha">
              {colunas && colunas.abas.length > 1 ? (
                <View style={estilos.campo}>
                  <EscolhaEmFolha rotulo="Aba" valor={String(aba)} aoMudar={(v) => lerColunas(Number(v), linhaDoCabecalho)}
                    opcoes={colunas.abas.map((nome, i) => ({ valor: String(i), rotulo: nome }))} />
                  <Texto variante="pequeno">{`A planilha tem ${colunas.abas.length} abas; escolha a que tem os dados.`}</Texto>
                </View>
              ) : null}
              {tituloDeDado ? <Alerta tom="atencao" texto={tituloDeDado} /> : null}
              <View style={estilos.campo}>
                <EscolhaEmFolha rotulo="Linha do cabeçalho" valor={linhaDoCabecalho} opcoes={opcoesDaLinhaDoCabecalho()}
                  aoMudar={(v) => { setLinhaDoCabecalho(v); lerColunas(aba, v); }} />
                <Texto variante="pequeno">Número da linha no arquivo com o nome das colunas. As linhas acima dela não entram nos dados. Escolha Nenhuma se a planilha começa direto nos dados; as colunas viram A, B, C…</Texto>
              </View>
            </Cartao>
            <Cartao titulo="Quem já está cadastrado">
              <View style={estilos.campo}>
                <EscolhaEmFolha rotulo="Reconhecer pelo" valor={chave} aoMudar={(v) => { setChave(v); setPrevia(null); }} opcoes={destino.chaves} />
                <Texto variante="pequeno">É o campo usado para achar o registro que já existe. Mesmo valor = mesmo cadastro.</Texto>
              </View>
              <View style={estilos.campo}>
                <EscolhaEmFolha rotulo="Se já existir" valor={existentes} aoMudar={(v) => { setExistentes(v); setPrevia(null); }}
                  opcoes={destino.existentes.map((o) => ({ ...o, detalhe: explicacaoDosExistentes(o.valor) }))} />
                <Texto variante="pequeno">{explicacaoDosExistentes(existentes)}</Texto>
              </View>
            </Cartao>
          </>
        ) : null}

        {etapa === 3 && destino && colunas ? (
          <Mapeamento destino={destino} colunas={colunas} linhaDoCabecalho={linhaDoCabecalho} chave={chave} mapa={mapa} estreita={estreita} podeSensivel={podeSensivel}
            larguraDisponivel={largura} tituloDeDado={tituloDeDado}
            aoMudar={(m) => { setMapa(m); setPrevia(null); }} ajustes={ajustes} aoAjustar={mudarAjustes}
            ultimaValidacao={ultimaValidacao} soComErro={soComErro} aoMudarSoComErro={setSoComErro} />
        ) : null}

        {etapa === 4 && destino && colunas ? (
          <>
            {ocupado && !previa ? <><Texto variante="suave">Validando a planilha…</Texto><Esqueleto cartoes={1} /></> : null}
            {previa && resumo ? (
              <>
                <Numeros itens={[
                  { rotulo: 'Total', valor: resumo.total },
                  { rotulo: 'Com erro', valor: resumo.comErro, tipo: resumo.comErro > 0 ? 'perigo' : undefined },
                  { rotulo: 'Corretas', valor: resumo.corretas, tipo: resumo.corretas > 0 ? 'sucesso' : undefined },
                ]} />
                <Texto>{textoDoQueVaiAcontecer(previa)}</Texto>
                {previa.comErro > 0 ? (
                  <Cartao titulo="Linhas com erro" descricao="Ficam de fora se você confirmar agora. Ajuste os valores diretamente na tabela e valide de novo."
                    acoes={<Botao rotulo="Corrigir na tabela" tipo="secundario" aoTocar={() => { setSoComErro(true); setEtapa(3); }} />}>
                    <ListaDeErros erros={previa.erros} onde={(campo) => ondeDoErro(campo, destino, colunas.colunas, mapa)} />
                    {previa.errosAlem > 0
                      ? <Texto variante="suave">{`E mais ${previa.errosAlem} ${previa.errosAlem === 1 ? 'erro' : 'erros'} além dos listados.`}</Texto>
                      : null}
                  </Cartao>
                ) : null}
                <Texto variante="pequeno" cor={cores.textoSuave}>Nada foi gravado ainda. “Confirmar importação” lê o arquivo de novo e grava as linhas corretas.</Texto>
              </>
            ) : null}
          </>
        ) : null}

        {etapa === 5 && resultado ? <ResultadoDaImportacao dados={resultado} /> : null}
      </View>
    </TelaDoEditor>
  );
}

const ICONES_DO_DESTINO: Record<DestinoDaImportacao, LucideIcon> = {
  alunos: Users, pesos: Scale, exercicios: Dumbbell, alimentos: Apple, suplementos: Pill, outros: FlaskConical,
};

/** Um cartão grande com ícone por destino (como a referência de 30/10); o escolhido fica com a seleção invertida. */
function CartoesDeDestino({ destinos, valor, aoMudar }: { destinos: Destino[]; valor: string | null; aoMudar: (id: string) => void }) {
  const { cores } = useTema();
  return (
    <View style={estilos.campo}>
      <Texto variante="rotulo">Escolha um destino para a importação</Texto>
      <View accessibilityRole="radiogroup" accessibilityLabel="O que vai importar" style={estilos.destinos}>
        {destinos.map((d) => {
          const ativo = d.id === valor;
          const Icone = ICONES_DO_DESTINO[d.id];
          return (
            <Pressable key={d.id} accessibilityRole="radio" accessibilityLabel={d.rotulo} accessibilityState={{ checked: ativo }} aria-checked={ativo}
              onPress={() => aoMudar(d.id)}
              style={(e) => [estilos.destino, {
                borderColor: ativo ? cores.texto : cores.borda,
                backgroundColor: ativo ? cores.texto : sobre(e) ? cores.superficie3 : cores.superficie2,
              }]}>
              <Icone size={26} color={ativo ? cores.fundo : cores.texto} strokeWidth={1.75} />
              <Texto style={[estilos.rotuloDoDestino, { color: ativo ? cores.fundo : cores.texto }]} numberOfLines={2}>{d.rotulo}</Texto>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A planilha como está no arquivo (até o teto da API), com a escolha do campo no cabeçalho de cada coluna, busca,
 * páginas de 50 linhas, células editáveis e a lixeira por linha (referência de 30/10). O que se corrige ou tira fica só
 * na memória da tela e vai junto na validação; a célula que veio cortada não se edita.
 */
function Mapeamento({ destino, colunas, linhaDoCabecalho, chave, mapa, estreita, podeSensivel, larguraDisponivel, tituloDeDado, aoMudar, ajustes, aoAjustar, ultimaValidacao, soComErro, aoMudarSoComErro }: {
  destino: Destino; colunas: ColunasDaImportacao; linhaDoCabecalho: number; chave: string; mapa: MapaDaImportacao;
  estreita: boolean; podeSensivel: boolean; larguraDisponivel: number; tituloDeDado: string | null; aoMudar: (mapa: MapaDaImportacao) => void;
  ajustes: AjustesDaTabela; aoAjustar: (ajustes: AjustesDaTabela) => void;
  ultimaValidacao: { erros: PreviaDeImportacao['erros']; mapa: MapaDaImportacao } | null;
  soComErro: boolean; aoMudarSoComErro: (v: boolean) => void;
}) {
  const { cores } = useTema();
  const { height: alturaDaJanela } = useWindowDimensions();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const campos = camposPermitidos(destino, podeSensivel);
  const faltando = faltandoColuna(destino, chave, mapa);
  const nomeDaColuna = (i: number) => colunas.colunas[i] || `Coluna ${i + 1}`;
  const erros = errosNaTabela(ultimaValidacao?.erros ?? [], ultimaValidacao?.mapa ?? {});
  const linhasComErro = erros.linhas.size;
  const todas = linhasDaPlanilha(colunas.amostra, colunas.numerosDasLinhas, linhaDoCabecalho, busca, ajustes, soComErro && linhasComErro > 0 ? erros.linhas : undefined);
  const pag = paginaDaPlanilha(todas, pagina);
  const numeros = colunas.numerosDasLinhas;
  const cortadas = new Set((colunas.celulasCortadas ?? []).map(([posicao, coluna]) => `${numeros?.[posicao] ?? posicao}:${coluna}`));
  const aviso = avisoDoCorte(colunas);
  const total = totalDeAjustes(ajustes);
  const original = (linha: number, coluna: number) => {
    const posicao = numeros ? numeros.indexOf(linha) : linha - primeiraLinhaDeDados(linhaDoCabecalho);
    return colunas.amostra[posicao]?.[coluna] ?? '';
  };
  // Na tela inteira as colunas dividem a largura (entre 200 e 320 px); com muitas colunas, a tabela rola para o lado.
  const livre = larguraDisponivel - LARGURA_DO_NUMERO - LARGURA_DA_ACAO - 4;
  const largura = estreita ? 200 : Math.max(200, Math.min(320, Math.floor(livre / Math.max(1, colunas.colunas.length))));
  // O cabeçalho (o campo de cada coluna) fica parado e as linhas rolam embaixo dele, numa altura que cabe na janela.
  const alturaDasLinhas = Math.max(280, alturaDaJanela - 360);

  return (
    <>
      {faltando.length > 0 ? (
        <Alerta tom="atencao" texto={`Falta escolher a coluna de: ${faltando.join(', ')}.`} />
      ) : null}
      {tituloDeDado ? <Alerta tom="atencao" texto={tituloDeDado} /> : null}
      <Texto variante="suave">
        {colunas.amostra.length > 0
          ? 'Em cada coluna, escolha o campo do sistema; o que ficar em “Não importar” não entra. Dá para corrigir um valor direto na tabela ou tirar uma linha: o arquivo não muda e a correção vai junto na validação.'
          : 'A aba não tem linhas de dados. Volte e confira a aba ou o cabeçalho.'}
      </Texto>
      {!podeSensivel && destino.campos.some((c) => c.sensivel) ? (
        <Texto variante="pequeno">CPF, endereço, objetivo e observações precisam da permissão de dados sensíveis e não aparecem na lista.</Texto>
      ) : null}
      <View style={estilos.linha}>
        <View style={estilos.busca}>
          <Campo rotulo="Pesquisar na planilha" valor={busca} aoMudar={(v) => { setBusca(v); setPagina(0); }} autoCorrect={false} placeholder="Texto ou número da linha" />
        </View>
        {linhasComErro > 0 ? (
          <Botao rotulo={soComErro ? 'Mostrar todas as linhas' : `Só as linhas com erro (${linhasComErro})`} tipo="secundario"
            aoTocar={() => { aoMudarSoComErro(!soComErro); setPagina(0); }} />
        ) : null}
      </View>
      {aviso ? <Texto variante="pequeno">{aviso}</Texto> : null}
      {total.celulas > 0 || total.removidas > 0 ? (
        <View style={[estilos.linha, estilos.resumoDosAjustes, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <Texto>{[
            total.celulas > 0 ? `${total.celulas} ${total.celulas === 1 ? 'célula corrigida' : 'células corrigidas'}` : null,
            total.removidas > 0 ? `${total.removidas} ${total.removidas === 1 ? 'linha tirada' : 'linhas tiradas'} (${[...ajustes.removidas].sort((a, b) => a - b).join(', ')})` : null,
          ].filter(Boolean).join(' · ')}</Texto>
          {total.removidas > 0 ? (
            <Botao rotulo="Desfazer a última" tipo="fantasma" Icone={Undo2}
              aoTocar={() => aoAjustar(alternarRemovida(ajustes, ajustes.removidas[ajustes.removidas.length - 1]))} />
          ) : null}
          {total.removidas > 1 ? <Botao rotulo="Devolver todas" tipo="fantasma" aoTocar={() => aoAjustar({ ...ajustes, removidas: [] })} /> : null}
        </View>
      ) : null}
      <ScrollView horizontal style={[estilos.tabela, { borderColor: cores.borda }]}>
        <View>
          <View style={[estilos.linhaDaTabela, { backgroundColor: cores.superficie3, borderBottomColor: cores.borda }]}>
            <View style={estilos.celulaLinha}><Texto variante="rotulo">ID</Texto></View>
            {colunas.colunas.map((_, i) => (
              <View key={i} style={[estilos.celulaCabecalho, { width: largura }]}>
                <Texto variante="pequeno" numberOfLines={1}>{`Coluna “${nomeDaColuna(i)}”`}</Texto>
                <EscolhaSuspensa rotulo="Campo" titulo={`Campo da coluna “${nomeDaColuna(i)}”`} valor={campoDaColuna(mapa, i)}
                  opcoes={opcoesDoCampoDaColuna(campos, mapa, i, nomeDaColuna)} aoMudar={(campo) => aoMudar(escolherCampoDaColuna(mapa, i, campo))} />
              </View>
            ))}
            <View style={estilos.celulaAcao} />
          </View>
          <ScrollView style={{ maxHeight: alturaDasLinhas }} nestedScrollEnabled>
          {pag.linhas.length === 0 && colunas.amostra.length > 0 ? (
            <Texto variante="suave" style={estilos.semLinhas}>Nenhuma linha com essa busca.</Texto>
          ) : null}
          {pag.linhas.map((linha) => {
            const motivosDaLinha = erros.motivosDaLinha(linha.numero);
            const temErro = erros.linhas.has(linha.numero);
            return (
              <View key={linha.numero} style={[estilos.linhaDaTabela, { borderBottomColor: cores.divisor }]}>
                <View style={estilos.celulaLinha}>
                  <Texto numerico variante={temErro ? 'rotulo' : 'suave'} cor={temErro ? cores.perigo : undefined}>{linha.numero}</Texto>
                  {motivosDaLinha.length > 0 ? <Texto variante="pequeno" cor={cores.perigo} numberOfLines={3}>{motivosDaLinha.join(' ')}</Texto> : null}
                </View>
                {colunas.colunas.map((_, c) => (
                  <CelulaDaPlanilha key={c} largura={largura} linha={linha.numero} coluna={nomeDaColuna(c)}
                    valor={linha.valores[c] ?? ''} ajustada={celulaAjustada(ajustes, linha.numero, c)} cortada={cortadas.has(`${linha.numero}:${c}`)}
                    erro={erros.motivoDaCelula(linha.numero, c)}
                    aoMudar={(v) => aoAjustar(ajustarCelula(ajustes, linha.numero, c, v, original(linha.numero, c)))}
                    aoVoltar={() => aoAjustar(ajustarCelula(ajustes, linha.numero, c, original(linha.numero, c), original(linha.numero, c)))} />
                ))}
                <View style={estilos.celulaAcao}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Tirar a linha ${linha.numero}`} onPress={() => aoAjustar(alternarRemovida(ajustes, linha.numero))}
                    style={(e) => [estilos.lixeira, { backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
                    <Trash2 size={18} color={cores.perigo} />
                  </Pressable>
                </View>
              </View>
            );
          })}
          </ScrollView>
        </View>
      </ScrollView>
      {pag.total > 1 ? (
        <View style={estilos.linha}>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={pag.pagina === 0} motivo="Esta é a primeira página." aoTocar={() => setPagina(pag.pagina - 1)} />
          <Texto numerico>{`Página ${pag.pagina + 1} de ${pag.total} · ${todas.length} ${todas.length === 1 ? 'linha' : 'linhas'}`}</Texto>
          <Botao rotulo="Próxima" tipo="secundario" desabilitado={pag.pagina + 1 >= pag.total} motivo="Esta é a última página." aoTocar={() => setPagina(pag.pagina + 1)} />
        </View>
      ) : null}
    </>
  );
}

/**
 * Uma célula da tabela: campo que grava ao sair dele (ou com Enter), sem refazer a tabela a cada tecla. Corrigida,
 * mostra "Corrigida · Voltar ao original"; com erro da última validação, a borda e o motivo em vermelho.
 */
function CelulaDaPlanilha({ largura, linha, coluna, valor, ajustada, cortada, erro, aoMudar, aoVoltar }: {
  largura: number; linha: number; coluna: string; valor: string; ajustada: boolean; cortada: boolean; erro: string | null;
  aoMudar: (valor: string) => void; aoVoltar: () => void;
}) {
  const { cores } = useTema();
  const rotulo = `Linha ${linha}, coluna “${coluna}”`;
  /** O que a pessoa digitou desde a última gravação (nulo = nada). */
  const digitado = useRef<string | null>(null);
  const gravar = () => {
    const t = digitado.current;
    digitado.current = null;
    if (t !== null && t !== valor) aoMudar(t);
  };
  return (
    <View style={[estilos.celula, { width: largura }]}>
      {cortada ? (
        <Texto numberOfLines={2} accessibilityLabel={`${rotulo}: ${valor}. Texto longo: corrija na planilha.`}>{valor}</Texto>
      ) : (
        <TextInput key={valor} defaultValue={valor} accessibilityLabel={rotulo} aria-invalid={!!erro}
          onChangeText={(t) => { digitado.current = t; }} onBlur={gravar} onSubmitEditing={gravar}
          style={[estilos.entrada, {
            color: cores.texto, backgroundColor: cores.campo,
            borderColor: erro ? cores.perigo : ajustada ? cores.texto : cores.bordaCampo, borderWidth: erro || ajustada ? 2 : 1,
          }]} />
      )}
      {erro ? <Texto variante="pequeno" cor={cores.perigo} numberOfLines={3}>{erro}</Texto> : null}
      {ajustada ? (
        <View style={estilos.linhaPequena}>
          <Texto variante="pequeno">Corrigida ·</Texto>
          <Pressable accessibilityRole="button" accessibilityLabel={`Voltar ao original: ${rotulo}`} onPress={aoVoltar} hitSlop={8}>
            <Texto variante="pequeno" style={estilos.link}>Voltar ao original</Texto>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ZonaDeArquivo({ arquivo, aoEscolher }: { arquivo: ArquivoEscolhido | null; aoEscolher: (arquivo: ArquivoEscolhido) => void }) {
  const { cores } = useTema();
  const idDaEntrada = `arquivo-da-planilha-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [arrastando, setArrastando] = useState(false);
  const escolherNativo = () => {
    DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true }).then((r) => {
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (Platform.OS === 'web' && a.file) aoEscolher({ nome: a.name, tamanho: a.file.size, parte: a.file });
      else aoEscolher({ nome: a.name, tamanho: a.size ?? undefined, parte: { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } });
    });
  };
  const receber = (f: File | undefined) => { if (f) aoEscolher({ nome: f.name, tamanho: f.size, parte: f }); };
  const escolher = () => {
    if (Platform.OS !== 'web') { escolherNativo(); return; }
    (globalThis as { document?: { getElementById: (id: string) => { click: () => void } | null } }).document?.getElementById(idDaEntrada)?.click();
  };
  const tipo = arquivo ? tipoDoArquivo(arquivo.nome) : null;
  const tamanho = arquivo ? tamanhoParaTela(arquivo.tamanho) : null;

  const conteudo = arquivo ? (
    <View style={estilos.arquivo}>
      <FileSpreadsheet size={28} color={cores.texto} />
      <View style={estilos.textosDoArquivo}>
        <Texto variante="bloco" numberOfLines={1}>{arquivo.nome}</Texto>
        <Texto variante="suave">{[tipo ?? 'Formato não aceito', tamanho].filter(Boolean).join(' · ')}{' · selecionado, ainda não enviado'}</Texto>
        {!tipo ? <Texto cor={cores.perigo}>Envie um arquivo .xlsx ou .csv.</Texto> : null}
      </View>
      <Botao rotulo="Trocar arquivo" tipo="secundario" aoTocar={escolher} />
    </View>
  ) : (
    <Pressable accessibilityRole="button" accessibilityLabel="Escolher arquivo" onPress={escolher}
      style={(e) => [estilos.vazioDoArquivo, { backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
      <FileUp size={28} color={cores.textoSuave} />
      <Texto variante="suave">{Platform.OS === 'web' ? 'Clique ou arraste o arquivo até aqui.' : 'Toque para escolher o arquivo no aparelho.'}</Texto>
    </Pressable>
  );

  if (Platform.OS !== 'web') return <View style={[estilos.zona, { borderColor: cores.bordaCampo, backgroundColor: cores.campo }]}>{conteudo}</View>;
  return createElement('div', {
    onDragOver: (e: DragEvent) => { e.preventDefault(); if (!arrastando) setArrastando(true); },
    onDragLeave: () => setArrastando(false),
    onDrop: (e: DragEvent) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer?.files?.[0]); },
    style: {
      display: 'flex', flexDirection: 'column', border: `${arrastando ? 2 : 1}px dashed ${arrastando ? cores.texto : cores.bordaCampo}`,
      borderRadius: RAIO, background: arrastando ? cores.superficie3 : cores.campo, padding: 16, minHeight: 120, justifyContent: 'center',
    },
  }, conteudo, createElement('input', {
    id: idDaEntrada,
    type: 'file',
    accept: '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'aria-label': 'Arquivo da planilha',
    style: { display: 'none' },
    onChange: (e: Event) => { const alvo = e.target as HTMLInputElement; receber(alvo.files?.[0]); alvo.value = ''; },
  }));
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', alignItems: 'center' },
  campo: { gap: espaco(0.5) },
  etapas: { flexDirection: 'row' },
  etapa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingBottom: espaco(1), paddingRight: espaco(0.5), borderBottomWidth: 2 },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nomeDaEtapa: { flexShrink: 1 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  numero: { flexGrow: 1, flexBasis: 140, borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2 },
  zona: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, padding: espaco(2) },
  vazioDoArquivo: { alignItems: 'center', gap: espaco(1), paddingVertical: espaco(1.5) },
  arquivo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  textosDoArquivo: { flex: 1, minWidth: 180, gap: 2 },
  tabela: { borderWidth: 1, borderRadius: RAIO },
  destinos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  destino: { flexGrow: 1, flexBasis: 150, minHeight: 96, borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center', gap: espaco(1), padding: espaco(1.5) },
  rotuloDoDestino: { fontFamily: fontes.semi, textAlign: 'center' },
  busca: { flexGrow: 1, flexBasis: 260 },
  resumoDosAjustes: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  celulaAcao: { width: LARGURA_DA_ACAO, alignItems: 'center', justifyContent: 'center' },
  lixeira: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  entrada: { minHeight: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), fontFamily: fontes.normal, fontSize: 15 },
  linhaPequena: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexWrap: 'wrap' },
  link: { textDecorationLine: 'underline', fontFamily: fontes.semi },
  semLinhas: { padding: espaco(2) },
  linhaDaTabela: { flexDirection: 'row', borderBottomWidth: 1 },
  celulaLinha: { width: LARGURA_DO_NUMERO, padding: espaco(1), justifyContent: 'center', gap: 2 },
  erros: { gap: espaco(1) },
  grupoDeErro: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  celulaCabecalho: { padding: espaco(1), gap: espaco(0.5) },
  celula: { padding: espaco(0.75), justifyContent: 'center', gap: 2 },
});
