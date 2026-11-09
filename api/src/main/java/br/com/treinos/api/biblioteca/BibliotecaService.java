package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoAlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoPagina;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExerciciosPagina;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.FatoresDoAlimento;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportacaoResultado;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.CupomDeSuplemento;
import br.com.treinos.api.web.FiltrosDeLista;
import br.com.treinos.api.web.LinksExternos;
import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Collator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Biblioteca da consultoria e importação do catálogo público. Tudo já isolado pelo {@code @TenantId}. */
@Service
public class BibliotecaService {

    private static final UUID NENHUM = new UUID(0L, 0L);
    private static final int LIMITE_PADRAO = 50;
    private static final int TAMANHO_DA_PAGINA = 30;
    private static final int LIMITE_MAXIMO = 200;
    /** Quantos grupos o filtro do catálogo aceita de uma vez (o catálogo tem bem menos). */
    private static final int LIMITE_GRUPOS = 50;
    /** Valor de enchimento quando não há filtro de grupo: o {@code in} da consulta não aceita lista vazia. */
    private static final List<String> SEM_GRUPO = List.of("");
    private static final BigDecimal FC_MINIMO = new BigDecimal("1.00");
    private static final BigDecimal FC_MAXIMO = new BigDecimal("20.00");
    private static final BigDecimal FCC_MINIMO = new BigDecimal("0.10");
    private static final BigDecimal FCC_MAXIMO = new BigDecimal("10.00");
    private static final BigDecimal BASE_DE_ARMAZENAMENTO = new BigDecimal("100");
    /** Nome neutro: o rótulo não trouxe marca nem nome comercial. */
    static final String WHEY = WheyDoRotulo.NOME;
    private static final TypeReference<List<String>> TEXTOS = new TypeReference<>() { };

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final CatalogoExercicioRepository catalogoExercicios;
    private final CatalogoAlimentoRepository catalogoAlimentos;
    private final VideoUrls videoUrls;
    private final ExercicioImagemRepository imagensProprias;
    private final JsonMapper json;

