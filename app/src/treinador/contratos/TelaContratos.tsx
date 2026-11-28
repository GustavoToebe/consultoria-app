import { Ellipsis, FileSignature, Plus } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput, type ViewStyle } from 'react-native';

import { arquivarModeloDeContrato, listarModelosDeContrato, type ModeloDeContrato } from '../../api/contratos';
import { apoioGruda, VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAreaDaTela } from '../../ui/useAreaDaTela';
import { useCarregar } from '../../ui/useCarregar';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { RodapeDeSalvar } from '../marca/RodapeDeSalvar';
import { CartaoComoFunciona } from './ComoFuncionaOContrato';
import { FolhaModeloDeContrato, type AbaDoModelo } from './FolhaModeloDeContrato';
import { CartaoPrazoParaAssinar, usePrazoParaAssinar } from './PrazoParaAssinar';

export const CONTRATOS_INDISPONIVEL = 'CONTRATOS_INDISPONIVEL';
export const TEXTO_SEM_INTERNET = 'Confira a internet e tente de novo.';
const DESCRICAO = 'Modelos de contrato que você gera para o aluno assinar no app. Os campos entre chaves são preenchidos com os dados de cada aluno.';

/** Duas colunas a partir desta largura útil da área (pedido de 28/11); abaixo, uma coluna com o apoio embaixo. */
const AREA_PARA_DUAS_COLUNAS = 1280;
const LARGURA_DOS_MODELOS = 880;
const LARGURA_DO_APOIO = 400;
const PASSOS_DO_VAZIO = [
  'Escreva o seu texto.',
  'Use os campos que o app preenche, como nome, CPF, plano e valor.',
  'O aluno lê e assina no app.',
] as const;

const atualizadoEm = (m: ModeloDeContrato) => `Atualizado em ${dataParaTela(dataEmBrasilia(m.atualizadoEm))}`;
const porNome = (a: ModeloDeContrato, b: ModeloDeContrato) => a.nome.localeCompare(b.nome, 'pt-BR');

type Aberta = { modelo: ModeloDeContrato | null; aba: AbaDoModelo };

/**
 * Configurações › Contratos (`docs/planos/contrato-digital-telas.md`, tela A). Lê com `CONTRATO_LER`; cria, edita, vê a
 * prévia e arquiva com `CONTRATO_ALTERAR`. Com a chave da plataforma desligada (ou o 503 `CONTRATOS_INDISPONIVEL`) a tela
 * diz que o recurso não está ativo e não chama a API. Mesmo container das outras telas de Configurações (sem teto
 * centralizado): a partir de 1280 de área, "Modelos de contrato" à esquerda (até 880) e o apoio fixo à direita (400) com o
 * prazo e "Como funciona"; abaixo disso, uma coluna. O salvar do prazo é o `RodapeDeSalvar`, logo abaixo do cartão do
 * prazo (na web gruda na base da janela enquanto o apoio está à vista). `embutida`: aberta dentro de Configurações, sem seta nem trilha.
 */
export function TelaContratos({ embutida = false }: { embutida?: boolean }) {
  const { pode, contratosHabilitados } = useSessao();
  const podeAlterar = pode('CONTRATO_ALTERAR');
  const lista = useCarregar(contratosHabilitados ? 'contratos-modelos' : null, () => listarModelosDeContrato());
  const desligado = !contratosHabilitados || codigoApi(lista.erro) === CONTRATOS_INDISPONIVEL;
  const campoDoPrazo = useRef<TextInput>(null);
  const prazo = usePrazoParaAssinar(contratosHabilitados, campoDoPrazo);

  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Contratos" descricao={DESCRICAO}
        {...(embutida ? null : { voltar: '/treinador/configuracoes' as const, trilha: [{ rotulo: 'Configurações', href: '/treinador/configuracoes' as const }, { rotulo: 'Contratos' }] })} />
      {desligado ? (
        <Vazio Icone={FileSignature} titulo="Contratos não estão ativos" texto="O contrato digital não está ativo nesta instalação do app." />
      ) : (
        <View style={estilos.pagina}>
          <Colunas principal={<CartaoModelos lista={lista} podeAlterar={podeAlterar} />}
            apoio={(
              <>
                <CartaoPrazoParaAssinar prazo={prazo} campo={campoDoPrazo} podeAlterar={podeAlterar} />
                {/* Logo abaixo do prazo (no celular nativo não há `sticky`: assim não vai para depois dos 12 campos). */}
                {podeAlterar ? (
                  <RodapeDeSalvar alterado={prazo.mudou} rotulo="Salvar prazo" salvando={prazo.enviando} motivo={null}
                    aoSalvar={prazo.salvar} aoCancelar={prazo.descartar} />
                ) : null}
                <CartaoComoFunciona />
              </>
            )} />
        </View>
      )}
    </Tela>
  );
}

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `FormMarca`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), zIndex: 1 } : {}) as unknown as ViewStyle;

