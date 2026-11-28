import { router } from 'expo-router';
import { Droplet, FileDown, ShoppingCart } from 'lucide-react-native';
import { useLayoutEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { ConteudoDieta, Refeicao, VariacaoDaDieta, VersaoDetalhe } from '../api/tipos';
import { arranjoPrincipalComApoio, larguraDoApoioDaFaixa } from '../dominio/arranjoPrincipalComApoio';
import { corDaRefeicao } from '../dominio/corDaSerie';
import { algumItemComFibra, ehRotuloPadrao, MACROS as CHAVES_DOS_MACROS, normalizarDieta, opcaoDoTotalDoDia, somar, textoDaAgua, textoEscolhaDasOpcoes, totalDaOpcao, totalDoDia, type TotaisComFibra } from '../dominio/dieta';
import { ergogenicosPreenchidos } from '../dominio/ergogenicos';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { telaLargaDoAluno } from '../dominio/telaLargaDoAluno';
import { duasColunasCom } from '../dominio/grade';
import { kcalDaAba, letraDoMarcador, tituloDaOpcao } from '../dominio/opcoesDaRefeicao';
import { textoDosDiasCurtos, variacaoDoDia, variacaoMostrada } from '../dominio/variacoesDaDieta';
import type { DadosPdfDieta } from '../pdf/pdfDieta';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Cartao } from '../ui/Cartao';
import { Alerta, Incompleto } from '../ui/Estados';
import { Escolha } from '../ui/Escolha';
import { Selo } from '../ui/Selo';
import { FolhaPdfDieta } from '../ui/FolhaPdfDieta';
import { Grade } from '../ui/Grade';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { AbasDasOpcoes } from '../ui/MarcadorDeOpcao';
import { NoPlano } from '../ui/NoPlano';
import { Texto } from '../ui/Texto';
import { NumeroAnimado } from '../ui/NumeroAnimado';
import { useFaixaDaTela } from '../ui/Tela';
import { AJUDA_DA_FIBRA_PARCIAL, FIBRA, fibraParcial, LegendaDosMacros, MACROS, MarcaDoMacro, TotalParaLeitor, ValoresDaDieta, type ValoresComFibra } from '../ui/ValoresDaDieta';
import { CartoesDosComplementos } from './CartoesDosComplementos';
import { DietaComApoio } from './dieta/DietaComApoio';
import { TotalDaRefeicaoComRespiro } from './dieta/TotalDaRefeicaoComRespiro';
import { ModoDePreparo } from './ModoDePreparo';
import { ObservacoesDaDieta, OrientacaoDaDieta } from './OrientacoesEObservacoesDaDieta';
import { PilulaDaQuantidade } from './PilulaDaQuantidade';
import { useDiaDeHojeEmBrasilia } from './useDiaDeHoje';

type Abertos = Record<'orientacoes' | 'observacoes', boolean>;

/**
 * Dentro do corpo de um cartão recolhível: o `Cartao` guarda o recolhido sozinho e desmonta o corpo ao recolher, então
 * montar = aberto e desmontar = recolhido. `useLayoutEffect` para a troca do estilo sair no mesmo quadro (sem salto).
 */
function AvisaAberto({ chave, definir }: { chave: keyof Abertos; definir: Dispatch<SetStateAction<Abertos>> }) {
  useLayoutEffect(() => {
    const marcar = (aberto: boolean) => definir((a) => (a[chave] === aberto ? a : { ...a, [chave]: aberto }));
    marcar(true);
    return () => marcar(false);
  }, [chave, definir]);
  return null;
}

/** Por que a lista de compras e o PDF ficam desabilitados na prévia do treinador. */
const MOTIVO_NA_PREVIA = 'Só o aluno abre isto no app dele.';

