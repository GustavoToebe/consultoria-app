package br.com.treinos.api.importacao;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.alunos.RegrasDoEndereco;
import br.com.treinos.api.alunos.Sexo;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Ergogenico;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.FatoresDeRendimento;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.biblioteca.GrupoDoAlimento;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.ImportacaoDtos.Amostra;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.CupomDeSuplemento;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.VideoUrls;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.hibernate.Session;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Valida e, na confirmação, grava as linhas válidas. Não chama serviço com {@code @Auditar}: a confirmação inteira
 * gera um único {@code IMPORTACAO_CONCLUIDA}. A exceção é a situação do aluno, que segue as regras do cadastro e grava
 * {@code ALUNO_SITUACAO} só de quem mudou ({@link AlunoService#aplicarSituacaoDaImportacao}). Célula vazia não vira zero
 * e não apaga o que já está.
 */
@Component
class GravadorDaImportacao {

    /**
     * Motivo da célula com erro: erro de fórmula da planilha (#ERROR!, #N/A, #REF!…) ou texto acima de 4.000 letras. Fixo,
     * sem repetir o conteúdo; diz o que fazer (antes era só "Célula com erro.").
     */
    static final String CELULA_COM_ERRO =
            "A célula tem um erro da própria planilha (como #ERROR! ou #N/A) ou um texto longo demais. Corrija e valide de novo.";

    private static final int ERROS_GUARDADOS = 1000;
    private static final int AMOSTRA = 20;
    private static final List<String> CAMPOS_ALUNO = List.of("nome", "email", "telefone", "cpf", "objetivo", "observacoes",
            "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "responsavel", "dias", "situacao", "nascimento",
            "sexo");
    /** Responsável que não casa com o e-mail nem com o nome de um único membro ativo (fixo, sem repetir o texto). */
    static final String RESPONSAVEL_NAO_ENCONTRADO = "Use o e-mail ou o nome de um membro da equipe.";
    static final String SEXO_INVALIDO = "Sexo inválido. Use masculino, feminino ou outro.";

    private final AlunoRepository alunos;
    private final AlunoService alunoService;
    private final UsuarioRepository usuarios;
    private final PlanoDaConsultoria plano;
    private final LimiteDoTreinador limiteDoTreinador;
    private final RegistroPesoRepository pesos;
    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final ErgogenicoRepository ergogenicos;
    private final VideoUrls videos;
    private final JsonMapper json;
    private final EntityManager entityManager;

    GravadorDaImportacao(AlunoRepository alunos, AlunoService alunoService, UsuarioRepository usuarios,
                         PlanoDaConsultoria plano, RegistroPesoRepository pesos, ExercicioRepository exercicios,
                         AlimentoRepository alimentos,
                         ErgogenicoRepository ergogenicos, VideoUrls videos, JsonMapper json,
                         LimiteDoTreinador limiteDoTreinador, EntityManager entityManager) {
        this.entityManager = entityManager;
        this.limiteDoTreinador = limiteDoTreinador;
        this.alunos = alunos;
        this.alunoService = alunoService;
        this.usuarios = usuarios;
        this.plano = plano;
        this.pesos = pesos;
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.ergogenicos = ergogenicos;
        this.videos = videos;
        this.json = json;
    }

    record Resultado(int linhas, int novos, int atualizados, int ignorados, int comErro, List<Erro> erros,
                     List<Amostra> amostra) {
    }

    /** Linhas por lote de INSERT/UPDATE na confirmação; os ids são UUID gerados no Java, então o lote funciona. */
    private static final int LOTE = 500;

    Resultado processar(String destino, LeitorDePlanilha.Planilha planilha, ConfiguracaoDaImportacao config,
                        UUID usuarioId, boolean gravar) {
        List<Linha> dados = List.copyOf(planilha.linhas().subList(
                ConfiguracaoDaImportacao.primeiraDeDados(planilha, config.linhaDoCabecalho()), planilha.linhas().size()));
        Conta conta = new Conta();
        Ctx ctx = new Ctx();
        ctx.regra = config.existentes();
        CTX.set(ctx);
        // Só na confirmação (há transação): o lote vale para esta sessão e volta ao padrão no fim.
        Session sessao = gravar ? entityManager.unwrap(Session.class) : null;
        if (sessao != null) {
            sessao.setJdbcBatchSize(LOTE);
        }
        try {
        switch (destino) {
            case "alunos" -> alunos(dados, config, usuarioId, gravar, conta, planilha.data1904());
            case "pesos" -> pesos(dados, config, usuarioId, gravar, conta, planilha.data1904());
            case "exercicios" -> exercicios(dados, config, gravar, conta);
            case "alimentos" -> alimentos(dados, config, gravar, conta);
            case "suplementos" -> suplementos(dados, config, gravar, conta);
            case "outros" -> outros(dados, config, gravar, conta);
            default -> throw new IllegalStateException("Destino sem gravador.");
        }
        if (gravar) {
            descarregar();
        }
        return new Resultado(dados.size(), conta.novos, conta.atualizados, conta.ignorados, conta.comErro,
                conta.erros, conta.amostra);
        } finally {
            if (sessao != null) {
                sessao.setJdbcBatchSize(null);
            }
            CTX.remove();
        }
    }

    /**
     * Grava de uma vez (em lotes) o que as linhas deixaram pendente. Violação de restrição aqui só vem de outra gravação
     * que correu por fora da trava da consultoria (as repetições da própria planilha já viram erro da linha, em memória):
     * o CPF segue dando o 409 de sempre e o resto vira 409 em vez de 500; a confirmação inteira recua.
     */
    private void descarregar() {
        try {
            alunos.flush();
        } catch (DataIntegrityViolationException e) {
            if (AlunoService.violouCpf(e)) {
                throw AlunoService.cpfEmUso();
            }
            throw new ConflictException("Os dados mudaram durante a importação. Valide de novo.", "CONFLITO_NA_IMPORTACAO");
        }
    }

    private void alunos(List<Linha> dados, ConfiguracaoDaImportacao config, UUID usuarioId, boolean gravar, Conta conta,
                        boolean data1904) {
        Indice indice = new Indice(alunos.findAll());
        Equipe equipe = new Equipe(usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(TenantContext.get(), Papel.TREINADOR));
        Vagas vagas = new Vagas(plano.vagasDeAluno());
        VagasDoTreinador doTreinador = new VagasDoTreinador(limiteDoTreinador);
        // A situação nova de quem já existe, aplicada só depois do flush das linhas: inativar encerra as sessões, o que não
        // se desfaz, e um erro do flush (CPF de outra gravação) recua a confirmação inteira. As linhas seguintes já leem
        // daqui a situação que o aluno vai ter, na prévia e na confirmação.
        Map<Aluno, Boolean> situacoes = new LinkedHashMap<>();
        for (Linha linha : dados) {
            conta.amostra(linha, config, CAMPOS_ALUNO);
            try {
                marcar(linha);
                gravarAluno(linha, config, usuarioId, gravar, conta, indice, equipe, vagas, doTreinador, situacoes, data1904);
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
        if (gravar) {
            descarregar();
            situacoes.forEach((aluno, ativo) -> {
                if (aluno.isAtivo() != ativo) {
                    // Mesmas consequências da rota do cadastro; o flush que falta sai no descarregar do processar.
                    alunoService.aplicarSituacaoDaImportacao(aluno, ativo);
                }
            });
            if (vagas.conferida) {
                // A vaga só é conferida na primeira linha: confere de novo o total gravado (409 e tudo recua se passou).
                plano.exigirDentroDoLimiteDeAlunos();
            }
        }
    }

    private void gravarAluno(Linha linha, ConfiguracaoDaImportacao config, UUID usuarioId, boolean gravar, Conta conta,
                             Indice indice, Equipe equipe, Vagas vagas, VagasDoTreinador doTreinador,
                             Map<Aluno, Boolean> situacoes, boolean data1904) {
        Leitura chave = obrigatoria(linha, config, config.chave());
        if ("cpf".equals(config.chave())) {
            formato(linha.numero(), "cpf", () -> Formatos.cpf(chave.texto()));
        }
        List<Aluno> achados = indice.buscar(config.chave(), chave.texto());
        if (achados.size() > 1) {
            throw falha(linha, config.chave(), "Há mais de um aluno com esta chave.");
        }
        Aluno atual = achados.isEmpty() ? null : achados.get(0);
        boolean ignorar = atual != null && "IGNORAR".equals(config.existentes());
        if (gravar && atual != null && !ignorar && !indice.criadoNestaImportacao(atual)) { // linha ignorada não altera nada: não segura a trava do aluno
            // O findAll do começo não trava e a ficha pode ter mudado desde então (outro treinador desativou o acesso, por
            // exemplo). Relê e trava ANTES de vaga, situação e usuário: a ordem consultoria, aluno e usuário é a de quem
            // desativa (aluno, usuário). buscarParaAlterar não serve: a instância já está no contexto e voltaria velha.
            entityManager.refresh(atual, LockModeType.PESSIMISTIC_WRITE);
        }
        if (atual != null && atual.isAnonimizado()) {
            throw falha(linha, config.chave(), "Aluno anonimizado não é atualizado.");
        }
        if (ignorar) {
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
        boolean estavaAtivo = !novo && situacoes.getOrDefault(atual, atual.isAtivo());
        boolean ativo = situacao == null ? (novo || estavaAtivo) : situacao;
        LocalDate nascimento = nascimentoFinal(novo, atual == null ? null : atual.getDataNascimento(), leitura(linha, config, "nascimento"), data1904);
        Sexo sexo = sexoFinal(novo, atual == null ? null : atual.getSexo(), leitura(linha, config, "sexo"));
        String cpf = cpfFinal(novo, atual, leitura(linha, config, "cpf"), indice, regra);
        Endereco endereco = enderecoFinal(novo, atual, linha, config, regra);
        UUID responsavel = responsavelFinal(novo, atual == null ? null : atual.getResponsavelId(), leitura(linha, config, "responsavel"), equipe, usuarioId, linha.numero());
        String telefone = telefoneFinal(leitura(linha, config, "telefone"), linha.numero());
        boolean reativa = !novo && !estavaAtivo && ativo;
        // Limite do treinador (D7, D8, D15): só quando a linha dá um aluno ativo a um responsável que ainda não o tinha ativo.
        UUID ocupavaVagaDe = estavaAtivo ? atual.getResponsavelId() : null;
        UUID passaAOcuparDe = ativo ? responsavel : null;
        if (passaAOcuparDe != null && !passaAOcuparDe.equals(ocupavaVagaDe) && !doTreinador.cabe(passaAOcuparDe)) {
            Leitura coluna = leitura(linha, config, "responsavel");
            // "escolhido" só quando a linha trouxe a coluna; reativar sem ela devolve o aluno ao responsável que já tinha.
            throw falha(linha, "responsavel", passaAOcuparDe.equals(usuarioId)
                    ? "Você já atingiu o limite de alunos."
                    : coluna.mapeado() && !coluna.vazio()
                    ? "O responsável escolhido já atingiu o limite de alunos."
                    : "O responsável do aluno já atingiu o limite de alunos.");
        }
        if ((novo && ativo) || reativa) {
            if (!vagas.reservar(gravar, plano)) {
                throw falha(linha, "situacao", "Limite de alunos do plano");
            }
        }
        doTreinador.reservar(ocupavaVagaDe, passaAOcuparDe);
        if (novo && (nome == null || nome.isBlank())) {
            throw falha(linha, "nome", "Informe o nome.");
        }
        if (novo) {
            Aluno aluno = new Aluno(nome, email, objetivo, observacoes, dias);
            aluno.alterarSituacao(ativo, Instant.now());
            aluno.alterarResponsavel(responsavel);
            aluno.alterarDataNascimento(nascimento);
            aluno.alterarSexo(sexo); // aluno novo: ainda não há ciclo para desligar
            if (cpf != null) {
                aluno.alterarCpf(cpf);
            }
            if (endereco != null) {
                aluno.alterarEndereco(endereco);
            }
            // Aluno novo não tem acesso: o telefone fica no cadastro até o acesso existir (V048).
            aluno.guardarTelefoneSemAcesso(telefone);
            if (gravar) {
                alunos.save(aluno); // sem flush: os novos saem em lote no fim (descarregar), o CPF repetido já é erro da linha
                indice.criado(aluno);
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
            atual.alterarDataNascimento(nascimento);
            if (sexo != atual.getSexo()) {
                alunoService.definirSexo(atual, sexo.name()); // pela regra do cadastro: deixar de ser feminino desliga o ciclo
            }
            if (telefone != null && atual.getUsuarioId() != null) {
                usuarios.buscarParaAlterar(atual.getUsuarioId()).ifPresent(u -> {
                    if (!"COMPLETAR".equals(regra) || u.getTelefone() == null || u.getTelefone().isBlank()) {
                        u.alterarTelefone(telefone);
                    }
                });
            } else if (telefone != null && (!"COMPLETAR".equals(regra) || atual.getTelefoneSemAcesso() == null)) {
                atual.guardarTelefoneSemAcesso(telefone); // sem acesso: guardado no cadastro até o acesso existir
            }
            salvar(atual);
        }
        if (situacao != null) {
            situacoes.put(atual, ativo);
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
        // Os pesos que já existem dos alunos do arquivo, lidos de uma vez (não uma consulta por linha); as linhas do arquivo entram aqui também.
        Map<String, RegistroPeso> porDia = pesosExistentes(dados, config, indice);
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
                LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
                if (data.isAfter(hoje)) {
                    throw falha(linha, "data", "Data futura.");
                }
                if (!FaixaDeData.REGISTRO.aceita(data, hoje)) {
                    throw falha(linha, "data", FaixaDeData.REGISTRO.mensagem("Data", hoje));
                }
                BigDecimal peso = numero(obrigatoria(linha, config, "peso"), linha.numero(), "peso", new BigDecimal("0.01"),
                        new BigDecimal("499.99"), 2, false);
                Leitura obs = leitura(linha, config, "observacao");
                if (obs.erro()) {
                    throw falha(linha, "observacao", CELULA_COM_ERRO);
                }
                String observacao = obs.mapeado() && !obs.vazio() ? limitar(obs.texto(), 300, linha.numero(), "observacao") : null;
                String idDia = aluno.getId() + ":" + data;
                RegistroPeso existente = porDia.get(idDia);
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
                        pesos.save(novo); // sem flush: sai em lote no fim (descarregar)
                    }
                    porDia.put(idDia, novo);
                    conta.novos++;
                } else if (gravar) {
                    existente.alterar(peso, observacao == null ? existente.getObservacao() : observacao, usuarioId); // gerenciado: o UPDATE sai no fim
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

    /** Pesos já gravados dos alunos que o arquivo cita (achados sem ambiguidade), por {@code alunoId:data}. */
    private Map<String, RegistroPeso> pesosExistentes(List<Linha> dados, ConfiguracaoDaImportacao config, Indice indice) {
        Set<UUID> ids = new HashSet<>();
        for (Linha linha : dados) {
            Leitura chave = leitura(linha, config, "aluno");
            if (chave.erro() || chave.vazio()) {
                continue; // a linha falha depois, com o motivo certo
            }
            List<Aluno> achados = indice.buscar(config.chave(), chave.texto());
            if (achados.size() == 1 && achados.get(0).getId() != null) {
                ids.add(achados.get(0).getId());
            }
        }
        Map<String, RegistroPeso> porDia = new LinkedHashMap<>();
        List<UUID> lista = new ArrayList<>(ids);
        for (int i = 0; i < lista.size(); i += 1000) { // lotes de 1000 ids: longe do teto de parâmetros do driver
            for (RegistroPeso p : pesos.findByAlunoIdIn(lista.subList(i, Math.min(i + 1000, lista.size())))) {
                porDia.put(p.getAlunoId() + ":" + p.getData(), p);
            }
        }
        return porDia;
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
                        exercicios.save(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(nome, grupo, equipamento, modalidade, video, observacoes); // gerenciado: o UPDATE sai no fim
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
            if (a.isAtivo() && a.getTipo() == Alimento.Tipo.ALIMENTO) {
                porNome.put(Buscas.semAcento(a.getNome()), a);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "quantidade", "unidade", "kcal", "proteina", "carboidrato",
                    "gordura", "fibra", "gramas", "fonte", "fc", "fcc", "grupo"));
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
                // Fibra é opcional: célula vazia ou coluna fora do mapeamento mantém o que já havia (nulo na criação, nunca zero).
                BigDecimal fibra = numeroFinal(novo, atual == null ? null : atual.getFibra(), leitura(linha, config, "fibra"), linha.numero(), "fibra",
                        BigDecimal.ZERO, new BigDecimal("99999"), 2, false);
                BigDecimal gramas = numeroFinal(novo, atual == null ? null : atual.getGramasPorUnidade(), leitura(linha, config, "gramas"), linha.numero(), "gramas",
                        new BigDecimal("0.01"), new BigDecimal("999999.99"), 2, false);
                String fonte = textoFinal(novo, atual == null ? null : atual.getFonte(), leitura(linha, config, "fonte"), "fonte", 200, false);
                BigDecimal fc = fator(novo, atual == null ? null : atual.getFatorCorrecao(), leitura(linha, config, "fc"), linha.numero(), "fc", FC_MIN(), FC_MAX());
                BigDecimal fcc = fator(novo, atual == null ? null : atual.getFatorCoccao(), leitura(linha, config, "fcc"), linha.numero(), "fcc", FCC_MIN(), FCC_MAX());
                String grupo = grupoDoAlimento(novo, atual == null ? null : atual.getGrupo(), leitura(linha, config, "grupo"));
                if (fc == null || fcc == null) {
                    var estimado = FatoresDeRendimento.completar(fc, fcc, nome, grupo, kcal, quantidade, unidade);
                    fc = estimado.fatorCorrecao();
                    fcc = estimado.fatorCoccao();
                }
                var valores = Alimento.Valores.deAlimento(nome, quantidade, unidade, kcal, proteina, carboidrato, gordura, fibra, gramas, fonte, fc, fcc, grupo);
                if (novo) {
                    Alimento criado = new Alimento(valores, Exercicio.Origem.IMPORTACAO);
                    if (gravar) {
                        alimentos.save(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores); // gerenciado: o UPDATE sai no fim
                    conta.atualizados++;
                } else {
                    conta.atualizados++;
                }
            } catch (FalhaDaLinha e) {
                conta.falha(e.linha, e.campo, e.motivo);
            }
        }
    }

    /** Aba "Suplementos": grava alimento com tipo SUPLEMENTO. Kcal que já estava no item não é apagado (a planilha não traz). */
    private void suplementos(List<Linha> dados, ConfiguracaoDaImportacao config, boolean gravar, Conta conta) {
        Map<String, Alimento> porNome = new LinkedHashMap<>();
        for (Alimento s : alimentos.findAll()) {
            if (s.isAtivo() && s.getTipo() == Alimento.Tipo.SUPLEMENTO) {
                porNome.put(s.getNome() == null ? "" : Buscas.semAcento(s.getNome()), s);
            }
        }
        for (Linha linha : dados) {
            conta.amostra(linha, config, List.of("nome", "marca", "categoria", "porcao", "porcoes", "sabores", "link", "cupom"));
            try {
                marcar(linha);
                String nome = textoFinal(true, null, obrigatoria(linha, config, "nome"), "nome", 120, true);
                Leitura marcaLida = leitura(linha, config, "marca");
                if (marcaLida.erro()) {
                    throw falha(linha, "marca", CELULA_COM_ERRO);
                }
                String marcaInformada = marcaLida.mapeado() && !marcaLida.vazio() ? limitar(marcaLida.texto(), 80, linha.numero(), "marca") : null;
                Alimento atual = porNome.get(Buscas.semAcento(nome));
                if (atual != null && !mesmaMarca(atual.getMarca(), marcaInformada)) {
                    throw falha(linha, "marca", "Já existe um suplemento com este nome.");
                }
                if (atual != null && "IGNORAR".equals(config.existentes())) {
                    conta.ignorados++;
                    continue;
                }
                boolean novo = atual == null;
                String marca = novo ? marcaInformada : escolher(atual.getMarca(), marcaInformada, marcaLida.mapeado() && !marcaLida.vazio(), config.existentes());
                String categoria = textoFinal(novo, atual == null ? null : atual.getGrupo(), leitura(linha, config, "categoria"), "categoria", 60, false);
                String porcao = textoFinal(novo, atual == null ? null : atual.getPorcao(), leitura(linha, config, "porcao"), "porcao", 80, false);
                String porcoes = textoFinal(novo, atual == null ? null : atual.getPorcoesPorEmbalagem(), leitura(linha, config, "porcoes"), "porcoes", 40, false);
                String saboresAtuais = atual == null || atual.getSabores() == null ? "[]" : atual.getSabores();
                String sabores = sabores(novo, saboresAtuais, leitura(linha, config, "sabores"), config.existentes(), linha.numero());
                String link = link(novo, atual == null ? null : atual.getLink(), leitura(linha, config, "link"), linha.numero());
                String cupom = cupom(novo, atual == null ? null : atual.getCupom(), leitura(linha, config, "cupom"), linha.numero());
                BigDecimal base = novo ? new BigDecimal("100") : atual.getBaseQuantidade();
                String unidade = novo ? "g" : atual.getBaseUnidade();
                var valores = new Alimento.Valores(nome, base, unidade,
                        novo ? null : atual.getKcal(), novo ? null : atual.getProteina(),
                        novo ? null : atual.getCarboidrato(), novo ? null : atual.getGordura(),
                        novo ? null : atual.getFibra(),
                        novo ? null : atual.getGramasPorUnidade(), novo ? null : atual.getFonte(),
                        novo ? null : atual.getFatorCorrecao(), novo ? null : atual.getFatorCoccao(),
                        categoria, marca, link, cupom, porcao, porcoes, sabores, Buscas.semAcento(nome));
                if (novo) {
                    Alimento criado = new Alimento(valores, Exercicio.Origem.IMPORTACAO, Alimento.Tipo.SUPLEMENTO);
                    if (gravar) {
                        alimentos.save(criado);
                    }
                    porNome.put(Buscas.semAcento(nome), criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores); // gerenciado: o UPDATE sai no fim
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
                if (novo) {
                    Ergogenico criado = new Ergogenico(valores);
                    if (gravar) {
                        ergogenicos.save(criado);
                    }
                    porVariante.computeIfAbsent(chave, k -> new ArrayList<>()).add(criado);
                    conta.novos++;
                } else if (gravar) {
                    atual.alterar(valores); // gerenciado: o UPDATE sai no fim
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
            throw falhaCampo(campo, CELULA_COM_ERRO);
        }
        return !lida.mapeado() || lida.vazio() ? "" : limitar(lida.texto(), maximo, -1, campo);
    }

    private static String variante(String nome, String concentracao, String apresentacao) {
        return Buscas.semAcento(nome) + '\0' + (concentracao == null ? "" : concentracao) + '\0'
                + (apresentacao == null ? "" : apresentacao);
    }

    /**
     * Grupo do alimento (opcional): o mesmo texto do cadastro ({@link GrupoDoAlimento#normalizar}) e o mesmo teto de
     * {@value GrupoDoAlimento#MAXIMO} caracteres, com as regras de IGNORAR/COMPLETAR/ATUALIZAR do {@link #textoFinal}.
     */
    private String grupoDoAlimento(boolean novo, String atual, Leitura lida) {
        String texto = textoFinal(novo, atual, lida, "grupo", Integer.MAX_VALUE, false);
        if (texto == null || texto.equals(atual)) {
            return texto;
        }
        String grupo = GrupoDoAlimento.normalizar(texto);
        if (GrupoDoAlimento.longoDemais(grupo)) {
            throw falhaCampo("grupo", "Use no máximo " + GrupoDoAlimento.MAXIMO + " caracteres.");
        }
        return grupo;
    }

    private String textoFinal(boolean novo, String atual, Leitura lida, String campo, int maximo, boolean obrigatorio) {
        if (lida.erro()) {
            throw falhaCampo(campo, CELULA_COM_ERRO);
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
            throw falhaCampo("email", CELULA_COM_ERRO);
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
            throw falhaCampo("dias", CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, "situacao", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return null;
        }
        return switch (ValoresDeCelula.simNao(lida.celula())) {
            case SIM -> true;
            case NAO -> false;
            default -> throw new FalhaDaLinha(numero, "situacao", "Situação inválida. Use ativo ou inativo.");
        };
    }

    private String cpfFinal(boolean novo, Aluno atual, Leitura lida, Indice indice, String regra) {
        if (lida.erro()) {
            throw falhaCampo("cpf", CELULA_COM_ERRO);
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
            throw falhaCampo(campo, CELULA_COM_ERRO);
        }
        return !lida.mapeado() || lida.vazio() ? null : lida.texto();
    }

    private UUID responsavelFinal(boolean novo, UUID atual, Leitura lida, Equipe equipe, UUID usuarioId, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "responsavel", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return novo ? usuarioId : atual;
        }
        Usuario achado = equipe.achar(lida.texto());
        if (achado == null) {
            throw new FalhaDaLinha(numero, "responsavel", RESPONSAVEL_NAO_ENCONTRADO);
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return achado.getId();
    }

    /** Data de nascimento (opcional): a faixa do cadastro (1900 até hoje) e as regras de vazio e COMPLETAR; o valor nunca sai no erro. */
    private LocalDate nascimentoFinal(boolean novo, LocalDate atual, Leitura lida, boolean data1904) {
        if (lida.erro()) {
            throw falhaCampo("nascimento", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        LocalDate data = ValoresDeCelula.data(lida.celula(), data1904);
        if (data == null) {
            throw falhaCampo("nascimento", ValoresDeCelula.pareceMesDiaAno(lida.celula())
                    ? "Data no formato mês/dia/ano. Use dia/mês/ano." : "Data inválida.");
        }
        LocalDate hoje = FaixaDeData.hoje();
        if (!FaixaDeData.REGISTRO.aceita(data, hoje)) {
            throw falhaCampo("nascimento", FaixaDeData.REGISTRO.mensagem("Data de nascimento", hoje));
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return data;
    }

    private Sexo sexoFinal(boolean novo, Sexo atual, Leitura lida) {
        if (lida.erro()) {
            throw falhaCampo("sexo", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        Sexo sexo = sexo(lida.texto());
        if (sexo == null) {
            throw falhaCampo("sexo", SEXO_INVALIDO);
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null) {
            return atual;
        }
        return sexo;
    }

    /** "M", "Masc.", "Homem", "F", "Feminino", "Mulher", "Outro"..., sem acento, caixa nem pontuação; o resto é nulo. */
    static Sexo sexo(String texto) {
        return switch (Buscas.semAcento(texto).replaceAll("[^a-z]", "")) {
            case "m", "masc", "masculino", "homem" -> Sexo.MASCULINO;
            case "f", "fem", "feminino", "mulher" -> Sexo.FEMININO;
            case "outro", "outra", "outros" -> Sexo.OUTRO;
            default -> null;
        };
    }

    private String telefoneFinal(Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "telefone", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return null;
        }
        return formato(numero, "telefone", () -> Formatos.telefone(lida.texto()));
    }

    private Exercicio.Modalidade modalidade(boolean novo, Exercicio atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "modalidade", CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, "video", CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, "unidade", CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, campo, CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, campo, CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, "sabores", CELULA_COM_ERRO);
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
            throw new FalhaDaLinha(numero, "link", CELULA_COM_ERRO);
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

    /** Cupom do suplemento: mesmas regras do cadastro (strip, até 40, a mensagem não repete o valor) e do {@link #link}. */
    private String cupom(boolean novo, String atual, Leitura lida, int numero) {
        if (lida.erro()) {
            throw new FalhaDaLinha(numero, "cupom", CELULA_COM_ERRO);
        }
        if (!lida.mapeado() || lida.vazio()) {
            return atual;
        }
        String limpo = CupomDeSuplemento.limpar(lida.texto());
        if (limpo != null && !CupomDeSuplemento.valido(limpo)) {
            throw new FalhaDaLinha(numero, "cupom", CupomDeSuplemento.MENSAGEM);
        }
        if (!novo && "COMPLETAR".equals(regra()) && atual != null && !atual.isBlank()) {
            return atual;
        }
        return limpo;
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
        ValoresDeCelula.Numero lido = ValoresDeCelula.numero(lida.celula());
        if (lido.situacao() == ValoresDeCelula.Situacao.COM_ERRO) {
            throw new FalhaDaLinha(numero, campo, CELULA_COM_ERRO); // 1E-30000000: recusado antes de qualquer conta
        }
        if (lido.situacao() == ValoresDeCelula.Situacao.AMBIGUO) {
            // "1.500" em texto pode ser 1,5 ou 1500: sem como saber, a linha fica de fora (célula numérica nativa não passa aqui).
            throw new FalhaDaLinha(numero, campo, "Número ambíguo: use vírgula para decimais.");
        }
        // Célula numérica de fórmula traz resíduo de conta (81.900000000000006): volta à escala; casa a mais digitada não.
        BigDecimal valor = lido.valido() ? ValoresDeCelula.naEscala(lido.valor(), lida.numero(), escala) : null;
        if (valor == null || valor.compareTo(min) < 0 || valor.compareTo(max) > 0 || (!zeroPermitido && valor.signum() <= 0)) {
            throw new FalhaDaLinha(numero, campo, "Valor inválido.");
        }
        return valor;
    }

    private LocalDate data(Leitura lida, boolean data1904, int numero, String campo) {
        if (lida.erro() || lida.vazio()) {
            throw new FalhaDaLinha(numero, campo, lida.erro() ? CELULA_COM_ERRO : "Informe a data.");
        }
        LocalDate data = ValoresDeCelula.data(lida.celula(), data1904);
        if (data == null) {
            throw new FalhaDaLinha(numero, campo, ValoresDeCelula.pareceMesDiaAno(lida.celula())
                    ? "Data no formato mês/dia/ano. Use dia/mês/ano." : "Data inválida.");
        }
        return data;
    }

    private Leitura obrigatoria(Linha linha, ConfiguracaoDaImportacao config, String campo) {
        Leitura lida = leitura(linha, config, campo);
        if (lida.erro()) {
            throw new FalhaDaLinha(linha.numero(), campo, CELULA_COM_ERRO);
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
        // CPF e CEP digitados como número perdem os zeros da frente; o marcador de vazio ("x") já chega com o texto vazio.
        int digitos = "cpf".equals(campo) || ("aluno".equals(campo) && "cpf".equals(config.chave())) ? 11
                : "cep".equals(campo) ? 8 : 0;
        String texto = digitos > 0 ? ValoresDeCelula.comZerosAEsquerda(celula, digitos)
                : celula.texto() == null ? "" : celula.texto().trim();
        return new Leitura(texto, celula.numero(), false, true, celula);
    }

    /**
     * Vagas dos responsáveis na importação, iguais na prévia e na confirmação: as vagas de cada responsável são lidas do banco uma
     * vez (a consultoria está travada na confirmação e nada é gravado na prévia, então não mudam por fora) e {@code saldo}
     * acompanha o que as linhas anteriores mudariam: +1 para quem passa a ter o aluno ativo, -1 para quem deixa de ter. Não
     * reconta no banco a cada linha: os alunos novos só são gravados no fim, em lote.
     */
    private static final class VagasDoTreinador {
        private final LimiteDoTreinador limite;
        private final Map<UUID, Optional<Long>> iniciais = new HashMap<>();
        private final Map<UUID, Long> saldo = new HashMap<>();

        VagasDoTreinador(LimiteDoTreinador limite) {
            this.limite = limite;
        }

        /** Lida antes de a linha mexer no responsável: depois disso o banco já teria a mudança e o saldo contaria duas vezes. */
        private Long inicial(UUID responsavel) {
            return iniciais.computeIfAbsent(responsavel, r -> Optional.ofNullable(limite.vagas(r, null))).orElse(null);
        }

        boolean cabe(UUID responsavel) {
            Long vagas = inicial(responsavel);
            return vagas == null || vagas - saldo.getOrDefault(responsavel, 0L) > 0;
        }

        void reservar(UUID deixa, UUID passa) {
            if (!Objects.equals(deixa, passa)) {
                if (deixa != null) {
                    inicial(deixa);
                    saldo.merge(deixa, -1L, Long::sum);
                }
                if (passa != null) {
                    inicial(passa);
                    saldo.merge(passa, 1L, Long::sum);
                }
            }
        }
    }

    private static final class Vagas {
        private Long restantes;
        private boolean conferida;

        Vagas(Long restantes) {
            this.restantes = restantes;
        }

        boolean reservar(boolean gravar, PlanoDaConsultoria plano) {
            if (restantes != null && restantes <= 0) {
                return false;
            }
            if (gravar && !conferida) {
                // Uma vez, na primeira reserva: a consultoria está travada desde antes de contar as vagas e "restantes"
                // acompanha as linhas. Por linha, a contagem (uma consulta) forçaria o flush dos alunos novos a cada aluno.
                // Não captura: a PlanoException (409 LIMITE_DO_PLANO) já marcou a transação como só-rollback ao atravessar
                // o proxy; engolir aqui levaria ao UnexpectedRollbackException (500) no commit. A confirmação inteira recua.
                plano.exigirVagaDeAluno();
                conferida = true;
            }
            if (restantes != null) {
                restantes--;
            }
            return true;
        }
    }

    /** Membros ativos da equipe: o e-mail vale primeiro; sem "@", o nome de um único membro (sem acento nem caixa). */
    private static final class Equipe {
        private final Map<String, Usuario> porEmail = new HashMap<>();
        private final Map<String, List<Usuario>> porNome = new HashMap<>();

        Equipe(List<Usuario> membros) {
            for (Usuario u : membros) {
                if (!u.isAtivo()) {
                    continue;
                }
                porEmail.put(Emails.normalizar(u.getEmail()), u);
                String nome = Buscas.semAcento(u.getNome());
                if (!nome.isEmpty()) {
                    porNome.computeIfAbsent(nome, k -> new ArrayList<>()).add(u);
                }
            }
        }

        Usuario achar(String texto) {
            if (texto.contains("@")) {
                return porEmail.get(Emails.normalizar(texto));
            }
            List<Usuario> donos = porNome.getOrDefault(Buscas.semAcento(texto), List.of());
            return donos.size() == 1 ? donos.getFirst() : null; // dois membros com o mesmo nome: só pelo e-mail
        }
    }

    private static final class Leitura {
        final String texto;
        final boolean numero;
        final boolean erro;
        final boolean mapeado;
        /** A célula lida (nula sem coluna mapeada ou além do fim da linha): número, data e sim/não leem dela. */
        final Celula celula;

        Leitura(String texto, boolean numero, boolean erro, boolean mapeado, Celula celula) {
            this.texto = texto;
            this.numero = numero;
            this.erro = erro;
            this.mapeado = mapeado;
            this.celula = celula;
        }

        static Leitura ausente() {
            return new Leitura("", false, false, false, null);
        }

        static Leitura emBranco() {
            return new Leitura("", false, false, true, null);
        }

        static Leitura comErro() {
            return new Leitura("", false, true, true, null);
        }

        Celula celula() {
            return celula;
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
        /** Alunos gravados por esta importação e ainda sem flush: não há linha no banco para travar nem reler. */
        private final Set<Aluno> criados = Collections.newSetFromMap(new IdentityHashMap<>());

        Indice(List<Aluno> todos) {
            todos.forEach(this::adicionar);
        }

        void criado(Aluno aluno) {
            criados.add(aluno);
        }

        boolean criadoNestaImportacao(Aluno aluno) {
            return criados.contains(aluno);
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
