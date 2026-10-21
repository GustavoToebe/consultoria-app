import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarExercicios } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { gruposDosExercicios } from '../../dominio/catalogo';
import { MODALIDADES } from '../../dominio/modalidades';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';


/** Compara sem acento e sem caixa ("rosca" acha "Rosca Direta"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Escolher o exercício da biblioteca da consultoria (busca na lista). Também dá para usar só o nome digitado, sem
 * ligar à biblioteca (aí o progresso desse exercício não junta com outros planos). Com `multiplo` (exercício novo) dá
 * para marcar vários do grupo escolhido e adicionar de uma vez; sem ele (trocar um exercício) a escolha é uma só.
 * `aoEscolher` recebe sempre a lista, na ordem em que foram marcados.
 */
export function FolhaBiblioteca({
  visivel,
  multiplo = false,
  aoEscolher,
  aoFechar,
}: {
  visivel: boolean;
  multiplo?: boolean;
  aoEscolher: (escolhidos: (Exercicio | { nome: string })[]) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  // Cada abertura começa sem nada marcado (estado derivado da prop, o padrão do React).
  const [estavaVisivel, setEstavaVisivel] = useState(visivel);
  if (visivel !== estavaVisivel) {
    setEstavaVisivel(visivel);
    if (!visivel) setMarcados(new Set());
  }
  const { dados, erro, carregando, recarregar } = useCarregar(visivel ? 'biblioteca-exercicios' : null, () =>
    listarExercicios(),
  );
  const termo = normalizar(busca.trim());
  const grupos = gruposDosExercicios(dados ?? []);
  const noGrupo = (e: Exercicio, g: string) => !g || e.grupoMuscular?.trim() === g;
  // Trocar de grupo tira da seleção o que não é do grupo novo: só se adiciona o que está no grupo escolhido.
  const escolherGrupo = (g: string) => {
    setGrupo(g);
    const doGrupo = new Set((dados ?? []).filter((e) => noGrupo(e, g)).map((e) => e.id));
    setMarcados((atual) => new Set([...atual].filter((id) => doGrupo.has(id))));
  };
  const alternar = (id: string, marcar: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  const filtrados = (dados ?? []).filter(
    (e) =>
      noGrupo(e, grupo) &&
      (!termo || normalizar(`${e.nome} ${e.grupoMuscular ?? ''} ${e.equipamento ?? ''}`).includes(termo)),
  );

  const visiveis = filtrados.slice(0, 80);
  const todosMarcados = visiveis.length > 0 && visiveis.every((e) => marcados.has(e.id));
  const marcarOsVisiveis = () =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const e of visiveis) {
        if (todosMarcados) novo.delete(e.id);
        else novo.add(e.id);
      }
      return novo;
    });
  /** Os marcados na ordem em que foram marcados (o `Set` guarda a ordem de inserção). */
  const marcadosEmOrdem = (): Exercicio[] => {
    const porId = new Map((dados ?? []).map((e) => [e.id, e]));
    return [...marcados].flatMap((id) => porId.get(id) ?? []);
  };
  const adicionar = () => aoEscolher(marcadosEmOrdem());

  return (
    <Folha
      visivel={visivel}
      titulo="Escolher exercício"
      aoFechar={aoFechar}
      rodape={multiplo ? (
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo={marcados.size > 1 ? `Adicionar ${marcados.size} exercícios` : 'Adicionar exercício'} aoTocar={adicionar} desabilitado={marcados.size === 0} motivo="Marque ao menos um exercício." />
        </>
      ) : undefined}>
      <Campo rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} placeholder="Nome, grupo ou equipamento" autoFocus />
      {grupos.length ? (
        grupos.length + 1 > OPCOES_PARA_BUSCAR
          ? <EscolhaEmFolha rotulo="Grupo muscular" opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={escolherGrupo} />
          : <Escolha descricao="Grupo muscular" opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))]} valor={grupo} aoMudar={escolherGrupo} />
      ) : null}
      {busca.trim() ? (
        <Botao rotulo={`Exercício manual: “${busca.trim()}”`} rotuloAcessivel={`Usar só o nome ${busca.trim()}, fora da biblioteca`} tipo="secundario" aoTocar={() => aoEscolher([...marcadosEmOrdem(), { nome: busca.trim() }])} />
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
      {multiplo && visiveis.length > 1 ? (
        <Botao rotulo={todosMarcados ? 'Desmarcar todos os exercícios da lista' : `Marcar todos os ${visiveis.length} da lista`} tipo="fantasma" aoTocar={marcarOsVisiveis} />
      ) : null}
      {visiveis.map((e) => multiplo ? (
        <CaixaSelecao key={e.id} rotulo={e.nome} ajuda={[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento].filter(Boolean).join(' · ')} marcado={marcados.has(e.id)} aoMudar={(v) => alternar(e.id, v)} />
      ) : (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${e.nome}`}
          onPress={() => aoEscolher([e])}
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
