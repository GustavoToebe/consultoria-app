import { Award, CalendarCheck, CircleCheck, Crown, Dumbbell, Flame, Medal, Shield, Trophy, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConquistaDoColega, ConquistaRecente, DestaqueDoColega, RecordeDoColega } from '../api/comunidadeTipos';
import { dataParaTela } from '../dominio/formatos';
import { gradeDaAtividade } from '../dominio/perfilDoColega';
import { textoDaCarga } from '../dominio/unidadeDeCarga';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';

// Blocos do perfil do colega abaixo da capa. A cor do colega (`tom`) só pinta ícone, borda e o quadradinho do dia treinado
// (marcador ≥ 3:1, `ui/contrasteDasPecas.test.ts`); todo texto fica em `texto`/`textoSuave`, porque o laranja do claro não
// passa 4,5:1 como texto.

/** Ícone da conquista pelo nome que a API manda (`trophy-first`, `flame-10`…): o começo diz a forma; desconhecido, a medalha. */
const ICONES: [string, LucideIcon][] = [
  ['trophy', Trophy], ['flame', Flame], ['fire', Flame], ['medal', Medal], ['shield', Shield], ['crown', Crown],
  ['calendar', CalendarCheck], ['weight', Dumbbell], ['dumbbell', Dumbbell], ['check', CircleCheck],
];
export const iconeDaConquista = (icone: string | null | undefined): LucideIcon =>
  ICONES.find(([prefixo]) => (icone ?? '').startsWith(prefixo))?.[1] ?? Award;

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.secao}>
      <Texto variante="secao" nivel={3}>{titulo}</Texto>
      {children}
    </View>
  );
}

/** Até 4 conquistas que o colega escolheu mostrar, maiores, com a borda na cor dele. Sem destaque, o bloco não aparece. */
export function Destaques({ destaques, tom }: { destaques: readonly DestaqueDoColega[]; tom: string }) {
  const { cores } = useTema();
  if (!destaques.length) return null;
  return (
    <Secao titulo="Destaques">
      <View style={estilos.grade}>
        {destaques.map((d) => {
          const Icone = iconeDaConquista(d.icone);
          return (
            <View key={d.tipo} style={[estilos.destaque, { backgroundColor: cores.superficie2, borderColor: tom }]}>
              <Icone size={28} color={tom} strokeWidth={2} aria-hidden />
              <Texto variante="bloco" style={estilos.centro}>{d.titulo}</Texto>
            </View>
          );
        })}
      </View>
    </Secao>
  );
}

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DIA = 30;

/**
 * Últimos 30 dias num mini calendário de domingo a sábado: dia com treino é o quadrado cheio na cor do colega, sem treino só
 * o contorno, e hoje ganha um anel. A frase acima diz o número de dias e o período (é ela que o leitor de tela lê; a grade é
 * desenho). Depois, as últimas conquistas com o dia, nunca a hora.
 */
