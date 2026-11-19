package br.com.treinos.api.tags;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagDaConsultoria;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagRequest;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagResumo;
import br.com.treinos.api.tags.TagsDeAlunoDtos.TagsDoAlunoRequest;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tags de aluno (V093): a lista da consultoria (criar, renomear, trocar a cor, apagar) e as tags de cada aluno. O nome é texto
 * digitado pelo treinador e pode identificar alguém: nada daqui vai a log nem a mensagem de erro (as mensagens são fixas e a
 * auditoria tem resumo fixo, só quando algo muda). Quem grava no aluno trava a linha dele ({@code buscarParaAlterar}), o que também
 * segura o limite de 10 contra duas gravações ao mesmo tempo. Quem lê aqui é só a equipe: nenhuma rota do aluno chama este serviço.
 */
@Service
public class TagsDeAlunoService {

    static final int NOME_MAXIMO = 30;
    /** Tamanho da coluna {@code tag_aluno.nome_normalizado} (V093). */
    static final int NOME_NORMALIZADO_MAXIMO = 60;
    static final int TAGS_POR_ALUNO = 10;

    private final TagAlunoRepository tags;
    private final AlunoTagRepository ligacoes;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public TagsDeAlunoService(TagAlunoRepository tags, AlunoTagRepository ligacoes, AlunoRepository alunos, Auditoria auditoria) {
        this.tags = tags;
        this.ligacoes = ligacoes;
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    // ---- a lista da consultoria ----

    @Transactional(readOnly = true)
    public List<TagDaConsultoria> listar() {
        Map<UUID, Long> total = contagens();
        return tags.todasEmOrdem().stream().map(t -> resposta(t, total.getOrDefault(t.getId(), 0L))).toList();
    }

    @Transactional
    public TagDaConsultoria criar(TagRequest r) {
        Dados dados = validar(r);
        if (tags.existsByNomeNormalizado(Buscas.semAcento(dados.nome()))) {
            throw nomeEmUso();
        }
        TagAluno tag;
        try {
            tag = tags.saveAndFlush(new TagAluno(dados.nome(), dados.cor(), agora()));
        } catch (DataIntegrityViolationException e) {
            throw traduzir(e);
        }
        auditoria.registrarEvento("TAG_ALUNO_CRIADA", "TAG_ALUNO", tag.getId(), "Criou uma tag de aluno.");
        return resposta(tag, 0);
    }

    /** {@code versao} obrigatória (ausente ou velha = 409 {@code CONFLITO_EDICAO}). Igual ao gravado = 200 sem auditoria. */
    @Transactional
    public TagDaConsultoria alterar(UUID id, TagRequest r) {
        TagAluno tag = tags.findById(id).orElseThrow(TagsDeAlunoService::naoEncontrada);
        Dados dados = validar(r);
        if (r.versao() == null || !r.versao().equals(tag.getVersao())) {
            throw conflitoDeEdicao();
        }
        if (tags.existsByNomeNormalizadoAndIdNot(Buscas.semAcento(dados.nome()), id)) {
            throw nomeEmUso();
        }
        boolean mudou = tag.alterar(dados.nome(), dados.cor(), agora());
        try {
            tag = tags.saveAndFlush(tag);
        } catch (DataIntegrityViolationException e) {
            throw traduzir(e);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflitoDeEdicao();
        }
        if (mudou) {
            auditoria.registrarEvento("TAG_ALUNO_ALTERADA", "TAG_ALUNO", tag.getId(), "Alterou uma tag de aluno.");
        }
        return resposta(tag, ligacoes.contarDaTag(id));
    }

    /** Apaga a tag e, pelo cascade da FK, a tira de todos os alunos. {@code versao} opcional: informada e diferente = 409. */
    @Transactional
    public void apagar(UUID id, Long versao) {
        TagAluno tag = tags.findById(id).orElseThrow(TagsDeAlunoService::naoEncontrada);
        if (versao != null && !versao.equals(tag.getVersao())) {
            throw conflitoDeEdicao();
        }
        try {
            tags.delete(tag);
            tags.flush();
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflitoDeEdicao();
        }
        auditoria.registrarEvento("TAG_ALUNO_APAGADA", "TAG_ALUNO", id, "Apagou uma tag de aluno.");
    }

    // ---- as tags do aluno ----

    /**
     * Substitui as tags do aluno. Ordem das recusas: aluno de outra consultoria 404, anonimizado 409 {@code ALUNO_ANONIMIZADO}, mais
     * de 10 422 {@code TAGS_LIMITE}, tag inexistente ou de outra consultoria 404. Idempotente: o mesmo conjunto não grava nem audita.
     */
    @Transactional
    public List<TagResumo> definirDoAluno(UUID alunoId, TagsDoAlunoRequest r) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        Set<UUID> pedidas = new LinkedHashSet<>(r.tagIds());
        if (pedidas.size() > TAGS_POR_ALUNO) {
            throw new ValidacaoException("Confira as tags.", "TAGS_LIMITE",
                    List.of(new ApiError.FieldError("tagIds", "Um aluno pode ter até " + TAGS_POR_ALUNO + " tags.")));
        }
        List<TagAluno> escolhidas = pedidas.isEmpty() ? List.of() : tags.travarLeitura(pedidas);
        if (escolhidas.size() != pedidas.size()) {
            throw naoEncontrada();
        }
        Set<UUID> atuais = new HashSet<>(ligacoes.tagIdsDoAluno(alunoId));
        if (!atuais.equals(pedidas)) {
            Set<UUID> sai = new HashSet<>(atuais);
            sai.removeAll(pedidas);
            Set<UUID> entra = new LinkedHashSet<>(pedidas);
            entra.removeAll(atuais);
            if (!sai.isEmpty()) {
                ligacoes.apagar(aluno.getConsultoriaId(), alunoId, sai);
            }
            Instant agora = agora();
            ligacoes.saveAll(entra.stream().map(tagId -> new AlunoTag(alunoId, tagId, agora)).toList());
            ligacoes.flush();
            auditoria.registrarEvento("ALUNO_TAGS_ALTERADAS", "ALUNO", alunoId, "Alterou as tags do aluno.");
        }
        return escolhidas.stream()
                .sorted(java.util.Comparator.comparing(TagAluno::getNomeNormalizado).thenComparing(TagAluno::getId))
                .map(t -> new TagResumo(t.getId(), t.getNome(), t.getCor())).toList();
    }

