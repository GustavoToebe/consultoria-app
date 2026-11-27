import {
  AlignLeft, Calendar, CalendarCheck, Camera, CircleCheck, CircleDot, ClipboardList, FileCheck, Gauge, Grid3x3, Hash, Info, ListChecks, Mail, MapPin, Phone,
  Rows3, Scale, Type, type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FinalidadeQuestionario, TipoPergunta } from '../../api/tipos';
import { EXEMPLO_DO_TIPO, gruposParaAdicionar, type Permissao, ROTULO_DO_TIPO } from '../../dominio/editorQuestionario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

const ICONE_DO_TIPO: Record<TipoPergunta, LucideIcon> = {
  TEXTO: Type, TEXTO_LONGO: AlignLeft, SIM_NAO: CircleCheck, ESCOLHA_UNICA: CircleDot, MULTIPLA_ESCOLHA: ListChecks, GRADE: Grid3x3,
  NOTA: Gauge, NOTAS_POR_DIA: Rows3, NUMERO: Hash, PESO: Scale, DATA: Calendar, DATA_AUTOMATICA: CalendarCheck, TELEFONE: Phone, EMAIL: Mail,
  ENDERECO: MapPin, FOTOS: Camera, ITENS_DO_PLANO: ClipboardList, INFORMATIVO: Info, ACEITE: FileCheck,
};

/**
 * Galeria "Adicionar pergunta" (bloco G): os tipos da finalidade em grupos com subtítulo, cada um com ícone, nome e um
 * exemplo de uma linha; tipo que não cabe mais (peso repetido, fotos no teto) fica apagado com o motivo no lugar do
 * exemplo. Serve à folha e ao editor vazio. A descrição longa vai para o leitor de tela.
 */
export function GaleriaDeTipos({ finalidade, permissao, aoEscolher }: {
  finalidade: FinalidadeQuestionario; permissao: (tipo: TipoPergunta) => Permissao; aoEscolher: (tipo: TipoPergunta) => void;
}) {
  return <View style={estilos.galeria}>
    {gruposParaAdicionar(finalidade).map((g) => <View key={g.rotulo} style={estilos.grupo} role="group" aria-label={g.rotulo}>
      <Texto variante="secao">{g.rotulo}</Texto>
      <View style={estilos.celulas}>
        {g.itens.map(({ tipo, descricao }) => {
          const p = permissao(tipo);
          return <OpcaoDeTipo key={tipo} tipo={tipo} descricao={descricao} motivo={p.pode ? undefined : p.motivo ?? 'Indisponível.'} aoEscolher={() => aoEscolher(tipo)} />;
        })}
      </View>
    </View>)}
  </View>;
}

function OpcaoDeTipo({ tipo, descricao, motivo, aoEscolher }: { tipo: TipoPergunta; descricao: string; motivo?: string; aoEscolher: () => void }) {
  const { cores } = useTema();
  const Icone = ICONE_DO_TIPO[tipo] ?? Info;
  const desabilitado = motivo !== undefined;
  const titulo = ROTULO_DO_TIPO[tipo] ?? tipo;
  return <Pressable accessibilityRole="button" accessibilityLabel={titulo} accessibilityHint={motivo ?? descricao} accessibilityState={{ disabled: desabilitado }}
    disabled={desabilitado} onPress={aoEscolher}
    style={(estado) => [estilos.opcao, {
      backgroundColor: desabilitado ? coresDoDesabilitado(cores).fundo : sobre(estado) ? cores.sobre : cores.superficie2, borderColor: cores.divisor,
    }]}>
    <Icone size={20} color={desabilitado ? cores.textoSuave : cores.texto} aria-hidden />
    <View style={estilos.textos}>
      <Texto style={estilos.nome} cor={desabilitado ? cores.textoSuave : undefined}>{titulo}</Texto>
      <Texto variante="pequeno" numberOfLines={motivo ? 2 : 1}>{motivo ?? EXEMPLO_DO_TIPO[tipo]}</Texto>
    </View>
  </Pressable>;
}

const estilos = StyleSheet.create({
  galeria: { gap: espaco(2) },
  grupo: { gap: espaco(1) },
  // Célula mínima de 200 (3 por linha na folha de 800, 1 no celular).
  celulas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  opcao: {
    flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0, minHeight: ALVO_TOQUE + espaco(1), flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.25),
    borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5),
  },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  nome: { fontFamily: fontes.semi },
});
