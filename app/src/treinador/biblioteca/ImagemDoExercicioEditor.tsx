import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { enviarImagemDoExercicio, removerImagemDoExercicio } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { TEXTOS_IMAGEM_EXERCICIO } from '../../dominio/demonstracaoExercicio';
import { dataHoraParaTela } from '../../dominio/formatos';
import { FotoRecusada } from '../../aluno/atualizacao/fotos/prepararFoto';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import {
  anexarImagemDoExercicio, descartarImagemEscolhida, escolherImagemDoExercicio, imagemDoArquivoSolto, type ImagemDoExercicioEscolhida,
} from './imagemDoExercicio';

interface Props {
  exercicio: Exercicio;
  /** `BIBLIOTECA_ALTERAR`: sem ela só mostra. */
  podeAlterar: boolean;
  /** A API devolve o exercício já com a nova data da imagem. */
  aoMudar: (exercicio: Exercicio) => void;
}

/** Altura máxima da prévia: empilhada na folha estreita, a imagem 4:3 na largura toda ocuparia quase a tela. */
const ALTURA_MAXIMA_DA_PREVIA = 360;

/**
 * "Imagem ou GIF" na folha do exercício da biblioteca. Três estados: sem imagem nenhuma, uma área tracejada que se toca (e,
 * na web, onde se solta o arquivo) com "Escolher imagem ou GIF" e a dica; com as fotos do catálogo, a prévia delas e
 * "Escolher imagem ou GIF"; com imagem própria, a prévia na largura do campo (inteira, `contain`), a data do envio e
 * "Trocar" e "Remover imagem" (com confirmação). O nome e o tamanho do arquivo não aparecem: o envio usa um nome fixo (o
 * original não sai do aparelho) e a API só guarda a data. Na web, soltar o arquivo vale nos três estados.
 */
export function ImagemDoExercicioEditor({ exercicio, podeAlterar, aoMudar }: Props) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [largura, setLargura] = useState<number | null>(null);
  const temPropria = exercicio.imagemPropriaEm !== null;
  const temCatalogo = exercicio.imagens.length > 0;

  const enviar = async (obter: () => Promise<ImagemDoExercicioEscolhida | null>) => {
    if (enviando) return;
    let escolhida: ImagemDoExercicioEscolhida | null = null;
    setEnviando(true);
    try {
      escolhida = await obter();
      if (!escolhida) return;
      const dados = new FormData();
      await anexarImagemDoExercicio(dados, escolhida);
      aoMudar(await enviarImagemDoExercicio(exercicio.id, dados));
      avisar('Imagem salva.', 'sucesso');
    } catch (erro) {
      avisar(erro instanceof FotoRecusada ? erro.message : textoDoErro(erro), 'perigo');
    } finally {
      await descartarImagemEscolhida(escolhida);
      setEnviando(false);
    }
  };
  const escolher = () => void enviar(escolherImagemDoExercicio);
  const { alvo, arrastando } = useSoltarArquivo(podeAlterar && !enviando, temPropria || temCatalogo ? 'previa' : 'area', (arquivo) => void enviar(() => imagemDoArquivoSolto(arquivo)));

  const remover = () => {
    setRemovendo(true);
    removerImagemDoExercicio(exercicio.id).then(
      (atualizado) => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        aoMudar(atualizado);
        avisar('Imagem removida.', 'sucesso');
      },
      (erro: unknown) => {
        setRemovendo(false);
        setConfirmarRemocao(false);
        avisar(textoDoErro(erro), 'perigo');
      },
    );
  };

  const destaqueDoArraste = arrastando ? { borderColor: cores.texto, backgroundColor: cores.sobre } : null;
  const dica = podeAlterar ? (
    <Texto variante="pequeno">{Platform.OS === 'web' ? `${TEXTOS_IMAGEM_EXERCICIO.dica} ${TEXTOS_IMAGEM_EXERCICIO.soltar}` : TEXTOS_IMAGEM_EXERCICIO.dica}</Texto>
  ) : null;

  let corpo;
  if (temPropria || temCatalogo) {
    const alturaDaPrevia = largura ? Math.round(Math.min(largura * 0.75, ALTURA_MAXIMA_DA_PREVIA)) : 0;
    corpo = (
      <>
        <View ref={alvo} onLayout={(e) => setLargura(Math.floor(e.nativeEvent.layout.width))}
          style={[estilos.previa, { minHeight: alturaDaPrevia || 180 }, destaqueDoArraste && [estilos.previaArrastando, destaqueDoArraste]]}>
          {largura ? (
            <DemonstracaoDoExercicio exercicioId={exercicio.id} nome={exercicio.nome} imagens={exercicio.imagens}
              imagemPropriaEm={exercicio.imagemPropriaEm} papel="EQUIPE" largura={largura} altura={alturaDaPrevia} />
          ) : null}
        </View>
        <Texto variante="suave">
          {temPropria ? `Imagem própria, enviada em ${dataHoraParaTela(exercicio.imagemPropriaEm)}` : TEXTOS_IMAGEM_EXERCICIO.catalogo}
        </Texto>
        {podeAlterar ? (
          <LinhaDeAcoes>
            {temPropria ? (
              <>
                <Botao rotulo={TEXTOS_IMAGEM_EXERCICIO.trocar} rotuloAcessivel={TEXTOS_IMAGEM_EXERCICIO.trocarPorExtenso} tipo="secundario" Icone={ImagePlus}
                  carregando={enviando} aoTocar={escolher} />
                <Botao rotulo={TEXTOS_IMAGEM_EXERCICIO.remover} tipo="perigo" Icone={Trash2} desabilitado={enviando}
                  motivo={enviando ? 'Aguarde o envio terminar.' : undefined} aoTocar={() => setConfirmarRemocao(true)} />
              </>
            ) : (
              <Botao rotulo={TEXTOS_IMAGEM_EXERCICIO.enviar} tipo="acao" Icone={ImagePlus} carregando={enviando} aoTocar={escolher} />
            )}
          </LinhaDeAcoes>
        ) : null}
        {dica}
      </>
    );
  } else if (podeAlterar) {
    // A área toda escolhe o arquivo com o mouse ou o toque; o teclado e o leitor de tela usam o botão de dentro (um alvo só
    // no leitor, sem botão dentro de botão).
    corpo = (
      <Pressable ref={alvo} accessible={false} focusable={false} onPress={escolher} disabled={enviando}
        style={(e) => [estilos.area, { borderColor: cores.bordaCampo, backgroundColor: sobre(e) ? cores.sobre : cores.superficie2 }, destaqueDoArraste]}>
        <Botao rotulo={TEXTOS_IMAGEM_EXERCICIO.enviar} tipo="acao" Icone={ImagePlus} carregando={enviando} aoTocar={escolher} style={estilos.centro} />
        <View style={estilos.dicaNaArea}>{dica}</View>
      </Pressable>
    );
  } else {
    corpo = <Texto variante="suave">Sem imagem.</Texto>;
  }

  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo" cor={cores.texto}>{TEXTOS_IMAGEM_EXERCICIO.titulo}</Texto>
      {corpo}
      <PainelConfirmacao
        visivel={confirmarRemocao}
        titulo="Remover a imagem?"
        mensagem={TEXTOS_IMAGEM_EXERCICIO.confirmarRemocao}
        rotuloConfirmar="Remover"
        perigo
        carregando={removendo}
        aoConfirmar={remover}
        aoCancelar={() => setConfirmarRemocao(false)}
      />
    </View>
  );
}

