import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { previaDaUniaoDeGrupos, unirGruposMusculares } from '../../api/gruposMusculares';
import type { Exercicio } from '../../api/tipos';
import { agruparGruposParecidos, gruposParaUnir, textoDasVariacoes, type GrupoAgrupado } from '../../dominio/gruposMusculares';
import {
  contagemDoGrupo, corpoDaUniao, erroDoNomeDoGrupo, MAXIMO_DO_NOME_DO_GRUPO, mensagemDeGruposUnidos, motivoDoUnir, nomesMarcados,
  sugestaoDoNome, textoDaPrevia, type PassoDaUniao,
} from '../../dominio/unirGruposMusculares';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { errosPorCampo, separarErros, textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

const web = Platform.OS === 'web';
const NENHUM: readonly Exercicio[] = [];
const NENHUM_NOME: readonly string[] = [];

/** Foco na web depois de a troca de passo ser desenhada (o alvo ainda não existe no toque que troca). */
function focarDepois(alvo: { current: { focus: () => void } | null }): void {
  if (web) setTimeout(() => alvo.current?.focus());
}

/**
 * Biblioteca › Exercícios › ⋯ › "Organizar grupos musculares" (27/11): os grupos da consultoria com a contagem, as
 * variações parecidas juntas numa linha (`agruparGruposParecidos`) com o ⓘ e "Unir variações", e marcar dois ou mais para
 * unir num nome só. O segundo passo troca título, corpo e rodapé da mesma folha (como a `EtapaDeFiltros`; o X, o Esc e o
 * voltar retornam à lista) e é a confirmação: nome do grupo, quantos exercícios mudam (prévia da API, que conta também os
 * arquivados) e "Unir grupos". Os exercícios vêm de quem abre (a lista inteira da aba, só os ativos).
 */
export function FolhaOrganizarGruposMusculares({ exercicios, erro, carregando, recarregar, aoFechar, aoUnir }: {
  /** `undefined` enquanto a primeira carga não chegou. */
  exercicios: readonly Exercicio[] | undefined;
  erro: unknown;
  carregando: boolean;
  recarregar: () => void;
  aoFechar: () => void;
  /** Depois de unir: a aba refaz a página e as contagens dos filtros (e esta lista, que vem dela). */
  aoUnir: () => void;
}) {
  const { width } = useWindowDimensions();
  // Os nomes como o servidor os compara: a união os envia exatos (`nomeDoGrupoNoServidor`).
  const linhas = agruparGruposParecidos(gruposParaUnir(exercicios ?? NENHUM));
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(() => new Set());
  const [passo, setPasso] = useState<PassoDaUniao>({ passo: 'lista' });
  const confirmando = passo.passo === 'confirmar';
  const uniao = useUniao(confirmando ? passo.nomes : null, {
    recarregarLista: recarregar,
    aoUnir: () => { setMarcadas(new Set()); setPasso({ passo: 'lista' }); aoUnir(); },
  });

  // Foco ao trocar de passo (web): no confirmar, o campo no PC e o "Voltar" na folha de baixo (sem abrir o teclado por
  // cima da prévia, como a `NovaColecao`); na volta, o "Unir" do rodapé (o botão que abriu o passo já não existe).
  const unir = useRef<View>(null);
  const voltar = useRef<View>(null);

  const abrirConfirmar = (nomes: string[]) => {
    uniao.comecar(nomes);
    setPasso({ passo: 'confirmar', nomes });
    focarDepois(width >= LARGURA_MENU_LATERAL ? uniao.campo : voltar);
  };
  const voltarALista = () => { if (uniao.enviando) return; setPasso({ passo: 'lista' }); focarDepois(unir); };

  if (confirmando) {
    return (
      <Folha visivel titulo="Unir grupos musculares" aoFechar={voltarALista}
        rodape={<>
          <Botao ref={voltar} rotulo="Voltar" tipo="secundario" desabilitado={uniao.enviando} aoTocar={voltarALista} />
          <Botao rotulo="Unir grupos" carregando={uniao.enviando} desabilitado={!!uniao.motivo} motivo={uniao.motivo ?? undefined} aoTocar={uniao.confirmar} />
        </>}>
        {uniao.corpo}
      </Folha>
    );
  }

  const nomes = nomesMarcados(linhas, marcadas);
  // Logo depois de unir a lista ainda é a antiga: marcar um nome que acabou de sumir daria uma união vazia.
  const atualizando = carregando && exercicios ? 'Atualizando os grupos…' : null;
  const motivo = atualizando ?? motivoDoUnir(nomes);
  const alternar = (chave: string) => setMarcadas((atual) => {
    const nova = new Set(atual);
    if (nova.has(chave)) nova.delete(chave); else nova.add(chave);
    return nova;
  });
  const quantas = linhas.filter((l) => marcadas.has(l.chave)).length;

  return (
    <Folha visivel titulo="Organizar grupos musculares" aoFechar={aoFechar}
      faixa={<View style={estilos.faixa}><Texto variante="suave">Marque dois ou mais grupos para juntá-los num nome só. Os exercícios da biblioteca passam a usar esse nome; os planos já montados não mudam.</Texto></View>}
      statusDoRodape={quantas ? <Texto variante="suave" numerico>{quantas === 1 ? '1 grupo marcado' : `${quantas} grupos marcados`}</Texto> : undefined}
      rodape={linhas.length ? (
        <Botao ref={unir} rotulo="Unir" rotuloAcessivel="Unir grupos marcados" desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => abrirConfirmar(nomes)} />
      ) : undefined}>
      {!exercicios && erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />
        : !exercicios ? <Esqueleto texto="Carregando grupos musculares" cartoes={3} />
        : exercicios.length === 0 ? <Vazio titulo="Nenhum exercício na biblioteca" texto="Cadastre ou importe exercícios para organizar os grupos musculares." nivel={3} />
        : linhas.length === 0 ? <Vazio titulo="Nenhum grupo muscular" texto="Os exercícios da biblioteca ainda não têm grupo muscular." nivel={3} />
        : (
          <>
            {/* Recarga que falhou (depois de unir): a lista antiga fica, com o erro e "Tentar de novo" em cima. */}
            {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
            <ListaDeLinhas divisorias>
              {linhas.map((l) => <LinhaDoGrupo key={l.chave} grupo={l} marcado={marcadas.has(l.chave)} motivo={atualizando}
                aoMarcar={() => alternar(l.chave)} aoUnirVariacoes={() => abrirConfirmar(l.nomes)} />)}
            </ListaDeLinhas>
          </>
        )}
    </Folha>
  );
}

/** Uma linha: caixa + nome + contagem; a linha que junta variações traz o ⓘ com elas e "Unir variações". */
function LinhaDoGrupo({ grupo, marcado, motivo, aoMarcar, aoUnirVariacoes }: {
  grupo: GrupoAgrupado; marcado: boolean; aoMarcar: () => void; aoUnirVariacoes: () => void;
  /** "Atualizando os grupos…": a lista é a de antes de unir e as variações podem já não existir. */
  motivo: string | null;
}) {
  // O balão do ⓘ abre para baixo: a linha sobe de camada enquanto ele está aberto, para a de baixo não pintar por cima.
  const [porCima, setPorCima] = useState(false);
  const variacoes = textoDasVariacoes(grupo);
  const contagem = contagemDoGrupo(grupo.total);
  const metadados = variacoes ? `${contagem} · ${grupo.variacoes.length} variações` : contagem;
  return (
    <View style={porCima ? estilos.porCima : null}>
      <LinhaDaLista titulo={grupo.rotulo} metadados={metadados} marcado={marcado} aoTocarTextos={aoMarcar}
        inicio={<CaixaDaLinha rotulo={`${grupo.rotulo}, ${metadados}`} marcado={marcado} aoMudar={aoMarcar} />}
        acoes={variacoes ? (
          <>
            <DicaDeTexto rotulo={`Variações de ${grupo.rotulo}`} texto={variacoes} aoMudar={setPorCima} />
            <Botao rotulo="Unir variações" rotuloAcessivel={`Unir variações de ${grupo.rotulo}`} tipo="secundario"
              desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={aoUnirVariacoes} />
          </>
        ) : undefined} />
    </View>
  );
}

/**
 * O passo de confirmar (estado e corpo): nome do grupo (sugestão: o mais curto), prévia da API e o envio. Sempre montado
 * com a folha, para os dois passos serem a MESMA `Folha` (trocar de componente fecharia e reabriria o modal); com `nomes`
 * nulo fica parado (sem prévia).
 */
function useUniao(nomes: readonly string[] | null, { aoUnir, recarregarLista }: { aoUnir: () => void; recarregarLista: () => void }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [nome, setNome] = useState('');
  const [tocado, setTocado] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<{ campo: string | null; geral: string | null } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoAgora = useRef(false);
  const campo = useRef<TextInput>(null);
  const origem = nomes ?? NENHUM_NOME;

  const problema = erroDoNomeDoGrupo(nome);
  const nomeAtrasado = useAtrasado(nome);
  const corpoDaPrevia = corpoDaUniao(origem, nomeAtrasado);
  // A prévia só sai no passo, com nome válido e assentado; a resposta de um nome anterior é descartada pela chave.
  const chave = nomes && !erroDoNomeDoGrupo(nomeAtrasado) ? JSON.stringify(corpoDaPrevia) : null;
  const previa = useCarregar(chave, () => previaDaUniaoDeGrupos(corpoDaPrevia));
  const emDia = nome === nomeAtrasado && !!previa.dados && !previa.carregando && !previa.dadosDeOutraChave;
  const erroDaPrevia = previa.erro && chave ? errosPorCampo(previa.erro).destino ?? null : null;
  const falhaDaPrevia = !!previa.erro && !!chave && !erroDaPrevia;
  const alterados = emDia ? previa.dados?.exerciciosAlterados ?? null : null;
  const erroDoCampo = (tocado ? problema : null) ?? erroDoEnvio?.campo ?? erroDaPrevia;
  // Com o nome inválido o botão fica ativo: tocar mostra o erro no campo (o motivo não repete a mensagem dele).
  const motivo = problema || erroDaPrevia ? null
    : falhaDaPrevia ? 'Não foi possível calcular quantos exercícios mudam.'
    : !emDia ? 'Calculando quantos exercícios mudam…'
    : alterados === 0 ? 'Nenhum exercício muda com este nome.'
    : null;

  const comecar = (escolhidos: readonly string[]) => {
    // A mesma seleção de antes teria a mesma chave e a prévia antiga contaria como em dia: força uma nova.
    setNome(sugestaoDoNome(escolhidos)); setTocado(false); setErroDoEnvio(null); previa.recarregar();
  };
  const confirmar = async () => {
    if (enviandoAgora.current || !nomes) return;
    if (problema || erroDaPrevia) { setTocado(true); campo.current?.focus(); return; }
    if (motivo) return;
    enviandoAgora.current = true; setEnviando(true); setErroDoEnvio(null);
    try {
      const r = await unirGruposMusculares(corpoDaUniao(nomes, nome));
      avisar(mensagemDeGruposUnidos(r.exerciciosAlterados), 'sucesso');
      aoUnir();
    } catch (e) {
      const { campos, geral } = separarErros(e, ['destino']);
      setErroDoEnvio({ campo: campos.destino ?? null, geral });
      if (campos.destino) campo.current?.focus();
      // Conflito: os grupos mudaram em outro lugar; a lista se atualiza para a volta.
      if (e instanceof ErroApi && e.status === 409) recarregarLista();
    } finally { enviandoAgora.current = false; setEnviando(false); }
  };

  const corpo = (
    <>
      <View style={estilos.grupo}>
        <Texto variante="rotulo" cor={cores.texto}>{origem.length} grupos a unir</Texto>
        <Texto>{origem.join(' · ')}</Texto>
      </View>
      <Campo ref={campo} rotulo="Nome do grupo" valor={nome} erro={erroDoCampo} maxLength={MAXIMO_DO_NOME_DO_GRUPO} autoComplete="off"
        returnKeyType="done" ajuda="Um dos nomes acima ou um nome novo."
        aoMudar={(t) => { setNome(t); setErroDoEnvio(null); }} onBlur={() => setTocado(true)} onSubmitEditing={() => void confirmar()} />
      {/* O número que decide é sempre o da API (conta também os arquivados), nunca a soma das linhas. */}
      <View style={[estilos.previa, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]} aria-live="polite">
        {alterados !== null ? (
          <>
            <Texto variante="bloco" numerico>{textoDaPrevia(alterados)}</Texto>
            <Texto variante="suave">Os exercícios destes grupos, inclusive os arquivados, passam a ser do grupo “{nome.trim()}”.</Texto>
          </>
        ) : falhaDaPrevia ? (
          <MensagemErro texto={textoDoErro(previa.erro)} erro={previa.erro} tentarDeNovo={previa.recarregar} />
        ) : (
          <Texto variante="suave">{problema || erroDaPrevia ? 'Corrija o nome para ver quantos exercícios mudam.' : 'Calculando quantos exercícios mudam…'}</Texto>
        )}
      </View>
      {erroDoEnvio?.geral ? <MensagemErro texto={erroDoEnvio.geral} /> : null}
    </>
  );

  return { corpo, motivo, enviando, campo, comecar, confirmar: () => void confirmar() };
}

const estilos = StyleSheet.create({
  // A `faixa` da Folha tem 8 px em cima e embaixo; mais 8 aqui dão o respiro do corpo (16), como na `FolhaColecoes`.
  faixa: { paddingVertical: espaco(1) },
  porCima: { zIndex: 10 },
  grupo: { gap: espaco(0.5) },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
});
