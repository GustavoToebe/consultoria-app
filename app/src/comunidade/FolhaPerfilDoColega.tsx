import { Award, UserX } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { obterPerfilDaComunidade } from '../api/comunidade';
import { dataParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { Folha } from '../ui/Folha';
import { IniciaisDePerfil } from '../ui/FotoDePerfil';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

/**
 * Perfil de um colega, aberto pelo autor de um post do mural: só nome, apelido, treinos concluídos e conquistas
 * (decisão 2 do plano: sem foto, contato, medidas, dieta nem saúde; nada de compartilhar). Busca só com a folha aberta;
 * 404 (equipe, outra consultoria, anonimizado) vira "Perfil não disponível" sem tentar de novo e sem dado inventado.
 */
export function FolhaPerfilDoColega({ autorId, aoFechar }: { autorId: string | null; aoFechar: () => void }) {
  const { cores } = useTema();
  const perfil = useCarregar(autorId ? `perfil-comunidade:${autorId}` : null, (chave) => obterPerfilDaComunidade(chave.slice('perfil-comunidade:'.length)));
  // Os dados de outro autor não aparecem enquanto o novo carrega.
  const dados = perfil.dadosDeOutraChave ? undefined : perfil.dados;
  // Reabrir o mesmo perfil busca de novo: o apelido pode ter sido removido ou o colega ter saído desde a última vez.
  // (Outro perfil ou a primeira abertura já buscam pela chave; só o que sobrou na memória pede a nova busca.)
  useEffect(() => {
    if (autorId && perfil.dados !== undefined && !perfil.dadosDeOutraChave) perfil.recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorId]);
  const naoDisponivel = perfil.erro instanceof ErroApi && perfil.erro.status === 404;

  return (
    <Folha visivel={!!autorId} titulo="Perfil na Comunidade" aoFechar={aoFechar}>
      {naoDisponivel ? (
        <Vazio Icone={UserX} titulo="Perfil não disponível" texto="Este perfil não pode ser aberto." />
      ) : perfil.erro ? (
        <MensagemErro texto={textoDoErro(perfil.erro)} erro={perfil.erro} tentarDeNovo={perfil.recarregar} />
      ) : !dados || perfil.carregando ? (
        <Esqueleto cartoes={1} texto="Carregando o perfil" />
      ) : (
        <View style={estilos.blocos}>
          <View style={estilos.linha}>
            <IniciaisDePerfil nome={dados.nome} tamanho={56} />
            <View style={estilos.encolher}>
              <View style={estilos.linha}>
                <Texto variante="bloco" nivel={2}>{dados.nome}</Texto>
                {dados.ehVoce ? <Selo texto="Você" tipo="neutro" /> : null}
              </View>
              {dados.apelido ? <Texto variante="suave" accessibilityLabel={`apelido ${dados.apelido}`}>«{dados.apelido}»</Texto> : null}
            </View>
          </View>

          <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
            <Texto variante="rotulo">Treinos concluídos</Texto>
            <Texto variante="bloco" numerico>{dados.treinosConcluidos}</Texto>
          </View>

          <View style={estilos.secao}>
            <Texto variante="secao" nivel={3}>Conquistas</Texto>
            {dados.conquistas.length ? dados.conquistas.map((c) => (
              <View key={c.id} style={[estilos.item, estilos.linha, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                <Award size={20} color={cores.texto} aria-hidden />
                <View style={estilos.encolher}>
                  <Texto variante="bloco">{c.titulo}</Texto>
                  <Texto variante="suave">{c.descricao}</Texto>
                  <Texto variante="pequeno" numerico>Conquistada em {dataParaTela(c.conquistadaEm)}</Texto>
                </View>
              </View>
            )) : <Texto variante="suave">Nenhuma conquista por enquanto.</Texto>}
          </View>
        </View>
      )}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  blocos: { gap: espaco(2) },
  secao: { gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 2 },
});
