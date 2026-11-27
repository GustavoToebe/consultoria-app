import { Ellipsis, FileSignature, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { arquivarModeloDeContrato, listarModelosDeContrato, type ModeloDeContrato } from '../../api/contratos';
import { atualizarPrazoDosContratos, obterPrazoDosContratos, type PrazoDosContratos } from '../../api/contratosPrazo';
import { lerPrazoDias, textoDoPrazo } from '../../dominio/travaDoContrato';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { BarraDeSalvar } from '../financeiro/AjustesDaAba';
import { FolhaModeloDeContrato, type AbaDoModelo } from './FolhaModeloDeContrato';

export const CONTRATOS_INDISPONIVEL = 'CONTRATOS_INDISPONIVEL';
export const TEXTO_SEM_INTERNET = 'Confira a internet e tente de novo.';
const DESCRICAO = 'Modelos de contrato que você gera para o aluno assinar no app. Os campos entre chaves são preenchidos com os dados de cada aluno.';

const atualizadoEm = (m: ModeloDeContrato) => `Atualizado em ${dataParaTela(dataEmBrasilia(m.atualizadoEm))}`;
const porNome = (a: ModeloDeContrato, b: ModeloDeContrato) => a.nome.localeCompare(b.nome, 'pt-BR');

type Aberta = { modelo: ModeloDeContrato | null; aba: AbaDoModelo };

/**
 * Configurações › Contratos (`docs/planos/contrato-digital-telas.md`, tela A): os modelos de contrato da consultoria. Lê com
 * `CONTRATO_LER`; cria, edita, vê a prévia e arquiva com `CONTRATO_ALTERAR`. Com a chave da plataforma desligada (ou o 503
 * `CONTRATOS_INDISPONIVEL`) a tela diz que o recurso não está ativo e não chama a API. Os arquivados ficam numa seção
 * recolhida, só leitura (não há desarquivar). `embutida`: aberta dentro de Configurações, sem seta nem trilha.
 */
export function TelaContratos({ embutida = false }: { embutida?: boolean }) {
  const { pode, contratosHabilitados } = useSessao();
  const { avisar } = useAviso();
  const podeAlterar = pode('CONTRATO_ALTERAR');
  const lista = useCarregar(contratosHabilitados ? 'contratos-modelos' : null, () => listarModelosDeContrato());
  const desligado = !contratosHabilitados || codigoApi(lista.erro) === CONTRATOS_INDISPONIVEL;
  const modelos = lista.dados ?? [];
  const ativos = modelos.filter((m) => !m.arquivadoEm).sort(porNome);
  const arquivados = modelos.filter((m) => m.arquivadoEm).sort(porNome);
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
    if (desligado) return <Vazio Icone={FileSignature} titulo="Contratos não estão ativos" texto="O contrato digital não está ativo nesta instalação do app." />;
    if (lista.erro && !lista.dados) return <MensagemErro texto={erroDeConexao(lista.erro) ? TEXTO_SEM_INTERNET : textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} />;
    if (!lista.dados) return <Esqueleto texto="Carregando os modelos de contrato" cartoes={3} />;
    if (ativos.length === 0 && arquivados.length === 0) {
      return podeAlterar
        ? <Vazio Icone={FileSignature} titulo="Nenhum modelo de contrato" texto="Crie o modelo com o seu texto e os campos que o app preenche para cada aluno." acao={{ rotulo: 'Novo modelo', aoTocar: novo }} />
        : <Vazio Icone={FileSignature} texto="Ainda não há modelo de contrato. Peça a quem administra a consultoria." />;
    }
    return (
      <Cartao titulo={`Modelos de contrato (${ativos.length})`} nivel={2}>
        {alerta ? <Alerta tom="perigo" texto={alerta} /> : null}
        {ativos.length ? <ListaDeLinhas>{ativos.map(linha)}</ListaDeLinhas> : <Vazio texto="Nenhum modelo ativo. Os arquivados estão abaixo." />}
        {arquivados.length ? (
          <View style={estilos.arquivados}>
            <CabecalhoDeGrupo titulo={`Arquivados (${arquivados.length})`} linha="fina" aberto={secoes.estaAberta('arquivados')} aoAlternar={() => secoes.alternar('arquivados')} />
            {secoes.estaAberta('arquivados') ? <ListaDeLinhas>{arquivados.map(linha)}</ListaDeLinhas> : null}
          </View>
        ) : null}
      </Cartao>
    );
  };

  return (
    <Tela largura={LARGURA_FORMULARIO} bordas={['top']}>
      <Cabecalho titulo="Contratos" descricao={DESCRICAO}
        acoes={podeAlterar && !desligado && lista.dados && (ativos.length || arquivados.length) ? <Botao rotulo="Novo modelo" tipo="acao" Icone={Plus} aoTocar={novo} /> : undefined}
        {...(embutida ? null : { voltar: '/treinador/configuracoes' as const, trilha: [{ rotulo: 'Configurações', href: '/treinador/configuracoes' as const }, { rotulo: 'Contratos' }] })} />
      {corpo()}
      {desligado ? null : <CartaoPrazo podeAlterar={podeAlterar} />}
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
    </Tela>
  );
}

// ---- prazo para assinar (S6) ----

