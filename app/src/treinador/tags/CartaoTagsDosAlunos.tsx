import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { apagarTagDeAluno, criarTagDeAluno, listarTagsDeAlunos, renomearTagDeAluno } from '../../api/tagsDeAlunos';
import type { CorDaTag, TagDaConsultoria } from '../../api/tipos';
import {
  COR_DAS_TAGS, COR_PADRAO_DA_TAG, erroDoNomeDaTag, MAXIMO_DO_NOME_DA_TAG, MENSAGEM_TAG_NOME_EM_USO, nomeDaTagParaEnviar, tagPeloNome,
  textoDeApagarTag, textoDeRenomear, traduzirErroDeTag,
} from '../../dominio/tagsDeAluno';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { ChipDeTag } from './ChipDeTag';
import { AVISO_DAS_TAGS } from './textosDasTags';

interface Rascunho { nome: string; cor: CorDaTag }
interface ErroDoForm { mensagem: string; noCampo?: 'nome' | 'cor' }
type Envio = 'parado' | 'enviando';

const rotuloDaCor = (cor: CorDaTag) => COR_DAS_TAGS.find((c) => c.valor === cor)?.rotulo ?? cor;
const alunos = (n: number) => (n <= 0 ? 'Nenhum aluno' : `${n} ${n === 1 ? 'aluno' : 'alunos'}`);
const porNome = (a: TagDaConsultoria, b: TagDaConsultoria) => a.nome.localeCompare(b.nome, 'pt-BR');

/**
 * Tags dos alunos (Configurações; `docs/planos/tags-de-aluno.md`, D5 e D10): a lista da consultoria com a cor e quantos
 * alunos têm cada uma. Com `ALUNO_ALTERAR`: criar, renomear e trocar a cor na própria linha (com a `versao`; 409 recarrega a
 * lista) e apagar com `PainelConfirmacao`, que diz em quantos alunos ela está. Só com `ALUNO_LER`, a lista fica só leitura.
 */
