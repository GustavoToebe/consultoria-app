import { Permitido } from '../ui/Permitido';
import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { router } from 'expo-router';
import { CalendarClock, CalendarCog, Copy, Ellipsis, FileDown, Pencil, Send, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPlano, criarPlano, listarPlanos, listarReceitas, replicarPlano, versaoPlano } from '../api/rotas';
import type { ConteudoDieta, PastaResumo, PlanoResumo, TipoPlano } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { dataDaTelaNaFaixa } from '../dominio/datasValidas';
import { dataParaTela, hojeIso } from '../dominio/formatos';
import { rotuloDoNovoPlano, tituloDaFolhaDaPasta, vazioDoTipo } from '../dominio/folhaDaPasta';
import { linhaDoPlano } from '../dominio/linhaDoPlano';
import { proximoPeriodo } from '../dominio/periodo';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { ParDeDatas } from '../ui/CamposEmLinha';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { depoisDeFecharAsFolhas, marcarFolhaDoTopoFechando } from '../ui/historicoDasFolhas';
import { FolhaPdfDieta } from '../ui/FolhaPdfDieta';
import { IconeBotao } from '../ui/IconeBotao';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { gerarPdfDoPlano } from './gerarPdf';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import { mensagemPlanoCopiado, rotuloAbrirFicha, rotuloEditarPlano } from '../dominio/planoDoAluno';
import { useAvisoDoPlano } from '../ui/useAvisoDoPlano';
import { useCarregar } from '../ui/useCarregar';
import { CopiarParaAluno } from './CopiarParaAluno';
import { FolhaDeAcoes, type AcaoDoMenu } from './FolhaDeAcoes';
import type { CargaDosPlanos } from './usePlanosDaPasta';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { FolhaAlterarLiberacao, PainelLiberarAgora } from './plano/AcoesDaLiberacao';

const NOMES: Record<TipoPlano, { titulo: string; novo: string; receita: 'PLANO_TREINO' | 'PLANO_DIETA' | 'MOBILIDADE'; rota: string }> = {
  treino: { titulo: 'Treino', novo: 'Novo treino', receita: 'PLANO_TREINO', rota: '/treinador/treinos' },
  dieta: { titulo: 'Dieta', novo: 'Nova dieta', receita: 'PLANO_DIETA', rota: '/treinador/dietas' },
  mobilidade: { titulo: 'Mobilidade', novo: 'Nova mobilidade', receita: 'MOBILIDADE', rota: '/treinador/mobilidades' },
};

export function rotaDoEditor(tipo: TipoPlano, id: string) {
  return `${NOMES[tipo].rota}/${id}` as const;
}

export function periodo(p: { inicio: string | null; fim: string | null }): string {
  if (!p.inicio && !p.fim) return 'Sem período';
  return `${dataParaTela(p.inicio) || '—'} a ${dataParaTela(p.fim) || '—'}`;
}

/** Quem pode criar plano do tipo: a permissão de alterar e, na mobilidade, a funcionalidade no plano da consultoria. */
export function podeCriarPlano(tipo: TipoPlano, pode: (codigo: string) => boolean, temFuncionalidade: (f: 'MOBILIDADE') => boolean): boolean {
  return pode(PERMISSOES_DO_PLANO[tipo].alterar) && (tipo !== 'mobilidade' || temFuncionalidade('MOBILIDADE'));
}

/**
 * Treinos, dietas ou mobilidades do aluno dentro de uma pasta: o painel da aba do tipo na Folha da pasta (bloco F), sem
 * cartão próprio. Cada plano numa linha: o nome (discreto no rascunho), o selo logo depois (`linhaDoPlano`) e a versão em
 * texto pequeno, e à direita "Editar" e o ⋯. O "+ Novo …" mora na linha das abas (quem chama controla `novo`). Aba vazia diz que não há e oferece o mesmo "Novo". Criar (em branco, receita ou cópia), PDF
 * e replicar. `geracao` muda quando a pasta muda o período.
 */
