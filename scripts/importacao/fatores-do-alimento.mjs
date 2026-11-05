/**
 * Estimativa nativa de FC e FCc pelo nome. Espelho de `app/src/dominio/fatoresDoAlimento.ts`
 * e de `biblioteca/FatoresDeRendimento`. Só preenche o que veio nulo.
 */

const PERFIS_FC = { SEM_PERDA: 1, LIMPEZA_LEVE: 1.12, DESCASCADO_MEDIO: 1.25, DESCASCADO_ALTO: 1.45 };
const PERFIS_FCC = {
  CRU_OU_PRONTO: 1, GRAO_COZIDO: 2.6, MASSA_COZIDA: 2.5, LEGUMINOSA_COZIDA: 1.85,
  CARNE_GRELHADA_ASSADA: 0.78, CARNE_COZIDA_ENSOPADA: 0.88, LEGUME_TUBERCULO_COZIDO: 0.95,
  LEGUME_TUBERCULO_ASSADO_REFOGADO: 0.82, OVO_PREPARADO: 0.9,
};

const padrao = (alternativas) => new RegExp(`(?<![a-z0-9])(?:${alternativas})(?![a-z0-9])`);
const CRU = padrao('cru(?:a|as|s)?|fresco|fresca|frescos|frescas|in natura|seca?s?|po|flocos|farinha');
const COZIDO = padrao('cozid[a-z]*|vapor');
const GRELHADO = padrao('grelhad[a-z]*|assad[a-z]*|frit[a-z]*|refogad[a-z]*|chapa|airfryer|air fryer|bife');
const ENSOPADO = padrao('cozid[a-z]*|desfiad[a-z]*|ensopad[a-z]*|panela|moid[a-z]*');
const OVO_FEITO = padrao('cozid[a-z]*|mexid[a-z]*|frit[a-z]*|poche|omelete');
const ASSADO_LEGUME = padrao('assad[a-z]*|refogad[a-z]*|grelhad[a-z]*|frit[a-z]*|chips');
const OVO = padrao('ovos?|claras?|gemas?');
const ARROZ = padrao('arroz');
const MASSA = padrao('macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque');
const LEGUMINOSA = padrao('feijao|lentilha|grao de bico|soja');
const GRAO_QUANDO_COZIDO = padrao('quinoa|milho|canjica|aveia');
const PRONTO = padrao('leite|queijo|iogurte|requeijao|whey|oleo|azeite|manteiga|pao|suco');
const PROCESSADO = padrao('bacon|calabresa|presunto|salsicha|linguica|apresuntado');
const OSSO = padrao('coxa|sobrecoxa|costela|acem|asa|com osso');
const CASCA_GROSSA = padrao('banana|manga|abacaxi|abacate|maracuja|melancia|coco');
const FOLHA = padrao('alface|rucula|agriao|couve|espinafre|brocolis|repolho|acelga');
const CASCA_MEDIA = padrao('batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|cebola|alho|pimentao|laranja|mexerica|tangerina|mamao|melao|kiwi|goiaba|legumes');
const CASCA_FINA = padrao('maca|pera|morango|uva|ameixa|pessego|tomate|pepino');
const SEM_DESCARTE = padrao('arroz|macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque|aveia|farinha|feijao|lentilha|grao de bico|soja|leite|queijo|iogurte|whey|oleo|azeite|manteiga|pao|castanha|nozes|noz|amendoa|amendoim|ovos?|claras?|gemas?|chia|linhaca|semente|quinoa');
const CARNE = padrao('carne|bovin[a-z]*|suin[a-z]*|frango|peru|peixe|file|bife|moid[a-z]*|patinho|alcatra|picanha|tilapia|salmao|atum|camarao|lombo|figado|bacon|calabresa|presunto|salsicha|linguica');
const TUBERCULO = padrao('batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|brocolis|couve flor|vagem|legumes');

const casa = (re, texto) => re.test(texto);

