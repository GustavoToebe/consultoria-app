import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CombinacaoDaMetodologia, Configuracao, PapelDaSerie, TecnicaDaMetodologia } from '../../api/tipos';
import { CATALOGO_DE_COMBINACOES, CATALOGO_DE_TECNICAS, CATALOGO_DE_TIPOS, papelDoTipo, primeiraLinha } from '../../dominio/catalogoMetodologia';
import { novoTipoDeSerie, problemasDaMetodologia, type MetodologiaEmEdicao, type TipoEmEdicao } from '../../dominio/edicaoMetodologia';
import { mover, tecnicaVazia } from '../../dominio/editorTreino';
import { NOME_FIXO_DA_COMBINACAO, NOME_FIXO_DA_TECNICA, PAPEIS, tecnicaDescritiva } from '../../dominio/metodologia';
import { BarraDesfazer, type Desfazer } from '../plano/BarraDesfazer';
import { FolhaDoCatalogo, type ItemDoCatalogo } from './FolhaDoCatalogo';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Texto } from '../../ui/Texto';
import { CamposDaTecnica, ErroDoCampo } from '../treino/CamposDaPrescricao';
import { subProblemas } from '../treino/opcoesDoEditor';
import { CartaoDoTipo } from './CartaoDoTipo';
import { LINHAS_VISIVEIS, listaDeProblemas, problemasDoItem, type LinhaDeProblema } from './problemasDaTela';

const ARREDONDAMENTOS = [0.25, 0.5, 1, 2.5].map((valor) => ({ valor, rotulo: `${String(valor).replace('.', ',')} kg` }));
const LIMITE_EXPLICACAO = 500;
const MAXIMO_DE_TIPOS = 20;
const chaveDoAlvo = (alvo: string) => `metodologia:${alvo}`;

/**
 * A metodologia da consultoria, em seções: tipos de série, as técnicas e as combinações que ela usa, e o geral.
 * O catálogo acrescenta; a lixeira tira na hora e a faixa oferece desfazer. O erro aparece no campo e numa lista no
 * topo; "Salvar modelo" (na barra) só trava com essa lista à vista. Tudo é salvo pela barra do modelo.
 */
/**
 * `codigosSalvos`: os códigos da versão salva do modelo. Um tipo novo nunca reaproveita um deles, nem o de um tipo removido
 * nesta edição: séries e modelos já gravados com aquele código passariam a mostrar o nome e o papel do tipo novo.
 */
