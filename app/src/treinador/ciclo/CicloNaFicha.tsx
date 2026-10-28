import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cicloDoAluno, consultoria, listarPastas } from '../../api/rotas';
import type { DiaDeCicloApi } from '../../api/tipos';
import {
  contarSintomas, faseNaData, fasesNoPeriodo, hojeDoCiclo, menstruacaoPrevista, ROTULO_DA_COLICA, ROTULO_DA_FASE, ROTULO_DO_FLUXO,
  ROTULO_DO_SINTOMA, textoDaContagem, textoDaLeitura, type ConfigDoCiclo, type FaixaDoGrafico,
} from '../../dominio/cicloMenstrual';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CalendarioDoCiclo, mesSeguinte, rotuloDoMes } from '../../ui/CalendarioDoCiclo';
import { Cartao } from '../../ui/Cartao';
import { FaixaDoCiclo, corDaFase } from '../../ui/FaixaDoCiclo';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export function useCicloDoTreinador(alunoId: string | null | undefined) {
  const { pode, cicloHabilitado } = useSessao();
  // Módulo desligado na plataforma: nada é consultado e tudo o que depende do ciclo some.
  const ver = cicloHabilitado && !!alunoId && pode('ALUNO_LER') && pode('ALUNO_SENSIVEL_LER');
  const carga = useCarregar(ver ? `ciclo-treinador:${alunoId}` : null, () => cicloDoAluno(alunoId!));
  // Chave desligada (inclusive depois de um 503 do módulo desligado): o que foi carregado antes não vale mais.
  const dados = ver ? carga.dados : undefined;
  return { ...carga, dados, ver, ativo: dados?.ativo === true };
}

function configDe(dados: { duracaoHabitual: number | null; mostrarFases: boolean | null }): ConfigDoCiclo {
  return { duracaoHabitual: dados.duracaoHabitual, mostrarFases: dados.mostrarFases !== false, hoje: hojeDoCiclo() };
}

/** Linha da ficha. Some com o acompanhamento desligado ou sem permissão de dado sensível. */
export function LinhaDoCicloNaFicha({ alunoId }: { alunoId: string }) {
  const ciclo = useCicloDoTreinador(alunoId);
  const [aberto, setAberto] = useState(false);
  if (!ciclo.ativo || !ciclo.dados) return null;
  const config = configDe(ciclo.dados);
  const leitura = faseNaData(ciclo.dados.registros, config, config.hoje);
  return (
    <View style={estilos.linha}>
      <Texto>Ciclo menstrual: acompanhamento ligado pela aluna</Texto>
      <Texto>{textoDaLeitura(leitura)}</Texto>
      <Botao rotulo="Ver ciclo" tipo="secundario" aoTocar={() => setAberto(true)} />
      {aberto ? <FolhaDoCiclo alunoId={alunoId} aoFechar={() => setAberto(false)} /> : null}
    </View>
  );
}

/** Folha só de leitura: calendário, histórico e o dia tocado. O treinador não grava. */
export function FolhaDoCiclo({ alunoId, aoFechar }: { alunoId: string; aoFechar: () => void }) {
  const ciclo = useCicloDoTreinador(alunoId);
  const hoje = hojeDoCiclo();
  const [mes, setMes] = useState(`${hoje.slice(0, 8)}01`);
  const [dia, setDia] = useState<string | null>(null);
  const dados = ciclo.dados;
  if (!dados?.ativo) return null;
  const config = configDe(dados);
  const escolhido = dia ? dados.dias.find((d) => d.data === dia) : undefined;
  return (
    <Folha visivel titulo="Ciclo menstrual" aoFechar={aoFechar}>
      <Texto variante="suave">Só leitura. Quem registra é a aluna.</Texto>
      <View style={estilos.mes}>
        <Botao rotulo="Mês anterior" tipo="secundario" aoTocar={() => setMes(mesSeguinte(mes, -1))} />
        <Texto>{rotuloDoMes(mes)}</Texto>
        <Botao rotulo="Próximo mês" tipo="secundario" aoTocar={() => setMes(mesSeguinte(mes, 1))} />
      </View>
      <CalendarioDoCiclo mes={mes} registros={dados.registros} dias={dados.dias} config={config} aoTocarDia={setDia} />
      {dia ? <DiaLido data={dia} dia={escolhido ?? null} /> : null}
      <Texto variante="secao">Histórico</Texto>
      {dados.registros.length === 0 ? <Texto variante="suave">—</Texto> : dados.registros.map((r) => (
        <Texto key={r.id} numerico>{dataParaTela(r.inicio)} a {r.fim ? dataParaTela(r.fim) : 'em andamento'}</Texto>
      ))}
    </Folha>
  );
}

