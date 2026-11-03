import { TotaisAnimados } from '../../ui/TotaisAnimados';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Droplet, ExternalLink, FileDown, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ModoDePreparo } from '../../aluno/ModoDePreparo';
import { SeletorPlano } from '../../aluno/SeletorPlano';
import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { ErroApi } from '../../api/cliente';
import { pesosAluno } from '../../api/rotas';
import type { ConteudoDieta, Refeicao, VersaoDetalhe } from '../../api/tipos';
import { corDaRefeicao } from '../../dominio/corDaSerie';
import { normalizarDieta, somar, textoDaAgua, textoEscolhaDasOpcoes, totalDoDia } from '../../dominio/dieta';
import { ergogenicosPreenchidos } from '../../dominio/ergogenicos';
import { linhasDoComplemento } from '../../dominio/linhasDoComplemento';
import { dataParaTela, numeroParaTela } from '../../dominio/formatos';
import { linkParaAbrir } from '../../dominio/links';
import { useAluno } from '../../offline/AlunoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { textoTotais } from '../../treinador/dieta/CartaoRefeicao';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoDieta, type DadosPdfDieta } from '../../pdf/pdfDieta';
import { FolhaPdfDieta } from '../../ui/FolhaPdfDieta';
import { Abas } from '../../ui/Abas';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { NoPlano } from '../../ui/NoPlano';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Incompleto, MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Dieta publicada (só leitura). Busca online; sem conexão mostra a última vista neste aparelho, avisando que pode
 * estar desatualizada.
 */
export default function DietaAluno() {
  const { escolhida } = useAluno();
  const { dados, erro, carregando, recarregar } = useDietaDoAluno();

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Dieta" />
      <Texto variante="suave">A dieta que o seu treinador publicou, só para consulta.</Texto>
      <SeletorPlano rotulo={null} />
      {/* A água marcada é por dia, contra a meta da dieta em uso (a pasta escolhida para consulta não muda o registro). */}
      {dados?.dieta?.conteudo.aguaLitros ? <CartaoAguaDoDia metaLitros={dados.dieta.conteudo.aguaLitros} /> : null}
      {escolhida ? (
        escolhida.planos.dieta ? (
          <Dieta versao={escolhida.planos.dieta} salva={false} aguaNoCartao={!!dados?.dieta?.conteudo.aguaLitros && dados.dieta.id === escolhida.planos.dieta.id} />
        ) : (
          <Vazio titulo="Sem dieta neste plano" texto="Este plano só tem treino publicado." />
        )
      ) : null}
      {escolhida ? null : erro ? (
        <MensagemErro
          texto={erro instanceof ErroApi && erro.semConexao ? 'Sem conexão e a dieta ainda não foi aberta neste aparelho.' : textoDoErro(erro)}
          tentarDeNovo={recarregar}
        />
      ) : null}
      {escolhida ? null : !dados && carregando ? <Esqueleto /> : null}
      {escolhida ? null : dados && !dados.dieta ? <Vazio titulo="Sem plano de dieta" texto="Seu treinador ainda não publicou a dieta." /> : null}
      {!escolhida && dados?.dieta ? <Dieta versao={dados.dieta} salva={dados.salva} aguaNoCartao={!!dados.dieta.conteudo.aguaLitros} /> : null}
    </Tela>
  );
}

/**
 * `aguaNoCartao`: a meta de água desta dieta já está no cartão "Água de hoje" logo acima; a linha "Água: 3 L por dia" do
 * topo some para não repetir (31/10). Numa dieta de outra pasta, só para consulta, a linha continua.
 */
