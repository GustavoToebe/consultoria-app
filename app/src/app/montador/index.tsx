import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  alterarProp,
  buscarBloco,
  duplicar,
  inserirDaPaleta,
  lerJson,
  montadorLiberado,
  mover,
  nomeDoArquivoJson,
  paraJson,
  remover,
  type Largura,
  type Rascunho,
  type TemaDoMontador,
  type TipoDeBloco,
} from '../../dominio/montador';
import type { Preferencias } from '../../dominio/preferencias';
import { criarRascunhoDeModelo, MODELOS_INICIAIS, type ChaveModeloInicial } from '../../montador/modelosIniciais';
import { Paleta } from '../../montador/Paleta';
import { Prancheta } from '../../montador/Prancheta';
import { Propriedades } from '../../montador/Propriedades';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_EXPANDIDO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Alerta } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import NaoEncontrada from '../+not-found';

const CHAVE_STORAGE = 'montador:rascunho';

type AbaCelular = 'blocos' | 'tela' | 'propriedades';

function lerRascunhoSalvo(): Rascunho {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const salvo = window.localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const res = lerJson(salvo);
        if (res.ok) return res.rascunho;
      }
    } catch {
      // falha silenciosa
    }
  }
  return criarRascunhoDeModelo('emBranco');
}

function temaParaPreferencia(tema: TemaDoMontador): 'CLARO' | 'AREIA' | 'ESCURO' {
  if (tema === 'areia') return 'AREIA';
  if (tema === 'escuro') return 'ESCURO';
  return 'CLARO';
}

export default function TelaMontador() {
  if (!montadorLiberado()) {
    return <NaoEncontrada />;
  }
  return <MontadorConteudo />;
}