export function CartaoMetodologia({ configuracao: c, aoMudar, codigosSalvos = [] }: { configuracao: MetodologiaEmEdicao; aoMudar: (c: MetodologiaEmEdicao) => void; codigosSalvos?: readonly string[] }) {
  const { rolarAte } = useRolagem();
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const [novo, setNovo] = useState<{ nome: string; papel: PapelDaSerie } | null>(null);
  const [folha, setFolha] = useState<'tipos' | 'tecnicas' | 'combinacoes' | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<MetodologiaEmEdicao> | null>(null);
  const problemas = problemasDaMetodologia(c);
  const linhas = listaDeProblemas(c, problemas);
  // Os campos de carga e esforço leem a metodologia só para os nomes; as faixas ainda incompletas em edição não importam.
  const config = c as unknown as Configuracao;
  const abrir = (alvo: string) => setAbertos((a) => new Set(a).add(alvo));
  const alternar = (alvo: string) => setAbertos((a) => { const n = new Set(a); if (n.has(alvo)) n.delete(alvo); else n.add(alvo); return n; });
  const ir = (linha: LinhaDeProblema) => { abrir(linha.alvo); rolarAte([chaveDoAlvo(linha.alvo)]); };
  const mudarTipo = (i: number, parte: Partial<TipoEmEdicao>) => aoMudar({ ...c, tipos: c.tipos.map((t, n) => (n === i ? { ...t, ...parte } : t)) });
  const adicionar = () => {
    if (!novo?.nome.trim()) return;
    const tipo = novoTipoDeSerie(novo.nome.trim(), [...c.tipos, ...codigosSalvos.map((codigo) => ({ codigo }))], novo.papel);
    aoMudar({ ...c, tipos: [...c.tipos, tipo] });
    abrir(`tipo:${tipo.codigo}`);
    setNovo(null);
    rolarAte([chaveDoAlvo(`tipo:${tipo.codigo}`)]);
  };
  const cheio = c.tipos.length >= MAXIMO_DE_TIPOS;
  const retirar = (rotulo: string, proxima: MetodologiaEmEdicao) => {
    setDesfazer({ rotulo, conteudo: structuredClone(c) });
    aoMudar(proxima);
  };
  const itensDeTipo: ItemDoCatalogo[] = CATALOGO_DE_TIPOS.map((t) => ({
    id: t.codigo,
    nome: t.nome,
    detalhe: `${papelDoTipo(t)} · ${primeiraLinha(t.explicacao)}`,
    presente: c.tipos.some((x) => x.codigo === t.codigo),
  }));
  const itensDeTecnica: ItemDoCatalogo[] = CATALOGO_DE_TECNICAS.map((t) => ({
    id: t.tipo,
    nome: t.item.nome,
    detalhe: `${t.grupo} · ${primeiraLinha(t.item.explicacao)}`,
    grupo: t.grupo,
    presente: c.tecnicas.some((x) => x.tipo === t.tipo),
  }));
  const itensDeCombinacao: ItemDoCatalogo[] = CATALOGO_DE_COMBINACOES.map((k) => ({
    id: k.tipo,
    nome: k.nome,
    detalhe: primeiraLinha(k.explicacao),
    presente: (c.combinacoes ?? []).some((x) => x.tipo === k.tipo),
  }));
  const adicionarDoCatalogo = (ids: string[]) => {
    if (folha === 'tipos') {
      const novos = CATALOGO_DE_TIPOS.filter((t) => ids.includes(t.codigo) && !c.tipos.some((x) => x.codigo === t.codigo));
      aoMudar({ ...c, tipos: [...c.tipos, ...novos.map((t) => structuredClone(t))] });
    } else if (folha === 'tecnicas') {
      const novos = CATALOGO_DE_TECNICAS.filter((t) => ids.includes(t.tipo) && !c.tecnicas.some((x) => x.tipo === t.tipo));
      aoMudar({ ...c, tecnicas: [...c.tecnicas, ...novos.map((t) => structuredClone(t.item))] });
    } else if (folha === 'combinacoes') {
      const novos = CATALOGO_DE_COMBINACOES.filter((k) => ids.includes(k.tipo) && !(c.combinacoes ?? []).some((x) => x.tipo === k.tipo));
      aoMudar({ ...c, combinacoes: [...(c.combinacoes ?? []), ...novos.map((k) => structuredClone(k))] });
    }
    setFolha(null);
  };
  const catalogoAberto = folha === 'tipos' ? itensDeTipo : folha === 'tecnicas' ? itensDeTecnica : folha === 'combinacoes' ? itensDeCombinacao : null;
  return <View style={estilos.lista}>
    {desfazer ? <BarraDesfazer desfazer={desfazer} aoDesfazer={() => { aoMudar(desfazer.conteudo); setDesfazer(null); }} aoFechar={() => setDesfazer(null)} /> : null}
    <ListaDeProblemas linhas={linhas} aoIr={ir} />

    <AlvoDeRolagem chave={chaveDoAlvo('tipos')}>
      <Texto variante="secao">Tipos de série</Texto>
      <Texto variante="pequeno">O tipo diz para que a série serve (aquecimento, preparação, trabalho...). Os padrões preenchem séries novas; mudar aqui não altera séries já gravadas.</Texto>
    </AlvoDeRolagem>
    {c.tipos.map((t, i) => <AlvoDeRolagem key={t.codigo} chave={chaveDoAlvo(`tipo:${t.codigo}`)}>
      <CartaoDoTipo tipo={t} config={config} problemas={problemasDoItem(problemas, 'tipos', i)} posicao={i} total={c.tipos.length}
        aberto={abertos.has(`tipo:${t.codigo}`)} aoAlternar={() => alternar(`tipo:${t.codigo}`)}
        aoMover={(d) => aoMudar({ ...c, tipos: mover(c.tipos, i, d) })}
        aoRemover={() => retirar(`Tipo “${t.nome.trim() || t.codigo}” retirado.`, { ...c, tipos: c.tipos.filter((_, n) => n !== i) })}
        aoMudar={(parte) => mudarTipo(i, parte)} />
    </AlvoDeRolagem>)}
    {novo ? <Cartao titulo="Novo tipo" nivel={3}>
      <Campo rotulo="Nome do tipo" valor={novo.nome} aoMudar={(nome) => setNovo({ ...novo, nome })} maxLength={30} ajuda="O código do tipo é gerado deste nome e não muda depois." />
      <Escolha rotulo="Papel" valor={novo.papel} opcoes={PAPEIS} aoMudar={(papel) => setNovo({ ...novo, papel })} />
      <View style={estilos.acoes}>
        <Botao rotulo="Criar tipo" tipo="secundario" Icone={Plus} aoTocar={adicionar} desabilitado={!novo.nome.trim()} motivo={!novo.nome.trim() ? 'Dê um nome ao tipo.' : undefined} />
        <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setNovo(null)} />
      </View>
    </Cartao> : null}
    <View style={estilos.acoes}>
      {novo ? null : <Botao rotulo="Adicionar tipo" tipo="secundario" Icone={Plus} aoTocar={() => setNovo({ nome: '', papel: 'OUTRO' })} desabilitado={cheio} motivo={cheio ? `O máximo é ${MAXIMO_DE_TIPOS} tipos.` : undefined} />}
      <Botao rotulo="Adicionar da lista" tipo="secundario" aoTocar={() => setFolha('tipos')} desabilitado={cheio || itensDeTipo.every((i) => i.presente)} motivo={cheio ? `O máximo é ${MAXIMO_DE_TIPOS} tipos.` : itensDeTipo.every((i) => i.presente) ? 'Todos os tipos do catálogo já estão na metodologia.' : undefined} />
    </View>

    <AlvoDeRolagem chave={chaveDoAlvo('tecnicas')}>
      <Texto variante="secao">Técnicas</Texto>
      <Texto variante="pequeno">Técnicas que esta consultoria usa. O nome exibido e a explicação são o que o aluno lê.</Texto>
    </AlvoDeRolagem>
    {c.tecnicas.length === 0 ? <Texto variante="suave">{"Nenhuma técnica. As séries ficam só com 'Nenhuma'."}</Texto> : null}
    {c.tecnicas.map((t, i) => <AlvoDeRolagem key={t.tipo} chave={chaveDoAlvo(`tecnica:${t.tipo}`)}>
      <CartaoDaTecnica tecnica={t} problemas={problemasDoItem(problemas, 'tecnicas', i)} aberto={abertos.has(`tecnica:${t.tipo}`)} aoAlternar={() => alternar(`tecnica:${t.tipo}`)}
        aoMudar={(nova) => aoMudar({ ...c, tecnicas: c.tecnicas.map((x, n) => (n === i ? nova : x)) })}
        aoRemover={() => retirar(`Técnica “${t.nome.trim() || t.tipo}” retirada.`, { ...c, tecnicas: c.tecnicas.filter((_, n) => n !== i) })} />
    </AlvoDeRolagem>)}
    <Botao rotulo="Adicionar da lista" tipo="secundario" aoTocar={() => setFolha('tecnicas')} desabilitado={itensDeTecnica.every((i) => i.presente)} motivo={itensDeTecnica.every((i) => i.presente) ? 'Todas as técnicas do catálogo já estão na metodologia.' : undefined} />

    <AlvoDeRolagem chave={chaveDoAlvo('combinacoes')}>
      <Texto variante="secao">Combinações de exercícios</Texto>
      <Texto variante="pequeno">Superset, circuito e as outras formas de juntar exercícios na sessão. O nome e a explicação aparecem para o aluno.</Texto>
    </AlvoDeRolagem>
    {(c.combinacoes ?? []).length === 0 ? <Texto variante="suave">{"Nenhuma combinação. O 'Criar grupo' fica indisponível."}</Texto> : null}
    {(c.combinacoes ?? []).map((k, i) => <AlvoDeRolagem key={k.tipo} chave={chaveDoAlvo(`combinacao:${k.tipo}`)}>
      <CartaoDaCombinacao combinacao={k} problemas={problemasDoItem(problemas, 'combinacoes', i)} aberto={abertos.has(`combinacao:${k.tipo}`)} aoAlternar={() => alternar(`combinacao:${k.tipo}`)}
        aoMudar={(nova) => aoMudar({ ...c, combinacoes: (c.combinacoes ?? []).map((x, n) => (n === i ? nova : x)) })}
        aoRemover={() => retirar(`Combinação “${k.nome.trim() || k.tipo}” retirada.`, { ...c, combinacoes: (c.combinacoes ?? []).filter((_, n) => n !== i) })} />
    </AlvoDeRolagem>)}
    <Botao rotulo="Adicionar da lista" tipo="secundario" aoTocar={() => setFolha('combinacoes')} desabilitado={itensDeCombinacao.every((i) => i.presente)} motivo={itensDeCombinacao.every((i) => i.presente) ? 'Todas as combinações do catálogo já estão na metodologia.' : undefined} />

    <AlvoDeRolagem chave={chaveDoAlvo('geral')}>
      <Cartao titulo="Geral">
        <Escolha rotulo="Arredondar a sugestão de carga do aluno para" opcoes={ARREDONDAMENTOS} valor={c.arredondamentoKg} aoMudar={(arredondamentoKg) => aoMudar({ ...c, arredondamentoKg })} />
        <ErroDoCampo mensagem={problemas.arredondamentoKg} />
        <Campo rotulo="Instruções do treino (vão no fim do PDF)" valor={c.instrucoesTreino ?? ''} aoMudar={(instrucoesTreino) => aoMudar({ ...c, instrucoesTreino })} linhas={6} maxLength={20000} erro={problemas.instrucoesTreino} />
        <Campo rotulo="Rodapé do PDF (opcional)" valor={c.rodapePdf ?? ''} aoMudar={(rodapePdf) => aoMudar({ ...c, rodapePdf })} maxLength={500} erro={problemas.rodapePdf} />
      </Cartao>
    </AlvoDeRolagem>
    {catalogoAberto ? <FolhaDoCatalogo visivel titulo={folha === 'tipos' ? 'Tipos do catálogo' : folha === 'tecnicas' ? 'Técnicas do catálogo' : 'Combinações do catálogo'}
      itens={catalogoAberto} nota={folha === 'tecnicas' ? 'AMRAP, cadência e isometria já são campos da série e do exercício' : undefined}
      aoFechar={() => setFolha(null)} aoAdicionar={adicionarDoCatalogo} /> : null}
  </View>;
}

