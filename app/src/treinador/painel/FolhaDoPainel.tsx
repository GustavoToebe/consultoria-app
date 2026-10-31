import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FolhaDoPainel as DadosDaFolha, ItemDaFolha } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Alerta } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { propsDeLink } from '../../ui/propsDeLink';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

/**
 * Lista de um cartão do painel numa `Folha` (sem registro, a renovar, recordes): a linha de cima diz quantos são
 * ("Mostrando 20 de 34 alunos."), cada linha abre a ficha do aluno. `folha` nula com a Folha aberta: a consulta
 * deixou de responder (o cartão já fecha nesse caso; aqui só por segurança).
 */
export function FolhaDoPainel({ titulo, folha, aoFechar, topo }: {
  titulo: string; folha: DadosDaFolha | null; aoFechar: () => void; topo?: ReactNode;
}) {
  return (
    <Folha visivel titulo={folha?.titulo ?? titulo} aoFechar={aoFechar}>
      <View style={estilos.corpo}>
        {topo}
        {!folha ? <Alerta tom="perigo" texto="A lista não carregou. Feche e toque em atualizar no bloco." /> : (
          <>
            {folha.resumo || folha.escopo ? (
              <Texto variante="suave" numerico>{[folha.resumo, folha.escopo].filter(Boolean).join(' · ')}</Texto>
            ) : null}
            {folha.vazio ? <Texto variante="suave">{folha.vazio}</Texto> : null}
            {folha.itens.length ? (
              <View accessibilityRole="list">
                {folha.itens.map((item) => <LinhaDaFolha key={item.chave} item={item} aoAbrir={aoFechar} />)}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Folha>
  );
}

function LinhaDaFolha({ item, aoAbrir }: { item: ItemDaFolha; aoAbrir: () => void }) {
  const { cores } = useTema();
  const href = item.href as Href;
  const abrir = () => {
    aoAbrir();
    router.push(href);
  };
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={item.falado} {...propsDeLink(href, abrir)}
      style={(e) => [estilos.linha, { borderColor: cores.divisor, backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
      <View style={[estilos.iniciais, { backgroundColor: cores.superficie3 }]} accessible={false}>
        <Texto variante="rotulo" cor={cores.texto}>{iniciais(item.nome)}</Texto>
      </View>
      <View style={estilos.textos}>
        <Texto variante="bloco" numberOfLines={1}>{item.nome}</Texto>
        <Texto variante="suave" numberOfLines={2}>{item.descricao}</Texto>
        {item.detalhes.map((d) => <Texto key={d} variante="pequeno">{d}</Texto>)}
      </View>
      {item.direita ? <Texto variante="suave" numerico style={estilos.direita}>{item.direita}</Texto> : null}
      <ChevronRight size={18} color={cores.textoSuave} accessible={false} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE + 12, paddingVertical: espaco(1), paddingHorizontal: espaco(0.5), borderTopWidth: 1 },
  iniciais: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  direita: { flexShrink: 0 },
});