/**
 * A dieta publicada do aluno (só leitura): título, orientações, total do dia, refeições com opções, medicação e
 * suplementação. Só por props: é a aba Dieta do aluno e a prévia do treinador ("Ver como o aluno", `previa`), que não têm
 * o `AlunoProvider`.
 *
 * `aguaNoCartao`: a meta de água desta dieta já está no cartão "Água de hoje" logo acima; a linha "Água: 3 L por dia" do
 * topo some para não repetir (31/10). Numa dieta de outra pasta, só para consulta, a linha continua.
 *
 * `previa`: "Lista de compras" e "Baixar PDF" ficam desabilitados e sem efeito (a lista abre uma tela do aluno e o PDF busca
 * o peso do aluno); sem `aoBaixarPdf` o PDF também não sai. O resto é igual.
 *
 * Dieta por dia da semana: abre na variação de hoje (data de Brasília, relida na virada do dia e na volta do app) e o
 * aluno troca à mão; total e refeições são os da variação mostrada. Sem variação, nada muda.
 *
 * `largo` (só a aba Dieta passa, a folha da prévia não muda): mede a própria área e, quando ela comporta
 * (`arranjoPrincipalComApoio` com o apoio da faixa da `Tela`: 380, 420 na larga, 440 na ultralarga; só na web, no nativo
 * empilha sempre), o desenho do PC (28/11, `aluno/dieta/DietaComApoio`): à direita o apoio, sem rolagem própria e fixo ao
 * rolar só quando cabe inteiro na janela, com "Lista de compras" e "Baixar PDF da dieta" lado a lado no topo, o Total do dia
 * e `lado` (a água do dia). Na principal, as refeições com o total com respiro numa grade POR LINHA, na ordem do dia (Café |
 * Lanche, Almoço | Lanche, Janta; ímpar = a última na largura toda, `ui/Grade` com `linhasDaGrade`; mesma linha, mesma
 * altura, com o total no pé do cartão, `rodape` da `Cartao`), em duas colunas da
 * faixa `larga` em diante e numa na `normal`; embaixo, na mesma régua, Orientações | Observações (abertas, recolhíveis) e
 * Suplementação | Medicação e ergogênicos (seção vazia some; sozinha na linha, a largura toda) e o plano no fim. Sem espaço,
 * a ordem do celular de sempre, com `lado` no topo e as refeições numa coluna.
 *
 * Fibra (28/11): sem nenhum item com fibra na dieta inteira (`algumItemComFibra`), nada de fibra nos itens, nos totais nem
 * na legenda; com algum, "Fibra —" nos que não têm, como antes.
 *
 * O título do plano não aparece (25/11): é o nome de trabalho do treinador ("Dieta de <aluno>", o da importação) e a tela
 * já se chama Dieta; o plano em uso e o período ficam no `SeletorPlano`, acima. Sem objetivo, água, início nem
 * profissional, o cartão do plano não aparece.
 */
