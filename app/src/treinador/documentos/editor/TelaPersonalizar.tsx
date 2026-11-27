import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Monitor, RotateCcw, Save } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../../api/cliente';
import { alterarDocumentosPdf, consultoria } from '../../../api/rotas';
import { coresDoDestaque, eDoModelo, resolver, resumoDasAlteracoes, restaurar, trocarModelo, type ConfigPdf, type ModeloPdf } from '../../../dominio/configuracaoPdf';
import { arranjoDoEditor, configDaMarca, mensagemDoErroDeCampo, mesmaConfig, modeloDoEndereco, nomeDoModelo, rascunhoDepoisDeSalvar, VAO_DO_EDITOR, type GrupoDoEditor, type ZoomDaFolha } from '../../../dominio/editorDoPdf';
import type { SeloDoEditor } from '../../../dominio/barraDoEditor';
import { MOTIVO_FORA_DO_PLANO } from '../../../dominio/funcionalidadesDoPlano';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from '../../../pdf/exemplos';
import { logoComoDataUri } from '../../../pdf/logo';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO, LARGURA_MAXIMA } from '../../../tema/tokens';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { useGuardaDeSaida } from '../../../ui/GuardaDeSaida';
import { PainelConfirmacao } from '../../../ui/PainelConfirmacao';
import { Tela } from '../../../ui/Tela';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';
import { BarraDesfazer, type Desfazer } from '../../plano/BarraDesfazer';
import { BarraDoEditor } from '../../plano/BarraDoEditor';
import { FixoAbaixoDaBarra, TelaDoEditor } from '../../plano/TelaDoEditor';
import { PainelDeOpcoes } from './PainelDeOpcoes';
import { PreviaNaMesa, type DocumentoDeExemplo } from './PreviaNaMesa';

const TITULO = 'Personalizar documentos';
const DESCRICAO = 'Ajuste cores, texto, cabeçalho e tabelas do modelo e confira na prévia com dados de exemplo. Nada muda nos PDFs até você salvar.';
const GALERIA = '/treinador/documentos';
const TRILHA = [{ rotulo: 'Documentos (PDF)', href: GALERIA }, { rotulo: 'Personalizar' }] as const;

/**
 * Editor dos PDFs (`/treinador/documentos/personalizar`; D-F1 a D-F8 de `docs/planos/documentos-pdf-motor.md`). A guarda
 * da rota exige administrador com MARCA_ALTERAR; o plano sem PDF é conferido aqui, como na galeria.
 */
export function TelaPersonalizar() {
  const { temFuncionalidade } = useSessao();
  if (!temFuncionalidade('PDF')) {
    return (
      <Tela>
        <Vazio Icone={Lock} nivel={1} titulo={MOTIVO_FORA_DO_PLANO} texto="Os documentos em PDF não fazem parte do plano da sua consultoria."
          acao={{ rotulo: 'Voltar às configurações', aoTocar: () => router.replace('/treinador/configuracoes') }} />
      </Tela>
    );
  }
  return <Personalizar />;
}

function voltarAosModelos() {
  if (router.canGoBack()) router.back();
  else router.replace(GALERIA);
}

/**
 * Dono do estado: a base gravada (a consultoria lida), o rascunho e o modelo pedido pela galeria. Nada grava antes do
 * "Salvar" (D-F3). O arranjo vem da ÁREA de conteúdo medida aqui, por fora do recuo da `TelaDoEditor` (orientações 3.2):
 * abaixo de 1024 só se confirma o modelo pedido (D24). Nada é desenhado antes da primeira medida: o PC não pisca o painel
 * de confirmação do celular.
 */
