import * as DocumentPicker from 'expo-document-picker';
import { FileUp } from 'lucide-react-native';
import { createElement, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { colunasDaImportacao, confirmarImportacao, csvDeErrosDaImportacao, detalheDaImportacao, listarImportacoes, previaDaImportacao } from '../../api/rotas';
import type { ColunasDaImportacao, PreviaDeImportacao } from '../../api/tipos';
import { DESTINOS, destinosPermitidos, faltandoColuna, sugerirMapeamento, type Destino } from '../../dominio/mapeamentoDaImportacao';
import { dataHoraParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { baixarCsv } from '../financeiro/baixarCsv';

const SITUACAO: Record<string, { texto: string; tipo: TipoSelo }> = {
  CONCLUIDA: { texto: 'Concluída', tipo: 'sucesso' },
  CONCLUIDA_COM_ERROS: { texto: 'Concluída com erros', tipo: 'atencao' },
  FALHOU: { texto: 'Falhou', tipo: 'perigo' },
};

type ArquivoEscolhido = { nome: string; parte: Blob | { uri: string; name: string; type: string } };

const BASE_MODELO = 'https://consultoria.servirea.com.br/modelos/importacao';

function abrirModelo(nome: string) {
  const caminho = `/modelos/importacao/${nome}`;
  if (Platform.OS === 'web') {
    const abrir = (globalThis as { open?: (url: string, alvo: string, recursos: string) => void }).open;
    abrir?.(caminho, '_blank', 'noopener');
    return;
  }
  void Linking.openURL(`${BASE_MODELO}/${nome}`);
}

function formulario(arquivo: ArquivoEscolhido, configuracao?: unknown): FormData {
  const dados = new FormData();
  if (Platform.OS === 'web') dados.append('arquivo', arquivo.parte as Blob, arquivo.nome);
  else dados.append('arquivo', arquivo.parte as unknown as Blob);
  if (configuracao !== undefined) {
    const json = JSON.stringify(configuracao);
    dados.append('configuracao', Platform.OS === 'web' ? new Blob([json], { type: 'application/json' }) : json);
  }
  return dados;
}

/** Lista do que já foi importado e o assistente de três passos. O arquivo não fica guardado. */
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
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} tentarDeNovo={lista.recarregar} /> : null}
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
            <View style={estilos.pagina}>
              <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
              <Texto>Página {pagina + 1} de {Math.ceil(lista.dados.total / 30)}</Texto>
              <Botao rotulo="Próxima" tipo="secundario" desabilitado={(pagina + 1) * 30 >= lista.dados.total} aoTocar={() => setPagina(pagina + 1)} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      {assistente ? <Assistente destinos={permitidos} aoFechar={() => setAssistente(false)} aoConcluir={() => { setAssistente(false); lista.recarregar(); avisar('Importação registrada.'); }} /> : null}
      {modelos ? <FolhaModelos destinos={permitidos} aoFechar={() => setModelos(false)} /> : null}
      {detalheId ? <FolhaDetalhe id={detalheId} aoFechar={() => setDetalheId(null)} /> : null}
    </>
  );
}

function FolhaModelos({ destinos, aoFechar }: { destinos: Destino[]; aoFechar: () => void }) {
  return (
    <Folha visivel titulo="Modelos de planilha" aoFechar={aoFechar}>
      <Texto variante="suave">Três linhas fictícias em cada arquivo. CPF, telefone e CEP vão como texto. Baixe, troque pelos seus dados e envie.</Texto>
      {destinos.map((d) => (
        <View key={d.id} style={estilos.pagina}>
          <Texto variante="bloco">{d.rotulo}</Texto>
          <Botao rotulo={`CSV de ${d.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${d.id}.csv`)} />
          <Botao rotulo={`Excel de ${d.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${d.id}.xlsx`)} />
        </View>
      ))}
    </Folha>
  );
}

function FolhaDetalhe({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(`importacao:${id}`, () => detalheDaImportacao(id));
  const [baixando, setBaixando] = useState(false);
  const baixar = () => {
    setBaixando(true);
    csvDeErrosDaImportacao(id).then((texto) => baixarCsv('erros.csv', texto)).finally(() => setBaixando(false));
  };
  const selo = dados ? SITUACAO[dados.situacao] : undefined;
  return (
    <Folha visivel titulo={dados?.nomeArquivo ?? 'Importação'} aoFechar={aoFechar}
      acaoNoTopo={selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : undefined}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar} /> : null}
      {carregando && !dados ? <Esqueleto cartoes={1} /> : null}
      {dados ? (
        <>
          <Texto>{DESTINOS.find((d) => d.id === dados.destino)?.rotulo} · {dataHoraParaTela(dados.criadoEm)}</Texto>
          <Texto>{dados.novos} novos, {dados.atualizados} atualizados, {dados.ignorados} ignorados, {dados.comErro} com erro.</Texto>
          {dados.erros.length > 0 ? <Botao rotulo="Baixar CSV de erros" tipo="secundario" carregando={baixando} aoTocar={baixar} /> : null}
          {dados.erros.map((e) => <Texto key={`${e.linha}-${e.campo}`}>{`Linha ${e.linha}, ${e.campo}: ${e.motivo}`}</Texto>)}
        </>
      ) : null}
    </Folha>
  );
}