function Dieta({ versao, salva, aguaNoCartao = false }: { versao: VersaoDetalhe<ConteudoDieta>; salva: boolean; aguaNoCartao?: boolean }) {
  const { cores } = useTema();
  const { pacote } = useAluno();
  const [folhaPdf, setFolhaPdf] = useState(false);
  const c = normalizarDieta(versao.conteudo);
  const ergogenicos = ergogenicosPreenchidos(c.ergogenicos);

  const pdf = async (lista?: DadosPdfDieta['lista']) => {
    if (!pacote) return;
    const marca = pacote.pacote.marca;
    // Sem internet o PDF sai sem o acompanhamento de peso (que vem do servidor).
    const pesos = await pesosAluno().catch(() => []);
    await imprimir(
      documentoDieta({
        marca,
        logoDataUri: await logoComoDataUri(marca),
        aluno: pacote.pacote.aluno.nome,
        titulo: versao.titulo,
        versao: versao.numero,
        conteudo: c,
        pesos,
        rodapePdf: null,
        emitidoEm: new Date(),
        lista,
      }),
    );
  };
  return (
    <>
      {salva ? <Selo texto="Sem conexão — mostrando a última versão salva" tipo="neutro" /> : null}
      <Cartao>
        <Texto numerico variante="subtitulo">{versao.titulo}</Texto>
        {c.objetivo ? <Texto numerico>Objetivo: {c.objetivo}</Texto> : null}
        {!aguaNoCartao && textoDaAgua(c.aguaLitros) ? (
          <View style={estilos.agua}>
            <Droplet size={20} color={cores.texto} />
            <Texto numerico style={estilos.forte}>Água: {textoDaAgua(c.aguaLitros)}</Texto>
          </View>
        ) : null}
        <Texto numerico variante="suave">
          {[c.dataInicio ? `Início: ${dataParaTela(c.dataInicio)}` : null, c.profissional].filter(Boolean).join(' · ') || ' '}
        </Texto>
      </Cartao>
      {/* Orientações e observações logo abaixo do plano (ficavam no fim, depois de todas as refeições), recolhíveis. */}
      {c.orientacoes.length ? (
        <Cartao titulo="Orientações" recolhivel recolhido>
          {c.orientacoes.map((o, i) => (
            <View key={i} style={estilos.orientacao}>
              {o.titulo ? <Texto numerico style={estilos.forte}>{o.titulo}</Texto> : null}
              <Texto numerico variante="suave">{o.texto}</Texto>
            </View>
          ))}
        </Cartao>
      ) : null}
      {c.observacoes ? (
        <Cartao titulo="Observações" recolhivel recolhido>
          <Texto numerico>{c.observacoes}</Texto>
        </Cartao>
      ) : null}
      <Botao rotulo="Lista de compras" tipo="secundario" cheio Icone={ShoppingCart} aoTocar={() => router.push('/aluno/lista-de-compras')} />
      <Cartao titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
        <TotaisAnimados totais={totalDoDia(c)} />
        <Texto variante="pequeno">P = proteína · C = carboidrato · G = gordura</Texto>
        {Object.values(totalDoDia(c)).some((v) => v === null) ? <Incompleto texto="Há itens sem valor nutricional informado; o total não os soma." /> : null}
      </Cartao>
      {c.refeicoes.map((r, i) => (
        <CartaoRefeicaoAluno key={r.uid} refeicao={r} indice={i} />
      ))}
      {ergogenicos.length ? (
        <Cartao titulo="Medicação e ergogênicos">
          {ergogenicos.map((e) => (
            <View key={e.uid} style={[estilos.item, { borderColor: cores.borda }]}>
              <Texto numerico style={estilos.forte}>{e.nome || '—'}</Texto>
              {e.principioAtivo ? <Texto numerico variante="suave">{e.principioAtivo}</Texto> : null}
              <LinhasDoComplemento item={e} />
              {e.prescricao ? <Texto numerico variante="suave">Prescrição: {e.prescricao}</Texto> : null}
            </View>
          ))}
        </Cartao>
      ) : null}
      {c.suplementacao.length ? (
        <Cartao titulo="Suplementação">
          {c.suplementacao.map((s) => (
            <View key={s.uid} style={[estilos.item, { borderColor: cores.borda }]}>
              <Texto numerico style={estilos.forte}>{s.nome || '—'}</Texto>
              <LinhasDoComplemento item={s} />
              {linkParaAbrir(s.link) ? <VerProduto link={s.link} /> : null}
              {s.cupom?.trim() ? <CupomDoProduto uid={s.uid} nome={s.nome} cupom={s.cupom.trim()} /> : null}
            </View>
          ))}
        </Cartao>
      ) : null}
      <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da dieta" tipo="secundario" cheio Icone={FileDown} aoTocar={() => setFolhaPdf(true)} /></NoPlano>
      <FolhaPdfDieta visivel={folhaPdf} aoFechar={() => setFolhaPdf(false)} conteudo={c} versao={versao.numero} aoBaixar={pdf} />
    </>
  );
}