/** A lista visível dos problemas que travam o "Salvar modelo": onde está cada um, e tocar leva ao cartão. */
function ListaDeProblemas({ linhas, aoIr }: { linhas: LinhaDeProblema[]; aoIr: (l: LinhaDeProblema) => void }) {
  const { cores } = useTema();
  const [todas, setTodas] = useState(false);
  if (linhas.length === 0) return null;
  const visiveis = todas ? linhas : linhas.slice(0, LINHAS_VISIVEIS);
  const resto = linhas.length - visiveis.length;
  return <View style={[estilos.problemas, { borderColor: cores.perigo, backgroundColor: cores.superficie2 }]} accessibilityLiveRegion="polite">
    <Texto variante="bloco" nivel={3}>{linhas.length === 1 ? '1 problema para salvar' : `${linhas.length} problemas para salvar`}</Texto>
    <Texto variante="pequeno">O “Salvar modelo” fica travado até isso ser corrigido. Toque num item para ir até ele.</Texto>
    {visiveis.map((l) => <Pressable key={l.chave} accessibilityRole="button" accessibilityLabel={`Ir para ${l.onde}: ${l.mensagem}`} onPress={() => aoIr(l)} style={({ pressed }) => [estilos.linhaDeProblema, { opacity: pressed ? 0.7 : 1 }]}>
      <Texto variante="corpo"><Texto variante="rotulo" cor={cores.perigo}>{l.onde}: </Texto>{l.mensagem}</Texto>
    </Pressable>)}
    {resto > 0 ? <Botao rotulo={`Ver os outros ${resto}`} tipo="fantasma" aoTocar={() => setTodas(true)} /> : null}
  </View>;
}

