import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarLesao, registrarLesao } from '../api/rotas';
import type { Lesao, SituacaoLesao } from '../api/tipos';
import { hojeEmBrasilia } from '../dominio/agendaPresencial';
import {
  analisarLesao, comporRegiao, formularioDaLesao, LADOS, type LadoDaLesao, LIMITE_DA_DESCRICAO, LIMITE_DA_OBSERVACAO, LIMITE_DA_REGIAO,
  lerRegiao, lesaoAlterada, REGIOES, type RegiaoDoAtalho, temFim,
} from '../dominio/folhaDeLesao';
import { dataParaTela } from '../dominio/formatos';
import { useFecharComAviso } from '../comunidade/useFecharComAviso';
import { espaco } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Escolha } from '../ui/Escolha';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';

const SITUACOES: { valor: SituacaoLesao; rotulo: string }[] = [
  { valor: 'ATIVA', rotulo: 'Ativa' },
  { valor: 'EM_RECUPERACAO', rotulo: 'Em recuperação' },
  { valor: 'RECUPERADA', rotulo: 'Recuperada' },
];

const OPCOES_DE_REGIAO = REGIOES.map((r) => ({ valor: r as RegiaoDoAtalho | null, rotulo: r }));
const OPCOES_DE_LADO = LADOS.map((l) => ({ valor: l.valor as LadoDaLesao | null, rotulo: l.rotulo }));

/**
 * Registrar e Editar lesão (ficha: folha de lesão, 24/11). Região do corpo é obrigatória e tem atalhos (chips de região e
 * o lado) que só preenchem o campo, que segue livre para digitar; a API recebe o mesmo texto de sempre. Descrição ("O que
 * é") e observação ("Cuidados no treino") são opcionais. O Início tem o atalho "Hoje" (Brasília) e o Fim só aparece com a
 * situação "Recuperada" e não é gravado nas outras. Salvar apagado diz o que falta (`analisarLesao`); fechar com alteração
 * pergunta "Sair sem salvar?". Nada disto vai a log: lesão é dado sensível.
 */
export function FolhaLesao({ alunoId, lesao, aoFechar, aoSalvar }: { alunoId: string; lesao: Lesao | null; aoFechar: () => void; aoSalvar: () => void }) {
  // O que a folha abriu: a referência do "Sair sem salvar?" (e do estado dos atalhos de uma lesão que já tem região).
  const [aberto] = useState(() => formularioDaLesao(lesao));
  const [form, setForm] = useState(aberto);
  const [atalho, setAtalho] = useState(() => lerRegiao(aberto.regiao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const { corpo, motivo, erroDoFim } = analisarLesao(form);
  const { fechar, aviso } = useFecharComAviso(true, lesaoAlterada(aberto, form), aoFechar);
  const mudar = (parte: Partial<typeof form>) => setForm((f) => ({ ...f, ...parte }));

  // À mão: o texto que reproduz um atalho o marca; qualquer outro desmarca a região e deixa o lado para o próximo atalho.
  const digitarRegiao = (regiao: string) => {
    mudar({ regiao });
    const lido = lerRegiao(regiao);
    setAtalho((a) => ({ regiao: lido.regiao, lado: lido.regiao ? lido.lado : a.lado }));
  };
  const escolherRegiao = (regiao: RegiaoDoAtalho | null) => {
    if (!regiao) return;
    setAtalho({ ...atalho, regiao });
    mudar({ regiao: comporRegiao(regiao, atalho.lado) });
  };
  // Sem região escolhida o lado só fica marcado: não preenche nada.
  const escolherLado = (lado: LadoDaLesao | null) => {
    setAtalho({ ...atalho, lado });
    if (atalho.regiao) mudar({ regiao: comporRegiao(atalho.regiao, lado) });
  };

  const salvar = () => {
    if (!corpo) return;
    setSalvando(true);
    setErro(null);
    (lesao ? alterarLesao(alunoId, lesao.id, corpo) : registrarLesao(alunoId, corpo)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={lesao ? 'Editar lesão' : 'Registrar lesão'}
      aoFechar={fechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!corpo} motivo={motivo ?? undefined} />
        </>
      }>
      <View style={estilos.regiao}>
        <Campo rotulo="Região do corpo (obrigatória)" valor={form.regiao} aoMudar={digitarRegiao} maxLength={LIMITE_DA_REGIAO} placeholder="Ex.: Ombro direito" />
        <Escolha<RegiaoDoAtalho | null> descricao="Atalhos de região" opcoes={OPCOES_DE_REGIAO} valor={atalho.regiao} aoMudar={escolherRegiao} />
        <Escolha<LadoDaLesao | null> rotulo="Lado" opcoes={OPCOES_DE_LADO} valor={atalho.lado} aoMudar={escolherLado} limpavel />
      </View>
      <Campo rotulo="O que é (opcional)" valor={form.descricao} aoMudar={(descricao) => mudar({ descricao })} maxLength={LIMITE_DA_DESCRICAO}
        linhas={2} placeholder="Ex.: tendinite, entorse, pós-cirúrgico" />
      <Escolha rotulo="Situação" opcoes={SITUACOES} valor={form.situacao} aoMudar={(situacao) => mudar({ situacao })} />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início (opcional)" nome="Início da lesão" regra="REGISTRO" valor={form.inicio} aoMudar={(inicio) => mudar({ inicio })} />
        </View>
        <View style={estilos.hoje}>
          {/* Mesma altura do rótulo do campo, para o botão ficar na linha do campo mesmo com erro embaixo do Fim. */}
          <Texto variante="rotulo" cor="transparent" aria-hidden importantForAccessibility="no-hide-descendants">Início</Texto>
          <Botao rotulo="Hoje" rotuloAcessivel="Hoje: preencher o início" tipo="secundario" aoTocar={() => mudar({ inicio: dataParaTela(hojeEmBrasilia()) })} />
        </View>
        {temFim(form.situacao) ? (
          <View style={estilos.data}>
            <CampoData rotulo="Fim (opcional)" nome="Fim da lesão" regra="REGISTRO" valor={form.fim} aoMudar={(fim) => mudar({ fim })} erro={erroDoFim} />
          </View>
        ) : null}
      </View>
      <Campo rotulo="Cuidados no treino (opcional)" valor={form.observacao} aoMudar={(observacao) => mudar({ observacao })} maxLength={LIMITE_DA_OBSERVACAO}
        linhas={3} placeholder="Ex.: evitar carga acima da cabeça"
        ajuda="Só a equipe com acesso a dados sensíveis vê. Não aparece para o aluno nem no editor de treino." />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {aviso}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  regiao: { gap: espaco(1) },
  // Início | Hoje | Fim na mesma linha quando cabem (as duas datas com o mesmo tamanho); senão o Fim desce, o Início fica com o Hoje.
  datas: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  data: { flexGrow: 1, flexShrink: 1, flexBasis: 190, minWidth: 0 },
  hoje: { gap: espaco(0.5) },
});
