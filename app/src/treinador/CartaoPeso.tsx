import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPeso, pesosDoAluno, registrarPeso } from '../api/rotas';
import type { RegistroPeso } from '../api/tipos';
import { dataDaTela, dataParaTela, hojeIso, numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { GraficoLinha } from '../ui/GraficoLinha';
import { IconeBotao } from '../ui/IconeBotao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/** Variação com sinal ("+0,5 kg", "−1 kg"). Só a diferença para o registro anterior; nenhuma avaliação. */
function variacao(v: number | null): string {
  if (v === null) return '—';
  if (v === 0) return '0 kg';
  return `${v > 0 ? '+' : '−'}${numeroParaTela(Math.abs(v))} kg`;
}

const LINHAS_INICIAIS = 12;

/** Registros de peso do aluno (dado sensível: só na tela, nunca em log). */
export function CartaoPeso({ alunoId }: { alunoId: string }) {
  const { cores } = useTema();
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

  const adicionar = () => {
    if (!dataIso || peso === null) return;
    setSalvando(true);
    setErroSalvar(null);
    registrarPeso(alunoId, { data: dataIso, pesoKg: peso, observacao: observacao.trim() || null }).then(
      (lista) => {
        setSalvando(false);
        setPeso(null);
        setObservacao('');
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
  // (gráfico e numeração "Atual. N"); a tabela mostra o mais recente primeiro.
  const cronologico = [...(dados ?? [])].sort((a, b) => a.data.localeCompare(b.data));
  const lista = cronologico.map((p, i) => ({ ...p, numero: i + 1 })).reverse();
  const [todos, setTodos] = useState(false);
  const comTabela = visao === 'lista' || !dados || dados.length < 2;
  const visiveis = todos ? lista : lista.slice(0, LINHAS_INICIAIS);

  return (
    <Cartao titulo="Peso">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhum registro de peso.</Texto> : null}
      {dados && dados.length > 1 ? (
        <Abas abas={[{ valor: 'lista', rotulo: 'Lista' }, { valor: 'grafico', rotulo: 'Gráfico' }]} ativa={visao} aoMudar={setVisao} />
      ) : null}
      {visao === 'grafico' && dados && dados.length > 1 ? (
        <GraficoLinha
          pontos={cronologico.map((p, i) => ({ rotulo: `Atual. ${i + 1}`, valor: p.pesoKg }))}
          unidade="kg"
          descricao={`Gráfico de peso com ${dados.length} registros`}
        />
      ) : null}
      {comTabela && lista.length > 0 ? (
        <View style={[estilos.tabela, { borderColor: cores.borda }]}>
          <View style={[estilos.linha, estilos.cabecalho, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
            <Texto variante="secao" style={[estilos.cNumero, estilos.centro]}>Atual.</Texto>
            <Texto variante="secao" style={estilos.cData}>Data</Texto>
            <Texto variante="secao" style={estilos.cPeso}>Peso</Texto>
            <Texto variante="secao" style={estilos.cVariacao}>Variação</Texto>
            <Texto variante="secao" style={estilos.cObs}>Obs</Texto>
            <View style={estilos.cAcao} />
          </View>
          {visiveis.map((p, i) => (
            <View key={p.id} style={[estilos.linha, i < visiveis.length - 1 && { borderColor: cores.borda, borderBottomWidth: 1 }]}>
              <Texto numerico style={[estilos.cNumero, estilos.centro]}>{p.numero}</Texto>
              <Texto numerico style={estilos.cData}>{dataParaTela(p.data)}</Texto>
              <Texto numerico style={[estilos.cPeso, estilos.negrito]}>{numeroParaTela(p.pesoKg)} kg</Texto>
              <Texto
                numerico
                style={[estilos.cVariacao, estilos.negrito, { color: p.variacao === null || p.variacao === 0 ? cores.textoSuave : p.variacao > 0 ? cores.perigo : cores.sucesso }]}>
                {variacao(p.variacao)}
              </Texto>
              <Texto variante="suave" style={estilos.cObs} numberOfLines={2}>{p.observacao || '—'}</Texto>
              <View style={estilos.cAcao}>
                <IconeBotao Icone={Trash2} rotulo={`Excluir peso de ${dataParaTela(p.data)}`} cor={cores.perigo} aoTocar={() => setExcluir(p)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {comTabela && lista.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todos ? 'Mostrar só os últimos' : `Mostrar todos (${lista.length})`} tipo="fantasma" aoTocar={() => setTodos((v) => !v)} />
      ) : null}
      <View style={estilos.form}>
        <View style={estilos.campo}>
          <CampoData rotulo="Data" valor={data} aoMudar={setData} erro={campos.data} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Peso" sufixo="kg" valor={peso} aoMudar={setPeso} erro={campos.pesoKg} />
        </View>
        <View style={estilos.campoLargo}>
          <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} />
        </View>
      </View>
      {erroSalvar && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erroSalvar)} /> : null}
      <View style={estilos.botoes}>
        <Botao rotulo="Adicionar peso" tipo="secundario" carregando={salvando} desabilitado={!dataIso || peso === null} aoTocar={adicionar} />
      </View>
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
  tabela: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), minHeight: 48 },
  cabecalho: { borderBottomWidth: 1, minHeight: 40 },
  cNumero: { width: 52 },
  cData: { flex: 1.2, minWidth: 84 },
  cPeso: { flex: 1, minWidth: 70 },
  cVariacao: { flex: 1, minWidth: 70 },
  cObs: { flex: 1.4, minWidth: 40 },
  cAcao: { width: 44, alignItems: 'center' },
  centro: { textAlign: 'center' },
  negrito: { fontFamily: fontes.negrito },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { width: 150 },
  campoLargo: { flex: 1, minWidth: 200 },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
