import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
 * problemas e nomes de aba e de coluna; nada é gravado e o resultado fica só nesta tela. Só aparece com a chave ligada
 * (`migracaoAssistidaHabilitada` do `GET /eu`) e com um arquivo escolhido.
 */
export function ConferirOArquivo({ arquivo }: { arquivo: ArquivoEscolhido | null }) {
  const { migracaoAssistidaHabilitada } = useSessao();
  const [lido, setLido] = useState<{ de: ArquivoEscolhido; diagnostico: DiagnosticoDoArquivo } | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!migracaoAssistidaHabilitada) return null;

  const conferir = async () => {
    if (!arquivo) return;
    setOcupado(true);
    setErro(null);
    try {
      setLido({ de: arquivo, diagnostico: await diagnosticarArquivo(await formulario(arquivo)) });
    } catch (e) {
      setLido(null);
      setErro(e);
    } finally {
      setOcupado(false);
    }
  };

  // O resultado é do arquivo que foi conferido: trocar o arquivo esconde o diagnóstico velho.
  const diagnostico = lido && arquivo && lido.de === arquivo ? lido.diagnostico : null;

  return (
    <Cartao titulo="Conferir o arquivo antes de importar" descricao="Mostra o que dá e o que não dá para importar, sem gravar nada. O arquivo não fica guardado.">
      <View style={estilos.coluna}>
        <Botao rotulo="Conferir o arquivo antes de importar" tipo="secundario" carregando={ocupado} desabilitado={!arquivo}
          motivo="Escolha um arquivo primeiro." aoTocar={conferir} testID="conferir-arquivo" />
        {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
        {diagnostico ? <Resultado diagnostico={diagnostico} /> : null}
      </View>
    </Cartao>
  );
}

function Resultado({ diagnostico }: { diagnostico: DiagnosticoDoArquivo }) {
  const { cores } = useTema();
  const v = veredito(diagnostico);
  return (
    <View style={estilos.coluna} testID="diagnostico-do-arquivo">
      <Alerta tom={v.tom} titulo={v.titulo} texto={v.texto} />
      <Texto variante="subtitulo">{rotuloDoTipoDoArquivo(diagnostico.tipo)}</Texto>
      <Texto variante="suave">{detalheDoTipoDoArquivo(diagnostico.tipo)}</Texto>
      <Texto>{`${diagnostico.linhas} ${diagnostico.linhas === 1 ? 'linha de dados' : 'linhas de dados'} em ${diagnostico.abas.length} ${diagnostico.abas.length === 1 ? 'aba' : 'abas'}.`}</Texto>
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
