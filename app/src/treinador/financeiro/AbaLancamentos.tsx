import { Plus } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LancamentoResponse, TipoDeLancamento } from '../../api/financeiroTipos';
import { alterarLancamento, criarLancamento, excluirLancamento, listarLancamentos, painelFinanceiro } from '../../api/rotas';
import { hojeEmBrasilia, LIMITES, periodoDoMes, validarLancamento } from '../../dominio/financeiro';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { paraSetParams, temPeriodo } from '../../dominio/filtrosComuns';
import {
  CHAVES_DE_LANCAMENTOS, chipsDosLancamentos, lancamentosParaEndereco, lerLancamentosDoEndereco, SEM_FILTROS_DE_LANCAMENTOS,
  type FiltrosDeLancamentos,
} from '../../dominio/filtrosDoFinanceiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { CamposDePeriodo, CelulaDoFiltro } from '../SeletoresDeFiltro';
import { useAviso } from '../../ui/Aviso';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { ListaOuTabela } from './ListaOuTabela';
import { ResultadoDoMes } from './ResultadoDoMes';

const TAMANHO_PAGINA = 50;
const TIPOS: { valor: TipoDeLancamento; rotulo: string }[] = [
  { valor: 'ENTRADA', rotulo: 'Entrada' },
  { valor: 'SAIDA', rotulo: 'Saída' },
];
const rotuloDoTipo = (t: TipoDeLancamento) => (t === 'SAIDA' ? 'Saída' : 'Entrada');

/**
 * Lançamentos avulsos da consultoria (aluguel, equipamento, entrada que não vem de plano). Entram no "Resultado do mês
 * (entradas − saídas registradas)". Categoria é texto livre. Criar, editar e excluir exigem `FINANCEIRO_ALTERAR`; a
 * edição e a exclusão levam a versão vista, e um 409 recarrega a lista. O período (data do lançamento) fica na barra de
 * filtros, no endereço junto do `?aba=lancamentos` (`?de=&ate=`).
 */
