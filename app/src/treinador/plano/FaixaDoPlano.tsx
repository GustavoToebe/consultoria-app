import { NotebookTabs, UserRound, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { aluno } from '../../api/rotas';
import type { TipoPlano } from '../../api/tipos';
import { avisoDoPlanoDoAluno, AVISO_DO_MODELO } from '../../dominio/planoDoAluno';
import { avisoDoEditor } from '../../dominio/planosAtivos';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Alerta } from '../../ui/Estados';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Nome do aluno dono do plano, para o título do editor. Usa a mesma leitura da ficha; se falhar (ou o perfil não
 * puder ler o aluno), devolve null e o título fica genérico ("Treino do aluno").
 */
export function useNomeDoAluno(alunoId: string | null | undefined): string | null {
  const carga = useCarregar(alunoId ?? null, (id) => aluno(id));
  return carga.dados?.nome ?? null;
}

function Faixa({ Icone, texto }: { Icone: LucideIcon; texto: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.faixa}>
      <Icone size={16} color={cores.textoSuave} />
      <Texto variante="suave" style={estilos.texto}>{texto}</Texto>
    </View>
  );
}

/**
 * Faixa do editor do plano do aluno: a cópia é só dele e o modelo do Planejamento não muda. Com `alunoId`, avisa também
 * (Alerta de atenção, só informação: nada é bloqueado) quando o plano comercial ativo não inclui este item (D13); enquanto
 * a ficha carrega, se a leitura falhar ou sem `planosAtivos`, nada aparece.
 */
export function FaixaDoPlanoDoAluno({ tipo, alunoId }: { tipo: TipoPlano; alunoId?: string }) {
  // shortcut: lê a ficha de novo (o editor já a lê para o nome); juntar as duas leituras se o editor passar a guardar o aluno.
  const ficha = useCarregar(alunoId ?? null, (id) => aluno(id));
  const aviso = avisoDoEditor(tipo, ficha.dados?.id === alunoId ? ficha.dados?.planosAtivos : null);
  return (
    <>
      <Faixa Icone={UserRound} texto={avisoDoPlanoDoAluno(tipo)} />
      {aviso ? <Alerta tom="atencao" texto={aviso} /> : null}
    </>
  );
}

/** Faixa do editor de modelo: é o molde, e as cópias já entregues aos alunos não mudam. */
export function FaixaDoModelo() {
  return <Faixa Icone={NotebookTabs} texto={AVISO_DO_MODELO} />;
}

const estilos = StyleSheet.create({
  faixa: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  texto: { flex: 1 },
});