function normalizar(texto) {
  return (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

function kcalPor100g(kcal, base, unidade) {
  if (kcal == null || base == null || !Number.isFinite(kcal) || !Number.isFinite(base) || base <= 0) return null;
  if (unidade && String(unidade).toLowerCase() !== 'g') return null;
  return (kcal * 100) / base;
}

function escolherFc(texto) {
  if (casa(PROCESSADO, texto)) return 'SEM_PERDA';
  if (casa(OSSO, texto)) return 'DESCASCADO_ALTO';
  if (casa(CASCA_GROSSA, texto)) return 'DESCASCADO_ALTO';
  if (casa(FOLHA, texto)) return 'DESCASCADO_ALTO';
  if (casa(CASCA_MEDIA, texto)) return 'DESCASCADO_MEDIO';
  if (casa(CASCA_FINA, texto)) return 'LIMPEZA_LEVE';
  if (casa(SEM_DESCARTE, texto) || casa(OVO, texto) || casa(PRONTO, texto)) return 'SEM_PERDA';
  if (casa(CARNE, texto) || texto.includes(' carne') || texto.includes('pescado')) return 'LIMPEZA_LEVE';
  if (texto.includes('fruta')) return 'LIMPEZA_LEVE';
  if (texto.includes('verdura') || texto.includes('hortalica')) return 'DESCASCADO_MEDIO';
  return 'SEM_PERDA';
}

function escolherFcc(texto, kcal100) {
  if (casa(CRU, texto)) return 'CRU_OU_PRONTO';
  if (casa(OVO, texto)) return casa(OVO_FEITO, texto) ? 'OVO_PREPARADO' : 'CRU_OU_PRONTO';
  if (casa(TUBERCULO, texto)) {
    if (casa(ASSADO_LEGUME, texto)) return 'LEGUME_TUBERCULO_ASSADO_REFOGADO';
    if (casa(COZIDO, texto)) return 'LEGUME_TUBERCULO_COZIDO';
    return 'CRU_OU_PRONTO';
  }
  if (casa(CARNE, texto) || texto.includes(' carne') || texto.includes('pescado')) {
    if (casa(GRELHADO, texto)) return 'CARNE_GRELHADA_ASSADA';
    if (casa(ENSOPADO, texto)) return 'CARNE_COZIDA_ENSOPADA';
    return 'CRU_OU_PRONTO';
  }
  if (casa(PRONTO, texto)) return 'CRU_OU_PRONTO';
  if (casa(LEGUMINOSA, texto) || (texto.includes('leguminosa') && !texto.includes(' legumes '))) {
    if (!casa(COZIDO, texto) && kcal100 !== null && kcal100 >= 250) return 'CRU_OU_PRONTO';
    return 'LEGUMINOSA_COZIDA';
  }
  if (casa(MASSA, texto)) {
    if (!casa(COZIDO, texto) && kcal100 !== null && kcal100 >= 300) return 'CRU_OU_PRONTO';
    return 'MASSA_COZIDA';
  }
  if (casa(ARROZ, texto)) {
    if (casa(COZIDO, texto)) return 'GRAO_COZIDO';
    if (kcal100 !== null && kcal100 >= 250) return 'CRU_OU_PRONTO';
    return 'GRAO_COZIDO';
  }
  if (casa(GRAO_QUANDO_COZIDO, texto) && casa(COZIDO, texto)) return 'GRAO_COZIDO';
  return 'CRU_OU_PRONTO';
}

/** Sempre devolve os dois números. `kcal` é o da base (`baseQuantidade` + `baseUnidade`). */
export function estimarFatoresDoAlimento(nome, grupo, kcal, baseQuantidade, baseUnidade) {
  const texto = `${normalizar(nome)} ${normalizar(grupo)}`.trim();
  const perfilFc = escolherFc(texto);
  const perfilFcc = escolherFcc(texto, kcalPor100g(kcal, baseQuantidade, baseUnidade));
  return { fatorCorrecao: PERFIS_FC[perfilFc], fatorCoccao: PERFIS_FCC[perfilFcc] };
}

/** Mantém o número que já veio; estima só o nulo. */
export function completarFatores(fatorCorrecao, fatorCoccao, nome, grupo, kcal, baseQuantidade, baseUnidade) {
  if (fatorCorrecao != null && fatorCoccao != null) return { fatorCorrecao, fatorCoccao };
  const e = estimarFatoresDoAlimento(nome, grupo, kcal, baseQuantidade, baseUnidade);
  return { fatorCorrecao: fatorCorrecao ?? e.fatorCorrecao, fatorCoccao: fatorCoccao ?? e.fatorCoccao };
}