/** "Dose: …", "Horário: …", "Observação: …", uma por linha e só as preenchidas (A10); nada preenchido = "—". */
function LinhasDoComplemento({ item }: { item: { dose?: string | null; horario?: string | null; observacao?: string | null } }) {
  const linhas = linhasDoComplemento(item);
  if (!linhas.length) return <Texto numerico variante="suave">—</Texto>;
  return (
    <>
      {linhas.map((l) => (
        <Texto key={l} numerico variante="suave">{l}</Texto>
      ))}
    </>
  );
}

/** Abre o link do produto fora do app, sem token. */
function VerProduto({ link }: { link: string | null }) {
  const { avisar } = useAviso();
  return (
    <View style={estilos.produto}>
      <Botao
        rotulo="Ver produto"
        tipo="secundario"
        Icone={ExternalLink}
        aoTocar={() => { void abrirLinkExterno(link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }}
      />
    </View>
  );
}

/** Cupom do produto, como o treinador escreveu, com o botão de copiar. Nada é calculado nem aplicado pelo app. */
function CupomDoProduto({ uid, nome, cupom }: { uid: string; nome: string; cupom: string }) {
  const { avisar } = useAviso();
  const copiar = async () => {
    try {
      await Clipboard.setStringAsync(cupom);
      avisar('Copiado.', 'sucesso');
    } catch {
      avisar('Selecione o texto e copie à mão.', 'neutro');
    }
  };
  return (
    <View style={estilos.produto}>
      <Texto numerico selectable>Cupom: {cupom}</Texto>
      <Botao
        rotulo="Copiar cupom"
        rotuloAcessivel={`Copiar cupom${nome ? ` de ${nome}` : ''}`}
        testID={`copiar-cupom-${uid}`}
        tipo="secundario"
        Icone={Copy}
        aoTocar={() => { void copiar(); }}
      />
    </View>
  );
}

/**
 * Refeição da dieta do aluno (Frente G, D14): uma barra na cor da refeição (pela ordem no dia) e, em cada item, a
 * quantidade e a unidade numa etiqueta grande à direita, na mesma cor. Só apresentação: a cor identifica a refeição, não
 * diz status, e a quantidade é a que o treinador escreveu (sem quantidade, "—").
 */
function CartaoRefeicaoAluno({ refeicao, indice }: { refeicao: Refeicao; indice: number }) {
  const { cores, identificacao } = useTema();
  const cor = identificacao[corDaRefeicao(indice)];
  const [ativa, setAtiva] = useState(0);
  const opcao = refeicao.opcoes[Math.min(ativa, refeicao.opcoes.length - 1)];
  const escolha = textoEscolhaDasOpcoes(refeicao.opcoes.map((o) => o.rotulo));
  return (
    <Cartao
      style={{ borderLeftWidth: BARRA_DA_REFEICAO, borderLeftColor: cor.cor }}
      cabecalho={
        // A12: o nome da refeição é o título; o horário vem embaixo, com o nome dele (antes "07:30 · Café" numa linha só).
        <CabecalhoDeGrupo titulo={refeicao.nome || 'Refeição'} resumo={refeicao.horario ? `Horário: ${refeicao.horario}` : undefined} />
      }>
      {refeicao.observacao ? <Texto numerico variante="suave">{refeicao.observacao}</Texto> : null}
      {/* Opções são alternativas: o aluno escolhe uma, e os itens de opções diferentes não se somam. */}
      {escolha ? (
        <View style={[estilos.escolha, { backgroundColor: cores.superficie3, borderLeftColor: cores.bordaCampo }]}>
          <Texto numerico style={estilos.forte} cor={cores.texto}>{escolha}</Texto>
          <Texto numerico variante="pequeno">As opções não se somam: o total do dia conta só a opção A.</Texto>
        </View>
      ) : null}
      {refeicao.opcoes.length > 1 ? (
        <Abas
          abas={refeicao.opcoes.map((o, i) => ({ valor: String(i), rotulo: `Opção ${o.rotulo}` }))}
          ativa={String(Math.min(ativa, refeicao.opcoes.length - 1))}
          aoMudar={(v) => setAtiva(Number(v))}
        />
      ) : null}
      {opcao?.itens.map((i) => {
        const quantidade = numeroParaTela(i.quantidade);
        const unidade = i.quantidade === null ? '' : (i.unidade ?? '').trim();
        return (
          <View key={i.uid} style={[estilos.itemComQuantidade, { borderColor: cores.borda }]}>
            <View style={estilos.nomeDoItem}>
              <Texto numerico style={estilos.forte}>{i.nome}</Texto>
              <Texto numerico variante="suave">{textoTotais(somar([i]))}</Texto>
            </View>
            <View
              style={[estilos.quantidade, { borderColor: cor.cor, backgroundColor: cor.fundo }]}
              accessible
              accessibilityLabel={`Quantidade: ${unidade ? `${quantidade} ${unidade}` : quantidade}`}>
              <Texto numerico cor={cor.cor} style={estilos.valorDaQuantidade}>{quantidade}</Texto>
              {unidade ? <Texto numerico cor={cor.cor} style={estilos.unidadeDaQuantidade}>{unidade}</Texto> : null}
            </View>
          </View>
        );
      })}
      {opcao ? (
        <View style={[estilos.totalDaRefeicao, { borderColor: cores.bordaCampo }]}>
          <Texto numerico style={estilos.forte} cor={cores.texto}>
            {refeicao.opcoes.length > 1 ? `Total da opção ${opcao.rotulo}` : 'Total'}: {textoTotais(somar(opcao.itens))}
          </Texto>
        </View>
      ) : null}
      <ModoDePreparo texto={refeicao.modoDePreparo} />
    </Cartao>
  );
}


/** Barra lateral da refeição, como a do tipo de série (D10). */
const BARRA_DA_REFEICAO = 6;

const estilos = StyleSheet.create({
  itemComQuantidade: { borderTopWidth: 1, paddingTop: espaco(1), flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  nomeDoItem: { flex: 1, minWidth: 0, gap: 2 },
  quantidade: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.5), borderWidth: 1, borderRadius: 10, paddingVertical: espaco(0.75), paddingHorizontal: espaco(1.5), flexShrink: 0, maxWidth: '50%' },
  valorDaQuantidade: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 22 },
  unidadeDaQuantidade: { fontFamily: fontes.negrito, fontSize: 14, lineHeight: 18, flexShrink: 1 },
  agua: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  total: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  textoTotal: { fontFamily: fontes.semi, fontSize: 16 },
  orientacao: { gap: 2 },
  forte: { fontFamily: fontes.semi },
  item: { borderTopWidth: 1, paddingTop: espaco(1), gap: 2 },
  escolha: { borderRadius: RAIO, borderLeftWidth: 3, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25), gap: 2 },
  totalDaRefeicao: { borderTopWidth: 2, paddingTop: espaco(1), marginTop: espaco(0.5) },
  produto: { alignItems: 'flex-start', paddingTop: espaco(0.5), gap: espaco(0.5) },
});