function Personalizar() {
  const { atualizarMarca } = useSessao();
  const { avisar } = useAviso();
  const { dados, erro, carregando, recarregar, definir: definirDados } = useCarregar('consultoria', () => consultoria());
  const { largura: area, aoMedir } = useFaixaDeLargura();
  // `?modelo=` da galeria: lido na chegada e tirado do endereço (o voltar não reabre a escolha; regra de Voltar do AGENTS).
  const { modelo: noEndereco } = useLocalSearchParams<{ modelo?: string }>();
  const [pedido, setPedido] = useState<ModeloPdf | null>(() => modeloDoEndereco(noEndereco));
  useEffect(() => {
    if (noEndereco !== undefined) router.setParams({ modelo: undefined });
  }, [noEndereco]);
  const [rascunho, setRascunho] = useState<ConfigPdf | null>(null);
  const [desfazer, setDesfazer] = useState<(Desfazer<ConfigPdf> & { focar: boolean }) | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [aberto, setAberto] = useState<GrupoDoEditor | null>(null);
  const [aba, setAba] = useState<DocumentoDeExemplo>('treino');
  const [zoomEscolhido, setZoom] = useState<ZoomDaFolha | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  // Uma data por visita: a prévia não muda sozinha a cada opção.
  const [emitidoEm] = useState(() => new Date());

  const marca = dados?.marca;
  const arranjo = area > 0 ? arranjoDoEditor(area) : null;
  const editor = arranjo?.tipo === 'editor';
  const salvo = marca ? configDaMarca(marca) : null;
  // Modelo pedido igual ao gravado abre o gravado (com as personalizações): reabrir não apaga nada.
  const doPedido = pedido && salvo && pedido !== salvo.modelo ? trocarModelo(pedido) : null;
  const atual = rascunho ?? doPedido ?? salvo;
  // Na tela pequena não se edita: o modelo pedido só é confirmado no painel, e o Cancelar não pode cair no "Sair sem salvar?".
  const pendente = editor && !!atual && !!salvo && !mesmaConfig(atual, salvo);
  useGuardaDeSaida(pendente);

  // A logo vem à parte e não segura a prévia: sem ela (ou sem internet), o cabeçalho mostra o nome da consultoria.
  useEffect(() => {
    if (!marca) return;
    let vivo = true;
    logoComoDataUri(marca).then((l) => vivo && setLogo(l), () => undefined);
    return () => {
      vivo = false;
    };
  }, [marca]);

  // O que a tela tem agora: o `.then` do salvar roda depois de o `rascunho` do fechamento ficar velho.
  const rascunhoAtual = useRef(rascunho);
  useEffect(() => { rascunhoAtual.current = rascunho; }, [rascunho]);
  const mudar = (proxima: ConfigPdf) => {
    rascunhoAtual.current = proxima;
    setRascunho(proxima);
    setErroAoSalvar(null);
  };
  const comDesfazer = (proxima: ConfigPdf, rotulo: string, focar: boolean) => {
    if (!atual || mesmaConfig(proxima, atual)) return;
    setDesfazer({ rotulo, conteudo: atual, focar });
    mudar(proxima);
  };

  const gravar = (alvo: ConfigPdf, depois?: () => void) => {
    if (!dados || salvando) return;
    setSalvando(true);
    setErroAoSalvar(null);
    alterarDocumentosPdf({ modelo: alvo.modelo, opcoes: alvo.sobrescritas, versao: dados.versao })
      .then((c) => {
        atualizarMarca(c.marca);
        definirDados(c);
        // Mexeu nas opções com o salvar em voo: o rascunho (e o desfazer) ficam; só some o que foi mesmo gravado.
        const mantido = rascunhoDepoisDeSalvar(rascunhoAtual.current, alvo);
        setRascunho(mantido);
        setPedido(null);
        if (!mantido) setDesfazer(null);
        avisar(`Documentos salvos no modelo ${nomeDoModelo(alvo.modelo)}. Os próximos PDFs já saem assim.`, 'sucesso');
        depois?.();
      })
      .catch((e: unknown) => {
        if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') setConflito(true);
        else if (e instanceof ErroApi && e.codigo === 'DOCUMENTOS_PDF_INVALIDOS') setErroAoSalvar(mensagemDoErroDeCampo(e.campos, e.message));
        else setErroAoSalvar(textoDoErro(e));
      })
      .finally(() => setSalvando(false));
  };
  const recarregarDepoisDoConflito = () => {
    setConflito(false);
    setRascunho(null);
    setDesfazer(null);
    setErroAoSalvar(null);
    recarregar();
  };
  const painelDoConflito = (
    <PainelConfirmacao visivel={conflito} titulo="Os documentos foram alterados em outro lugar"
      mensagem="Outra pessoa ou outra aba salvou os documentos depois que você abriu esta tela. Recarregue para ver a versão atual; o que você mudou aqui e ainda não salvou será perdido."
      rotuloConfirmar="Recarregar" rotuloCancelar="Fechar" aoConfirmar={recarregarDepoisDoConflito} aoCancelar={() => setConflito(false)} />
  );

  let corpo;
  if (!arranjo) corpo = null;
  else if (!dados || !marca || !atual || !salvo) {
    corpo = (
      <Tela bordas={['top']} largura={LARGURA_FORMULARIO}>
        <Cabecalho titulo={TITULO} descricao={DESCRICAO} trilha={[...TRILHA]} voltar={GALERIA} />
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : carregando ? <Esqueleto /> : null}
      </Tela>
    );
  } else if (arranjo.tipo === 'compacto') {
    corpo = (
      <Tela bordas={['top']} largura={LARGURA_FORMULARIO}>
        <Cabecalho titulo={TITULO} descricao={DESCRICAO} trilha={[...TRILHA]} voltar={GALERIA} />
        <Vazio Icone={Monitor} nivel={2} titulo="Personalize numa tela maior"
          texto="Cores, texto, cabeçalho e tabelas se ajustam no computador, com a prévia ao lado. Aqui você escolhe o modelo na lista de modelos."
          acao={{ rotulo: 'Ver os modelos', aoTocar: voltarAosModelos }} />
        <ConfirmarModelo pedido={doPedido} salvoPersonalizado={!eDoModelo(salvo)} salvando={salvando} erro={erroAoSalvar}
          aoConfirmar={() => doPedido && gravar(doPedido, voltarAosModelos)} aoCancelar={voltarAosModelos} />
        {painelDoConflito}
      </Tela>
    );
  } else {
    const valores = resolver(atual.modelo, atual.sobrescritas);
    const nome = nomeDoModelo(atual.modelo);
    const gerar = aba === 'treino' ? documentoDeExemploDeTreino : documentoDeExemploDeDieta;
    const documento = gerar({ ...marca, temaPdf: atual.modelo, opcoesPdf: atual.sobrescritas }, emitidoEm, logo);
    const selo: SeloDoEditor = salvando ? { texto: 'Salvando…', tipo: 'neutro' }
      : erroAoSalvar ? { texto: 'Falha ao salvar', tipo: 'perigo' }
      : pendente ? { texto: 'Alterações não salvas', tipo: 'neutro', naoSalvo: true }
      : { texto: 'Em uso nos PDFs', tipo: 'sucesso' };
    corpo = (
      <TelaDoEditor largura={LARGURA_MAXIMA}
        cabecalho={<Cabecalho titulo={TITULO} descricao={DESCRICAO} trilha={[...TRILHA]} voltar={GALERIA} />}
        barra={
          <View style={estilos.barra}>
            <BarraDoEditor selo={selo} info={`${nome} · ${resumoDasAlteracoes(atual)}`} erro={erroAoSalvar}>
              <Botao rotulo="Restaurar o modelo" tipo="secundario" Icone={RotateCcw} desabilitado={eDoModelo(atual) || salvando}
                aoTocar={() => comDesfazer(restaurar(atual), `Opções do modelo ${nome} restauradas.`, true)} />
              <Botao rotulo="Salvar" Icone={Save} carregando={salvando} desabilitado={!pendente} aoTocar={() => gravar(atual)} />
            </BarraDoEditor>
            {desfazer ? (
              <BarraDesfazer desfazer={desfazer} focarAoMontar={desfazer.focar}
                aoDesfazer={() => { mudar(desfazer.conteudo); setDesfazer(null); }} aoFechar={() => setDesfazer(null)} />
            ) : null}
          </View>
        }>
        <View style={estilos.colunas}>
          <FixoAbaixoDaBarra rola testID="painel-de-opcoes" style={[estilos.painel, { width: arranjo.painel }]}>
            <PainelDeOpcoes config={atual} valores={valores} corDaMarca={coresDoDestaque('MARCA', marca.corPrimaria).fundo}
              aberto={aberto} aoAbrir={setAberto} aoMudar={mudar}
              aoTrocarModelo={(m) => comDesfazer(trocarModelo(m), `Modelo trocado para ${nomeDoModelo(m)}.`, false)} />
          </FixoAbaixoDaBarra>
          <PreviaNaMesa documento={documento} rotulo={`Prévia do PDF de ${aba} no modelo ${nome}, com dados de exemplo`}
            aba={aba} aoMudarAba={setAba} zoom={zoomEscolhido ?? arranjo.zoomPadrao} aoMudarZoom={setZoom} />
        </View>
        {painelDoConflito}
      </TelaDoEditor>
    );
  }
  return <View style={estilos.raiz} onLayout={aoMedir}>{corpo}</View>;
}

/** Tela pequena (D24): o modelo escolhido na galeria é confirmado e gravado sem personalização (opções vazias). */
function ConfirmarModelo({ pedido, salvoPersonalizado, salvando, erro, aoConfirmar, aoCancelar }: {
  pedido: ConfigPdf | null; salvoPersonalizado: boolean; salvando: boolean; erro: string | null; aoConfirmar: () => void; aoCancelar: () => void;
}) {
  const { cores } = useTema();
  const nome = pedido ? nomeDoModelo(pedido.modelo) : '';
  return (
    <PainelConfirmacao visivel={!!pedido} titulo={`Usar o modelo ${nome}?`}
      mensagem={`Os PDFs de treino, dieta e os demais documentos passam a sair no modelo ${nome}.${salvoPersonalizado ? ' As personalizações do modelo atual deixam de valer.' : ''}`}
      rotuloConfirmar="Usar este modelo" carregando={salvando} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar}>
      {erro ? <Texto cor={cores.perigo}>{erro}</Texto> : null}
    </PainelConfirmacao>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  barra: { gap: espaco(1) },
  // `flex-start`: sem ele o painel estica até a altura da prévia e o `sticky` não tem para onde andar.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DO_EDITOR },
  painel: { flexShrink: 0 },
});
