import { StyleSheet, View } from 'react-native';

import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group';
import { ROTULOS_DOS_TAMANHOS, type TamanhoDoBloco } from '../../../dominio/painelDoInicio';
import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, fontes, RAIO_CONTROLE } from '../../../tema/tokens';
import { coresDoSegmento } from '../../../ui/selecao';
import { Texto } from '../../../ui/Texto';
import { idDaEdicao, type BlocoDoPainelId } from './tipos';

const LETRA: Record<TamanhoDoBloco, string> = { 1: 'P', 2: 'M', 3: 'G' };

/**
 * P · M · G do bloco em edição: o segmento da `Escolha` (trilha `superficie2`, o escolhido sobe com o contorno forte),
 * mais justo, com a letra na tela e o nome inteiro para o leitor ("Pequeno", "Médio", "Grande"; a `Escolha` lê o rótulo
 * visível, por isso a peça própria). Só os tamanhos que mudam algo nesta grade (`tamanhos`); fica marcado o que vale
 * nela (o G numa grade de 2 colunas aparece como M, que é o que se vê), e tocar no marcado não muda nada.
 */
export function SegmentoDeTamanho({ id, titulo, valor, tamanhos, aoMudar }: {
  id: BlocoDoPainelId;
  titulo: string;
  valor: TamanhoDoBloco;
  tamanhos: readonly TamanhoDoBloco[];
  aoMudar: (tamanho: TamanhoDoBloco) => void;
}) {
  const { cores } = useTema();
  if (tamanhos.length < 2) return null;
  const marcado = Math.min(valor, tamanhos[tamanhos.length - 1]) as TamanhoDoBloco;
  return (
    <View nativeID={idDaEdicao(id, 'tamanho')}>
      <ToggleGroup type="single" role="radiogroup" accessibilityRole="radiogroup" accessibilityLabel={`Tamanho de ${titulo}`}
        value={String(marcado)}
        onValueChange={(v) => {
          const t = Number(v);
          if (v && t !== marcado && tamanhos.includes(t as TamanhoDoBloco)) aoMudar(t as TamanhoDoBloco);
        }}
        style={[estilos.trilha, { backgroundColor: cores.superficie2 }]}>
        {tamanhos.map((t) => {
          const ativo = t === marcado;
          const visual = coresDoSegmento(cores, ativo);
          return (
            <ToggleGroupItem key={t} value={String(t)} role="radio" accessibilityRole="radio" accessibilityLabel={ROTULOS_DOS_TAMANHOS[t]}
              accessibilityState={{ checked: ativo }} aria-checked={ativo}
              style={[estilos.opcao, { backgroundColor: visual.fundo, borderColor: visual.borda }]}>
              <Texto aria-hidden style={[estilos.letra, { color: visual.texto, fontFamily: ativo ? fontes.semi : fontes.medio }]}>{LETRA[t]}</Texto>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </View>
  );
}

const estilos = StyleSheet.create({
  // A trilha da `Escolha` (padding 3, vão 2); cada opção é um alvo de 44 × 44.
  trilha: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: RAIO_CONTROLE + 3, alignSelf: 'flex-start' },
  opcao: {
    height: 'auto', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: ALVO_TOQUE, minHeight: ALVO_TOQUE,
    borderRadius: RAIO_CONTROLE, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0,
  },
  letra: { fontSize: 14 },
});