export function DietaDoAluno({
  versao,
  salva,
  aguaNoCartao = false,
  previa = false,
  aoBaixarPdf,
  largo = false,
  lado,
}: {
  versao: VersaoDetalhe<ConteudoDieta>;
  salva: boolean;
  aguaNoCartao?: boolean;
  previa?: boolean;
  /** Gera o PDF (a tela do aluno monta o documento com o pacote); fora da prévia, sem ele o botão não aparece. */
  aoBaixarPdf?: (lista?: DadosPdfDieta['lista'], variacaoUid?: string | null) => Promise<void>;
  largo?: boolean;
  /** Com `largo`, a água do dia: logo depois do Total do dia no apoio (`noApoio`: botões na largura do cartão), ou no topo no desenho do celular. */
  lado?: (noApoio: boolean) => ReactNode;
}) {
  const { cores } = useTema();
  const [folhaPdf, setFolhaPdf] = useState(false);
  const [area, setArea] = useState<number | null>(null);
  const [abertos, setAbertos] = useState<Abertos>({ orientacoes: true, observacoes: true });
  const faixa = useFaixaDaTela();
  const c = normalizarDieta(versao.conteudo);
  const dia = useDiaDeHojeEmBrasilia();
  // Nulo = seguir hoje; a escolhida que sumiu (outra versão) ou de outro dia (virou a meia-noite) também volta para hoje.
  const [escolha, setEscolha] = useState<{ uid: string; dia: number } | null>(null);
  const escolhidaUid = escolha?.dia === dia ? escolha.uid : null;
  const deHoje = variacaoDoDia(c, dia);
  const mostrada = variacaoMostrada(c, escolhidaUid, dia);
  // Com variações e sem nenhuma para mostrar: dia sem dieta marcada (publicável); não mostra refeições de outro dia.
  const semDietaHoje = c.variacoes.length > 0 && !mostrada;
  const refeicoes = mostrada ? mostrada.refeicoes : semDietaHoje ? [] : c.refeicoes;
  const totais = totalDoDia(refeicoes);
  const comFibra = algumItemComFibra(c);
  const ergogenicos = ergogenicosPreenchidos(c.ergogenicos);
  const inicioEProfissional = [c.dataInicio ? `Início: ${dataParaTela(c.dataInicio)}` : null, c.profissional].filter(Boolean).join(' · ');

  const selo = salva ? <Selo texto="Sem conexão — mostrando a última versão salva" tipo="neutro" /> : null;
  const agua = aguaNoCartao ? null : textoDaAgua(c.aguaLitros);
  const plano = c.objetivo || agua || inicioEProfissional ? (
    <Cartao>
      {c.objetivo ? <Texto numerico>Objetivo: {c.objetivo}</Texto> : null}
      {agua ? (
        <View style={estilos.agua}>
          <Droplet size={20} color={cores.texto} />
          <Texto numerico style={estilos.forte}>Água: {agua}</Texto>
        </View>
      ) : null}
      {inicioEProfissional ? <Texto numerico variante="suave">{inicioEProfissional}</Texto> : null}
    </Cartao>
  ) : null;
  // Orientações e observações recolhíveis: fechadas no celular (logo abaixo do plano), abertas no PC (embaixo das refeições).
  // Lado a lado (PC), só a aberta estica até a altura da linha; a recolhida fica com a altura própria (Gustavo, 28/11).
  const orientacoes = (recolhido: boolean, esticar = false) => (c.orientacoes.length ? (
    <Cartao key="orientacoes" titulo="Orientações" recolhivel recolhido={recolhido} style={esticar && abertos.orientacoes ? estilos.esticado : undefined}>
      {esticar ? <AvisaAberto chave="orientacoes" definir={setAbertos} /> : null}
      {c.orientacoes.map((o, i) => <OrientacaoDaDieta key={i} orientacao={o} />)}
    </Cartao>
  ) : null);
  const observacoes = (recolhido: boolean, esticar = false) => (c.observacoes ? (
    <Cartao key="observacoes" titulo="Observações" recolhivel recolhido={recolhido} style={esticar && abertos.observacoes ? estilos.esticado : undefined}>
      {esticar ? <AvisaAberto chave="observacoes" definir={setAbertos} /> : null}
      <ObservacoesDaDieta texto={c.observacoes} />
    </Cartao>
  ) : null);
  const irParaALista = () => { if (!previa) router.push('/aluno/lista-de-compras'); };
  const listaDeCompras = <Botao rotulo="Lista de compras" tipo="secundario" cheio Icone={ShoppingCart} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={irParaALista} />;
  const variacao = c.variacoes.length > 0 ? (
    <VariacaoDoDia variacoes={c.variacoes} mostrada={mostrada} deHoje={deHoje}
      aoEscolher={(uid) => setEscolha(uid === deHoje?.uid ? null : { uid, dia })} />
  ) : null;
  const opcaoDoTotal = opcaoDoTotalDoDia(refeicoes);
  const total = semDietaHoje ? null : (
    <Cartao titulo="Total do dia" descricao={opcaoDoTotal.padrao ? `Soma da ${opcaoDoTotal.nome} de cada refeição.` : `Soma · ${opcaoDoTotal.nome} de cada refeição.`}>
      <TotalDoDia totais={totais} comFibra={comFibra} />
      <LegendaDosMacros fibra={comFibra} />
      {/* Só os macros e a kcal: a fibra é opcional e nula não deixa o total incompleto. */}
      {CHAVES_DOS_MACROS.some((m) => totais[m] === null) ? <Incompleto texto="Há itens sem valor nutricional informado; o total não os soma." /> : null}
    </Cartao>
  );
  const cartoesDasRefeicoes = (respiro: boolean) =>
    refeicoes.map((r, i) => <CartaoRefeicaoAluno key={r.uid} refeicao={r} indice={i} respiro={respiro} comFibra={comFibra} />);
  // Aba Dieta: uma coluna na ordem do dia. A prévia do treinador mantém a grade de sempre.
  const listaDeRefeicoes = () => (!refeicoes.length ? null : largo ? (
    <View style={estilos.refeicoes}>{cartoesDasRefeicoes(false)}</View>
  ) : (
    <Grade gap={espaco(2)} colunas={duasColunasCom(360, espaco(2))} alinhar="inicio">{cartoesDasRefeicoes(false)}</Grade>
  ));
  const complementos = <CartoesDosComplementos ergogenicos={ergogenicos} suplementacao={c.suplementacao} />;
  const botaoPdf = (noApoio: boolean) => (previa || aoBaixarPdf ? (
    <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da dieta" tipo="secundario" cheio={!noApoio} style={noApoio ? estilos.metade : undefined} Icone={FileDown} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={() => { if (!previa) setFolhaPdf(true); }} /></NoPlano>
  ) : null);
  const folha = previa || !aoBaixarPdf ? null : <FolhaPdfDieta visivel={folhaPdf} aoFechar={() => setFolhaPdf(false)} conteudo={c} versao={versao.numero} aoBaixar={aoBaixarPdf} />;

  const pilhaDoCelular = (
    <>
      {selo}
      {plano}
      {orientacoes(true)}
      {observacoes(true)}
      {listaDeCompras}
      {variacao}
      {total}
      {listaDeRefeicoes()}
      {complementos}
      {botaoPdf(false)}
    </>
  );
  if (largo) {
    // A largura do apoio vem da faixa da `Tela` (a régua do treinador), não da área da dieta; a mesma decide o lado a lado.
    // No nativo a dieta empilha sempre (sem coluna fixa ao rolar): só a web mede a área.
    const largura = larguraDoApoioDaFaixa(faixa);
    const ladoALado = arranjoPrincipalComApoio(Platform.OS === 'web' ? area : null, true, largura) === 'lado';
    // Duas colunas da faixa larga em diante; na normal a principal (~580 px) não comporta dois cartões legíveis.
    const colunas = telaLargaDoAluno(faixa) ? 2 : 1;
    // Grade por linha, na ordem de leitura (Café | Lanche, Almoço | Lanche, ...); com número ímpar a última fica na largura
    // toda (`linhasDaGrade`: 5 em 2 = 2, 2, 1). Os cartões da mesma linha têm a mesma altura (Gustavo, 28/11): a linha
    // estica as células e o cartão cresce até o fim dela; na refeição o total fica no rodapé (`marginTop: 'auto'` da
    // `Cartao`), na mesma base do vizinho, e a sobra fica entre os itens e o total.
    const emLinhas = (pecas: ReactNode[]) => (pecas.some(Boolean) ? (
      <Grade gap={espaco(2)} colunas={() => colunas} ultimaLinha="esticar">{pecas}</Grade>
    ) : null);
    // Cada par numa linha própria: seção vazia some e a que sobra ocupa a linha inteira.
    const textos = emLinhas([orientacoes(false, true), observacoes(false, true)]);
    const suplementosEMedicacao = emLinhas([
      c.suplementacao.length ? <CartoesDosComplementos key="suplementacao" ergogenicos={[]} suplementacao={c.suplementacao} esticar /> : null,
      ergogenicos.length ? <CartoesDosComplementos key="medicacao" ergogenicos={ergogenicos} suplementacao={[]} esticar /> : null,
    ]);
    const principal = (
      <>
        {selo}
        {variacao}
        {emLinhas(refeicoes.map((r, i) => <CartaoRefeicaoAluno key={r.uid} refeicao={r} indice={i} respiro comFibra={comFibra} />))}
        {textos || suplementosEMedicacao ? <View style={estilos.refeicoes}>{textos}{suplementosEMedicacao}</View> : null}
        {plano}
      </>
    );
    const apoio = (
      <>
        {/* As duas ações lado a lado, dividindo a largura (o rótulo quebra em duas linhas antes de empurrar o vizinho). */}
        <LinhaDeAcoes>
          <Botao rotulo="Lista de compras" tipo="acao" Icone={ShoppingCart} style={estilos.metade} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={irParaALista} />
          {botaoPdf(true)}
        </LinhaDeAcoes>
        {total}
        {lado?.(true)}
      </>
    );
    return (
      // O vão é o da `Tela` (24), o mesmo de quando os blocos ficam soltos nela; a folha do PDF fica fora dos dois ramos.
      <View onLayout={(e) => setArea(e.nativeEvent.layout.width)} style={estilos.pilha}>
        {ladoALado ? <DietaComApoio largura={largura} principal={principal} apoio={apoio} /> : <>{lado?.(false)}{pilhaDoCelular}</>}
        {folha}
      </View>
    );
  }
  return <>{pilhaDoCelular}{folha}</>;
}

