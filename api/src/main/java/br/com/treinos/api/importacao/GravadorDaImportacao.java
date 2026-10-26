package br.com.treinos.api.importacao;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.RegrasDoEndereco;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Ergogenico;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.biblioteca.Suplemento;
import br.com.treinos.api.biblioteca.SuplementoRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.conta.PlanoException;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.ImportacaoDtos.Amostra;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Valida e, na confirmação, grava as linhas válidas. Não chama serviço com {@code @Auditar}: a confirmação inteira
 * gera um único {@code IMPORTACAO_CONCLUIDA}. A exceção é a situação do aluno, que segue as regras do cadastro e grava
 * {@code ALUNO_SITUACAO} só de quem mudou ({@link AlunoService#aplicarSituacaoDaImportacao}). Célula vazia não vira zero
 * e não apaga o que já está.
 */
@Component
class GravadorDaImportacao {

    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final int ERROS_GUARDADOS = 1000;
    private static final int AMOSTRA = 20;
    private static final List<String> CAMPOS_ALUNO = List.of("nome", "email", "telefone", "cpf", "objetivo", "observacoes",
            "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "responsavel", "dias", "situacao");

    private final AlunoRepository alunos;
    private final AlunoService alunoService;
    private final UsuarioRepository usuarios;
    private final PlanoDaConsultoria plano;
    private final RegistroPesoRepository pesos;
    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final SuplementoRepository suplementos;
    private final ErgogenicoRepository ergogenicos;
    private final VideoUrls videos;
    private final JsonMapper json;

    GravadorDaImportacao(AlunoRepository alunos, AlunoService alunoService, UsuarioRepository usuarios,
                         PlanoDaConsultoria plano, RegistroPesoRepository pesos, ExercicioRepository exercicios,
                         AlimentoRepository alimentos, SuplementoRepository suplementos,
                         ErgogenicoRepository ergogenicos, VideoUrls videos, JsonMapper json) {
        this.alunos = alunos;
        this.alunoService = alunoService;
        this.usuarios = usuarios;
        this.plano = plano;
        this.pesos = pesos;
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.suplementos = suplementos;
        this.ergogenicos = ergogenicos;
        this.videos = videos;
        this.json = json;
    }

    record Resultado(int linhas, int novos, int atualizados, int ignorados, int comErro, List<Erro> erros,
                     List<Amostra> amostra) {
    }

    Resultado processar(String destino, LeitorDePlanilha.Planilha planilha, ConfiguracaoDaImportacao config,
                        UUID usuarioId, boolean gravar) {
        List<Linha> dados = config.cabecalho() && !planilha.linhas().isEmpty()
                ? planilha.linhas().subList(1, planilha.linhas().size()) : List.copyOf(planilha.linhas());
        Conta conta = new Conta();
        Ctx ctx = new Ctx();
        ctx.regra = config.existentes();
        CTX.set(ctx);
        try {
        switch (destino) {
            case "alunos" -> alunos(dados, config, usuarioId, gravar, conta);
            case "pesos" -> pesos(dados, config, usuarioId, gravar, conta, planilha.data1904());
            case "exercicios" -> exercicios(dados, config, gravar, conta);
            case "alimentos" -> alimentos(dados, config, gravar, conta);
            case "suplementos" -> suplementos(dados, config, gravar, conta);
            case "outros" -> outros(dados, config, gravar, conta);
            default -> throw new IllegalStateException("Destino sem gravador.");
        }
        return new Resultado(dados.size(), conta.novos, conta.atualizados, conta.ignorados, conta.comErro,
                conta.erros, conta.amostra);
        } finally {
            CTX.remove();
        }
    }

    private void alunos(List<Linha> dados, ConfiguracaoDaImportacao config, UUID usuarioId, boolean gravar, Conta conta) {
        Indice indice = new Indice(alunos.findAll());
        Map<String, Usuario> equipe = new LinkedHashMap<>();
        for (Usuario u : usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(), Papel.TREINADOR)) {
            if (u.isAtivo()) {
                equipe.put(Emails.normalizar(u.getEmail()), u);
            }
        }
        Vagas vagas = new Vagas(plano.vagasDeAluno());
        for (Linha linha : dados) {
            conta.amostra(linha, config, CAMPOS_ALUNO);
            try {
                marcar(linha);
                gravarAluno(linha, config, usuarioId, gravar, conta, indice, equipe, vagas);
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    private void gravarAluno(Linha linha, ConfiguracaoDaImportacao config, UUID usuarioId, boolean gravar, Conta conta,
                             Indice indice, Map<String, Usuario> equipe, Vagas vagas) {
        Leitura chave = obrigatoria(linha, config, config.chave());
        if ("cpf".equals(config.chave())) {
            formato(linha.numero(), "cpf", () -> Formatos.cpf(chave.texto()));
        }
        List<Aluno> achados = indice.buscar(config.chave(), chave.texto());
        if (achados.size() > 1) {
            throw falha(linha, config.chave(), "Há mais de um aluno com esta chave.");
        }
        Aluno atual = achados.isEmpty() ? null : achados.get(0);
        if (atual != null && atual.isAnonimizado()) {
            throw falha(linha, config.chave(), "Aluno anonimizado não é atualizado.");
        }
        if (atual != null && "IGNORAR".equals(config.existentes())) {
            conta.ignorados++;
            return;
        }
        boolean novo = atual == null;
        String regra = config.existentes();
        String nome = textoFinal(novo, atual == null ? null : atual.getNome(), leitura(linha, config, "nome"), "nome", 120, true);
        String email = emailFinal(novo, atual == null ? null : atual.getEmail(), leitura(linha, config, "email"));
        String objetivo = textoFinal(novo, atual == null ? null : atual.getObjetivo(), leitura(linha, config, "objetivo"), "objetivo", 200, false);
        String observacoes = textoFinal(novo, atual == null ? null : atual.getObservacoes(), leitura(linha, config, "observacoes"), "observacoes", 4000, false);
        Integer dias = diasFinal(novo, atual == null ? null : atual.getDiasAtualizacao(), leitura(linha, config, "dias"));
        Boolean situacao = situacao(leitura(linha, config, "situacao"), linha.numero());
        if (!novo && "COMPLETAR".equals(regra)) {
            situacao = null; // completar só preenche vazio: a situação de quem já existe nunca muda
        }
        boolean ativo = situacao == null ? (novo || atual.isAtivo()) : situacao;
        String cpf = cpfFinal(novo, atual, leitura(linha, config, "cpf"), indice, regra);
        Endereco endereco = enderecoFinal(novo, atual, linha, config, regra);
        UUID responsavel = responsavelFinal(novo, atual == null ? null : atual.getResponsavelId(), leitura(linha, config, "responsavel"), equipe, usuarioId, linha.numero());
        String telefone = telefoneFinal(atual, leitura(linha, config, "telefone"), linha.numero());
        boolean reativa = !novo && !atual.isAtivo() && ativo;
        if ((novo && ativo) || reativa) {
            if (!vagas.reservar(gravar, plano)) {
                throw falha(linha, "situacao", "Limite de alunos do plano");
            }
        }
        if (novo && (nome == null || nome.isBlank())) {
            throw falha(linha, "nome", "Informe o nome.");
        }
        if (novo) {
            Aluno aluno = new Aluno(nome, email, objetivo, observacoes, dias);
            aluno.alterarSituacao(ativo, Instant.now());
            aluno.alterarResponsavel(responsavel);
            if (cpf != null) {
                aluno.alterarCpf(cpf);
            }
            if (endereco != null) {
                aluno.alterarEndereco(endereco);
            }
            if (gravar) {
                salvar(aluno);
            }
            indice.adicionar(aluno);
            conta.novos++;
            return;
        }
        if (gravar) {
            atual.alterarDados(nome, email, objetivo, observacoes, dias);
            if (responsavel != null && config.mapeado("responsavel") && !leitura(linha, config, "responsavel").vazio()) {
                atual.alterarResponsavel(responsavel);
            }
            if (config.mapeado("cpf") && !leitura(linha, config, "cpf").vazio()) {
                atual.alterarCpf(cpf);
            }
            if (endereco != null) {
                atual.alterarEndereco(endereco);
            }
            if (telefone != null && atual.getUsuarioId() != null) {
                usuarios.buscarParaAlterar(atual.getUsuarioId()).ifPresent(u -> {
                    if (!"COMPLETAR".equals(regra) || u.getTelefone() == null || u.getTelefone().isBlank()) {
                        u.alterarTelefone(telefone);
                    }
                });
            }
            salvar(atual);
            if (situacao != null && situacao != atual.isAtivo()) {
                // Por último: encerrar as sessões não se desfaz. Mesmas consequências da rota do cadastro.
                alunoService.aplicarSituacaoDaImportacao(atual, ativo);
                salvar(atual);
            }
        }
        indice.trocarCpf(atual, cpf);
        conta.atualizados++;
    }

    /** A rede de segurança do CPF: o índice da planilha já pega o repetido; isto cobre só a corrida com outra gravação. */
    private void salvar(Aluno aluno) {
        try {
            alunos.saveAndFlush(aluno);
        } catch (DataIntegrityViolationException e) {
            if (AlunoService.violouCpf(e)) {
                throw AlunoService.cpfEmUso();
            }
            throw e;
        }
    }

    private void pesos(List<Linha> dados, ConfiguracaoDaImportacao config, UUID usuarioId, boolean gravar, Conta conta,
                       boolean data1904) {
        Indice indice = new Indice(alunos.findAll());
        Map<String, RegistroPeso> porDia = new LinkedHashMap<>();
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("aluno", "data", "peso", "observacao"));
            try {
                marcar(linha);
                Leitura chave = obrigatoria(linha, config, "aluno");
                List<Aluno> achados = indice.buscar(config.chave(), chave.texto());
                if (achados.isEmpty()) {
                    throw falha(linha, "aluno", "Aluno não encontrado.");
                }
                if (achados.size() > 1) {
                    throw falha(linha, "aluno", "Há mais de um aluno com esta chave.");
                }
                Aluno aluno = achados.get(0);
                if (aluno.isAnonimizado()) {
                    throw falha(linha, "aluno", "Aluno anonimizado não é atualizado.");
                }
                LocalDate data = data(obrigatoria(linha, config, "data"), data1904, linha.numero(), "data");
                if (data.isAfter(LocalDate.now(Fuso.BRASILIA))) {
                    throw falha(linha, "data", "Data futura.");
                }
                BigDecimal peso = numero(obrigatoria(linha, config, "peso"), linha.numero(), "peso", new BigDecimal("0.01"),
                        new BigDecimal("499.99"), 2, false);
                Leitura obs = leitura(linha, config, "observacao");
                if (obs.erro()) {
                    throw falha(linha, "observacao", "Célula com erro.");
                }
                String observacao = obs.mapeado() && !obs.vazio() ? limitar(obs.texto(), 300, linha.numero(), "observacao") : null;
                String idDia = aluno.getId() + ":" + data;
                RegistroPeso existente = porDia.get(idDia);
                if (existente == null && aluno.getId() != null) {
                    existente = pesos.findByAlunoIdAndData(aluno.getId(), data).orElse(null);
                }
                if (existente != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                if (existente == null) {
                    if (aluno.getId() == null) {
                        throw falha(linha, "aluno", "Aluno não encontrado.");
                    }
                    RegistroPeso novo = new RegistroPeso(aluno.getId(), data, peso, observacao, usuarioId);
                    if (gravar) {
                        pesos.saveAndFlush(novo);
                    }
                    porDia.put(idDia, novo);
                    conta.novos++;
                } else if (gravar) {
                    existente.alterar(peso, observacao == null ? existente.getObservacao() : observacao, usuarioId);
                    pesos.saveAndFlush(existente);
                    porDia.put(idDia, existente);
                    conta.atualizados++;
                } else {
                    porDia.put(idDia, existente);
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    private void exercicios(List<Linha> dados, ConfiguracaoDaImportacao config, boolean gravar, Conta conta) {
        Map<String, Exercicio> porNome = new LinkedHashMap<>();
        for (Exercicio e : exercicios.findAll()) {
            if (e.isAtivo()) {
                porNome.put(Buscas.semAcento(e.getNome()), e);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "grupo", "equipamento", "modalidade", "video", "observacoes"));
            try {
                marcar(linha);
                String nomeChave = Buscas.semAcento(obrigatoria(linha, config, "nome").texto());
                Exercicio atual = porNome.get(nomeChave);
                if (atual != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                boolean novo = atual == null;
                String nome = textoFinal(novo, atual == null ? null : atual.getNome(), leitura(linha, config, "nome"), "nome", 120, true);
                String grupo = textoFinal(novo, atual == null ? null : atual.getGrupoMuscular(), leitura(linha, config, "grupo"), "grupo", 60, false);
                String equipamento = textoFinal(novo, atual == null ? null : atual.getEquipamento(), leitura(linha, config, "equipamento"), "equipamento", 60, false);
                Exercicio.Modalidade modalidade = modalidade(novo, atual, leitura(linha, config, "modalidade"), linha.numero());
                String video = video(novo, atual == null ? null : atual.getVideoUrl(), leitura(linha, config, "video"), linha.numero());
                String observacoes = textoFinal(novo, atual == null ? null : atual.getObservacoes(), leitura(linha, config, "observacoes"), "observacoes", 4000, false);
                if (novo) {
                    Exercicio criado = new Exercicio(nome, grupo, equipamento, modalidade, video, observacoes, Exercicio.Origem.IMPORTACAO);
                    if (gravar) {
                        exercicios.saveAndFlush(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(nome, grupo, equipamento, modalidade, video, observacoes);
                    exercicios.saveAndFlush(atual);
                    conta.atualizados++;
                } else {
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    private void alimentos(List<Linha> dados, ConfiguracaoDaImportacao config, boolean gravar, Conta conta) {
        Map<String, Alimento> porNome = new LinkedHashMap<>();
        for (Alimento a : alimentos.findAll()) {
            if (a.isAtivo()) {
                porNome.put(Buscas.semAcento(a.getNome()), a);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "quantidade", "unidade", "kcal", "proteina", "carboidrato",
                    "gordura", "gramas", "fonte", "fc", "fcc"));
            try {
                marcar(linha);
                Alimento atual = porNome.get(Buscas.semAcento(obrigatoria(linha, config, "nome").texto()));
                if (atual != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                boolean novo = atual == null;
                String nome = textoFinal(novo, atual == null ? null : atual.getNome(), leitura(linha, config, "nome"), "nome", 160, true);
                BigDecimal quantidade = numeroFinal(novo, atual == null ? null : atual.getBaseQuantidade(), leitura(linha, config, "quantidade"),
                        linha.numero(), "quantidade", new BigDecimal("0.01"), new BigDecimal("999999.99"), 2, true);
                String unidade = unidadeFinal(novo, atual == null ? null : atual.getBaseUnidade(), leitura(linha, config, "unidade"), linha.numero());
                BigDecimal kcal = numeroFinal(novo, atual == null ? null : atual.getKcal(), leitura(linha, config, "kcal"), linha.numero(), "kcal",
                        BigDecimal.ZERO, new BigDecimal("99999"), 2, true);
                BigDecimal proteina = numeroFinal(novo, atual == null ? null : atual.getProteina(), leitura(linha, config, "proteina"), linha.numero(), "proteina",
                        BigDecimal.ZERO, new BigDecimal("99999"), 2, true);
                BigDecimal carboidrato = numeroFinal(novo, atual == null ? null : atual.getCarboidrato(), leitura(linha, config, "carboidrato"), linha.numero(), "carboidrato",
                        BigDecimal.ZERO, new BigDecimal("99999"), 2, true);
                BigDecimal gordura = numeroFinal(novo, atual == null ? null : atual.getGordura(), leitura(linha, config, "gordura"), linha.numero(), "gordura",
                        BigDecimal.ZERO, new BigDecimal("99999"), 2, true);
                BigDecimal gramas = numeroFinal(novo, atual == null ? null : atual.getGramasPorUnidade(), leitura(linha, config, "gramas"), linha.numero(), "gramas",
                        new BigDecimal("0.01"), new BigDecimal("999999.99"), 2, false);
                String fonte = textoFinal(novo, atual == null ? null : atual.getFonte(), leitura(linha, config, "fonte"), "fonte", 200, false);
                BigDecimal fc = fator(novo, atual == null ? null : atual.getFatorCorrecao(), leitura(linha, config, "fc"), linha.numero(), "fc", FC_MIN(), FC_MAX());
                BigDecimal fcc = fator(novo, atual == null ? null : atual.getFatorCoccao(), leitura(linha, config, "fcc"), linha.numero(), "fcc", FCC_MIN(), FCC_MAX());
                var valores = new Alimento.Valores(nome, quantidade, unidade, kcal, proteina, carboidrato, gordura, gramas, fonte, fc, fcc);
                if (novo) {
                    Alimento criado = new Alimento(valores, Exercicio.Origem.IMPORTACAO);
                    if (gravar) {
                        alimentos.saveAndFlush(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores);
                    alimentos.saveAndFlush(atual);
                    conta.atualizados++;
                } else {
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    private void suplementos(List<Linha> dados, ConfiguracaoDaImportacao config, boolean gravar, Conta conta) {
        Map<String, Suplemento> porNome = new LinkedHashMap<>();
        for (Suplemento s : suplementos.findAll()) {
            if (s.isAtivo()) {
                porNome.put(s.getNome() == null ? "" : Buscas.semAcento(s.getNome()), s);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "marca", "categoria", "porcao", "porcoes", "sabores", "link"));
            try {
                marcar(linha);
                String nome = textoFinal(true, null, obrigatoria(linha, config, "nome"), "nome", 120, true);
                Leitura marcaLida = leitura(linha, config, "marca");
                if (marcaLida.erro()) {
                    throw falha(linha, "marca", "Célula com erro.");
                }
                String marcaInformada = marcaLida.mapeado() && !marcaLida.vazio() ? limitar(marcaLida.texto(), 80, linha.numero(), "marca") : null;
                Suplemento atual = porNome.get(Buscas.semAcento(nome));
                if (atual != null && !mesmaMarca(atual.getMarca(), marcaInformada)) {
                    throw falha(linha, "marca", "Já existe um suplemento com este nome.");
                }
                if (atual != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                boolean novo = atual == null;
                String marca = novo ? marcaInformada : escolher(atual.getMarca(), marcaInformada, marcaLida.mapeado() && !marcaLida.vazio(), config.existentes());
                String categoria = textoFinal(novo, atual == null ? null : atual.getCategoria(), leitura(linha, config, "categoria"), "categoria", 60, false);
                String porcao = textoFinal(novo, atual == null ? null : atual.getPorcao(), leitura(linha, config, "porcao"), "porcao", 80, false);
                String porcoes = textoFinal(novo, atual == null ? null : atual.getPorcoesPorEmbalagem(), leitura(linha, config, "porcoes"), "porcoes", 40, false);
                String sabores = sabores(novo, atual == null ? "[]" : atual.getSabores(), leitura(linha, config, "sabores"), config.existentes(), linha.numero());
                String link = link(novo, atual == null ? null : atual.getLink(), leitura(linha, config, "link"), linha.numero());
                var valores = new Suplemento.Valores(nome, Buscas.semAcento(nome), marca, categoria, porcao, porcoes, sabores, link);
                if (novo) {
                    Suplemento criado = new Suplemento(valores);
                    if (gravar) {
                        suplementos.saveAndFlush(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores);
                    suplementos.saveAndFlush(atual);
                    conta.atualizados++;
                } else {
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    /**
     * A identidade na biblioteca é nome (sem acento) + concentração + apresentação, como no {@code existeIgual}: sem
     * correspondência exata a linha cria a variante; com ela, a regra vale para categoria, princípio ativo e observação.
     */
    private void outros(List<Linha> dados, ConfiguracaoDaImportacao config, boolean gravar, Conta conta) {
        Map<String, List<Ergogenico>> porVariante = new LinkedHashMap<>();
        for (Ergogenico e : ergogenicos.findAll()) {
            if (e.isAtivo()) {
                porVariante.computeIfAbsent(variante(e.getNome(), e.getConcentracao(), e.getApresentacao()), k -> new ArrayList<>()).add(e);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "categoria", "principio", "concentracao", "apresentacao", "observacao"));
            try {
                marcar(linha);
                String nomeLido = textoFinal(true, null, obrigatoria(linha, config, "nome"), "nome", 120, true);
                String concentracao = identidade(leitura(linha, config, "concentracao"), "concentracao", 40);
                String apresentacao = identidade(leitura(linha, config, "apresentacao"), "apresentacao", 40);
                String chave = variante(nomeLido, concentracao, apresentacao);
                List<Ergogenico> achados = porVariante.getOrDefault(chave, List.of());
                if (achados.size() > 1) {
                    throw falha(linha, "nome", "Há mais de um item com este nome, concentração e apresentação.");
                }
                Ergogenico atual = achados.isEmpty() ? null : achados.get(0);
                if (atual != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                boolean novo = atual == null;
                String nome = novo ? nomeLido : textoFinal(false, atual.getNome(), leitura(linha, config, "nome"), "nome", 120, true);
                String categoria = textoFinal(novo, atual == null ? null : atual.getCategoria(), leitura(linha, config, "categoria"), "categoria", 60, false);
                String principio = textoFinal(novo, atual == null ? null : atual.getPrincipioAtivo(), leitura(linha, config, "principio"), "principio", 160, false);
                String observacao = textoFinal(novo, atual == null ? null : atual.getObservacao(), leitura(linha, config, "observacao"), "observacao", 500, false);
                var valores = new Ergogenico.Valores(categoria, nome, Buscas.semAcento(nome), principio,
                        Buscas.semAcento(principio), concentracao.isEmpty() ? null : concentracao,
                        apresentacao.isEmpty() ? null : apresentacao, observacao);
                if (novo && ergogenicos.existeIgual(Buscas.semAcento(nome), concentracao, apresentacao, UUID.randomUUID())) {
                    throw falha(linha, "nome", "Já existe um item com este nome.");
                }
                if (novo) {
                    Ergogenico criado = new Ergogenico(valores);
                    if (gravar) {
                        ergogenicos.saveAndFlush(criado);
                    }
                    porVariante.computeIfAbsent(chave, k -> new ArrayList<>()).add(criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores);
                    ergogenicos.saveAndFlush(atual);
                    conta.atualizados++;
                } else {
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    /** Concentração e apresentação como identidade: ausente ou vazia é "" (o {@code existeIgual} compara assim). */
    private String identidade(Leitura lida, String campo, int maximo) {
        if (lida.erro()) {
            throw falhaCampo(campo, "Célula com erro.");
        }
        return !lida.mapeado() || lida.vazio() ? "" : limitar(lida.texto(), maximo, -1, campo);
    }

    private static String variante(String nome, String concentracao, String apresentacao) {
        return Buscas.semAcento(nome) + '\0' + (concentracao == null ? "" : concentracao) + '\0'
                + (apresentacao == null ? "" : apresentacao);
    }

    private String textoFinal(boolean novo, String atual, Leitura lida, String campo, int maximo, boolean obrigatorio) {
        if (lida.erro()) {
            throw falhaCampo(campo, "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            if (novo && obrigatorio) {
                throw falhaCampo(campo, "Informe este campo.");
            }
            return atual;
        }
        String texto = limitar(lida.texto(), maximo, -1, campo);
        if (!novo && "COMPLETAR".equals(regra()) && atual != null && !atual.isBlank()) {
            return atual;
        }
        return texto;
    }

    private String emailFinal(boolean novo, String atual, Leitura lida) {
        if (lida.erro()) {
            throw falhaCampo("email", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        String email = Emails.normalizar(lida.texto());
        if (email.length() > 254 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw falhaCampo("email", "E-mail inválido.");
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null && !atual.isBlank()) {
            return atual;
        }
        return email;
    }

    private Integer diasFinal(boolean novo, Integer atual, Leitura lida) {
        if (lida.erro()) {
            throw falhaCampo("dias", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        try {
            int dias = Integer.parseInt(lida.texto().replace(" ", ""));
            if (dias < 1 || dias > 365) {
                throw new NumberFormatException();
            }
            if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
                return atual;
            }
            return dias;
        } catch (NumberFormatException e) {
            throw falhaCampo("dias", "Dias de atualização inválidos.");
        }
    }

    private Boolean situacao(Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "situacao", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return null;
        }
        String s = Buscas.semAcento(lida.texto());
        if (s.equals("ativo") || s.equals("sim") || s.equals("1")) {
            return true;
        }
        if (s.equals("inativo") || s.equals("nao") || s.equals("0")) {
            return false;
        }
        throw new FalhaDaLinha(numero, "situacao", "Situação inválida. Use ativo ou inativo.");
    }

    private String cpfFinal(boolean novo, Aluno atual, Leitura lida, Indice indice, String regra) {
        if (lida.erro()) {
            throw falhaCampo("cpf", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual == null ? null : atual.getCpf();
        }
        String cpf = formato(-1, "cpf", () -> Formatos.cpf(lida.texto()));
        if (!novo && "COMPLETAR".equals(regra) && atual.getCpf() != null && !atual.getCpf().isBlank()) {
            return atual.getCpf();
        }
        List<Aluno> donos = indice.buscar("cpf", cpf);
        boolean deOutro = donos.stream().anyMatch(a -> atual == null || !java.util.Objects.equals(a, atual));
        if (deOutro) {
            throw falhaCampo("cpf", "CPF já cadastrado em outro aluno.");
        }
        return cpf;
    }

    /**
     * O endereço é um bloco, como na ficha: sem nenhuma coluna preenchida não mexe (nulo); com alguma, a linha traz o
     * endereço completo (a mesma {@link RegrasDoEndereco}) e ele substitui o atual por inteiro, sem mesclar. Em COMPLETAR
     * só grava se o atual está todo vazio.
     */
    private Endereco enderecoFinal(boolean novo, Aluno atual, Linha linha, ConfiguracaoDaImportacao config, String regra) {
        if (!enderecoInformado(linha, config)) {
            return null;
        }
        var resultado = RegrasDoEndereco.normalizar(new Endereco(
                parteEndereco(leitura(linha, config, "cep"), "cep"),
                parteEndereco(leitura(linha, config, "logradouro"), "logradouro"),
                parteEndereco(leitura(linha, config, "numero"), "numero"),
                parteEndereco(leitura(linha, config, "complemento"), "complemento"),
                parteEndereco(leitura(linha, config, "bairro"), "bairro"),
                parteEndereco(leitura(linha, config, "cidade"), "cidade"),
                parteEndereco(leitura(linha, config, "uf"), "uf")));
        if (!resultado.valido()) {
            var erro = resultado.erros().get(0);
            throw falhaCampo(erro.campo() == null ? "cep" : erro.campo(), erro.mensagem());
        }
        if (!novo && "COMPLETAR".equals(regra) && atual.endereco() != null) {
            return null;
        }
        return resultado.endereco();
    }

    private static boolean enderecoInformado(Linha linha, ConfiguracaoDaImportacao config) {
        for (String campo : List.of("cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf")) {
            Leitura lida = leitura(linha, config, campo);
            if (lida.erro() || (lida.mapeado() && !lida.vazio())) {
                return true;
            }
        }
        return false;
    }

    private String parteEndereco(Leitura lida, String campo) {
        if (lida.erro()) {
            throw falhaCampo(campo, "Célula com erro.");
        }
        return !lida.mapeado() || lida.vazio() ? null : lida.texto();
    }

    private UUID responsavelFinal(boolean novo, UUID atual, Leitura lida, Map<String, Usuario> equipe, UUID usuarioId, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "responsavel", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return novo ? usuarioId : atual;
        }
        Usuario achado = equipe.get(Emails.normalizar(lida.texto()));
        if (achado == null) {
            throw new FalhaDaLinha(numero, "responsavel", "Responsável não encontrado.");
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return achado.getId();
    }

    private String telefoneFinal(Aluno atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "telefone", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return null;
        }
        if (atual == null || atual.getUsuarioId() == null) {
            throw new FalhaDaLinha(numero, "telefone", "Aluno sem acesso ao app.");
        }
        return formato(numero, "telefone", () -> Formatos.telefone(lida.texto()));
    }

    private Exercicio.Modalidade modalidade(boolean novo, Exercicio atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "modalidade", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return novo ? Exercicio.Modalidade.MAQUINA : atual.getModalidade();
        }
        String chave = Buscas.semAcento(lida.texto()).toUpperCase(Locale.ROOT).replace(' ', '_');
        if ("MAQUINA".equals(chave) || "ELASTICO".equals(chave) || "LIVRE".equals(chave) || "CARDIO".equals(chave) || "OUTRO".equals(chave)) {
            return Exercicio.Modalidade.valueOf(chave);
        }
        if ("PESO_CORPORAL".equals(chave) || "PESO CORPORAL".replace(' ', '_').equals(chave)) {
            return Exercicio.Modalidade.PESO_CORPORAL;
        }
        throw new FalhaDaLinha(numero, "modalidade", "Modalidade inválida.");
    }

    private String video(boolean novo, String atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "video", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        try {
            String normalizado = videos.normalizar(lida.texto());
            if (!novo && "COMPLETAR".equals(regra()) && atual != null && !atual.isBlank()) {
                return atual;
            }
            return normalizado;
        } catch (BadRequestException e) {
            throw new FalhaDaLinha(numero, "video", e.getMessage());
        }
    }

    private String unidadeFinal(boolean novo, String atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "unidade", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            if (novo) {
                throw new FalhaDaLinha(numero, "unidade", "Informe a unidade (g, ml ou un).");
            }
            return atual;
        }
        String u = lida.texto().toLowerCase(Locale.ROOT);
        if (!u.equals("g") && !u.equals("ml") && !u.equals("un")) {
            throw new FalhaDaLinha(numero, "unidade", "Unidade inválida. Use g, ml ou un.");
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return u;
    }

    private BigDecimal numeroFinal(boolean novo, BigDecimal atual, Leitura lida, int numero, String campo,
                                   BigDecimal min, BigDecimal max, int escala, boolean obrigatorio) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, campo, "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            if (novo && obrigatorio) {
                throw new FalhaDaLinha(numero, campo, "Informe este campo.");
            }
            return atual;
        }
        BigDecimal valor = numero(lida, numero, campo, min, max, escala, min.signum() == 0);
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return valor;
    }

    private BigDecimal fator(boolean novo, BigDecimal atual, Leitura lida, int numero, String campo, BigDecimal min, BigDecimal max) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, campo, "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        BigDecimal valor = numero(lida, numero, campo, min, max, 2, true);
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return valor;
    }

    private String sabores(boolean novo, String atualJson, Leitura lida, String regra, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "sabores", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atualJson == null ? "[]" : atualJson;
        }
        if (!novo && "COMPLETAR".equals(regra) && atualJson != null && !atualJson.equals("[]")) {
            return atualJson;
        }
        String[] partes = lida.texto().contains(";") ? lida.texto().split(";") : lida.texto().split(",");
        List<String> lista = new ArrayList<>();
        for (String parte : partes) {
            String item = parte.trim();
            if (item.isEmpty()) {
                continue;
            }
            if (item.length() > 60 || lista.size() == 20) {
                throw new FalhaDaLinha(numero, "sabores", "Sabor inválido.");
            }
            lista.add(item);
        }
        return json.writeValueAsString(lista);
    }

    private String link(boolean novo, String atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "link", "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        try {
            String normalizado = LinksExternos.normalizar(lida.texto());
            if (!novo && "COMPLETAR".equals(regra()) && atual != null && !atual.isBlank()) {
                return atual;
            }
            return normalizado;
        } catch (BadRequestException e) {
            throw new FalhaDaLinha(numero, "link", e.getMessage());
        }
    }

    private static final ThreadLocal<Ctx> CTX = new ThreadLocal<>();

    private static final class Ctx {
        String regra = "ATUALIZAR";
        int linha;
    }

    private static void marcar(Linha linha) {
        CTX.get().linha = linha.numero();
    }

    private static String regra() {
        return CTX.get().regra;
    }

    private BigDecimal numero(Leitura lida, int numero, String campo, BigDecimal min, BigDecimal max, int escala, boolean zeroPermitido) {
        String texto = lida.texto().trim();
        if (!lida.numero() && texto.indexOf(',') >= 0 && texto.indexOf('.') < 0) {
            texto = texto.replace(',', '.');
        }
        try {
            BigDecimal valor = new BigDecimal(texto);
            if (valor.scale() > escala) {
                valor = valor.setScale(escala, RoundingMode.UNNECESSARY);
            }
            if (valor.compareTo(min) < 0 || valor.compareTo(max) > 0 || (!zeroPermitido && valor.signum() <= 0)) {
                throw new NumberFormatException();
            }
            return valor;
        } catch (NumberFormatException | ArithmeticException e) {
            throw new FalhaDaLinha(numero, campo, "Valor inválido.");
        }
    }

    private LocalDate data(Leitura lida, boolean data1904, int numero, String campo) {
        if (lida.erro() || lida.vazio()) {
            throw new FalhaDaLinha(numero, campo, lida.erro() ? "Célula com erro." : "Informe a data.");
        }
        if (lida.numero()) {
            LocalDate data = LeitorDePlanilha.dataSerial(new BigDecimal(lida.texto()), data1904);
            if (data == null) {
                throw new FalhaDaLinha(numero, campo, "Data inválida.");
            }
            return data;
        }
        String texto = lida.texto().trim();
        try {
            if (texto.matches("\\d{2}/\\d{2}/\\d{4}")) {
                return LocalDate.parse(texto, DIA);
            }
            if (texto.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return LocalDate.parse(texto);
            }
        } catch (DateTimeParseException e) {
            throw new FalhaDaLinha(numero, campo, "Data inválida.");
        }
        throw new FalhaDaLinha(numero, campo, "Data inválida.");
    }

    private Leitura obrigatoria(Linha linha, ConfiguracaoDaImportacao config, String campo) {
        Leitura lida = leitura(linha, config, campo);
        if (lida.erro()) {
            throw new FalhaDaLinha(linha.numero(), campo, "Célula com erro.");
        }
        if (!lida.mapeado() || lida.vazio()) {
            throw new FalhaDaLinha(linha.numero(), campo, "Informe este campo.");
        }
        return lida;
    }

    private String limitar(String texto, int maximo, int numero, String campo) {
        if (texto.length() > maximo) {
            if (numero < 0) {
                throw falhaCampo(campo, "Use no máximo " + maximo + " caracteres.");
            }
            throw new FalhaDaLinha(numero, campo, "Use no máximo " + maximo + " caracteres.");
        }
        return texto;
    }

    private String formato(int numero, String campo, java.util.function.Supplier<String> acao) {
        try {
            return acao.get();
        } catch (BadRequestException e) {
            if (numero < 0) {
                throw falhaCampo(campo, e.getMessage());
            }
            throw new FalhaDaLinha(numero, campo, e.getMessage());
        }
    }

    private static String escolher(String atual, String informado, boolean presente, String regra) {
        if (!presente) {
            return atual;
        }
        if ("COMPLETAR".equals(regra) && atual != null && !atual.isBlank()) {
            return atual;
        }
        return informado;
    }

    private static boolean mesmaMarca(String atual, String informada) {
        return Buscas.semAcento(atual).equals(Buscas.semAcento(informada));
    }

    private FalhaDaLinha falha(Linha linha, String campo, String motivo) {
        return new FalhaDaLinha(linha.numero(), campo, motivo);
    }

    private FalhaDaLinha falhaCampo(String campo, String motivo) {
        return new FalhaDaLinha(CTX.get().linha, campo, motivo);
    }

    private static Leitura leitura(Linha linha, ConfiguracaoDaImportacao config, String campo) {
        if (!config.mapeado(campo)) {
            return Leitura.ausente();
        }
        int coluna = config.coluna(campo);
        if (coluna < 0 || coluna >= linha.celulas().size()) {
            return Leitura.emBranco();
        }
        Celula celula = linha.celulas().get(coluna);
        if (celula.erro()) {
            return Leitura.comErro();
        }
        return new Leitura(celula.texto() == null ? "" : celula.texto().trim(), celula.numero(), false, true);
    }

    private static final class Vagas {
        private Long restantes;

        Vagas(Long restantes) {
            this.restantes = restantes;
        }

        boolean reservar(boolean gravar, PlanoDaConsultoria plano) {
            if (restantes != null && restantes <= 0) {
                return false;
            }
            if (gravar) {
                try {
                    plano.exigirVagaDeAluno();
                } catch (PlanoException e) {
                    return false;
                }
            }
            if (restantes != null) {
                restantes--;
            }
            return true;
        }
    }

    private static final class Leitura {
        final String texto;
        final boolean numero;
        final boolean erro;
        final boolean mapeado;

        Leitura(String texto, boolean numero, boolean erro, boolean mapeado) {
            this.texto = texto;
            this.numero = numero;
            this.erro = erro;
            this.mapeado = mapeado;
        }

        static Leitura ausente() {
            return new Leitura("", false, false, false);
        }

        static Leitura emBranco() {
            return new Leitura("", false, false, true);
        }

        static Leitura comErro() {
            return new Leitura("", false, true, true);
        }

        String texto() {
            return texto;
        }

        boolean erro() {
            return erro;
        }

        boolean mapeado() {
            return mapeado;
        }

        boolean numero() {
            return numero;
        }

        boolean vazio() {
            return texto == null || texto.isBlank();
        }
    }

    private static final class FalhaDaLinha extends RuntimeException {
        final int linha;
        final String campo;
        final String motivo;

        FalhaDaLinha(int linha, String campo, String motivo) {
            this.linha = linha;
            this.campo = campo;
            this.motivo = motivo;
        }
    }

    private static final class Conta {
        int novos;
        int atualizados;
        int ignorados;
        int comErro;
        final List<Erro> erros = new ArrayList<>();
        final List<Amostra> amostra = new ArrayList<>();

        void falha(int linha, String campo, String motivo) {
            comErro++;
            if (erros.size() < ERROS_GUARDADOS) {
                erros.add(new Erro(linha, campo, motivo));
            }
        }

        void amostra(Linha linha, ConfiguracaoDaImportacao config, List<String> campos) {
            if (amostra.size() >= AMOSTRA) {
                return;
            }
            Map<String, String> valores = new LinkedHashMap<>();
            for (String campo : campos) {
                if (!config.mapeado(campo)) {
                    continue;
                }
                Leitura lida = leitura(linha, config, campo);
                if (!lida.erro()) {
                    valores.put(campo, lida.texto());
                }
            }
            amostra.add(new Amostra(linha.numero(), valores));
        }
    }

    private static final class Indice {
        private final Map<String, List<Aluno>> porEmail = new LinkedHashMap<>();
        private final Map<String, List<Aluno>> porCpf = new LinkedHashMap<>();
        private final Map<String, List<Aluno>> porNome = new LinkedHashMap<>();
        /** O CPF com que cada aluno está no índice: na prévia a entidade não muda, então não dá para reler dela. */
        private final Map<Aluno, String> cpfIndexado = new IdentityHashMap<>();

        Indice(List<Aluno> todos) {
            todos.forEach(this::adicionar);
        }

        void adicionar(Aluno aluno) {
            por(porEmail, Emails.normalizar(aluno.getEmail()), aluno);
            por(porCpf, aluno.getCpf(), aluno);
            por(porNome, Buscas.semAcento(aluno.getNome()), aluno);
            cpfIndexado.put(aluno, aluno.getCpf());
        }

        /** O índice acompanha as atualizações: o CPF antigo de quem mudou fica livre e o novo passa a ser dele. */
        void trocarCpf(Aluno aluno, String novo) {
            String antigo = cpfIndexado.get(aluno);
            if (java.util.Objects.equals(antigo, novo)) {
                return;
            }
            if (antigo != null) {
                List<Aluno> donos = porCpf.get(antigo);
                if (donos != null) {
                    donos.removeIf(d -> d.equals(aluno));
                }
            }
            por(porCpf, novo, aluno);
            cpfIndexado.put(aluno, novo);
        }

        List<Aluno> buscar(String chave, String texto) {
            return switch (chave) {
                case "email" -> lista(porEmail, Emails.normalizar(texto));
                case "cpf" -> lista(porCpf, cpf(texto));
                case "nome" -> lista(porNome, Buscas.semAcento(texto));
                default -> List.of();
            };
        }

        private static String cpf(String texto) {
            try {
                return Formatos.cpf(texto);
            } catch (BadRequestException e) {
                return null;
            }
        }

        private static void por(Map<String, List<Aluno>> mapa, String chave, Aluno aluno) {
            if (chave == null || chave.isBlank()) {
                return;
            }
            mapa.computeIfAbsent(chave, k -> new ArrayList<>()).add(aluno);
        }

        private static List<Aluno> lista(Map<String, List<Aluno>> mapa, String chave) {
            if (chave == null || chave.isBlank()) {
                return List.of();
            }
            return mapa.getOrDefault(chave, List.of());
        }
    }

    private static BigDecimal FC_MIN() {
        return new BigDecimal("1.00");
    }

    private static BigDecimal FC_MAX() {
        return new BigDecimal("20.00");
    }

    private static BigDecimal FCC_MIN() {
        return new BigDecimal("0.10");
    }

    private static BigDecimal FCC_MAX() {
        return new BigDecimal("10.00");
    }
}
