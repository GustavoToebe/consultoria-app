import { Eye } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoSerieComEtapas } from '../../aluno/CartaoSerieComEtapas';
import { CartaoSerieDeCardio } from '../../aluno/CartaoSerieDeCardio';
import { LinhaDaSerie } from '../../aluno/LinhaDaSerie';
import { ehExercicioDeCardio } from '../../aluno/serieDoAluno';
import type { Configuracao, Serie } from '../../api/tipos';
import type { GrupoDeSeries } from '../../dominio/agrupamento';
import { calcularCargasDoExercicio, passoDaCarga } from '../../dominio/cargas';
import { etapasDaSerie } from '../../dominio/etapas';
import { hojeIso } from '../../dominio/formatos';
import { tipoTrabalho } from '../../dominio/metodologia';
import { exercicioDaPrevia, legendaDaPrevia, seriesDaPrevia, wsDeReferenciaKg } from '../../dominio/previaDaSerie';
import { aplicarRascunho, type MudancaDoRascunho, type RascunhosDeSerie } from '../../dominio/rascunhoDaSerie';
import { contaEmBlocos } from '../../dominio/telaDoExercicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { ProvedorDaPrevia } from '../../ui/emPrevia';
import { Texto } from '../../ui/Texto';
import { ContextoDaUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';

/** Sem o pacote do aluno a prévia não sabe o arredondamento da consultoria: o mesmo padrão da `FolhaVerComoAluno`. */
const BASE_SEM_PACOTE = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };
const SEM_EFEITO = () => undefined;

interface Props {
  /** O grupo de séries aberto no editor (índices do exercício). */
  grupo: GrupoDeSeries;
  /** Todas as séries do exercício, para a numeração e as cargas baterem com a tela do aluno. */
  series: Serie[];
  /** A metodologia do treino (tipos de série, nome da WS). */
  config: Configuracao;
  /** Exercício sem carga (unidade "nenhuma"). */
  semCarga?: boolean;
}

/**
 * Prévia para o aluno da série aberta no editor (SERIE-ABERTA, seção 4): os cartões do app do aluno como são hoje
 * (`LinhaDaSerie`, `CartaoSerieComEtapas`, `CartaoSerieDeCardio`), só das séries de `seriesDaPrevia`, com a legenda
 * embaixo. Modo prévia (`ProvedorDaPrevia`): o ✓ fica desabilitado e nada é registrado; sem `AlunoProvider`, sem rede e
 * sem aparelho: o digitado fica só na memória da peça. Unidade fixa em kg (como a `FolhaVerComoAluno`). Ocupa 100% do pai.
 */
export function PreviaDaSerie({ grupo, series, config, semCarga = false }: Props) {
  const { cores } = useTema();
  const [rascunhos, setRascunhos] = useState<RascunhosDeSerie>({});
  const salvar = (uid: string, m: MudancaDoRascunho | null) => setRascunhos((antes) => aplicarRascunho(antes, uid, m, ''));

  const exercicio = exercicioDaPrevia(series, semCarga);
  const cfg = { ...BASE_SEM_PACOTE, tipoTrabalho: tipoTrabalho(config) ?? BASE_SEM_PACOTE.tipoTrabalho, metodologia: config };
  const wsKg = wsDeReferenciaKg(series, config);
  const calculadas = calcularCargasDoExercicio(exercicio, wsKg, {}, { ...cfg, ultima: null, cargaManual: wsKg != null, unidade: 'kg' });
  const passo = passoDaCarga(exercicio, cfg.arredondamentoKg);
  const cardio = ehExercicioDeCardio(exercicio);
  const emBlocos = contaEmBlocos(exercicio);
  const hoje = hojeIso();
  const { indices } = seriesDaPrevia(grupo);
  const legenda = legendaDaPrevia(grupo, config, { unidade: 'kg', wsKg, totalDoExercicio: series.length });

  // `descansoNaSerie={false}` nos cartões: o descanso sai uma vez só, na legenda (como no mock da seção 4).
  const cartao = (i: number, ativa: boolean) => {
    const c = calculadas[i];
    if (!c) return null;
    const s = c.serie;
    if (cardio) {
      return <CartaoSerieDeCardio key={s.uid} serie={s} numero={i + 1} feita={false} ativa={ativa} ultimaDoExercicio={false} emBlocos={emBlocos} aoMarcar={SEM_EFEITO} />;
    }
    if (etapasDaSerie(s)) {
      return (
        <CartaoSerieComEtapas key={s.uid} calculada={c} numero={i + 1} data={hoje} semCarga={semCarga} metodologia={cfg.metodologia}
          tipoTrabalho={cfg.tipoTrabalho} arredondamentoKg={cfg.arredondamentoKg} descansoNaSerie={false} registro={undefined}
          execucao={`previa|${s.uid}|${hoje}`} anterior="—" ativa={ativa} aoRegistrar={SEM_EFEITO} />
      );
    }
    return (
      <LinhaDaSerie key={s.uid} calculada={c} indice={i} semCarga={semCarga} cargaIlegivel={false} tipoTrabalho={cfg.tipoTrabalho}
        metodologia={cfg.metodologia} seriesDoExercicio={series} descansoNaSerie={false} passo={passo} ativa={ativa} registro={undefined}
        rascunho={rascunhos[s.uid] ?? null} salvarRascunho={(m) => salvar(s.uid, m)} repetir={null} aoRegistrar={SEM_EFEITO}
        ultimaDoExercicio={false} recordes={null} anterior="—" arredondamentoKg={cfg.arredondamentoKg} />
    );
  };

  return (
    <View style={estilos.previa}>
      <View style={estilos.cabecalho}>
        <View aria-hidden><Eye size={14} color={cores.textoSuave} /></View>
        <Texto variante="secao">Prévia para o aluno</Texto>
      </View>
      <View role="group" aria-label="Prévia para o aluno" style={estilos.cartoes}>
        <ContextoDaUnidadeDeCarga.Provider value="kg">
          <ProvedorDaPrevia value>
            {indices.map((i, j) => cartao(i, j === 0))}
          </ProvedorDaPrevia>
        </ContextoDaUnidadeDeCarga.Provider>
      </View>
      {legenda.length ? (
        <View accessibilityLiveRegion="polite" style={estilos.legenda}>
          {legenda.map((linha, k) => <Texto key={k} variante="pequeno" numerico>{linha}</Texto>)}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  previa: { width: '100%', gap: espaco(1.5) },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  cartoes: { gap: espaco(1.5) },
  legenda: { gap: espaco(0.5) },
});