function CartaoDaTecnica({ tecnica: t, problemas: p, aberto, aoAlternar, aoMudar, aoRemover }: {
  tecnica: TecnicaDaMetodologia; problemas: Record<string, string>; aberto: boolean; aoAlternar: () => void; aoMudar: (t: TecnicaDaMetodologia) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const quantos = Object.keys(p).length;
  const nome = t.nome.trim() || NOME_FIXO_DA_TECNICA[t.tipo];
  const descritiva = tecnicaDescritiva(t.tipo);
  return <Cartao cabecalho={<CabecalhoDeGrupo titulo={nome} resumo={`Técnica · ${NOME_FIXO_DA_TECNICA[t.tipo]}`}
    selo={quantos > 0 ? { texto: `${quantos} ${quantos === 1 ? 'problema' : 'problemas'}`, tipo: 'perigo' } : undefined} aberto={aberto} aoAlternar={aoAlternar}
    acoes={<IconeBotao Icone={Trash2} rotulo={`Remover a técnica ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />} />}>
    {aberto ? <>
      <Campo rotulo="Nome exibido da técnica" valor={t.nome} aoMudar={(nome) => aoMudar({ ...t, nome })} maxLength={30} erro={p.nome} />
      <Campo rotulo="Explicação para o aluno" valor={t.explicacao ?? ''} aoMudar={(explicacao) => aoMudar({ ...t, explicacao })} linhas={3} maxLength={LIMITE_EXPLICACAO}
        ajuda={`${(t.explicacao ?? '').length}/${LIMITE_EXPLICACAO}.`} erro={p.explicacao} />
      {descritiva ? null : <>
        <Texto variante="secao">Padrão</Texto>
        <Texto variante="pequeno">Campos vazios ficam para o treinador preencher em cada série.</Texto>
        <CamposDaTecnica tecnica={t.padrao ?? tecnicaVazia(t.tipo)} completa={false} erros={subProblemas(p, 'padrao')} aoMudar={(padrao) => aoMudar({ ...t, padrao })} />
        {p.padrao ? <Texto variante="pequeno">{p.padrao}</Texto> : null}
      </>}
    </> : null}
  </Cartao>;
}

function CartaoDaCombinacao({ combinacao: k, problemas: p, aberto, aoAlternar, aoMudar, aoRemover }: {
  combinacao: CombinacaoDaMetodologia; problemas: Record<string, string>; aberto: boolean; aoAlternar: () => void; aoMudar: (k: CombinacaoDaMetodologia) => void; aoRemover: () => void;
}) {
  const { cores } = useTema();
  const quantos = Object.keys(p).length;
  const nome = k.nome.trim() || NOME_FIXO_DA_COMBINACAO[k.tipo];
  return <Cartao cabecalho={<CabecalhoDeGrupo titulo={nome} resumo={`Combinação · ${NOME_FIXO_DA_COMBINACAO[k.tipo]}`}
    selo={quantos > 0 ? { texto: `${quantos} ${quantos === 1 ? 'problema' : 'problemas'}`, tipo: 'perigo' } : undefined} aberto={aberto} aoAlternar={aoAlternar}
    acoes={<IconeBotao Icone={Trash2} rotulo={`Remover a combinação ${nome}`} cor={cores.perigo} aoTocar={aoRemover} />} />}>
    {aberto ? <>
      <Campo rotulo="Nome exibido da combinação" valor={k.nome} aoMudar={(nome) => aoMudar({ ...k, nome })} maxLength={30} erro={p.nome} />
      <Campo rotulo="Explicação para o aluno" valor={k.explicacao ?? ''} aoMudar={(explicacao) => aoMudar({ ...k, explicacao })} linhas={3} maxLength={LIMITE_EXPLICACAO}
        ajuda={`${(k.explicacao ?? '').length}/${LIMITE_EXPLICACAO}.`} erro={p.explicacao} />
    </> : null}
  </Cartao>;
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  problemas: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.75) },
  linhaDeProblema: { minHeight: ALVO_TOQUE, justifyContent: 'center' },
});
