import { ClipboardCheck, Dumbbell, FileCheck, History, Scale, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { atividadeRecenteDoAluno } from '../api/rotas';
import type { ItemDeAtividade, TipoDeAtividade } from '../api/tipos';
import { instanteRelativo } from '../dominio/datasRelativas';
import { destinoDoEvento, textoDoEvento } from '../dominio/fichaDoAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { ItemDeLista } from '../ui/ItemDeLista';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const ICONE: Record<TipoDeAtividade, LucideIcon> = {
  ATUALIZACAO_ENVIADA: ClipboardCheck,
  TREINO_CONCLUIDO: Dumbbell,
  PLANO_PUBLICADO: FileCheck,
  PESO_REGISTRADO: Scale,
};

/**
 * Os últimos 5 acontecimentos do aluno (Resumo da ficha), do mais novo ao mais antigo. Texto e destino vêm da regra pura
 * (`dominio/fichaDoAluno`); o item com destino abre o detalhe (a atualização em outra tela, a pasta pela `aoAbrirPasta`,
 * na aba Planos), o sem destino é só leitura. Vazio é uma linha discreta: nada é inventado quando não há evento.
 */
export function AtividadeRecente({ alunoId, aoAbrirPasta }: { alunoId: string; aoAbrirPasta: (pastaId: string) => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(`atividade-recente:${alunoId}`, () => atividadeRecenteDoAluno(alunoId));
  const itens = dados?.itens ?? [];
  return (
    <Cartao titulo="Atividade recente">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando a atividade recente" /> : null}
      {dados && itens.length === 0 ? <Texto variante="suave">Nenhuma atividade recente.</Texto> : null}
      {itens.length > 0 ? (
        <View style={estilos.lista}>
          {itens.map((item, i) => <Evento key={`${item.tipo}:${item.quando}:${i}`} item={item} aoAbrirPasta={aoAbrirPasta} />)}
        </View>
      ) : null}
    </Cartao>
  );
}

function Evento({ item, aoAbrirPasta }: { item: ItemDeAtividade; aoAbrirPasta: (pastaId: string) => void }) {
  const { cores } = useTema();
  const titulo = textoDoEvento(item);
  const quando = instanteRelativo(item.quando);
  const destino = destinoDoEvento(item);
  const Icone = ICONE[item.tipo] ?? History;
  if (destino?.tipo === 'rota') return <ItemDeLista titulo={titulo} detalhe={quando} Icone={Icone} href={destino.href} />;
  if (destino?.tipo === 'pasta') {
    return <ItemDeLista titulo={titulo} detalhe={quando} Icone={Icone} rotulo={`${titulo}, ${quando}, abrir a pasta`} aoTocar={() => aoAbrirPasta(destino.pastaId)} />;
  }
  // Sem tela de detalhe (treino concluído, peso): a mesma linha, sem toque nem seta.
  return (
    <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]} accessible accessibilityLabel={`${titulo}, ${quando}`}>
      <Icone size={20} color={cores.textoSuave} strokeWidth={2} />
      <View style={estilos.textos}>
        <Texto style={estilos.titulo}>{titulo}</Texto>
        <Texto variante="suave" numerico>{quando}</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  // Mesma caixa do `ItemDeLista`, para a lista não mudar de forma entre o item que abre e o que não abre.
  item: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1),
    borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1.25), paddingHorizontal: espaco(1.5),
  },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.semi },
});
