import type { LucideIcon } from 'lucide-react-native';

import { Badge } from '../components/ui/badge';
import { StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, tingido } from '../tema/tokens';
import { Texto } from './Texto';

export type TipoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/**
 * Status sempre com texto (selo de 12 px, caixa alta, sem fundo e borda fina). Nunca usa a cor da marca:
 * verde = feito/sincronizado/ativo; âmbar = pendente/rascunho; vermelho = erro; cinza = inativo/encerrado. As
 * cores de status dos tokens dão ≥ 4,5:1 sobre qualquer superfície (teste em `tema/tokens.test.ts`). Sem ícone, o selo
 * é só contorno e caixa alta; com `Icone`, vira uma pílula com fundo leve da cor (o "Pronta" verde do editor de treino).
 */
export function Selo({ texto, tipo, larguraMinima, Icone }: { texto: string; tipo: TipoSelo; larguraMinima?: number; Icone?: LucideIcon }) {
  const { cores } = useTema();
  const cor = cores[tipo];
  // Com ícone (Pronta, Atenção, Corrigir no editor de treino) o selo ganha um fundo bem leve da própria cor, como o
  // `Alerta`, opaco (`tingido`), e o contraste do texto sobre ele é conferido em `tokens.test.ts`.
  return (
    <Badge variant="outline"
      accessibilityRole="text"
      style={[estilos.selo, larguraMinima ? { minWidth: larguraMinima, justifyContent: 'center' } : null, { borderColor: cor }, Icone ? [estilos.comIcone, { backgroundColor: tingido(cor, cores.superficie) }] : null]}>
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
