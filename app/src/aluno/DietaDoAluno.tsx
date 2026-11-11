import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Droplet, ExternalLink, FileDown, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConteudoDieta, Refeicao, VersaoDetalhe } from '../api/tipos';
import { corDaRefeicao } from '../dominio/corDaSerie';
import { normalizarDieta, somar, textoDaAgua, textoEscolhaDasOpcoes, totalDoDia, type Totais } from '../dominio/dieta';
import { ergogenicosPreenchidos } from '../dominio/ergogenicos';
import { linhasDoComplemento } from '../dominio/linhasDoComplemento';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { linkParaAbrir } from '../dominio/links';
import type { DadosPdfDieta } from '../pdf/pdfDieta';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { abrirLinkExterno } from '../ui/abrirLinkExterno';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { Cartao } from '../ui/Cartao';
import { Incompleto } from '../ui/Estados';
import { Selo } from '../ui/Selo';
import { FolhaPdfDieta } from '../ui/FolhaPdfDieta';
import { NoPlano } from '../ui/NoPlano';
import { Texto } from '../ui/Texto';
import { NumeroAnimado } from '../ui/NumeroAnimado';
import { MACROS, MarcaDoMacro, ValoresDaDieta } from '../ui/ValoresDaDieta';
import { ModoDePreparo } from './ModoDePreparo';

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
 */
export function DietaDoAluno({
  versao,
  salva,
  aguaNoCartao = false,
  previa = false,
  aoBaixarPdf,
}: {
  versao: VersaoDetalhe<ConteudoDieta>;
  salva: boolean;
  aguaNoCartao?: boolean;
  previa?: boolean;
  /** Gera o PDF (a tela do aluno monta o documento com o pacote); fora da prévia, sem ele o botão não aparece. */
  aoBaixarPdf?: (lista?: DadosPdfDieta['lista']) => Promise<void>;
}) {
  const { cores } = useTema();
  const [folhaPdf, setFolhaPdf] = useState(false);
  const c = normalizarDieta(versao.conteudo);
  const ergogenicos = ergogenicosPreenchidos(c.ergogenicos);

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
      <Botao rotulo="Lista de compras" tipo="secundario" cheio Icone={ShoppingCart} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={() => { if (!previa) router.push('/aluno/lista-de-compras'); }} />
      <Cartao titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
        <TotalDoDia totais={totalDoDia(c)} />
        <Texto variante="pequeno">P = proteína · C = carboidrato · G = gordura</Texto>
        {Object.values(totalDoDia(c)).some((v) => v === null) ? <Incompleto texto="Há itens sem valor nutricional informado; o total não os soma." /> : null}
      </Cartao>
      {c.refeicoes.map((r, i) => (
        <CartaoRefeicaoAluno key={r.uid} refeicao={r} indice={i} />
      ))}
      {ergogenicos.length ? (
        <Cartao titulo="Medicação e ergogênicos">
          {ergogenicos.map((e) => (
            <View key={e.uid} style={[estilos.item, { borderColor: cores.divisor }]}>
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
            <View key={s.uid} style={[estilos.item, { borderColor: cores.divisor }]}>
              <Texto numerico style={estilos.forte}>{s.nome || '—'}</Texto>
              <LinhasDoComplemento item={s} />
              {linkParaAbrir(s.link) ? <VerProduto link={s.link} /> : null}
              {s.cupom?.trim() ? <CupomDoProduto uid={s.uid} nome={s.nome} cupom={s.cupom.trim()} /> : null}
            </View>
          ))}
        </Cartao>
      ) : null}
      {previa || aoBaixarPdf ? (
        <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da dieta" tipo="secundario" cheio Icone={FileDown} desabilitado={previa} motivo={previa ? MOTIVO_NA_PREVIA : undefined} aoTocar={() => { if (!previa) setFolhaPdf(true); }} /></NoPlano>
      ) : null}
      {previa || !aoBaixarPdf ? null : <FolhaPdfDieta visivel={folhaPdf} aoFechar={() => setFolhaPdf(false)} conteudo={c} versao={versao.numero} aoBaixar={aoBaixarPdf} />}
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

/** Cupom do produto, como o treinador escreveu, com o botão de copiar. Nada é calculado nem aplicado pelo app; copiar também vale na prévia (não grava nem chama a API). */
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
  const rotuloDoTotal = refeicao.opcoes.length > 1 && opcao ? `Total da opção ${opcao.rotulo}` : 'Total';
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
          <View key={i.uid} style={[estilos.itemComQuantidade, { borderColor: cores.divisor }]}>
            <View style={estilos.nomeDoItem}>
              <Texto numerico style={estilos.forte}>{i.nome}</Texto>
              <ValoresDaDieta totais={somar([i])} inicio />
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
        <View style={[estilos.totalDaRefeicao, { borderColor: cores.bordaCampo }]} role="group" aria-label={rotuloDoTotal}>
          <Texto numerico style={estilos.forte} cor={cores.texto}>{rotuloDoTotal}</Texto>
          <ValoresDaDieta totais={somar(opcao.itens)} forte inicio />
        </View>
      ) : null}
      <ModoDePreparo texto={refeicao.modoDePreparo} />
    </Cartao>
  );
}


/**
 * Total do dia: kcal em destaque na cor do texto e, por macro, a marca de cor da peça única (`ui/ValoresDaDieta`, a mesma do
 * editor) com o valor e o nome por extenso ("—" sem valor).
 */
function TotalDoDia({ totais }: { totais: Totais }) {
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
      </View>
    </View>
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
  totalDaRefeicao: { borderTopWidth: 1, paddingTop: espaco(1), marginTop: espaco(0.5), gap: espaco(0.5) },
  totalDoDia: { gap: espaco(1) },
  macros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.75) },
  macro: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  produto: { alignItems: 'flex-start', paddingTop: espaco(0.5), gap: espaco(0.5) },
});
