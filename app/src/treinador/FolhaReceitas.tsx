import { StyleSheet, View } from 'react-native';

import { listarReceitas } from '../api/rotas';
import type { Receita, TipoReceita } from '../api/tipos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Carregando, MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * Receitas da consultoria (pontos de partida editáveis, como no Servirea): "Usar esta receita" troca o conteúdo do
 * alvo por uma cópia com uids novos. A tela do editor oferece "Desfazer" logo depois.
 */
export function FolhaReceitas({
  tipo,
  titulo,
  explicacao,
  aoUsar,
  aoFechar,
}: {
  tipo: TipoReceita;
  titulo: string;
  explicacao: string;
  aoUsar: (r: Receita) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { dados, erro, carregando, recarregar } = useCarregar(`receitas:${tipo}`, () => listarReceitas(tipo));
  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}>
      <Texto variante="suave">{explicacao}</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados && dados.length === 0 ? <Vazio titulo="Sem receitas deste tipo" texto="Cadastre uma receita na tela Receitas para reutilizá-la nos planos." /> : null}
      {dados?.map((r) => (
        <View key={r.id} style={[estilos.receita, { borderColor: cores.borda }]}>
          <Texto variante="subtitulo">{r.nome}</Texto>
          {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
          <View style={estilos.botoes}>
            <Botao rotulo="Usar esta receita" tipo="secundario" aoTocar={() => aoUsar(r)} />
          </View>
        </View>
      ))}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  receita: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
});