/**
 * Refeição da dieta do aluno (Frente G, D14): uma barra na cor da refeição (pela ordem no dia) e, em cada item, a
 * quantidade e a unidade numa etiqueta grande à direita, na mesma cor. Só apresentação: a cor identifica a refeição, não
 * diz status, e a quantidade é a que o treinador escreveu (sem quantidade, "—").
 */
function CartaoRefeicaoAluno({ refeicao, indice, respiro, comFibra }: { refeicao: Refeicao; indice: number; respiro: boolean; comFibra: boolean }) {
  const { cores, identificacao } = useTema();
  const cor = identificacao[corDaRefeicao(indice)];
  const [ativa, setAtiva] = useState(0);
  const opcao = refeicao.opcoes[Math.min(ativa, refeicao.opcoes.length - 1)];
  const valores = (itens: Refeicao['opcoes'][number]['itens']) => semFibraSeNaoHa(somar(itens), comFibra);
  const escolha = textoEscolhaDasOpcoes(refeicao.opcoes.map((o) => o.rotulo));
  const rotuloDoTotal = refeicao.opcoes.length > 1 && opcao ? totalDaOpcao(opcao.rotulo) : 'Total';
  // PC (`respiro`): o cartão cresce até a altura da linha da grade e o total vai no rodapé, preso à base (a sobra fica entre
  // os itens e o total, nunca depois dele); o modo de preparo, que vinha depois do total, sobe para antes dele.
  const totalComRespiro = opcao && respiro ? <TotalDaRefeicaoComRespiro rotulo={rotuloDoTotal} totais={valores(opcao.itens)} /> : undefined;
  return (
    <Cartao
      style={[{ borderLeftWidth: BARRA_DA_REFEICAO, borderLeftColor: cor.cor }, respiro && estilos.esticado]}
      rodape={totalComRespiro}
      cabecalho={
        // A12 (também na web larga, Gustavo 26/11): o nome da refeição é o título; o horário vem embaixo, com o nome dele.
        <CabecalhoDeGrupo titulo={refeicao.nome || 'Refeição'} resumo={refeicao.horario ? `Horário: ${refeicao.horario}` : undefined} />
      }>
      {refeicao.observacao ? <Texto numerico variante="suave">{refeicao.observacao}</Texto> : null}
      {/* Opções são alternativas: o aluno escolhe uma, e os itens de opções diferentes não se somam. */}
      {escolha ? (
        <View style={[estilos.escolha, { backgroundColor: cores.superficie3, borderLeftColor: cores.bordaCampo }]}>
          <Texto numerico style={estilos.forte} cor={cores.texto}>{escolha}</Texto>
          <Texto variante="pequeno">As opções não se somam: o total do dia conta só {ehRotuloPadrao(refeicao.opcoes[0]?.rotulo ?? 'A') ? 'a opção A' : 'a primeira opção'}.</Texto>
        </View>
      ) : null}
      {/* As mesmas abas do editor (círculo com a letra, preenchido na aberta, e a kcal ou "vazia" em texto secundário), sem o
          "+ Nova opção" nem o ⋯; com uma opção só, sem abas (não há o que escolher). Os itens vêm logo abaixo. */}
      {refeicao.opcoes.length > 1 ? (
        <AbasDasOpcoes
          rotulo={`Opções de ${refeicao.nome || 'Refeição'}`}
          abas={refeicao.opcoes.map((o, i) => ({
            valor: String(i), letra: letraDoMarcador(o.rotulo), titulo: tituloDaOpcao(o), rotuloAcessivel: `${tituloDaOpcao(o)}, ${kcalDaAba(o)}`,
            detalhe: <Texto variante="suave" numerico={o.itens.length > 0}>{kcalDaAba(o)}</Texto>,
          }))}
          aberta={String(Math.min(ativa, refeicao.opcoes.length - 1))}
          aoAbrir={(v) => setAtiva(Number(v))}
        />
      ) : null}
      {opcao?.itens.map((i) => {
        const quantidade = numeroParaTela(i.quantidade);
        const unidade = i.quantidade === null ? '' : (i.unidade ?? '').trim();
        return (
          <View key={i.uid} style={[estilos.itemComQuantidade, { borderColor: cores.divisor }]}>
            <View style={estilos.nomeDoItem}>
              <Texto numerico style={estilos.forte}>{i.nome}</Texto>
              <ValoresDaDieta totais={valores([i])} inicio />
            </View>
            <PilulaDaQuantidade numero={quantidade} resto={unidade || null} cor={cor.cor} fundo={cor.fundo}
              rotuloAcessivel={`Quantidade: ${unidade ? `${quantidade} ${unidade}` : quantidade}`} />
          </View>
        );
      })}
      {respiro ? <ModoDePreparo texto={refeicao.modoDePreparo} /> : null}
      {respiro ? null : opcao ? (
        <View style={[estilos.totalDaRefeicao, { borderColor: cores.bordaCampo }]} role="group" aria-label={rotuloDoTotal}>
          {/* O leitor ouve rótulo e valores numa frase só; o que se vê fica escondido dele. */}
          <TotalParaLeitor rotulo={rotuloDoTotal} totais={valores(opcao.itens)} />
          <Texto numerico style={estilos.forte} cor={cores.texto} aria-hidden>{rotuloDoTotal}</Texto>
          <View aria-hidden><ValoresDaDieta totais={valores(opcao.itens)} forte inicio /></View>
        </View>
      ) : null}
      {respiro ? null : <ModoDePreparo texto={refeicao.modoDePreparo} />}
    </Cartao>
  );
}


