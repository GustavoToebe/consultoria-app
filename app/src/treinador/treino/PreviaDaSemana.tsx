import { Info } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { ExercicioPlano, Modalidade, Receita } from '../../api/tipos';
import { DIAS_SEMANA, normalizarTreino } from '../../dominio/editorTreino';
import { COR_DA_MODALIDADE, nomeDaModalidade, ORDEM_DAS_MODALIDADES } from '../../dominio/exerciciosDaBiblioteca';
import { plural } from '../../dominio/formatos';
import { abaDaSemana, faixaDaSemana, sessaoInicial, type SessaoDaFaixa } from '../../dominio/listaDeSemanas';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { LegendaDasModalidades, MarcaDaModalidade } from '../biblioteca/ModalidadeDoExercicio';

/** Abaixo desta largura da prévia os 7 dias não cabem lado a lado (nomes de sessão em ~75 px): a faixa vira uma lista. */
const LARGURA_DA_FAIXA_EM_COLUNAS = 540;

const ehModalidade = (m: string | null): m is Modalidade => m !== null && m in COR_DA_MODALIDADE;

/**
 * A prévia da semana escolhida na folha "Usar semana de treino" (27/11): nome, descrição (uma vez só), a faixa da semana
 * (Seg a Dom, cada dia com o nome da sessão ou "Descanso" discreto; a sessão com exercício é um botão) e, embaixo, os
 * exercícios da sessão aberta (bolinha da modalidade, nome, séries e grupo, este lido da biblioteca). Estrutura sem
 * exercícios: só a faixa, sem nada que se toque, com o aviso de que as sessões vêm vazias. Só leitura: nada vai ao plano.
 */
