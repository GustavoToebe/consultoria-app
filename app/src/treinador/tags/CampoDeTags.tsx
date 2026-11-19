import { codigoApi } from '@plataforma/web';
import { Plus } from 'lucide-react-native';
import { useId, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from 'react-native';

import { aluno as buscarAluno } from '../../api/rotas';
import { criarTagDeAluno, definirTagsDoAluno, listarTagsDeAlunos } from '../../api/tagsDeAlunos';
import type { AlunoDetalhe, TagDeAluno } from '../../api/tipos';
import {
  COR_PADRAO_DA_TAG, erroDoNomeDaTag, idsDasTags, MAXIMO_DO_NOME_DA_TAG, MENSAGEM_LIMITE_DE_TAGS,
  nomeDaTagParaEnviar, podeAdicionarTag, proximasTags, tagPeloNome, traduzirErroDeTag,
} from '../../dominio/tagsDeAluno';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ChipDeTag } from './ChipDeTag';
import { AVISO_DAS_TAGS, opcoesDoCampo, type OpcaoDoCampo } from './textosDasTags';

/** Quanto o campo espera depois de perder o foco para fechar a lista (o toque numa sugestão chega depois do blur). */
const ESPERA_PARA_FECHAR_MS = 180;

type Envio = 'parado' | 'enviando';

/**
 * Campo "Tags" dos Dados do aluno (`docs/planos/tags-de-aluno.md`, D10), na edição, dentro da Configuração do
 * acompanhamento. Grava na hora (como o questionário), sem otimismo: a tela só muda com a resposta do `PUT /alunos/{id}/tags`.
 * Chips removíveis ("Remover tag X", 44 px); digitar filtra as tags da consultoria que o aluno não tem e oferece "Criar tag".
 * Teclado (combobox da WAI-ARIA, lista dentro do fluxo, sem modal que tire o foco do campo): setas andam nas sugestões,
 * Enter escolhe a destacada, a de nome igual ou cria; Esc fecha a lista; Backspace no campo vazio não apaga nada. Até 10.
 * Quem monta já conferiu `ALUNO_ALTERAR` e aluno não anonimizado. A lista da consultoria só é buscada aqui (na edição).
 */
