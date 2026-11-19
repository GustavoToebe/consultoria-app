import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { salvarResponsavelFinanceiro, type ResponsavelFinanceiro } from '../../api/financeiroResponsavel';
import { mascaraCpf, mascaraTelefone } from '../../dominio/cadastroDoAluno';
import {
  AJUDA_DO_RESPONSAVEL, corpoDoResponsavel, errosDoResponsavel, formDoResponsavel, houveMudanca, LIMITES_DO_RESPONSAVEL, temResponsavel,
  traduzirErroDoResponsavel, type CampoDoResponsavel, type ErrosDoResponsavel, type FormDoResponsavel,
} from '../../dominio/responsavelFinanceiro';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Alerta } from '../../ui/Estados';
import { focarPrimeiroComErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';

/**
 * Folha "Adicionar/Editar responsável financeiro" (D15), aberta pelo cartão "Plano contratado". Só o formulário: remover fica
 * no cartão, com o `PainelConfirmacao`. O formulário nasce com tudo o que o GET trouxe (o PUT substitui tudo). O CPF só aparece
 * com `ALUNO_SENSIVEL_LER` (`veCpf`): sem ela a API ignora o do corpo e o gravado fica. É dado de outra pessoa: o título, os
 * avisos e os erros nunca levam o nome nem o contato digitados, e telefone e e-mail não sugerem o preenchimento automático (que
 * traria os dados do próprio treinador).
 */
export function FolhaResponsavelFinanceiro({ alunoId, responsavel, veCpf, aoFechar, aoSalvar, aoRecarregar }: {
  alunoId: string;
  responsavel: ResponsavelFinanceiro;
  veCpf: boolean;
  aoFechar: () => void;
  /** A resposta do PUT tem o formato do GET: o cartão troca os dados sem buscar de novo. */
  aoSalvar: (novo: ResponsavelFinanceiro) => void;
  /** 409: outra pessoa mudou (ou o aluno foi anonimizado); o cartão fecha a Folha, busca de novo e avisa com `mensagem`. */
  aoRecarregar: (mensagem: string) => void;
}) {
  const editando = temResponsavel(responsavel);
  const [form, setForm] = useState<FormDoResponsavel>(() => formDoResponsavel(responsavel));
  const [tocados, setTocados] = useState<ReadonlySet<CampoDoResponsavel>>(new Set());
  const [tentou, setTentou] = useState(false);
  const [doServidor, setDoServidor] = useState<ErrosDoResponsavel>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refs = {
    nome: useRef<TextInput>(null), parentesco: useRef<TextInput>(null), telefone: useRef<TextInput>(null),
    email: useRef<TextInput>(null), cpf: useRef<TextInput>(null),
  };

  const locais = errosDoResponsavel(form, veCpf);
  // O erro local aparece ao sair do campo (ou ao tentar salvar); o do servidor, até a pessoa mexer no campo.
  const erroDe = (c: CampoDoResponsavel) => ((tentou || tocados.has(c)) ? locais[c] : undefined) ?? doServidor[c] ?? null;
  const mudou = houveMudanca(form, responsavel);

  const mudar = (c: CampoDoResponsavel, valor: string) => {
    setForm((f) => ({ ...f, [c]: valor }));
    setDoServidor((e) => ({ ...e, [c]: undefined }));
    setGeral(null);
  };
  const sair = (c: CampoDoResponsavel) => setTocados((t) => (t.has(c) ? t : new Set(t).add(c)));
  const focar = (erros: ErrosDoResponsavel) => focarPrimeiroComErro(erros as Record<string, string>,
    [['nome', refs.nome], ['parentesco', refs.parentesco], ['telefone', refs.telefone], ['email', refs.email], ['cpf', refs.cpf]]);

  const salvar = () => {
    if (enviando) return;
    setTentou(true);
    if (Object.keys(locais).length > 0) {
      setGeral(null);
      focar(locais);
      return;
    }
    setEnviando(true);
    setGeral(null);
    salvarResponsavelFinanceiro(alunoId, corpoDoResponsavel(form, responsavel.versao, veCpf)).then(
      (novo) => { setEnviando(false); aoSalvar(novo); },
      (e: unknown) => {
        setEnviando(false);
        const t = traduzirErroDoResponsavel(e, veCpf);
        if (t.recarregar || t.esconder) {
          aoRecarregar(t.mensagem);
          return;
        }
        setDoServidor(t.campos);
        setGeral(t.mensagem);
        focar(t.campos);
      },
    );
  };

  const campo = (c: CampoDoResponsavel, rotulo: string, extra: Partial<Parameters<typeof Campo>[0]>) => (
    <Campo ref={refs[c]} rotulo={rotulo} valor={form[c]} erro={erroDe(c)} editable={!enviando}
      aoMudar={(t) => mudar(c, t)} onBlur={() => sair(c)} {...extra} />
  );

  return (
    <Folha visivel titulo={editando ? 'Editar responsável financeiro' : 'Adicionar responsável financeiro'} aoFechar={aoFechar}
      rodape={(
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} desabilitado={enviando} motivo="Salvando o responsável" />
          <Botao rotulo="Salvar responsável" aoTocar={salvar} carregando={enviando}
            desabilitado={editando && !mudou} motivo="Nada foi alterado ainda." />
        </>
      )}>
      <View style={estilos.coluna}>
        <Texto variante="suave">{AJUDA_DO_RESPONSAVEL}</Texto>
        {geral ? <View aria-live="assertive"><Alerta tom="perigo" texto={geral} /></View> : null}
        {campo('nome', 'Nome', { maxLength: LIMITES_DO_RESPONSAVEL.nome, autoComplete: 'off', autoCapitalize: 'words' })}
        {campo('parentesco', 'Parentesco (opcional)', { maxLength: LIMITES_DO_RESPONSAVEL.parentesco, autoComplete: 'off', ajuda: 'Por exemplo: mãe, pai, cônjuge.' })}
        {campo('telefone', 'Telefone (opcional)', {
          aoMudar: (t) => mudar('telefone', mascaraTelefone(t)), keyboardType: 'phone-pad', inputMode: 'tel', autoComplete: 'off', maxLength: 15, numerico: true,
          ajuda: 'Com DDD. O WhatsApp do lembrete abre com este número.',
        })}
        {campo('email', 'E-mail (opcional)', {
          keyboardType: 'email-address', inputMode: 'email', autoCapitalize: 'none', autoCorrect: false, spellCheck: false, autoComplete: 'off', maxLength: LIMITES_DO_RESPONSAVEL.email,
          ajuda: 'Os lembretes por e-mail vão para este endereço.',
        })}
        {veCpf ? campo('cpf', 'CPF (opcional)', {
          aoMudar: (t) => mudar('cpf', mascaraCpf(t)), keyboardType: 'number-pad', inputMode: 'numeric', autoComplete: 'off', maxLength: 14, numerico: true,
        }) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
