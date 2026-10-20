import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarExercicios } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { gruposDosExercicios } from '../../dominio/catalogo';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export const MODALIDADES: Record<string, string> = {
  LIVRE: 'Peso livre',
  MAQUINA: 'Máquina',
  ELASTICO: 'Elástico',
  PESO_CORPORAL: 'Peso corporal',
  CARDIO: 'Cardio',
  OUTRO: 'Outro',
};

/** Compara sem acento e sem caixa ("rosca" acha "Rosca Direta"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Escolher o exercício da biblioteca da consultoria (busca na lista). Também dá para usar só o nome digitado, sem
 * ligar à biblioteca (aí o progresso desse exercício não junta com outros planos).
 */
export function FolhaBiblioteca({
  visivel,
  aoEscolher,
  aoFechar,
}: {
  visivel: boolean;
  aoEscolher: (e: Exercicio | { nome: string }) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const { dados, erro, carregando, recarregar } = useCarregar(visivel ? 'biblioteca-exercicios' : null, () =>
    listarExercicios(),
  );
  const termo = normalizar(busca.trim());
  const grupos = gruposDosExercicios(dados ?? []);
  const filtrados = (dados ?? []).filter(
    (e) =>
      (!grupo || e.grupoMuscular?.trim() === grupo) &&
      (!termo || normalizar(`${e.nome} ${e.grupoMuscular ?? ''} ${e.equipamento ?? ''}`).includes(termo)),
  );

  return (
    <Folha visivel={visivel} titulo="Escolher exercício" aoFechar={aoFechar}>
      <Campo rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} placeholder="Nome, grupo ou equipamento" autoFocus />
      {grupos.length ? (
        grupos.length + 1 > OPCOES_PARA_BUSCAR
          ? <EscolhaEmFolha rotulo="Grupo muscular" opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={setGrupo} />
          : <Escolha descricao="Grupo muscular" opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={setGrupo} />
      ) : null}
      {busca.trim() ? (
        <Botao rotulo={`Exercício manual: “${busca.trim()}”`} rotuloAcessivel={`Usar só o nome ${busca.trim()}, fora da biblioteca`} tipo="secundario" aoTocar={() => aoEscolher({ nome: busca.trim() })} />
      ) : <Texto variante="pequeno">Não está na biblioteca? Digite o nome na busca para usar um exercício manual.</Texto>}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && filtrados.length === 0 ? (
        <Texto variante="suave">
          {dados.length === 0
            ? 'A biblioteca está vazia. Importe exercícios do catálogo na tela Biblioteca.'
            : grupo ? 'Nenhum exercício neste grupo com essa busca.' : 'Nenhum exercício encontrado.'}
        </Texto>
      ) : null}
      {filtrados.slice(0, 80).map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${e.nome}`}
          onPress={() => aoEscolher(e)}
          style={({ pressed }) => [
            estilos.item,
            { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : cores.superficie },
          ]}>
          <Texto>{e.nome}</Texto>
          <Texto variante="pequeno">
            {[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento].filter(Boolean).join(' · ')}
          </Texto>
        </Pressable>
      ))}
      {filtrados.length > 80 ? <Texto variante="pequeno">Mostrando 80. Refine a busca.</Texto> : null}
      <View />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
