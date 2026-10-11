import { usePathname } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { nomeDaTela, telasPermitidas } from '../dominio/telas';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { BuscaGlobal } from './BuscaGlobal';
import { Texto } from './Texto';

/**
 * Barra de topo do treinador no PC (o `Navegacao` só a monta com o menu lateral): consultoria e nome da tela à
 * esquerda, busca "O que você deseja fazer?" ao centro. No celular não existe.
 */
export function BarraTopo() {
  const caminho = usePathname();
  const { marca, pode } = useSessao();
  const { cores, marca: corDaMarca } = useTema();
  const permitidas = useMemo(() => telasPermitidas(pode), [pode]);
  const tela = nomeDaTela(caminho);
  return (
    <View style={[estilos.barra, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.titulo}>
        <Texto numberOfLines={1} style={[estilos.consultoria, { color: corDaMarca }]}>{marca?.nome ?? 'Treinos'}</Texto>
        {tela ? <Texto variante="bloco" numberOfLines={1}>{tela}</Texto> : null}
      </View>
      <View style={estilos.centro}>
        <BuscaGlobal permitidas={permitidas} />
      </View>
      <View style={estilos.direita} />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(2),
    minHeight: 64,
    paddingHorizontal: espaco(3),
    paddingVertical: espaco(1),
    borderBottomWidth: 1,
    zIndex: 20,
  },
  titulo: { flex: 1, minWidth: 0, gap: 2 },
  consultoria: { fontFamily: fontes.semi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  centro: { flex: 2, minWidth: 0, alignItems: 'center' },
  direita: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: espaco(1) },
});
