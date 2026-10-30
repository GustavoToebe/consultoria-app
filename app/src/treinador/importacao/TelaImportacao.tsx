import * as DocumentPicker from 'expo-document-picker';
import { Check, Download, FileSpreadsheet, FileUp } from 'lucide-react-native';
import { createElement, useId, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { colunasDaImportacao, confirmarImportacao, csvDeErrosDaImportacao, detalheDaImportacao, listarImportacoes, previaDaImportacao } from '../../api/rotas';
import type { ColunasDaImportacao, DetalheDeImportacao, PreviaDeImportacao } from '../../api/tipos';
import {
  ETAPAS_DA_IMPORTACAO, campoDaColuna, camposPermitidos, escolherCampoDaColuna, explicacaoDosExistentes, motivoParaNaoContinuar,
  resumoDaValidacao, tamanhoParaTela, textoDoErro, textoDoQueVaiAcontecer, tipoDoArquivo, type EtapaDaImportacao, type MapaDaImportacao,
} from '../../dominio/assistenteDaImportacao';
import { DESTINOS, destinosPermitidos, faltandoColuna, sugerirMapeamento, type Destino } from '../../dominio/mapeamentoDaImportacao';
import { dataHoraParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, LARGURA_EDITOR, RAIO, espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { textoDoErro as textoDoErroDaApi } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { baixarCsv } from '../financeiro/baixarCsv';
import { formulario, type ArquivoEscolhido } from './formularioDaImportacao';

const SITUACAO: Record<string, { texto: string; tipo: TipoSelo }> = {
  CONCLUIDA: { texto: 'Concluída', tipo: 'sucesso' },
  CONCLUIDA_COM_ERROS: { texto: 'Concluída com erros', tipo: 'atencao' },
  FALHOU: { texto: 'Falhou', tipo: 'perigo' },
};

const BASE_MODELO = 'https://consultoria.servirea.com.br/modelos/importacao';
/** Abaixo desta largura o indicador de etapas vira "Etapa N de 5" e o mapeamento vira um cartão por coluna. */
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

/** Lista do que já foi importado; "Nova importação" abre o assistente em etapas. O arquivo não fica guardado. */
export function TelaImportacao() {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const permitidos = destinosPermitidos(pode);
  const [busca, setBusca] = useState('');
  const [destinoFiltro, setDestinoFiltro] = useState('');
  const [situacao, setSituacao] = useState('');
  const [pagina, setPagina] = useState(0);
  const [assistente, setAssistente] = useState(false);
  const [modelos, setModelos] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const filtro = { destino: destinoFiltro || undefined, situacao: situacao || undefined, busca: busca.trim() || undefined, pagina };
  const lista = useCarregar(assistente ? null : JSON.stringify(filtro), () => listarImportacoes(filtro));

  return (
    <>
      <LinhaDeAcoes>
        <Botao rotulo="Nova importação" Icone={FileUp} aoTocar={() => setAssistente(true)} />
        <Botao rotulo="Modelos de planilha" tipo="secundario" aoTocar={() => setModelos(true)} />
      </LinhaDeAcoes>
      <Campo rotulo="Buscar" valor={busca} aoMudar={(v) => { setBusca(v); setPagina(0); }} placeholder="Nome do arquivo" />
      <LinhaDeAcoes>
        <EscolhaEmFolha rotulo="Destino" valor={destinoFiltro} aoMudar={(v) => { setDestinoFiltro(v); setPagina(0); }}
          opcoes={[{ valor: '', rotulo: 'Todos os destinos' }, ...permitidos.map((d) => ({ valor: d.id, rotulo: d.rotulo }))]} />
        <EscolhaEmFolha rotulo="Situação" valor={situacao} aoMudar={(v) => { setSituacao(v); setPagina(0); }}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...Object.entries(SITUACAO).map(([valor, s]) => ({ valor, rotulo: s.texto }))]} />
      </LinhaDeAcoes>
      {lista.erro ? <MensagemErro texto={textoDoErroDaApi(lista.erro)} tentarDeNovo={lista.recarregar} /> : null}
      {lista.carregando && !lista.dados ? <Esqueleto /> : null}
      {lista.dados?.itens.length === 0 ? <Vazio titulo="Nenhuma importação" texto="Quando você confirmar uma planilha, ela aparece aqui. O arquivo em si não fica guardado." /> : null}
      {lista.dados && lista.dados.itens.length > 0 ? (
        <Cartao titulo="Histórico" descricao={`${lista.dados.total} ${lista.dados.total === 1 ? 'importação' : 'importações'}.`}>
          <Tabela rotulo="Importações" linhas={lista.dados.itens} chave={(i) => i.id} aoTocarLinha={(i) => setDetalheId(i.id)} rotuloDaLinha={(i) => `Abrir ${i.nomeArquivo}`} colunas={[
            { chave: 'arquivo', titulo: 'Arquivo', flex: 2, principal: true, render: (i) => <Texto variante="bloco">{i.nomeArquivo}</Texto> },
            { chave: 'destino', titulo: 'Destino', flex: 1, render: (i) => <Texto>{DESTINOS.find((d) => d.id === i.destino)?.rotulo ?? i.destino}</Texto> },
            { chave: 'quando', titulo: 'Quando', flex: 1.2, render: (i) => <Texto numerico>{dataHoraParaTela(i.criadoEm)}</Texto> },
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
      {assistente ? (
        <Assistente destinos={permitidos} aoFechar={() => setAssistente(false)}
          aoConcluir={() => { setAssistente(false); lista.recarregar(); avisar('Importação registrada.'); }} />
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

/** Novos, atualizados, ignorados e com erro, cada um no seu número, e o CSV dos erros. */
function ResultadoDaImportacao({ dados }: { dados: DetalheDeImportacao }) {
  const [baixando, setBaixando] = useState(false);
  const baixar = () => {
    setBaixando(true);
    csvDeErrosDaImportacao(dados.id).then((texto) => baixarCsv('erros.csv', texto)).finally(() => setBaixando(false));
  };
  return (
    <>
      <Texto>{DESTINOS.find((d) => d.id === dados.destino)?.rotulo} · {dataHoraParaTela(dados.criadoEm)}</Texto>
      <Numeros itens={[
        { rotulo: 'Novos', valor: dados.novos },
        { rotulo: 'Atualizados', valor: dados.atualizados },
        { rotulo: 'Já existiam (ficaram como estavam)', valor: dados.ignorados },
        { rotulo: 'Com erro (ficaram de fora)', valor: dados.comErro, tipo: dados.comErro > 0 ? 'perigo' : undefined },
      ]} />
      {dados.erros.length > 0 ? <Botao rotulo="Baixar CSV de erros" tipo="secundario" Icone={Download} carregando={baixando} aoTocar={baixar} /> : null}
      {dados.erros.slice(0, ERROS_NA_TELA).map((e) => {
        const campo = DESTINOS.find((d) => d.id === dados.destino)?.campos.find((c) => c.id === e.campo)?.rotulo ?? e.campo;
        return <Texto key={`${e.linha}-${e.campo}`}>{`Linha ${e.linha} · ${campo}: ${e.motivo}`}</Texto>;
      })}
      {dados.erros.length > ERROS_NA_TELA ? <Texto variante="suave">{`E mais ${dados.erros.length - ERROS_NA_TELA} no CSV.`}</Texto> : null}
    </>
  );
}

function FolhaDetalhe({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(`importacao:${id}`, () => detalheDaImportacao(id));
  const selo = dados ? SITUACAO[dados.situacao] : undefined;
  return (
    <Folha visivel titulo={dados?.nomeArquivo ?? 'Importação'} aoFechar={aoFechar}
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

function Assistente({ destinos, aoFechar, aoConcluir }: { destinos: Destino[]; aoFechar: () => void; aoConcluir: () => void }) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const podeSensivel = pode('ALUNO_SENSIVEL_ALTERAR');
  const [etapa, setEtapa] = useState<EtapaDaImportacao>(1);
  const [largura, setLargura] = useState(LARGURA_EDITOR);
  const [destino, setDestino] = useState<Destino | null>(destinos.length === 1 ? destinos[0] : null);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [colunas, setColunas] = useState<ColunasDaImportacao | null>(null);
  const [aba, setAba] = useState(0);
  const [cabecalho, setCabecalho] = useState(true);
  const [chave, setChave] = useState(destinos.length === 1 ? destinos[0].chaves[0].valor : 'email');
  const [existentes, setExistentes] = useState(destinos.length === 1 ? destinos[0].existentes[0].valor : 'IGNORAR');
  const [mapa, setMapa] = useState<MapaDaImportacao>({});
  const [previa, setPrevia] = useState<PreviaDeImportacao | null>(null);
  const [resultado, setResultado] = useState<DetalheDeImportacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  /** Só a resposta do último pedido vale: trocar a aba duas vezes depressa não deixa a primeira resposta vencer. */
  const pedido = useRef(0);
  const estreita = largura < LARGURA_ESTREITA;

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
  };

  const escolherArquivo = (a: ArquivoEscolhido) => {
    setArquivo(a);
    setAba(0);
    setColunas(null);
    setMapa({});
    setPrevia(null);
    setErro(null);
  };

  const lerColunas = (proxAba: number, proxCabecalho: boolean) => {
    if (!destino || !arquivo) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    setPrevia(null);
    formulario(arquivo).then((dados) => colunasDaImportacao(destino.id, dados, proxAba, proxCabecalho)).then((c) => {
      if (meu !== pedido.current) return;
      setColunas(c);
      setAba(c.aba);
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

  const configuracao = () => ({
    aba, cabecalho, chave, existentes,
    mapeamento: Object.fromEntries(Object.entries(mapa).filter(([, v]) => v !== null && v >= 0)),
  });

  const validar = () => {
    if (!destino || !arquivo) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    formulario(arquivo, configuracao()).then((dados) => previaDaImportacao(destino.id, dados)).then((p) => {
      if (meu !== pedido.current) return;
      setPrevia(p);
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
      if (!colunas) lerColunas(aba, cabecalho);
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

  const motivo = motivoParaNaoContinuar(etapa, { destino, arquivo, lendo: ocupado, temColunas: !!colunas, chave, mapa });
  const resumo = previa ? resumoDaValidacao(previa) : null;
  const titulo = destino ? `Nova importação · ${destino.rotulo}` : 'Nova importação';
  const fechar = etapa === 5 ? aoConcluir : aoFechar;

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
    <Folha visivel titulo={titulo} aoFechar={fechar} largura={LARGURA_EDITOR} rodape={rodape}>
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={estilos.coluna}>
        <Etapas etapa={etapa} estreita={estreita} />
        {erro ? <MensagemErro texto={textoDoErroDaApi(erro)} /> : null}

        {etapa === 1 ? (
          <>
            <Escolha rotulo="O que vai importar" opcoes={destinos.map((d) => ({ valor: d.id as string, rotulo: d.rotulo }))}
              valor={destino?.id ?? null} aoMudar={escolherDestino} />
            <Cartao titulo="Enviar planilha preenchida" descricao="Aceita .xlsx e .csv. Nada é gravado antes de você confirmar no fim.">
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
                  <EscolhaEmFolha rotulo="Aba" valor={String(aba)} aoMudar={(v) => lerColunas(Number(v), cabecalho)}
                    opcoes={colunas.abas.map((nome, i) => ({ valor: String(i), rotulo: nome }))} />
                  <Texto variante="pequeno">{`A planilha tem ${colunas.abas.length} abas; escolha a que tem os dados.`}</Texto>
                </View>
              ) : null}
              <CaixaSelecao rotulo="A primeira linha é o cabeçalho" ajuda="Desmarque se a planilha começa direto nos dados; as colunas viram A, B, C…"
                marcado={cabecalho} aoMudar={(v) => { setCabecalho(v); lerColunas(aba, v); }} />
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
          <Mapeamento destino={destino} colunas={colunas} cabecalho={cabecalho} chave={chave} mapa={mapa} estreita={estreita} podeSensivel={podeSensivel}
            aoMudar={(m) => { setMapa(m); setPrevia(null); }} />
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
                  <Cartao titulo="Linhas com erro" descricao="Ficam de fora. Para corrigi-las, ajuste a planilha e envie de novo.">
                    {previa.erros.slice(0, ERROS_NA_TELA).map((e) => (
                      <Texto key={`${e.linha}-${e.campo}`}>{textoDoErro(e, destino, colunas.colunas, mapa)}</Texto>
                    ))}
                    {previa.erros.length > ERROS_NA_TELA || previa.errosAlem > 0
                      ? <Texto variante="suave">{`E mais ${previa.erros.length - Math.min(previa.erros.length, ERROS_NA_TELA) + previa.errosAlem}.`}</Texto>
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
    </Folha>
  );
}

/** A planilha com a escolha do campo em cima de cada coluna; estreita, um cartão por coluna com exemplos. */
function Mapeamento({ destino, colunas, cabecalho, chave, mapa, estreita, podeSensivel, aoMudar }: {
  destino: Destino; colunas: ColunasDaImportacao; cabecalho: boolean; chave: string; mapa: MapaDaImportacao;
  estreita: boolean; podeSensivel: boolean; aoMudar: (mapa: MapaDaImportacao) => void;
}) {
  const { cores } = useTema();
  const campos = camposPermitidos(destino, podeSensivel);
  const faltando = faltandoColuna(destino, chave, mapa);
  const nomeDaColuna = (i: number) => colunas.colunas[i] || `Coluna ${i + 1}`;
  const opcoes = (coluna: number) => [
    { valor: null, rotulo: 'Não importar' },
    ...campos.map((c) => {
      const onde = mapa[c.id];
      const emOutra = onde !== null && onde !== undefined && onde !== coluna;
      const detalhe = [c.obrigatorio ? 'Obrigatório' : null, emOutra ? `Hoje na coluna “${nomeDaColuna(onde)}”` : null].filter(Boolean).join(' · ');
      return { valor: c.id as string | null, rotulo: c.rotulo, detalhe: detalhe || undefined };
    }),
  ];
  const seletor = (i: number) => (
    <EscolhaEmFolha rotulo="Campo" titulo={`Campo da coluna “${nomeDaColuna(i)}”`} valor={campoDaColuna(mapa, i)} opcoes={opcoes(i)}
      aoMudar={(campo) => aoMudar(escolherCampoDaColuna(mapa, i, campo))} style={estilos.seletor} />
  );
  const primeiraLinha = cabecalho ? 2 : 1;

  return (
    <>
      {faltando.length > 0 ? (
        <View style={[estilos.alerta, { borderColor: cores.perigo }]} accessibilityRole="alert">
          <Texto cor={cores.perigo}>{`Falta escolher a coluna de: ${faltando.join(', ')}.`}</Texto>
        </View>
      ) : null}
      <Texto variante="suave">
        {colunas.amostra.length > 0
          ? 'Estas são as primeiras linhas do arquivo. Em cada coluna, escolha o campo do sistema; o que ficar em “Não importar” não entra.'
          : 'A aba não tem linhas de dados. Volte e confira a aba ou o cabeçalho.'}
      </Texto>
      {!podeSensivel && destino.campos.some((c) => c.sensivel) ? (
        <Texto variante="pequeno">CPF, endereço, objetivo e observações precisam da permissão de dados sensíveis e não aparecem na lista.</Texto>
      ) : null}
      {estreita ? (
        colunas.colunas.map((_, i) => (
          <View key={i} style={[estilos.cartaoColuna, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
            <Texto variante="bloco">{nomeDaColuna(i)}</Texto>
            {colunas.amostra.length > 0 ? (
              <Texto variante="suave" numberOfLines={2}>{`Ex.: ${colunas.amostra.map((l) => l[i]).filter((v) => v && v.trim() !== '').slice(0, 3).join(' · ') || '(vazio)'}`}</Texto>
            ) : null}
            {seletor(i)}
          </View>
        ))
      ) : (
        <ScrollView horizontal style={[estilos.tabela, { borderColor: cores.borda }]}>
          <View>
            <View style={[estilos.linhaDaTabela, { backgroundColor: cores.superficie3, borderBottomColor: cores.borda }]}>
              <View style={estilos.celulaLinha}><Texto variante="rotulo">Linha</Texto></View>
              {colunas.colunas.map((_, i) => (
                <View key={i} style={estilos.celulaCabecalho}>
                  <Texto variante="rotulo" numberOfLines={1}>{nomeDaColuna(i)}</Texto>
                  {seletor(i)}
                </View>
              ))}
            </View>
            {colunas.amostra.map((linha, l) => (
              <View key={l} style={[estilos.linhaDaTabela, { borderBottomColor: cores.divisor }]}>
                <View style={estilos.celulaLinha}><Texto numerico variante="suave">{primeiraLinha + l}</Texto></View>
                {colunas.colunas.map((_, i) => (
                  <View key={i} style={estilos.celula}><Texto numberOfLines={1}>{linha[i] ?? ''}</Texto></View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {colunas.linhas > colunas.amostra.length ? (
        <Texto variante="pequeno">{`Mostrando ${colunas.amostra.length} de ${colunas.linhas} linhas.`}</Texto>
      ) : null}
    </>
  );
}

function ZonaDeArquivo({ arquivo, aoEscolher }: { arquivo: ArquivoEscolhido | null; aoEscolher: (arquivo: ArquivoEscolhido) => void }) {
  const { cores } = useTema();
  const idDaEntrada = `arquivo-da-planilha-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
    <View style={estilos.vazioDoArquivo}>
      <FileUp size={28} color={cores.textoSuave} />
      <Texto variante="suave">{Platform.OS === 'web' ? 'Arraste o arquivo para cá ou escolha no computador.' : 'Escolha o arquivo no aparelho.'}</Texto>
      <Botao rotulo="Escolher arquivo" tipo="secundario" aoTocar={escolher} />
    </View>
  );

  if (Platform.OS !== 'web') return <View style={[estilos.zona, { borderColor: cores.bordaCampo, backgroundColor: cores.campo }]}>{conteudo}</View>;
  return createElement('div', {
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => { e.preventDefault(); receber(e.dataTransfer?.files?.[0]); },
    style: { display: 'flex', flexDirection: 'column', border: `1px dashed ${cores.bordaCampo}`, borderRadius: RAIO, background: cores.campo, padding: 16 },
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
  alerta: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  zona: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, padding: espaco(2) },
  vazioDoArquivo: { alignItems: 'center', gap: espaco(1), paddingVertical: espaco(1.5) },
  arquivo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  textosDoArquivo: { flex: 1, minWidth: 180, gap: 2 },
  tabela: { borderWidth: 1, borderRadius: RAIO },
  linhaDaTabela: { flexDirection: 'row', borderBottomWidth: 1 },
  celulaLinha: { width: 64, padding: espaco(1), justifyContent: 'center' },
  celulaCabecalho: { width: 240, padding: espaco(1), gap: espaco(0.75) },
  celula: { width: 240, padding: espaco(1), minHeight: ALVO_TOQUE, justifyContent: 'center' },
  seletor: { alignSelf: 'stretch' },
  cartaoColuna: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
});
