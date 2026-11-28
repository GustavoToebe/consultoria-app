import { CreditCard, Mail, MessageCircle, Receipt, UserCheck, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TEXTO_KIWIFY_NOS_LEMBRETES } from '../../../dominio/kiwify';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { espaco } from '../../../tema/tokens';
import { Cartao } from '../../../ui/Cartao';
import { Texto } from '../../../ui/Texto';
import { LinkDeAba } from '../AjustesDaAba';

/**
 * "Quem recebe e por onde" em linhas curtas com ícone (28/11): os textos de antes, encurtados, só com as regras que a API
 * aplica (`AGENTS.md`, lembretes de cobrança). A da Kiwify só com ela ligada (D18: a mensalidade automática não tem lembrete).
 */
export function QuemRecebe() {
  const { kiwifyHabilitada } = useSessao();
  const regras: { Icone: LucideIcon; texto: ReactNode }[] = [
    { Icone: Mail, texto: 'Vai ao e-mail do cadastro do aluno ou, sem ele, ao de login.' },
    { Icone: UserCheck, texto: 'Só aluno ativo recebe. Ele pode desligar os lembretes na Conta do app.' },
    { Icone: Receipt, texto: <>Enviados e previstos aparecem na folha de cada cobrança, em <LinkDeAba aba="cobrancas" texto="Cobranças" />.</> },
    { Icone: MessageCircle, texto: 'WhatsApp é manual: o botão na folha da cobrança abre a mesma mensagem.' },
    ...(kiwifyHabilitada ? [{ Icone: CreditCard, texto: TEXTO_KIWIFY_NOS_LEMBRETES }] : []),
  ];
  return (
    <Cartao titulo="Quem recebe e por onde">
      <View role="list" style={estilos.regras}>
        {regras.map((r, i) => <Regra key={i} Icone={r.Icone}>{r.texto}</Regra>)}
      </View>
    </Cartao>
  );
}

function Regra({ Icone, children }: { Icone: LucideIcon; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View role="listitem" style={estilos.regra}>
      <Icone size={18} color={cores.textoSuave} aria-hidden />
      <Texto variante="pequeno" style={estilos.texto}>{children}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  regras: { gap: espaco(1.5) },
  regra: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  texto: { flex: 1, minWidth: 0 },
});