export function AtividadeRecente({ dias, conquistas, hoje, tom }: {
  dias: readonly string[]; conquistas: readonly ConquistaRecente[]; hoje: string; tom: string;
}) {
  const { cores } = useTema();
  const grade = gradeDaAtividade(dias, hoje);
  const quadrado = (cheio: boolean) => [estilos.dia, cheio ? { backgroundColor: tom, borderColor: tom } : { borderColor: cores.borda }];
  return (
    <Secao titulo="Atividade recente">
      <Texto numerico>{grade.resumo}</Texto>
      <View aria-hidden accessible={false} importantForAccessibility="no-hide-descendants" style={estilos.calendario}>
        <View style={estilos.semana}>
          {SEMANA.map((d, i) => <Texto key={i} variante="pequeno" style={estilos.letraDoDia}>{d}</Texto>)}
        </View>
        {grade.semanas.map((semana, s) => (
          <View key={s} style={estilos.semana}>
            {semana.map((dia, i) => (
              <View key={i} style={[estilos.casa, dia?.hoje && { borderColor: cores.texto }]}>
                {dia ? <View testID={dia.treinou ? 'dia-treinado' : 'dia-sem-treino'} style={quadrado(dia.treinou)} /> : null}
              </View>
            ))}
          </View>
        ))}
        <View style={estilos.legenda}>
          <View style={estilos.itemDaLegenda}><View style={[quadrado(true), estilos.miniatura]} /><Texto variante="pequeno">Treinou</Texto></View>
          <View style={estilos.itemDaLegenda}><View style={[quadrado(false), estilos.miniatura]} /><Texto variante="pequeno">Sem treino</Texto></View>
          <View style={estilos.itemDaLegenda}><View style={[estilos.miniatura, estilos.anelDeHoje, { borderColor: cores.texto }]} /><Texto variante="pequeno">Hoje</Texto></View>
        </View>
      </View>

      <Texto variante="rotulo" style={estilos.subtitulo}>Últimas conquistas</Texto>
      {conquistas.length ? (
        <View style={estilos.linhas}>
          {conquistas.map((c, i) => {
            const Icone = iconeDaConquista(c.icone);
            return (
              <View key={`${c.tipo}:${c.data}`} style={[estilos.linhaDaLista, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
                <Icone size={20} color={tom} strokeWidth={2} aria-hidden />
                <Texto style={estilos.encolher}>{c.titulo}</Texto>
                <Texto variante="suave" numerico>{dataParaTela(c.data)}</Texto>
              </View>
            );
          })}
        </View>
      ) : <Texto variante="suave">Nenhuma conquista nos últimos dias.</Texto>}
    </Secao>
  );
}

/** Todas as conquistas (insígnias), chaveadas por `tipo`: o colega recebe sem id e sem data, e a tela nunca mostra a hora. */
export function Insignias({ conquistas, tom }: { conquistas: readonly ConquistaDoColega[]; tom: string }) {
  const { cores } = useTema();
  return (
    <Secao titulo="Insígnias">
      {conquistas.length ? (
        <View style={estilos.grade}>
          {conquistas.map((c) => {
            const Icone = iconeDaConquista(c.icone);
            return (
              <View key={c.tipo} style={[estilos.insignia, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                <Icone size={24} color={tom} strokeWidth={2} aria-hidden />
                <Texto variante="bloco" style={estilos.centro}>{c.titulo}</Texto>
                <Texto variante="suave" style={estilos.centro}>{c.descricao}</Texto>
              </View>
            );
          })}
        </View>
      ) : <Texto variante="suave">Nenhuma conquista por enquanto.</Texto>}
    </Secao>
  );
}

/** A maior carga de cada exercício, na unidade de quem vê (a API manda kg). Nunca data, série nem treino. */
export function RecordesDeCarga({ recordes }: { recordes: readonly RecordeDoColega[] }) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  return (
    <Secao titulo="Recordes de carga">
      {recordes.length ? (
        <>
          <Texto variante="suave">A maior carga de cada exercício.</Texto>
          <View style={[estilos.linhas, estilos.caixa, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
            {recordes.map((r, i) => (
              <View key={r.exercicio} style={[estilos.linhaDaLista, estilos.recuo, i > 0 && { borderTopWidth: 1, borderTopColor: cores.divisor }]}>
                <Texto style={estilos.encolher}>{r.exercicio}</Texto>
                <Texto variante="bloco" numerico>{textoDaCarga(r.carga, unidade)}</Texto>
              </View>
            ))}
          </View>
        </>
      ) : <Texto variante="suave">Nenhum recorde de carga ainda.</Texto>}
    </Secao>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  destaque: { flexGrow: 1, flexBasis: 120, alignItems: 'center', gap: espaco(1), borderWidth: 2, borderRadius: RAIO, padding: espaco(2) },
  insignia: { flexGrow: 1, flexBasis: 150, alignItems: 'center', gap: espaco(0.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  centro: { textAlign: 'center' },
  calendario: { gap: 4, alignSelf: 'flex-start' },
  semana: { flexDirection: 'row', gap: 4 },
  letraDoDia: { width: DIA + 4, textAlign: 'center' },
  // A casa tem 2 px a mais de cada lado para o anel de hoje não mexer no tamanho do quadrado.
  casa: { width: DIA + 4, height: DIA + 4, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dia: { width: DIA - 4, height: DIA - 4, borderRadius: 5, borderWidth: 1.5 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2), marginTop: espaco(0.5) },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  miniatura: { width: 14, height: 14, borderRadius: 3 },
  anelDeHoje: { borderWidth: 2 },
  subtitulo: { marginTop: espaco(1.5) },
  linhas: { gap: 0 },
  caixa: { borderWidth: 1, borderRadius: RAIO },
  linhaDaLista: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1.25) },
  recuo: { paddingHorizontal: espaco(2) },
  encolher: { flex: 1, minWidth: 0 },
});