    /** As tags de vários alunos numa consulta por lote (a lista de alunos); aluno sem tag não entra no mapa. */
    @Transactional(readOnly = true)
    public Map<UUID, List<TagResumo>> dosAlunos(Collection<UUID> alunoIds) {
        Map<UUID, List<TagResumo>> porAluno = new HashMap<>();
        for (List<UUID> lote : AlunoService.lotesDeIds(new ArrayList<>(alunoIds))) {
            for (TagDoAlunoLinha l : ligacoes.linhasDosAlunos(lote)) {
                porAluno.computeIfAbsent(l.alunoId(), k -> new ArrayList<>()).add(new TagResumo(l.tagId(), l.nome(), l.cor()));
            }
        }
        return porAluno;
    }

    @Transactional(readOnly = true)
    public List<TagResumo> doAluno(UUID alunoId) {
        return dosAlunos(List.of(alunoId)).getOrDefault(alunoId, List.of());
    }

    /** Os nomes, para a exportação do aluno (LGPD). */
    @Transactional(readOnly = true)
    public List<String> nomesDoAluno(UUID alunoId) {
        return doAluno(alunoId).stream().map(TagResumo::nome).toList();
    }

    /** Filtro da lista: tag de outra consultoria ou inexistente = 404, sem dizer qual. */
    @Transactional(readOnly = true)
    public void exigirExistem(Set<UUID> ids) {
        if (!ids.isEmpty() && tags.contarExistentes(ids) != ids.size()) {
            throw naoEncontrada();
        }
    }

    // ---- validação ----

    private record Dados(String nome, CorDeTag cor) {
        @Override
        public String toString() {
            return "Dados[...]";
        }
    }

    /** Mensagens fixas: o valor digitado nunca é repetido. Nome com strip e NFC, de 1 a 30, sem caractere de controle. */
    private static Dados validar(TagRequest r) {
        List<ApiError.FieldError> problemas = new ArrayList<>();
        String nome = r.nome() == null ? "" : Normalizer.normalize(r.nome().strip(), Normalizer.Form.NFC);
        if (nome.isEmpty()) {
            problemas.add(new ApiError.FieldError("nome", "Informe o nome da tag."));
        } else if (nome.length() > NOME_MAXIMO) {
            problemas.add(new ApiError.FieldError("nome", "O nome pode ter até " + NOME_MAXIMO + " caracteres."));
        } else if (nome.chars().anyMatch(Character::isISOControl) || Buscas.semAcento(nome).isEmpty()) {
            problemas.add(new ApiError.FieldError("nome", "Use letras, números ou símbolos no nome."));
        } else if (Buscas.semAcento(nome).length() > NOME_NORMALIZADO_MAXIMO) {
            // Alfabetos que decompõem (hangul) passam de 60 depois do NFD e estourariam a coluna nome_normalizado.
            problemas.add(new ApiError.FieldError("nome", "Este nome é longo demais; use um nome mais curto."));
        }
        CorDeTag cor = CorDeTag.ler(r.cor()).orElse(null);
        if (cor == null) {
            problemas.add(new ApiError.FieldError("cor", "Escolha uma das cores."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados da tag.", "TAG_INVALIDA", problemas);
        }
        return new Dados(nome, cor);
    }

    // ---- apoio ----

    private Map<UUID, Long> contagens() {
        return ligacoes.contagens().stream().collect(Collectors.toMap(AlunoTagRepository.Contagem::getTagId,
                AlunoTagRepository.Contagem::getAlunos));
    }

    private static TagDaConsultoria resposta(TagAluno t, long totalAlunos) {
        return new TagDaConsultoria(t.getId(), t.getNome(), t.getCor(), totalAlunos, t.getVersao());
    }

    /** Microssegundos, a precisão do timestamptz: a resposta do PUT sai igual à do GET seguinte. */
    private static Instant agora() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /** A corrida do nome que a checagem prévia não pega: só o nome da restrição é lido (a mensagem do banco traz o valor). */
    private static RuntimeException traduzir(DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && "ux_tag_aluno_nome".equals(c.getConstraintName())) {
                return nomeEmUso();
            }
        }
        return e;
    }

    private static ConflictException nomeEmUso() {
        return new ConflictException("Já existe uma tag com este nome.", "TAG_NOME_EM_USO");
    }

    private static ConflictException conflitoDeEdicao() {
        return new ConflictException("Outra pessoa ou aba alterou esta tag. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }

    private static NaoEncontradoException naoEncontrada() {
        return new NaoEncontradoException("Tag não encontrada.");
    }
}
