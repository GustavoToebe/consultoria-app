import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPeso, pesosDoAluno, registrarPeso } from '../api/rotas';
import type { RegistroPeso } from '../api/tipos';
import { dataDaTela, dataParaTela, hojeIso, numeroParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
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

  // A API devolve em ordem de data; a tela mostra o mais recente primeiro.
  const lista = [...(dados ?? [])].reverse();

  return (
    <Cartao titulo="Peso">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhum registro de peso.</Texto> : null}
      {lista.slice(0, 12).map((p) => (
        <View key={p.id} style={[estilos.linha, { borderColor: cores.borda }]}>
          <Texto style={estilos.data}>{dataParaTela(p.data)}</Texto>
          <Texto style={estilos.peso}>{numeroParaTela(p.pesoKg)} kg</Texto>
          <Texto variante="suave" style={estilos.variacao}>{variacao(p.variacao)}</Texto>
          <Texto variante="suave" style={estilos.obs} numberOfLines={2}>{p.observacao ?? ''}</Texto>
          <IconeBotao Icone={Trash2} rotulo={`Excluir peso de ${dataParaTela(p.data)}`} cor={cores.perigo} aoTocar={() => setExcluir(p)} />
        </View>
      ))}
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
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderBottomWidth: 1, paddingVertical: 2 },
  data: { width: 92 },
  peso: { width: 80 },
  variacao: { width: 72 },
  obs: { flex: 1 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campo: { width: 150 },
  campoLargo: { flex: 1, minWidth: 200 },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