/**
 * Qual variação o aluno está vendo: "Hoje: <nome>" quando é a de hoje, senão o nome e os dias dela (e qual é a de hoje).
 * Troca à mão pelos chips (com ✓, "· hoje" na de hoje); tocar na de hoje volta a seguir o dia. Dia sem dieta marcada (o
 * "dia de descanso", publicável) não mostra variação nenhuma: diz "Sem dieta marcada para hoje" e deixa os chips para ver
 * as outras (`mostrada` nula); escolhida uma, mostra e avisa que hoje não tem.
 */
function VariacaoDoDia({ variacoes, mostrada, deHoje, aoEscolher }: {
  variacoes: VariacaoDaDieta[]; mostrada: VariacaoDaDieta | null; deHoje: VariacaoDaDieta | null; aoEscolher: (uid: string) => void;
}) {
  const nome = (v: VariacaoDaDieta) => v.rotulo.trim() || 'Variação sem nome';
  const ehHoje = !!mostrada && deHoje?.uid === mostrada.uid;
  const dias = mostrada ? `Vale em ${textoDosDiasCurtos(mostrada.dias)}.` : '';
  const titulo = !mostrada ? 'Sem dieta marcada para hoje' : ehHoje ? `Hoje: ${nome(mostrada)}` : nome(mostrada);
  const descricao = !mostrada ? 'Se quiser, veja a dieta de outro dia abaixo.' : ehHoje || !deHoje ? dias : `${dias} Hoje é dia de ${nome(deHoje)}.`;
  return (
    <Cartao titulo={titulo} descricao={descricao}>
      {mostrada && !deHoje ? <Alerta tom="atencao" texto="Sem dieta marcada para hoje. Esta é a dieta de outro dia." /> : null}
      {variacoes.length > 1 || !mostrada ? (
        <Escolha chips rotulo="Ver a dieta de" valor={mostrada?.uid ?? ''} aoMudar={aoEscolher}
          opcoes={variacoes.map((v) => ({ valor: v.uid, rotulo: v.uid === deHoje?.uid ? `${nome(v)} · hoje` : nome(v) }))} />
      ) : null}
    </Cartao>
  );
}

