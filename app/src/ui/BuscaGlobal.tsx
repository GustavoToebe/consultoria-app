import { router, type Href } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { Input } from '../components/ui/input';
import { buscarTelas, favoritosVisiveis, type TelaDoCatalogo } from '../dominio/telas';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useCliqueFora, useTeclado } from './usoWeb';

interface Props {
  /** O que o usuário pode abrir (já filtrado pelas permissões). */
  permitidas: readonly TelaDoCatalogo[];
  /** Ids favoritos, na ordem de marcação; aparecem quando o campo está vazio. */
  favoritos?: readonly string[];
  /** Largura do campo; o menu abaixo acompanha. */
  largura?: number;
}

/** Texto da dica de atalho; no Mac o atalho é Cmd + K, e o rótulo mostra o que vale ali. */
const ATALHO = Platform.OS === 'web' && typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

/**
 * Busca da barra de topo: "O que você deseja fazer?". Filtra o catálogo de telas e ações (`dominio/telas.ts`) só
 * entre o que o usuário pode abrir. Ctrl+K / Cmd+K foca o campo (web), setas escolhem, Enter abre, Esc fecha. Não
 * procura alunos pelo nome.
 */
export function BuscaGlobal({ permitidas, favoritos = [], largura = 440 }: Props) {
  const { cores, marca } = useTema();
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<TextInput>(null);
  const caixa = useRef<View>(null);

  const digitando = texto.trim().length > 0;
  const resultados = digitando ? buscarTelas(texto, permitidas) : favoritosVisiveis(favoritos, permitidas);
  const indice = Math.min(ativo, Math.max(resultados.length - 1, 0));

  const fechar = () => {
    setAberto(false);
    setAtivo(0);
  };
  const abrir = (tela: TelaDoCatalogo) => {
    setTexto('');
    fechar();
    campo.current?.blur();
    router.navigate(tela.href as Href);
  };

  useCliqueFora(caixa, aberto, fechar);
  useTeclado(true, ({ key, ctrl }) => {
    if (ctrl && key.toLowerCase() === 'k') {
      campo.current?.focus();
      setAberto(true);
      return true;
    }
    if (!aberto) return undefined;
    if (key === 'Escape') {
      fechar();
      campo.current?.blur();
      return true;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (resultados.length > 0) setAtivo((indice + (key === 'ArrowDown' ? 1 : resultados.length - 1)) % resultados.length);
      return true;
    }
    if (key === 'Enter' && resultados[indice]) {
      abrir(resultados[indice]);
      return true;
    }
    return undefined;
  });

  return (
    <View ref={caixa} style={[estilos.caixa, { width: largura }]}>
      <View>
        <Search size={16} color={cores.textoSuave} strokeWidth={2} style={estilos.lupa} />
        <Input
          ref={campo}
          accessibilityLabel="O que você deseja fazer?"
          placeholder="O que você deseja fazer?"
          placeholderTextColor={cores.textoSuave}
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            setAtivo(0);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          autoCorrect={false}
          autoComplete="off"
          style={[
            estilos.entrada,
            { color: cores.texto, backgroundColor: cores.campo, borderColor: aberto ? marca : cores.bordaCampo },
          ]}
        />
        {Platform.OS === 'web' ? (
          <View pointerEvents="none" style={[estilos.atalho, { borderColor: cores.bordaCampo, backgroundColor: cores.superficie2 }]}>
            <Texto variante="pequeno" style={estilos.textoAtalho}>{ATALHO}</Texto>
          </View>
        ) : null}
      </View>
      {aberto ? (
        <View
          accessibilityRole="list"
          style={[estilos.menu, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          {resultados.length === 0 ? (
            <Texto variante="suave" style={estilos.vazio}>
              {digitando ? 'Nada encontrado. Tente outra palavra.' : 'Digite para buscar telas e ações. Marque favoritos em "Todas as telas".'}
            </Texto>
          ) : (
            <>
              {digitando ? null : <Texto variante="rotulo" style={estilos.cabecaLista}>Favoritos</Texto>}
              {resultados.map((tela, i) => (
                <Pressable
                  key={tela.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${tela.rotulo}, ${tela.secao}`}
                  accessibilityState={{ selected: i === indice }}
                  onPress={() => abrir(tela)}
                  onHoverIn={() => setAtivo(i)}
                  style={(estado) => [
                    estilos.item,
                    (i === indice || sobre(estado)) && { backgroundColor: cores.superficie3 },
                  ]}>
                  <Texto style={estilos.nome} numberOfLines={1}>{tela.rotulo}</Texto>
                  <Texto variante="pequeno" numberOfLines={1}>{tela.acao ? `Ação · ${tela.secao}` : tela.secao}</Texto>
                </Pressable>
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { position: 'relative', maxWidth: '100%', zIndex: 30 },
  lupa: { position: 'absolute', left: espaco(1.25), top: 12, zIndex: 1 },
  entrada: {
    minHeight: 40,
    borderRadius: RAIO,
    borderWidth: 1,
    fontFamily: fontes.normal,
    fontSize: 14,
    paddingLeft: espaco(4),
    paddingRight: espaco(9),
    paddingVertical: espaco(0.75),
  },
  atalho: {
    position: 'absolute',
    right: espaco(1),
    top: 9,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: espaco(0.75),
    paddingVertical: 2,
  },
  textoAtalho: { fontSize: 12, fontFamily: fontes.semi },
  menu: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingVertical: espaco(0.5),
    maxHeight: 420,
    zIndex: 40,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  cabecaLista: { paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  vazio: { paddingHorizontal: espaco(1.5), paddingVertical: espaco(1.5) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco(2),
    minHeight: 40,
    paddingHorizontal: espaco(1.5),
  },
  nome: { fontFamily: fontes.semi, fontSize: 14, flexShrink: 1 },
});
