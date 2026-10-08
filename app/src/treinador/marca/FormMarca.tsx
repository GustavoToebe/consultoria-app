import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarMarca, consultoria as buscarConsultoria, enviarLogo, removerLogo } from '../../api/rotas';
import type { ConsultoriaResponse, Fonte, Marca, Tema } from '../../api/tipos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { CLARO, ESCURO, espaco, fontes, RAIO, textoSobre, type Cores } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { MarcaTitulo } from '../../ui/MarcaTitulo';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const CORES_SUGERIDAS = ['#B91C1C', '#C2410C', '#B45309', '#15803D', '#0F766E', '#1D4ED8', '#6D28D9', '#BE185D'];
const LOGO_MAXIMO = 512 * 1024;
const HEX = /^#[0-9A-Fa-f]{6}$/;

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/** Nome, lema, cor, fonte do título, tema padrão e logo, com prévia do topo do app do aluno nos dois temas. */
export function FormMarca({ consultoria, aoSalvar, aoConflito }: Props) {
  const { atualizarMarca } = useSessao();
  const { avisar } = useAviso();
  const inicial = consultoria.marca;
  const [nome, setNome] = useState(inicial.nome);
  const [lema, setLema] = useState(inicial.lema ?? '');
  const [cor, setCor] = useState(inicial.corPrimaria);
  const [fonte, setFonte] = useState<Fonte>(inicial.fonteTitulo);
  const [tema, setTema] = useState<Tema>(inicial.temaPadrao);
  const [logoUrl, setLogoUrl] = useState(inicial.logoUrl);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const corValida = HEX.test(cor);
  const previa: Marca = { ...inicial, nome: nome || inicial.nome, lema: lema || null, corPrimaria: corValida ? cor : inicial.corPrimaria, fonteTitulo: fonte, temaPadrao: tema, logoUrl };

  const salvar = () => {
    setSalvando(true);
    setErro(null);
    alterarMarca({ nome: nome.trim(), lema: lema.trim() || null, corPrimaria: cor, fonteTitulo: fonte, temaPadrao: tema, versao: consultoria.versao }).then(
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

  return (
    <>
      <Cartao titulo="Prévia do app do aluno">
        <View style={estilos.previas}>
          <Previa marca={previa} cores={ESCURO} rotulo="Tema escuro" />
          <Previa marca={previa} cores={CLARO} rotulo="Tema claro" />
        </View>
      </Cartao>
      <Cartao titulo="Marca">
        <Campo rotulo="Nome da consultoria" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={120} />
        <Campo rotulo="Lema (opcional)" valor={lema} aoMudar={setLema} erro={campos.lema} maxLength={160} />
        <View style={estilos.cor}>
          <View style={estilos.campoCor}>
            <Campo
              rotulo="Cor principal"
              valor={cor}
              aoMudar={(t) => setCor(t.startsWith('#') ? t.toUpperCase() : `#${t.toUpperCase()}`)}
              erro={campos.corPrimaria ?? (corValida ? null : 'Use o formato #RRGGBB.')}
              autoCapitalize="characters"
              maxLength={7}
            />
          </View>
          <View style={estilos.amostras} accessibilityRole="radiogroup" accessibilityLabel="Cores sugeridas">
            {CORES_SUGERIDAS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityLabel={`Cor ${c}`}
                accessibilityState={{ checked: c === cor }}
                onPress={() => setCor(c)}
                style={[estilos.amostra, { backgroundColor: c, borderWidth: c === cor ? 3 : 0, borderColor: textoSobre(c) }]}
              />
            ))}
          </View>
        </View>
        <Escolha
          rotulo="Fonte do nome"
          opcoes={[
            { valor: 'PADRAO', rotulo: 'Padrão' },
            { valor: 'METAL', rotulo: 'Metal' },
          ]}
          valor={fonte}
          aoMudar={setFonte}
        />
        <Escolha
          rotulo="Tema padrão dos alunos"
          opcoes={[
            { valor: 'ESCURO', rotulo: 'Escuro' },
            { valor: 'CLARO', rotulo: 'Claro' },
          ]}
          valor={tema}
          aoMudar={setTema}
        />
        <Texto variante="pequeno">Cada pessoa ainda pode trocar o tema na própria conta.</Texto>
        {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
        <View style={estilos.botoes}>
          <Botao rotulo="Salvar marca" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || !corValida} />
        </View>
      </Cartao>
      <Cartao titulo="Logo">
        <Texto cor="suave">PNG ou JPEG de até 512 KB. Com logo, ela aparece no lugar do nome.</Texto>
        <View style={estilos.botoesEsquerda}>
          <Botao rotulo={logoUrl ? 'Trocar logo' : 'Enviar logo'} tipo="secundario" Icone={ImagePlus} carregando={enviando} aoTocar={() => void escolherLogo()} />
          {logoUrl ? <Botao rotulo="Remover logo" tipo="fantasma" Icone={Trash2} aoTocar={() => setConfirmarRemocao(true)} /> : null}
        </View>
      </Cartao>
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

/** Topo do app do aluno com as cores fixas de um tema (independe do tema de quem está editando). */
function Previa({ marca, cores, rotulo }: { marca: Marca; cores: Cores; rotulo: string }) {
  const { cores: atuais } = useTema();
  return (
    <View style={estilos.previa}>
      <Texto variante="pequeno">{rotulo}</Texto>
      <View style={[estilos.telaPrevia, { backgroundColor: cores.fundo, borderColor: atuais.borda }]}>
        <MarcaTitulo marca={marca} />
        {marca.lema ? <Texto style={{ color: cores.textoSuave }}>{marca.lema}</Texto> : null}
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
  cor: { gap: espaco(1) },
  campoCor: { maxWidth: 200 },
  amostras: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  amostra: { width: 36, height: 36, borderRadius: RAIO },
  botoes: { flexDirection: 'row', justifyContent: 'flex-end' },
  botoesEsquerda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
