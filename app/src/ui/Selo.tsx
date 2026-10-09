import { Badge } from '../components/ui/badge';
import { StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

export type TipoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/**
 * Status sempre com texto (selo de 11 px, caixa alta, fundo translúcido e borda fina). Nunca usa a cor da marca:
 * verde = feito/sincronizado/ativo; âmbar = pendente/rascunho; vermelho = erro; cinza = inativo/encerrado.
 */
export function Selo({ texto, tipo, larguraMinima }: { texto: string; tipo: TipoSelo; larguraMinima?: number }) {
  const { cores } = useTema();
  const cor = cores[tipo];
  return (
    <Badge variant="outline"
      accessibilityRole="text"
      style={[estilos.selo, larguraMinima ? { minWidth: larguraMinima, justifyContent: 'center' } : null, { borderColor: cor, backgroundColor: `${cor}22` }]}>
      <Texto style={[estilos.texto, { color: cor }]}>{texto}</Texto>
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
  texto: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
});
