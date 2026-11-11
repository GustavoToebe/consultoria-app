import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { LinkTexto } from './LinkTexto';

/** Páginas públicas de leitura, na ordem do rodapé. A de excluir a conta só aparece entre elas (não no Entrar). */
const PAGINAS = [
  ['/privacidade', 'Privacidade'],
  ['/termos-de-uso', 'Termos de uso'],
  ['/excluir-conta', 'Excluir conta'],
  ['/entrar', 'Entrar'],
] as const;

/**
 * Rodapé das telas públicas com os links de Privacidade e Termos de uso (`LinkTexto`: `<a href>` na web, alvo de 44 px).
 * Com `todas` (nas próprias páginas públicas), também Excluir conta e Entrar, sem a página aberta.
 */
export function LinksDosTermos({ todas }: { todas?: boolean }) {
  const { cores } = useTema();
  const caminho = usePathname();
  const links = todas ? PAGINAS.filter(([href]) => href !== caminho) : PAGINAS.slice(0, 2);
  return (
    <View role="navigation" aria-label="Termos e privacidade" style={[estilos.rodape, { borderTopColor: cores.divisor }]}>
      {links.map(([href, texto]) => <LinkTexto key={href} href={href} texto={texto} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  rodape: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: espaco(3), borderTopWidth: 1, paddingTop: espaco(1) },
});
