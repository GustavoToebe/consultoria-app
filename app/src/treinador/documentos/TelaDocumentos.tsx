import { router } from 'expo-router';
import { FileDown, Lock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { alterarTemaPdf, consultoria } from '../../api/rotas';
import { MOTIVO_FORA_DO_PLANO } from '../../dominio/funcionalidadesDoPlano';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from '../../pdf/exemplos';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { TEMAS_PDF, temaValido, type TemaPdf } from '../../pdf/temas';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { OpcaoCartao } from '../../ui/OpcaoCartao';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { PreviaDoDocumento } from './PreviaDoDocumento';

type Aba = 'treino' | 'dieta';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'treino', rotulo: 'Treino' },
  { valor: 'dieta', rotulo: 'Dieta' },
];

/** A partir desta largura de conteúdo, a escolha do tema fica numa coluna ao lado da prévia (a folha é alta). */
const PREVIA_AO_LADO = 760;
/** Na web a coluna da escolha acompanha a rolagem: dá para trocar o tema olhando qualquer parte da folha. */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), zIndex: 1 } : {}) as unknown as ViewStyle;

/**
 * Documentos (PDF): escolha e prévia do tema dos PDFs da consultoria nos três temas (treino e dieta com dados de exemplo)
 * e download do PDF de exemplo. A guarda da rota já exige administrador com MARCA_ALTERAR; o plano sem PDF é conferido aqui,
 * porque a guarda não conhece as funcionalidades do plano.
 */
export function TelaDocumentos() {
  const { temFuncionalidade } = useSessao();
  if (!temFuncionalidade('PDF')) {
    return (
      <Tela>
        <Vazio
          Icone={Lock}
          nivel={1}
          titulo={MOTIVO_FORA_DO_PLANO}
          texto="Os documentos em PDF não fazem parte do plano da sua consultoria."
          acao={{ rotulo: 'Voltar às configurações', aoTocar: () => router.replace('/treinador/configuracoes') }}
        />
      </Tela>
    );
  }
  return <Documentos />;
}

function Documentos() {
  const { atualizarMarca } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('consultoria', () => consultoria());
  const { avisar } = useAviso();
  const [aba, setAba] = useState<Aba>('treino');
  const [tema, setTema] = useState<TemaPdf | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [largura, setLargura] = useState(0);
  // Uma data por visita: a prévia não muda sozinha a cada troca de tema.
  const [emitidoEm] = useState(() => new Date());

  const marca = dados?.marca;
  const temaSalvo = temaValido(marca?.temaPdf);
  const temaAtual = tema ?? temaSalvo;
  const alterado = temaAtual !== temaSalvo;
  const nomeDoTema = TEMAS_PDF.find((t) => t.id === temaAtual)?.nome ?? '';

  // A logo vem à parte e não segura a prévia: sem ela (ou sem internet), a faixa mostra o nome da consultoria.
  useEffect(() => {
    if (!marca) return;
    let vivo = true;
    logoComoDataUri(marca).then((l) => vivo && setLogo(l), () => undefined);
    return () => {
      vivo = false;
    };
  }, [marca]);

  const documento = useMemo(() => {
    if (!marca) return null;
    const gerar = aba === 'treino' ? documentoDeExemploDeTreino : documentoDeExemploDeDieta;
    return gerar({ ...marca, temaPdf: temaAtual }, emitidoEm, logo);
  }, [marca, aba, temaAtual, emitidoEm, logo]);

  const salvar = () => {
    if (!marca || salvando || !alterado) return;
    setSalvando(true);
    alterarTemaPdf(temaAtual)
      .then((c) => {
        atualizarMarca(c.marca);
        setTema(null);
        recarregar();
        avisar('Tema dos PDFs salvo.', 'sucesso');
      })
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setSalvando(false));
  };

  const baixar = () => {
    if (!documento) return;
    setBaixando(true);
    imprimir(documento)
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setBaixando(false));
  };

  const aoLado = largura >= PREVIA_AO_LADO;

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Documentos (PDF)" descricao="Escolha o tema aplicado aos PDFs da consultoria e veja a prévia com dados de exemplo." />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {documento ? (
        <View style={estilos.corpo}>
          <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
          <View style={[estilos.area, aoLado ? estilos.areaAoLado : null]} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
            <View style={aoLado ? [estilos.ajustesAoLado, GRUDADA] : null}>
              <Cartao titulo="Tema" descricao="Escolha o tema dos PDFs de treino, dieta e demais documentos da consultoria.">
                <View role="radiogroup" aria-label="Tema do PDF" style={estilos.temas}>
                  {TEMAS_PDF.map((t) => (
                    <OpcaoCartao key={t.id} titulo={t.nome} descricao={t.descricao} selecionada={temaAtual === t.id} aoEscolher={() => setTema(t.id)} />
                  ))}
                </View>
                <Botao rotulo="Salvar tema" desabilitado={!alterado} carregando={salvando} aoTocar={salvar} />
                <Botao rotulo="Baixar PDF de exemplo" tipo="secundario" Icone={FileDown} carregando={baixando} aoTocar={baixar} />
              </Cartao>
            </View>
            <View style={aoLado ? estilos.colunaDaPrevia : null}>
              <Cartao titulo={`Prévia: ${ABAS.find((a) => a.valor === aba)?.rotulo} no tema ${nomeDoTema}`} descricao="Dados de exemplo, nenhum é real. A folha é contínua: as quebras de página só aparecem no PDF.">
                <PreviaDoDocumento documento={documento} rotulo={`Prévia do PDF de ${aba} no tema ${nomeDoTema}, com dados de exemplo`} />
              </Cartao>
            </View>
          </View>
        </View>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  area: { gap: espaco(3) },
  areaAoLado: { flexDirection: 'row', alignItems: 'flex-start' },
  // `flex-start`: sem ele a coluna estica até a altura da prévia e o `sticky` não tem para onde andar.
  ajustesAoLado: { width: 340, alignSelf: 'flex-start' },
  temas: { gap: espaco(1) },
  colunaDaPrevia: { flex: 1, minWidth: 0 },
});
