import { Eye, Undo2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import { desmarcarTrocaVista, marcarTrocaVista, trocasDeExercicioDoAluno } from '../api/rotas';
import type { TrocaDeExercicio } from '../api/tipos';
import { hojeIso } from '../dominio/formatos';
import {
  chaveDaTroca, comVisto, descricaoDasTrocas, idDaTroca, metadadosDaTroca, rotulosDoVisto, seloDaTroca, textoDaTroca,
} from '../dominio/trocasDeExercicio';
import { useSessao } from '../sessao/SessaoProvider';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { useCarregar } from '../ui/useCarregar';

/**
 * Trocas "só hoje" do aluno nos últimos 7 dias (`docs/planos/alertas-de-troca.md`): o exercício do plano, a alternativa que
 * ele fez e o "Visto" (com `REGISTRO_REAGIR`; sem ela, só leitura). O aluno não é avisado do visto. Sem troca no período,
 * ou sem acesso (403), o cartão não aparece. `rolarAte` (o `?secao=trocas` do Início) traz o cartão à vista na web quando a
 * lista chega e chama `aoRolar` para limpar o endereço. Quem renderiza confere `REGISTRO_LER`.
 */
export function CartaoTrocasDeExercicio({ alunoId, rolarAte, aoRolar }: { alunoId: string; rolarAte?: boolean; aoRolar?: () => void }) {
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const hoje = hojeIso();
  const { dados, erro, recarregar, definir } = useCarregar(`trocas-de-exercicio:${alunoId}:${hoje}`, () => trocasDeExercicioDoAluno(alunoId));
  const [salvando, setSalvando] = useState<string | null>(null);
  const reagir = pode('REGISTRO_REAGIR');
  const ref = useRef<View>(null);
  const resolvido = dados !== undefined || !!erro;

  useEffect(() => {
    if (!rolarAte || !resolvido) return;
    // shortcut: só a web rola até o cartão (como o `?secao=acesso`); no celular a aba abre no topo.
    if (Platform.OS === 'web') (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'start' });
    aoRolar?.();
  }, [rolarAte, resolvido, aoRolar]);

  // Não otimista, como o "Visto" dos treinos: o botão mostra o envio e a lista só muda com a resposta.
  const alternar = async (t: TrocaDeExercicio) => {
    if (!dados) return;
    const id = idDaTroca(t);
    setSalvando(id);
    try {
      const vistoEm = t.vistoEm ? (await desmarcarTrocaVista(alunoId, chaveDaTroca(t)), null) : (await marcarTrocaVista(alunoId, chaveDaTroca(t))).vistoEm;
      definir(comVisto(dados, id, vistoEm));
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
      recarregar();
    } finally {
      setSalvando(null);
    }
  };

  if (erro instanceof ErroApi && erro.status === 403) return null;
  if (dados && dados.trocas.length === 0) return null;
  return (
    <View ref={ref} nativeID="trocas-de-exercicio">
      <Cartao titulo="Trocas de exercício" descricao={dados ? descricaoDasTrocas(dados.trocas, reagir) : 'Últimos 7 dias.'}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
        {dados === undefined && !erro ? <Esqueleto cartoes={1} /> : null}
        {dados ? (
          <ListaDeLinhas>
            {dados.trocas.map((t) => {
              const id = idDaTroca(t);
              const rotulos = rotulosDoVisto(t, hoje);
              return (
                <LinhaDaLista key={id} titulo={textoDaTroca(t)} metadados={metadadosDaTroca(t, hoje)} selos={[seloDaTroca(t, reagir)]}
                  acoes={reagir ? (t.vistoEm
                    ? <Botao rotulo="Desfazer" tipo="fantasma" Icone={Undo2} rotuloAcessivel={rotulos.desfazer} carregando={salvando === id} aoTocar={() => void alternar(t)} />
                    : <Botao rotulo="Marcar como visto" tipo="secundario" Icone={Eye} rotuloAcessivel={rotulos.marcar} carregando={salvando === id} aoTocar={() => void alternar(t)} />
                  ) : undefined} />
              );
            })}
          </ListaDeLinhas>
        ) : null}
      </Cartao>
    </View>
  );
}
