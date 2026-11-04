import type { LucideIcon } from 'lucide-react-native';

import { Badge } from '../components/ui/badge';
import { StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, tingido } from '../tema/tokens';
import { Texto } from './Texto';

export type TipoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/**
 * Status sempre com texto (selo de 12 px, caixa alta e borda fina, com fundo opaco leve da própria cor). Nunca usa a cor da marca:
 * verde = feito/sincronizado/ativo; âmbar = pendente/rascunho; vermelho = erro; cinza = inativo/encerrado. As
 * cores de status dão ≥ 4,5:1 sobre o próprio fundo `tingido` (teste em `ui/contrasteDasPecas.test.ts`). Com `Icone`, vira
 * uma pílula (o "Pronta" verde do editor de treino).
 */
export function Selo({ texto, tipo, larguraMinima, Icone }: { texto: string; tipo: TipoSelo; larguraMinima?: number; Icone?: LucideIcon }) {
  const { cores } = useTema();
  const cor = cores[tipo];
  // Fundo sempre opaco (`tingido`, D4 de `docs/planos/auditoria-cores.md`): transparente, o contraste dependia da faixa onde o
  // selo está (sobre a `faixaForte` do exercício ficava abaixo de 4,5:1). O do selo sem ícone é o mesmo do `Alerta`.
  return (
    <Badge variant="outline"
      accessibilityRole="text"
      style={[estilos.selo, larguraMinima ? { minWidth: larguraMinima, justifyContent: 'center' } : null, { borderColor: cor, backgroundColor: tingido(cor, cores.superficie) }, Icone ? estilos.comIcone : null]}>
      {Icone ? <Icone size={12} color={cor} strokeWidth={2.5} /> : null}
      <Texto style={[estilos.texto, { color: cor }, Icone ? estilos.textoComIcone : null]}>{texto}</Texto>
    </Badge>
  );
}

const estilos = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: espaco(0.75),
    paddingVertical: 2,
  },
  texto: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  comIcone: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, borderRadius: 999, paddingHorizontal: espaco(1) },
  textoComIcone: { textTransform: 'none', letterSpacing: 0 },
});
