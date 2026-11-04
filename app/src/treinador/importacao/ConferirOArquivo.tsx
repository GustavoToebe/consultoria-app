import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, View } from 'react-native';

import { diagnosticarArquivo } from '../../api/rotas';
import type { DiagnosticoDoArquivo } from '../../api/tipos';
import {
  colunasDaAba, contagensDaAba, detalheDoTipoDoArquivo, problemasEmOrdem, rotuloDoTipoDoArquivo, textoDoProblema, tituloDaAba, veredito,
} from '../../dominio/diagnosticoDoArquivo';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { RAIO, espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { formulario, type ArquivoEscolhido } from './formularioDaImportacao';

/**
 * Migração assistida, fase 1: "Conferir o arquivo antes de importar". Manda o arquivo à API, que só lê e devolve contagens,
 * problemas e nomes de coluna conhecidos (nunca valor de célula nem nome de aba); nada é gravado e o resultado fica só nesta
 * tela. Só aparece com a chave ligada (`migracaoAssistidaHabilitada` do `GET /eu`) e a quem pode importar (`ALUNO_ALTERAR`, a
 * permissão da rota). Fica só na Planilha completa: a importação de uma aba tem colunas e responsável próprios (mapeados na
 * tela), que a conferência não conhece.
 */
export function ConferirOArquivo({ arquivo }: { arquivo: ArquivoEscolhido | null }) {
  const { migracaoAssistidaHabilitada, pode } = useSessao();
  const [lido, setLido] = useState<{ de: ArquivoEscolhido; diagnostico: DiagnosticoDoArquivo } | null>(null);
  const [falha, setFalha] = useState<{ de: ArquivoEscolhido | null; erro: unknown } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!migracaoAssistidaHabilitada || !pode('ALUNO_ALTERAR')) return null;

  const conferir = async () => {
    if (!arquivo) return;
    setOcupado(true);
    setFalha(null);
    try {
      setLido({ de: arquivo, diagnostico: await diagnosticarArquivo(await formulario(arquivo)) });
    } catch (e) {
      setLido(null);
      setFalha({ de: arquivo, erro: e });
    } finally {
      setOcupado(false);
    }
  };

  // O resultado e o erro são do arquivo que foi conferido: trocar o arquivo esconde os dois.
  const diagnostico = lido && arquivo && lido.de === arquivo ? lido.diagnostico : null;
  const erro = falha && falha.de === arquivo ? falha.erro : null;

  return (
    <Cartao titulo="Conferir o arquivo antes de importar" descricao="Mostra o que dá e o que não dá para importar, sem gravar nada. O arquivo não fica guardado.">
      <View style={estilos.coluna}>
        <Botao rotulo="Conferir o arquivo antes de importar" tipo="secundario" carregando={ocupado} desabilitado={!arquivo}
          motivo="Escolha um arquivo primeiro." aoTocar={conferir} testID="conferir-arquivo" />
        {/* Sempre montada: o leitor de tela anuncia o que entra aqui (o veredito ou o erro). */}
        <View accessibilityLiveRegion="polite" style={estilos.coluna}>
          {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
          {diagnostico ? <Alerta tom={veredito(diagnostico).tom} titulo={veredito(diagnostico).titulo} texto={veredito(diagnostico).texto} /> : null}
        </View>
        {diagnostico ? <Resultado diagnostico={diagnostico} /> : null}
      </View>
    </Cartao>
  );
}

function Resultado({ diagnostico }: { diagnostico: DiagnosticoDoArquivo }) {
  const { cores } = useTema();
  const inicio = useRef<View>(null);
  // O foco vai para o começo do resultado quando ele chega (teclado e leitor de tela não ficam no botão, de onde não se vê nada novo).
  useEffect(() => {
    if (Platform.OS === 'web') (inicio.current as unknown as { focus?: () => void } | null)?.focus?.();
    else {
      const no = findNodeHandle(inicio.current);
      if (no) AccessibilityInfo.setAccessibilityFocus(no);
    }
  }, [diagnostico]);
  return (
    <View style={estilos.coluna} testID="diagnostico-do-arquivo">
      <View ref={inicio} accessible tabIndex={-1} style={estilos.coluna}>
        <Texto variante="subtitulo">{rotuloDoTipoDoArquivo(diagnostico.tipo)}</Texto>
        <Texto variante="suave">{detalheDoTipoDoArquivo(diagnostico.tipo)}</Texto>
        <Texto>{`${diagnostico.linhas} ${diagnostico.linhas === 1 ? 'linha de dados' : 'linhas de dados'} em ${diagnostico.abas.length} ${diagnostico.abas.length === 1 ? 'aba' : 'abas'}.`}</Texto>
      </View>
      {diagnostico.problemas.length > 0 ? (
        <View style={estilos.coluna}>
          <Texto variante="subtitulo">O que precisa de atenção</Texto>
          {problemasEmOrdem(diagnostico.problemas).map((p) => <Texto key={p.codigo}>{`• ${textoDoProblema(p)}`}</Texto>)}
        </View>
      ) : null}
      {diagnostico.abas.map((aba) => {
        const { reconhecidas, naoReconhecidas } = colunasDaAba(aba);
        return (
          <View key={aba.indice} style={[estilos.aba, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
            <Texto variante="subtitulo">{tituloDaAba(aba)}</Texto>
            <Texto variante="suave">{contagensDaAba(aba).join(' · ')}</Texto>
            {problemasEmOrdem(aba.problemas).map((p) => <Texto key={p.codigo}>{`• ${textoDoProblema(p)}`}</Texto>)}
            {reconhecidas.length > 0 ? <Texto variante="pequeno">{`Colunas reconhecidas: ${reconhecidas.join('; ')}.`}</Texto> : null}
            {naoReconhecidas.length > 0 ? <Texto variante="pequeno">{`Colunas que ficam de fora: ${naoReconhecidas.join('; ')}.`}</Texto> : null}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(1) },
  aba: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
});