function MontadorConteudo() {
  const { cores, preferencias, preferenciasLidas, escolherPreferencia } = useTema();
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_MENU_EXPANDIDO;

  const [rascunho, setRascunho] = useState<Rascunho>(lerRascunhoSalvo);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [forcarAbaixo, setForcarAbaixo] = useState(false);
  const [aba, setAba] = useState<AbaCelular>('tela');

  // Folhas e confirmações
  const [folhaModelos, setFolhaModelos] = useState(false);
  const [folhaImportar, setFolhaImportar] = useState(false);
  const [folhaExportar, setFolhaExportar] = useState(false);
  const [textoImportar, setTextoImportar] = useState('');
  const [erroImportar, setErroImportar] = useState<string | null>(null);
  const [idParaRemover, setIdParaRemover] = useState<string | null>(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

  const blocoSelecionado = selecionadoId ? buscarBloco(rascunho.blocos, selecionadoId) : null;

  // Guarda o tema que estava em uso ao abrir o Montador e o restaura ao desmontar a tela.
  const temaAnteriorRef = useRef<Preferencias['tema'] | null>(null);
  const escolherPreferenciaRef = useRef(escolherPreferencia);
  useEffect(() => {
    escolherPreferenciaRef.current = escolherPreferencia;
  }, [escolherPreferencia]);

  useEffect(() => {
    if (!preferenciasLidas) {
      temaAnteriorRef.current = null;
      return;
    }
    if (temaAnteriorRef.current === null) {
      temaAnteriorRef.current = preferencias.tema;
    }
    escolherPreferencia({ tema: temaParaPreferencia(rascunho.tema) });
  }, [preferenciasLidas, preferencias.tema, rascunho.tema, escolherPreferencia]);

  useEffect(() => {
    return () => {
      if (temaAnteriorRef.current !== null) {
        escolherPreferenciaRef.current({ tema: temaAnteriorRef.current });
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CHAVE_STORAGE, paraJson(rascunho));
    } catch {
      // falha silenciosa
    }
  }, [rascunho]);

  const mudarLargura = (largura: Largura) => {
    setRascunho((atual) => ({ ...atual, largura }));
  };

  const mudarTema = (tema: TemaDoMontador) => {
    setRascunho((atual) => ({ ...atual, tema }));
  };

  const aoInserirDaPaleta = (tipo: TipoDeBloco) => {
    const res = inserirDaPaleta(rascunho, tipo, selecionadoId, forcarAbaixo);
    setRascunho(res.rascunho);
    if (res.novoId) {
      setSelecionadoId(res.novoId);
    }
    setForcarAbaixo(false);
    if (!largo) {
      setAba('tela');
    }
  };

  const aoMover = (id: string, direcao: 'cima' | 'baixo') => {
    setRascunho((atual) => mover(atual, id, direcao));
  };

  const aoDuplicar = (id: string) => {
    setRascunho((atual) => duplicar(atual, id));
  };

  const aoInserirAbaixo = (id: string) => {
    setSelecionadoId(id);
    setForcarAbaixo(true);
    if (!largo) {
      setAba('blocos');
    }
  };

  const confirmarRemocao = () => {
    if (!idParaRemover) return;
    const alvo = idParaRemover;
    setRascunho((atual) => remover(atual, alvo));
    if (selecionadoId === alvo) setSelecionadoId(null);
    setIdParaRemover(null);
  };

  const limparTudo = () => {
    setRascunho((atual) => ({ ...atual, blocos: [] }));
    setSelecionadoId(null);
    setForcarAbaixo(false);
    setConfirmarLimpar(false);
  };

  const aplicarModelo = (chave: ChaveModeloInicial) => {
    const novo = criarRascunhoDeModelo(chave, rascunho.largura, rascunho.tema);
    setRascunho(novo);
    setSelecionadoId(novo.blocos[0]?.id ?? null);
    setForcarAbaixo(false);
    setFolhaModelos(false);
  };

  const confirmarImportacao = () => {
    const res = lerJson(textoImportar);
    if (!res.ok) {
      setErroImportar(res.erro);
      return;
    }
    setRascunho(res.rascunho);
    setSelecionadoId(res.rascunho.blocos[0]?.id ?? null);
    setForcarAbaixo(false);
    setErroImportar(null);
    setTextoImportar('');
    setFolhaImportar(false);
    avisar('Rascunho importado.', 'sucesso');
  };

  const copiarJson = async () => {
    const texto = paraJson(rascunho);
    try {
      await Clipboard.setStringAsync(texto);
    } catch {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
      }
    }
    setFolhaExportar(false);
    avisar('Copiado', 'sucesso');
  };

  const baixarJson = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const texto = paraJson(rascunho);
    const blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeDoArquivoJson(rascunho.nome);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFolhaExportar(false);
    avisar('Arquivo JSON baixado.', 'sucesso');
  };

  const barraSuperior = (
    <View style={[estilos.barra, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.tituloBarra}>
        <Texto variante="titulo" nivel={1}>
          Montador de telas
        </Texto>
        <Texto variante="pequeno">{rascunho.nome}</Texto>
      </View>

      <View style={estilos.controlesBarra}>
        <Escolha<Largura>
          compacta
          descricao="Largura da prancheta"
          valor={rascunho.largura}
          aoMudar={mudarLargura}
          opcoes={[
            { valor: 390, rotulo: 'Celular 390' },
            { valor: 1280, rotulo: 'PC 1280' },
          ]}
        />
        <Escolha<TemaDoMontador>
          compacta
          descricao="Tema do montador"
          valor={rascunho.tema}
          aoMudar={mudarTema}
          opcoes={[
            { valor: 'claro', rotulo: 'Claro' },
            { valor: 'areia', rotulo: 'Areia' },
            { valor: 'escuro', rotulo: 'Escuro' },
          ]}
        />
        <LinhaDeAcoes>
          <Botao rotulo="Modelos ▾" tipo="secundario" aoTocar={() => setFolhaModelos(true)} />
          <Botao
            rotulo="Limpar tudo"
            tipo="perigoTexto"
            desabilitado={rascunho.blocos.length === 0}
            motivo="A prancheta já está vazia"
            aoTocar={() => setConfirmarLimpar(true)}
          />
          <Botao rotulo="Exportar ▾" tipo="primario" aoTocar={() => setFolhaExportar(true)} />
        </LinhaDeAcoes>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[estilos.raiz, { backgroundColor: cores.fundo }]}>
      {barraSuperior}

      {largo ? (
        <View style={estilos.colunas}>
          <View style={[estilos.colunaEsquerda, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
            <Paleta
              selecionado={blocoSelecionado}
              forcarAbaixo={forcarAbaixo}
              aoInserir={aoInserirDaPaleta}
            />
          </View>
          <View style={estilos.colunaCentral}>
            <Prancheta
              rascunho={rascunho}
              selecionadoId={selecionadoId}
              aoSelecionar={(id) => {
                setSelecionadoId(id);
                setForcarAbaixo(false);
              }}
              aoMover={aoMover}
              aoDuplicar={aoDuplicar}
              aoInserirAbaixo={aoInserirAbaixo}
              aoPedirRemover={setIdParaRemover}
            />
          </View>
          <View style={[estilos.colunaDireita, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
            <Propriedades
              bloco={blocoSelecionado}
              nomeRascunho={rascunho.nome}
              observacoesRascunho={rascunho.observacoes ?? ''}
              aoMudarNome={(nome) => setRascunho((a) => ({ ...a, nome }))}
              aoMudarObservacoes={(obs) =>
                setRascunho((a) => ({ ...a, observacoes: obs ? obs : undefined }))
              }
              aoAlterarProp={(id, chave, valor) => setRascunho((a) => alterarProp(a, id, chave, valor))}
            />
          </View>
        </View>
      ) : (
        <View style={estilos.areaCelular}>
          <View style={estilos.abasCelular}>
            <Abas<AbaCelular>
              ativa={aba}
              aoMudar={setAba}
              abas={[
                { valor: 'blocos', rotulo: 'Blocos' },
                { valor: 'tela', rotulo: 'Tela', contagem: rascunho.blocos.length },
                { valor: 'propriedades', rotulo: 'Propriedades' },
              ]}
            />
          </View>
          <View style={estilos.mioloCelular}>
            {aba === 'blocos' ? (
              <Paleta
                selecionado={blocoSelecionado}
                forcarAbaixo={forcarAbaixo}
                aoInserir={aoInserirDaPaleta}
              />
            ) : aba === 'tela' ? (
              <Prancheta
                rascunho={rascunho}
                selecionadoId={selecionadoId}
                aoSelecionar={(id) => {
                  setSelecionadoId(id);
                  setForcarAbaixo(false);
                }}
                aoMover={aoMover}
                aoDuplicar={aoDuplicar}
                aoInserirAbaixo={aoInserirAbaixo}
                aoPedirRemover={setIdParaRemover}
              />
            ) : (
              <Propriedades
                bloco={blocoSelecionado}
                nomeRascunho={rascunho.nome}
                observacoesRascunho={rascunho.observacoes ?? ''}
                aoMudarNome={(nome) => setRascunho((a) => ({ ...a, nome }))}
                aoMudarObservacoes={(obs) =>
                  setRascunho((a) => ({ ...a, observacoes: obs ? obs : undefined }))
                }
                aoAlterarProp={(id, chave, valor) => setRascunho((a) => alterarProp(a, id, chave, valor))}
              />
            )}
          </View>
        </View>
      )}

      <Folha visivel={folhaModelos} titulo="Modelos" aoFechar={() => setFolhaModelos(false)}>
        {MODELOS_INICIAIS.map((m) => (
          <ItemDeLista
            key={m.chave}
            titulo={m.rotulo}
            detalhe={m.detalhe}
            aoTocar={() => aplicarModelo(m.chave)}
          />
        ))}
        <ItemDeLista
          titulo="Importar JSON"
          detalhe="Cole um rascunho exportado anteriormente"
          aoTocar={() => {
            setFolhaModelos(false);
            setErroImportar(null);
            setTextoImportar('');
            setFolhaImportar(true);
          }}
        />
      </Folha>

      <Folha
        visivel={folhaImportar}
        titulo="Importar JSON"
        aoFechar={() => setFolhaImportar(false)}
        rodape={
          <LinhaDeAcoes alinhar="fim">
            <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => setFolhaImportar(false)} />
            <Botao rotulo="Importar rascunho" tipo="primario" aoTocar={confirmarImportacao} />
          </LinhaDeAcoes>
        }
      >
        {erroImportar ? <Alerta tom="perigo" texto={erroImportar} /> : null}
        <Campo
          rotulo="JSON do rascunho"
          valor={textoImportar}
          aoMudar={(t) => {
            setTextoImportar(t);
            if (erroImportar) setErroImportar(null);
          }}
          linhas={8}
          placeholder='{"versao": 1, ...}'
          autoCorrect={false}
        />
      </Folha>

      <Folha visivel={folhaExportar} titulo="Exportar rascunho" aoFechar={() => setFolhaExportar(false)}>
        <ItemDeLista
          titulo="Copiar JSON"
          detalhe="Copia o rascunho para a área de transferência"
          aoTocar={() => void copiarJson()}
        />
        {Platform.OS === 'web' ? (
          <ItemDeLista
            titulo="Baixar .json"
            detalhe={nomeDoArquivoJson(rascunho.nome)}
            aoTocar={baixarJson}
          />
        ) : null}
        <Alerta
          tom="atencao"
          titulo="Print da tela"
          texto="Use o print do sistema ou do navegador sobre a prancheta para enviar junto com o JSON ao Claude."
        />
      </Folha>

      <PainelConfirmacao
        visivel={idParaRemover !== null}
        titulo="Remover bloco?"
        mensagem="O bloco selecionado (e os blocos dentro dele, se houver) será removido do rascunho."
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={confirmarRemocao}
        aoCancelar={() => setIdParaRemover(null)}
      />

      <PainelConfirmacao
        visivel={confirmarLimpar}
        titulo="Limpar tudo?"
        mensagem="Todos os blocos da prancheta serão apagados deste rascunho."
        rotuloConfirmar="Limpar tudo"
        perigo
        aoConfirmar={limparTudo}
        aoCancelar={() => setConfirmarLimpar(false)}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espaco(1.5),
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(1.5),
    borderBottomWidth: 1,
  },
  tituloBarra: {
    gap: 2,
    flexShrink: 1,
    maxWidth: '100%',
  },
  controlesBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: espaco(1),
    flexShrink: 1,
    maxWidth: '100%',
  },
  colunas: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
  },
  colunaEsquerda: {
    width: 280,
    borderRightWidth: 1,
    padding: espaco(2),
  },
  colunaCentral: {
    flex: 1,
    minWidth: 0,
    padding: espaco(2),
  },
  colunaDireita: {
    width: 340,
    borderLeftWidth: 1,
    padding: espaco(2),
  },
  areaCelular: {
    flex: 1,
    minHeight: 0,
  },
  abasCelular: {
    paddingHorizontal: espaco(2),
  },
  mioloCelular: {
    flex: 1,
    minHeight: 0,
    padding: espaco(2),
  },
});
