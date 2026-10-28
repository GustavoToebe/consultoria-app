import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Download, Medal, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type Svg from 'react-native-svg';

import { CartaoDoTreino, type DadosDoCartao } from '../../../../aluno/CartaoDoTreino';
import { textoDoErroDoCartao } from '../../../../aluno/cartao/erroDoCartao';
import { exportarCartao, modosDeSaida, type ModoDeSaida } from '../../../../aluno/cartao/exportarCartao';
import { FaixaDoTreino } from '../../../../aluno/FaixaDoTreino';
import { caminhoDaSessao, useSessaoDoDia } from '../../../../aluno/useSessaoDoDia';
import {
  diasTreinadosNoMes,
  fraseDoNumero,
  nomeDoArquivoDoCartao,
  semanasDoCartao,
  subtituloDoCartao,
  textoDosDias,
  tituloDoCartao,
  tituloDoMes,
} from '../../../../dominio/cartaoDoTreino';
import { resumoDaConclusao } from '../../../../dominio/conclusaoNaTela';
import { dataParaTela } from '../../../../dominio/formatos';
import { textoDoRecorde } from '../../../../dominio/recordesPessoais';
import { nomeComDia, totalDeSeries } from '../../../../dominio/semana';
import { textoDoVolumeAoVivo, volumeDaSessao } from '../../../../dominio/treinoAoVivo';
import { useAluno } from '../../../../offline/AlunoProvider';
import { logoComoDataUri } from '../../../../pdf/logo';
import { useSessao } from '../../../../sessao/SessaoProvider';
import { useTema } from '../../../../tema/TemaProvider';
import { espaco, fontes } from '../../../../tema/tokens';
import { useAviso } from '../../../../ui/Aviso';
import { Botao } from '../../../../ui/Botao';
import { Cabecalho } from '../../../../ui/Cabecalho';
import { Interruptor } from '../../../../ui/Campos';
import { Cartao } from '../../../../ui/Cartao';
import { Esqueleto } from '../../../../ui/Esqueleto';
import { Vazio } from '../../../../ui/Estados';
import { LinhaDeAcoes } from '../../../../ui/LinhaDeAcoes';
import { Selo } from '../../../../ui/Selo';
import { Tela } from '../../../../ui/Tela';
import { Texto } from '../../../../ui/Texto';
import { useCarregar } from '../../../../ui/useCarregar';

/** Largura máxima da prévia do cartão na tela (o arquivo sai sempre em 1080 × 1920). */
const PREVIA_MAXIMA = 300;

/**
 * "Bom trabalho!" (frente Engajamento, passo 0.4): abre logo depois de "Concluir treino" e pelo "Ver resumo" do treino
 * concluído. Número do treino, resumo do dia (resultado, duração, volume, séries), recordes do dia e o cartão para
 * compartilhar (P8: Stories, baixar, compartilhar; sem peso, foto, medidas, dieta nem nome; volume só ligado). Tudo do
 * aparelho: funciona sem internet (a logo só entra se já estiver em memória ou houver conexão).
 */
