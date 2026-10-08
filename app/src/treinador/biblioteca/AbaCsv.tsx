import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { confirmarCsv, previaCsv, type TipoBiblioteca } from '../../api/rotas';
import type { PreviaCsv } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

const CABECALHOS: Record<TipoBiblioteca, string> = {
  exercicios: 'nome;grupo;equipamento;modalidade;video',
  alimentos: 'nome;quantidade_base;unidade;kcal;proteina;carboidrato;gordura;fonte',
};

async function lerArquivo(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/plain', 'text/comma-separated-values', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.size && a.size > 900 * 1024) throw new Error('Arquivo grande demais (máximo de 1.000 linhas).');
  if (Platform.OS === 'web' && a.file) return a.file.text();
  return new File(a.uri).text();
}

/**
 * Importação por CSV como no Servirea: colar ou escolher o arquivo, ver a prévia com os erros por linha e confirmar.
 * A confirmação manda o mesmo texto com o hash da prévia (se o texto mudou, a API recusa).
 */
export function AbaCsv() {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [texto, setTexto] = useState('');
  const [previa, setPrevia] = useState<PreviaCsv | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const mudarTexto = (t: string) => {
    setTexto(t);
    setPrevia(null);
  };

  const escolher = () => {
    setErroArquivo(null);
    lerArquivo().then(
      (t) => {
        if (t !== null) mudarTexto(t);
      },
      (e: unknown) => setErroArquivo(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.'),
    );
  };

  const verPrevia = () => {
    setOcupado(true);
    setErro(null);
    previaCsv(tipo, texto).then(
      (p) => {
        setOcupado(false);
        setPrevia(p);
      },
      (e: unknown) => {
        setOcupado(false);
        setErro(e);
      },
    );
  };

  const confirmar = () => {
    if (!previa) return;
    setOcupado(true);
    confirmarCsv(tipo, texto, previa.hash).then(
      (r) => {
        setOcupado(false);
        setPrevia(null);
        setTexto('');
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já existia(m)` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setOcupado(false);
        setErro(e);
      },
    );
  };

  return (
    <View style={estilos.aba}>
      <Escolha
        rotulo="Importar"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setPrevia(null);
        }}
      />
      <Texto cor="suave">Primeira linha com o cabeçalho, separado por ; ou , (até 1.000 linhas):</Texto>
      <Texto selectable style={[estilos.codigo, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
        {CABECALHOS[tipo]}
      </Texto>
      <Campo rotulo="Conteúdo do CSV" valor={texto} aoMudar={mudarTexto} linhas={8} autoCapitalize="none" placeholder="Cole aqui ou escolha o arquivo" />
      <View style={estilos.botoes}>
        <Botao rotulo="Escolher arquivo" tipo="secundario" Icone={FileUp} aoTocar={escolher} />
        <Botao rotulo="Ver prévia" tipo="secundario" carregando={ocupado && !previa} desabilitado={!texto.trim()} aoTocar={verPrevia} />
      </View>
      {erroArquivo ? <MensagemErro texto={erroArquivo} /> : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {previa ? (
        <View style={[estilos.previa, { borderColor: cores.borda }]}>
          <View style={estilos.botoes}>
            <Selo texto={`${previa.validas.length} prontas`} tipo="sucesso" />
            {previa.erros.length ? <Selo texto={`${previa.erros.length} com erro`} tipo="perigo" /> : null}
          </View>
          {previa.validas.slice(0, 10).map((v) => (
            <Texto key={v.linha} cor="suave">
              Linha {v.linha}: {v.nome}
            </Texto>
          ))}
          {previa.validas.length > 10 ? <Texto variante="pequeno">… e mais {previa.validas.length - 10}.</Texto> : null}
          {previa.erros.map((e) => (
            <Texto key={`e${e.linha}`} cor={cores.perigo}>
              Linha {e.linha}: {e.motivo}
            </Texto>
          ))}
          <Texto variante="pequeno">As linhas com erro ficam de fora. Corrija o texto e veja a prévia de novo, se quiser.</Texto>
          <View style={estilos.botoes}>
            <Botao
              rotulo={`Importar ${previa.validas.length} linha(s)`}
              carregando={ocupado}
              desabilitado={previa.validas.length === 0}
              aoTocar={confirmar}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  aba: { gap: espaco(1.5) },
  codigo: { fontFamily: fontes.semi, fontSize: 13, borderWidth: 1, borderRadius: RAIO, padding: espaco(1) },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
});
