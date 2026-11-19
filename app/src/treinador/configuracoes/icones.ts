import {
  BellRing, BookOpen, Cake, CircleHelp, ClipboardCheck, ClipboardList, FileDown, FileSpreadsheet, FileText, History, KeyRound, Link2, ListChecks,
  MessageCircle, Palette, QrCode, Receipt, Settings, ShieldCheck, SlidersHorizontal, Tag, Tags, Upload, User, Users, type LucideIcon,
} from 'lucide-react-native';

/** Ícone de cada cartão do hub (o domínio não conhece ícone, H2); todos neutros, na cor do texto suave. */
export const ICONES_DAS_CONFIGURACOES: Readonly<Record<string, LucideIcon>> = {
  'meus-dados': User, seguranca: ShieldCheck, ajustes: SlidersHorizontal, 'minha-conta': Receipt, marca: Palette, contato: MessageCircle, 'documentos-pdf': FileDown,
  'equipe-membros': Users, 'equipe-perfis': KeyRound, auditoria: History, questionarios: ClipboardList, anamneses: ClipboardCheck,
  'perguntas-inscricao': ListChecks, interessados: Link2, metodologias: BookOpen, aniversarios: Cake, 'tags-dos-alunos': Tag, 'financeiro-planos': Tags,
  'financeiro-lembretes': BellRing, 'financeiro-recebimento': QrCode, importacao: Upload, 'planilha-completa': FileSpreadsheet,
  ajuda: CircleHelp, termos: FileText,
};

/** Cartão novo sem entrada no mapa (o teste cobra a entrada) ainda aparece, com a engrenagem. */
export const iconeDaConfiguracao = (id: string): LucideIcon => ICONES_DAS_CONFIGURACOES[id] ?? Settings;