export function PreviaDaSemana({ semana: r, gruposMusculares, colecao }: {
  semana: Receita;
  /** Grupo muscular por `exercicioId`, da biblioteca; sem a biblioteca, o grupo some da linha. */
  gruposMusculares: ReadonlyMap<string, string | null>;
  colecao: string | null;
}) {
  const conteudo = useMemo(() => normalizarTreino(r.conteudo), [r.conteudo]);
  const { cores } = useTema();
  const faixa = useMemo(() => faixaDaSemana(conteudo), [conteudo]);
  const estrutura = abaDaSemana(conteudo) === 'ESTRUTURAS';
  const [aberta, setAberta] = useState<number | null>(() => sessaoInicial(conteudo));
  const [largura, setLargura] = useState<number | null>(null);
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const emColunas = largura === null || largura >= LARGURA_DA_FAIXA_EM_COLUNAS;

  const sessao = aberta === null ? null : conteudo.sessoes[aberta] ?? null;
  const dia = sessao?.diaSemana ? DIAS_SEMANA[sessao.diaSemana - 1] : 'Sem dia fixo';
  const nomeDaAberta = aberta === null ? '' : [...faixa.dias.flatMap((d) => d.sessoes), ...faixa.semDia].find((s) => s.indice === aberta)?.nome ?? '';
  const modalidades = sessao ? ORDEM_DAS_MODALIDADES.filter((m) => sessao.exercicios.some((e) => e.modalidade === m)) : [];

  const celula = (s: SessaoDaFaixa, rotuloDoDia: string) => (
    <CelulaDaSessao key={s.indice} sessao={s} rotuloDoDia={rotuloDoDia} tocavel={!estrutura && s.abre} aberta={aberta === s.indice} aoTocar={() => setAberta(s.indice)} />
  );

  return (
    <View style={estilos.previa} onLayout={medir}>
      <View style={estilos.cabeca}>
        <Texto variante="bloco" nivel={3}>{r.nome}</Texto>
        {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
      </View>

      <View style={estilos.bloco}>
        <Texto variante="secao">Semana</Texto>
        {estrutura ? (
          <View style={estilos.aviso}>
            <Info size={16} color={cores.textoSuave} aria-hidden />
            <Texto variante="suave" style={estilos.textoDoAviso}>Só a estrutura: as sessões vêm vazias.</Texto>
          </View>
        ) : null}
        <View role="list" aria-label="Dias da semana" style={emColunas ? estilos.faixaEmColunas : estilos.faixaEmLinhas}>
          {faixa.dias.map((d) => (
            <View key={d.dia} role="listitem" style={emColunas ? estilos.coluna : estilos.linhaDoDia}>
              <Texto variante="rotulo" style={emColunas ? undefined : estilos.diaNaLinha}>{d.curto}</Texto>
              <View style={emColunas ? estilos.sessoesDaColuna : estilos.sessoesDaLinha}>
                {d.sessoes.length ? d.sessoes.map((s) => celula(s, d.inteiro)) : <CelulaDeDescanso />}
              </View>
            </View>
          ))}
        </View>
        {faixa.semDia.length ? (
          <View style={estilos.semDia}>
            <Texto variante="rotulo">Sem dia fixo</Texto>
            <View style={estilos.sessoesSemDia}>{faixa.semDia.map((s) => celula(s, 'Sem dia fixo'))}</View>
          </View>
        ) : null}
      </View>

      {sessao && !estrutura ? (
        <View role="region" aria-label={`Exercícios de ${dia}, ${nomeDaAberta}`} style={estilos.bloco}>
          <Texto variante="secao">{`${dia} · ${nomeDaAberta}`}</Texto>
          <LegendaDasModalidades modalidades={modalidades} />
          <View role="list" aria-label="Exercícios da sessão" style={estilos.exercicios}>
            {sessao.exercicios.map((e) => <LinhaDoExercicio key={e.uid} exercicio={e} grupo={e.exercicioId ? gruposMusculares.get(e.exercicioId) ?? null : null} />)}
          </View>
        </View>
      ) : null}

      {colecao ? <Texto variante="pequeno">{`Coleção: ${colecao}`}</Texto> : null}
    </View>
  );
}

/**
 * Uma sessão na faixa. Tocável (tem exercício): botão com o estado `aria-pressed`, e a aberta tem o destaque do item ativo
 * (`superficie3` e a barrinha da marca, como a linha escolhida da lista). Não tocável (estrutura, descanso sem exercício):
 * só o texto, o descanso em `textoSuave`.
 */
function CelulaDaSessao({ sessao: s, rotuloDoDia, tocavel, aberta, aoTocar }: {
  sessao: SessaoDaFaixa; rotuloDoDia: string; tocavel: boolean; aberta: boolean; aoTocar: () => void;
}) {
  const { cores, marcaPeca } = useTema();
  const rotulo = `${rotuloDoDia}: ${s.nome}, ${plural(s.exercicios, 'exercício', 'exercícios')}`;
  const texto = <Texto variante="pequeno" numberOfLines={2} cor={s.descanso ? cores.textoSuave : undefined} style={aberta ? estilos.nomeAberto : undefined}>{s.nome}</Texto>;
  if (!tocavel) {
    return <View style={[estilos.celula, s.descanso ? null : { borderColor: cores.divisor }]}>{texto}</View>;
  }
  return (
    <Pressable role="button" aria-pressed={aberta} aria-label={rotulo} onPress={aoTocar}
      style={(estado) => [estilos.celula, { borderColor: cores.borda }, aberta ? { backgroundColor: cores.superficie3, borderColor: cores.superficie3 } : sobre(estado) ? { backgroundColor: cores.superficie2 } : null]}>
      {aberta ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      {texto}
    </Pressable>
  );
}

function CelulaDeDescanso() {
  const { cores } = useTema();
  return <View style={estilos.celula}><Texto variante="pequeno" cor={cores.textoSuave}>Descanso</Texto></View>;
}

/** "● Supino reto · 3 séries · Peitoral": a bolinha é só marca (a legenda fica acima e o nome acessível diz a modalidade). */
function LinhaDoExercicio({ exercicio: e, grupo }: { exercicio: ExercicioPlano; grupo: string | null }) {
  const series = e.series.length ? plural(e.series.length, 'série', 'séries') : 'sem séries';
  const modalidade = ehModalidade(e.modalidade) ? e.modalidade : null;
  const detalhe = [series, grupo].filter(Boolean).join(' · ');
  return (
    <View role="listitem" aria-label={[e.nome, series, grupo, modalidade ? nomeDaModalidade(modalidade) : null].filter(Boolean).join(', ')} style={estilos.exercicio}>
      <View style={estilos.marca}>{modalidade ? <MarcaDaModalidade modalidade={modalidade} /> : null}</View>
      <Texto style={estilos.nomeDoExercicio}>{e.nome}</Texto>
      <Texto variante="pequeno" numerico>{detalhe}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { gap: espaco(3) },
  cabeca: { gap: espaco(0.5) },
  bloco: { gap: espaco(1) },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  textoDoAviso: { flexShrink: 1 },
  faixaEmColunas: { flexDirection: 'row', gap: espaco(0.75) },
  faixaEmLinhas: { gap: espaco(0.5) },
  coluna: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  linhaDoDia: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  // Alinha o dia curto com o texto da célula (mesmo respiro de cima).
  diaNaLinha: { width: 36, paddingTop: espaco(1.25) },
  sessoesDaColuna: { gap: espaco(0.5) },
  sessoesDaLinha: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  semDia: { gap: espaco(0.5), marginTop: espaco(0.5) },
  sessoesSemDia: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  celula: {
    position: 'relative', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 8,
    paddingVertical: espaco(1), paddingLeft: espaco(1.25), paddingRight: espaco(1),
  },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  nomeAberto: { fontFamily: fontes.semi },
  exercicios: { gap: espaco(0.25) },
  exercicio: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: 2, paddingVertical: espaco(0.75) },
  marca: { width: 8, alignItems: 'center' },
  nomeDoExercicio: { flexShrink: 1 },
});
