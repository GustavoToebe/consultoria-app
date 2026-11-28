import { Ellipsis, Lock, Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import { apagarTagDeAluno, criarTagDeAluno, listarTagsDeAlunos, renomearTagDeAluno } from '../../api/tagsDeAlunos';
import type { CorDaTag, TagDaConsultoria } from '../../api/tipos';
import {
  contadorDoNome, maisUsadas, MINIMO_DE_MAIS_USADAS, mostrarBuscaDasTags, tagsDaLista, textoDeExcluirTag, textoDosAlunosDaTag,
} from '../../dominio/listaDeTags';
import {
  COR_DAS_TAGS, COR_PADRAO_DA_TAG, erroDoNomeDaTag, MAXIMO_DO_NOME_DA_TAG, MENSAGEM_TAG_NOME_EM_USO, nomeDaTagParaEnviar, tagPeloNome,
  textoDeRenomear, traduzirErroDeTag,
} from '../../dominio/tagsDeAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { RECUO_DA_LINHA, BORDA_DA_LINHA } from '../../ui/colunasDaLista';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas, type ColunaDaLista } from '../../ui/LinhaDaLista';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useAreaDaTela } from '../../ui/useAreaDaTela';
import { useCarregar } from '../../ui/useCarregar';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { ChipDeTag } from './ChipDeTag';
import { CoresDaTag } from './CoresDaTag';
import { AVISO_DE_SAUDE_DAS_TAGS } from './textosDasTags';

interface ErroDoForm { mensagem: string; noCampo?: 'nome' | 'cor' }
/** Uma gravação por vez na tela inteira: criar, renomear, trocar a cor e excluir nunca se cruzam (a lista é uma só). */
type Envio = null | { tipo: 'criar' | 'renomear' | 'cor' | 'excluir'; id?: string };

const LARGURA_MAXIMA = 880;
const LARGURA_DA_LATERAL = 280;
/** A coluna "Mais usadas" só cabe com a lista no máximo e a lateral ao lado (~1280 de janela sem o menu). */
const AREA_PARA_A_LATERAL = LARGURA_MAXIMA + espaco(4) + LARGURA_DA_LATERAL;
/** Abaixo disto o "Criar tag" quebra em duas linhas: nome e botão em cima, cores e prévia embaixo. */
const AREA_DA_CRIACAO_EM_LINHA = 720;
const COLUNA: readonly ColunaDaLista[] = [{ chave: 'tag', rotulo: 'Tag', peso: 1 }];

const rotuloDaCor = (cor: CorDaTag) => COR_DAS_TAGS.find((c) => c.valor === cor)?.rotulo ?? cor;
const idDasAcoes = (id: string) => `acoes-da-tag-${id}`;
/** Web: o foco volta ao ⋯ da linha depois de salvar ou cancelar (o `IconeBotao` não tem `ref`). */
function focarAcoes(id: string) {
  if (Platform.OS !== 'web') return;
  setTimeout(() => document.getElementById(idDasAcoes(id))?.querySelector<HTMLElement>('[role="button"],button')?.focus(), 0);
}

/**
 * Tags dos alunos (Configurações; `docs/planos/tags-de-aluno.md`, D5 e D10; lista compacta de 28/11). No topo, "Criar tag"
 * numa linha (nome com contador, cor em bolinhas, prévia do selo e o botão; Enter cria). Embaixo, uma linha por tag em
 * ordem alfabética: o selo (a mesma peça da lista de alunos), a contagem como link para Alunos filtrado pela tag, as
 * bolinhas que trocam a cor na hora (aviso com "Desfazer") e o ⋯ com Renomear (na própria linha) e Excluir (painel que diz
 * de quantos alunos ela sai). Mais de 12 tags, a busca aparece. Só com `ALUNO_LER`, a lista fica só leitura. Nada é
 * otimista: cada linha muda depois da resposta, com a `versao` lida (409 recarrega a lista).
 */
export function CartaoTagsDosAlunos() {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const { largura } = useAreaDaTela();
  const podeGerir = pode('ALUNO_ALTERAR');
  const lista = useCarregar('tags-dos-alunos-configuracoes', () => listarTagsDeAlunos());
  const todas = lista.dados ?? [];
  const [busca, setBusca] = useState('');
  const tags = tagsDaLista(todas, busca);
  const usadas = maisUsadas(todas);
  const comLateral = largura >= AREA_PARA_A_LATERAL && usadas.length >= MINIMO_DE_MAIS_USADAS;

  const [nome, setNome] = useState('');
  const [cor, setCor] = useState<CorDaTag>(COR_PADRAO_DA_TAG);
  const [erroDaNova, setErroDaNova] = useState<ErroDoForm | null>(null);
  const campoNovo = useRef<TextInput>(null);
  // Uma linha em renomeação por vez; a `versao` é lida da lista na hora de salvar.
  const [edicao, setEdicao] = useState<{ id: string; nome: string } | null>(null);
  const [erroDaEdicao, setErroDaEdicao] = useState<ErroDoForm | null>(null);
  const [envio, setEnvio] = useState<Envio>(null);
  const [menu, setMenu] = useState<TagDaConsultoria | null>(null);
  const [excluir, setExcluir] = useState<TagDaConsultoria | null>(null);
  // Erro que não é de um campo (409 de conflito, 404, sem conexão): fica no topo da lista até a próxima ação.
  const [alerta, setAlerta] = useState<string | null>(null);

  const trocar = (t: TagDaConsultoria) => lista.definir([...todas.filter((x) => x.id !== t.id), t]);
  const falhou = (e: unknown, noForm: (erro: ErroDoForm) => void) => {
    const t = traduzirErroDeTag(e);
    if (t.noCampo) noForm({ mensagem: t.mensagem, noCampo: t.noCampo });
    else setAlerta(t.mensagem);
    if (t.recarregar) lista.recarregar();
    return t;
  };
  // A trava em `ref`: o "Desfazer" do aviso chega depois, com o `envio` de quando foi criado.
  const travado = useRef(false);
  const enviar = async (qual: NonNullable<Envio>, passo: () => Promise<void>) => {
    if (travado.current) return;
    travado.current = true;
    setEnvio(qual);
    setAlerta(null);
    try {
      await passo();
    } finally {
      travado.current = false;
      setEnvio(null);
    }
  };

  const criar = () => {
    const problema = erroDoNomeDaTag(nome) ?? (tagPeloNome(todas, nome) ? MENSAGEM_TAG_NOME_EM_USO : null);
    if (problema) {
      setErroDaNova({ mensagem: problema, noCampo: 'nome' });
      campoNovo.current?.focus();
      return;
    }
    void enviar({ tipo: 'criar' }, async () => {
      try {
        const criada = await criarTagDeAluno({ nome: nomeDaTagParaEnviar(nome), cor });
        trocar(criada);
        setNome('');
        setCor(COR_PADRAO_DA_TAG);
        setErroDaNova(null);
        avisar(`Tag “${criada.nome}” criada.`, 'sucesso');
      } catch (e) {
        falhou(e, setErroDaNova);
      }
      // Pronto para a próxima (ou para corrigir o nome recusado).
      campoNovo.current?.focus();
    });
  };

  const cancelarEdicao = () => {
    if (!edicao) return;
    const id = edicao.id;
    setEdicao(null);
    setErroDaEdicao(null);
    focarAcoes(id);
  };
  const salvarNome = () => {
    if (!edicao) return;
    const atual = todas.find((t) => t.id === edicao.id);
    const problema = erroDoNomeDaTag(edicao.nome) ?? (tagPeloNome(todas.filter((t) => t.id !== edicao.id), edicao.nome) ? MENSAGEM_TAG_NOME_EM_USO : null);
    if (problema || !atual) return setErroDaEdicao({ mensagem: problema ?? 'Esta tag não existe mais.', noCampo: 'nome' });
    void enviar({ tipo: 'renomear', id: atual.id }, async () => {
      try {
        const salva = await renomearTagDeAluno(atual.id, { nome: nomeDaTagParaEnviar(edicao.nome), cor: atual.cor, versao: atual.versao });
        trocar(salva);
        setEdicao(null);
        setErroDaEdicao(null);
        focarAcoes(salva.id);
        avisar(`Tag renomeada para “${salva.nome}”.`, 'sucesso');
      } catch (e) {
        // Conflito ou tag que sumiu: a lista volta e a linha fecha (a versão lida não vale mais); o aviso fica no topo.
        const t = falhou(e, setErroDaEdicao);
        if (t.recarregar && !t.noCampo) setEdicao(null);
      }
    });
  };

  // Trocar a cor grava na hora; o "Desfazer" do aviso grava a cor de antes com a versão que voltou agora.
  const mudarCor = (t: { id: string; nome: string; versao: number }, nova: CorDaTag, anterior: CorDaTag | null) => {
    void enviar({ tipo: 'cor', id: t.id }, async () => {
      try {
        const salva = await renomearTagDeAluno(t.id, { nome: t.nome, cor: nova, versao: t.versao });
        // O "Desfazer" vem depois e a lista deste momento pode estar velha: busca de novo em vez de trocar a linha.
        if (anterior) trocar(salva);
        else lista.recarregar();
        if (anterior) {
          avisar(`Cor da tag “${salva.nome}”: ${rotuloDaCor(nova)}.`, 'neutro', { rotulo: 'Desfazer', aoTocar: () => mudarCor(salva, anterior, null) });
        } else {
          avisar(`Cor da tag “${salva.nome}” desfeita.`, 'sucesso');
        }
      } catch (e) {
        falhou(e, (f) => setAlerta(f.mensagem));
      }
    });
  };

  const confirmarExcluir = () => {
    const tag = excluir;
    if (!tag) return;
    void enviar({ tipo: 'excluir', id: tag.id }, async () => {
      try {
        await apagarTagDeAluno(tag.id, tag.versao);
        lista.definir(todas.filter((t) => t.id !== tag.id));
        avisar(`Tag “${tag.nome}” excluída.`, 'sucesso');
        if (podeGerir) campoNovo.current?.focus();
      } catch (e) {
        falhou(e, (f) => setAlerta(f.mensagem));
      } finally {
        setExcluir(null);
      }
    });
  };

  const ocupado = !!envio;
  const comBusca = mostrarBuscaDasTags(todas.length);
  const titulo = lista.dados ? `Tags da consultoria (${todas.length})` : 'Tags da consultoria';

  return (
    <View style={estilos.raiz}>
      <View style={estilos.saude}>
        <View aria-hidden><Lock size={16} color={cores.textoSuave} strokeWidth={2} /></View>
        <Texto variante="suave">{AVISO_DE_SAUDE_DAS_TAGS}</Texto>
      </View>
      <View style={estilos.colunas}>
        <View style={estilos.principal}>
          <Cartao titulo={titulo} nivel={2} descricao={podeGerir ? undefined : 'Só quem pode alterar os alunos cria, renomeia ou exclui tags.'}>
            {podeGerir ? (
              <CriarTag campo={campoNovo} nome={nome} cor={cor} erro={erroDaNova} enviando={envio?.tipo === 'criar'} ocupado={ocupado}
                emLinha={largura === 0 || largura >= AREA_DA_CRIACAO_EM_LINHA}
                aoMudarNome={(n) => { setNome(n); setErroDaNova(null); }} aoMudarCor={(c) => { setCor(c); setErroDaNova(null); }} aoCriar={criar} />
            ) : null}
            {alerta ? <Alerta tom="atencao" texto={alerta} /> : null}
            {comBusca ? (
              <View style={estilos.busca}>
                <Campo rotulo="Buscar tag" valor={busca} aoMudar={setBusca} autoCorrect={false} autoComplete="off" returnKeyType="search" />
              </View>
            ) : null}
            {lista.erro && !lista.dados ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
            {!lista.dados && lista.carregando ? <Esqueleto texto="Carregando as tags" cartoes={3} /> : null}
            {lista.dados && todas.length === 0 ? (
              <Vazio titulo="Nenhuma tag ainda" nivel={3}
                texto={podeGerir ? 'Crie a primeira acima ou digite uma tag nova no campo Tags, em Dados do aluno.' : 'A equipe ainda não criou tags para os alunos.'} />
            ) : null}
            {todas.length > 0 && tags.length === 0 ? <Vazio titulo="Nenhuma tag encontrada" nivel={3} texto="Confira a busca ou apague o texto para ver todas." /> : null}
            {tags.length ? (
              <ListaDeLinhas divisorias>
                {tags.map((t) => (edicao?.id === t.id ? (
                  <LinhaRenomeando key={t.id} tag={t} nome={edicao.nome} erro={erroDaEdicao?.mensagem ?? null} salvando={envio?.tipo === 'renomear'}
                    aoMudar={(n) => { setEdicao({ id: t.id, nome: n }); setErroDaEdicao(null); }} aoSalvar={salvarNome} aoCancelar={cancelarEdicao} />
                ) : (
                  <LinhaDaLista key={t.id} titulo={t.nome}
                    colunas={{ definicao: COLUNA, celulas: { tag: <TagEContagem tag={t} /> } }}
                    acoes={podeGerir ? (
                      <View style={estilos.acoesDaLinha}>
                        <CoresDaTag rotulo={`Cor da tag ${t.nome}`} valor={t.cor} ocupado={ocupado} aoEscolher={(c) => mudarCor(t, c, t.cor)} />
                        <View nativeID={idDasAcoes(t.id)}>
                          <IconeBotao Icone={Ellipsis} rotulo={`Mais ações da tag ${t.nome}`} desabilitado={ocupado} aoTocar={() => { setAlerta(null); setMenu(t); }} />
                        </View>
                      </View>
                    ) : undefined} />
                )))}
              </ListaDeLinhas>
            ) : null}
          </Cartao>
        </View>
        {comLateral ? (
          <View style={estilos.lateral}>
            <Cartao titulo="Mais usadas" nivel={2} descricao="Pelo número de alunos.">
              {usadas.map((t) => (
                <View key={t.id} style={estilos.usada}>
                  <ChipDeTag tag={t} larguraMaxima={160} />
                  <Texto variante="pequeno" numerico>{textoDosAlunosDaTag(t.totalAlunos)}</Texto>
                </View>
              ))}
            </Cartao>
          </View>
        ) : null}
      </View>
      {menu ? (
        <FolhaDeAcoes titulo={`Tag “${menu.nome}”`} aoFechar={() => setMenu(null)} acoes={[
          { rotulo: 'Renomear', Icone: Pencil, detalhe: textoDeRenomear(menu), aoTocar: () => { setErroDaEdicao(null); setEdicao({ id: menu.id, nome: menu.nome }); } },
          { rotulo: 'Excluir', Icone: Trash2, perigo: true, detalhe: menu.totalAlunos > 0 ? `Sai de ${textoDosAlunosDaTag(menu.totalAlunos)}.` : 'Nenhum aluno tem esta tag.', aoTocar: () => setExcluir(menu) },
        ]} />
      ) : null}
      <PainelConfirmacao
        visivel={!!excluir}
        titulo={excluir ? `Excluir a tag “${excluir.nome}”?` : 'Excluir a tag?'}
        mensagem={excluir ? textoDeExcluirTag(excluir.totalAlunos) : undefined}
        rotuloConfirmar="Excluir tag"
        perigo
        carregando={envio?.tipo === 'excluir'}
        aoConfirmar={confirmarExcluir}
        aoCancelar={() => { if (excluir) focarAcoes(excluir.id); setExcluir(null); }}
      />
    </View>
  );
}

/** "Criar tag" numa linha: nome (contador dentro), cores, prévia do selo e o botão. Estreito: nome e botão, depois cores e prévia. */
function CriarTag({ campo, nome, cor, erro, enviando, ocupado, emLinha, aoMudarNome, aoMudarCor, aoCriar }: {
  campo: RefObject<TextInput | null>; nome: string; cor: CorDaTag; erro: ErroDoForm | null; enviando: boolean; ocupado: boolean; emLinha: boolean;
  aoMudarNome: (n: string) => void; aoMudarCor: (c: CorDaTag) => void; aoCriar: () => void;
}) {
  const { cores } = useTema();
  const campoDoNome = (
    <View style={emLinha ? estilos.nomeEmLinha : estilos.nomeEstreito}>
      <Campo ref={campo} rotulo="Nome da nova tag" rotuloOculto valor={nome} maxLength={MAXIMO_DO_NOME_DA_TAG} autoCorrect={false} autoComplete="off"
        sufixo={contadorDoNome(nome, MAXIMO_DO_NOME_DA_TAG)} erro={erro?.noCampo === 'nome' ? erro.mensagem : null}
        submitBehavior="submit" returnKeyType="done" onSubmitEditing={aoCriar} aoMudar={aoMudarNome} />
    </View>
  );
  const coresEPrevia = (
    <View style={estilos.coresEPrevia}>
      <CoresDaTag rotulo="Cor da nova tag" valor={cor} aoEscolher={aoMudarCor} />
      <View accessible accessibilityLabel={`Prévia: ${nome.trim() || 'Nome da tag'}, ${rotuloDaCor(cor)}`} style={estilos.previa}>
        <ChipDeTag tag={{ id: 'previa', nome: nome.trim() || 'Nome da tag', cor }} larguraMaxima={160} />
      </View>
    </View>
  );
  const botao = <Botao rotulo="Criar tag" tipo="acao" aoTocar={aoCriar} carregando={enviando} desabilitado={ocupado && !enviando} motivo="Aguarde salvar a outra tag." />;
  return (
    <View style={estilos.criar}>
      {/* Rótulo fora do `Campo` para o botão alinhar com a caixa, também quando o erro aparece embaixo dela. */}
      <Texto variante="rotulo" cor={cores.texto} aria-hidden>Nova tag</Texto>
      {emLinha ? (
        <View style={estilos.linhaDaCriacao}>{campoDoNome}{coresEPrevia}{botao}</View>
      ) : (
        <>
          <View style={estilos.linhaDaCriacao}>{campoDoNome}{botao}</View>
          {coresEPrevia}
        </>
      )}
      {erro?.noCampo === 'cor' ? <Texto variante="pequeno" cor={cores.perigo}>{erro.mensagem}</Texto> : null}
    </View>
  );
}

/** O selo da tag e, ao lado, quantos alunos a têm: com alunos, link para Alunos filtrado por ela (todos, inativos também). */
function TagEContagem({ tag }: { tag: TagDaConsultoria }) {
  return (
    <View style={estilos.tagEContagem}>
      <ChipDeTag tag={tag} larguraMaxima={240} />
      {tag.totalAlunos > 0
        ? <LinkTexto href={{ pathname: '/treinador/alunos', params: { tag: tag.id, meus: 'false', situacao: 'TODOS' } }} texto={textoDosAlunosDaTag(tag.totalAlunos)} />
        : <Texto variante="suave">{textoDosAlunosDaTag(0)}</Texto>}
    </View>
  );
}

/** A linha em renomeação: o selo vira campo focado, com "Cancelar" e "Salvar"; Enter salva e Esc cancela. */
function LinhaRenomeando({ tag, nome, erro, salvando, aoMudar, aoSalvar, aoCancelar }: {
  tag: TagDaConsultoria; nome: string; erro: string | null; salvando: boolean; aoMudar: (n: string) => void; aoSalvar: () => void; aoCancelar: () => void;
}) {
  const campo = useRef<TextInput>(null);
  // Depois de a folha do ⋯ fechar (ela devolve o foco a quem a abriu, que saiu da tela junto com a linha de leitura).
  useEffect(() => {
    const t = setTimeout(() => campo.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={estilos.linhaEmEdicao}>
      <View style={estilos.nomeEstreito}>
        <Campo ref={campo} rotulo={`Nome da tag ${tag.nome}`} rotuloOculto valor={nome} maxLength={MAXIMO_DO_NOME_DA_TAG} autoCorrect={false} autoComplete="off"
          sufixo={contadorDoNome(nome, MAXIMO_DO_NOME_DA_TAG)} erro={erro} ajuda={textoDeRenomear(tag)} selectTextOnFocus
          submitBehavior="submit" returnKeyType="done" onSubmitEditing={aoSalvar} aoMudar={aoMudar}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Escape') aoCancelar(); }} />
      </View>
      <View style={estilos.acoesDaEdicao}>
        <Botao rotulo="Cancelar" rotuloAcessivel={`Cancelar renomear ${tag.nome}`} tipo="secundario" desabilitado={salvando} motivo="Salvando o nome." aoTocar={aoCancelar} />
        <Botao rotulo="Salvar" rotuloAcessivel={`Salvar nome da tag ${tag.nome}`} carregando={salvando} aoTocar={aoSalvar} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(2) },
  // Logo abaixo do título: o cadeado e a frase curta, sempre à vista.
  saude: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  // Tela larga: tudo alinhado à esquerda, sem esticar; a lateral só entra quando cabe ao lado da lista inteira.
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(4) },
  principal: { flexGrow: 1, flexShrink: 1, maxWidth: LARGURA_MAXIMA, minWidth: 0 },
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0 },
  usada: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: 32 },
  criar: { gap: espaco(0.5) },
  // Topo alinhado: o erro desce sob o campo e o botão fica rente à caixa.
  linhaDaCriacao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1) },
  nomeEmLinha: { width: 280, flexShrink: 1, minWidth: 0 },
  nomeEstreito: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  coresEPrevia: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  previa: { minHeight: 44, justifyContent: 'center' },
  busca: { maxWidth: 360 },
  tagEContagem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(2), rowGap: 0 },
  acoesDaLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  // O mesmo recuo da `LinhaDaLista` (borda + 12 px), para o campo começar onde o selo estava.
  linhaEmEdicao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1), padding: RECUO_DA_LINHA + BORDA_DA_LINHA },
  acoesDaEdicao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