export default function TreinoConcluido() {
  const { uid, data: dataDaRota } = useLocalSearchParams<{ uid: string; data?: string }>();
  const dia = useSessaoDoDia(uid, dataDaRota);
  const aluno = useAluno();
  const { retornoHabilitado } = useSessao();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const svg = useRef<Svg>(null);
  const [comVolume, setComVolume] = useState(false);
  const [largura, setLargura] = useState(PREVIA_MAXIMA);
  const [saindo, setSaindo] = useState<ModoDeSaida | null>(null);
  const marca = aluno.pacote?.pacote.marca ?? null;
  const logo = useCarregar(marca?.logoUrl ?? null, () => logoComoDataUri(marca));
  const { sessao, data, hoje } = dia;
  const voltar = caminhoDaSessao(uid ?? '', data);

  if (!dia.carregado) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Bom trabalho!" voltar={voltar} />
        <Esqueleto />
      </Tela>
    );
  }
  const conclusao = dia.treino && sessao ? aluno.sessaoConcluidaDe(dia.treino.versaoId, sessao.uid, data) : null;
  if (!retornoHabilitado || !dia.treino || !sessao || !conclusao?.concluida) {
    return (
      <Tela bordas={['top']} largura={720}>
        <Cabecalho titulo="Treino" voltar={voltar} />
        <Vazio texto="Este treino não está concluído. Volte à lista do dia para concluir." />
        <Botao rotulo="Voltar à lista do dia" tipo="secundario" Icone={ArrowLeft} aoTocar={() => router.replace(voltar)} />
      </Tela>
    );
  }

  const total = totalDeSeries(sessao);
  const feitas = sessao.exercicios.reduce((n, e) => n + dia.feitas(e), 0);
  const frase = fraseDoNumero(aluno.totalConcluidos, data, hoje);
  const recordes = sessao.exercicios.flatMap((e) =>
    Object.values(dia.recordesDe(e)).flatMap((lista) => lista.map((r) => `${e.nome}: ${textoDoRecorde(r)}`)),
  );
  const treinados = diasTreinadosNoMes(data, aluno.conclusoes, aluno.registros);
  const volume = textoDoVolumeAoVivo(volumeDaSessao(sessao, dia.registroDe));
  const dados: DadosDoCartao = {
    nomeDaConsultoria: marca?.nome ?? '',
    corPrimaria: marca?.corPrimaria ?? null,
    logo: logo.dados ?? null,
    titulo: tituloDoCartao(aluno.totalConcluidos, data, hoje),
    subtitulo: subtituloDoCartao(nomeComDia(sessao), data),
    mes: tituloDoMes(data),
    semanas: semanasDoCartao(data),
    treinados,
    data,
    dias: textoDosDias(treinados.size, data),
    volume: comVolume && volume !== '—' ? `Volume: ${volume}` : null,
  };
  const modos = modosDeSaida();
  const sair = async (modo: ModoDeSaida) => {
    setSaindo(modo);
    try {
      await exportarCartao(svg.current, nomeDoArquivoDoCartao(data), modo);
    } catch (erro) {
      avisar(textoDoErroDoCartao(erro), 'perigo');
    } finally {
      setSaindo(null);
    }
  };
  const medir = (e: LayoutChangeEvent) => setLargura(Math.min(PREVIA_MAXIMA, Math.floor(e.nativeEvent.layout.width)));

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Bom trabalho!" subtitulo={`${nomeComDia(sessao)} · ${dataParaTela(data)}`} voltar={voltar} />
      <Cartao>
        {frase ? <Texto style={estilos.frase}>{frase}</Texto> : null}
        <View style={estilos.linha}>
          <Selo texto="Treino concluído" tipo="sucesso" />
          {resumoDaConclusao(conclusao) ? <Texto variante="suave" numerico>{resumoDaConclusao(conclusao)}</Texto> : null}
        </View>
        <FaixaDoTreino versaoId={dia.treino.versaoId} sessao={sessao} data={data} hoje={hoje} feitas={feitas} total={total} registroDe={dia.registroDe} />
      </Cartao>
      {recordes.length ? (
        <Cartao titulo={recordes.length === 1 ? 'Recorde pessoal' : 'Recordes pessoais'}>
          {recordes.map((r, i) => (
            <View key={`${i}-${r}`} style={estilos.linha}>
              <Medal size={18} color={cores.sucesso} />
              <Texto numerico style={estilos.recorde}>{r}</Texto>
            </View>
          ))}
        </Cartao>
      ) : null}
      <Cartao titulo="Compartilhar">
        <Texto variante="suave">Uma imagem para os Stories com a marca da consultoria e os dias que você treinou neste mês.</Texto>
        <View style={estilos.previa} onLayout={medir}>
          <CartaoDoTreino ref={svg} dados={dados} largura={largura} />
        </View>
        <Interruptor
          rotulo="Mostrar o volume no cartão"
          valor={comVolume}
          aoMudar={setComVolume}
          ajuda="O cartão nunca mostra peso, fotos, medidas ou dieta."
        />
        <LinhaDeAcoes>
          {modos.includes('baixar') ? (
            <Botao rotulo="Baixar imagem" Icone={Download} carregando={saindo === 'baixar'} aoTocar={() => void sair('baixar')} />
          ) : null}
          {modos.includes('compartilhar') ? (
            <Botao rotulo="Compartilhar" tipo={modos.includes('baixar') ? 'secundario' : 'primario'} Icone={Share2}
              carregando={saindo === 'compartilhar'} aoTocar={() => void sair('compartilhar')} />
          ) : null}
        </LinhaDeAcoes>
      </Cartao>
      <Botao rotulo="Voltar à lista do dia" tipo="secundario" Icone={ArrowLeft} aoTocar={() => router.replace(voltar)} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  frase: { fontFamily: fontes.semi, fontSize: 20 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  recorde: { flex: 1, minWidth: 0 },
  previa: { alignItems: 'center', width: '100%' },
});
