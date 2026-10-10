import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarMarca, consultoria as buscarConsultoria, enviarLogo, removerLogo } from '../../api/rotas';
import type { ConsultoriaResponse, Fonte, Marca, Tema } from '../../api/tipos';
import { avaliarMarca, paletaDaCor, PALETAS } from '../../dominio/paletas';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { CLARO, ESCURO, espaco, fontes, RAIO, textoSobre, type Cores } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { GradeDeOpcoes } from '../../ui/GradeDeOpcoes';
import { FAMILIAS, MarcaTitulo } from '../../ui/MarcaTitulo';
import { OpcaoCartao } from '../../ui/OpcaoCartao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const LOGO_MAXIMO = 512 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/** Nome, cor, fonte do título, tema padrão e logo, com prévia do topo do app do aluno nos dois temas. */
export function FormMarca({ consultoria, aoSalvar, aoConflito }: Props) {
  const { atualizarMarca } = useSessao();
  const { avisar } = useAviso();
  const inicial = consultoria.marca;
  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.corPrimaria);
  // Cor que não é de nenhuma paleta (ou escolhida como tal) mostra o campo #RRGGBB.
  const [personalizada, setPersonalizada] = useState(!paletaDaCor(inicial.corPrimaria));
  const [fonte, setFonte] = useState<Fonte>(inicial.fonteTitulo);
  const [tema, setTema] = useState<Tema>(inicial.temaPadrao);
  const [logoUrl, setLogoUrl] = useState(inicial.logoUrl);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const corValida = HEX.test(cor);
  const avaliacao = avaliarMarca(cor);
  const previa: Marca = { ...inicial, nome: nome || inicial.nome, lema: null, corPrimaria: corValida ? cor : inicial.corPrimaria, fonteTitulo: fonte, temaPadrao: tema, logoUrl };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    alterarMarca({ nome: nome.trim(), lema: null, corPrimaria: cor, fonteTitulo: fonte, temaPadrao: tema, versao: consultoria.versao }).then(
      (c) => {
        setSalvando(false);
        aoSalvar(c);
        atualizarMarca(c.marca);
        avisar('Marca salva. Os alunos veem a nova marca ao abrir o app.', 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
          avisar('A marca foi alterada em outra aba. Recarregamos a versão atual.', 'perigo');
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
    if (Platform.OS === 'web' && a.file) {
      dados.append('arquivo', a.file);
    } else {
      // React Native aceita {uri, name, type} no FormData.
      dados.append('arquivo', { uri: a.uri, name: a.fileName ?? (tipo === 'image/png' ? 'logo.png' : 'logo.jpg'), type: tipo } as unknown as Blob);
    }
    setEnviando(true);
    try {
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
          <Previa marca={previa} cores={ESCURO} rotulo="Tema escuro" />
          <Previa marca={previa} cores={CLARO} rotulo="Tema claro" />
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
                  <Texto style={[estilos.inicial, { color: '#FFFFFF' }]}>{p.nome.charAt(0)}</Texto>
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
              <View style={[estilos.amostra, { backgroundColor: corValida ? cor : '#52525B' }]}>
                <Texto style={[estilos.inicial, { color: '#FFFFFF' }]}>#</Texto>
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
        {!avaliacao.bloqueia && avaliacao.aviso ? <Texto variante="suave">{avaliacao.aviso}</Texto> : null}
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
      <Cartao titulo="Tema padrão dos alunos" descricao="Cada pessoa ainda pode trocar o tema na própria conta.">
        <GradeDeOpcoes rotulo="Tema padrão dos alunos">
          {(['ESCURO', 'CLARO'] as const).map((t) => (
            <OpcaoCartao
              key={t}
              titulo={t === 'ESCURO' ? 'Escuro' : 'Claro'}
              descricao={t === 'ESCURO' ? 'Fundo preto, bom à noite e na academia' : 'Fundo claro, bom ao ar livre'}
              selecionada={tema === t}
              aoEscolher={() => setTema(t)}
              amostra={<MiniaturaDoTema cores={t === 'ESCURO' ? ESCURO : CLARO} marca={corValida ? cor : inicial.corPrimaria} />}
            />
          ))}
        </GradeDeOpcoes>
      </Cartao>
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      <View style={estilos.rodape}>
        <Botao rotulo="Salvar marca" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !corValida || !!avaliacao.bloqueia} />
      </View>
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

/** Miniatura do app num tema: fundo, um cartão e uma barra na cor da marca. */
function MiniaturaDoTema({ cores, marca }: { cores: Cores; marca: string }) {
  return (
    <View style={[estilos.miniatura, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
      <View style={[estilos.miniaturaBarra, { backgroundColor: marca }]} />
      <View style={[estilos.miniaturaCartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]} />
    </View>
  );
}

/** Topo do app do aluno com as cores fixas de um tema (independe do tema de quem está editando). */
function Previa({ marca, cores, rotulo }: { marca: Marca; cores: Cores; rotulo: string }) {
  const { cores: atuais } = useTema();
  return (
    <View style={estilos.previa}>
      <Texto variante="pequeno">{rotulo}</Texto>
      <View style={[estilos.telaPrevia, { backgroundColor: cores.fundo, borderColor: atuais.borda }]}>
        <MarcaTitulo marca={marca} />
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
  previas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  previa: { flex: 1, minWidth: 240, gap: espaco(0.5) },
  telaPrevia: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1) },
  cartaoPrevia: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  tituloPrevia: { fontFamily: fontes.semi },
  botaoPrevia: { borderRadius: RAIO, paddingVertical: espaco(1), alignItems: 'center', marginTop: espaco(0.5) },
  campoCor: { maxWidth: 240 },
  rodape: { flexDirection: 'row', justifyContent: 'flex-end' },
  logo: { gap: espaco(0.75) },
  amostra: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontFamily: fontes.negrito, fontSize: 18 },
  miniatura: { width: 40, height: 40, borderWidth: 1, borderRadius: RAIO, padding: 5, gap: 4 },
  miniaturaBarra: { height: 6, width: 18, borderRadius: 3 },
  miniaturaCartao: { flex: 1, borderWidth: 1, borderRadius: 4 },
  botoesEsquerda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
