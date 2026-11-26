import { router } from 'expo-router';
import { Droplet, FileDown, ShoppingCart } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { ConteudoDieta, Refeicao, VariacaoDaDieta, VersaoDetalhe } from '../api/tipos';
import { corDaRefeicao } from '../dominio/corDaSerie';
import { ehRotuloPadrao, MACROS as CHAVES_DOS_MACROS, normalizarDieta, somar, textoDaAgua, textoEscolhaDasOpcoes, totalDaOpcao, totalDoDia, type TotaisComFibra } from '../dominio/dieta';
import { ergogenicosPreenchidos } from '../dominio/ergogenicos';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { arranjoDaDieta } from '../dominio/arranjoDaDieta';
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
import { AbasDasOpcoes } from '../ui/MarcadorDeOpcao';
import { NoPlano } from '../ui/NoPlano';
import { Texto } from '../ui/Texto';
import { NumeroAnimado } from '../ui/NumeroAnimado';
import { PrincipalComApoio } from '../ui/PrincipalComApoio';
import { AJUDA_DA_FIBRA_PARCIAL, FIBRA, fibraParcial, LegendaDosMacros, MACROS, MarcaDoMacro, TotalParaLeitor, ValoresDaDieta } from '../ui/ValoresDaDieta';
import { CartoesDosComplementos } from './CartoesDosComplementos';
import { TotalDaRefeicaoComRespiro } from './dieta/TotalDaRefeicaoComRespiro';
import { ModoDePreparo } from './ModoDePreparo';
import { PilulaDaQuantidade } from './PilulaDaQuantidade';
import { useDiaDeHojeEmBrasilia } from './useDiaDeHoje';

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
 * `largo` (só a aba Dieta passa, a folha da prévia não muda; 26/11, `docs/planos/aluno-web-layout.md` seção 5): mede a
 * própria área e, quando ela comporta (`arranjoDaDieta`, só na web: no nativo empilha sempre, orientação 0.2), as refeições
 * numa coluna só, na ordem do dia, com o total com respiro, e ao lado a coluna de apoio fixa ao rolar
 * (`ui/PrincipalComApoio`): Total do dia, `lado` (a água do dia), Suplementação, Medicação e ergogênicos, Lista de compras, PDF, o plano, Orientações e Observações. Sem
 * espaço, a ordem do celular de sempre, com `lado` no topo e as refeições também numa coluna.
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
  /** Com `largo`, a água do dia: logo depois do Total do dia no apoio, ou no topo no desenho do celular. */
  lado?: ReactNode;
}) {
  const { cores } = useTema();
  const [folhaPdf, setFolhaPdf] = useState(false);
  const [area, setArea] = useState<number | null>(null);
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
  // Orientações e observações logo abaixo do plano (ficavam no fim, depois de todas as refeições), recolhíveis.
  const orientacoes = c.orientacoes.length ? (
    <Cartao titulo="Orientações" recolhivel recolhido>
      {c.orientacoes.map((o, i) => (
        <View key={i} style={estilos.orientacao}>
          {o.titulo ? <Texto numerico style={estilos.forte}>{o.titulo}</Texto> : null}
          <Texto numerico variante="suave">{o.texto}</Texto>
        </View>
      ))}
    </Cartao>
  ) : null;
  const observacoes = c.observacoes ? (
    <Cartao titulo="Observações" recolhivel recolhido>
      <Texto numerico>{c.observacoes}</Texto>
    </Cartao>
  ) : null;
  const listaDeCompras = <Botao rotulo="Lista de compras" tipo="secundario" cheio Icone={ShoppingCart} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={() => { if (!previa) router.push('/aluno/lista-de-compras'); }} />;
  const variacao = c.variacoes.length > 0 ? (
    <VariacaoDoDia variacoes={c.variacoes} mostrada={mostrada} deHoje={deHoje}
      aoEscolher={(uid) => setEscolha(uid === deHoje?.uid ? null : { uid, dia })} />
  ) : null;
  const total = semDietaHoje ? null : (
    <Cartao titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
      <TotalDoDia totais={totais} />
      <LegendaDosMacros />
      {/* Só os macros e a kcal: a fibra é opcional e nula não deixa o total incompleto. */}
      {CHAVES_DOS_MACROS.some((m) => totais[m] === null) ? <Incompleto texto="Há itens sem valor nutricional informado; o total não os soma." /> : null}
    </Cartao>
  );
  // Na aba Dieta as refeições ficam sempre numa coluna, na ordem do dia (nunca em zigue-zague); a prévia mantém a grade.
  const cartoesDasRefeicoes = (respiro: boolean) => refeicoes.map((r, i) => <CartaoRefeicaoAluno key={r.uid} refeicao={r} indice={i} respiro={respiro} />);
  const listaDeRefeicoes = (respiro = false) => (!refeicoes.length ? null : largo ? (
    <View style={estilos.refeicoes}>{cartoesDasRefeicoes(respiro)}</View>
  ) : (
    <Grade gap={espaco(2)} colunas={duasColunasCom(360, espaco(2))} alinhar="inicio">{cartoesDasRefeicoes(false)}</Grade>
  ));
  const complementos = <CartoesDosComplementos ergogenicos={ergogenicos} suplementacao={c.suplementacao} />;
  const botaoPdf = previa || aoBaixarPdf ? (
    <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da dieta" tipo="secundario" cheio Icone={FileDown} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={() => { if (!previa) setFolhaPdf(true); }} /></NoPlano>
  ) : null;
  const folha = previa || !aoBaixarPdf ? null : <FolhaPdfDieta visivel={folhaPdf} aoFechar={() => setFolhaPdf(false)} conteudo={c} versao={versao.numero} aoBaixar={aoBaixarPdf} />;

  const pilhaDoCelular = (
    <>
      {selo}
      {plano}
      {orientacoes}
      {observacoes}
      {listaDeCompras}
      {variacao}
      {total}
      {listaDeRefeicoes()}
      {complementos}
      {botaoPdf}
    </>
  );
  if (largo) {
    // No nativo a dieta empilha sempre (sem coluna fixa ao rolar): só a web mede a área para o lado a lado.
    const arranjo = arranjoDaDieta(Platform.OS === 'web' ? area : null);
    return (
      // O vão é o da `Tela` (24), o mesmo de quando os blocos ficam soltos nela; a folha do PDF fica fora dos dois ramos.
      <View onLayout={(e) => setArea(e.nativeEvent.layout.width)} style={estilos.pilha}>
        {arranjo.lado ? (
          <PrincipalComApoio rotuloDoApoio="Resumo da dieta" larguraDoApoio={arranjo.larguraDoApoio}
            principal={<>{selo}{variacao}{listaDeRefeicoes(true)}</>}
            apoio={(
              <>
                {total}
                {lado}
                {/* Duas chamadas para a ordem do apoio (Suplementação antes da Medicação); a lista vazia não desenha nada. */}
                <CartoesDosComplementos ergogenicos={[]} suplementacao={c.suplementacao} />
                <CartoesDosComplementos ergogenicos={ergogenicos} suplementacao={[]} />
                {listaDeCompras}
                {botaoPdf}
                {plano}
                {orientacoes}
                {observacoes}
              </>
            )} />
        ) : <>{lado}{pilhaDoCelular}</>}
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
function CartaoRefeicaoAluno({ refeicao, indice, respiro }: { refeicao: Refeicao; indice: number; respiro: boolean }) {
  const { cores, identificacao } = useTema();
  const cor = identificacao[corDaRefeicao(indice)];
  const [ativa, setAtiva] = useState(0);
  const opcao = refeicao.opcoes[Math.min(ativa, refeicao.opcoes.length - 1)];
  const escolha = textoEscolhaDasOpcoes(refeicao.opcoes.map((o) => o.rotulo));
  const rotuloDoTotal = refeicao.opcoes.length > 1 && opcao ? totalDaOpcao(opcao.rotulo) : 'Total';
  return (
    <Cartao
      style={{ borderLeftWidth: BARRA_DA_REFEICAO, borderLeftColor: cor.cor }}
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
              <ValoresDaDieta totais={somar([i])} inicio />
            </View>
            <PilulaDaQuantidade numero={quantidade} resto={unidade || null} cor={cor.cor} fundo={cor.fundo}
              rotuloAcessivel={`Quantidade: ${unidade ? `${quantidade} ${unidade}` : quantidade}`} />
          </View>
        );
      })}
      {opcao && respiro ? <TotalDaRefeicaoComRespiro rotulo={rotuloDoTotal} totais={somar(opcao.itens)} /> : opcao ? (
        <View style={[estilos.totalDaRefeicao, { borderColor: cores.bordaCampo }]} role="group" aria-label={rotuloDoTotal}>
          {/* O leitor ouve rótulo e valores numa frase só; o que se vê fica escondido dele. */}
          <TotalParaLeitor rotulo={rotuloDoTotal} totais={somar(opcao.itens)} />
          <Texto numerico style={estilos.forte} cor={cores.texto} aria-hidden>{rotuloDoTotal}</Texto>
          <View aria-hidden><ValoresDaDieta totais={somar(opcao.itens)} forte inicio /></View>
        </View>
      ) : null}
      <ModoDePreparo texto={refeicao.modoDePreparo} />
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
 * sem valor (Gustavo, 25/11), com "(parcial)" e a ajuda quando algum item não a tem.
 */
function TotalDoDia({ totais }: { totais: TotaisComFibra }) {
  const parcial = fibraParcial(totais);
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
        <View style={estilos.macro}>
          <MarcaDoMacro cor={FIBRA.cor} />
          {totais.fibra === null ? (
            <Texto numerico>Fibra —</Texto>
          ) : (
            <NumeroAnimado valor={totais.fibra} casas={1} sufixo={` g de fibra${parcial ? ' (parcial)' : ''}`} />
          )}
        </View>
      </View>
      {parcial ? <Texto variante="pequeno">{AJUDA_DA_FIBRA_PARCIAL}</Texto> : null}
    </View>
  );
}

/** Barra lateral da refeição, como a do tipo de série (D10). */
const BARRA_DA_REFEICAO = 6;

const estilos = StyleSheet.create({
  pilha: { gap: espaco(3) },
  refeicoes: { gap: espaco(2) },
  itemComQuantidade: { borderTopWidth: 1, paddingTop: espaco(1), flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  nomeDoItem: { flex: 1, minWidth: 0, gap: 2 },
  agua: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  total: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  textoTotal: { fontFamily: fontes.semi, fontSize: 16 },
  orientacao: { gap: 2 },
  forte: { fontFamily: fontes.semi },
  escolha: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25), gap: 2 },
  totalDaRefeicao: { borderTopWidth: 1, paddingTop: espaco(1), marginTop: espaco(0.5), gap: espaco(0.5) },
  totalDoDia: { gap: espaco(1) },
  macros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.75) },
  macro: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
});