/**
 * Total do dia: kcal em destaque na cor do texto e, por macro, a marca de cor da peça única (`ui/ValoresDaDieta`, a mesma do
 * editor) com o valor e o nome por extenso ("—" sem valor). A fibra vem depois, com a marca dela e o texto neutro, "Fibra —"
 * sem valor (Gustavo, 25/11), com "(parcial)" e a ajuda quando algum item não a tem; sem nenhum item com fibra na dieta
 * (`comFibra` falso, 28/11), a fibra não aparece.
 */
function TotalDoDia({ totais, comFibra }: { totais: TotaisComFibra; comFibra: boolean }) {
  const parcial = comFibra && fibraParcial(totais);
  return (
    <View style={estilos.totalDoDia}>
      <NumeroAnimado valor={totais.kcal} variante="destaque" sufixo=" kcal" />
      <View style={estilos.macros}>
        {MACROS.map((m) => (
          <View key={m.chave} style={estilos.macro}>
            <MarcaDoMacro cor={m.cor} />
            {totais[m.chave] === null ? (
              <Texto numerico>{`${m.nome} —`}</Texto>
            ) : (
              <NumeroAnimado valor={totais[m.chave]} casas={1} sufixo={` g de ${m.nome.toLowerCase()}`} />
            )}
          </View>
        ))}
        {comFibra ? (
          <View style={estilos.macro}>
            <MarcaDoMacro cor={FIBRA.cor} />
            {totais.fibra === null ? (
              <Texto numerico>Fibra —</Texto>
            ) : (
              <NumeroAnimado valor={totais.fibra} casas={1} sufixo={` g de fibra${parcial ? ' (parcial)' : ''}`} />
            )}
          </View>
        ) : null}
      </View>
      {parcial ? <Texto variante="pequeno">{AJUDA_DA_FIBRA_PARCIAL}</Texto> : null}
    </View>
  );
}

