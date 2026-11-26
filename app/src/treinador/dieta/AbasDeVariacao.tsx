import { CircleAlert, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import type { VariacaoDaDieta } from '../../api/tipos';
import { textoDosDiasCurtos } from '../../dominio/variacoesDaDieta';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { AbasDasOpcoes } from '../../ui/MarcadorDeOpcao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  variacoes: VariacaoDaDieta[];
  aberta: string;
  comProblema: ReadonlySet<string>;
  nomeDe: (v: VariacaoDaDieta) => string;
  aoAbrir: (uid: string) => void;
  aoCriar: () => void;
  /** Motivo do "+ Nova variação" travado (no limite); `null` = liberado. */
  motivoDoCriar: string | null;
}

/**
 * As variações em abas, no mesmo desenho das opções da refeição (a faixa é a `ui/AbasDasOpcoes`): o círculo com o número
 * (o mesmo da faixa da semana), o nome e, em texto secundário, os dias ("· Ter, Qui e Sáb"); no fim, fora da rolagem,
 * "+ Nova variação" como aba de contorno tracejado. O nome acessível começa pelo nome da variação.
 */
export function AbasDeVariacao({ variacoes, aberta, comProblema, nomeDe, aoAbrir, aoCriar, motivoDoCriar }: Props) {
  const { cores } = useTema();
  return (
    <AbasDasOpcoes rotulo="Variações da dieta" aberta={aberta} aoAbrir={aoAbrir}
      depois={<NovaVariacao aoTocar={aoCriar} motivo={motivoDoCriar} />}
      abas={variacoes.map((v, i) => {
        const erro = comProblema.has(v.uid);
        const dias = textoDosDiasCurtos(v.dias);
        return {
          valor: v.uid,
          letra: String(i + 1),
          titulo: nomeDe(v),
          rotuloAcessivel: `${nomeDe(v)}, ${dias}${erro ? ', precisa corrigir' : ''}`,
          antes: erro ? <CircleAlert size={16} color={cores.perigo} strokeWidth={2.5} /> : undefined,
          detalhe: <Texto variante="suave" numberOfLines={1}>· {dias}</Texto>,
        };
      })} />
  );
}

/** A aba de criar: contorno tracejado, texto e ícone `acao` sem fundo (discreto); no limite, apagada e com o motivo na dica. */
function NovaVariacao({ aoTocar, motivo }: { aoTocar: () => void; motivo: string | null }) {
  const { cores } = useTema();
  const cinza = coresDoDesabilitado(cores);
  const travado = motivo !== null;
  const cor = travado ? cinza.texto : cores.acao;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: travado }} aria-disabled={travado}
      accessibilityHint={motivo ?? undefined} onPress={travado ? undefined : aoTocar}
      style={(st) => [estilos.nova, { borderColor: travado ? cinza.borda : cores.bordaCampo, backgroundColor: !travado && sobre(st) ? cores.acaoSuave : 'transparent' }]}>
      <Plus size={16} color={cor} strokeWidth={2.5} />
      <Texto style={[estilos.rotulo, { color: cor }]}>Nova variação</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  nova: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5), borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO_CONTROLE, marginBottom: espaco(0.5),
  },
  rotulo: { fontFamily: fontes.semi, fontSize: 15 },
});