function Assistente({ destinos, aoFechar, aoConcluir }: { destinos: Destino[]; aoFechar: () => void; aoConcluir: () => void }) {
  const { pode } = useSessao();
  const [passo, setPasso] = useState(1);
  const [destino, setDestino] = useState<Destino | null>(destinos.length === 1 ? destinos[0] : null);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [colunas, setColunas] = useState<ColunasDaImportacao | null>(null);
  const [aba, setAba] = useState(0);
  const [cabecalho, setCabecalho] = useState(true);
  const [chave, setChave] = useState('email');
  const [existentes, setExistentes] = useState('IGNORAR');
  const [mapa, setMapa] = useState<Record<string, number | null>>({});
  const [previa, setPrevia] = useState<PreviaDeImportacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const escolherDestino = (d: Destino) => {
    setDestino(d);
    setChave(d.chaves[0].valor);
    setExistentes(d.existentes[0].valor);
    setColunas(null);
    setPrevia(null);
  };

  const lerColunas = (proxAba: number, proxCabecalho: boolean) => {
    if (!destino || !arquivo) return;
    setOcupado(true);
    setErro(null);
    colunasDaImportacao(destino.id, formulario(arquivo), proxAba, proxCabecalho).then((c) => {
      setColunas(c);
      setAba(c.aba);
      const sugerido = sugerirMapeamento(c.colunas, destino.campos);
      if (!pode('ALUNO_SENSIVEL_ALTERAR')) {
        for (const campo of destino.campos) if (campo.sensivel) sugerido[campo.id] = null;
      }
      setMapa(sugerido);
      setOcupado(false);
    }, (e: unknown) => { setOcupado(false); setErro(e); });
  };

  const configuracao = () => ({
    aba, cabecalho, chave, existentes,
    mapeamento: Object.fromEntries(Object.entries(mapa).filter(([, v]) => v !== null && v >= 0)),
  });

  const verPrevia = () => {
    if (!destino || !arquivo) return;
    setOcupado(true);
    setErro(null);
    previaDaImportacao(destino.id, formulario(arquivo, configuracao())).then((p) => {
      setPrevia(p);
      setOcupado(false);
    }, (e: unknown) => { setOcupado(false); setErro(e); });
  };

  const confirmar = () => {
    if (!destino || !arquivo || !previa) return;
    setOcupado(true);
    setErro(null);
    confirmarImportacao(destino.id, formulario(arquivo, configuracao()), previa.hash).then(aoConcluir, (e: unknown) => {
      setOcupado(false);
      setErro(e);
    });
  };

  const faltando = destino ? faltandoColuna(destino, chave, mapa) : [];
  const validas = previa ? previa.novos + previa.atualizados + previa.ignorados : 0;
  const titulo = passo === 1 ? 'O que importar' : passo === 2 ? 'Configuração' : 'Mapeamento';

  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar} rodape={
      <>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={passo === 1 ? aoFechar : () => setPasso(passo - 1)} />
        {passo < 3 ? (
          <Botao rotulo="Continuar" carregando={ocupado} desabilitado={passo === 1 && (!destino || !arquivo)}
            aoTocar={() => {
              if (passo === 1) { setPasso(2); if (!colunas) lerColunas(0, cabecalho); }
              else { setPasso(3); verPrevia(); }
            }} />
        ) : (
          <Botao rotulo={`Importar ${validas} linhas`} carregando={ocupado} desabilitado={!previa || faltando.length > 0} aoTocar={confirmar} />
        )}
      </>
    }>
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {passo === 1 && destino ? (
        <Cartao titulo="Prepare a planilha">
          <Texto variante="suave">Baixe o modelo, preencha e envie o arquivo. Nada é gravado antes do último botão.</Texto>
          <View style={estilos.pagina}>
            <Botao rotulo={`CSV de ${destino.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${destino.id}.csv`)} />
            <Botao rotulo={`Excel de ${destino.rotulo}`} tipo="secundario" aoTocar={() => abrirModelo(`${destino.id}.xlsx`)} />
          </View>
        </Cartao>
      ) : null}
      {passo === 1 ? (
        <>
          <Grade>
            {destinos.map((d) => (
              <Cartao key={d.id} titulo={d.rotulo} style={destino?.id === d.id ? estilos.escolhido : undefined}
                acoes={<Botao rotulo={destino?.id === d.id ? `${d.rotulo} escolhido` : `Escolher ${d.rotulo}`} tipo="secundario" aoTocar={() => escolherDestino(d)} />}>{null}</Cartao>
            ))}
          </Grade>
          <ZonaDeArquivo nome={arquivo?.nome ?? null} aoEscolher={(a) => { setArquivo(a); setColunas(null); setPrevia(null); }} />
        </>
      ) : null}
      {passo === 2 && destino ? (
        <>
          <CaixaSelecao rotulo="A primeira linha é o cabeçalho" marcado={cabecalho} aoMudar={(v) => { setCabecalho(v); lerColunas(aba, v); }} />
          {colunas && colunas.abas.length > 1 ? (
            <EscolhaEmFolha rotulo="Aba" valor={String(aba)} aoMudar={(v) => lerColunas(Number(v), cabecalho)}
              opcoes={colunas.abas.map((nome, i) => ({ valor: String(i), rotulo: nome }))} />
          ) : null}
          <EscolhaEmFolha rotulo="Chave" valor={chave} aoMudar={setChave} opcoes={destino.chaves} />
          <EscolhaEmFolha rotulo="O que já existe" valor={existentes} aoMudar={setExistentes} opcoes={destino.existentes} />
        </>
      ) : null}
      {passo === 3 && destino && colunas ? (
        <>
          {faltando.length > 0 ? <Texto>Falta coluna para: {faltando.join(', ')}.</Texto> : null}
          {previa && previa.comErro > 0 ? <Texto>As {previa.comErro} linhas com erro ficam de fora.{previa.errosAlem > 0 ? ` E mais ${previa.errosAlem}.` : ''}</Texto> : null}
          {destino.campos.map((campo) => {
            const sensivel = campo.sensivel && !pode('ALUNO_SENSIVEL_ALTERAR');
            return (
              <EscolhaEmFolha key={campo.id} rotulo={campo.rotulo} desabilitado={sensivel}
                valor={mapa[campo.id] ?? -1}
                aoMudar={(v) => { setMapa({ ...mapa, [campo.id]: v < 0 ? null : v }); setPrevia(null); }}
                opcoes={[{ valor: -1, rotulo: sensivel ? 'Sem permissão para este campo' : 'Não importar' }, ...colunas.colunas.map((nome, i) => ({ valor: i, rotulo: nome || `Coluna ${i + 1}` }))]} />
            );
          })}
          {!previa ? <Botao rotulo="Ver prévia" tipo="secundario" carregando={ocupado} desabilitado={faltando.length > 0} aoTocar={verPrevia} /> : null}
        </>
      ) : null}
    </Folha>
  );
}