/** Sem fibra na dieta inteira, os valores não a trazem (`undefined` = a peça não fala dela; `null` seria "Fibra —"). */
const semFibraSeNaoHa = (t: TotaisComFibra, comFibra: boolean): ValoresComFibra => (comFibra ? t : { ...t, fibra: undefined });

/** Barra lateral da refeição, como a do tipo de série (D10). */
const BARRA_DA_REFEICAO = 6;

const estilos = StyleSheet.create({
  pilha: { gap: espaco(3) },
  refeicoes: { gap: espaco(2) },
  // Ações do apoio dividindo a linha; mesma altura quando um rótulo quebra em duas linhas.
  metade: { flexGrow: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch' },
  // Cartão da grade do PC: cresce até a altura da linha (a célula já estica com ela).
  esticado: { flexGrow: 1 },
  itemComQuantidade: { borderTopWidth: 1, paddingTop: espaco(1), flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  nomeDoItem: { flex: 1, minWidth: 0, gap: 2 },
  agua: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  total: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  textoTotal: { fontFamily: fontes.semi, fontSize: 16 },
  forte: { fontFamily: fontes.semi },
  escolha: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25), gap: 2 },
  totalDaRefeicao: { borderTopWidth: 1, paddingTop: espaco(1), marginTop: espaco(0.5), gap: espaco(0.5) },
  totalDoDia: { gap: espaco(1) },
  macros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.75) },
  macro: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
});