/**
 * Soltar um arquivo na área (só na web: o nó do react-native-web é o próprio elemento). Fora da web, ou desligado, não liga
 * nada. `arrastando` acende a área enquanto um arquivo passa por cima dela. `forma` muda quando o nó muda (a área vazia
 * vira a prévia), para religar os eventos no nó novo.
 */
function useSoltarArquivo(ligado: boolean, forma: string, aoSoltar: (arquivo: File) => void) {
  const alvo = useRef<View>(null);
  const [arrastando, setArrastando] = useState(false);
  const soltar = useRef(aoSoltar);
  useEffect(() => { soltar.current = aoSoltar; });
  useEffect(() => {
    const el: unknown = alvo.current;
    if (!ligado || typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) return;
    const temArquivo = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const sobreA = (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setArrastando(true);
    };
    const saiu = (e: DragEvent) => {
      if (!(e.relatedTarget instanceof Node) || !el.contains(e.relatedTarget)) setArrastando(false);
    };
    const solto = (e: DragEvent) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      setArrastando(false);
      const arquivo = e.dataTransfer?.files[0];
      if (arquivo) soltar.current(arquivo);
    };
    el.addEventListener('dragenter', sobreA);
    el.addEventListener('dragover', sobreA);
    el.addEventListener('dragleave', saiu);
    el.addEventListener('drop', solto);
    return () => {
      el.removeEventListener('dragenter', sobreA);
      el.removeEventListener('dragover', sobreA);
      el.removeEventListener('dragleave', saiu);
      el.removeEventListener('drop', solto);
      setArrastando(false);
    };
  }, [ligado, forma]);
  return { alvo, arrastando };
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  previa: { alignSelf: 'stretch', borderRadius: RAIO },
  centro: { alignSelf: 'center' },
  dicaNaArea: { alignItems: 'center' },
  previaArrastando: { borderWidth: 2, borderStyle: 'dashed' },
  area: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: espaco(1), minHeight: 160,
    paddingVertical: espaco(3), paddingHorizontal: espaco(2), borderWidth: 2, borderStyle: 'dashed', borderRadius: RAIO,
  },
});
