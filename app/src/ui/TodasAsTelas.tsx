import { router, type Href } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { agruparPorSecao, buscarTelas, type TelaDoCatalogo } from '../dominio/telas';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_EDITOR, RAIO } from '../tema/tokens';
import { Campo } from './Campo';
import { Cartao } from './Cartao';
import { Folha } from './Folha';
import { Grade } from './Grade';
import { useSaidaGuardada } from './GuardaDeSaida';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  visivel: boolean;
  aoFechar: () => void;
  permitidas: readonly TelaDoCatalogo[];
  favoritos: readonly string[];
  aoAlternarFavorito: (id: string) => void;
}

/**
 * Painel "Todas as telas": busca no topo e as telas que o usuário pode abrir agrupadas por seção. A estrela marca
 * favorita; os favoritos aparecem na busca da barra de topo quando o campo está vazio. Ações (como "Novo aluno")
 * só existem na busca.
 */
export function TodasAsTelas({ visivel, aoFechar, permitidas, favoritos, aoAlternarFavorito }: Props) {
  const [texto, setTexto] = useState('');
  const { confirmar } = useSaidaGuardada();
  const telas = permitidas.filter((t) => !t.acao);
  const filtradas = texto.trim() ? buscarTelas(texto, telas) : telas;
  const grupos = agruparPorSecao(filtradas);
  const fechar = () => {
    setTexto('');
    aoFechar();
  };
  return (
    <Folha visivel={visivel} titulo="Todas as telas" aoFechar={fechar} largura={LARGURA_EDITOR}>
      <Campo rotulo="Buscar tela" valor={texto} aoMudar={setTexto} autoCorrect={false} />
      {grupos.length === 0 ? <Texto variante="suave">Nenhuma tela encontrada. Tente outra palavra.</Texto> : null}
      <Grade gap={espaco(2)}>
      {grupos.map((grupo) => (
        <Cartao key={grupo.secao} titulo={grupo.telas.length === 1 && grupo.telas[0].rotulo === grupo.secao ? undefined : grupo.secao} style={estilos.grupo}>
          <View style={estilos.lista}>
            {grupo.telas.map((tela) => (
              <LinhaDaTela key={tela.id} tela={tela} favorita={favoritos.includes(tela.id)}
                aoAbrir={() => {
                  fechar();
                  confirmar(() => router.navigate(tela.href as Href));
                }}
                aoAlternar={() => aoAlternarFavorito(tela.id)} />
            ))}
          </View>
        </Cartao>
      ))}
      </Grade>
    </Folha>
  );
}

function LinhaDaTela({ tela, favorita, aoAbrir, aoAlternar }: { tela: TelaDoCatalogo; favorita: boolean; aoAbrir: () => void; aoAlternar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.linha, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Pressable accessibilityRole="link" accessibilityLabel={tela.rotulo} onPress={aoAbrir}
        style={(estado) => [estilos.abrir, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
        <Texto style={estilos.nome}>{tela.rotulo}</Texto>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: favorita }}
        accessibilityLabel={favorita ? `Tirar ${tela.rotulo} dos favoritos` : `Marcar ${tela.rotulo} como favorita`}
        onPress={aoAlternar} style={estilos.estrela}>
        <Star size={20} color={favorita ? cores.atencao : cores.textoSuave} fill={favorita ? cores.atencao : 'transparent'} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  grupo: { flexGrow: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  abrir: { flex: 1, minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5) },
  nome: { fontFamily: fontes.semi },
  estrela: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
