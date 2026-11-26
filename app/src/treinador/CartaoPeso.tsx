import { Permitido } from '../ui/Permitido';
import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { excluirPeso, pesosAluno, pesosDoAluno, registrarPeso } from '../api/rotas';
import type { RegistroPeso } from '../api/tipos';
import { dataDaTelaNaFaixa } from '../dominio/datasValidas';
import { dataParaTela, hojeIso } from '../dominio/formatos';
import { periodoDesdeOPrimeiro } from '../dominio/historicoDoAluno';
import { linhaDaMeta } from '../dominio/metaDoPesoNaFicha';
import { avisoDoGrafico } from '../dominio/progresso';
import { corDoTom } from '../dominio/corDaVariacaoDoPeso';
import { escalaDoPeso, legendaDaEscala, linhaDoHistorico, pesoComCasas, pontosDoPeso, variacaoFalada } from '../dominio/resumoDoPeso';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { SeloDaFase, useCicloNoPeso } from './ciclo/CicloNaFicha';
import { ResumoDoPeso } from './peso/ResumoDoPeso';
import { SETA_DO_PESO, VariacaoDoPeso } from './VariacaoDoPeso';
import { Abas } from '../ui/Abas';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico, Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { GraficoLinha, type LinhaDaDica } from '../ui/GraficoLinha';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Tabela, type ColunaDaTabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { useDestaques } from '../ui/NumeroDeDestaque';
import { useCarregar } from '../ui/useCarregar';

const LINHAS_INICIAIS = 12;

/**
 * Registros de peso do aluno (dado sensível: só na tela, nunca em log nem no aparelho). Com `alunoId` é a ficha da
 * equipe (registrar e excluir com `ALUNO_SENSIVEL_ALTERAR`, fases do ciclo); sem ele, o Histórico do próprio aluno:
 * só leitura pela rota do aluno, sem observação e sem ciclo. Nos dois, a variação tem seta e sinal e a cor da meta
 * efetiva que vem em cada item da lista (o app não calcula a meta; sem meta ou `SEM_META`, sem cor). O peso em si é medida,
 * não resultado: vai no azul de indicador (cores-de-destaque D12), que nunca diz bom nem ruim, e o gráfico
 * acompanha a mesma cor. Ordem (peso-visual D3 a D6): resumo (último registro e desde o anterior, com a meta escrita),
 * Lista ou Gráfico (linha reta, sem área, escala com as pontas escritas) e, na Lista, o histórico com a observação da
 * equipe como detalhe do registro. Textos e contas vêm de `dominio/resumoDoPeso`.
 */
