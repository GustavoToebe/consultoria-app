import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarExercicios } from '../../api/rotas';
import type { Exercicio, ExercicioPlano } from '../../api/tipos';
import { podeSerAlternativa } from '../../dominio/alternativasDoExercicio';
import { gruposDosExercicios } from '../../dominio/catalogo';
import { chipsDoGrupo, selecaoDepoisDoGrupo } from '../../dominio/filtrosDosCartoes';
import { coincideComBuscaExercicio } from '../../dominio/termosExerciciosIngles';
import { MODALIDADES } from '../../dominio/modalidades';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { useEtapaDeFiltros } from '../../ui/EtapaDeFiltros';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { MostrarMais, useMostrarMais } from '../../ui/MostrarMais';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';


/** "Todos" do grupo muscular: sem filtro. */
const TODOS_OS_GRUPOS = '';

/** Compara sem acento e sem caixa ("rosca" acha "Rosca Direta"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Escolher o exercício da biblioteca da consultoria (busca na lista). Também dá para usar só o nome digitado, sem
 * ligar à biblioteca (aí o progresso desse exercício não junta com outros planos). Com `multiplo` (exercício novo) dá
 * para marcar vários do grupo escolhido e adicionar de uma vez; sem ele (trocar um exercício) a escolha é uma só.
 * `aoEscolher` recebe sempre a lista, na ordem em que foram marcados. Com `cardio` ("+ Adicionar cardio") a lista traz só
 * os exercícios de cardio da biblioteca; o nome digitado também vale. O grupo muscular é um filtro: "Filtros" troca a
 * folha pela etapa "Filtros de exercícios" (`ui/EtapaDeFiltros`, sem painel por cima) e Aplicar/Cancelar/Esc voltam à lista
 * com a busca e as marcações (aplicar outro grupo tira só o que não é dele, com aviso: `selecaoDepoisDoGrupo`).
 *
 * `alternativaDe` ("Adicionar alternativa" do exercício): escolha única, só o que pode ser alternativa dele
 * (`podeSerAlternativa`: mesmo tipo, sem o principal nem as que já estão) e sem nome digitado (a alternativa é da biblioteca).
 */
