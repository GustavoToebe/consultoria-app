import { useState } from 'react';

import { obterConfiguracaoDaComunidade, salvarConfiguracaoDaComunidade } from '../../api/comunidade';
import type { ConfiguracaoDaComunidade } from '../../api/comunidadeTipos';
import { Interruptor } from '../../ui/Campos';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * As duas chaves do mural (C9, `COMUNIDADE_MODERAR`), fora do caminho de leitura (guia, pág. 36). Muda na hora e volta
 * se a API recusar; o PUT manda sempre os dois campos. Uma mudança por vez: enquanto uma salva, a outra espera. A recusa
 * fica dentro da folha, porque o aviso de rodapé (`useAviso`) fica atrás do véu do Modal.
 */
function ChavesDoMural() {
  const config = useCarregar('treinador-comunidade-configuracao', () => obterConfiguracaoDaComunidade());
  const [salvando, setSalvando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const mudar = async (parte: Partial<ConfiguracaoDaComunidade>) => {
    const antes = config.dados;
    if (!antes || salvando) return;
    const depois = { alunosPublicam: antes.alunosPublicam, alunosAnexamFotos: antes.alunosAnexamFotos, ...parte };
    config.definir(depois);
    setSalvando(true);
    setRecusa(null);
    try {
      config.definir(await salvarConfiguracaoDaComunidade(depois));
    } catch (e) {
      config.definir(antes);
      setRecusa(textoDoErro(e));
    } finally {
      setSalvando(false);
    }
  };
  if (config.erro) return <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} />;
  if (!config.dados) return <Esqueleto cartoes={1} texto="Carregando as chaves do mural" />;
  return (
    <>
      {recusa ? <Alerta tom="perigo" texto={recusa} /> : null}
      <Interruptor rotulo="Alunos podem publicar" valor={config.dados.alunosPublicam}
        aoMudar={(v) => void mudar({ alunosPublicam: v })} ajuda="Conversa, dúvida e resultado." />
      <Interruptor rotulo="Alunos podem anexar fotos" valor={config.dados.alunosAnexamFotos}
        aoMudar={(v) => void mudar({ alunosAnexamFotos: v })} ajuda="Até 4 por publicação; vale só com a de cima ligada." />
    </>
  );
}

/** Sem rodapé: as chaves salvam na hora; o X, o Esc e o voltar fecham. */
export function FolhaConfiguracoesDoMural({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  return (
    <Folha visivel={visivel} titulo="Configurações do mural" aoFechar={aoFechar}>
      <Texto variante="suave">Quem publica no mural. A equipe sempre publica; comentar e curtir continuam liberados para os alunos.</Texto>
      <ChavesDoMural />
    </Folha>
  );
}
