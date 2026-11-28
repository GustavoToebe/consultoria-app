import * as ImagePicker from 'expo-image-picker';
import { Check, ImagePlus, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { consultoria as buscarConsultoria, enviarLogo, removerLogo } from '../../api/rotas';
import type { ConsultoriaResponse, Fonte, Marca, Tema } from '../../api/tipos';
import { avaliarMarca, avisoDeMarcaPertoDeStatus, paletaDaCor, PALETAS } from '../../dominio/paletas';
import { remetenteDosEmails } from '../../dominio/previaDaMarca';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { CODIGOS_PALETAS_VISIVEIS, espaco, PALETAS as PALETAS_DO_TEMA, RAIO, textoSobre, type Cores } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { LinkTexto } from '../../ui/LinkTexto';
import { FAMILIAS } from '../../ui/MarcaTitulo';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { anexarLogo } from './anexarLogo';
import { LARGURA_DO_FORMULARIO_DA_MARCA } from './arranjoDaMarca';
import { ComPrevia } from './ComPrevia';
import { GradeDeAmostras, OpcaoDeAmostra } from './GradeDeAmostras';
import { PreviaDaMarca } from './PreviaDaMarca';
import { RodapeDeSalvar } from './RodapeDeSalvar';
import { useSalvarConsultoria } from './useSalvarConsultoria';

const LOGO_MAXIMO = 512 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Bolinha da cor e miniatura do tema. */
const BOLINHA = 40;
const MINIATURA = { largura: 52, altura: 36 };

const FONTES: { valor: Fonte; descricao: string }[] = [
  { valor: 'PADRAO', descricao: 'Padrão (Geist)' },
  { valor: 'METAL', descricao: 'Metal, pesada' },
  { valor: 'ESPORTIVA', descricao: 'Esportiva, alta' },
  { valor: 'CONDENSADA', descricao: 'Condensada' },
];

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/**
 * Marca da consultoria, só a identidade (27/11): Identidade (nome e logo), Cor da marca (grade de bolinhas), Fonte do nome e
 * Tema padrão, com a prévia ao vivo do app do aluno. Contato e acompanhamento moram nas telas deles e vão no mesmo PUT
 * com os valores gravados (`useSalvarConsultoria`).
 */
export function FormMarca({ consultoria, aoSalvar, aoConflito }: Props) {
  const { atualizarMarca } = useSessao();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const inicial = consultoria.marca;
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.corPrimaria);
  // Cor que não é de nenhuma paleta (ou escolhida como tal) mostra o campo #RRGGBB.
  const [personalizada, setPersonalizada] = useState(!paletaDaCor(inicial.corPrimaria));
  const campoDaCor = useRef<TextInput>(null);
  const [fonte, setFonte] = useState<Fonte>(inicial.fonteTitulo);
  const [tema, setTema] = useState<Tema>(inicial.temaPadrao);
  const [logoUrl, setLogoUrl] = useState(inicial.logoUrl);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  // Erro da logo fica no próprio campo (guia de 11/11, pág. 16): a prévia segue com a logo que valia.
  const [erroLogo, setErroLogo] = useState<string | null>(null);
  const { salvar, salvando, erro, campos } = useSalvarConsultoria({
    consultoria, aoSalvar, aoConflito, sucesso: 'Marca salva. Os alunos veem a nova marca ao abrir o app.',
  });
  const corValida = HEX.test(cor);
  const avaliacao = avaliarMarca(cor, tema);
  const pertoDeStatus = avisoDeMarcaPertoDeStatus(cor);
  const alterado = nome.trim() !== inicial.nome || cor !== inicial.corPrimaria || fonte !== inicial.fonteTitulo || tema !== inicial.temaPadrao;
  const motivo = !nome.trim() ? 'Informe o nome da consultoria.'
    : !corValida ? 'Use uma cor no formato #RRGGBB.'
      : avaliacao.bloqueia ? 'Escolha uma cor que segure texto branco.'
        : null;
  const previa: Marca = { ...inicial, nome: nome.trim() || inicial.nome, corPrimaria: corValida ? cor : inicial.corPrimaria, fonteTitulo: fonte, temaPadrao: tema, logoUrl };
  const marcaNaMiniatura = corValida ? cor : inicial.corPrimaria;
  const paletaAtual = personalizada ? undefined : paletaDaCor(cor);
  const nomeNaFonte = nome.trim() || inicial.nome;

  const escolherLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const tipo = a.mimeType ?? (a.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    setErroLogo(null);
    if (tipo !== 'image/png' && tipo !== 'image/jpeg') {
      setErroLogo('A logo precisa ser PNG ou JPEG.');
      return;
    }
    if (a.fileSize && a.fileSize > LOGO_MAXIMO) {
      setErroLogo('A logo pode ter no máximo 512 KB.');
      return;
    }
    const dados = new FormData();
    setEnviando(true);
    try {
      await anexarLogo(dados, a, tipo);
      const marca = await enviarLogo(dados);
      setLogoUrl(marca.logoUrl);
      atualizarMarca(marca);
      // A logo já está salva: o aviso vem antes de reler a consultoria, que pode falhar sem desfazer o envio.
      avisar('Logo enviada.', 'sucesso');
      buscarConsultoria().then(aoSalvar, () => undefined);
    } catch (e) {
      setErroLogo(textoDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const tirarLogo = () => {
    setConfirmarRemocao(false);
    setErroLogo(null);
    removerLogo().then(
      (marca) => {
        setLogoUrl(null);
        atualizarMarca(marca);
        avisar('Logo removida. O nome da consultoria aparece no lugar.', 'sucesso');
      },
      (e: unknown) => setErroLogo(textoDoErro(e)),
    );
  };

  const escolherPersonalizada = () => {
    setPersonalizada(true);
    // O campo aparece no mesmo toque: o foco vai para ele no quadro seguinte (o leitor de tela anuncia o rótulo).
    setTimeout(() => campoDaCor.current?.focus(), 0);
  };

  const personalizadaVisivel = personalizada && corValida;

  const formulario = (
    <>
      <Cartao titulo="Identidade" descricao="Nome e logo que os alunos veem no topo do app.">
        <Campo rotulo="Nome da consultoria" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
        <View style={estilos.logo}>
          <Texto variante="rotulo">Logo</Texto>
          <Texto variante="suave">PNG ou JPEG de até 512 KB. Com logo, ela aparece no lugar do nome.</Texto>
          <View style={estilos.botoes}>
            <Botao rotulo={logoUrl ? 'Trocar logo' : 'Enviar logo'} tipo={logoUrl ? 'secundario' : 'acao'} Icone={ImagePlus} carregando={enviando} aoTocar={() => void escolherLogo()} />
            {logoUrl ? <Botao rotulo="Remover logo" tipo="perigo" Icone={Trash2} aoTocar={() => setConfirmarRemocao(true)} /> : null}
          </View>
          {erroLogo ? <MensagemDeErro erro={erroLogo} /> : null}
        </View>
      </Cartao>

      <Cartao titulo="Cor da marca" descricao="Botões principais, menu e aba ativos e o nome da consultoria.">
        <View style={estilos.linhaDaCor}>
          <View style={estilos.gradeDeCores}>
            <GradeDeAmostras rotulo="Cor da marca" minimo={56} maximo={7}>
              {PALETAS.map((p) => (
                <OpcaoDeAmostra key={p.id} nome={p.nome} selecionada={paletaAtual?.id === p.id} largura={BOLINHA} altura={BOLINHA} raio={BOLINHA / 2}
                  corDoVisto={textoSobre(p.cor)} aoEscolher={() => { setCor(p.cor); setPersonalizada(false); }}>
                  <View style={[estilos.cheia, { backgroundColor: p.cor }]} />
                </OpcaoDeAmostra>
              ))}
              <OpcaoDeAmostra nome="Outra cor" dica="Cor personalizada: digite um código #RRGGBB" selecionada={personalizada} largura={BOLINHA} altura={BOLINHA} raio={BOLINHA / 2}
                corDoVisto={personalizadaVisivel ? textoSobre(cor) : undefined} aoEscolher={escolherPersonalizada}>
                {personalizadaVisivel ? <View style={[estilos.cheia, { backgroundColor: cor }]} /> : (
                  <View style={[estilos.cheia, estilos.vazada, { backgroundColor: cores.superficie2, borderColor: cores.bordaCampo, borderRadius: BOLINHA / 2 }]}>
                    <Texto variante="bloco">#</Texto>
                  </View>
                )}
              </OpcaoDeAmostra>
            </GradeDeAmostras>
          </View>
          {personalizada ? (
            <View style={estilos.campoCor}>
              <Campo
                ref={campoDaCor}
                rotulo="Código da cor"
                valor={cor}
                aoMudar={(t) => setCor(t.startsWith('#') ? t.toUpperCase() : `#${t.toUpperCase()}`)}
                erro={campos.corPrimaria ?? (corValida ? null : 'Use o formato #RRGGBB.')}
                ajuda="No formato #RRGGBB."
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                maxLength={7}
              />
            </View>
          ) : null}
        </View>
        {avaliacao.bloqueia ? <MensagemErro texto={avaliacao.bloqueia} /> : null}
        {!avaliacao.bloqueia && avaliacao.aviso ? <View aria-hidden><Texto variante="suave" testID="aviso-marca-apagada">{avaliacao.aviso}</Texto></View> : null}
        {pertoDeStatus ? <Texto variante="suave" testID="aviso-marca-perto-de-status">{pertoDeStatus}</Texto> : null}
      </Cartao>

      <Cartao titulo="Fonte do nome" descricao="Vale para quem não usa logo. O nome aparece em cada fonte.">
        <View role="radiogroup" aria-label="Fonte do nome">
          <Grade colunas={(l) => (l >= 560 ? 4 : 2)} gap={espaco(1)}>
            {FONTES.map((f) => (
              <OpcaoDeFonte key={f.valor} nome={nomeNaFonte} familia={FAMILIAS[f.valor]} descricao={f.descricao}
                selecionada={fonte === f.valor} aoEscolher={() => setFonte(f.valor)} />
            ))}
          </Grade>
        </View>
      </Cartao>

      <Cartao titulo="Tema padrão" descricao="Fundo e cartões do app dos alunos e da equipe, até a pessoa escolher outro em Aparência e preferências.">
        {/* Uma escolha só: um radiogroup com dois subgrupos rotulados (leitor de tela: "Escuras, grupo", "Oceano, selecionado"). */}
        <View role="radiogroup" aria-label="Tema padrão da consultoria" style={estilos.temas}>
          {(['ESCURO', 'CLARO'] as const).map((modo) => {
            const codigos = CODIGOS_PALETAS_VISIVEIS.filter((c) => PALETAS_DO_TEMA[c].modo === modo);
            return (
              // Cada grupo na largura natural das suas miniaturas (células de 64): no PC os dois numa linha; no celular, um embaixo do outro.
              <View key={modo} style={{ width: codigos.length * 64 + (codigos.length - 1) * espaco(0.5), maxWidth: '100%' }}>
                <GradeDeAmostras rotulo={modo === 'ESCURO' ? 'Escuras' : 'Claras'} rotuloVisivel papel="group" minimo={60} maximo={codigos.length}>
                  {codigos.map((c) => (
                    <OpcaoDeAmostra key={c} nome={PALETAS_DO_TEMA[c].nome} selecionada={tema === c} aoEscolher={() => setTema(c)}
                      largura={MINIATURA.largura} altura={MINIATURA.altura} raio={8} corDoVisto={PALETAS_DO_TEMA[c].cores.texto}>
                      <MiniaturaDoTema cores={PALETAS_DO_TEMA[c].cores} marca={marcaNaMiniatura} />
                    </OpcaoDeAmostra>
                  ))}
                </GradeDeAmostras>
              </View>
            );
          })}
        </View>
        {/* A mesma checagem do cartão Cor, repetida aqui: em 390 px quem troca a paleta não vê o cartão de cima. Este é o texto
            lido (região viva, anuncia ao trocar de paleta); o do cartão Cor fica aria-hidden para não ser lido duas vezes. */}
        <View accessibilityLiveRegion="polite">
          {!avaliacao.bloqueia && avaliacao.aviso ? <Texto variante="suave" testID="aviso-marca-apagada-na-paleta">{avaliacao.aviso}</Texto> : null}
        </View>
        <LinkTexto texto="Escolher o tema do meu painel em Aparência e preferências" href="/treinador/ajustes" />
      </Cartao>
    </>
  );

  return (
    <>
      <ComPrevia
        largura={LARGURA_DO_FORMULARIO_DA_MARCA}
        formulario={formulario}
        previa={(arranjo) => (
          <PreviaDaMarca marca={previa} tema={tema} arranjo={arranjo} remetente={remetenteDosEmails(consultoria.emailRemetenteNome, previa.nome)} />
        )}
        fim={(
          <>
            {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
            <RodapeDeSalvar alterado={alterado} rotulo="Salvar marca" salvando={salvando} motivo={motivo}
              aoSalvar={() => salvar({ nome: nome.trim(), corPrimaria: cor, fonteTitulo: fonte, temaPadrao: tema })} />
          </>
        )}
      />
      <PainelConfirmacao
        visivel={confirmarRemocao}
        titulo="Remover a logo?"
        mensagem="O nome da consultoria volta a aparecer no lugar da logo."
        rotuloConfirmar="Remover logo"
        perigo
        aoConfirmar={tirarLogo}
        aoCancelar={() => setConfirmarRemocao(false)}
      />
    </>
  );
}

/**
 * Opção da fonte (27/11): o nome escrito na fonte em cima, a descrição e o ✓ embaixo. Peça local, não o `OpcaoCartao`: com
 * quatro numa linha o ✓ ao lado do título partia o nome no meio da palavra, e o cartão precisa encher a altura da célula
 * (`flexGrow`) para os quatro ficarem iguais. Seleção neutra, como o `OpcaoCartao` (`sobre` + `bordaCampo` de 2 px + ✓).
 */
function OpcaoDeFonte({ nome, familia, descricao, selecionada, aoEscolher }: { nome: string; familia?: string; descricao: string; selecionada: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selecionada }}
      aria-checked={selecionada}
      accessibilityLabel={`${nome}. ${descricao}`}
      onPress={aoEscolher}
      style={(estado) => [
        estilos.fonte,
        {
          backgroundColor: selecionada ? cores.sobre : sobre(estado) ? cores.superficie2 : cores.superficie,
          borderColor: selecionada ? cores.bordaCampo : cores.divisor,
          borderWidth: selecionada ? 2 : 1,
          padding: espaco(1.5) - (selecionada ? 1 : 0),
        },
      ]}>
      <Texto numberOfLines={2} style={[estilos.nomeNaFonte, { fontFamily: familia }]}>{nome}</Texto>
      <View style={estilos.rodapeDaFonte}>
        <Texto variante="suave" style={estilos.descricaoDaFonte}>{descricao}</Texto>
        {selecionada ? <Check size={18} color={cores.texto} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

/** Miniatura do app numa paleta: fundo, faixa do título, um cartão com uma linha de texto e o botão na cor da marca. */
function MiniaturaDoTema({ cores, marca }: { cores: Cores; marca: string }) {
  return (
    <View style={[estilos.miniatura, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
      <View style={[estilos.miniaturaFaixa, { backgroundColor: cores.superficie3 }]} />
      <View style={[estilos.miniaturaCartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View style={[estilos.miniaturaLinha, { backgroundColor: cores.textoSuave }]} />
        <View style={[estilos.miniaturaBotao, { backgroundColor: marca }]} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  logo: { gap: espaco(0.75) },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  // Bolinhas numa base de 7 × 64 e o campo do código ao lado; sem lugar, o campo desce (o `wrap`).
  linhaDaCor: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  gradeDeCores: { flexGrow: 0, flexShrink: 1, flexBasis: 7 * 64 + 6 * espaco(0.5), minWidth: 0 },
  campoCor: { flexBasis: 160, flexGrow: 0, flexShrink: 0, paddingTop: espaco(0.5) },
  cheia: { width: '100%', height: '100%' },
  vazada: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  temas: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(2) },
  fonte: { flexGrow: 1, minHeight: 44, borderRadius: RAIO, gap: espaco(1), justifyContent: 'space-between' },
  nomeNaFonte: { fontSize: 18, lineHeight: 24 },
  rodapeDaFonte: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  descricaoDaFonte: { flex: 1 },
  miniatura: { width: '100%', height: '100%', borderWidth: 1, borderRadius: 8, padding: 4, gap: 3 },
  miniaturaFaixa: { height: 6, borderRadius: 2 },
  miniaturaCartao: { flex: 1, borderWidth: 1, borderRadius: 3, padding: 3, justifyContent: 'space-between' },
  miniaturaLinha: { height: 2, width: '70%', borderRadius: 1 },
  miniaturaBotao: { height: 4, width: '50%', borderRadius: 2 },
});
