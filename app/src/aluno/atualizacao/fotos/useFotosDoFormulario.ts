import { useState } from 'react';

import { ErroApi } from '../../../api/cliente';
import { removerFoto, type DestinoDaFoto } from '../../../api/rotas';
import type { RespostasAtualizacao } from '../../../api/tipos';
import {
  comFotoLocal, idsDeFotos, semFotoLocal, TEXTO_FOTOS_INDISPONIVEIS, TEXTO_FOTOS_SEM_CONEXAO, todasAsFotosLocais, vagasDeFoto,
} from '../../../dominio/fotosAtualizacao';
import { useAviso } from '../../../ui/Aviso';
import { textoDoErro } from '../../../ui/erros';
import { useCarregar } from '../../../ui/useCarregar';
import { buscarConfiguracaoDeFotos } from './configuracaoSalva';
import type { ControleDeFotos, ItemDeFoto } from './ControleDeFotos';
import { enviarFotoDoAparelho } from './enviarFotoDoAparelho';
import { apagarFotoLocal, fotoLocalExiste, fotosLocaisDisponiveis, guardarFotoLocal, uriDaFotoLocal } from './fotosLocais';
import { escolherFoto, FotoRecusada, type OrigemDaFoto } from './prepararFoto';

export type FotosLocais = Record<string, string[]>;
export interface EstadoDasFotos { respostas: RespostasAtualizacao; locais: FotosLocais }

interface Entrada {
  usuarioId: string;
  /** Para onde a foto sobe: a pasta da atualização ou a anamnese pendente. Nulo = não dá para subir. */
  destino: DestinoDaFoto | null;
  online: boolean;
  /** Formulário aberto, liberado e sem envio em andamento. */
  editavel: boolean;
  /** Fotos no aparelho que a tela mostra agora. */
  locais: FotosLocais;
  /** Estado mais recente das respostas e das fotos no aparelho (lido na hora, nos eventos, não na renderização). */
  ler: () => EstadoDasFotos;
  /** Troca o estado e grava o rascunho. */
  aplicar: (novo: EstadoDasFotos) => void;
}

/**
 * Fotos da atualização ou da anamnese no formulário do aluno. Celular: a foto é reduzida, fica na pasta privada do app e sobe no envio
 * (dá para tirar sem internet). Web: precisa de internet, sobe na hora e o rascunho guarda só os ids.
 */
export function useFotosDoFormulario({ usuarioId, destino, online, editavel, locais: locaisNaTela, ler, aplicar }: Entrada) {
  const { avisar } = useAviso();
  const [ocupado, setOcupado] = useState(false);
  const configuracao = useCarregar(`${usuarioId}:${online}`, () => buscarConfiguracaoDeFotos(usuarioId, online));
  const habilitado = configuracao.carregando ? null : configuracao.dados ? configuracao.dados.habilitado : null;
  const maximo = configuracao.dados?.maximoPorPergunta ?? 6;

  const anexar = async (perguntaId: string, origem: OrigemDaFoto) => {
    if (!editavel || ocupado || !destino) return;
    if (habilitado !== true) {
      avisar(TEXTO_FOTOS_INDISPONIVEIS);
      return;
    }
    const { respostas, locais } = ler();
    const enviadas = idsDeFotos(respostas[perguntaId]);
    if (vagasDeFoto(enviadas.length, (locais[perguntaId] ?? []).length, maximo) === 0) {
      avisar(`Esta pergunta aceita até ${maximo} fotos.`);
      return;
    }
    if (!fotosLocaisDisponiveis && !online) {
      avisar(TEXTO_FOTOS_SEM_CONEXAO);
      return;
    }
    setOcupado(true);
    try {
      const foto = await escolherFoto(origem);
      if (!foto) return;
      if (fotosLocaisDisponiveis) {
        const nome = await guardarFotoLocal(usuarioId, foto.uri);
        const agora = ler();
        aplicar({ respostas: agora.respostas, locais: comFotoLocal(agora.locais, perguntaId, nome) });
      } else {
        const id = await enviarFotoDoAparelho(destino, foto);
        const agora = ler();
        aplicar({ respostas: { ...agora.respostas, [perguntaId]: [...idsDeFotos(agora.respostas[perguntaId]), id] }, locais: agora.locais });
      }
    } catch (erro) {
      avisar(erro instanceof FotoRecusada ? erro.message : textoDoErro(erro), 'perigo');
    } finally {
      setOcupado(false);
    }
  };

  const remover = async (perguntaId: string, item: ItemDeFoto) => {
    if (!editavel || ocupado) return;
    if (item.tipo === 'local') {
      await apagarFotoLocal(usuarioId, item.nome).catch(() => undefined);
      const agora = ler();
      aplicar({ respostas: agora.respostas, locais: semFotoLocal(agora.locais, perguntaId, item.nome) });
      return;
    }
    if (!online) {
      avisar('Conecte-se à internet para remover uma foto já enviada.');
      return;
    }
    setOcupado(true);
    try {
      // 404: já saiu do servidor (por exemplo, a limpeza das fotos sem envio); só falta tirar da tela.
      await removerFoto(item.id).catch((erro: unknown) => {
        if (!(erro instanceof ErroApi && erro.status === 404)) throw erro;
      });
      const agora = ler();
      const restantes = idsDeFotos(agora.respostas[perguntaId]).filter((id) => id !== item.id);
      const respostas = { ...agora.respostas };
      if (restantes.length) respostas[perguntaId] = restantes;
      else delete respostas[perguntaId];
      aplicar({ respostas, locais: agora.locais });
    } catch (erro) {
      avisar(textoDoErro(erro), 'perigo');
    } finally {
      setOcupado(false);
    }
  };

  /**
   * No envio: sobe as fotos que estão no aparelho, uma a uma, e as troca por ids nas respostas (o rascunho é regravado a
   * cada foto, então uma falha no meio não perde as que já subiram). Devolve as respostas completas; lança o erro da
   * primeira foto que falhar.
   */
  const subirLocais = async (): Promise<RespostasAtualizacao> => {
    if (!destino) return ler().respostas;
    for (const [perguntaId, nomes] of Object.entries(ler().locais)) {
      for (const nome of nomes) {
        const agora = ler();
        if (!fotoLocalExiste(usuarioId, nome)) {
          // Sumiu do aparelho (limpeza do sistema): segue sem ela.
          aplicar({ respostas: agora.respostas, locais: semFotoLocal(agora.locais, perguntaId, nome) });
          continue;
        }
        const id = await enviarFotoDoAparelho(destino, { uri: uriDaFotoLocal(usuarioId, nome) });
        await apagarFotoLocal(usuarioId, nome).catch(() => undefined);
        const depois = ler();
        aplicar({
          respostas: { ...depois.respostas, [perguntaId]: [...idsDeFotos(depois.respostas[perguntaId]), id] },
          locais: semFotoLocal(depois.locais, perguntaId, nome),
        });
      }
    }
    return ler().respostas;
  };

  /** Apaga do aparelho qualquer foto que tenha sobrado (envio concluído ou atualização que já estava enviada). */
  const apagarLocais = async () => {
    const { locais } = ler();
    await Promise.all(todasAsFotosLocais(locais).map((nome) => apagarFotoLocal(usuarioId, nome).catch(() => undefined)));
  };

  const controle: ControleDeFotos = {
    usuarioId,
    habilitado,
    maximoPorPergunta: maximo,
    online,
    guardaNoAparelho: fotosLocaisDisponiveis,
    editavel,
    ocupado,
    locais: locaisNaTela,
    anexar,
    remover,
  };
  return { controle, subirLocais, apagarLocais, habilitado };
}