const TITULO_DO_PRAZO = 'Prazo para assinar';
const AJUDA_DO_PRAZO = 'Depois desse prazo, quem não assinou fica sem acesso ao app até assinar. Vale para os contratos gerados daqui em diante.';
const ROTULO_DA_ESCOLHA = 'Quando o aluno não assina';
type ModoDoPrazo = 'livre' | 'prazo';

/**
 * "Prazo para assinar" (`GET`/`PUT /consultoria/contratos`): não travar o acesso ou N dias (1 a 60). Com `CONTRATO_ALTERAR`
 * edita com a barra de salvar; sem ela, só leitura. Mudar o prazo não mexe nos contratos já gerados (D7: ligar não trava ninguém).
 */
function CartaoPrazo({ podeAlterar }: { podeAlterar: boolean }) {
  const carga = useCarregar('contratos-prazo', () => obterPrazoDosContratos());
  if (carga.erro && !carga.dados) {
    return (
      <Cartao titulo={TITULO_DO_PRAZO} nivel={2}>
        <MensagemErro texto={erroDeConexao(carga.erro) ? TEXTO_SEM_INTERNET : textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} />
      </Cartao>
    );
  }
  if (!carga.dados) return <Esqueleto texto="Carregando o prazo para assinar" cartoes={1} />;
  const gravado = carga.dados.prazoDias;
  if (!podeAlterar) {
    return (
      <Cartao titulo={TITULO_DO_PRAZO} descricao={AJUDA_DO_PRAZO} nivel={2}>
        <CampoLeitura rotulo={ROTULO_DA_ESCOLHA} valor={textoDoPrazo(gravado)} />
      </Cartao>
    );
  }
  // A chave refaz o formulário com o valor que o servidor devolveu ao salvar.
  return <FormularioDoPrazo key={String(gravado)} gravado={gravado} aoSalvar={carga.definir} />;
}

function FormularioDoPrazo({ gravado, aoSalvar }: { gravado: number | null; aoSalvar: (novo: PrazoDosContratos) => void }) {
  const { avisar } = useAviso();
  const [modo, setModo] = useState<ModoDoPrazo>(gravado === null ? 'livre' : 'prazo');
  const [dias, setDias] = useState(gravado === null ? '' : String(gravado));
  const [erroDoCampo, setErroDoCampo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<TextInput>(null);

  const mudou = modo === 'livre' ? gravado !== null : dias.trim() !== String(gravado ?? '');
  useGuardaDeSaida(mudou);

  const descartar = () => {
    setModo(gravado === null ? 'livre' : 'prazo');
    setDias(gravado === null ? '' : String(gravado));
    setErroDoCampo(null);
    setErroGeral(null);
  };

  const focarNoCampo = () => setTimeout(() => campo.current?.focus(), 0);

  const salvar = () => {
    if (enviando) return;
    let prazoDias: number | null = null;
    if (modo === 'prazo') {
      const lido = lerPrazoDias(dias);
      if (lido.erro !== null) {
        setErroDoCampo(lido.erro);
        focarNoCampo();
        return;
      }
      prazoDias = lido.valor;
    }
    setEnviando(true);
    setErroDoCampo(null);
    setErroGeral(null);
    atualizarPrazoDosContratos(prazoDias).then(
      (novo) => {
        setEnviando(false);
        avisar('Prazo para assinar salvo.', 'sucesso');
        aoSalvar(novo);
      },
      (e: unknown) => {
        setEnviando(false);
        const doCampo = errosPorCampo(e).prazoDias;
        // Com "Não travar o acesso" não há campo à vista: o erro fica na barra.
        if (doCampo && modo === 'prazo') {
          setErroDoCampo(doCampo);
          focarNoCampo();
          return;
        }
        setErroGeral(doCampo ?? (erroDeConexao(e) ? TEXTO_SEM_INTERNET : textoDoErro(e)));
      },
    );
  };

  return (
    <Cartao titulo={TITULO_DO_PRAZO} descricao={AJUDA_DO_PRAZO} nivel={2}
      rodape={(
        <BarraDeSalvar mudou={mudou} enviando={enviando} aoSalvar={salvar} aoDescartar={descartar}
          rotuloSalvar="Salvar prazo" rotuloAcessivelDescartar="Descartar alterações do prazo para assinar"
          erro={erroGeral ? <Alerta tom="perigo" texto={erroGeral} /> : null} />
      )}>
      <View style={estilos.prazo}>
        <Escolha<ModoDoPrazo> rotulo={ROTULO_DA_ESCOLHA} valor={modo} aoMudar={(v) => { setModo(v); setErroDoCampo(null); setErroGeral(null); }}
          opcoes={[{ valor: 'livre', rotulo: 'Não travar o acesso' }, { valor: 'prazo', rotulo: 'Travar depois de um prazo' }]} />
        {modo === 'prazo' ? (
          <View style={estilos.campoDoPrazo}>
            <Campo ref={campo} numerico rotulo="Dias para assinar" sufixo="dias" valor={dias} maxLength={2} autoComplete="off"
              aoMudar={(t) => { setDias(t.replace(/\D/g, '')); setErroDoCampo(null); }}
              onBlur={() => { if (dias.trim()) setErroDoCampo(lerPrazoDias(dias).erro); }}
              erro={erroDoCampo} ajuda="De 1 a 60 dias, contados do envio do contrato." />
          </View>
        ) : null}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  prazo: { gap: espaco(2) },
  campoDoPrazo: { maxWidth: 280 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  arquivados: { gap: espaco(1.5), marginTop: espaco(1) },
});
