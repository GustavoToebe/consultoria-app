import { Plus } from 'lucide-react-native';
import { useEffect, useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';

import { listarExercicios } from '../../api/rotas';
import type { Exercicio, ExercicioPlano } from '../../api/tipos';
import { podeSerAlternativa } from '../../dominio/alternativasDoExercicio';
import { filtrosAoAbrir, linhaDoManual, linhaVizinha, preFiltroDaTroca } from '../../dominio/escolhaDoExercicio';
import {
  chipsDosExercicios, coincideComABusca, contagemDosGrupos, contagemDosTipos, detalheDoExercicio, modalidadesExistentes, nomeDaModalidade, opcoesDeModalidade,
  passaNosFiltros, rotuloDoMostrar, SEM_FILTROS_DE_EXERCICIOS, semOFiltro, type FiltrosDeExercicios,
} from '../../dominio/exerciciosDaBiblioteca';
import { selecaoDepoisDoGrupo } from '../../dominio/filtrosDosCartoes';
import { comContagemDasModalidades } from '../../dominio/painelDeExercicios';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { Esqueleto } from '../../ui/Esqueleto';
import { useEtapaDeFiltros } from '../../ui/EtapaDeFiltros';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { DesenhoDaCaixa, LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { MostrarMais, useMostrarMais } from '../../ui/MostrarMais';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { LADO_DA_MINIATURA, LegendaDasModalidades, LinhaDoExercicio, PainelDeExercicios } from '../biblioteca/ModalidadeDoExercicio';
import { FiltroDoTipoDeCardio } from './FiltroDoTipoDeCardio';

/** Compara sem acento e sem caixa ("rosca" acha "Rosca Direta"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Chave estável dos filtros (os conjuntos em ordem): o "Mostrar mais" e a linha ativa recomeçam quando ela muda. */
const chaveDosFiltros = (f: FiltrosDeExercicios) => JSON.stringify([[...f.grupos].sort(), [...f.modalidades].sort(), f.video, f.imagem, [...f.tiposDeCardio].sort()]);

/**
 * O mouse só aponta uma linha quando anda de verdade: a folha que abre embaixo do ponteiro parado recebe um "move" sem
 * deslocamento do navegador, e aí a linha embaixo dele roubaria o destaque do "Atual" (e o Enter da busca a escolheria).
 */
// O tipo do RN não traz o `movementX` do `PointerEvent` da web (no aparelho ele não vem: o toque não aponta).
const ponteiroAndou = (e: object) => ('movementX' in e && !!e.movementX) || ('movementY' in e && !!e.movementY);

type Linha ={ tipo: 'exercicio'; exercicio: Exercicio } | { tipo: 'manual'; nome: string; texto: string; rotulo: string };

/**
 * Escolher o exercício da biblioteca da consultoria (`docs/design-e-front.md`; a mesma linha, legenda e painel de filtros da
 * Biblioteca › Exercícios). Também dá para usar só o nome digitado, sem ligar à biblioteca: quando a busca não acha nenhum
 * exercício, a lista mostra só "Usar “texto” como exercício manual" (aí o progresso desse exercício não junta com outros planos). Com
 * `multiplo` (exercício novo de musculação) dá para marcar vários e adicionar de uma vez; sem ele (trocar um exercício, e
 * o cardio, que é sempre um só, 27.5) a escolha é uma e fecha a folha.
 * `aoEscolher` recebe sempre a lista, na ordem em que foram marcados. Com `cardio` ("+ Adicionar cardio", trocar um cardio
 * ou a alternativa de um cardio) a folha é "Escolher cardio": só os cardios da biblioteca, sem o filtro de modalidade, com
 * o "Tipo de cardio" no lugar do grupo muscular (que o cardio não tem, D13 de docs/planos/cardio-e-hiit.md) e a linha
 * "● Cardio · Escada". Os filtros (grupo muscular ou tipo de cardio em vários, modalidade, vídeo
 * e imagem) são uma etapa da mesma folha (`ui/EtapaDeFiltros`, sem painel por cima) e Aplicar/Cancelar/Esc voltam à lista com
 * a busca e as marcações (aplicar outros filtros tira só o que não passa neles, com aviso: `selecaoDepoisDoGrupo`).
 *
 * `atual` (trocar): a folha abre filtrada pelo grupo dele (no cardio, pelo tipo; um chip que se tira) e com a linha dele
 * marcada "Atual".
 * A lista é um `listbox` controlado pela busca (combobox da WAI-ARIA, como o `CampoDeTags`): ↑↓ andam pelas linhas à vista
 * (e a do manual), Enter escolhe (ou marca, em `multiplo`) e o foco fica na busca.
 *
 * `alternativaDe` ("Adicionar alternativa" do exercício): escolha única, só o que pode ser alternativa dele
 * (`podeSerAlternativa`: mesmo tipo, sem o principal nem as que já estão) e sem nome digitado (a alternativa é da biblioteca).
 */
export function FolhaBiblioteca({
  visivel,
  multiplo = false,
  cardio = false,
  alternativaDe,
  atual,
  aoEscolher,
  aoFechar,
}: {
  visivel: boolean;
  multiplo?: boolean;
  cardio?: boolean;
  alternativaDe?: ExercicioPlano;
  atual?: ExercicioPlano;
  aoEscolher: (escolhidos: (Exercicio | { nome: string })[]) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const prefixo = useId();
  const [busca, setBusca] = useState('');
  // Nulo = os filtros de quando a folha abriu (na troca, o grupo do atual, que só se sabe com a biblioteca carregada).
  const [escolhidos, setEscolhidos] = useState<FiltrosDeExercicios | null>(null);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  // Quantos saíram da seleção no último Aplicar (fica até a próxima mudança de filtro ou o fechar).
  const [avisoDoGrupo, setAvisoDoGrupo] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<{ chave: string; indice: number } | null>(null);
  const { dados, erro, carregando, recarregar } = useCarregar(visivel ? 'biblioteca-exercicios' : null, () => listarExercicios());
  const daFolha = (dados ?? []).filter((e) => (alternativaDe ? podeSerAlternativa(alternativaDe, e) : !cardio || e.modalidade === 'CARDIO'));
  // O cardio não tem grupo muscular: o painel troca os grupos pelos tipos de cardio.
  const grupos = cardio ? [] : contagemDosGrupos(daFolha);
  const tipos = cardio ? contagemDosTipos(daFolha) : [];
  const filtros = escolhidos ?? filtrosAoAbrir(preFiltroDaTroca(atual, daFolha, cardio));
  const passam = (f: FiltrosDeExercicios) => daFolha.filter((e) => passaNosFiltros(e, f) && coincideComABusca(e, busca, true));
  const aplicarFiltros = (f: FiltrosDeExercicios) => {
    if (chaveDosFiltros(f) === chaveDosFiltros(filtros)) return;
    setEscolhidos(f);
    const algum = chipsDosExercicios(f, grupos);
    // Só se adiciona o que passa nos filtros: sai da seleção o resto. A frase nomeia o grupo quando ele é o único filtro.
    const soUmGrupo = algum.length === 1 && f.grupos.size === 1 ? [...f.grupos][0] : null;
    const r = selecaoDepoisDoGrupo(marcados, algum.length ? new Set(daFolha.filter((e) => passaNosFiltros(e, f)).map((e) => e.id)) : null, soUmGrupo);
    setMarcados(r.marcados);
    setAvisoDoGrupo(r.aviso);
  };
  const etapa = useEtapaDeFiltros({ valor: filtros, limpo: SEM_FILTROS_DE_EXERCICIOS, aoAplicar: aplicarFiltros, rotuloDoAplicar: (f) => rotuloDoMostrar(passam(f).length, cardio) });
  // Cada abertura começa na lista, sem busca, sem nada marcado e com os filtros de abrir (estado derivado da prop, o padrão do React).
  const [estavaVisivel, setEstavaVisivel] = useState(visivel);
  if (visivel !== estavaVisivel) {
    setEstavaVisivel(visivel);
    if (!visivel) { setMarcados(new Set()); setAvisoDoGrupo(null); setBusca(''); setEscolhidos(null); setDestaque(null); etapa.reiniciar(); }
  }
  const chips = chipsDosExercicios(filtros, grupos);
  const assunto = cardio ? 'cardio' : 'exercícios';
  const alternar = (id: string, marcar: boolean) =>
    setMarcados((agora) => {
      const novo = new Set(agora);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  const filtrados = passam(filtros);

  const chaveDaLista = `${busca.trim()}\u0000${chaveDosFiltros(filtros)}`;
  const { limite, mostrarMais } = useMostrarMais(chaveDaLista);
  // "Marcar" vale só para o que está na tela (os exibidos), nunca para o que o "Mostrar mais" ainda não trouxe.
  const visiveis = filtrados.slice(0, limite);
  const cortada = filtrados.length > visiveis.length;
  const todosMarcados = visiveis.length > 0 && visiveis.every((e) => marcados.has(e.id));
  const marcarOsVisiveis = () =>
    setMarcados((agora) => {
      const novo = new Set(agora);
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

  const manual = linhaDoManual(busca, { alternativa: !!alternativaDe, cardio, resultados: filtrados.length });
  const linhas: Linha[] = [...visiveis.map((e) => ({ tipo: 'exercicio' as const, exercicio: e })), ...(manual ? [{ tipo: 'manual' as const, ...manual }] : [])];
  // A linha ativa: a que o teclado (ou o mouse) apontou; senão, com busca a primeira (Enter escolhe o primeiro resultado) e,
  // sem busca, a do exercício atual da troca.
  const chaveDoDestaque = `${chaveDaLista}\u0000${limite}`;
  const padrao = busca.trim() ? (linhas.length ? 0 : -1) : linhas.findIndex((l) => l.tipo === 'exercicio' && !!atual?.exercicioId && l.exercicio.id === atual.exercicioId);
  const ativa = destaque?.chave === chaveDoDestaque && destaque.indice < linhas.length ? destaque.indice : padrao;
  const idDaOpcao = (i: number) => `${prefixo}-opcao-${i}`;
  const apontar = (i: number) => setDestaque({ chave: chaveDoDestaque, indice: i });

  const acionar = (i: number) => {
    const l = linhas[i];
    if (!l) return;
    if (l.tipo === 'manual') { aoEscolher([...marcadosEmOrdem(), { nome: l.nome }]); return; }
    const e = l.exercicio;
    if (multiplo) { apontar(i); alternar(e.id, !marcados.has(e.id)); return; }
    // Escolher o próprio exercício da troca não muda nada: só fecha.
    if (atual?.exercicioId && e.id === atual.exercicioId) { aoFechar(); return; }
    aoEscolher([e]);
  };
  const tecla = (ev: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const k = ev.nativeEvent.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp') return;
    ev.preventDefault();
    const i = linhaVizinha(ativa, k === 'ArrowDown' ? 1 : -1, linhas.length);
    if (i >= 0) apontar(i);
  };
  // A linha ativa fica à vista quando o teclado anda (a lista rola dentro da folha).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || ativa < 0 || !visivel) return;
    document.getElementById(`${prefixo}-opcao-${ativa}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [ativa, prefixo, visivel]);

  if (etapa.aberta) {
    return (
      <Folha visivel={visivel} titulo={`Filtros de ${assunto}`} aoFechar={etapa.fechar} rodape={etapa.rodape} largura={LARGURA_FOLHA_LARGA}>
        {etapa.corpo(
          <PainelDeExercicios atual={etapa.rascunho} mudar={etapa.mudar} grupos={grupos} comModalidade={!cardio}
            // O cardio não tem grupo muscular: o "Tipo de cardio" fica na coluna da esquerda.
            esquerda={cardio ? (
              <FiltroDoTipoDeCardio opcoes={tipos} marcados={etapa.rascunho.tiposDeCardio}
                aoMudar={(m) => etapa.mudar({ ...etapa.rascunho, tiposDeCardio: m })} />
            ) : undefined}
            opcoesDeModalidades={comContagemDasModalidades(opcoesDeModalidade(modalidadesExistentes(daFolha), etapa.rascunho.modalidades), daFolha)} />,
        )}
        {multiplo && marcados.size > 0 ? (
          <Texto variante="pequeno">
            {marcados.size === 1 ? '1 exercício marcado' : `${marcados.size} exercícios marcados`}. Ao aplicar outros filtros, sai da seleção o que não passar neles.
          </Texto>
        ) : null}
      </Folha>
    );
  }

  const vazio = dados && filtrados.length === 0 ? (
    daFolha.length === 0
      ? alternativaDe ? 'Nenhum outro exercício do mesmo tipo na biblioteca. Cadastre ou importe na tela Biblioteca.'
        : cardio ? 'A biblioteca não tem cardio. Digite o nome (ex.: Esteira) para usar um cardio manual.'
          : 'A biblioteca está vazia. Importe exercícios do catálogo na tela Biblioteca, ou digite o nome para usar um exercício manual.'
      : chips.length && busca.trim() ? `Nenhum ${cardio ? 'cardio' : 'exercício'} com “${busca.trim()}” nesses filtros.`
        : chips.length ? `Nenhum ${cardio ? 'cardio' : 'exercício'} com esses filtros.`
          : `Nenhum ${cardio ? 'cardio' : 'exercício'} com “${busca.trim()}” na biblioteca.`
  ) : null;

  return (
    <Folha
      visivel={visivel}
      titulo={alternativaDe ? 'Escolher alternativa' : cardio ? 'Escolher cardio' : 'Escolher exercício'}
      aoFechar={aoFechar}
      largura={LARGURA_FOLHA_LARGA}
      statusDoRodape={avisoDoGrupo ? <Texto variante="pequeno" role="status">{avisoDoGrupo}</Texto> : undefined}
      rodape={multiplo ? (
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo={marcados.size > 1 ? `Adicionar ${marcados.size} exercícios` : 'Adicionar exercício'}
            aoTocar={adicionar} desabilitado={marcados.size === 0} motivo="Marque ao menos um exercício." />
        </>
      ) : undefined}>
      {etapa.barra(
        <BarraDeFiltros valor={filtros} limpo={SEM_FILTROS_DE_EXERCICIOS} aoAplicar={aplicarFiltros} chips={chips}
          aoTirar={(chave) => aplicarFiltros(semOFiltro(filtros, chave))} seletores={() => null}
          painelLateral={{ titulo: `Filtros de ${assunto}` }} naFolha={{ abrir: etapa.abrir }}
          busca={{
            rotulo: 'Buscar na biblioteca', valor: busca, aoMudar: setBusca, placeholder: cardio ? 'Ex.: Esteira, bicicleta' : 'Nome, grupo ou equipamento',
            campo: {
              autoFocus: !etapa.jaAbriu, onKeyPress: tecla, submitBehavior: 'submit', onSubmitEditing: () => acionar(ativa), enterKeyHint: multiplo ? 'done' : 'go',
              // Combobox da WAI-ARIA sem trocar o papel do campo (continua `textbox`): os `aria-*` que o RN não tipa, o react-native-web repassa.
              ...({ 'aria-controls': `${prefixo}-lista`, 'aria-activedescendant': ativa >= 0 ? idDaOpcao(ativa) : undefined } as object),
            },
          }} />,
      )}
      {alternativaDe ? (
        <Texto variante="pequeno">{`Só aparecem exercícios da biblioteca do mesmo tipo de “${alternativaDe.nome || 'o exercício'}” (cardio só por cardio) que ainda não são alternativas dele.`}</Texto>
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {vazio ? <Texto variante="suave" accessibilityLiveRegion="polite">{vazio}</Texto> : null}
      {multiplo && visiveis.length > 1 ? (
        <Botao rotulo={todosMarcados ? (cortada ? 'Desmarcar os exibidos' : 'Desmarcar todos os exercícios da lista') : cortada ? `Marcar os ${visiveis.length} exibidos` : `Marcar todos os ${visiveis.length} da lista`} tipo="fantasma" aoTocar={marcarOsVisiveis} />
      ) : null}
      {/* Na folha do cardio todas as linhas são Cardio: a legenda só repetiria isso. */}
      {visiveis.length && !cardio ? <LegendaDasModalidades modalidades={modalidadesExistentes(visiveis)} /> : null}
      {linhas.length ? (
        <View nativeID={`${prefixo}-lista`} {...({ role: 'listbox', 'aria-multiselectable': multiplo || undefined } as object)}
          aria-label={alternativaDe ? 'Exercícios para alternativa' : cardio ? 'Cardios da biblioteca' : 'Exercícios da biblioteca'}>
          <ListaDeLinhas divisorias>
            {linhas.map((l, i) => {
              const ehAtiva = i === ativa;
              const doAtual = l.tipo === 'exercicio' && !!atual?.exercicioId && l.exercicio.id === atual.exercicioId;
              const marcado = l.tipo === 'exercicio' && marcados.has(l.exercicio.id);
              const rotulo = l.tipo === 'manual' ? l.rotulo : [l.exercicio.nome, `${nomeDaModalidade(l.exercicio.modalidade)}${detalheDoExercicio(l.exercicio) ? ` · ${detalheDoExercicio(l.exercicio)}` : ''}`, doAtual ? 'atual' : ''].filter(Boolean).join(', ');
              return (
                <Pressable key={l.tipo === 'manual' ? 'manual' : l.exercicio.id} nativeID={idDaOpcao(i)} role="option" focusable={false}
                  aria-selected={multiplo ? marcado : ehAtiva} accessibilityLabel={rotulo}
                  onPointerMove={(ev) => { if (i !== ativa && ponteiroAndou(ev.nativeEvent)) apontar(i); }} onPress={() => acionar(i)}>
                  {l.tipo === 'manual' ? (
                    <LinhaDaLista titulo={l.texto} marcado={ehAtiva}
                      inicio={(
                        <View style={estilos.inicio}>
                          {multiplo ? <View style={estilos.lugarDaCaixa} /> : null}
                          <View style={[estilos.mais, { borderColor: cores.divisor, backgroundColor: cores.superficie3 }]}><Plus size={22} color={cores.texto} strokeWidth={2.25} /></View>
                        </View>
                      )} />
                  ) : (
                    <LinhaDoExercicio exercicio={l.exercicio} marcado={ehAtiva} antes={multiplo ? <DesenhoDaCaixa marcado={marcado} /> : undefined}
                      selos={doAtual ? [{ texto: 'Atual', tipo: 'neutro' }] : undefined} />
                  )}
                </Pressable>
              );
            })}
          </ListaDeLinhas>
        </View>
      ) : null}
      <MostrarMais limite={limite} total={filtrados.length} aoMostrarMais={mostrarMais} />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  inicio: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  // O lugar da caixa desenhada (24 px) na escolha de vários: o "+" alinha com as miniaturas de cima.
  lugarDaCaixa: { width: 24 },
  mais: { width: LADO_DA_MINIATURA, height: LADO_DA_MINIATURA, borderWidth: 1, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' },
});