/**
 * Principal + apoio. No DOM a principal vem primeiro (leitor de tela e Tab). Não é a `PrincipalComApoio` porque ela abre
 * lado a lado em 972 e põe `overflow: auto` no apoio, que cortaria o balão do ⓘ do prazo; o apoio só gruda se couber na
 * janela (`apoioGruda`), senão rola com a página.
 */
function Colunas({ principal, apoio }: { principal: ReactNode; apoio: ReactNode }) {
  const { largura } = useAreaDaTela();
  const janela = useWindowDimensions();
  const [alturaDoApoio, setAlturaDoApoio] = useState(0);
  const lado = largura >= AREA_PARA_DUAS_COLUNAS;
  const gruda = lado && apoioGruda(alturaDoApoio, janela.height - espaco(4));
  return (
    <View style={lado ? estilos.ladoALado : estilos.empilhado}>
      <View style={lado ? estilos.principal : estilos.empilhado}>{principal}</View>
      <View role="complementary" aria-label="Prazo e campos do contrato" onLayout={(e) => setAlturaDoApoio(e.nativeEvent.layout.height)}
        style={[lado ? estilos.apoio : estilos.empilhado, gruda ? GRUDADA : null]}>
        {apoio}
      </View>
    </View>
  );
}

function CartaoModelos({ lista, podeAlterar }: { lista: ReturnType<typeof useCarregar<ModeloDeContrato[]>>; podeAlterar: boolean }) {
  const { avisar } = useAviso();
  const modelos = lista.dados ?? [];
  const ativos = modelos.filter((m) => !m.arquivadoEm).sort(porNome);
  const arquivados = modelos.filter((m) => m.arquivadoEm).sort(porNome);
  const temModelos = modelos.length > 0;
  // Os ativos ficam sempre à vista; só a seção dos arquivados abre e fecha (nasce fechada).
  const secoes = useSecoesAbertas(['ativos', 'arquivados'], ['ativos']);
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [menu, setMenu] = useState<ModeloDeContrato | null>(null);
  const [arquivar, setArquivar] = useState<ModeloDeContrato | null>(null);
  const [arquivando, setArquivando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);

  const trocar = (m: ModeloDeContrato) => lista.definir([...modelos.filter((x) => x.id !== m.id), m]);
  const novo = () => setAberta({ modelo: null, aba: 'texto' });

  const confirmarArquivar = () => {
    const m = arquivar;
    if (!m || arquivando) return;
    setArquivando(true);
    setAlerta(null);
    arquivarModeloDeContrato(m.id, m.versao).then(
      (r) => { setArquivando(false); setArquivar(null); trocar(r); avisar('Modelo arquivado.', 'sucesso'); },
      (e: unknown) => {
        setArquivando(false);
        setArquivar(null);
        setAlerta(erroDeConexao(e) ? TEXTO_SEM_INTERNET : textoDoErro(e));
        lista.recarregar();
      },
    );
  };

  const linha = (m: ModeloDeContrato) => {
    const editavel = podeAlterar && !m.arquivadoEm;
    return (
      <LinhaDaLista key={m.id} titulo={m.nome} metadados={atualizadoEm(m)} selos={m.arquivadoEm ? [{ texto: 'Arquivado', tipo: 'neutro' }] : undefined}
        acoes={(
          <View style={estilos.acoes}>
            <Botao rotulo={editavel ? 'Editar' : 'Ver'} rotuloAcessivel={`${editavel ? 'Editar' : 'Ver'} modelo ${m.nome}`} tipo="secundario"
              aoTocar={() => setAberta({ modelo: m, aba: 'texto' })} />
            {editavel ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações do modelo ${m.nome}`} aoTocar={() => setMenu(m)} /> : null}
          </View>
        )} />
    );
  };

  const corpo = () => {
    if (lista.erro && !lista.dados) return <MensagemErro texto={erroDeConexao(lista.erro) ? TEXTO_SEM_INTERNET : textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />;
    if (!lista.dados) return <Esqueleto texto="Carregando os modelos de contrato" cartoes={2} />;
    if (!temModelos) {
      return podeAlterar
        ? <VazioDosModelos aoCriar={novo} />
        : <Vazio Icone={FileSignature} texto="Ainda não há modelo de contrato. Peça a quem administra a consultoria." />;
    }
    return (
      <>
        {alerta ? <Alerta tom="perigo" texto={alerta} /> : null}
        {ativos.length ? <ListaDeLinhas>{ativos.map(linha)}</ListaDeLinhas> : <Vazio texto="Nenhum modelo ativo. Os arquivados estão abaixo." />}
        {arquivados.length ? (
          <View style={estilos.arquivados}>
            <CabecalhoDeGrupo titulo={`Arquivados (${arquivados.length})`} linha="fina" aberto={secoes.estaAberta('arquivados')} aoAlternar={() => secoes.alternar('arquivados')} />
            {secoes.estaAberta('arquivados') ? <ListaDeLinhas>{arquivados.map(linha)}</ListaDeLinhas> : null}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <Cartao titulo={ativos.length ? `Modelos de contrato (${ativos.length})` : 'Modelos de contrato'}
      // Sem modelo, o "Novo modelo" fica só no vazio (um botão só na tela).
      acoes={podeAlterar && temModelos ? <Botao rotulo="Novo modelo" tipo="acao" Icone={Plus} aoTocar={novo} /> : undefined}>
      {corpo()}
      {aberta ? (
        <FolhaModeloDeContrato modelo={aberta.modelo} abaInicial={aberta.aba} podeAlterar={podeAlterar} aoSalvar={trocar} aoFechar={() => setAberta(null)} />
      ) : null}
      {menu ? (
        <FolhaDeAcoes titulo={menu.nome} aoFechar={() => setMenu(null)} acoes={[
          { rotulo: 'Ver prévia', aoTocar: () => setAberta({ modelo: menu, aba: 'previa' }) },
          { rotulo: 'Arquivar modelo', perigo: true, aoTocar: () => setArquivar(menu) },
        ]} />
      ) : null}
      <PainelConfirmacao visivel={!!arquivar} perigo titulo="Arquivar o modelo?" carregando={arquivando}
        mensagem="Ele sai da escolha ao gerar contrato. Os contratos já gerados com ele não mudam. Não há como desarquivar."
        rotuloConfirmar="Arquivar" aoConfirmar={confirmarArquivar} aoCancelar={() => setArquivar(null)} />
    </Cartao>
  );
}

/** Vazio útil: o que é um modelo em três passos e a ação de criar o primeiro. */
function VazioDosModelos({ aoCriar }: { aoCriar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={estilos.vazio}>
      <FileSignature size={32} color={cores.textoSuave} aria-hidden />
      <Texto variante="subtitulo" nivel={3}>Nenhum modelo de contrato</Texto>
      <View role="list" style={estilos.passos}>
        {PASSOS_DO_VAZIO.map((p, i) => (
          <View key={p} role="listitem" style={estilos.passo}>
            <View aria-hidden style={[estilos.numero, { borderColor: cores.bordaCampo }]}>
              <Texto variante="rotulo" numerico cor={cores.texto}>{String(i + 1)}</Texto>
            </View>
            <Texto style={estilos.textoDoPasso}>{p}</Texto>
          </View>
        ))}
      </View>
      <Botao rotulo="Novo modelo" tipo="acao" Icone={Plus} aoTocar={aoCriar} style={estilos.inicio} />
    </View>
  );
}

const estilos = StyleSheet.create({
  // A linha das colunas nunca passa de 880 + 32 + 400 e começa na borda esquerda, junto do menu.
  pagina: { width: '100%', maxWidth: LARGURA_DOS_MODELOS + VAO_DA_PRINCIPAL + LARGURA_DO_APOIO, gap: espaco(3) },
  // `flex-start`: sem ele o apoio estica até a altura da principal e o `sticky` não tem para onde andar.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_PRINCIPAL },
  principal: { flex: 1, minWidth: 0, maxWidth: LARGURA_DOS_MODELOS, gap: espaco(3) },
  apoio: { width: LARGURA_DO_APOIO, flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
  empilhado: { gap: espaco(3) },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  arquivados: { gap: espaco(1.5), marginTop: espaco(1) },
  vazio: { gap: espaco(2), alignItems: 'flex-start', paddingVertical: espaco(1) },
  passos: { gap: espaco(1.5) },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  numero: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoDoPasso: { flex: 1 },
  inicio: { alignSelf: 'flex-start' },
});
