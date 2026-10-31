import { Permitido } from '../ui/Permitido';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPeso, pesosDoAluno, registrarPeso } from '../api/rotas';
import type { RegistroPeso } from '../api/tipos';
import { dataCurta, dataDaTela, dataParaTela, hojeIso, numeroParaTela } from '../dominio/formatos';
import { avisoDoGrafico } from '../dominio/progresso';
import { variacoesDoPeso } from '../dominio/variacaoDoPeso';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { SeloDaFase, useCicloNoPeso } from './ciclo/CicloNaFicha';
import { LegendaDaVariacao, VariacaoDoPeso } from './VariacaoDoPeso';
import { Abas } from '../ui/Abas';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico, Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { GraficoLinha } from '../ui/GraficoLinha';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Tabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const LINHAS_INICIAIS = 12;

/** Registros de peso do aluno (dado sensível: só na tela, nunca em log). */
export function CartaoPeso({ alunoId }: { alunoId: string }) {
  const { cores, preferencias, escolherPreferencia } = useTema();
  const ciclo = useCicloNoPeso(alunoId);
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar, definir } = useCarregar(`peso:${alunoId}`, () => pesosDoAluno(alunoId));
  const [data, setData] = useState(dataParaTela(hojeIso()));
  const [peso, setPeso] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<unknown>(null);
  const [excluir, setExcluir] = useState<RegistroPeso | null>(null);
  const [visao, setVisao] = useState<'lista' | 'grafico'>('lista');
  const campos = errosPorCampo(erroSalvar);
  const dataIso = dataDaTela(data);

  const [registrando, setRegistrando] = useState(false);
  const fecharRegistro = () => { setRegistrando(false); setErroSalvar(null); };
  const adicionar = () => {
    if (!dataIso || peso === null) return;
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

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    excluirPeso(alunoId, alvo.id).then(recarregar, (e: unknown) => setErroSalvar(e));
  };

  // Não depende da ordem da API (hoje, do mais novo para o mais antigo): `cronologico` é do mais antigo ao mais novo
  // (eixo do gráfico, pela data); a tabela mostra o mais recente primeiro. Sem numeração: "Atual. N" parecia o número
  // da atualização e não é.
  const cronologico = [...(dados ?? [])].sort((a, b) => a.data.localeCompare(b.data));
  const lista = [...cronologico].reverse();
  const [todos, setTodos] = useState(false);
  const comGrafico = preferencias.graficos && visao === 'grafico' && !!dados && dados.length > 1;
  const comTabela = !comGrafico;
  const visiveis = todos ? lista : lista.slice(0, LINHAS_INICIAIS);
  // A11: a variação diz contra quando ("desde 12/10"), a partir da lista inteira recebida, não só das linhas visíveis.
  const variacoes = variacoesDoPeso(dados ?? []);
  const algumaVariacao = visiveis.some((p) => variacoes[p.id]);

  return (
    <Cartao titulo="Peso" descricao="Evolução do peso ao longo do tempo."
      acoes={pode('ALUNO_SENSIVEL_ALTERAR') ? <Botao rotulo="Registrar peso" tipo="secundario" Icone={Plus} aoTocar={() => setRegistrando(true)} /> : null}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhum registro de peso.</Texto> : null}
      {dados && avisoDoGrafico(dados.length, preferencias.graficos) ? <Texto variante="suave">{avisoDoGrafico(dados.length, preferencias.graficos)}</Texto> : null}
      {preferencias.graficos && dados && dados.length > 1 ? (
        <Abas abas={[{ valor: 'lista', rotulo: 'Lista' }, { valor: 'grafico', rotulo: 'Gráfico' }]} ativa={visao} aoMudar={setVisao} />
      ) : null}
      {ciclo.ativo ? (
        <Interruptor rotulo="Mostrar fases do ciclo" valor={preferencias.mostrarFasesDoCiclo}
          aoMudar={(mostrarFasesDoCiclo) => escolherPreferencia({ mostrarFasesDoCiclo })} />
      ) : null}
      {comGrafico ? (
        <GraficoLinha
          pontos={cronologico.map((p) => ({ rotulo: dataCurta(p.data), valor: p.pesoKg, data: p.data }))}
          unidade="kg"
          descricao={`Gráfico de peso com ${dados.length} registros`}
          faixas={ciclo.ativo && preferencias.mostrarFasesDoCiclo ? ciclo.faixasDe(cronologico[0].data, cronologico[cronologico.length - 1].data) : undefined}
        />
      ) : null}
      {comTabela && lista.length > 0 ? (
        <Tabela
          rotulo="Registros de peso"
          linhas={visiveis}
          chave={(p) => p.id}
          colunas={[
            { chave: 'data', titulo: 'Data', flex: 1.2, principal: true, render: (p) => {
              const fase = ciclo.ativo && preferencias.mostrarFasesDoCiclo ? ciclo.selo(p.data) : null;
              return <View style={{ gap: 4 }}><Texto numerico style={estilos.negrito}>{dataParaTela(p.data)}</Texto>{fase ? <SeloDaFase texto={fase} /> : null}</View>;
            } },
            { chave: 'peso', titulo: 'Peso', render: (p) => <Texto numerico style={estilos.negrito}>{numeroParaTela(p.pesoKg)} kg</Texto> },
            {
              chave: 'variacao', titulo: 'Variação',
              render: (p) => <VariacaoDoPeso variacao={variacoes[p.id] ?? null} />,
            },
            { chave: 'obs', titulo: 'Obs', flex: 1.4, render: (p) => <Texto variante="suave" numberOfLines={2}>{p.observacao || '—'}</Texto> },
            {
              chave: 'acao', titulo: 'Excluir', largura: 44, acao: true,
              render: (p) => <Permitido codigo="ALUNO_SENSIVEL_ALTERAR"><IconeBotao Icone={Trash2} rotulo={`Excluir peso de ${dataParaTela(p.data)}`} cor={cores.textoSuave} aoTocar={() => setExcluir(p)} /></Permitido>,
            },
          ]}
        />
      ) : null}
      {comTabela && algumaVariacao ? <LegendaDaVariacao /> : null}
      {comTabela && lista.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todos ? 'Mostrar só os últimos' : `Mostrar todos (${lista.length})`} tipo="fantasma" aoTocar={() => setTodos((v) => !v)} />
      ) : null}
      {erroSalvar && !registrando ? <MensagemErro texto={textoDoErro(erroSalvar)} /> : null}
      {registrando ? (
        <Folha visivel titulo="Registrar peso" aoFechar={fecharRegistro} rodape={<>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fecharRegistro} />
          <Botao rotulo="Registrar" carregando={salvando} desabilitado={!dataIso || peso === null} motivo={!dataIso ? 'Informe uma data válida.' : 'Informe o peso.'} aoTocar={adicionar} />
        </>}>
          <View style={estilos.form}>
            <View style={estilos.campoData}>
              <CampoData rotulo="Data" valor={data} aoMudar={setData} erro={campos.data} />
            </View>
            <View style={estilos.campo}>
              <CampoNumerico rotulo="Peso" sufixo="kg" valor={peso} aoMudar={setPeso} erro={campos.pesoKg} />
            </View>
          </View>
          <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} />
          {erroSalvar && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erroSalvar)} /> : null}
        </Folha>
      ) : null}
      <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir este registro de peso?"
        mensagem={excluir ? `${dataParaTela(excluir.data)} · ${numeroParaTela(excluir.pesoKg)} kg` : undefined}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  negrito: { fontFamily: fontes.negrito },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campoData: { width: 190 },
  campo: { width: 150 },
});