export function CampoDeTags({ aluno, aoAlterar }: { aluno: AlunoDetalhe; aoAlterar: (a: AlunoDetalhe) => void }) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const consultoria = useCarregar('tags-de-alunos', () => listarTagsDeAlunos());
  const [texto, setTexto] = useState('');
  const [aberta, setAberta] = useState(false);
  // -1 = nada destacado (campo vazio: o Enter não escolhe a primeira sugestão por engano).
  const [destaque, setDestaque] = useState(-1);
  const [envio, setEnvio] = useState<Envio>('parado');
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<TextInput>(null);
  const fechar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefixo = `tag-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const doAluno = aluno.tags ?? [];
  const noLimite = !podeAdicionarTag(doAluno);
  const opcoes = opcoesDoCampo(consultoria.dados ?? [], doAluno, texto);
  const atual = destaque < opcoes.length ? destaque : -1;
  const listaAberta = aberta && !noLimite && (opcoes.length > 0 || texto.trim() !== '');
  const jaTem = texto.trim() !== '' && opcoes.length === 0 && !!tagPeloNome(doAluno, texto);

  const focarCampo = () => { if (Platform.OS === 'web') requestAnimationFrame(() => campo.current?.focus()); };
  const cancelarFechar = () => { if (fechar.current) clearTimeout(fechar.current); fechar.current = null; };

  const falhou = (e: unknown) => {
    const t = traduzirErroDeTag(e);
    setErro(t.mensagem);
    if (!t.recarregar) return;
    consultoria.recarregar();
    // Aluno anonimizado ou que sumiu: a ficha recarrega (o campo some com o anonimizado).
    const codigo = codigoApi(e);
    if (codigo === 'ALUNO_ANONIMIZADO' || (typeof e === 'object' && e !== null && (e as { status?: unknown }).status === 404)) {
      buscarAluno(aluno.id).then(aoAlterar, () => undefined);
    }
  };

  const gravar = async (novas: TagDeAluno[], aviso: string) => {
    const r = await definirTagsDoAluno(aluno.id, idsDasTags(novas));
    aoAlterar({ ...aluno, tags: r });
    setTexto('');
    setDestaque(-1);
    setErro(null);
    avisar(aviso, 'sucesso');
  };

  const enviar = async (passo: () => Promise<void>) => {
    if (envio === 'enviando') return;
    setEnvio('enviando');
    try {
      await passo();
    } catch (e) {
      falhou(e);
    } finally {
      setEnvio('parado');
      focarCampo();
    }
  };

  const adicionar = (tag: TagDeAluno) => {
    if (noLimite) return setErro(MENSAGEM_LIMITE_DE_TAGS);
    const novas = proximasTags(doAluno, { adicionar: tag });
    if (novas.length === doAluno.length) return setTexto('');
    void enviar(() => gravar(novas, `Tag “${tag.nome}” adicionada.`));
  };

  const remover = (tag: TagDeAluno) => {
    void enviar(() => gravar(proximasTags(doAluno, { remover: tag.id }), `Tag “${tag.nome}” removida.`));
  };

  // Criar = `POST /tags-de-alunos` com a cor padrão e depois o `PUT` do aluno. Nome que outra pessoa acabou de criar (409
  // `TAG_NOME_EM_USO`): a lista volta e a tag existente entra no aluno.
  const criar = (digitado: string) => {
    const problema = erroDoNomeDaTag(digitado);
    if (problema) return setErro(problema);
    if (noLimite) return setErro(MENSAGEM_LIMITE_DE_TAGS);
    const nome = nomeDaTagParaEnviar(digitado);
    void enviar(async () => {
      let tag: TagDeAluno | undefined;
      try {
        tag = await criarTagDeAluno({ nome, cor: COR_PADRAO_DA_TAG });
      } catch (e) {
        if (codigoApi(e) !== 'TAG_NOME_EM_USO') throw e;
        const lista = await listarTagsDeAlunos();
        consultoria.definir(lista);
        tag = tagPeloNome(lista, nome);
        // Sumiu entre o 409 e a nova leitura: fica a mensagem do nome em uso.
        if (!tag) throw e;
      }
      // A tag já existe na consultoria, mesmo que o PUT do aluno falhe: a lista volta para ela aparecer nas sugestões.
      consultoria.recarregar();
      await gravar(proximasTags(doAluno, { adicionar: tag }), `Tag “${tag.nome}” adicionada.`);
    });
  };

  const escolher = (o: OpcaoDoCampo) => (o.tipo === 'tag' ? adicionar(o.tag) : criar(o.nome));

  // Enter: a sugestão destacada; senão a tag de nome igual (da consultoria); senão cria.
  const confirmar = () => {
    if (envio === 'enviando') return;
    if (atual >= 0 && opcoes[atual]) return escolher(opcoes[atual]);
    if (!texto.trim()) return;
    const igual = tagPeloNome(consultoria.dados ?? [], texto);
    if (igual) return adicionar(igual);
    if (tagPeloNome(doAluno, texto)) return setTexto('');
    criar(texto);
  };

  const tecla = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const k = e.nativeEvent.key;
    if (k === 'Escape') {
      if (listaAberta) e.preventDefault();
      setAberta(false);
      setDestaque(-1);
      return;
    }
    if (k !== 'ArrowDown' && k !== 'ArrowUp') return;
    e.preventDefault();
    setAberta(true);
    if (!opcoes.length) return;
    const passo = k === 'ArrowDown' ? 1 : -1;
    setDestaque(atual < 0 ? (passo > 0 ? 0 : opcoes.length - 1) : (atual + passo + opcoes.length) % opcoes.length);
  };

  const idDaOpcao = (i: number) => `${prefixo}-${i}`;
  const enviando = envio === 'enviando';

  return (
    <View style={estilos.raiz}>
      <View style={estilos.topo}>
        <Texto variante="rotulo">Tags</Texto>
        <Texto variante="pequeno">{AVISO_DAS_TAGS}</Texto>
      </View>
      {doAluno.length ? (
        <View style={estilos.chips} role="list" aria-label="Tags do aluno">
          {doAluno.map((t) => (
            <View key={t.id} role="listitem"><ChipDeTag tag={t} aoRemover={() => remover(t)} desabilitado={enviando} /></View>
          ))}
        </View>
      ) : <Texto variante="suave">Nenhuma tag.</Texto>}
      {/* No limite o campo sai (um campo travado e com foco parecia ativo); a frase diz o porquê e o próximo passo. */}
      {noLimite ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{MENSAGEM_LIMITE_DE_TAGS} Remova uma para adicionar outra.</Texto>
      ) : null}
      {noLimite && erro && erro !== MENSAGEM_LIMITE_DE_TAGS ? <MensagemDeErro erro={erro} /> : null}
      {noLimite ? null : <Campo
        ref={campo}
        rotulo="Adicionar tag"
        rotuloOculto
        rotuloAcessivel="Adicionar tag ao aluno"
        placeholder="Digite para buscar ou criar…"
        valor={texto}
        maxLength={MAXIMO_DO_NOME_DA_TAG}
        autoCorrect={false}
        autoCapitalize="sentences"
        returnKeyType="done"
        submitBehavior="submit"
        erro={erro}
        aoMudar={(t) => { setTexto(t); setAberta(true); setErro(null); setDestaque(t.trim() ? 0 : -1); }}
        onKeyPress={tecla}
        onSubmitEditing={confirmar}
        onFocus={() => { cancelarFechar(); setAberta(true); }}
        onBlur={() => { cancelarFechar(); fechar.current = setTimeout(() => { setAberta(false); setDestaque(-1); }, ESPERA_PARA_FECHAR_MS); }}
        // Combobox da WAI-ARIA; os `aria-*` que o tipo do RN não tem, o react-native-web repassa.
        {...({
          role: 'combobox',
          'aria-expanded': listaAberta,
          'aria-autocomplete': 'list',
          'aria-controls': `${prefixo}-lista`,
          'aria-activedescendant': listaAberta && atual >= 0 ? idDaOpcao(atual) : undefined,
        } as object)}
      />}
      {enviando ? <Texto variante="pequeno" accessibilityLiveRegion="polite">Salvando as tags…</Texto> : null}
      {listaAberta ? (
        <View nativeID={`${prefixo}-lista`} {...({ role: 'listbox' } as object)} aria-label="Sugestões de tags"
          style={[estilos.lista, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          {opcoes.map((o, i) => (
            <Pressable key={o.tipo === 'tag' ? o.tag.id : 'criar'} nativeID={idDaOpcao(i)} role="option" aria-selected={i === atual}
              accessibilityLabel={o.tipo === 'tag' ? o.tag.nome : `Criar tag “${o.nome}”`}
              disabled={enviando}
              onPressIn={cancelarFechar}
              onHoverIn={() => setDestaque(i)}
              onPress={() => escolher(o)}
              style={(estado) => [estilos.opcao, { backgroundColor: i === atual || estado.pressed ? cores.sobre : 'transparent' }]}>
              {o.tipo === 'tag' ? <ChipDeTag tag={o.tag} larguraMaxima={260} /> : (
                <View style={estilos.criar}>
                  <Plus size={16} color={cores.texto} strokeWidth={2.5} />
                  <Texto style={estilos.textoCriar} numberOfLines={1}>Criar tag “{o.nome}”</Texto>
                </View>
              )}
            </Pressable>
          ))}
          {jaTem ? <Texto variante="suave" style={estilos.vazio} accessibilityLiveRegion="polite">O aluno já tem esta tag.</Texto> : null}
        </View>
      ) : null}
      {noLimite ? null : <Texto variante="pequeno">Grava na hora, sem esperar o Salvar.</Texto>}
      {consultoria.erro ? (
        <MensagemErro texto={`Não foi possível carregar as tags da consultoria. ${textoDoErro(consultoria.erro)}`} erro={consultoria.erro} tentarDeNovo={consultoria.recarregar} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(1) },
  topo: { gap: espaco(0.25) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(1.5) },
  lista: { borderWidth: 1, borderRadius: RAIO_CONTROLE, paddingVertical: espaco(0.5), marginTop: -espaco(0.5) },
  opcao: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  criar: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  textoCriar: { fontFamily: fontes.semi, flexShrink: 1 },
  vazio: { paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
});