export function FolhaBiblioteca({
  visivel,
  multiplo = false,
  cardio = false,
  alternativaDe,
  aoEscolher,
  aoFechar,
}: {
  visivel: boolean;
  multiplo?: boolean;
  cardio?: boolean;
  alternativaDe?: ExercicioPlano;
  aoEscolher: (escolhidos: (Exercicio | { nome: string })[]) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState(TODOS_OS_GRUPOS);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  // Quantos saíram da seleção no último Aplicar com outro grupo (fica até a próxima mudança de filtro ou o fechar).
  const [avisoDoGrupo, setAvisoDoGrupo] = useState<string | null>(null);
  const { dados, erro, carregando, recarregar } = useCarregar(visivel ? 'biblioteca-exercicios' : null, () =>
    listarExercicios(),
  );
  const termo = normalizar(busca.trim());
  const daFolha = (dados ?? []).filter((e) => (alternativaDe ? podeSerAlternativa(alternativaDe, e) : !cardio || e.modalidade === 'CARDIO'));
  const grupos = gruposDosExercicios(daFolha);
  const noGrupo = (e: Exercicio, g: string) => !g || e.grupoMuscular?.trim() === g;
  // Aplicar outro grupo tira da seleção o que não é do grupo novo (só se adiciona o que está no grupo escolhido), com aviso.
  const aplicarGrupo = (g: string) => {
    if (g === grupo) return;
    setGrupo(g);
    const r = selecaoDepoisDoGrupo(marcados, g ? new Set(daFolha.filter((e) => noGrupo(e, g)).map((e) => e.id)) : null, g);
    setMarcados(r.marcados);
    setAvisoDoGrupo(r.aviso);
  };
  const etapa = useEtapaDeFiltros({ valor: grupo, limpo: TODOS_OS_GRUPOS, aoAplicar: aplicarGrupo });
  // Cada abertura começa sem nada marcado e na lista (estado derivado da prop, o padrão do React).
  const [estavaVisivel, setEstavaVisivel] = useState(visivel);
  if (visivel !== estavaVisivel) {
    setEstavaVisivel(visivel);
    if (!visivel) { setMarcados(new Set()); setAvisoDoGrupo(null); etapa.reiniciar(); }
  }
  const opcoesDoGrupo = [{ valor: TODOS_OS_GRUPOS, rotulo: 'Todos' }, ...grupos.map((g) => ({ valor: g, rotulo: g }))];
  const chips = chipsDoGrupo(grupo, TODOS_OS_GRUPOS);
  const assunto = cardio ? 'cardio' : 'exercícios';
  const alternar = (id: string, marcar: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  const filtrados = daFolha.filter(
    (e) =>
      noGrupo(e, grupo) &&
      (!termo || coincideComBuscaExercicio(normalizar(`${e.nome} ${e.grupoMuscular ?? ''} ${e.equipamento ?? ''}`), termo)),
  );

  const { limite, mostrarMais } = useMostrarMais(`${termo}\u0000${grupo}`);
  // "Marcar" vale só para o que está na tela (os exibidos), nunca para o que o "Mostrar mais" ainda não trouxe.
  const visiveis = filtrados.slice(0, limite);
  const cortada = filtrados.length > visiveis.length;
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

  if (etapa.aberta) {
    return (
      <Folha visivel={visivel} titulo={`Filtros de ${assunto}`} aoFechar={etapa.fechar} rodape={etapa.rodape}>
        {etapa.corpo(<Escolha rotulo="Grupo muscular" valor={etapa.rascunho} opcoes={opcoesDoGrupo} aoMudar={etapa.mudar} />)}
        {multiplo && marcados.size > 0 ? (
          <Texto variante="pequeno">
            {marcados.size === 1 ? '1 exercício marcado' : `${marcados.size} exercícios marcados`}. Ao aplicar outro grupo, sai da seleção o que não for dele.
          </Texto>
        ) : null}
      </Folha>
    );
  }

  return (
    <Folha
      visivel={visivel}
      titulo={alternativaDe ? 'Escolher alternativa' : cardio ? 'Escolher cardio' : 'Escolher exercício'}
      aoFechar={aoFechar}
      statusDoRodape={avisoDoGrupo ? <Texto variante="pequeno" role="status">{avisoDoGrupo}</Texto> : undefined}
      rodape={multiplo ? (
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo={cardio ? (marcados.size > 1 ? `Adicionar ${marcados.size} cardios` : 'Adicionar cardio') : marcados.size > 1 ? `Adicionar ${marcados.size} exercícios` : 'Adicionar exercício'}
            aoTocar={adicionar} desabilitado={marcados.size === 0} motivo={cardio ? 'Marque ao menos um cardio.' : 'Marque ao menos um exercício.'} />
        </>
      ) : undefined}>
      <Campo rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} placeholder={cardio ? 'Ex.: Esteira, bicicleta' : 'Nome, grupo ou equipamento'} autoFocus={!etapa.jaAbriu} />
      {grupos.length ? (
        etapa.barra(
          <BarraDeFiltros valor={grupo} limpo={TODOS_OS_GRUPOS} aoAplicar={aplicarGrupo} chips={chips} aoTirar={() => aplicarGrupo(TODOS_OS_GRUPOS)}
            seletores={() => null} painelLateral={{ titulo: `Filtros de ${assunto}` }} naFolha={{ abrir: etapa.abrir }} />,
        )
      ) : null}
      {alternativaDe ? (
        <Texto variante="pequeno">{`Só aparecem exercícios da biblioteca do mesmo tipo de “${alternativaDe.nome || 'o exercício'}” (cardio só por cardio) que ainda não são alternativas dele.`}</Texto>
      ) : busca.trim() ? (
        <Botao rotulo={`${cardio ? 'Cardio' : 'Exercício'} manual: “${busca.trim()}”`} rotuloAcessivel={`Usar só o nome ${busca.trim()}, fora da biblioteca`} tipo="secundario" aoTocar={() => aoEscolher([...marcadosEmOrdem(), { nome: busca.trim() }])} />
      ) : <Texto variante="pequeno">{cardio ? 'Não está na biblioteca? Digite o nome na busca para usar um cardio manual.' : 'Não está na biblioteca? Digite o nome na busca para usar um exercício manual.'}</Texto>}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && filtrados.length === 0 ? (
        <Texto variante="suave">
          {daFolha.length === 0
            ? alternativaDe ? 'Nenhum outro exercício do mesmo tipo na biblioteca. Cadastre ou importe na tela Biblioteca.' : cardio ? 'A biblioteca não tem cardio. Digite o nome (ex.: Esteira) para usar um cardio manual.' : 'A biblioteca está vazia. Importe exercícios do catálogo na tela Biblioteca.'
            : grupo ? 'Nenhum exercício neste grupo com essa busca.' : 'Nenhum exercício encontrado.'}
        </Texto>
      ) : null}
      {multiplo && visiveis.length > 1 ? (
        <Botao rotulo={todosMarcados ? (cortada ? 'Desmarcar os exibidos' : 'Desmarcar todos os exercícios da lista') : cortada ? `Marcar os ${visiveis.length} exibidos` : `Marcar todos os ${visiveis.length} da lista`} tipo="fantasma" aoTocar={marcarOsVisiveis} />
      ) : null}
      {visiveis.map((e) => multiplo ? (
        <CaixaSelecao key={e.id} rotulo={e.nome} ajuda={[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento].filter(Boolean).join(' · ')} marcado={marcados.has(e.id)} aoMudar={(v) => alternar(e.id, v)} />
      ) : (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${e.nome}`}
          onPress={() => aoEscolher([e])}
          style={(estado) => [
            estilos.item,
            { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.sobre : cores.superficie },
          ]}>
          <Texto>{e.nome}</Texto>
          <Texto variante="pequeno">
            {[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento].filter(Boolean).join(' · ')}
          </Texto>
        </Pressable>
      ))}
      <MostrarMais limite={limite} total={filtrados.length} aoMostrarMais={mostrarMais} />
      <View />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.25), minHeight: ALVO_TOQUE },
});