function ZonaDeArquivo({ nome, aoEscolher }: { nome: string | null; aoEscolher: (arquivo: ArquivoEscolhido) => void }) {
  const escolherNativo = () => {
    DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'], copyToCacheDirectory: true }).then((r) => {
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (Platform.OS === 'web' && a.file) aoEscolher({ nome: a.name, parte: a.file });
      else aoEscolher({ nome: a.name, parte: { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } });
    });
  };
  const receber = (f: File | undefined) => { if (f) aoEscolher({ nome: f.name, parte: f }); };
  return (
    <View style={estilos.zona}>
      <Texto>{nome ?? 'Nenhum arquivo escolhido.'}</Texto>
      {Platform.OS === 'web' ? createElement('div', {
        onDragOver: (e: DragEvent) => e.preventDefault(),
        onDrop: (e: DragEvent) => { e.preventDefault(); receber(e.dataTransfer?.files?.[0]); },
      }, createElement('input', {
        type: 'file',
        accept: '.csv,.xlsx,text/csv',
        'aria-label': 'Arquivo da planilha',
        onChange: (e: Event) => receber((e.target as HTMLInputElement).files?.[0]),
      }), createElement('p', null, 'Ou arraste o arquivo para esta área.')) : <Botao rotulo="Escolher arquivo" tipo="secundario" aoTocar={escolherNativo} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', alignItems: 'center' },
  escolhido: { borderWidth: 2 },
  zona: { gap: espaco(1) },
});