function DiaLido({ data, dia }: { data: string; dia: DiaDeCicloApi | null }) {
  const sintomas = (dia?.sintomas ?? []).map((s) => ROTULO_DO_SINTOMA[s] ?? s).join(', ');
  return (
    <View style={estilos.linha}>
      <Texto variante="rotulo">{dataParaTela(data)}</Texto>
      <Texto>Fluxo: {dia?.fluxo ? ROTULO_DO_FLUXO[dia.fluxo] ?? '—' : '—'}</Texto>
      <Texto>Cólica: {dia?.colica ? ROTULO_DA_COLICA[dia.colica] ?? '—' : '—'}</Texto>
      <Texto>Sintomas: {sintomas || '—'}</Texto>
      <Texto>Observação: {dia?.observacao?.trim() || '—'}</Texto>
    </View>
  );
}

/** Faixa na pasta e nos editores do plano do aluno. Não entra no modelo do Planejamento. */
export function CartaoCicloNoPeriodo({ alunoId, inicio, fim }: { alunoId: string; inicio: string | null; fim: string | null }) {
  const ciclo = useCicloDoTreinador(alunoId);
  const textos = useCarregar(ciclo.ativo ? 'textos-fases' : null, () => consultoria());
  if (!inicio || !fim || !ciclo.ativo || !ciclo.dados) return null;
  const config = configDe(ciclo.dados);
  const faixas = fasesNoPeriodo(ciclo.dados.registros, config, inicio, fim);
  const prevista = menstruacaoPrevista(ciclo.dados.registros, config);
  const texto = prevista
    ? `Menstruação prevista: ${dataParaTela(prevista.inicio)}${prevista.fim ? ` a ${dataParaTela(prevista.fim)}` : ''} (estimativa)`
    : null;
  return (
    <Cartao titulo="Ciclo no período da pasta" recolhivel>
      <FaixaDoCiclo faixas={faixas} de={inicio} ate={fim} textos={textos.dados?.textosFasesCiclo} previsto={texto} />
    </Cartao>
  );
}

/** Faixas do gráfico de peso e o selo de cada data. Só com o acompanhamento ligado. */
export function useCicloNoPeso(alunoId: string) {
  const { cores } = useTema();
  const ciclo = useCicloDoTreinador(alunoId);
  const dados = ciclo.ativo ? ciclo.dados : null;
  const config = dados ? configDe(dados) : null;
  const faixasDe = (de: string, ate: string): FaixaDoGrafico[] => {
    if (!dados || !config) return [];
    return fasesNoPeriodo(dados.registros, config, de, ate).map((f) => ({
      de: f.de, ate: f.ate, tom: corDaFase(cores, f.fase),
      rotulo: `${ROTULO_DA_FASE[f.fase]}${f.estimada ? ' (estimativa)' : ''}`,
    }));
  };
  const selo = (data: string) => {
    if (!dados || !config) return null;
    const leitura = faseNaData(dados.registros, config, data);
    if (leitura.diaDoCiclo == null) return null;
    if (!leitura.fase) return `dia ${leitura.diaDoCiclo}`;
    return `${ROTULO_DA_FASE[leitura.fase]} · dia ${leitura.diaDoCiclo}`;
  };
  return { ativo: ciclo.ativo, faixasDe, selo };
}

/** Linha da atualização: fase na data e contagem de sintomas no período da pasta. */
export function LinhaDoCicloNaAtualizacao({ alunoId, pastaId, data }: { alunoId: string; pastaId: string | null; data: string | null }) {
  const ciclo = useCicloDoTreinador(alunoId);
  const pastas = useCarregar(ciclo.ativo && pastaId ? `pastas-ciclo:${alunoId}` : null, () => listarPastas(alunoId));
  if (!ciclo.ativo || !ciclo.dados || !data) return null;
  const config = configDe(ciclo.dados);
  const leitura = faseNaData(ciclo.dados.registros, config, data);
  const pasta = pastas.dados?.find((p) => p.id === pastaId);
  const contagem = pasta?.inicio && pasta.fim ? textoDaContagem(contarSintomas(ciclo.dados.dias, pasta.inicio, pasta.fim)) : null;
  return (
    <View style={estilos.linha}>
      <Texto>Ciclo na data: {textoDaLeitura(leitura)}</Texto>
      {contagem ? <Texto>Sintomas no período da pasta: {contagem}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { gap: espaco(0.5) },
  mes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
});

export function SeloDaFase({ texto }: { texto: string }) {
  return <Selo texto={texto} tipo="neutro" />;
}