export function CartaoTagsDosAlunos() {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const podeGerir = pode('ALUNO_ALTERAR');
  const lista = useCarregar('tags-dos-alunos-configuracoes', () => listarTagsDeAlunos());
  const tags = [...(lista.dados ?? [])].sort(porNome);
  // Uma linha em edição por vez; o rascunho guarda a `versao` lida ao abrir (o 409 diz que outra pessoa mudou depois).
  const [edicao, setEdicao] = useState<(Rascunho & { id: string; versao: number }) | null>(null);
  const [erroDaEdicao, setErroDaEdicao] = useState<ErroDoForm | null>(null);
  const [nova, setNova] = useState<Rascunho>({ nome: '', cor: COR_PADRAO_DA_TAG });
  const [erroDaNova, setErroDaNova] = useState<ErroDoForm | null>(null);
  const [envio, setEnvio] = useState<Envio>('parado');
  const [apagar, setApagar] = useState<TagDaConsultoria | null>(null);
  // Erro que não é de um campo (409 de conflito, 404, sem conexão): fica no topo do cartão até a próxima ação.
  const [alerta, setAlerta] = useState<string | null>(null);

  const trocar = (t: TagDaConsultoria) => lista.definir([...(lista.dados ?? []).filter((x) => x.id !== t.id), t]);
  const falhou = (e: unknown, noForm: (erro: ErroDoForm) => void) => {
    const t = traduzirErroDeTag(e);
    if (t.noCampo) noForm({ mensagem: t.mensagem, noCampo: t.noCampo });
    else setAlerta(t.mensagem);
    if (t.recarregar) lista.recarregar();
    return t;
  };
  const enviar = async (passo: () => Promise<void>) => {
    if (envio === 'enviando') return;
    setEnvio('enviando');
    setAlerta(null);
    try {
      await passo();
    } finally {
      setEnvio('parado');
    }
  };

  const criar = () => {
    const problema = erroDoNomeDaTag(nova.nome);
    if (problema) return setErroDaNova({ mensagem: problema, noCampo: 'nome' });
    if (tagPeloNome(tags, nova.nome)) return setErroDaNova({ mensagem: MENSAGEM_TAG_NOME_EM_USO, noCampo: 'nome' });
    void enviar(async () => {
      try {
        const criada = await criarTagDeAluno({ nome: nomeDaTagParaEnviar(nova.nome), cor: nova.cor });
        trocar(criada);
        setNova({ nome: '', cor: COR_PADRAO_DA_TAG });
        setErroDaNova(null);
        avisar(`Tag “${criada.nome}” criada.`, 'sucesso');
      } catch (e) {
        falhou(e, setErroDaNova);
      }
    });
  };

  const salvar = () => {
    if (!edicao) return;
    const problema = erroDoNomeDaTag(edicao.nome);
    if (problema) return setErroDaEdicao({ mensagem: problema, noCampo: 'nome' });
    if (tagPeloNome(tags.filter((t) => t.id !== edicao.id), edicao.nome)) return setErroDaEdicao({ mensagem: MENSAGEM_TAG_NOME_EM_USO, noCampo: 'nome' });
    void enviar(async () => {
      try {
        trocar(await renomearTagDeAluno(edicao.id, { nome: nomeDaTagParaEnviar(edicao.nome), cor: edicao.cor, versao: edicao.versao }));
        setEdicao(null);
        setErroDaEdicao(null);
        avisar('Tag salva.', 'sucesso');
      } catch (e) {
        // Conflito ou tag que sumiu: a lista volta e a edição fecha (a versão aberta não vale mais); o aviso fica no topo.
        const t = falhou(e, setErroDaEdicao);
        if (t.recarregar && !t.noCampo) setEdicao(null);
      }
    });
  };

  const confirmarApagar = () => {
    const tag = apagar;
    if (!tag) return;
    void enviar(async () => {
      try {
        await apagarTagDeAluno(tag.id, tag.versao);
        lista.definir((lista.dados ?? []).filter((t) => t.id !== tag.id));
        if (edicao?.id === tag.id) setEdicao(null);
        avisar(`Tag “${tag.nome}” apagada.`, 'sucesso');
      } catch (e) {
        falhou(e, (f) => setAlerta(f.mensagem));
      } finally {
        setApagar(null);
      }
    });
  };

  const enviando = envio === 'enviando';
  return (
    <View style={estilos.raiz}>
      <Texto variante="suave">{AVISO_DAS_TAGS} Renomear ou trocar a cor vale em todos os alunos que têm a tag.</Texto>
      {/* No PC a lista (o principal) à esquerda e "Nova tag" numa coluna estreita à direita; no celular, uma embaixo da outra. */}
      <View style={estilos.colunas}>
        <View style={estilos.colunaDaLista}>
          <Cartao titulo={lista.dados ? `Tags da consultoria (${tags.length})` : 'Tags da consultoria'} nivel={2}
            descricao={podeGerir ? undefined : 'Só quem pode alterar os alunos cria, renomeia ou apaga tags.'}>
            {alerta ? <Alerta tom="atencao" texto={alerta} /> : null}
            {lista.erro && !lista.dados ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={lista.recarregar} /> : null}
            {!lista.dados && lista.carregando ? <Esqueleto texto="Carregando as tags" cartoes={2} /> : null}
            {lista.dados && tags.length === 0 ? (
              <Vazio titulo="Nenhuma tag ainda" nivel={3}
                texto={podeGerir ? 'Crie a primeira em “Nova tag” ou digite uma tag nova no campo Tags, em Dados do aluno.' : 'A equipe ainda não criou tags para os alunos.'} />
            ) : null}
            {tags.length ? (
              <ListaDeLinhas>
                {tags.map((t) => {
                  const aberta = edicao?.id === t.id;
                  return (
                    <LinhaDaLista key={t.id} titulo={t.nome} metadados={`${rotuloDaCor(t.cor)} · ${alunos(t.totalAlunos)}`}
                      inicio={<Amostra cor={t.cor} />}
                      acoesAoLado
                      acoes={podeGerir && !aberta ? (
                        <View style={estilos.acoes}>
                          <IconeBotao Icone={Pencil} moldura rotulo={`Editar tag ${t.nome}`} desabilitado={enviando}
                            aoTocar={() => { setEdicao({ id: t.id, nome: t.nome, cor: t.cor, versao: t.versao }); setErroDaEdicao(null); setAlerta(null); }} />
                          <IconeBotao Icone={Trash2} moldura rotulo={`Apagar tag ${t.nome}`} desabilitado={enviando} aoTocar={() => { setAlerta(null); setApagar(t); }} />
                        </View>
                      ) : undefined}>
                      {aberta && edicao ? (
                        <View style={estilos.edicao}>
                          <FormDaTag rascunho={edicao} erro={erroDaEdicao} rotuloDoNome={`Nome da tag ${t.nome}`} ajuda={textoDeRenomear(t)}
                            aoMudar={(r) => { setEdicao({ ...edicao, ...r }); setErroDaEdicao(null); }} aoEnviar={salvar} focar />
                          <LinhaDeAcoes>
                            <Botao rotulo="Salvar tag" aoTocar={salvar} carregando={enviando} />
                            <Botao rotulo="Cancelar" tipo="secundario" desabilitado={enviando} motivo="Salvando a tag." aoTocar={() => { setEdicao(null); setErroDaEdicao(null); }} />
                          </LinhaDeAcoes>
                        </View>
                      ) : null}
                    </LinhaDaLista>
                  );
                })}
              </ListaDeLinhas>
            ) : null}
          </Cartao>
        </View>
        {podeGerir ? (
          <View style={estilos.colunaDaNova}>
            <Cartao titulo="Nova tag" nivel={2}>
              <FormDaTag rascunho={nova} erro={erroDaNova} rotuloDoNome="Nome da nova tag"
                aoMudar={(r) => { setNova(r); setErroDaNova(null); }} aoEnviar={criar} />
              <LinhaDeAcoes>
                <Botao rotulo="Criar tag" aoTocar={criar} carregando={enviando && !edicao && !apagar} desabilitado={enviando && !!(edicao || apagar)} motivo="Aguarde salvar a outra tag." />
              </LinhaDeAcoes>
            </Cartao>
          </View>
        ) : null}
      </View>
      <PainelConfirmacao
        visivel={!!apagar}
        titulo={apagar ? `Apagar a tag “${apagar.nome}”?` : 'Apagar a tag?'}
        mensagem={apagar ? `${textoDeApagarTag(apagar)} Não dá para desfazer.` : undefined}
        rotuloConfirmar="Apagar tag"
        perigo
        carregando={enviando}
        aoConfirmar={confirmarApagar}
        aoCancelar={() => setApagar(null)}
      />
    </View>
  );
}