    public BibliotecaService(ExercicioRepository exercicios, AlimentoRepository alimentos,
                             CatalogoExercicioRepository catalogoExercicios,
                             CatalogoAlimentoRepository catalogoAlimentos, VideoUrls videoUrls,
                             ExercicioImagemRepository imagensProprias, JsonMapper json) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.catalogoExercicios = catalogoExercicios;
        this.catalogoAlimentos = catalogoAlimentos;
        this.videoUrls = videoUrls;
        this.imagensProprias = imagensProprias;
        this.json = json;
    }

    // ---- Exercícios ----

    @Transactional(readOnly = true)
    public List<ExercicioResponse> listarExercicios(String busca) {
        if (busca == null || busca.isBlank()) {
            return responder(exercicios.buscarAtivos(Buscas.padrao(busca)));
        }
        return responder(exercicios.todosAtivos().stream().filter(e -> ExpansorTermosExercicio.casou(e, busca)).toList());
    }

    /**
     * Uma página de exercícios ativos da consultoria. A busca ignora acento e olha nome e grupo muscular, como o
     * filtro de antes; o filtro de grupo é por igualdade (OU entre os escolhidos); {@code grupos} traz todos os da
     * consultoria, sem aplicar o próprio filtro, para o seletor não encolher.
     * shortcut: filtra em memória sobre os ativos da consultoria (centenas), sem coluna de busca; indexar se passar de milhares.
     */
    @Transactional(readOnly = true)
    public ExerciciosPagina paginaDeExercicios(String busca, List<String> grupos, Integer pagina, Integer tamanho) {
        Set<String> filtro = new HashSet<>(gruposDoFiltro(grupos));
        String termo = Buscas.semAcento(busca);
        if (termo.length() > 100) {
            termo = termo.substring(0, 100);
        }
        List<Exercicio> ativos = exercicios.todosAtivos();
        Collator ordem = Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        List<String> todosOsGrupos = ativos.stream().map(e -> Buscas.opcional(e.getGrupoMuscular()))
                .filter(Objects::nonNull).distinct().sorted(ordem).toList();
        String procurado = termo;
        List<Exercicio> casaram = ativos.stream()
                .filter(e -> filtro.isEmpty() || filtro.contains(Objects.toString(Buscas.opcional(e.getGrupoMuscular()), "")))
                .filter(e -> ExpansorTermosExercicio.casou(e, procurado))

                .toList();
        int tam = tamanho == null ? TAMANHO_DA_PAGINA : Math.max(1, Math.min(tamanho, LIMITE_MAXIMO));
        long de = Math.min((long) Math.max(0, pagina == null ? 0 : pagina) * tam, casaram.size());
        List<Exercicio> da = casaram.subList((int) de, (int) Math.min(de + tam, casaram.size()));
        return new ExerciciosPagina(responder(da), casaram.size(), todosOsGrupos);
    }

    /**
     * Resposta dos exercícios com as fotos do catálogo de origem e a marca da imagem própria, em duas consultas para a
     * lista toda (sem uma por exercício).
     */
    List<ExercicioResponse> responder(List<Exercicio> lista) {
        if (lista.isEmpty()) {
            return List.of();
        }
        Set<UUID> deCatalogo = new HashSet<>();
        Set<UUID> todos = new HashSet<>();
        for (Exercicio e : lista) {
            todos.add(e.getId());
            if (e.getCatalogoId() != null) {
                deCatalogo.add(e.getCatalogoId());
            }
        }
        Map<UUID, List<String>> fotos = new HashMap<>();
        if (!deCatalogo.isEmpty()) {
            catalogoExercicios.findAllById(deCatalogo).forEach(c -> fotos.put(c.getId(), c.getImagens()));
        }
        Map<UUID, Instant> proprias = new HashMap<>();
        imagensProprias.marcas(todos).forEach(m -> proprias.put(m.exercicioId(), m.atualizadaEm()));
        return lista.stream().map(e -> ExercicioResponse.de(e,
                e.getCatalogoId() == null ? List.of() : fotos.getOrDefault(e.getCatalogoId(), List.of()),
                proprias.get(e.getId()))).toList();
    }

    ExercicioResponse responder(Exercicio e) {
        return responder(List.of(e)).getFirst();
    }

    @Transactional
    public ExercicioResponse criarExercicio(ExercicioRequest r) {
        String nome = r.nome().trim();
        exigirNomeLivreExercicio(nome, NENHUM);
        Exercicio e = new Exercicio(nome, Buscas.opcional(r.grupoMuscular()), Buscas.opcional(r.equipamento()),
                r.modalidade(), videoUrls.normalizar(r.videoUrl()), Buscas.opcional(r.observacoes()),
                Exercicio.Origem.MANUAL);
        return responder(exercicios.saveAndFlush(e));
    }

    @Transactional
    public ExercicioResponse alterarExercicio(UUID id, ExercicioRequest r) {
        Exercicio e = exercicioAtivo(id);
        String nome = r.nome().trim();
        exigirNomeLivreExercicio(nome, id);
        e.alterar(nome, Buscas.opcional(r.grupoMuscular()), Buscas.opcional(r.equipamento()), r.modalidade(),
                videoUrls.normalizar(r.videoUrl()), Buscas.opcional(r.observacoes()));
        return responder(exercicios.saveAndFlush(e));
    }

    @Transactional
    public void inativarExercicio(UUID id) {
        exercicioAtivo(id).inativar();
    }

    @Transactional(readOnly = true)
    public CatalogoPagina<CatalogoExercicioResponse> catalogoExercicios(String busca, List<String> grupos,
                                                                         String modalidade, Integer limite) {
        List<String> filtro = gruposDoFiltro(grupos);
        Page<CatalogoExercicio> pagina = catalogoExercicios.buscar(Buscas.padraoSemAcento(busca),
                filtro.isEmpty(), filtro.isEmpty() ? SEM_GRUPO : filtro, Buscas.opcional(modalidade), primeiraPagina(limite));
        return new CatalogoPagina<>(pagina.map(CatalogoExercicioResponse::de).getContent(), pagina.getTotalElements());
    }

    @Transactional(readOnly = true)
    public List<String> gruposDoCatalogoDeExercicios() {
        return catalogoExercicios.grupos();
    }

    /** Grupos do filtro: sem espaços nas pontas, sem vazios nem repetidos; vazio = não filtra. */
    private static List<String> gruposDoFiltro(List<String> grupos) {
        if (grupos == null) {
            return List.of();
        }
        List<String> limpos = grupos.stream().map(Buscas::opcional).filter(Objects::nonNull).distinct().toList();
        if (limpos.size() > LIMITE_GRUPOS) {
            throw new BadRequestException("Escolha no máximo " + LIMITE_GRUPOS + " grupos por vez.");
        }
        return limpos;
    }

    /** Limite padrão 50 e máximo 200 (o catálogo tem mais de mil itens). */
    private static Pageable primeiraPagina(Integer limite) {
        int tamanho = limite == null ? LIMITE_PADRAO : Math.max(1, Math.min(limite, LIMITE_MAXIMO));
        return PageRequest.of(0, tamanho);
    }

    /** Copia do catálogo para a biblioteca; nome que já existe (ignorando maiúsculas) fica de fora. */
    @Transactional
    public ImportacaoResultado importarCatalogoExercicios(List<UUID> ids) {
        Set<String> existentes = new HashSet<>(exercicios.nomesAtivos());
        Set<UUID> pedidos = new HashSet<>(ids);
        int importados = 0;
        for (CatalogoExercicio c : catalogoExercicios.findAllById(pedidos)) {
            if (!existentes.add(c.getNome().toLowerCase(Locale.ROOT))) {
                continue;
            }
            exercicios.save(new Exercicio(c.getNome(), c.getGrupoMuscular(), c.getEquipamento(),
                    Exercicio.Modalidade.valueOf(c.getModalidade()), null, null, Exercicio.Origem.CATALOGO, c.getId()));
            importados++;
        }
        // Ignorados = já existiam na biblioteca ou id fora do catálogo.
        return new ImportacaoResultado(importados, pedidos.size() - importados);
    }

    // ---- Alimentos ----

    /**
     * {@code tipo} vazio = só alimentos comuns (a lista de hoje). {@code SUPLEMENTO} lista os suplementos, com busca sem
     * acento e filtro de categoria em {@code grupo}. Outro valor = 400 {@code FILTRO_INVALIDO}, sem repetir o texto.
     */
    @Transactional(readOnly = true)
    public List<AlimentoResponse> listarAlimentos(String busca, String tipo, String grupo) {
        if (tipo == null || tipo.isBlank() || "ALIMENTO".equals(tipo)) {
            return alimentos.buscarAtivos(Buscas.padrao(busca)).stream().map(this::resposta).toList();
        }
        if (!"SUPLEMENTO".equals(tipo)) {
            throw new BadRequestException("Filtro de tipo inválido.", FiltrosDeLista.CODIGO);
        }
        String categoria = grupo == null ? "" : grupo.trim();
        return alimentos.buscarSuplementos(Buscas.padraoSemAcento(busca), categoria, Alimento.Tipo.SUPLEMENTO).stream()
                .map(this::resposta).toList();
    }

    /**
     * Fatores de correção e de cocção e o grupo atuais dos alimentos pedidos, para a prévia da lista de compras no editor da dieta
     * (plano do aluno ou modelo). Mesma busca da publicação ({@code PlanoDietaService.paraPublicar}): inativos entram,
     * porque a publicação também os copia, e alimento de outra consultoria some pelo {@code @TenantId} (como se não
     * existisse). Id que não existe fica fora da resposta. No máximo {@value #LIMITE_MAXIMO} ids distintos por chamada.
     */
    @Transactional(readOnly = true)
    public List<FatoresDoAlimento> fatoresDosAlimentos(List<UUID> ids) {
        Set<UUID> distintos = ids == null ? Set.of() : new LinkedHashSet<>(ids);
        if (distintos.size() > LIMITE_MAXIMO) {
            throw new BadRequestException("Peça no máximo " + LIMITE_MAXIMO + " alimentos por vez.");
        }
        if (distintos.isEmpty()) return List.of();
        return alimentos.findAllById(distintos).stream().map(FatoresDoAlimento::de).toList();
    }

    @Transactional
    public AlimentoResponse criarAlimento(AlimentoRequest r) {
        Alimento.Tipo tipo = tipoDoCorpo(r.tipo());
        Alimento.Valores valores = valores(r, tipo, null);
        exigirNomeLivre(valores, tipo, NENHUM);
        return resposta(alimentos.saveAndFlush(new Alimento(valores, Exercicio.Origem.MANUAL, tipo)));
    }

    @Transactional
    public AlimentoResponse alterarAlimento(UUID id, AlimentoRequest r) {
        Alimento a = alimentoAtivo(id);
        if (r.tipo() != null && !r.tipo().isBlank() && !a.getTipo().name().equals(r.tipo())) {
            throw new ValidacaoException("Confira os dados do alimento.", "ALIMENTO_INVALIDO",
                    List.of(new ApiError.FieldError("tipo", "O tipo não muda depois de gravado.")));
        }
        Alimento.Valores valores = valores(r, a.getTipo(), a);
        exigirNomeLivre(valores, a.getTipo(), id);
        a.alterar(valores);
        return resposta(alimentos.saveAndFlush(a));
    }

    /**
     * Cria os suplementos padrão que esta consultoria ainda não tem. Nome que já existe (mesmo inativo) fica como está.
     * Kcal fica nulo no catálogo Heavy Suppz, que não traz valor nutricional. O Whey do rótulo entra com os valores gravados.
     */
    @Transactional
    public void garantirSuplementosPadrao() {
        Set<String> nomes = new HashSet<>();
        for (String nome : alimentos.nomes(Alimento.Tipo.SUPLEMENTO)) {
            nomes.add(Buscas.semAcento(nome));
        }
        for (SuplementosPadrao.Item item : SuplementosPadrao.itens(json)) {
            String busca = Buscas.semAcento(item.nome());
            if (!nomes.add(busca)) continue;
            alimentos.save(new Alimento(new Alimento.Valores(item.nome(), BASE_DE_ARMAZENAMENTO, "g", null, null, null,
                    null, null, null, null, null, Buscas.opcional(item.categoria()), Buscas.opcional(item.marca()),
                    item.link(), null, Buscas.opcional(item.porcao()), Buscas.opcional(item.porcoesPorEmbalagem()),
                    json.writeValueAsString(item.sabores()), busca), Exercicio.Origem.MANUAL, Alimento.Tipo.SUPLEMENTO));
        }
        garantirWhey(nomes);
    }

    /**
     * Rótulo do Whey (E-002): 30 g, 124 kcal, carboidrato 2,3 g, proteína 24 g, gordura 2,1 g, cerca de 33 porções.
     * Sem marca. Nome que já existe não é alterado. Fibras e sódio não têm coluna.
     */
    private void garantirWhey(Set<String> nomesSemAcento) {
        String busca = Buscas.semAcento(WHEY);
        if (!nomesSemAcento.add(busca)) return;
        alimentos.save(new Alimento(new Alimento.Valores(WHEY, WheyDoRotulo.BASE, "g", WheyDoRotulo.KCAL,
                WheyDoRotulo.PROTEINA, WheyDoRotulo.CARBOIDRATO, WheyDoRotulo.GORDURA, null, null, null, null, null,
                null, null, null, WheyDoRotulo.PORCAO, WheyDoRotulo.PORCOES, WheyDoRotulo.SABORES, busca),
                Exercicio.Origem.MANUAL, Alimento.Tipo.SUPLEMENTO));
    }

    @Transactional
    public void inativarAlimento(UUID id) {
        alimentoAtivo(id).inativar();
    }

    @Transactional(readOnly = true)
    public CatalogoPagina<CatalogoAlimentoResponse> catalogoAlimentos(String busca, List<String> grupos, Integer limite) {
        List<String> filtro = gruposDoFiltro(grupos);
        Page<CatalogoAlimento> pagina = catalogoAlimentos.buscar(Buscas.padraoSemAcento(busca),
                filtro.isEmpty(), filtro.isEmpty() ? SEM_GRUPO : filtro, primeiraPagina(limite));
        return new CatalogoPagina<>(pagina.map(CatalogoAlimentoResponse::de).getContent(), pagina.getTotalElements());
    }

    @Transactional(readOnly = true)
    public List<String> gruposDoCatalogoDeAlimentos() {
        return catalogoAlimentos.grupos();
    }

    @Transactional
    public ImportacaoResultado importarCatalogoAlimentos(List<UUID> ids) {
        Set<String> existentes = new HashSet<>(alimentos.nomesAtivos(Alimento.Tipo.ALIMENTO));
        Set<UUID> pedidos = new HashSet<>(ids);
        int importados = 0;
        for (CatalogoAlimento c : catalogoAlimentos.findAllById(pedidos)) {
            if (!existentes.add(c.getNome().toLowerCase(Locale.ROOT))) {
                continue;
            }
            var fatores = FatoresDeRendimento.completar(c.getFatorCorrecao(), c.getFatorCoccao(), c.getNome(),
                    c.getGrupo(), c.getKcal(), c.getBaseQuantidade(), c.getBaseUnidade());
            alimentos.save(new Alimento(Alimento.Valores.deAlimento(c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                    c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getGramasPorUnidade(),
                    c.getFonte(), fatores.fatorCorrecao(), fatores.fatorCoccao(), GrupoDoAlimento.doCatalogo(c.getGrupo())),
                    Exercicio.Origem.CATALOGO));
            importados++;
        }
        return new ImportacaoResultado(importados, pedidos.size() - importados);
    }

    private Alimento.Valores valores(AlimentoRequest r, Alimento.Tipo tipo, Alimento atual) {
        String grupo = GrupoDoAlimento.normalizar(r.grupo());
        if (tipo == Alimento.Tipo.SUPLEMENTO) {
            return valoresDeSuplemento(r, grupo, atual);
        }
        exigirNutricaoDeAlimento(r);
        var fatores = FatoresDeRendimento.completar(r.fatorCorrecao(), r.fatorCoccao(), r.nome(), grupo,
                r.kcal(), r.baseQuantidade(), r.baseUnidade());
        exigirFatoresEGrupo(fatores.fatorCorrecao(), fatores.fatorCoccao(), grupo);
        return Alimento.Valores.deAlimento(r.nome().trim(), r.baseQuantidade(), r.baseUnidade(), r.kcal(), r.proteina(),
                r.carboidrato(), r.gordura(), r.gramasPorUnidade(), Buscas.opcional(r.fonte()),
                fatores.fatorCorrecao(), fatores.fatorCoccao(), grupo);
    }

    /**
     * Suplemento: não estima fator nem kcal. Base omitida vira 100 g só para a coluna, sem ser valor de rótulo.
     * Na edição, kcal e macros omitidos ficam os que já estavam: o formulário de suplemento não os envia.
     */
    private Alimento.Valores valoresDeSuplemento(AlimentoRequest r, String grupo, Alimento atual) {
        BigDecimal base = r.baseQuantidade() != null ? r.baseQuantidade()
                : atual != null ? atual.getBaseQuantidade() : BASE_DE_ARMAZENAMENTO;
        String unidade = r.baseUnidade() != null && !r.baseUnidade().isBlank() ? r.baseUnidade()
                : atual != null ? atual.getBaseUnidade() : "g";
        exigirFatoresEGrupo(r.fatorCorrecao(), r.fatorCoccao(), grupo);
        List<String> sabores = r.sabores() == null ? List.of() : List.copyOf(new LinkedHashSet<>(r.sabores().stream()
                .map(Buscas::opcional).filter(Objects::nonNull).toList()));
        String nome = r.nome().trim();
        return new Alimento.Valores(nome, base, unidade,
                primeiro(r.kcal(), atual == null ? null : atual.getKcal()),
                primeiro(r.proteina(), atual == null ? null : atual.getProteina()),
                primeiro(r.carboidrato(), atual == null ? null : atual.getCarboidrato()),
                primeiro(r.gordura(), atual == null ? null : atual.getGordura()),
                primeiro(r.gramasPorUnidade(), atual == null ? null : atual.getGramasPorUnidade()),
                primeiroTexto(Buscas.opcional(r.fonte()), atual == null ? null : atual.getFonte()),
                primeiro(r.fatorCorrecao(), atual == null ? null : atual.getFatorCorrecao()),
                primeiro(r.fatorCoccao(), atual == null ? null : atual.getFatorCoccao()),
                grupo, Buscas.opcional(r.marca()), LinksExternos.normalizar(r.link()),
                CupomDeSuplemento.normalizar(r.cupom(), "ALIMENTO_INVALIDO"), Buscas.opcional(r.porcao()),
                Buscas.opcional(r.porcoesPorEmbalagem()), json.writeValueAsString(sabores), Buscas.semAcento(nome));
    }

    private static BigDecimal primeiro(BigDecimal pedido, BigDecimal gravado) {
        return pedido != null ? pedido : gravado;
    }

    private static String primeiroTexto(String pedido, String gravado) {
        return pedido != null ? pedido : gravado;
    }

    private static void exigirNutricaoDeAlimento(AlimentoRequest r) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (r.baseQuantidade() == null) erros.add(new ApiError.FieldError("baseQuantidade", "Informe a quantidade da base."));
        if (r.baseUnidade() == null || r.baseUnidade().isBlank()) {
            erros.add(new ApiError.FieldError("baseUnidade", "Informe a unidade da base."));
        }
        if (r.kcal() == null) erros.add(new ApiError.FieldError("kcal", "Informe as calorias."));
        if (r.proteina() == null) erros.add(new ApiError.FieldError("proteina", "Informe a proteína."));
        if (r.carboidrato() == null) erros.add(new ApiError.FieldError("carboidrato", "Informe o carboidrato."));
        if (r.gordura() == null) erros.add(new ApiError.FieldError("gordura", "Informe a gordura."));
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados do alimento.", "ALIMENTO_INVALIDO", erros);
        }
    }

    private static Alimento.Tipo tipoDoCorpo(String tipo) {
        if (tipo == null || tipo.isBlank() || "ALIMENTO".equals(tipo)) return Alimento.Tipo.ALIMENTO;
        if ("SUPLEMENTO".equals(tipo)) return Alimento.Tipo.SUPLEMENTO;
        throw new ValidacaoException("Confira os dados do alimento.", "ALIMENTO_INVALIDO",
                List.of(new ApiError.FieldError("tipo", "Use ALIMENTO ou SUPLEMENTO.")));
    }

    private AlimentoResponse resposta(Alimento a) {
        List<String> sabores = a.getSabores() == null || a.getSabores().isBlank()
                ? List.of() : json.readValue(a.getSabores(), TEXTOS);
        return AlimentoResponse.de(a, sabores);
    }

    /**
     * Faixas iguais às do CHECK da V011 e às do formulário do app ({@code dominio/fatoresDoAlimento.ts}). Conferidas
     * aqui, e não por anotação no DTO, para responder 422 com o campo e a mensagem em português, como as outras
     * validações de conteúdo; mais de duas casas seriam arredondadas em silêncio pelo {@code numeric(5,2)}. Fator nulo
     * já foi trocado pela estimativa ({@link FatoresDeRendimento}). O grupo (já normalizado) passa pelo mesmo 422,
     * com o campo {@code grupo}, acima de {@value GrupoDoAlimento#MAXIMO} caracteres.
     */
    private static void exigirFatoresEGrupo(BigDecimal fatorCorrecao, BigDecimal fatorCoccao, String grupo) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        fatorForaDaFaixa(fatorCorrecao, FC_MINIMO, FC_MAXIMO).ifPresent(m -> erros.add(
                new ApiError.FieldError("fatorCorrecao", "O fator de correção " + m)));
        fatorForaDaFaixa(fatorCoccao, FCC_MINIMO, FCC_MAXIMO).ifPresent(m -> erros.add(
                new ApiError.FieldError("fatorCoccao", "O fator de cocção " + m)));
        if (GrupoDoAlimento.longoDemais(grupo)) {
            erros.add(new ApiError.FieldError("grupo", "O grupo aceita no máximo " + GrupoDoAlimento.MAXIMO
                    + " caracteres."));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados do alimento.", "ALIMENTO_INVALIDO", erros);
        }
    }

    private static Optional<String> fatorForaDaFaixa(BigDecimal valor, BigDecimal minimo, BigDecimal maximo) {
        if (valor == null) {
            return Optional.empty();
        }
        if (valor.compareTo(minimo) < 0 || valor.compareTo(maximo) > 0) {
            return Optional.of("vai de " + minimo.toPlainString().replace('.', ',') + " a "
                    + maximo.toPlainString().replace('.', ',') + ".");
        }
        if (valor.stripTrailingZeros().scale() > 2) {
            return Optional.of("aceita no máximo duas casas decimais.");
        }
        return Optional.empty();
    }

    private Exercicio exercicioAtivo(UUID id) {
        return exercicios.findById(id).filter(Exercicio::isAtivo)
                .orElseThrow(() -> new NaoEncontradoException("Exercício não encontrado."));
    }

    private Alimento alimentoAtivo(UUID id) {
        return alimentos.findById(id).filter(Alimento::isAtivo)
                .orElseThrow(() -> new NaoEncontradoException("Alimento não encontrado."));
    }

    private void exigirNomeLivreExercicio(String nome, UUID exceto) {
        if (exercicios.existeNomeAtivo(nome.toLowerCase(Locale.ROOT), exceto)) {
            throw new ConflictException("Já existe um exercício com este nome.", "NOME_EM_USO");
        }
    }

    private void exigirNomeLivre(Alimento.Valores valores, Alimento.Tipo tipo, UUID exceto) {
        if (tipo == Alimento.Tipo.SUPLEMENTO) {
            if (alimentos.existeNomeBusca(valores.nomeBusca(), tipo, exceto)) {
                throw new ConflictException("Já existe um suplemento com este nome.", "NOME_EM_USO");
            }
            return;
        }
        if (alimentos.existeNomeAtivo(valores.nome().toLowerCase(Locale.ROOT), tipo, exceto)) {
            throw new ConflictException("Já existe um alimento com este nome.", "NOME_EM_USO");
        }
    }
}
