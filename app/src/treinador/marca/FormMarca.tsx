import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarMarca, consultoria as buscarConsultoria, enviarLogo, removerLogo } from '../../api/rotas';
import type { ConsultoriaResponse, Fonte, Marca, MetaDoPeso, Tema } from '../../api/tipos';
import { OPCOES_DA_META } from '../../dominio/metaDoPesoNaFicha';
import { avaliarMarca, avisoDeMarcaPertoDeStatus, paletaDaCor, PALETAS } from '../../dominio/paletas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, MARCA_NEUTRA, PALETAS as PALETAS_DO_TEMA, paletaDe, RAIO, textoSobre, type Cores } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { GradeDeOpcoes } from '../../ui/GradeDeOpcoes';
import { LinkTexto } from '../../ui/LinkTexto';
import { FAMILIAS, MarcaTitulo } from '../../ui/MarcaTitulo';
import { OpcaoCartao } from '../../ui/OpcaoCartao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { anexarLogo } from './anexarLogo';

const LOGO_MAXIMO = 512 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/** Nome, cor, fonte do título, paleta padrão e logo, com prévia do topo do app do aluno na paleta escolhida. */
export function FormMarca({ consultoria, aoSalvar, aoConflito }: Props) {
  const { atualizarMarca, cicloHabilitado } = useSessao();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const inicial = consultoria.marca;
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.corPrimaria);
  // Cor que não é de nenhuma paleta (ou escolhida como tal) mostra o campo #RRGGBB.
  const [personalizada, setPersonalizada] = useState(!paletaDaCor(inicial.corPrimaria));
  const [fonte, setFonte] = useState<Fonte>(inicial.fonteTitulo);
  const [tema, setTema] = useState<Tema>(inicial.temaPadrao);
  const [dias, setDias] = useState<number | null>(consultoria.diasAtualizacaoPadrao ?? null);
  const metaSalva: MetaDoPeso = consultoria.metaDoPeso ?? 'REDUZIR';
  const [meta, setMeta] = useState<MetaDoPeso>(metaSalva);
  const textosIniciais = consultoria.textosFasesCiclo;
  const [fases, setFases] = useState({
    menstrual: textosIniciais?.menstrual ?? '',
    folicular: textosIniciais?.folicular ?? '',
    ovulatoria: textosIniciais?.ovulatoria ?? '',
    lutea: textosIniciais?.lutea ?? '',
  });
  const texto = (s: string) => s.trim() || null;
  const textosAtuais = { menstrual: texto(fases.menstrual), folicular: texto(fases.folicular), ovulatoria: texto(fases.ovulatoria), lutea: texto(fases.lutea) };
  const textosSalvos = {
    menstrual: textosIniciais?.menstrual?.trim() || null,
    folicular: textosIniciais?.folicular?.trim() || null,
    ovulatoria: textosIniciais?.ovulatoria?.trim() || null,
    lutea: textosIniciais?.lutea?.trim() || null,
  };
  const diasValidos = dias === null || (Number.isInteger(dias) && dias >= 1 && dias <= 365);
  const [logoUrl, setLogoUrl] = useState(inicial.logoUrl);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const corValida = HEX.test(cor);
  const avaliacao = avaliarMarca(cor, tema);
  const pertoDeStatus = avisoDeMarcaPertoDeStatus(cor);
  // O botão de salvar só aparece quando algo mudou (logo salva na hora, à parte).
  const alterado =
    nome.trim() !== inicial.nome ||
    cor !== inicial.corPrimaria ||
    fonte !== inicial.fonteTitulo ||
    tema !== inicial.temaPadrao ||
    dias !== (consultoria.diasAtualizacaoPadrao ?? null) ||
    meta !== metaSalva ||
    JSON.stringify(textosAtuais) !== JSON.stringify(textosSalvos);
  const previa: Marca = { ...inicial, nome: nome || inicial.nome, corPrimaria: corValida ? cor : inicial.corPrimaria, fonteTitulo: fonte, temaPadrao: tema, logoUrl };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    alterarMarca({ nome: nome.trim(), corPrimaria: cor, fonteTitulo: fonte, temaPadrao: tema, versao: consultoria.versao, diasAtualizacaoPadrao: dias, textosFasesCiclo: textosAtuais, metaDoPeso: meta }).then(
      (c) => {
        setSalvando(false);
        aoSalvar(c);
        atualizarMarca(c.marca);
        avisar('Marca salva. Os alunos veem a nova marca ao abrir o app.', 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
          avisar('A marca foi alterada em outra aba. Recarregamos a versão atual.', 'atencao');
          aoConflito();
          return;
        }
        setErro(e);
      },
    );
  };

  const escolherLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    const tipo = a.mimeType ?? (a.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    if (tipo !== 'image/png' && tipo !== 'image/jpeg') {
      avisar('A logo precisa ser PNG ou JPEG.', 'perigo');
      return;
    }
    if (a.fileSize && a.fileSize > LOGO_MAXIMO) {
      avisar('A logo pode ter no máximo 512 KB.', 'perigo');
      return;
    }
    const dados = new FormData();
    setEnviando(true);
    try {
      await anexarLogo(dados, a, tipo);
      const marca = await enviarLogo(dados);
      setLogoUrl(marca.logoUrl);
      atualizarMarca(marca);
      aoSalvar(await buscarConsultoria());
      avisar('Logo enviada.', 'sucesso');
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setEnviando(false);
    }
  };

  const tirarLogo = () => {
    setConfirmarRemocao(false);
    removerLogo().then(
      (marca) => {
        setLogoUrl(null);
        atualizarMarca(marca);
        avisar('Logo removida. O nome da consultoria aparece no lugar.', 'sucesso');
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  const nomeNaFonte = nome.trim() || inicial.nome;
  const paletaAtual = personalizada ? undefined : paletaDaCor(cor);
  const FONTES: { valor: Fonte; descricao: string }[] = [
    { valor: 'PADRAO', descricao: 'Padrão (Inter)' },
    { valor: 'METAL', descricao: 'Metal, para um visual pesado' },
    { valor: 'ESPORTIVA', descricao: 'Esportiva, letras altas' },
    { valor: 'CONDENSADA', descricao: 'Condensada, firme e compacta' },
  ];

  return (
    <>
      <Cartao titulo="Prévia do app do aluno" descricao="Acompanha o que você escolhe abaixo.">
        <View style={estilos.previas}>
          <Previa marca={previa} tema={tema} />
        </View>
      </Cartao>
      <Cartao titulo="Identidade" descricao="Nome e logo que os alunos veem no topo do app.">
        <Campo rotulo="Nome da consultoria" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
        <View style={estilos.logo}>
          <Texto variante="rotulo">Logo</Texto>
          <Texto variante="suave">PNG ou JPEG de até 512 KB. Com logo, ela aparece no lugar do nome.</Texto>
          <View style={estilos.botoesEsquerda}>
            <Botao rotulo={logoUrl ? 'Trocar logo' : 'Enviar logo'} tipo="secundario" Icone={ImagePlus} carregando={enviando} aoTocar={() => void escolherLogo()} />
            {logoUrl ? <Botao rotulo="Remover logo" tipo="perigoTexto" Icone={Trash2} aoTocar={() => setConfirmarRemocao(true)} /> : null}
          </View>
        </View>
      </Cartao>
      <Cartao titulo="Cor" descricao="Aparece em botões principais, menu e aba ativos e no nome da consultoria.">
        <GradeDeOpcoes rotulo="Cores prontas">
          {PALETAS.map((p) => (
            <OpcaoCartao
              key={p.id}
              titulo={p.nome}
              descricao={p.descricao}
              selecionada={paletaAtual?.id === p.id}
              aoEscolher={() => {
                setCor(p.cor);
                setPersonalizada(false);
              }}
              amostra={
                <View style={[estilos.amostra, { backgroundColor: p.cor }]}>
                  <Texto variante="bloco" style={{ color: textoSobre(p.cor) }}>{p.nome.charAt(0)}</Texto>
                </View>
              }
            />
          ))}
          <OpcaoCartao
            titulo="Cor personalizada"
            descricao="Digite um código #RRGGBB"
            selecionada={personalizada}
            aoEscolher={() => setPersonalizada(true)}
            amostra={
              <View style={[estilos.amostra, { backgroundColor: corValida ? cor : MARCA_NEUTRA }]}>
                <Texto variante="bloco" style={{ color: textoSobre(corValida ? cor : MARCA_NEUTRA) }}>#</Texto>
              </View>
            }
          />
        </GradeDeOpcoes>
        {personalizada ? (
          <View style={estilos.campoCor}>
            <Campo
              rotulo="Cor principal (#RRGGBB)"
              valor={cor}
              aoMudar={(t) => setCor(t.startsWith('#') ? t.toUpperCase() : `#${t.toUpperCase()}`)}
              erro={campos.corPrimaria ?? (corValida ? null : 'Use o formato #RRGGBB.')}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
        ) : null}
        {avaliacao.bloqueia ? <MensagemErro texto={avaliacao.bloqueia} /> : null}
        {!avaliacao.bloqueia && avaliacao.aviso ? <View aria-hidden><Texto variante="suave" testID="aviso-marca-apagada">{avaliacao.aviso}</Texto></View> : null}
        {pertoDeStatus ? <Texto variante="suave" testID="aviso-marca-perto-de-status">{pertoDeStatus}</Texto> : null}
      </Cartao>
      <Cartao titulo="Fonte do nome" descricao="Vale para quem não usa logo. O nome aparece em cada fonte.">
        <GradeDeOpcoes rotulo="Fonte do nome">
          {FONTES.map((f) => (
            <OpcaoCartao
              key={f.valor}
              titulo={nomeNaFonte}
              fonteDoTitulo={FAMILIAS[f.valor]}
              descricao={f.descricao}
              selecionada={fonte === f.valor}
              aoEscolher={() => setFonte(f.valor)}
            />
          ))}
        </GradeDeOpcoes>
      </Cartao>
      <Cartao titulo="Paleta padrão dos alunos" descricao="Fundo e cartões do app dos alunos e da equipe. Cada pessoa ainda pode trocar para o Escuro, o Claro ou a Areia na própria conta.">
        {/* Uma escolha só: um radiogroup com dois subgrupos rotulados (leitor de tela: "Escuras, grupo", "Oceano, selecionado"). */}
        <View role="radiogroup" aria-label="Paleta padrão dos alunos" style={estilos.paletas}>
        {(['ESCURO', 'CLARO'] as const).map((modo) => (
          <GradeDeOpcoes key={modo} papel="group" rotulo={modo === 'ESCURO' ? 'Escuras' : 'Claras'}>
            {CODIGOS_DAS_PALETAS.filter((c) => PALETAS_DO_TEMA[c].modo === modo).map((c) => (
              <OpcaoCartao
                key={c}
                titulo={PALETAS_DO_TEMA[c].nome}
                selecionada={tema === c}
                aoEscolher={() => setTema(c)}
                amostra={<MiniaturaDoTema cores={PALETAS_DO_TEMA[c].cores} marca={corValida ? cor : inicial.corPrimaria} />}
              />
            ))}
          </GradeDeOpcoes>
        ))}
        </View>
        {/* A mesma checagem do cartão Cor, repetida aqui: em 390 px quem troca a paleta não vê o cartão de cima. Este é o texto
            lido (região viva, anuncia ao trocar de paleta); o do cartão Cor fica aria-hidden para não ser lido duas vezes. */}
        <View accessibilityLiveRegion="polite">
          {!avaliacao.bloqueia && avaliacao.aviso ? <Texto variante="suave" testID="aviso-marca-apagada-na-paleta">{avaliacao.aviso}</Texto> : null}
        </View>
        <LinkTexto texto="Escolher o tema do meu painel em Ajustes" href="/treinador/ajustes" />
      </Cartao>
      <Cartao titulo="Acompanhamento" descricao="Vale para os alunos sem ciclo ou meta própria no cadastro.">
        <View style={estilos.campoDias}>
          <CampoNumerico
            rotulo="Nova atualização a cada (dias)"
            inteiro
            valor={dias}
            aoMudar={setDias}
            erro={campos.diasAtualizacaoPadrao ?? (diasValidos ? null : 'Use de 1 a 365 dias.')}
            ajuda="Preenche o início e o fim de cada pasta nova. Vazio = sem padrão."
          />
        </View>
        <View style={estilos.meta}>
          <Escolha rotulo="Meta do peso dos alunos" valor={meta} aoMudar={setMeta} opcoes={OPCOES_DA_META} />
          <Texto variante="pequeno">Pinta a variação do peso: verde na direção da meta, vermelho contra; sem meta, sem cor. Na ficha de cada aluno dá para trocar.</Texto>
        </View>
        {cicloHabilitado ? (
        <Cartao titulo="Ciclo menstrual: textos das fases" recolhivel recolhido
          descricao="Aparece para a aluna e para a equipe junto da fase. O app não recomenda nada por conta própria: escreva só o que você orienta.">
          {(['menstrual', 'folicular', 'ovulatoria', 'lutea'] as const).map((fase) => (
            <Campo key={fase} rotulo={{ menstrual: 'Menstrual', folicular: 'Folicular', ovulatoria: 'Ovulatória', lutea: 'Lútea' }[fase]}
              valor={fases[fase]} aoMudar={(valor) => setFases((atual) => ({ ...atual, [fase]: valor }))} maxLength={1000} linhas={3} />
          ))}
        </Cartao>
        ) : null}
      </Cartao>
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {alterado ? (
        <View style={[estilos.rodape, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Texto variante="suave" style={estilos.textoRodape}>Alterações ainda não salvas.</Texto>
          <Botao rotulo="Salvar marca" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !corValida || !!avaliacao.bloqueia || !diasValidos}
            motivo={!nome.trim() ? 'Informe o nome da consultoria.' : !corValida ? 'Use uma cor no formato #RRGGBB.' : avaliacao.bloqueia ? 'Escolha uma cor que segure texto branco.' : !diasValidos ? 'O ciclo de atualização vai de 1 a 365 dias.' : undefined} />
        </View>
      ) : null}
      <PainelConfirmacao
        visivel={confirmarRemocao}
        titulo="Remover a logo?"
        mensagem="O nome da consultoria volta a aparecer no lugar da logo."
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={tirarLogo}
        aoCancelar={() => setConfirmarRemocao(false)}
      />
    </>
  );
}

/** Os códigos na ordem do `PALETAS` do tema: escuras primeiro, depois as claras. */
const CODIGOS_DAS_PALETAS = Object.keys(PALETAS_DO_TEMA) as Tema[];

/** Miniatura do app numa paleta: fundo, faixa do título, um cartão com uma linha de texto e o botão na cor da marca. */
function MiniaturaDoTema({ cores, marca }: { cores: Cores; marca: string }) {
  return (
    <View style={[estilos.miniatura, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
      <View style={[estilos.miniaturaFaixa, { backgroundColor: cores.superficie3 }]} />
      <View style={[estilos.miniaturaCartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View style={[estilos.miniaturaLinha, { backgroundColor: cores.texto }]} />
        <View style={[estilos.miniaturaBotao, { backgroundColor: marca }]} />
      </View>
    </View>
  );
}

/** Topo do app do aluno com as cores fixas da paleta escolhida (independe do tema de quem está editando). */
function Previa({ marca, tema }: { marca: Marca; tema: Tema }) {
  const { cores: atuais } = useTema();
  const { nome, cores } = paletaDe(tema);
  return (
    <View style={estilos.previa}>
      <Texto variante="suave">{`Paleta ${nome}`}</Texto>
      <View testID="previa-da-paleta" style={[estilos.telaPrevia, { backgroundColor: cores.fundo, borderColor: atuais.borda }]}>
        <View style={[estilos.faixaPrevia, { backgroundColor: cores.superficie3 }]}>
          <MarcaTitulo marca={marca} fundo={cores.superficie3} />
        </View>
        <View style={[estilos.cartaoPrevia, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Texto style={[estilos.tituloPrevia, { color: cores.texto }]}>Treino de hoje</Texto>
          <Texto style={{ color: cores.textoSuave }}>Segunda - Costas</Texto>
          <View style={[estilos.botaoPrevia, { backgroundColor: marca.corPrimaria }]}>
            <Texto style={[estilos.tituloPrevia, { color: textoSobre(marca.corPrimaria) }]}>Começar</Texto>
          </View>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campoDias: { maxWidth: 280 },
  paletas: { gap: espaco(1.5) },
  meta: { gap: espaco(0.5) },
  previas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  previa: { flex: 1, minWidth: 240, maxWidth: 480, gap: espaco(0.5) },
  telaPrevia: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  faixaPrevia: { borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1) },
  cartaoPrevia: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  tituloPrevia: { fontFamily: fontes.semi },
  botaoPrevia: { borderRadius: RAIO, paddingVertical: espaco(1), alignItems: 'center', marginTop: espaco(0.5) },
  campoCor: { maxWidth: 240 },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  textoRodape: { flexShrink: 1 },
  logo: { gap: espaco(0.75) },
  amostra: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  miniatura: { width: 40, height: 40, borderWidth: 1, borderRadius: RAIO, padding: 4, gap: 3 },
  miniaturaFaixa: { height: 7, borderRadius: 2 },
  miniaturaCartao: { flex: 1, borderWidth: 1, borderRadius: 3, padding: 3, justifyContent: 'space-between' },
  miniaturaLinha: { height: 2, width: '70%', borderRadius: 1 },
  miniaturaBotao: { height: 5, borderRadius: 2 },
  botoesEsquerda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