/** Nome e cor da tag (criar e renomear), com a prévia de como ela aparece no aluno. */
function FormDaTag({ rascunho, erro, rotuloDoNome, ajuda, aoMudar, aoEnviar, focar }: {
  rascunho: Rascunho; erro: ErroDoForm | null; rotuloDoNome: string; ajuda?: string; aoMudar: (r: Rascunho) => void; aoEnviar: () => void; focar?: boolean;
}) {
  return (
    <View style={estilos.form}>
      <Campo rotulo="Nome" rotuloAcessivel={rotuloDoNome} valor={rascunho.nome} maxLength={MAXIMO_DO_NOME_DA_TAG} autoCorrect={false} autoFocus={focar}
        erro={erro?.noCampo === 'nome' ? erro.mensagem : null} ajuda={ajuda ?? `Até ${MAXIMO_DO_NOME_DA_TAG} caracteres.`}
        submitBehavior="submit" onSubmitEditing={aoEnviar} aoMudar={(nome) => aoMudar({ ...rascunho, nome })} />
      <Escolha<CorDaTag> rotulo="Cor" chips opcoes={COR_DAS_TAGS.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))} valor={rascunho.cor}
        erro={erro?.noCampo === 'cor' ? erro.mensagem : null} aoMudar={(cor) => aoMudar({ ...rascunho, cor })} />
      <View style={estilos.previa}>
        <Texto variante="pequeno">Prévia:</Texto>
        <ChipDeTag tag={{ id: 'previa', nome: rascunho.nome.trim() || 'Nome da tag', cor: rascunho.cor }} larguraMaxima={260} />
      </View>
    </View>
  );
}

/** Bolinha na cor da tag, antes do nome; decorativa (a cor está escrita nos metadados). */
function Amostra({ cor }: { cor: CorDaTag }) {
  const { identificacao } = useTema();
  return <View aria-hidden accessible={false} style={[estilos.amostra, { backgroundColor: identificacao[cor].cor }]} />;
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(3) },
  colunas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(3) },
  colunaDaLista: { flexGrow: 2, flexShrink: 1, flexBasis: 460, minWidth: 0 },
  colunaDaNova: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0 },
  form: { gap: espaco(2) },
  previa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  acoes: { flexDirection: 'row', gap: espaco(0.5) },
  edicao: { gap: espaco(2), paddingHorizontal: espaco(1.5), paddingBottom: espaco(1.5) },
  amostra: { width: 14, height: 14, borderRadius: 7 },
});
