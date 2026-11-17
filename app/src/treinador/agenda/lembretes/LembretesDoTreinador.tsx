import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { listarCompromissos } from '../../../api/rotas';
import {
  desligarLembretesDeCompromisso, encerrarLembretesDeCompromisso, iniciarLembretesDeCompromisso,
  reagendarLembretesDeCompromisso,
} from '../../../aluno/compromissos/lembretes';
import { hojeEmBrasilia } from '../../../dominio/agendaPresencial';
import { somarDias } from '../../../dominio/formatos';
import { compromissosDoResponsavelParaLembrete, type CompromissoParaLembrete } from '../../../dominio/lembretesCompromisso';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { useCarregar } from '../../../ui/useCarregar';

// shortcut: só os próximos 60 dias (a API lista até 62), então uma antecedência longa de um compromisso mais distante só
// vale quando ele entrar na janela; trocar por busca paginada se a equipe passar a marcar com meses de folga.
const JANELA_EM_DIAS = 60;

/**
 * Lembretes locais do treinador responsável (D6): mesma camada do aluno (`aluno/compromissos/lembretes`), com o id dele
 * no prefixo, para os compromissos em que ele é o responsável. Não desenha nada; vive no layout do treinador. Só no celular
 * (na web não há notificação, D8) e só com a preferência `lembretesCompromisso` ligada e `AGENDA_LER`. A lista é buscada
 * ao abrir, a cada troca de tela (como o ponto do menu) e quando o app volta para a frente, então marcar, remarcar ou
 * cancelar valem na tela seguinte. Sair da conta apaga os lembretes dele.
 */
export function LembretesDoTreinador() {
  const { usuario, pode, aoSair } = useSessao();
  const { preferencias } = useTema();
  const caminho = usePathname();
  const usuarioId = usuario?.papel === 'TREINADOR' ? usuario.id : null;
  const ligado = preferencias.lembretesCompromisso;
  const ativo = Platform.OS !== 'web' && usuarioId !== null && pode('AGENDA_LER');

  const carga = useCarregar(
    ativo && ligado ? `lembretes-do-treinador:${usuarioId}:${caminho}` : null,
    async (): Promise<CompromissoParaLembrete[]> => {
      const hoje = hojeEmBrasilia();
      const lista = await listarCompromissos({ de: hoje, ate: somarDias(hoje, JANELA_EM_DIAS), responsavel: usuarioId, situacoes: ['AGENDADO'] });
      return compromissosDoResponsavelParaLembrete(lista, usuarioId as string);
    },
  );
  const { recarregar } = carga;
  const lista = carga.dados;

  useEffect(() => {
    if (!ativo) return;
    const assinatura = AppState.addEventListener('change', (estado) => { if (estado === 'active') recarregar(); });
    return () => assinatura.remove();
  }, [ativo, recarregar]);

  useEffect(() => {
    if (usuarioId === null) return;
    iniciarLembretesDeCompromisso(usuarioId);
    return aoSair((id) => encerrarLembretesDeCompromisso(id).catch(() => undefined));
  }, [usuarioId, aoSair]);

  const assinaturaDaLista = lista ? lista.map((c) => `${c.id}|${c.inicio}|${c.situacao}|${c.lembretesMinutos.join(',')}`).join(';') : null;
  const listaAtual = useRef(lista);
  useEffect(() => { listaAtual.current = lista; });
  const estavaLigado = useRef(false);
  useEffect(() => {
    if (usuarioId === null || !ativo) return;
    if (!ligado) {
      // A preferência chega do armazenamento depois da primeira renderização: só apaga quando ela foi mesmo desligada.
      if (estavaLigado.current) void desligarLembretesDeCompromisso(usuarioId).catch(() => undefined);
      estavaLigado.current = false;
      return;
    }
    estavaLigado.current = true;
    if (assinaturaDaLista !== null) void reagendarLembretesDeCompromisso(usuarioId, listaAtual.current ?? null).catch(() => undefined);
  }, [ativo, ligado, assinaturaDaLista, usuarioId]);

  return null;
}
