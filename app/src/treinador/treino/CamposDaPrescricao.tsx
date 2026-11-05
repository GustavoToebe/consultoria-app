import { StyleSheet, View } from 'react-native';
import type { Cardio } from '../../api/tipos';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoNumerico, Interruptor } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { ErroDoCampo } from './CamposBasicos';

/**
 * Os campos de prescrição que a série e a metodologia dividem. As peças moram em arquivos próprios (básicas, técnica,
 * carga e RIR) e saem todas por aqui, para quem edita a série importar de um lugar só; aqui fica só o cardio.
 */
export * from './CamposBasicos';
export { CamposDaTecnica } from './CamposDaTecnica';
export { CampoDaCargaFixa, CargaERirDaSerie, EscolhaDoRir, FaixaDeCarga } from './CargaERirDaSerie';

const CARDIO_VAZIO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null };
const ZONAS = [1, 2, 3, 4, 5].map((valor) => ({ valor: valor as number | null, rotulo: `Zona ${valor}` }));

/** Prescrição de cardio: duração, distância, ritmo, zona e, se quiser, intervalos de esforço e descanso em voltas. */
export function CamposDoCardio({ cardio, aoMudar, erros }: { cardio: Cardio | null | undefined; aoMudar: (c: Cardio) => void; erros: Problemas }) {
  const c = cardio ?? CARDIO_VAZIO;
  const mudar = (parte: Partial<Cardio>) => aoMudar({ ...CARDIO_VAZIO, ...c, ...parte });
  const i = c.intervalos;
  const mudarIntervalos = (parte: Partial<NonNullable<Cardio['intervalos']>>) => mudar({ intervalos: { trabalhoSeg: i?.trabalhoSeg ?? null, descansoSeg: i?.descansoSeg ?? null, voltas: i?.voltas ?? null, ...parte } });
  return <View style={estilos.bloco}>
    <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Duração" inteiro sufixo="min" valor={c.duracaoMin ?? null} aoMudar={(duracaoMin) => mudar({ duracaoMin })} erro={erros.duracaoMin} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Distância" sufixo="km" valor={c.distanciaKm ?? null} aoMudar={(distanciaKm) => mudar({ distanciaKm })} erro={erros.distanciaKm} /></View>
      <View style={estilos.campo}><Campo rotulo="Ritmo" valor={c.ritmo ?? ''} maxLength={40} placeholder="Ex.: 6 min/km"
        aoMudar={(t) => mudar({ ritmo: t.trim() ? t : null })} erro={erros.ritmo} /></View>
    </View>
    <Escolha rotulo="Zona de esforço" opcoes={ZONAS} valor={c.zona ?? null} aoMudar={(zona) => mudar({ zona })} limpavel />
    <ErroDoCampo mensagem={erros.zona} />
    <Interruptor rotulo="Intervalado" ajuda="Voltas de esforço e descanso." valor={!!i} aoMudar={(ligado) => mudar({ intervalos: ligado ? { trabalhoSeg: null, descansoSeg: null, voltas: null } : null })} />
    {i ? <View style={estilos.linha}>
      <View style={estilos.campo}><CampoNumerico rotulo="Esforço" inteiro sufixo="s" valor={i.trabalhoSeg ?? null} aoMudar={(trabalhoSeg) => mudarIntervalos({ trabalhoSeg })} erro={erros['intervalos.trabalhoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Descanso" inteiro sufixo="s" valor={i.descansoSeg ?? null} aoMudar={(descansoSeg) => mudarIntervalos({ descansoSeg })} erro={erros['intervalos.descansoSeg']} /></View>
      <View style={estilos.campo}><CampoNumerico rotulo="Voltas" inteiro valor={i.voltas ?? null} aoMudar={(voltas) => mudarIntervalos({ voltas })} erro={erros['intervalos.voltas']} /></View>
    </View> : null}
    <ErroDoCampo mensagem={erros.cardio} />
  </View>;
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { minWidth: 130, flexGrow: 1, flexBasis: 130, maxWidth: 220 },
});
