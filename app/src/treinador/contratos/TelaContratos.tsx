import { Ellipsis, FileSignature, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { arquivarModeloDeContrato, listarModelosDeContrato, type ModeloDeContrato } from '../../api/contratos';
import { dataEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
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
import { useCarregar } from '../../ui/useCarregar';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
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

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  arquivados: { gap: espaco(1.5), marginTop: espaco(1) },
});
