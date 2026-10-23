package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoAlimentoResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.CatalogoPagina;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioResponse;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.FatoresDoAlimento;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ImportacaoResultado;
import br.com.treinos.api.web.Buscas;
import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
    private static final int LIMITE_MAXIMO = 200;
    /** Quantos grupos o filtro do catálogo aceita de uma vez (o catálogo tem bem menos). */
    private static final int LIMITE_GRUPOS = 50;
    /** Valor de enchimento quando não há filtro de grupo: o {@code in} da consulta não aceita lista vazia. */
    private static final List<String> SEM_GRUPO = List.of("");
    private static final BigDecimal FC_MINIMO = new BigDecimal("1.00");
    private static final BigDecimal FC_MAXIMO = new BigDecimal("20.00");
    private static final BigDecimal FCC_MINIMO = new BigDecimal("0.10");
    private static final BigDecimal FCC_MAXIMO = new BigDecimal("10.00");

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final CatalogoExercicioRepository catalogoExercicios;
    private final CatalogoAlimentoRepository catalogoAlimentos;
    private final VideoUrls videoUrls;
    private final ExercicioImagemRepository imagensProprias;

    public BibliotecaService(ExercicioRepository exercicios, AlimentoRepository alimentos,
                             CatalogoExercicioRepository catalogoExercicios,
                             CatalogoAlimentoRepository catalogoAlimentos, VideoUrls videoUrls,
                             ExercicioImagemRepository imagensProprias) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.catalogoExercicios = catalogoExercicios;
        this.catalogoAlimentos = catalogoAlimentos;
        this.videoUrls = videoUrls;
        this.imagensProprias = imagensProprias;
    }

    // ---- Exercícios ----

    @Transactional(readOnly = true)
    public List<ExercicioResponse> listarExercicios(String busca) {
        return responder(exercicios.buscarAtivos(Buscas.padrao(busca)));
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

    @Transactional(readOnly = true)
    public List<AlimentoResponse> listarAlimentos(String busca) {
        return alimentos.buscarAtivos(Buscas.padrao(busca)).stream().map(AlimentoResponse::de).toList();
    }

    /**
     * Fatores de correção e de cocção atuais dos alimentos pedidos, para a prévia da lista de compras no editor da dieta
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
        Alimento.Valores valores = valores(r);
        exigirNomeLivreAlimento(valores.nome(), NENHUM);
        return AlimentoResponse.de(alimentos.saveAndFlush(new Alimento(valores, Exercicio.Origem.MANUAL)));
    }

    @Transactional
    public AlimentoResponse alterarAlimento(UUID id, AlimentoRequest r) {
        Alimento a = alimentoAtivo(id);
        Alimento.Valores valores = valores(r);
        exigirNomeLivreAlimento(valores.nome(), id);
        a.alterar(valores);
        return AlimentoResponse.de(alimentos.saveAndFlush(a));
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
        Set<String> existentes = new HashSet<>(alimentos.nomesAtivos());
        Set<UUID> pedidos = new HashSet<>(ids);
        int importados = 0;
        for (CatalogoAlimento c : catalogoAlimentos.findAllById(pedidos)) {
            if (!existentes.add(c.getNome().toLowerCase(Locale.ROOT))) {
                continue;
            }
            alimentos.save(new Alimento(new Alimento.Valores(c.getNome(), c.getBaseQuantidade(), c.getBaseUnidade(),
                    c.getKcal(), c.getProteina(), c.getCarboidrato(), c.getGordura(), c.getGramasPorUnidade(),
                    c.getFonte(), c.getFatorCorrecao(), c.getFatorCoccao()), Exercicio.Origem.CATALOGO));
            importados++;
        }
        return new ImportacaoResultado(importados, pedidos.size() - importados);
    }

    private static Alimento.Valores valores(AlimentoRequest r) {
        exigirFatores(r);
        return new Alimento.Valores(r.nome().trim(), r.baseQuantidade(), r.baseUnidade(), r.kcal(), r.proteina(),
                r.carboidrato(), r.gordura(), r.gramasPorUnidade(), Buscas.opcional(r.fonte()), r.fatorCorrecao(),
                r.fatorCoccao());
    }

    /**
     * Faixas iguais às do CHECK da V011 e às do formulário do app ({@code dominio/fatoresDoAlimento.ts}). Conferidas
     * aqui, e não por anotação no DTO, para responder 422 com o campo e a mensagem em português, como as outras
     * validações de conteúdo; mais de duas casas seriam arredondadas em silêncio pelo {@code numeric(5,2)}.
     */
    private static void exigirFatores(AlimentoRequest r) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        fatorForaDaFaixa(r.fatorCorrecao(), FC_MINIMO, FC_MAXIMO).ifPresent(m -> erros.add(
                new ApiError.FieldError("fatorCorrecao", "O fator de correção " + m)));
        fatorForaDaFaixa(r.fatorCoccao(), FCC_MINIMO, FCC_MAXIMO).ifPresent(m -> erros.add(
                new ApiError.FieldError("fatorCoccao", "O fator de cocção " + m)));
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os fatores do alimento.", "ALIMENTO_INVALIDO", erros);
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

    private void exigirNomeLivreAlimento(String nome, UUID exceto) {
        if (alimentos.existeNomeAtivo(nome.toLowerCase(Locale.ROOT), exceto)) {
            throw new ConflictException("Já existe um alimento com este nome.", "NOME_EM_USO");
        }
    }
}
