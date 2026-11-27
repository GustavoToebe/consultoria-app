import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OpcaoDeGrupo } from '../../dominio/exerciciosDaBiblioteca';
import { inteiroComMilhar } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { coresDaSelecao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * "Tipo de cardio" no painel de filtros da folha "Escolher cardio" (docs/planos/cardio-e-hiit.md, P4b): no lugar do
 * "Grupo muscular", que não faz sentido no cardio. Um chip por tipo que a lista tem (vários de uma vez; nenhum = todos),
 * com quantos cardios tem ("Escada 2"; o leitor de tela diz "Escada, 2 cardios"), no mesmo desenho dos chips de grupo
 * (`FiltroDeGrupos` da Biblioteca, que tem o rótulo e o substantivo fixos). São no máximo 8 tipos: sem busca.
 * Sem nenhum cardio com tipo (o catálogo importado não traz tipo), o grupo diz isso em vez de sumir sem explicação.
 */
export function FiltroDoTipoDeCardio({ opcoes, marcados, aoMudar }: {
  opcoes: readonly OpcaoDeGrupo[]; marcados: ReadonlySet<string>; aoMudar: (m: Set<string>) => void;
}) {
  const { cores } = useTema();
  const alternar = (valor: string) => {
    const novo = new Set(marcados);
    if (novo.has(valor)) novo.delete(valor); else novo.add(valor);
    aoMudar(novo);
  };
  return (
    <View role="group" aria-label="Tipo de cardio" style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>Tipo de cardio</Texto>
      {opcoes.length === 0 ? (
        <Texto variante="pequeno">Nenhum cardio da biblioteca tem tipo ainda. O tipo se escolhe ao editar o cardio na Biblioteca.</Texto>
      ) : (
        <View style={estilos.chips}>
          {opcoes.map((o) => {
            const marcado = marcados.has(o.valor);
            const visual = coresDaSelecao(cores, marcado);
            return (
              <Pressable key={o.valor} accessibilityRole="checkbox" aria-checked={marcado} accessibilityState={{ checked: marcado }}
                accessibilityLabel={`${o.rotulo}, ${o.contagem === 1 ? '1 cardio' : `${inteiroComMilhar(o.contagem)} cardios`}`}
                onPress={() => alternar(o.valor)}
                style={(estado) => [estilos.chip, { borderColor: visual.borda, backgroundColor: !marcado && sobre(estado) ? cores.superficie2 : visual.fundo }]}>
                {marcado ? <Check size={16} color={visual.texto} strokeWidth={2.5} aria-hidden /> : null}
                <Texto style={[estilos.texto, { color: visual.texto, fontFamily: marcado ? fontes.semi : fontes.medio }]}>{o.rotulo}</Texto>
                <Texto numerico aria-hidden style={[estilos.texto, { color: cores.textoSuave }]}>{inteiroComMilhar(o.contagem)}</Texto>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  chip: {
    minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, maxWidth: '100%', paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  texto: { fontSize: 14, flexShrink: 1, paddingVertical: 4 },
});