export function CartaoPeso({ alunoId }: { alunoId?: string }) {
  const { cores, preferencias, escolherPreferencia } = useTema();
  const azul = useDestaques().azul.cor;
  const daEquipe = alunoId !== undefined;
  const ciclo = useCicloNoPeso(alunoId);
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar, definir } = useCarregar(daEquipe ? `peso:${alunoId}` : 'pesos-aluno',
    () => (daEquipe ? pesosDoAluno(alunoId) : pesosAluno()));
  const podeGravar = daEquipe && pode('ALUNO_SENSIVEL_ALTERAR');
  // No Histórico, sem internet fica a frase curta dos outros cartões (o peso não é guardado no aparelho).
  const semConexao = !daEquipe && erro instanceof ErroApi && erro.semConexao;
  const [data, setData] = useState(dataParaTela(hojeIso()));
  const [peso, setPeso] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<unknown>(null);
  const [excluir, setExcluir] = useState<RegistroPeso | null>(null);
  const [visao, setVisao] = useState<'lista' | 'grafico'>('lista');
  const campos = errosPorCampo(erroSalvar);
  const dataIso = dataDaTelaNaFaixa(data, 'REGISTRO');

  const [registrando, setRegistrando] = useState(false);
  const fecharRegistro = () => { setRegistrando(false); setErroSalvar(null); };
  const adicionar = () => {
    if (!alunoId || !dataIso || peso === null) return;
    setSalvando(true);
    setErroSalvar(null);
    registrarPeso(alunoId, { data: dataIso, pesoKg: peso, observacao: observacao.trim() || null }).then(
      (lista) => {
        setSalvando(false);
        setPeso(null);
        setObservacao('');
        setRegistrando(false);
        definir(lista);
      },
      (e: unknown) => {
        setSalvando(false);
        setErroSalvar(e);
      },
    );
  };

  const abrirRegistro = () => { setErroSalvar(null); setRegistrando(true); };

  // Quando a linha excluída some, o foco ia ao `body` (a lixeira sai da tela): vai ao "Registrar peso" do cartão.
  const botaoRegistrar = useRef<View>(null);
  const focarQuandoSumir = useRef<string | null>(null);
  useEffect(() => {
    if (focarQuandoSumir.current === null || !dados || dados.some((p) => p.id === focarQuandoSumir.current)) return;
    focarQuandoSumir.current = null;
    botaoRegistrar.current?.focus?.();
  }, [dados]);

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    setErroSalvar(null);
    if (!alvo || !alunoId) return;
    focarQuandoSumir.current = alvo.id;
    // `recarregar` mantém os dados na tela e a visão escolhida; resumo, gráfico e diferenças saem da lista nova.
    excluirPeso(alunoId, alvo.id).then(
      () => { setErroSalvar(null); recarregar(); },
      (e: unknown) => { focarQuandoSumir.current = null; setErroSalvar(e); },
    );
  };

  // Não depende da ordem da API (hoje, do mais novo para o mais antigo): `cronologico` é do mais antigo ao mais novo
  // (eixo do gráfico, pela data); a tabela mostra o mais recente primeiro. Sem numeração: "Atual. N" parecia o número
  // da atualização e não é.
  const registros = dados ?? [];
  const cronologico = [...registros].sort((a, b) => a.data.localeCompare(b.data));
  const lista = [...cronologico].reverse();
  const [todos, setTodos] = useState(false);
  // Um registro já tem gráfico: só o ponto, sem linha nem variação inventada (D5, como a Evolução por medida).
  const comAbas = preferencias.graficos && registros.length > 0;
  const comGrafico = comAbas && visao === 'grafico';
  const comTabela = !comGrafico;
  const visiveis = todos ? lista : lista.slice(0, LINHAS_INICIAIS);
  // A11: a variação diz contra quando ("desde 12/10"), a partir da lista inteira recebida, não só das linhas visíveis.
  const historico = (p: RegistroPeso) => linhaDoHistorico(p, registros);
  // A meta efetiva é a mesma em todos os itens; serve só para a frase que explica as cores, com 2 registros ou mais
  // (quando há alguma variação para pintar).
  const meta = registros.find((p) => p.metaDoPeso)?.metaDoPeso;
  const fraseDaMeta = registros.length > 1 ? linhaDaMeta(meta, daEquipe ? 'equipe' : 'aluno') : null;
  // Só o aviso dos gráficos desligados: com um registro o gráfico mostra o ponto, então "pelo menos duas datas" não vale aqui.
  const aviso = registros.length > 0 && !preferencias.graficos ? avisoDoGrafico(registros.length, false, daEquipe ? 'TREINADOR' : 'ALUNO') : null;
  const maisRecente = lista[0]?.id;
  const colunas: ColunaDaTabela<RegistroPeso>[] = [
    { chave: 'data', titulo: 'Data', flex: 1.2, principal: true, render: (p) => {
      const fase = ciclo.ativo && preferencias.mostrarFasesDoCiclo ? ciclo.selo(p.data) : null;
      // Destaque suave da linha mais recente (D6) em texto, não em cor: a `Tabela` não pinta linha.
      return (
        <View style={estilos.data}>
          <Texto numerico style={estilos.negrito}>{dataParaTela(p.data)}</Texto>
          {p.id === maisRecente && lista.length > 1 ? <Texto variante="pequeno">Mais recente</Texto> : null}
          {fase ? <SeloDaFase texto={fase} /> : null}
        </View>
      );
    } },
    {
      chave: 'peso', titulo: 'Peso', alinhar: 'direita',
      render: (p) => <Texto numerico style={[estilos.negrito, estilos.direita]} cor={azul}>{pesoComCasas(p.pesoKg)} kg</Texto>,
    },
    { chave: 'variacao', titulo: 'Variação', flex: 1.2, alinhar: 'direita', render: (p) => <VariacaoDoPeso linha={historico(p)} direita /> },
  ];
  if (podeGravar) {
    colunas.push({
      chave: 'acao', titulo: 'Ações', largura: 64, acao: true, tituloNaTabela: true, alinhar: 'direita',
      render: (p) => <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><IconeBotao Icone={Trash2} rotulo={`Excluir peso de ${dataParaTela(p.data)}`} cor={cores.textoSuave} aoTocar={() => setExcluir(p)} /></Permitido>,
    });
  }
  // A observação é só da equipe (a rota do aluno a devolve nula) e vira detalhe do registro que a tem, sem coluna de "—".
  const comObservacao = daEquipe && visiveis.some((p) => p.observacao);
  const escala = escalaDoPeso(registros);
  // Balão: a mesma linha da coluna Variação (seta e número na cor da meta, "desde dd/mm" neutro) e o ponto em foco na
  // mesma cor; o primeiro registro e o 0,0 ficam neutros. A linha do gráfico continua no azul do peso.
  const registroDoPonto = (ponto: { data?: string; valor: number }) => cronologico.find((p) => p.data === ponto.data && p.pesoKg === ponto.valor);
  const dicaDoPonto = (ponto: { data?: string; valor: number }): LinhaDaDica[] => {
    const r = registroDoPonto(ponto);
    if (!r) return [`${pesoComCasas(ponto.valor)} kg`];
    const h = historico(r);
    const valor = `${dataParaTela(r.data)} · ${pesoComCasas(r.pesoKg)} kg`;
    if (!h.seta) return [valor, h.texto];
    const numero = [SETA_DO_PESO[h.seta], h.texto].filter(Boolean).join(' ');
    return [valor, { texto: numero, cor: corDoTom(h.tom, cores), depois: h.desde ? ` ${h.desde}` : '' }];
  };
  const faladoDoPonto = (ponto: { data?: string; valor: number }) => {
    const r = registroDoPonto(ponto);
    return r ? `${dataParaTela(r.data)}, ${pesoComCasas(r.pesoKg)} kg. ${variacaoFalada(historico(r))}` : `${pesoComCasas(ponto.valor)} kg`;
  };
  const corDoPontoEmFoco = (ponto: { data?: string; valor: number }) => {
    const r = registroDoPonto(ponto);
    return corDoTom(r ? historico(r).tom : 'neutro', cores);
  };
  const primeiro = cronologico[0];
  const ultimo = cronologico[cronologico.length - 1];
  const descricaoDoGrafico = cronologico.length === 1
    ? `Gráfico de peso com 1 registro, em ${dataParaTela(primeiro.data)}. O valor está na visão Lista.`
    : primeiro && ultimo
      ? `Gráfico de peso com ${cronologico.length} registros, de ${dataParaTela(primeiro.data)} a ${dataParaTela(ultimo.data)}. Os valores estão na visão Lista.`
      : 'Gráfico de peso';

  return (
    <Cartao titulo="Peso" periodo={dados ? periodoDesdeOPrimeiro(dados.map((p) => p.data)) : undefined} descricao={daEquipe ? 'Evolução do peso ao longo do tempo.' : 'Seus registros de peso, do mais recente ao mais antigo.'}
      acoes={podeGravar ? <Botao ref={botaoRegistrar} rotulo="Registrar peso" tipo="acao" Icone={Plus} aoTocar={abrirRegistro} /> : null}>
      {erro && !semConexao ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {semConexao ? <Texto variante="suave">Sem conexão.</Texto> : null}
      {!dados && carregando ? <Esqueleto texto="Carregando pesos" cartoes={1} /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhum registro de peso.</Texto> : null}
      {registros.length > 0 ? <ResumoDoPeso registros={registros} meta={meta} linhaDaMeta={fraseDaMeta} /> : null}
      {aviso ? <Texto variante="suave">{aviso}</Texto> : null}
      {comAbas ? (
        <Abas abas={[{ valor: 'lista', rotulo: 'Lista' }, { valor: 'grafico', rotulo: 'Gráfico' }]} ativa={visao} aoMudar={setVisao} />
      ) : null}
      {ciclo.ativo ? (
        <Interruptor rotulo="Mostrar fases do ciclo" valor={preferencias.mostrarFasesDoCiclo}
          aoMudar={(mostrarFasesDoCiclo) => escolherPreferencia({ mostrarFasesDoCiclo })} />
      ) : null}
      {comGrafico && escala && primeiro && ultimo ? (
        <GraficoLinha
          // Outro conjunto de registros monta o gráfico de novo: o ponto ativo é guardado por índice e não pode sobrar.
          key={registros.map((r) => r.id).join('|')}
          pontos={pontosDoPeso(registros)}
          unidade="kg"
          cor={azul}
          segmentos="retos"
          semArea
          destacarUltimo
          semUltimo
          escala={escala}
          legendaDaEscala={legendaDaEscala(escala)}
          textoDaDica={dicaDoPonto}
          faladoDaDica={faladoDoPonto}
          corDoPonto={corDoPontoEmFoco}
          descricao={descricaoDoGrafico}
          faixas={ciclo.ativo && preferencias.mostrarFasesDoCiclo ? ciclo.faixasDe(primeiro.data, ultimo.data) : undefined}
        />
      ) : null}
      {comTabela && lista.length > 0 ? (
        <Tabela
          rotulo="Registros de peso"
          linhas={visiveis}
          chave={(p) => p.id}
          colunas={colunas}
          detalhe={comObservacao ? (p) => (p.observacao ? <Texto variante="suave">Observação: {p.observacao}</Texto> : null) : undefined}
        />
      ) : null}
      {comTabela && lista.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todos ? 'Mostrar só os últimos' : `Mostrar todos (${lista.length})`} tipo="fantasma" aoTocar={() => setTodos((v) => !v)} />
      ) : null}
      {erroSalvar && !registrando ? <MensagemErro texto={textoDoErro(erroSalvar)} /> : null}
      {registrando && podeGravar ? (
        <Folha visivel titulo="Registrar peso" aoFechar={fecharRegistro} rodape={<>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fecharRegistro} />
          <Botao rotulo="Registrar" carregando={salvando} desabilitado={!dataIso || peso === null} motivo={!dataIso ? 'Informe uma data válida.' : 'Informe o peso.'} aoTocar={adicionar} />
        </>}>
          <View style={estilos.form}>
            <View style={estilos.campoData}>
              <CampoData rotulo="Data" nome="Data do peso" regra="REGISTRO" valor={data} aoMudar={setData} erro={campos.data} />
            </View>
            <View style={estilos.campo}>
              <CampoNumerico rotulo="Peso" sufixo="kg" valor={peso} aoMudar={setPeso} erro={campos.pesoKg} />
            </View>
          </View>
          <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300}
            ajuda="Só a equipe vê esta observação." />
          {erroSalvar && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erroSalvar)} /> : null}
        </Folha>
      ) : null}
      {podeGravar ? <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir este registro de peso?"
        mensagem={excluir ? `${dataParaTela(excluir.data)} · ${pesoComCasas(excluir.pesoKg)} kg` : undefined}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      /> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  negrito: { fontFamily: fontes.negrito },
  direita: { textAlign: 'right' },
  data: { gap: 4 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campoData: { width: 190 },
  campo: { width: 150 },
});
