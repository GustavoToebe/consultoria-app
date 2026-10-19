import { TotaisAnimados } from '../../ui/TotaisAnimados';
import { ExternalLink, FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SeletorPlano } from '../../aluno/SeletorPlano';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { ErroApi } from '../../api/cliente';
import { pesosAluno } from '../../api/rotas';
import type { ConteudoDieta, Refeicao, VersaoDetalhe } from '../../api/tipos';
import { normalizarDieta, somar, textoDaAgua, totalDoDia } from '../../dominio/dieta';
import { ergogenicosPreenchidos } from '../../dominio/ergogenicos';
import { dataParaTela, numeroParaTela } from '../../dominio/formatos';
import { linkParaAbrir } from '../../dominio/links';
import { useAluno } from '../../offline/AlunoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { textoTotais } from '../../treinador/dieta/CartaoRefeicao';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { documentoDieta } from '../../pdf/pdfDieta';
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
      {escolhida ? (
        escolhida.planos.dieta ? (
          <Dieta versao={escolhida.planos.dieta} salva={false} />
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
      {!escolhida && dados?.dieta ? <Dieta versao={dados.dieta} salva={dados.salva} /> : null}
    </Tela>
  );
}

function Dieta({ versao, salva }: { versao: VersaoDetalhe<ConteudoDieta>; salva: boolean }) {
  const { cores } = useTema();
  const { pacote } = useAluno();
  const { avisar } = useAviso();
  const [gerando, setGerando] = useState(false);
  const c = normalizarDieta(versao.conteudo);
  const ergogenicos = ergogenicosPreenchidos(c.ergogenicos);

  const pdf = async () => {
    if (!pacote) return;
    setGerando(true);
    try {
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
        }),
      );
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };
  return (
    <>
      {salva ? <Selo texto="Sem conexão — mostrando a última versão salva" tipo="neutro" /> : null}
      <Cartao>
        <Texto numerico variante="subtitulo">{versao.titulo}</Texto>
        {c.objetivo ? <Texto numerico>Objetivo: {c.objetivo}</Texto> : null}
        {textoDaAgua(c.aguaLitros) ? <Texto numerico>Água: {textoDaAgua(c.aguaLitros)}</Texto> : null}
        <Texto numerico variante="suave">
          {[c.dataInicio ? `Início: ${dataParaTela(c.dataInicio)}` : null, c.profissional].filter(Boolean).join(' · ') || ' '}
        </Texto>
      </Cartao>
      <Cartao titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
        <TotaisAnimados totais={totalDoDia(c)} />
        {Object.values(totalDoDia(c)).some((v) => v === null) ? <Incompleto texto="Há itens sem valor nutricional informado; o total não os soma." /> : null}
      </Cartao>
      {c.refeicoes.map((r) => (
        <CartaoRefeicaoAluno key={r.uid} refeicao={r} />
      ))}
      {c.orientacoes.length ? (
        <Cartao titulo="Orientações">
          {c.orientacoes.map((o, i) => (
            <View key={i} style={estilos.orientacao}>
              {o.titulo ? <Texto numerico style={estilos.forte}>{o.titulo}</Texto> : null}
              <Texto numerico variante="suave">{o.texto}</Texto>
            </View>
          ))}
        </Cartao>
      ) : null}
      {ergogenicos.length ? (
        <Cartao titulo="Medicação e ergogênicos">
          {ergogenicos.map((e) => (
            <View key={e.uid} style={[estilos.item, { borderColor: cores.borda }]}>
              <Texto numerico style={estilos.forte}>{e.nome || '—'}</Texto>
              {e.principioAtivo || e.concentracao ? (
                <Texto numerico variante="suave">{[e.principioAtivo, e.concentracao].filter(Boolean).join(' · ')}</Texto>
              ) : null}
              <Texto numerico variante="suave">{[e.dose, e.horario, e.observacao].filter(Boolean).join(' · ') || '—'}</Texto>
              {e.prescricao ? <Texto numerico variante="suave">Prescrição: {e.prescricao}</Texto> : null}
            </View>
          ))}
        </Cartao>
      ) : null}
      {c.observacoes ? (
        <Cartao titulo="Observações">
          <Texto numerico>{c.observacoes}</Texto>
        </Cartao>
      ) : null}
      {c.suplementacao.length ? (
        <Cartao titulo="Suplementação">
          {c.suplementacao.map((s) => (
            <View key={s.uid} style={[estilos.item, { borderColor: cores.borda }]}>
              <Texto numerico style={estilos.forte}>{s.nome || '—'}</Texto>
              <Texto numerico variante="suave">{[s.dose, s.horario, s.observacao].filter(Boolean).join(' · ') || '—'}</Texto>
              {linkParaAbrir(s.link) ? <VerProduto link={s.link} /> : null}
            </View>
          ))}
        </Cartao>
      ) : null}
      <NoPlano funcionalidade="PDF"><Botao rotulo="Baixar PDF da dieta" tipo="secundario" cheio Icone={FileDown} carregando={gerando} aoTocar={() => void pdf()} /></NoPlano>
      <Texto variante="suave">
        {versao.titulo} (v{versao.numero})
      </Texto>
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

function CartaoRefeicaoAluno({ refeicao }: { refeicao: Refeicao }) {
  const { cores } = useTema();
  const [ativa, setAtiva] = useState(0);
  const opcao = refeicao.opcoes[Math.min(ativa, refeicao.opcoes.length - 1)];
  return (
    <Cartao
      cabecalho={
        <CabecalhoDeGrupo
          titulo={`${refeicao.horario ? `${refeicao.horario} · ` : ''}${refeicao.nome}`}
          acoes={<Texto numerico style={estilos.forte}>{somarKcal(refeicao)}</Texto>}
        />
      }>
      {refeicao.observacao ? <Texto numerico variante="suave">{refeicao.observacao}</Texto> : null}
      {refeicao.opcoes.length > 1 ? (
        <Abas
          abas={refeicao.opcoes.map((o, i) => ({ valor: String(i), rotulo: `Opção ${o.rotulo}` }))}
          ativa={String(Math.min(ativa, refeicao.opcoes.length - 1))}
          aoMudar={(v) => setAtiva(Number(v))}
        />
      ) : null}
      {opcao?.itens.map((i) => (
        <View key={i.uid} style={[estilos.item, { borderColor: cores.borda }]}>
          <Texto numerico style={estilos.forte}>
            {i.nome} — {numeroParaTela(i.quantidade)} {i.unidade}
          </Texto>
          <Texto numerico variante="suave">{textoTotais(somar([i]))}</Texto>
        </View>
      ))}
      {opcao ? <Texto numerico style={estilos.forte}>Total: {textoTotais(somar(opcao.itens))}</Texto> : null}
    </Cartao>
  );
}

/** Kcal da opção A da refeição ("—" quando falta valor; nada é inventado). */
function somarKcal(r: Refeicao): string {
  const kcal = somar(r.opcoes[0]?.itens ?? []).kcal;
  return `${kcal === null ? '—' : numeroParaTela(kcal, 0)} kcal`;
}

const estilos = StyleSheet.create({
  total: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  textoTotal: { fontFamily: fontes.semi, fontSize: 16 },
  orientacao: { gap: 2 },
  forte: { fontFamily: fontes.semi },
  item: { borderTopWidth: 1, paddingTop: espaco(1), gap: 2 },
  produto: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
});