export function CartaoPlanos({ tipo, alunoId, pasta, geracao = 0, aoNavegar, carga, aoMudarLiberacao, novo: { aberto: novo, aoMudar: setNovo } }: {
  tipo: TipoPlano; alunoId: string; pasta: PastaResumo; geracao?: number; aoNavegar?: () => void;
  /** Depois de "Alterar data" ou "Liberar agora": a lista de pastas recarrega (o selo da linha vem do `PastaResumo`). */
  aoMudarLiberacao?: () => void;
  /** Lista já carregada por quem chama (a Folha da pasta divide a mesma com o "Publicar tudo"); sem ela, o cartão busca. */
  carga?: CargaDosPlanos;
  /** "Novo …" controlado por quem chama (o botão fica na linha das abas); aqui só a folha do plano novo e o do vazio. */
  novo: { aberto: boolean; aoMudar: (aberto: boolean) => void };
}) {
  const { cores } = useTema();
  const unidade = useUnidadeDeCarga();
  const propria = useCarregar(carga ? null : `${tipo}:${alunoId}:${geracao}`, () => listarPlanos(tipo, alunoId));
  const todos = carga ?? propria;
  const { erro, carregando, recarregar } = todos;
  const dados = todos.dados ? todos.dados.filter((p) => p.pastaId === pasta.id) : null;
  const animar = usePrimeiraLista(!!dados);
  const { avisar } = useAviso();
  // Saídas para outra tela passam pela guarda (a ficha pode estar com os dados do aluno em edição, D7); fechar a Folha
  // (`aoNavegar`) vai junto, para o "Continuar editando" deixar tudo como estava.
  const { confirmar } = useSaidaGuardada();
  const { temFuncionalidade, pode } = useSessao();
  // Mobilidade fora do plano: a API só bloqueia escrita; o que já existe continua em leitura e pode ser excluído.
  const escritaLiberada = tipo !== 'mobilidade' || temFuncionalidade('MOBILIDADE');
  const [excluir, setExcluir] = useState<PlanoResumo | null>(null);
  const [replicando, setReplicando] = useState<PlanoResumo | null>(null);
  const [copiando, setCopiando] = useState<PlanoResumo | null>(null);
  const [menu, setMenu] = useState<PlanoResumo | null>(null);
  const podeAlterar = pode(PERMISSOES_DO_PLANO[tipo].alterar);
  const podePublicar = pode(PERMISSOES_DO_PLANO[tipo].publicar);
  const [alterandoData, setAlterandoData] = useState<PlanoResumo | null>(null);
  const [liberando, setLiberando] = useState<PlanoResumo | null>(null);
  const [pdfDieta, setPdfDieta] = useState<PlanoResumo | null>(null);
  const [conteudoPdf, setConteudoPdf] = useState<ConteudoDieta | null>(null);
  const pdf = (p: PlanoResumo) => {
    if (tipo === 'dieta') {
      setPdfDieta(p);
      setConteudoPdf(null);
      versaoPlano<unknown>('dieta', p.id, p.versaoPublicada)
        .then((v) => setConteudoPdf(normalizarDieta(v.conteudo)))
        .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'));
      return;
    }
    gerarPdfDoPlano(tipo, p, undefined, undefined, unidade).catch((e: unknown) => avisar(textoDoErro(e), 'perigo'));
  };
  // Ações do ⋯ (a ordem é a da folha); nenhuma liberada = sem ⋯.
  const liberacaoMudou = () => {
    recarregar();
    aoMudarLiberacao?.();
  };
  const agendavel = (p: PlanoResumo) => !!p.liberarEm && escritaLiberada && podePublicar;
  const acoesDoMenu = (p: PlanoResumo): (AcaoDoMenu | null)[] => [
    agendavel(p) ? { rotulo: 'Alterar data de liberação', detalhe: 'O aluno continua com o que já via até a nova data.', Icone: CalendarCog, aoTocar: () => setAlterandoData(p) } : null,
    agendavel(p) ? { rotulo: 'Liberar agora', detalhe: 'Antecipa a data: o aluno passa a ver esta versão já.', Icone: Send, aoTocar: () => setLiberando(p) } : null,
    p.versaoPublicada > 0 && temFuncionalidade('PDF') ? { rotulo: 'Baixar PDF', detalhe: 'Da versão publicada.', Icone: FileDown, aoTocar: () => void pdf(p) } : null,
    p.versaoPublicada > 0 && escritaLiberada && podeAlterar ? { rotulo: p.pastaId ? 'Duplicar nesta pasta' : 'Replicar para o próximo ciclo', detalhe: 'Cria um rascunho com o conteúdo publicado.', Icone: Copy, aoTocar: () => setReplicando(p) } : null,
    escritaLiberada && podeAlterar && pode('ALUNO_LER') ? { rotulo: 'Copiar para outro aluno', Icone: Users, aoTocar: () => setCopiando(p) } : null,
    podeAlterar ? { rotulo: 'Excluir plano', Icone: Trash2, perigo: true, aoTocar: () => setExcluir(p) } : null,
  ];

  const hoje = hojeIso();
  return (
    <View style={estilos.painel}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo={vazioDoTipo(tipo)} texto="O aluno só vê o que está publicado."
          acao={podeCriarPlano(tipo, pode, temFuncionalidade) ? { rotulo: rotuloDoNovoPlano(tipo), aoTocar: () => setNovo(true) } : undefined} />
      ) : null}
      {dados?.map((p, i) => {
        const linha = linhaDoPlano(p, hoje);
        return (
        <EntradaEmCascata indice={i} animar={animar} key={p.id} style={[estilos.plano, { borderColor: cores.borda }]}>
          {/* Nome, o selo logo depois e a versão pequena numa linha de leitura (quebra no celular). O rascunho fica em
              texto normal (não em subtítulo): os repetidos não disputam com o que o aluno usa. Um selo só (orientação 2.3). */}
          <View style={estilos.dadosPlano}>
            <Texto variante={linha.discreto ? undefined : 'subtitulo'} style={estilos.nome}>{p.titulo}</Texto>
            {linha.selo ? <Selo texto={linha.selo.texto} tipo={linha.selo.tipo} Icone={linha.selo.agendado ? CalendarClock : undefined} /> : null}
            {linha.meta ? <Texto variante="pequeno" numerico>{linha.meta}</Texto> : null}
          </View>
          {/* "Editar" é o que se faz todo dia e vem primeiro; o resto (PDF, duplicar, copiar, excluir) fica no ⋯.
              `LinhaDeAcoes` nunca passa da largura do cartão (em 390 px os cinco botões estouravam a folha). */}
          <LinhaDeAcoes>
            {podeAlterar ? <Botao rotulo="Editar" rotuloAcessivel={`${rotuloEditarPlano(tipo)} “${p.titulo}”`} tipo="secundario" Icone={Pencil} aoTocar={() => confirmar(() => { aoNavegar?.(); router.push(rotaDoEditor(tipo, p.id)); })} /> : null}
            {acoesDoMenu(p).some(Boolean) ? <IconeBotao Icone={Ellipsis} moldura rotulo={`Mais ações de ${p.titulo}`} aoTocar={() => setMenu(p)} /> : null}
          </LinhaDeAcoes>
        </EntradaEmCascata>
        );
      })}
      {menu ? <FolhaDeAcoes titulo={menu.titulo} acoes={acoesDoMenu(menu)} aoFechar={() => setMenu(null)} /> : null}
      {/* As duas sobem a `versao` do plano: a lista recarrega (é a mesma do "Publicar tudo"). */}
      {alterandoData ? <FolhaAlterarLiberacao tipo={tipo} plano={alterandoData} aoFechar={() => setAlterandoData(null)} aoMudou={liberacaoMudou} /> : null}
      <PainelLiberarAgora tipo={tipo} plano={liberando} aoFechar={() => setLiberando(null)} aoMudou={liberacaoMudou} />
      {tipo === 'dieta' ? (
        <FolhaPdfDieta
          visivel={pdfDieta !== null}
          aoFechar={() => setPdfDieta(null)}
          conteudo={conteudoPdf}
          versao={pdfDieta?.versaoPublicada ?? null}
          aoBaixar={async (lista, variacaoUid) => { if (pdfDieta) await gerarPdfDoPlano('dieta', pdfDieta, undefined, lista, undefined, variacaoUid); }}
        />
      ) : null}
      <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.titulo ?? ''}”?`} mensagem="O plano sai da lista e deixa de estar ativo. As versões publicadas e o histórico de registros são preservados." rotuloConfirmar="Excluir plano" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const id = excluir.id; setExcluir(null);
        excluirPlano(tipo, id).then(recarregar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
      }} />
      {novo ? <FolhaNovoPlano tipo={tipo} alunoId={alunoId} pasta={pasta} planos={todos.dados ?? []} aoFechar={() => setNovo(false)} aoNavegar={aoNavegar} aoCriar={recarregar} /> : null}
      {replicando ? <FolhaReplicar tipo={tipo} plano={replicando} aoFechar={() => setReplicando(null)} aoNavegar={aoNavegar} aoCriar={recarregar} /> : null}
      {copiando ? <CopiarParaAluno tipo={tipo} plano={copiando} aoNavegar={aoNavegar} aoFechar={() => setCopiando(null)} aoCopiar={(destinoId, nome) => {
        setCopiando(null);
        avisar(mensagemPlanoCopiado(tipo, nome), 'sucesso', { rotulo: rotuloAbrirFicha(nome), aoTocar: () => confirmar(() => { aoNavegar?.(); router.push(`/treinador/alunos/${destinoId}`); }) });
      }} /> : null}
    </View>
  );
}

type Origem = 'branco' | 'receita' | 'copia';

/**
 * Plano novo (criado ou replicado) abre no editor pela guarda de saída. Com algo pendente na ficha a lista já busca de
 * novo, antes da pergunta: quem escolhe "Continuar editando" vê o plano que acabou de criar. Na web a pergunta espera
 * a Folha fechar. No celular o fecho é na hora e a Folha ainda está na lista quando o diálogo nasce: marcar agora
 * manda a pergunta para a Folha de baixo (a pasta), ou para a raiz se não houver outra.
 */
function abrirOCriado(saida: ReturnType<typeof useSaidaGuardada>, aoCriar: (() => void) | undefined, abrir: () => void) {
  if (saida.pendente()) aoCriar?.();
  marcarFolhaDoTopoFechando();
  depoisDeFecharAsFolhas(() => saida.confirmar(abrir));
}

function FolhaNovoPlano({
  tipo,
  alunoId,
  pasta,
  planos,
  aoFechar,
  aoNavegar,
  aoCriar,
}: {
  tipo: TipoPlano;
  alunoId: string;
  pasta: PastaResumo;
  planos: PlanoResumo[];
  aoFechar: () => void;
  aoNavegar?: () => void;
  /** O plano foi criado mas a pessoa ficou na ficha ("Continuar editando"): a lista busca de novo para mostrá-lo. */
  aoCriar?: () => void;
}) {
  const saida = useSaidaGuardada();
  const receitas = useCarregar(NOMES[tipo].receita, () => listarReceitas(NOMES[tipo].receita));
  const [titulo, setTitulo] = useState(pasta.titulo);
  const [origem, setOrigem] = useState<Origem>('branco');
  const [receitaId, setReceitaId] = useState<string | null>(null);
  const [copiaId, setCopiaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const avisarDoPlano = useAvisoDoPlano(aoNavegar);

  const valido =
    titulo.trim() !== '' &&
    (origem !== 'receita' || receitaId) &&
    (origem !== 'copia' || copiaId);

  const criar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    criarPlano(tipo, alunoId, {
      titulo: titulo.trim(),
      inicio: pasta.inicio,
      fim: pasta.fim,
      pastaId: pasta.id,
      receitaId: origem === 'receita' ? (receitaId ?? undefined) : undefined,
      copiarDoPlanoId: origem === 'copia' ? (copiaId ?? undefined) : undefined,
    }).then(
      (d) => {
        aoFechar();
        abrirOCriado(saida, aoCriar, () => { aoNavegar?.(); router.push(rotaDoEditor(tipo, d.plano.id)); });
      },
      (e: unknown) => {
        setSalvando(false);
        // Erro do plano: o aviso fica fora da Folha (que é um Modal), então a Folha fecha antes.
        if (avisarDoPlano(e)) aoFechar();
        else setErro(e);
      },
    );
  };

  const origens: { valor: Origem; rotulo: string }[] = [
    { valor: 'branco', rotulo: 'Em branco' },
    { valor: 'receita', rotulo: 'De um modelo' },
    ...(planos.length ? [{ valor: 'copia' as Origem, rotulo: 'Copiar outro plano' }] : []),
  ];

  return (
    <Folha
      visivel
      titulo={`${NOMES[tipo].novo} na ${tituloDaFolhaDaPasta(pasta).replace(/^Pasta/, 'pasta')}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Criar e abrir" aoTocar={criar} carregando={salvando} desabilitado={!valido} motivo={titulo.trim() === '' ? 'Informe o título.' : origem === 'receita' ? 'Escolha o modelo.' : 'Escolha o plano a copiar.'} />
        </>
      }>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 16.2" />
      <Texto variante="suave">Período da pasta: {periodo(pasta)}</Texto>
      <Escolha rotulo="Começar" opcoes={origens} valor={origem} aoMudar={setOrigem} />
      {origem === 'receita' ? (
        receitas.dados ? (
          <EscolhaEmFolha
            rotulo="Receita"
            opcoes={receitas.dados.map((r) => ({ valor: r.id, rotulo: r.nome }))}
            valor={receitaId}
            aoMudar={setReceitaId}
            rotuloDoValor="Escolher"
            textoVazio="Nenhum modelo cadastrado."
          />
        ) : (
          <Esqueleto />
        )
      ) : null}
      {origem === 'copia' ? (
        <Escolha
          rotulo="Copiar de"
          opcoes={planos.map((p) => ({ valor: p.id, rotulo: p.titulo }))}
          valor={copiaId}
          aoMudar={setCopiaId}
        />
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

function FolhaReplicar({ tipo, plano, aoFechar, aoNavegar, aoCriar }: {
  tipo: TipoPlano; plano: PlanoResumo; aoFechar: () => void; aoNavegar?: () => void; aoCriar?: () => void;
}) {
  const { avisar } = useAviso();
  const saida = useSaidaGuardada();
  const avisarDoPlano = useAvisoDoPlano(aoNavegar);
  const naPasta = plano.pastaId !== null;
  const sugestao = proximoPeriodo(plano);
  const [titulo, setTitulo] = useState(naPasta ? `${plano.titulo} (cópia)` : plano.titulo);
  const [inicio, setInicio] = useState(sugestao.inicio);
  const [fim, setFim] = useState(sugestao.fim);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTelaNaFaixa(inicio, 'PLANEJAMENTO');
  const fi = dataDaTelaNaFaixa(fim, 'PLANEJAMENTO');
  const valido = titulo.trim() !== '' && (naPasta || (ini !== undefined && fi !== undefined));

  const replicar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    replicarPlano(tipo, plano.id, {
      titulo: titulo.trim(),
      inicio: ini ?? null,
      fim: fi ?? null,
      pastaId: plano.pastaId ?? undefined,
    }).then(
      (d) => {
        aoFechar();
        avisar('Plano replicado. Edite só o que mudar e publique.', 'sucesso');
        abrirOCriado(saida, aoCriar, () => { aoNavegar?.(); router.push(rotaDoEditor(tipo, d.plano.id)); });
      },
      (e: unknown) => {
        setSalvando(false);
        // Erro do plano: o aviso fica fora da Folha (que é um Modal), então a Folha fecha antes.
        if (avisarDoPlano(e)) aoFechar();
        else setErro(e);
      },
    );
  };

  return (
    <Folha
      visivel
      titulo={naPasta ? 'Duplicar nesta pasta' : 'Replicar para o próximo ciclo'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo="Replicar e abrir" aoTocar={replicar} carregando={salvando} desabilitado={!valido} motivo={titulo.trim() === '' ? 'Informe o título.' : 'Confira as datas de início e fim.'} /></Permitido>
        </>
      }>
      <Texto variante="suave">
        Cria um plano novo com o conteúdo publicado (v{plano.versaoPublicada}) de “{plano.titulo}”, como rascunho. O
        plano atual continua valendo até você publicar o novo.
        {naPasta ? ' Fica na mesma pasta, com o período dela.' : ''}
      </Texto>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} />
      {naPasta ? null : (
        <ParDeDatas>
          <CampoData rotulo="Início" nome="Início do plano" regra="PLANEJAMENTO" valor={inicio} aoMudar={setInicio} />
          <CampoData rotulo="Fim" nome="Fim do plano" regra="PLANEJAMENTO" valor={fim} aoMudar={setFim} />
        </ParDeDatas>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  painel: { gap: espaco(1) },
  // 56 a 64 px de linha (orientação 2.3): respiro vertical de 8; o alvo de 44 dos botões dá a altura.
  plano: {
    borderWidth: 1,
    borderRadius: RAIO,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
    columnGap: espaco(1.5),
    rowGap: espaco(1),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dadosPlano: { flexGrow: 1, flexShrink: 1, flexBasis: 200, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  nome: { flexShrink: 1 },
});
