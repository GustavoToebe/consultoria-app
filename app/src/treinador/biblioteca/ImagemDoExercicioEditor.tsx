import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { enviarImagemDoExercicio, removerImagemDoExercicio } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { TEXTOS_IMAGEM_EXERCICIO } from '../../dominio/demonstracaoExercicio';
import { FotoRecusada } from '../../aluno/atualizacao/fotos/prepararFoto';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { anexarImagemDoExercicio, descartarImagemEscolhida, escolherImagemDoExercicio, type ImagemDoExercicioEscolhida } from './imagemDoExercicio';

interface Props {
  exercicio: Exercicio;
  /** `BIBLIOTECA_ALTERAR`: sem ela só mostra. */
  podeAlterar: boolean;
  /** A API devolve o exercício já com a nova data da imagem. */
  aoMudar: (exercicio: Exercicio) => void;
}

/**
 * "Imagem ou GIF" na folha do exercício da biblioteca: enviar, trocar e remover (com confirmação). A imagem própria vale
 * mais que as fotos do catálogo; sem ela, aparecem as do catálogo, se houver. O vídeo continua um link, no campo acima.
 */
export function ImagemDoExercicioEditor({ exercicio, podeAlterar, aoMudar }: Props) {
  const { avisar } = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const temPropria = exercicio.imagemPropriaEm !== null;

  const enviar = async () => {
    let escolhida: ImagemDoExercicioEscolhida | null = null;
    setEnviando(true);
    try {
      escolhida = await escolherImagemDoExercicio();
      if (!escolhida) return;
      const dados = new FormData();
      anexarImagemDoExercicio(dados, escolhida);
      aoMudar(await enviarImagemDoExercicio(exercicio.id, dados));
      avisar('Imagem salva.', 'sucesso');
    } catch (erro) {
      avisar(erro instanceof FotoRecusada ? erro.message : textoDoErro(erro), 'perigo');
    } finally {
      await descartarImagemEscolhida(escolhida);
      setEnviando(false);
    }
  };

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

  return (
    <View style={estilos.bloco}>
      <Texto variante="rotulo">{TEXTOS_IMAGEM_EXERCICIO.titulo}</Texto>
      <DemonstracaoDoExercicio exercicioId={exercicio.id} nome={exercicio.nome} imagens={exercicio.imagens}
        imagemPropriaEm={exercicio.imagemPropriaEm} papel="EQUIPE" largura={240} altura={180} />
      {!temPropria && exercicio.imagens.length === 0 ? <Texto variante="suave">{TEXTOS_IMAGEM_EXERCICIO.semImagem}</Texto> : null}
      {podeAlterar ? (
        <>
          <Texto variante="suave">{TEXTOS_IMAGEM_EXERCICIO.dica}</Texto>
          <LinhaDeAcoes>
            <Botao rotulo={temPropria ? TEXTOS_IMAGEM_EXERCICIO.trocar : TEXTOS_IMAGEM_EXERCICIO.enviar} tipo="secundario" Icone={ImagePlus}
              carregando={enviando} aoTocar={() => void enviar()} />
            {temPropria ? <Botao rotulo={TEXTOS_IMAGEM_EXERCICIO.remover} tipo="perigoTexto" Icone={Trash2} aoTocar={() => setConfirmarRemocao(true)} /> : null}
          </LinhaDeAcoes>
        </>
      ) : null}
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

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
});