export function AbaLancamentos({ podeAlterar }: { podeAlterar: boolean }) {
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<LancamentoResponse | 'novo' | null>(null);
  const filtros = lerLancamentosDoEndereco(useLocalSearchParams<{ de?: string; ate?: string }>());
  const { de, ate } = filtros.periodo;
  const lista = useCarregar(`lancamentos|${de ?? ''}|${ate ?? ''}|${pagina}`, () => listarLancamentos({ pagina, de: de ?? undefined, ate: ate ?? undefined }));
  const aplicar = (novos: FiltrosDeLancamentos) => {
    setPagina(0);
    router.setParams(paraSetParams(CHAVES_DE_LANCAMENTOS, lancamentosParaEndereco(novos)));
  };
  const filtrado = temPeriodo(filtros.periodo);
  const mes = periodoDoMes(hojeEmBrasilia());
  const resultado = useCarregar(`lancamentos-resultado|${mes.de}`, () => painelFinanceiro({ ...mes, meus: false }));
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const { recarregar: recarregarLista } = lista;
  const { recarregar: recarregarResultado } = resultado;
  const aoMudar = () => { recarregarLista(); recarregarResultado(); };
  useFocusEffect(useCallback(() => { recarregarLista(); recarregarResultado(); }, [recarregarLista, recarregarResultado]));

  return (
    <View style={estilos.coluna}>
      <View style={estilos.topo}>
        <Texto variante="suave" style={estilos.explicacao}>Entradas e saídas da consultoria que não vêm do plano de um aluno, como aluguel e equipamentos.</Texto>
        {podeAlterar ? <Botao rotulo="Novo lançamento" Icone={Plus} aoTocar={() => setAberto('novo')} /> : null}
      </View>
      {resultado.erro ? <MensagemErro texto={textoDoErro(resultado.erro)} erro={resultado.erro} tentarDeNovo={recarregarResultado} /> : null}
      {resultado.dados ? <ResultadoDoMes resultado={resultado.dados.resultadoDoMes} /> : null}
      <BarraDeFiltros valor={filtros} aoAplicar={aplicar} limpo={SEM_FILTROS_DE_LANCAMENTOS} chips={chipsDosLancamentos(filtros)}
        aoTirar={() => aplicar(SEM_FILTROS_DE_LANCAMENTOS)} rotuloDoResultado="Ver lançamentos"
        seletores={(atuais, mudar) => (
          <CelulaDoFiltro><CamposDePeriodo rotulo="Data do lançamento" valor={atuais.periodo} aoMudar={(periodo) => mudar({ periodo })} /></CelulaDoFiltro>
        )} />
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregarLista} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        filtrado ? <Vazio titulo="Nenhum lançamento nesse período" texto="Tente outras datas." acao={{ rotulo: 'Limpar filtros', aoTocar: () => aplicar(SEM_FILTROS_DE_LANCAMENTOS) }} />
          : <Vazio titulo="Nenhum lançamento" texto={podeAlterar ? 'Toque em Novo lançamento para registrar a primeira entrada ou saída.' : 'Os lançamentos registrados pela equipe aparecem aqui.'} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={`${dados.total} ${dados.total === 1 ? 'lançamento' : 'lançamentos'}, do mais recente ao mais antigo. Toque na linha para abrir.`}>
          <View style={lista.carregando ? estilos.esmaecido : null}>
            <ListaOuTabela rotulo="Lançamentos avulsos" linhas={dados.itens} chave={(l) => l.id} aoTocar={setAberto}
              rotuloDaLinha={(l) => `Abrir lançamento ${l.descricao}`}
              // Entrada e saída não são status: vão no texto, sem selo colorido.
              item={(l) => ({
                titulo: l.descricao,
                detalhe: `${rotuloDoTipo(l.tipo)} de ${centavosParaTela(l.valorCentavos)} · ${dataSemAnoCorrente(l.data, hojeEmBrasilia())}${l.categoria ? ` · ${l.categoria}` : ''}`,
              })}
              colunas={[
                { chave: 'descricao', titulo: 'Descrição', flex: 2, principal: true, render: (l) => <Texto variante="bloco" numberOfLines={2}>{l.descricao}</Texto> },
                { chave: 'data', titulo: 'Data', flex: 1, render: (l) => <Texto numerico>{dataParaTela(l.data)}</Texto> },
                { chave: 'tipo', titulo: 'Tipo', flex: 1, render: (l) => <Texto>{rotuloDoTipo(l.tipo)}</Texto> },
                { chave: 'categoria', titulo: 'Categoria', flex: 1.2, render: (l) => <Texto numberOfLines={1}>{l.categoria ?? '—'}</Texto> },
                { chave: 'valor', titulo: 'Valor', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{centavosParaTela(l.valorCentavos)}</Texto> },
              ]} />
          </View>
          {paginas > 1 ? (
            <View style={estilos.paginacao}>
              <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
              <Texto variante="suave">Página {pagina + 1} de {paginas}</Texto>
              <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      <FolhaDoLancamento alvo={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={aoMudar} />
    </View>
  );
}

function FolhaDoLancamento({ alvo, podeAlterar, aoFechar, aoMudar }: {
  alvo: LancamentoResponse | 'novo' | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  if (!alvo) return null;
  return <Formulario key={alvo === 'novo' ? 'novo' : `${alvo.id}:${alvo.versao}`} lancamento={alvo === 'novo' ? null : alvo}
    podeAlterar={podeAlterar} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

function Formulario({ lancamento, podeAlterar, aoFechar, aoMudar }: {
  lancamento: LancamentoResponse | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoDeLancamento>(lancamento?.tipo ?? 'SAIDA');
  const [data, setData] = useState(dataParaTela(lancamento?.data ?? hojeEmBrasilia()));
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '');
  const [valor, setValor] = useState(centavosParaCampo(lancamento?.valorCentavos));
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? '');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [excluindo, setExcluindo] = useState(false);

  const iso = dataDaTela(data);
  const centavos = centavosDaTela(valor);
  const problema = validarLancamento({ data: iso ?? null, descricao, valorCentavos: centavos, categoria });

  const terminar = (mensagem: string) => {
    setEnviando(false);
    avisar(mensagem, 'sucesso');
    aoMudar();
    aoFechar();
  };
  const falhar = (e: unknown) => {
    setEnviando(false);
    if (ehConflito(e)) {
      setExcluindo(false);
      avisar(avisoDeConflito('O lançamento foi alterado'), 'neutro');
      aoMudar();
      aoFechar();
      return;
    }
    setErro(e);
  };

  const salvar = () => {
    setTentou(true);
    if (problema || !iso || centavos === null) return;
    setEnviando(true);
    setErro(null);
    const corpo = { data: iso, descricao: descricao.trim(), valorCentavos: centavos, tipo, categoria: categoria.trim() || null, versao: lancamento?.versao ?? null };
    (lancamento ? alterarLancamento(lancamento.id, corpo) : criarLancamento(corpo)).then(
      () => terminar(lancamento ? 'Lançamento salvo.' : 'Lançamento registrado.'),
      falhar,
    );
  };

  const excluir = () => {
    if (!lancamento) return;
    setEnviando(true);
    setErro(null);
    excluirLancamento(lancamento.id, lancamento.versao).then(() => terminar('Lançamento excluído.'), falhar);
  };

  return (
    <Folha visivel titulo={lancamento ? (podeAlterar ? 'Editar lançamento' : 'Lançamento') : 'Novo lançamento'} aoFechar={aoFechar}
      rodape={podeAlterar ? (
        <LinhaDeAcoes alinhar="fim">
          {lancamento ? <Botao rotulo="Excluir" tipo="perigoTexto" aoTocar={() => { setErro(null); setExcluindo(true); }} desabilitado={enviando} /> : null}
          <Botao rotulo={lancamento ? 'Salvar lançamento' : 'Registrar lançamento'} aoTocar={salvar} carregando={enviando} />
        </LinhaDeAcoes>
      ) : undefined}>
      <View style={{ gap: espaco(1.5) }}>
        {podeAlterar ? (
          <>
            <Escolha rotulo="Tipo" opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />
            <CampoData rotulo="Data" valor={data} aoMudar={setData} erro={tentou && !iso ? 'Informe a data do lançamento.' : null} />
            <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} maxLength={LIMITES.descricaoDoLancamento}
              erro={tentou && !descricao.trim() ? 'Descreva o lançamento.' : null} />
            <CampoMoeda rotulo="Valor (R$)" texto={valor} aoMudar={setValor}
              erro={tentou && centavos === null ? 'Informe um valor maior que zero, por exemplo 150,00.' : null} />
            <Campo rotulo="Categoria (opcional)" valor={categoria} aoMudar={setCategoria} maxLength={LIMITES.categoria}
              ajuda="Texto livre, por exemplo Aluguel ou Equipamentos." />
          </>
        ) : lancamento ? (
          <>
            <CampoLeitura rotulo="Descrição" valor={lancamento.descricao} />
            <CamposEmLinha>
              <CampoLeitura rotulo="Tipo" valor={rotuloDoTipo(lancamento.tipo)} />
              <CampoLeitura rotulo="Valor" valor={centavosParaTela(lancamento.valorCentavos)} numerico />
              <CampoLeitura rotulo="Data" valor={dataParaTela(lancamento.data)} numerico />
              <CampoLeitura rotulo="Categoria" valor={lancamento.categoria} />
            </CamposEmLinha>
          </>
        ) : null}
        {tentou && problema && iso && descricao.trim() && centavos !== null ? <MensagemErro texto={problema} /> : null}
        {erro && !excluindo ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={excluindo} titulo="Excluir este lançamento?"
        mensagem="O lançamento sai das contas do resultado do mês. Esta ação não pode ser desfeita."
        rotuloConfirmar="Excluir lançamento" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={excluir} aoCancelar={() => setExcluindo(false)}>
        {erro && excluindo ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  explicacao: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  esmaecido: { opacity: 0.6 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
