import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { alterarPastaModelo, criarPastaModelo, excluirPastaModelo } from '../../api/rotas';
import type { PastaModelo, Receita } from '../../api/tipos';
import { contagemDaColecao, erroDoNomeDaColecao, mensagemDeExcluirColecao, modelosPorColecao } from '../../dominio/colecoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { BORDA_DA_LINHA, RECUO_DA_LINHA } from '../../ui/colunasDaLista';
import { codigoApi, textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const MAXIMO_DO_NOME = 120;
const web = Platform.OS === 'web';
const NENHUMA: readonly PastaModelo[] = [];

/** Foco na web depois do efeito do painel da `Folha`, que leva o foco ao primeiro controle do conteúdo ao abrir. */
function focarDepois(alvo: RefObject<{ focus: () => void } | null>): () => void {
  if (!web) return () => undefined;
  const t = setTimeout(() => alvo.current?.focus());
  return () => clearTimeout(t);
}

interface Edicao { id: string; nome: string; erro: string | null; salvando: boolean }

/**
 * "Organizar coleções" (coleção = pasta de modelos da API): criar no topo fixo, uma linha por coleção com a contagem
 * de modelos (de todos os tipos), renomear na própria linha e excluir com confirmação. `inicialId` abre já renomeando
 * aquela coleção (lápis da faixa do grupo). Só a lista rola; título, texto e "Nova coleção" ficam fixos (`faixa`).
 */
export function FolhaColecoes({ colecoes: pastas, erroDasColecoes, modelos, inicialId = null, aoFechar, atualizar }: {
  /** `undefined` enquanto carrega. */
  colecoes: readonly PastaModelo[] | undefined;
  erroDasColecoes: unknown;
  /** `undefined` se os modelos não carregaram: a contagem some e a confirmação não arrisca número. */
  modelos: readonly Receita[] | undefined;
  inicialId?: string | null;
  aoFechar: () => void;
  atualizar: () => void;
}) {
  const contagem = modelos ? modelosPorColecao(modelos) : undefined;
  const ordenadas = pastas ? [...pastas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : undefined;
  const lista = pastas ?? NENHUMA;

  const [edicao, setEdicao] = useState<Edicao | null>(() => {
    const p = inicialId ? pastas?.find((c) => c.id === inicialId) : undefined;
    return p ? { id: p.id, nome: p.nome, erro: null, salvando: false } : null;
  });
  const [excluir, setExcluir] = useState<PastaModelo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroGeral, setErroGeral] = useState<unknown>(null);

  // Foco devolvido depois de salvar, cancelar e excluir (web): ao "Renomear" da linha, ou ao campo de criar. Na exclusão,
  // espera a coleção sumir da lista (o painel devolve o foco ao "Excluir" ao fechar, antes do recarregar).
  const botoes = useRef(new Map<string, View>());
  const campoNovo = useRef<TextInput>(null);
  const [focar, setFocar] = useState<{ alvo: string; depoisDeSumir?: string } | null>(null);
  useEffect(() => {
    if (!focar || !web) return;
    if (focar.depoisDeSumir && lista.some((c) => c.id === focar.depoisDeSumir)) return;
    const alvo = focar.alvo === 'novo' ? campoNovo.current : botoes.current.get(focar.alvo);
    (alvo as unknown as HTMLElement | null)?.focus?.();
    setFocar(null);
  }, [focar, lista]);

  // Esc na renomeação cancela só a linha. O `Modal` da `Folha` fecha no `keyup` (no `document`), então o `keyup` desse
  // mesmo Esc é engolido na captura da `window`; o mesmo para o Esc que fecha a confirmação de excluir por cima da folha.
  const linhaEmEdicao = useRef<View>(null);
  const estado = useRef<{ editando: boolean; confirmando: boolean; cancelar: () => void }>({ editando: false, confirmando: false, cancelar: () => undefined });
  useEffect(() => { estado.current = { editando: !!edicao, confirmando: !!excluir, cancelar: cancelarEdicao }; });
  useEffect(() => {
    if (!web) return undefined;
    let engolir = false;
    const descer = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (estado.current.confirmando) { engolir = true; return; }
      const linha = linhaEmEdicao.current as unknown as HTMLElement | null;
      if (estado.current.editando && linha?.contains(e.target as Node)) { engolir = true; estado.current.cancelar(); }
    };
    const subir = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !engolir) return;
      engolir = false;
      e.stopPropagation();
    };
    window.addEventListener('keydown', descer, true);
    window.addEventListener('keyup', subir, true);
    return () => { window.removeEventListener('keydown', descer, true); window.removeEventListener('keyup', subir, true); };
  }, []);

  const renomear = (p: PastaModelo) => { setErroGeral(null); setEdicao({ id: p.id, nome: p.nome, erro: null, salvando: false }); };
  const cancelarEdicao = () => { if (!edicao) return; const id = edicao.id; setEdicao(null); setFocar({ alvo: id }); };
  const salvarEdicao = async () => {
    if (!edicao || edicao.salvando) return;
    const atual = lista.find((c) => c.id === edicao.id);
    const erro = erroDoNomeDaColecao(edicao.nome, lista, edicao.id);
    if (erro || !atual) { setEdicao({ ...edicao, erro: erro ?? 'Esta coleção não existe mais.' }); return; }
    setEdicao({ ...edicao, erro: null, salvando: true });
    try {
      await alterarPastaModelo(atual.id, edicao.nome.trim(), atual.versao);
      atualizar(); setEdicao(null); setFocar({ alvo: atual.id });
    } catch (e) {
      const conflito = codigoApi(e) === 'CONFLITO_EDICAO';
      if (conflito) atualizar();
      setEdicao((ed) => ed && { ...ed, salvando: false, erro: conflito ? 'Esta coleção mudou em outro lugar. Confira o nome e salve de novo.' : textoDoErro(e) });
    }
  };
  const confirmarExclusao = async () => {
    if (!excluir || excluindo || !ordenadas) return;
    const i = ordenadas.findIndex((c) => c.id === excluir.id);
    const vizinha = ordenadas[i + 1] ?? ordenadas[i - 1];
    setExcluindo(true); setErroGeral(null);
    try {
      await excluirPastaModelo(excluir.id);
      if (edicao?.id === excluir.id) setEdicao(null);
      setFocar({ alvo: vizinha?.id ?? 'novo', depoisDeSumir: excluir.id });
      atualizar();
    } catch (e) { setErroGeral(e); } finally { setExcluindo(false); setExcluir(null); }
  };

  const faixa = <NovaColecao ref={campoNovo} colecoes={lista} focarAoAbrir={!inicialId} atualizar={atualizar} />;

  return <Folha visivel titulo="Organizar coleções" aoFechar={aoFechar} faixa={faixa}>
    {!ordenadas && erroDasColecoes ? <MensagemErro texto={textoDoErro(erroDasColecoes)} erro={erroDasColecoes} tentarDeNovo={atualizar} />
      : !ordenadas ? <Esqueleto texto="Carregando coleções" cartoes={2} />
      : ordenadas.length === 0 ? <Texto variante="suave">Nenhuma coleção ainda.</Texto>
      : <ListaDeLinhas divisorias>{ordenadas.map((p) => edicao?.id === p.id
        ? <LinhaRenomeando key={p.id} ref={linhaEmEdicao} nomeAtual={p.nome} edicao={edicao}
          aoMudar={(nome) => setEdicao({ ...edicao, nome, erro: null })} aoSalvar={() => void salvarEdicao()} aoCancelar={cancelarEdicao} />
        : <LinhaDaLista key={p.id} titulo={p.nome} metadados={contagem ? contagemDaColecao(contagem.get(p.id) ?? 0) : undefined} acoes={<>
          <Botao ref={(no) => { if (no) botoes.current.set(p.id, no); else botoes.current.delete(p.id); }}
            rotulo="Renomear" rotuloAcessivel={`Renomear coleção ${p.nome}`} tipo="secundario" aoTocar={() => renomear(p)} />
          <Botao rotulo="Excluir" rotuloAcessivel={`Excluir coleção ${p.nome}`} tipo="perigoTexto" aoTocar={() => setExcluir(p)} />
        </>} />)}</ListaDeLinhas>}
    {erroGeral ? <MensagemErro texto={textoDoErro(erroGeral)} erro={erroGeral} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir coleção “${excluir?.nome ?? ''}”?`}
      mensagem={mensagemDeExcluirColecao(excluir && contagem ? contagem.get(excluir.id) ?? 0 : undefined)}
      rotuloConfirmar="Excluir coleção" perigo carregando={excluindo}
      aoCancelar={() => { if (!excluindo) setExcluir(null); }} aoConfirmar={() => void confirmarExclusao()} />
  </Folha>;
}

/** "Nova coleção": campo e "Criar coleção" na mesma linha, fixos acima da lista. O botão nunca apaga: o erro vai no campo. */
function NovaColecao({ ref, colecoes, focarAoAbrir, atualizar }: {
  ref: RefObject<TextInput | null>; colecoes: readonly PastaModelo[]; focarAoAbrir: boolean; atualizar: () => void;
}) {
  const { cores } = useTema();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const enviando = useRef(false);
  // Como a `Folha`: na folha de baixo (celular) o foco não vai ao campo, para o teclado não abrir por cima da lista.
  const { width } = useWindowDimensions();
  const [focar] = useState(focarAoAbrir && width >= LARGURA_MENU_LATERAL);
  useEffect(() => (focar ? focarDepois(ref) : undefined), [focar, ref]);
  const criar = async () => {
    if (enviando.current) return;
    const problema = erroDoNomeDaColecao(nome, colecoes);
    if (problema) { setErro(problema); ref.current?.focus(); return; }
    enviando.current = true; setCriando(true); setErro(null);
    try { await criarPastaModelo(nome.trim()); setNome(''); atualizar(); } catch (e) { setErro(textoDoErro(e)); }
    finally { enviando.current = false; setCriando(false); }
  };
  return <View style={estilos.faixa}>
    <Texto variante="suave">Coleções só organizam seus modelos. Para aplicar treinos e dietas juntos a um aluno, use um pacote.</Texto>
    <View style={estilos.grupo}>
      {/* Rótulo fora do `Campo` para o botão alinhar com a caixa, também quando o erro aparece embaixo dela. */}
      <Texto variante="rotulo" cor={cores.texto} aria-hidden>Nova coleção</Texto>
      <View style={estilos.linhaDoCampo}>
        <View style={estilos.campo}>
          <Campo ref={ref} rotulo="Nova coleção" rotuloOculto valor={nome} erro={erro} maxLength={MAXIMO_DO_NOME} autoComplete="off" returnKeyType="done"
            aoMudar={(t) => { setNome(t); if (erro) setErro(null); }} onSubmitEditing={() => void criar()} />
        </View>
        <Botao rotulo="Criar coleção" tipo="acao" carregando={criando} aoTocar={() => void criar()} />
      </View>
    </View>
  </View>;
}

/** A linha em renomeação: o nome vira campo já focado, com "Cancelar" e "Salvar"; Enter salva e Esc cancela (na folha). */
function LinhaRenomeando({ ref, nomeAtual, edicao, aoMudar, aoSalvar, aoCancelar }: {
  ref: RefObject<View | null>; nomeAtual: string; edicao: Edicao; aoMudar: (nome: string) => void; aoSalvar: () => void; aoCancelar: () => void;
}) {
  const campo = useRef<TextInput>(null);
  useEffect(() => focarDepois(campo), []);
  return <View ref={ref} style={estilos.linhaEmEdicao}>
    <View style={estilos.campo}>
      <Campo ref={campo} rotulo={`Nome da coleção ${nomeAtual}`} rotuloOculto valor={edicao.nome} erro={edicao.erro} maxLength={MAXIMO_DO_NOME} autoComplete="off"
        autoFocus={!web} selectTextOnFocus returnKeyType="done" aoMudar={aoMudar} onSubmitEditing={aoSalvar} />
    </View>
    <View style={estilos.acoesDaEdicao}>
      <Botao rotulo="Cancelar" rotuloAcessivel={`Cancelar renomear ${nomeAtual}`} tipo="secundario" desabilitado={edicao.salvando} aoTocar={aoCancelar} />
      <Botao rotulo="Salvar" rotuloAcessivel={`Salvar nome da coleção ${nomeAtual}`} carregando={edicao.salvando} aoTocar={aoSalvar} />
    </View>
  </View>;
}

const estilos = StyleSheet.create({
  // A `faixa` da Folha tem 8 px em cima e embaixo; mais 8 aqui dão o respiro do corpo (16).
  faixa: { paddingVertical: espaco(1), gap: espaco(1.5) },
  grupo: { gap: espaco(0.5) },
  // Topo alinhado: o erro desce sob o campo e o botão fica rente à caixa. Quebra para baixo só se não couber.
  linhaDoCampo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1) },
  campo: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  // O mesmo recuo da `LinhaDaLista` (borda + 12 px), para o campo começar onde o nome estava.
  linhaEmEdicao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1), padding: RECUO_DA_LINHA + BORDA_DA_LINHA },
  acoesDaEdicao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
